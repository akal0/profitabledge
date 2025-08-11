import { z } from "zod";
import { router, protectedProcedure } from "../lib/trpc";
import { db } from "../db";
import { tradingAccount, trade } from "../db/schema/trading";
import { randomUUID } from "crypto";

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

export const uploadRouter = router({
  importCsv: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        broker: z.string().min(1),
        csvBase64: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const csvBuffer = Buffer.from(input.csvBase64, "base64");
      const rows = parseCsv(csvBuffer.toString("utf8"));

      const accountId = randomUUID();
      await db.insert(tradingAccount).values({
        id: accountId,
        userId,
        name: input.name,
        broker: input.broker,
      });

      const inserts = rows.map((r) => {
        const typeRaw = (r["Type"] || "").toLowerCase();
        const tradeType =
          typeRaw === "buy" ? "long" : typeRaw === "sell" ? "short" : null;
        return {
          id: randomUUID(),
          accountId,
          open: r["Open"] || null,
          tradeType: tradeType as any,
          volume: toNum(r["Volume"]),
          symbol: r["Symbol"] || null,
          openPrice: toNum(r["Price"]) ?? null, // first Price column
          sl: toNum(r["SL"]),
          tp: toNum(r["TP"]),
          close: r["Close"] || null,
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
          tradeDurationSeconds: (r["Trade duration in seconds"] || null) as any,
        };
      });

      if (inserts.length) {
        await db.insert(trade).values(inserts as any);
      }

      return { accountId };
    }),
});
