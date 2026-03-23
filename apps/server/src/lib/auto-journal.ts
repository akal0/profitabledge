import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "../db";
import { journalEntry, type JournalBlock } from "../db/schema/journal";
import { trade, tradingAccount } from "../db/schema/trading";

function toNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calculateWordCount(blocks: JournalBlock[]): number {
  return blocks.reduce((count, block) => {
    const ownText = (block.content || "").replace(/<[^>]*>/g, " ").trim();
    const ownWords = ownText ? ownText.split(/\s+/).length : 0;
    const childWords = block.children ? calculateWordCount(block.children) : 0;
    return count + ownWords + childWords;
  }, 0);
}

function mapOutcome(profit: number): "win" | "loss" | "breakeven" {
  if (profit > 0) return "win";
  if (profit < 0) return "loss";
  return "breakeven";
}

export async function createAutoTradeReviewEntry(input: {
  userId: string;
  tradeId: string;
}) {
  const { userId, tradeId } = input;

  const [existing] = await db
    .select()
    .from(journalEntry)
    .where(
      and(
        eq(journalEntry.userId, userId),
        eq(journalEntry.entryType, "trade_review"),
        sql`${journalEntry.linkedTradeIds} @> ${JSON.stringify([tradeId])}::jsonb`
      )
    )
    .orderBy(desc(journalEntry.createdAt))
    .limit(1);

  if (existing) {
    return {
      entry: existing,
      created: false,
    } as const;
  }

  const tradeRow = await db
    .select({
      id: trade.id,
      accountId: trade.accountId,
      symbol: trade.symbol,
      tradeType: trade.tradeType,
      sessionTag: trade.sessionTag,
      modelTag: trade.modelTag,
      edgeId: sql<string | null>`(
        SELECT "trade_edge_assignment"."edge_id"
        FROM "trade_edge_assignment"
        WHERE "trade_edge_assignment"."trade_id" = "trade"."id"
        LIMIT 1
      )`,
      edgeName: sql<string | null>`(
        SELECT "edge"."name"
        FROM "trade_edge_assignment"
        INNER JOIN "edge" ON "edge"."id" = "trade_edge_assignment"."edge_id"
        WHERE "trade_edge_assignment"."trade_id" = "trade"."id"
        LIMIT 1
      )`,
      protocolAlignment: trade.protocolAlignment,
      profit: trade.profit,
      pips: trade.pips,
      realisedRR: trade.realisedRR,
      openTime: trade.openTime,
      closeTime: trade.closeTime,
      entryPrice: trade.openPrice,
      exitPrice: trade.closePrice,
      plannedRR: trade.plannedRR,
      entryBalance: trade.entryBalance,
      accountName: tradingAccount.name,
    })
    .from(trade)
    .innerJoin(tradingAccount, eq(trade.accountId, tradingAccount.id))
    .where(and(eq(trade.id, tradeId), eq(tradingAccount.userId, userId)))
    .limit(1);

  const closedTrade = tradeRow[0];

  if (!closedTrade) {
    return null;
  }

  const profit = toNumber(closedTrade.profit);
  const pips = toNumber(closedTrade.pips);
  const realisedRR = toNumber(closedTrade.realisedRR);
  const plannedRR = toNumber(closedTrade.plannedRR);
  const outcome = mapOutcome(profit);
  const closeDate = closedTrade.closeTime || closedTrade.openTime || new Date();
  const dateLabel = closeDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const blocks: JournalBlock[] = [
    {
      id: crypto.randomUUID(),
      type: "heading2",
      content: `${closedTrade.symbol || "Trade"} review`,
      children: [],
    },
    {
      id: crypto.randomUUID(),
      type: "paragraph",
      content: `${closedTrade.accountName} | ${dateLabel} | ${closedTrade.tradeType?.toUpperCase() || "TRADE"} | ${profit >= 0 ? "+" : ""}$${profit.toFixed(2)} | ${realisedRR >= 0 ? "+" : ""}${realisedRR.toFixed(2)}R`,
      children: [],
    },
    {
      id: crypto.randomUUID(),
      type: "trade",
      content: "",
      props: {
        tradeId: closedTrade.id,
        tradeDisplay: "detailed",
        symbol: closedTrade.symbol || undefined,
        tradeDirection:
          closedTrade.tradeType === "short" ? "short" : "long",
        profit,
        pips,
        closeTime: closedTrade.closeTime?.toISOString() || null,
        outcome,
      },
      children: [],
    },
    {
      id: crypto.randomUUID(),
      type: "heading3",
      content: "Execution readout",
      children: [],
    },
    {
      id: crypto.randomUUID(),
      type: "callout",
      content: `Plan context: ${closedTrade.sessionTag || "No session tag"} | ${closedTrade.modelTag || "No model tag"} | ${closedTrade.protocolAlignment || "No protocol tag"}`,
      props: {
        calloutEmoji: profit >= 0 ? "✅" : "⚠️",
        calloutType: profit >= 0 ? "success" : "warning",
      },
      children: [],
    },
    {
      id: crypto.randomUUID(),
      type: "paragraph",
      content: `Planned RR ${plannedRR ? `${plannedRR.toFixed(2)}R` : "n/a"} vs realised RR ${realisedRR.toFixed(2)}R. Entry ${closedTrade.entryPrice || "n/a"} -> exit ${closedTrade.exitPrice || "n/a"}.`,
      children: [],
    },
    {
      id: crypto.randomUUID(),
      type: "heading3",
      content: "Review prompts",
      children: [],
    },
    {
      id: crypto.randomUUID(),
      type: "checkList",
      content: "What did I execute well on this trade?",
      props: { checked: false },
      children: [],
    },
    {
      id: crypto.randomUUID(),
      type: "checkList",
      content: "What was the biggest execution mistake or hesitation?",
      props: { checked: false },
      children: [],
    },
    {
      id: crypto.randomUUID(),
      type: "checkList",
      content: "Was this trade inside my edge and fully aligned with my plan?",
      props: { checked: false },
      children: [],
    },
    {
      id: crypto.randomUUID(),
      type: "checkList",
      content: "What is the one correction I want on the next similar setup?",
      props: { checked: false },
      children: [],
    },
  ];

  const plainTextContent = blocks
    .map((block) => block.content)
    .filter(Boolean)
    .join(" ");
  const wordCount = calculateWordCount(blocks);

  const [entry] = await db
    .insert(journalEntry)
    .values({
      userId,
      title: `${profit >= 0 ? "Review +" : "Review "}$${profit.toFixed(2)} ${closedTrade.symbol || "trade"}`,
      emoji: profit >= 0 ? "🧠" : "📝",
      content: blocks as any,
      accountIds: [closedTrade.accountId],
      linkedTradeIds: [closedTrade.id],
      entryType: "trade_review",
      tags: [
        "auto-generated",
        "trade-review",
        "trade-close-auto",
        closedTrade.sessionTag || "untagged-session",
        closedTrade.edgeName || closedTrade.modelTag || "untagged-edge",
      ],
      linkedEdgeId: closedTrade.edgeId ?? null,
      plainTextContent,
      journalDate: closeDate,
      wordCount,
      readTimeMinutes: Math.max(1, Math.ceil(wordCount / 200)),
      tradePhase: "post-trade",
      actualOutcome: outcome,
      actualPnl: profit.toString(),
      actualPips: pips ? pips.toString() : null,
      plannedEntryPrice: closedTrade.entryPrice?.toString() || null,
      plannedExitPrice: closedTrade.exitPrice?.toString() || null,
      plannedRiskReward: plannedRR ? plannedRR.toString() : null,
    })
    .returning();

  return {
    entry,
    created: true,
  } as const;
}
