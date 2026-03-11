import { z } from "zod";
import { router, protectedProcedure } from "../lib/trpc";
import { db } from "../db";
import { tradingAccount, trade } from "../db/schema/trading";
import { randomUUID } from "crypto";
import { createNotification } from "../lib/notifications";
import { buildAutoPropAccountFields } from "../lib/prop-firm-detection";

function parseCsv(content: string): Array<Record<string, string>> {
  const lines = content.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const rawHeaders = lines[0].split(",").map((h) => h.trim());
  const seen: Record<string, number> = {};
  const headers = rawHeaders.map((h) => {
    if (seen[h] === undefined) {
      seen[h] = 0;
      return h;
    } else {
      seen[h] += 1;
      return `${h} ${seen[h]}`; // e.g., Price 1, Price 2
    }
  });
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((v) => v.trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = cols[i] ?? ""));
    return obj;
  });
}

function toNum(v?: string) {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toDate(v?: string) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function stripOuterQuotes(s: string) {
  if (!s) return s;
  const first = s[0];
  const last = s[s.length - 1];
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return s.slice(1, -1);
  }
  return s;
}

function normalizeKey(s: string) {
  return stripOuterQuotes(String(s || ""))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function pick(r: Record<string, string>, candidates: string[]): string | null {
  // Exact match first
  for (const c of candidates)
    if (r[c] !== undefined && r[c] !== "") return r[c];
  // Normalized header match
  const map: Record<string, string> = {};
  for (const k of Object.keys(r)) map[normalizeKey(k)] = r[k];
  for (const c of candidates) {
    const v = map[normalizeKey(c)];
    if (v !== undefined && v !== "") return v;
  }
  return null;
}

export const uploadRouter = router({
  importCsv: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        broker: z.string().min(1),
        csvBase64: z.string().min(1),
        initialBalance: z.number().nonnegative().optional(),
        initialCurrency: z.enum(["$", "£", "€"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { updates: autoPropFields } = await buildAutoPropAccountFields({
        broker: input.broker,
        brokerServer: null,
        initialBalance: input.initialBalance ?? null,
      });

      const csvBuffer = Buffer.from(input.csvBase64, "base64");
      const rows = parseCsv(csvBuffer.toString("utf8"));

      const accountId = randomUUID();
      await db.insert(tradingAccount).values({
        id: accountId,
        userId,
        name: input.name,
        broker: input.broker,
        initialBalance: input.initialBalance as any,
        initialCurrency: input.initialCurrency ?? null,
        ...autoPropFields,
      });

      const inserts = rows.map((r) => {
        const typeRaw = (r["Type"] || "").toLowerCase();
        const tradeType =
          typeRaw === "buy" ? "long" : typeRaw === "sell" ? "short" : null;
        const openStr =
          pick(r, [
            "Open",
            "Open time",
            "Open Time",
            "Open date",
            "Open Date",
            "OpenTime",
          ]) ||
          r["Open"] ||
          null;
        const closeStr =
          pick(r, [
            "Close",
            "Close time",
            "Close Time",
            "Close date",
            "Close Date",
            "CloseTime",
          ]) ||
          r["Close"] ||
          null;

        // Trade duration in seconds: prefer CSV column, derive from open/close if absent
        const durationRaw =
          pick(r, [
            "Trade duration in seconds",
            "Trade Duration in Seconds",
            "Duration in seconds",
            "Duration (seconds)",
            "trade_duration_seconds",
            "Trade duration",
          ]) || null;
        const durationNum = toNum(durationRaw || undefined);
        const openDate = (() => {
          const raw = stripOuterQuotes(String(openStr || "").trim());
          if (!raw) return null;
          const cleaned = raw
            .replace(/[^0-9\-: T]/g, "")
            .replace("T", " ")
            .trim();
          const d = new Date(cleaned);
          return isNaN(d.getTime()) ? toDate(raw) : d;
        })();
        const closeDate = (() => {
          const raw = stripOuterQuotes(String(closeStr || "").trim());
          if (!raw) return null;
          const cleaned = raw
            .replace(/[^0-9\-: T]/g, "")
            .replace("T", " ")
            .trim();
          const d = new Date(cleaned);
          return isNaN(d.getTime()) ? toDate(raw) : d;
        })();
        const derivedSeconds =
          openDate && closeDate
            ? Math.max(0, Math.floor((+closeDate - +openDate) / 1000))
            : null;
        const tradeDurationSecondsValue =
          durationNum !== null
            ? String(durationNum)
            : derivedSeconds !== null
            ? String(derivedSeconds)
            : null;
        return {
          id: randomUUID(),
          accountId,
          open: openStr || null,
          tradeType: tradeType as any,
          volume: toNum(r["Volume"]),
          symbol: r["Symbol"] || null,
          openPrice: toNum(r["Price"]) ?? null, // first Price column
          sl: toNum(r["SL"]),
          tp: toNum(r["TP"]),
          close: closeStr || null,
          closePrice:
            toNum(r["Price 1"]) ??
            toNum(r["Price (1)"]) ??
            toNum(r["Price_Close"]) ??
            null,
          swap: toNum(r["Swap"]),
          commissions:
            toNum(r["Commissions"]) ?? toNum(r["Commission"]) ?? null,
          profit: toNum(r["Profit"]) ?? 0,
          pips: toNum(r["Pips"]) ?? null,
          tradeDurationSeconds: tradeDurationSecondsValue as any,
        };
      });

      if (inserts.length) {
        const insertedTrades = await db
          .insert(trade)
          .values(inserts as any)
          .returning({ id: trade.id });

        // Generate feed events for closed trades (async, don't block)
        if (insertedTrades.length > 0) {
          Promise.all(
            insertedTrades.map((t) =>
              import("../lib/feed-event-generator").then((m) =>
                m
                  .generateFeedEventForTrade(t.id)
                  .catch((err) =>
                    console.error("Feed event generation failed:", err)
                  )
              )
            )
          ).catch((err) => console.error("Feed event batch failed:", err));
        }
      }

      await createNotification({
        userId,
        accountId,
        type: "trade_imported",
        title: "CSV import complete",
        body: `${inserts.length} trades imported into ${input.name}.`,
        metadata: {
          accountId,
          accountName: input.name,
          broker: input.broker,
          tradesImported: inserts.length,
        },
      });

      return { accountId };
    }),
});
