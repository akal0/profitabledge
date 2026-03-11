import { db } from "../db";
import { feedEvent, trade, tradingAccount } from "../db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

/**
 * Feed Event Generator
 *
 * Automatically generates structured feed events from closed trades
 * for verified accounts that have opted into social features.
 *
 * Philosophy: Show truth, not theater
 * - Highlight missed opportunities
 * - Show discipline breaks
 * - Celebrate consistency, not just wins
 */

export type FeedEventType =
  | "trade_closed"
  | "execution_insight"
  | "discipline_break"
  | "streak_milestone"
  | "high_water_mark"
  | "session_summary"
  | "metric_shift";

interface TradeData {
  id: string;
  accountId: string;
  symbol: string | null;
  tradeType: string | null;
  realisedRR: string | null;
  rrCaptureEfficiency: string | null;
  exitEfficiency: string | null;
  protocolAlignment: string | null;
  sessionTag: string | null;
  tradeDurationSeconds: string | null;
  maxRR: string | null;
  outcome: string | null;
  brokerMeta: Record<string, unknown> | null;
}

type FeedEventInsert = typeof feedEvent.$inferInsert;

function getBrokerMeta(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

/**
 * Generate feed event for a closed trade
 */
export async function generateFeedEventForTrade(tradeId: string): Promise<void> {
  // Get trade data
  const tradeData = await db
    .select({
      id: trade.id,
      accountId: trade.accountId,
      symbol: trade.symbol,
      tradeType: trade.tradeType,
      realisedRR: trade.realisedRR,
      rrCaptureEfficiency: trade.rrCaptureEfficiency,
      exitEfficiency: trade.exitEfficiency,
      protocolAlignment: trade.protocolAlignment,
      sessionTag: trade.sessionTag,
      tradeDurationSeconds: trade.tradeDurationSeconds,
      maxRR: trade.maxRR,
      outcome: trade.outcome,
      brokerMeta: trade.brokerMeta,
    })
    .from(trade)
    .where(eq(trade.id, tradeId))
    .limit(1);

  if (!tradeData[0]) {
    console.error(`Trade ${tradeId} not found for feed event generation`);
    return;
  }

  const t = tradeData[0];

  // Check if account has social opt-in
  const account = await db
    .select({
      socialOptIn: tradingAccount.socialOptIn,
      verificationLevel: tradingAccount.verificationLevel,
    })
    .from(tradingAccount)
    .where(eq(tradingAccount.id, t.accountId))
    .limit(1);

  if (!account[0] || !account[0].socialOptIn || account[0].verificationLevel === "unverified") {
    // Account not opted into social or not verified
    return;
  }

  // Determine event types to generate
  const brokerMeta = getBrokerMeta(t.brokerMeta);
  const events: Array<{
    type: FeedEventType;
    data: Record<string, unknown>;
    caption?: string;
  }> = [];

  // 1. Always generate trade_closed event
  events.push({
    type: "trade_closed",
    data: {
      symbol: t.symbol ?? undefined,
      tradeType: t.tradeType ?? undefined,
      realizedRR: Number(t.realisedRR || 0),
      rrCaptureEfficiency: Number(t.rrCaptureEfficiency || 0),
      exitEfficiency: Number(t.exitEfficiency || 0),
      protocolAligned: t.protocolAlignment === "aligned",
      sessionTag: t.sessionTag ?? undefined,
      holdTimeSeconds: t.tradeDurationSeconds
        ? parseInt(t.tradeDurationSeconds)
        : undefined,
      outcome: t.outcome ?? undefined,
      closeReason:
        typeof brokerMeta?.closeReason === "string"
          ? brokerMeta.closeReason
          : undefined,
      executionMode:
        typeof brokerMeta?.executionMode === "string"
          ? brokerMeta.executionMode
          : undefined,
    },
  });

  // 2. execution_insight - Missed RR opportunity (THE GOLD)
  if (t.maxRR && t.realisedRR) {
    const maxRRNum = Number(t.maxRR);
    const realizedRRNum = Number(t.realisedRR);
    const availableRR = maxRRNum - realizedRRNum;

    // If missed >1R, generate insight
    if (availableRR > 1.0) {
      const missedPercent = Math.round((availableRR / maxRRNum) * 100);
      events.push({
        type: "execution_insight",
        data: {
          symbol: t.symbol ?? undefined,
          tradeType: t.tradeType ?? undefined,
          realizedRR: realizedRRNum,
          availableRR: maxRRNum,
          missedRR: availableRR,
          missedPercent,
        },
        caption: missedPercent > 50 ? "Exited too early" : undefined,
      });
    }
  }

  // 3. discipline_break - Protocol violation
  if (t.protocolAlignment === "against") {
    events.push({
      type: "discipline_break",
      data: {
        symbol: t.symbol ?? undefined,
        tradeType: t.tradeType ?? undefined,
        realizedRR: Number(t.realisedRR || 0),
        issue: "Protocol violation",
        sessionTag: t.sessionTag ?? undefined,
      },
    });
  }

  // 4. Check for streaks (requires querying recent trades)
  const streakInfo = await checkForStreak(t.accountId, t.outcome);
  if (streakInfo) {
    events.push({
      type: "streak_milestone",
      data: {
        streakCount: streakInfo.count,
        streakType: streakInfo.type,
      },
    });
  }

  const existingEventTypes = new Set(
    (
      await db
        .select({ eventType: feedEvent.eventType })
        .from(feedEvent)
        .where(
          and(eq(feedEvent.accountId, t.accountId), eq(feedEvent.tradeId, t.id))
        )
    ).map((event) => event.eventType)
  );

  const newEvents = events.filter((event) => !existingEventTypes.has(event.type));

  if (newEvents.length === 0) {
    return;
  }

  // Insert events
  for (const event of newEvents) {
    await db.insert(feedEvent).values([{
      id: nanoid(),
      accountId: t.accountId,
      eventType: event.type,
      tradeId: t.id,
      eventData: event.data as FeedEventInsert["eventData"],
      caption: event.caption,
      isVisible: true,
    }]);
  }

  // Update feed event count
  await db
    .update(tradingAccount)
    .set({
      feedEventCount: sql`${tradingAccount.feedEventCount} + ${newEvents.length}`,
    })
    .where(eq(tradingAccount.id, t.accountId));
}

/**
 * Check for win/loss streaks
 */
async function checkForStreak(
  accountId: string,
  outcome: string | null
): Promise<{ count: number; type: "win" | "loss" } | null> {
  if (!outcome || (outcome !== "Win" && outcome !== "Loss")) {
    return null;
  }

  // Get last 20 trades
  const recentTrades = await db
    .select({ outcome: trade.outcome })
    .from(trade)
    .where(and(eq(trade.accountId, accountId), sql`${trade.closeTime} IS NOT NULL`))
    .orderBy(desc(trade.closeTime))
    .limit(20);

  let streakCount = 0;
  const streakType = outcome === "Win" ? "win" : "loss";

  // Count consecutive outcomes
  for (const t of recentTrades) {
    if (t.outcome === outcome) {
      streakCount++;
    } else {
      break;
    }
  }

  // Only create milestone for 5+ streaks
  if (streakCount >= 5) {
    return { count: streakCount, type: streakType };
  }

  return null;
}

/**
 * Generate session summary event
 * Called at the end of a trading session
 */
export async function generateSessionSummary(
  accountId: string,
  sessionTag: string,
  sessionEnd: Date
): Promise<void> {
  // Get trades from this session
  const sessionTrades = await db
    .select({
      realisedRR: trade.realisedRR,
      outcome: trade.outcome,
      rrCaptureEfficiency: trade.rrCaptureEfficiency,
    })
    .from(trade)
    .where(
      and(
        eq(trade.accountId, accountId),
        eq(trade.sessionTag, sessionTag),
        sql`DATE(${trade.closeTime}) = DATE(${sessionEnd})`
      )
    );

  if (sessionTrades.length < 3) {
    // Don't generate summary for <3 trades
    return;
  }

  const totalRR = sessionTrades.reduce((sum, t) => sum + Number(t.realisedRR || 0), 0);
  const winCount = sessionTrades.filter((t) => t.outcome === "Win").length;
  const avgCapture =
    sessionTrades.reduce((sum, t) => sum + Number(t.rrCaptureEfficiency || 0), 0) /
    sessionTrades.length;

  await db.insert(feedEvent).values([{
    id: nanoid(),
    accountId,
    eventType: "session_summary",
    tradeId: null,
    eventData: {
      sessionTag,
      tradeCount: sessionTrades.length,
      totalRR: Number(totalRR.toFixed(2)),
      winCount,
      avgCaptureEfficiency: Number((avgCapture * 100).toFixed(1)),
    } as FeedEventInsert["eventData"],
    isVisible: true,
  }]);
}

/**
 * Check for high water mark (new account high)
 */
export async function checkForHighWaterMark(
  accountId: string,
  currentBalance: number
): Promise<void> {
  // This would require tracking account equity over time
  // For now, placeholder
  // TODO: Implement high water mark tracking
}
