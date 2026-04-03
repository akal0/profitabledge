import { eq, sql } from "drizzle-orm";

import { db } from "../../db";
import { aiReport } from "../../db/schema/ai";
import { message } from "../../db/schema/assistant";
import { aiCreditUsage } from "../../db/schema/billing";
import { eaCandleDataSet } from "../../db/schema/backtest";
import {
  platformConnection,
  equitySnapshot,
  syncLog,
} from "../../db/schema/connections";
import {
  brokerSession,
  brokerDealEvent,
  brokerOrderEvent,
  brokerLedgerEvent,
  brokerPositionSnapshot,
  brokerAccountSnapshot,
  brokerSymbolSpec,
  brokerSyncCheckpoint,
} from "../../db/schema/mt5-sync";
import { notification } from "../../db/schema/notifications";
import {
  deletedImportedTrade,
  edgeMissedTrade,
  goal,
  historicalPrices,
  openTrade,
  performanceAlert,
  performanceAlertRule,
  propAlert,
  propChallengeInstance,
  propChallengeStageAccount,
  propDailySnapshot,
  publicAccountShare,
  trade,
  tradeTrustEvent,
  tradingAccount,
  tradingRuleSet,
} from "../../db/schema/trading";

export async function deleteAccountAndRelatedData(accountId: string) {
  await db.transaction(async (tx) => {
    await tx.delete(notification).where(eq(notification.accountId, accountId));
    await tx.delete(message).where(eq(message.accountId, accountId));
    await tx.delete(aiReport).where(eq(aiReport.accountId, accountId));
    await tx.delete(aiCreditUsage).where(eq(aiCreditUsage.accountId, accountId));
    await tx.delete(eaCandleDataSet).where(eq(eaCandleDataSet.accountId, accountId));

    await tx
      .update(propChallengeInstance)
      .set({ currentAccountId: null, updatedAt: new Date() })
      .where(eq(propChallengeInstance.currentAccountId, accountId));

    await tx.delete(edgeMissedTrade).where(eq(edgeMissedTrade.accountId, accountId));
    await tx
      .delete(propChallengeStageAccount)
      .where(eq(propChallengeStageAccount.accountId, accountId));
    await tx.delete(propDailySnapshot).where(eq(propDailySnapshot.accountId, accountId));
    await tx
      .delete(performanceAlertRule)
      .where(eq(performanceAlertRule.accountId, accountId));
    await tx.delete(performanceAlert).where(eq(performanceAlert.accountId, accountId));
    await tx.delete(propAlert).where(eq(propAlert.accountId, accountId));
    await tx.delete(tradingRuleSet).where(eq(tradingRuleSet.accountId, accountId));

    await tx.delete(syncLog).where(eq(syncLog.accountId, accountId));
    await tx.delete(equitySnapshot).where(eq(equitySnapshot.accountId, accountId));
    await tx
      .delete(brokerSyncCheckpoint)
      .where(eq(brokerSyncCheckpoint.accountId, accountId));
    await tx.delete(brokerSymbolSpec).where(eq(brokerSymbolSpec.accountId, accountId));
    await tx
      .delete(brokerAccountSnapshot)
      .where(eq(brokerAccountSnapshot.accountId, accountId));
    await tx
      .delete(brokerPositionSnapshot)
      .where(eq(brokerPositionSnapshot.accountId, accountId));
    await tx.delete(brokerLedgerEvent).where(eq(brokerLedgerEvent.accountId, accountId));
    await tx.delete(brokerOrderEvent).where(eq(brokerOrderEvent.accountId, accountId));
    await tx.delete(brokerDealEvent).where(eq(brokerDealEvent.accountId, accountId));
    await tx.delete(brokerSession).where(eq(brokerSession.accountId, accountId));
    await tx
      .delete(platformConnection)
      .where(eq(platformConnection.accountId, accountId));

    await tx.delete(publicAccountShare).where(eq(publicAccountShare.accountId, accountId));
    await tx.delete(tradeTrustEvent).where(eq(tradeTrustEvent.accountId, accountId));
    await tx.delete(goal).where(eq(goal.accountId, accountId));
    await tx.delete(historicalPrices).where(eq(historicalPrices.accountId, accountId));
    await tx
      .delete(deletedImportedTrade)
      .where(eq(deletedImportedTrade.accountId, accountId));
    await tx.delete(openTrade).where(eq(openTrade.accountId, accountId));
    await tx.delete(trade).where(eq(trade.accountId, accountId));

    await tx.delete(tradingAccount).where(eq(tradingAccount.id, accountId));

    await tx.execute(sql`
      delete from prop_challenge_instance as pci
      where pci.current_account_id is null
        and not exists (
          select 1
          from prop_challenge_stage_account as pcsa
          where pcsa.challenge_instance_id = pci.id
        )
    `);
  });
}
