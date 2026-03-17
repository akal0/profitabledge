import { db } from "../../db";
import { tradeTrustEvent } from "../../db/schema/trading";
import {
  buildTradeTrustSnapshot,
  getChangedTradeTrustFields,
  type TradeOriginType,
  type TradeTrustFieldKey,
} from "./trust";

type TrustAuditDb = typeof db;

type TrustAuditRow = Partial<Record<TradeTrustFieldKey, unknown>> & {
  id: string;
  accountId: string;
  originType?: string | null;
  brokerMeta?: Record<string, unknown> | null;
  ticket?: string | null;
  useBrokerData?: string | number | null;
};

export async function recordTradeUpdateTrustEvent(input: {
  tx?: TrustAuditDb;
  userId: string;
  before: TrustAuditRow;
  after: TrustAuditRow;
  originType: TradeOriginType;
}) {
  const beforeData = buildTradeTrustSnapshot(input.before);
  const afterData = buildTradeTrustSnapshot(input.after);
  const changedFields = getChangedTradeTrustFields(beforeData, afterData);

  if (changedFields.length === 0) {
    return false;
  }

  await (input.tx ?? db).insert(tradeTrustEvent).values({
    accountId: input.before.accountId,
    userId: input.userId,
    tradeId: input.before.id,
    eventType: "update",
    changeSource: "app",
    originType: input.originType,
    changedFields,
    beforeData,
    afterData,
  });

  return true;
}

export async function recordTradeDeleteTrustEvents(input: {
  tx?: TrustAuditDb;
  userId: string;
  trades: TrustAuditRow[];
  resolveOriginType: (tradeRow: TrustAuditRow) => TradeOriginType;
}) {
  if (input.trades.length === 0) {
    return;
  }

  await (input.tx ?? db).insert(tradeTrustEvent).values(
    input.trades.map((tradeRow) => ({
      accountId: tradeRow.accountId,
      userId: input.userId,
      tradeId: tradeRow.id,
      eventType: "delete",
      changeSource: "app",
      originType: input.resolveOriginType(tradeRow),
      changedFields: [],
      beforeData: buildTradeTrustSnapshot(tradeRow),
      afterData: null,
    }))
  );
}
