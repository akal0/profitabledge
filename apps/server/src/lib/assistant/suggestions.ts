import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";

import { db } from "../../db";
import { journalEntry } from "../../db/schema/journal";
import { trade, tradingAccount } from "../../db/schema/trading";
import {
  buildAccountScopeCondition,
  isAllAccountsScope,
  resolveScopedAccountIds,
} from "../account-scope";

const MAX_SUGGESTIONS = 9;

const FALLBACK_SUGGESTIONS = [
  "How am I doing overall?",
  "What is my edge?",
  "Which day of the week is my best?",
  "What's my best and worst pair?",
  "Which edge works best for me?",
  "Which mistakes or habits are hurting performance the most?",
  "What is actually driving my profitability?",
  "Which conditions improve or weaken my edge?",
  "What patterns separate my best trades from my worst trades?",
];

function mergeSuggestions(...lists: string[][]) {
  return Array.from(new Set(lists.flat().filter(Boolean))).slice(
    0,
    MAX_SUGGESTIONS
  );
}

export async function getSuggestedQuestionsForAccount(args: {
  userId: string;
  accountId: string;
}) {
  const { userId, accountId } = args;
  const scopedAccountIds = await resolveScopedAccountIds(userId, accountId);

  if (scopedAccountIds.length === 0) {
    return FALLBACK_SUGGESTIONS.slice(0, MAX_SUGGESTIONS);
  }

  const tradeScope = buildAccountScopeCondition(trade.accountId, scopedAccountIds);
  const accountScope = isAllAccountsScope(accountId)
    ? inArray(tradingAccount.id, scopedAccountIds)
    : eq(tradingAccount.id, scopedAccountIds[0]!);

  const [tradeCountRows, topSymbolRows, recentTradeRows, accountRows, symbolRows, sessionRows, modelRows, journalRows, psychologyRows] =
    await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(trade)
        .where(tradeScope),
      db
        .select({
          symbol: trade.symbol,
          tradeCount: sql<number>`count(*)`,
        })
        .from(trade)
        .where(and(tradeScope, isNotNull(trade.symbol)))
        .groupBy(trade.symbol)
        .orderBy(sql`count(*) DESC`, sql`${trade.symbol} ASC`)
        .limit(1),
      db
        .select({
          outcome: trade.outcome,
          profit: sql<number>`COALESCE(CAST(${trade.profit} AS numeric), 0)`,
        })
        .from(trade)
        .where(tradeScope)
        .orderBy(desc(trade.closeTime), desc(trade.createdAt))
        .limit(5),
      db
        .select({
          isVerified: tradingAccount.isVerified,
          isPropAccount: tradingAccount.isPropAccount,
        })
        .from(tradingAccount)
        .where(and(eq(tradingAccount.userId, userId), accountScope)),
      db
        .selectDistinct({ symbol: trade.symbol })
        .from(trade)
        .where(and(tradeScope, isNotNull(trade.symbol))),
      db
        .selectDistinct({ sessionTag: trade.sessionTag })
        .from(trade)
        .where(and(tradeScope, isNotNull(trade.sessionTag))),
      db
        .selectDistinct({ modelTag: trade.modelTag })
        .from(trade)
        .where(and(tradeScope, isNotNull(trade.modelTag))),
      db
        .select({ count: sql<number>`count(*)` })
        .from(journalEntry)
        .where(eq(journalEntry.userId, userId)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(journalEntry)
        .where(
          and(
            eq(journalEntry.userId, userId),
            sql`${journalEntry.psychology} IS NOT NULL`
          )
        ),
    ]);

  const tradeCount = Number(tradeCountRows[0]?.count ?? 0);
  const topSymbol = topSymbolRows[0]?.symbol ?? null;
  const uniqueSymbols = symbolRows.filter((t: any) => Boolean(t.symbol)).length;
  const hasSessionTags = sessionRows.some((row: any) => Boolean(row.sessionTag));
  const hasModelTags = modelRows.some((row: any) => Boolean(row.modelTag));
  const hasJournal = Number(journalRows[0]?.count ?? 0) > 0;
  const hasJournalWithPsychology = Number(psychologyRows[0]?.count ?? 0) > 0;
  const isVerified = accountRows.some((row: any) => Number(row.isVerified ?? 0) === 1);
  const isPropAccount = accountRows.some((row: any) => Boolean(row.isPropAccount));

  const recentOutcomes = recentTradeRows.map((row: any) => {
    if (row.outcome === "Loss") return "L";
    if (row.outcome === "BE") return "B";
    if (row.outcome === "PW" || row.outcome === "Win") return "W";
    return Number(row.profit ?? 0) >= 0 ? "W" : "L";
  });

  const suggestions: string[] = ["How am I doing overall?"];

  if (tradeCount > 0 && topSymbol) {
    suggestions.push(`How's my ${topSymbol} performance?`);
    suggestions.push("Which day of the week is my best?");
  }

  if (uniqueSymbols > 3) {
    suggestions.push("What's my best and worst pair?");
  }

  if (recentOutcomes.filter((value) => value === "L").length >= 3) {
    suggestions.push("What's going wrong with my recent trades?");
  }

  if (isVerified) {
    suggestions.push("Am I exiting trades too early?");
    suggestions.push("How's my execution quality?");
  }

  if (hasJournal && hasJournalWithPsychology) {
    suggestions.push("Does my mood affect my trading?");
  }

  if (isPropAccount) {
    suggestions.push("How's my challenge going?");
  }

  if (hasModelTags) {
    suggestions.push("Which edge works best for me?");
  }

  if (hasSessionTags) {
    suggestions.push("Which session should I focus on?");
  }

  if (tradeCount >= 10) {
    suggestions.push("What should I focus on next?");
  }

  if (tradeCount >= 15) {
    suggestions.push("Which mistakes or habits are hurting performance the most?");
  }

  if (tradeCount >= 20) {
    suggestions.push("What is actually driving my profitability?");
    suggestions.push("What patterns separate my best trades from my worst trades?");
  }

  if (tradeCount >= 30) {
    suggestions.push("Which conditions improve or weaken my edge?");
    suggestions.push("Which trade attributes correlate most with strong expectancy?");
  }

  return mergeSuggestions(suggestions, FALLBACK_SUGGESTIONS);
}
