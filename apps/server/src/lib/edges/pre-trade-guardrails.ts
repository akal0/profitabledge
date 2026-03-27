import { eq, inArray, sql } from "drizzle-orm";

import { db } from "../../db";
import {
  edge,
  edgeMissedTrade,
  edgeVersion,
  trade,
  tradeEdgeAssignment,
  tradeEdgeRuleEvaluation,
  tradingAccount,
} from "../../db/schema/trading";
import {
  buildEdgeReadiness,
  calculateEdgeMetrics,
  collectTopLabels,
  coerceNumeric,
  type EdgeRuleEvaluationRow,
  type EdgeTradeMetricRow,
} from "./analytics";
import {
  getAccessibleEdgeById,
  getAssignableEdgesForUser,
  normalizeEdgeName,
} from "./service";

export type PreTradeEdgeGuardrailRules = {
  requireEdgeId?: boolean;
  requiredEdgeId?: string;
  minEdgeReadinessScore?: number;
  warnOutsideTopSessions?: boolean;
  warnOutsideTopSymbols?: boolean;
};

type ResolvedEdgeContext = {
  edge: typeof edge.$inferSelect;
  readiness: ReturnType<typeof buildEdgeReadiness>;
  topSessions: string[];
  topSymbols: string[];
};

async function getEdgeTradeRows(edgeId: string) {
  const rows = await db
    .select({
      id: trade.id,
      accountId: trade.accountId,
      broker: tradingAccount.broker,
      verificationLevel: tradingAccount.verificationLevel,
      isPropAccount: tradingAccount.isPropAccount,
      symbol: trade.symbol,
      tradeType: trade.tradeType,
      profit: sql<number | null>`CAST(${trade.profit} AS NUMERIC)`,
      outcome: trade.outcome,
      sessionTag: trade.sessionTag,
      openTime: trade.openTime,
      closeTime: trade.closeTime,
      realisedRR: sql<number | null>`CAST(${trade.realisedRR} AS NUMERIC)`,
    })
    .from(tradeEdgeAssignment)
    .innerJoin(trade, eq(trade.id, tradeEdgeAssignment.tradeId))
    .innerJoin(tradingAccount, eq(tradingAccount.id, trade.accountId))
    .where(eq(tradeEdgeAssignment.edgeId, edgeId));

  return rows.map(
    (row): EdgeTradeMetricRow => ({
      ...row,
      profit: coerceNumeric(row.profit),
      realisedRR: coerceNumeric(row.realisedRR),
    })
  );
}

async function getEdgeEvaluationRows(edgeId: string) {
  const rows = await db
    .select({
      ruleId: tradeEdgeRuleEvaluation.ruleId,
      status: tradeEdgeRuleEvaluation.status,
      tradeId: tradeEdgeRuleEvaluation.tradeId,
      profit: sql<number | null>`CAST(${trade.profit} AS NUMERIC)`,
      outcome: trade.outcome,
    })
    .from(tradeEdgeRuleEvaluation)
    .innerJoin(trade, eq(trade.id, tradeEdgeRuleEvaluation.tradeId))
    .where(eq(tradeEdgeRuleEvaluation.edgeId, edgeId));

  return rows.map(
    (row): EdgeRuleEvaluationRow => ({
      ...row,
      profit: coerceNumeric(row.profit),
    })
  );
}

async function getResolvedEdgeRow(args: {
  userId: string;
  edgeId?: string | null;
  modelTag?: string | null;
}) {
  if (args.edgeId) {
    return getAccessibleEdgeById(args.userId, args.edgeId);
  }

  const normalizedModelTag = normalizeEdgeName(args.modelTag ?? "");
  if (!normalizedModelTag) {
    return null;
  }

  const assignableEdges = await getAssignableEdgesForUser(args.userId);
  const matchedEdge = assignableEdges.find(
    (candidate) => normalizeEdgeName(candidate.name) === normalizedModelTag
  );

  return matchedEdge ? getAccessibleEdgeById(args.userId, matchedEdge.id) : null;
}

async function resolveEdgeContext(args: {
  userId: string;
  edgeId?: string | null;
  modelTag?: string | null;
}) {
  const edgeRow = await getResolvedEdgeRow(args);
  if (!edgeRow) {
    return null;
  }

  const [trades, evaluations, missedTrades, versionCountRows] = await Promise.all([
    getEdgeTradeRows(edgeRow.id),
    getEdgeEvaluationRows(edgeRow.id),
    db
      .select({
        estimatedPnl: sql<number | null>`CAST(${edgeMissedTrade.estimatedPnl} AS NUMERIC)`,
      })
      .from(edgeMissedTrade)
      .where(eq(edgeMissedTrade.edgeId, edgeRow.id))
      .then((rows) =>
        rows.map((row) => ({ estimatedPnl: coerceNumeric(row.estimatedPnl) }))
      ),
    db
      .select({
        count: sql<number>`COUNT(*)::int`,
      })
      .from(edgeVersion)
      .where(eq(edgeVersion.edgeId, edgeRow.id)),
  ]);

  const metrics = calculateEdgeMetrics({
    trades,
    evaluations,
    missedTrades,
    shareCount: 0,
    copyCount: 0,
  });
  const readiness = buildEdgeReadiness({
    edgeRow,
    metrics,
    trades,
    versionCount: versionCountRows[0]?.count ?? 0,
  });

  return {
    edge: edgeRow,
    readiness,
    topSessions: collectTopLabels(trades.map((tradeRow) => tradeRow.sessionTag), {
      limit: 3,
      excludeLabels: ["Unassigned"],
    }),
    topSymbols: collectTopLabels(trades.map((tradeRow) => tradeRow.symbol), {
      limit: 5,
    }),
  } satisfies ResolvedEdgeContext;
}

export async function evaluatePreTradeEdgeGuardrails(args: {
  userId: string;
  symbol: string;
  sessionTag?: string | null;
  edgeId?: string | null;
  modelTag?: string | null;
  rules: PreTradeEdgeGuardrailRules;
}) {
  const violations: Array<{ rule: string; message: string }> = [];
  const warnings: Array<{ rule: string; message: string }> = [];

  const rulesEnabled =
    args.rules.requireEdgeId ||
    Boolean(args.rules.requiredEdgeId) ||
    args.rules.minEdgeReadinessScore != null ||
    args.rules.warnOutsideTopSessions ||
    args.rules.warnOutsideTopSymbols;

  if (!rulesEnabled) {
    return { violations, warnings, edgeContext: null as ResolvedEdgeContext | null };
  }

  const edgeContext = await resolveEdgeContext({
    userId: args.userId,
    edgeId: args.edgeId,
    modelTag: args.modelTag,
  });

  if (args.rules.requireEdgeId && !edgeContext) {
    violations.push({
      rule: "requireEdgeId",
      message: "Select an Edge before taking this trade.",
    });
  }

  if (args.rules.requiredEdgeId) {
    if (!edgeContext) {
      violations.push({
        rule: "requiredEdgeId",
        message: "This rulebook requires a specific Edge, but no Edge was resolved for the trade.",
      });
    } else if (edgeContext.edge.id !== args.rules.requiredEdgeId) {
      violations.push({
        rule: "requiredEdgeId",
        message: `This rulebook is locked to ${edgeContext.edge.name}, but the current setup resolved to a different Edge.`,
      });
    }
  }

  if (args.rules.minEdgeReadinessScore != null) {
    if (!edgeContext) {
      violations.push({
        rule: "minEdgeReadinessScore",
        message: "Edge readiness cannot be checked until the trade is linked to an Edge.",
      });
    } else if (edgeContext.readiness.score < args.rules.minEdgeReadinessScore) {
      violations.push({
        rule: "minEdgeReadinessScore",
        message: `${edgeContext.edge.name} is only ${edgeContext.readiness.score}/100 readiness, below the required ${args.rules.minEdgeReadinessScore}.`,
      });
    }
  }

  if (
    args.rules.warnOutsideTopSessions &&
    edgeContext &&
    args.sessionTag?.trim() &&
    edgeContext.topSessions.length > 0 &&
    !edgeContext.topSessions.some(
      (session) => session.toLowerCase() === args.sessionTag!.trim().toLowerCase()
    )
  ) {
    warnings.push({
      rule: "warnOutsideTopSessions",
      message: `${edgeContext.edge.name} is most proven in ${edgeContext.topSessions.join(", ")}. ${args.sessionTag.trim()} sits outside that sample.`,
    });
  }

  if (
    args.rules.warnOutsideTopSymbols &&
    edgeContext &&
    edgeContext.topSymbols.length > 0 &&
    !edgeContext.topSymbols.some(
      (symbol) => symbol.toLowerCase() === args.symbol.trim().toLowerCase()
    )
  ) {
    warnings.push({
      rule: "warnOutsideTopSymbols",
      message: `${edgeContext.edge.name} is most proven on ${edgeContext.topSymbols.join(", ")}. ${args.symbol.trim()} is outside that sample.`,
    });
  }

  return { violations, warnings, edgeContext };
}
