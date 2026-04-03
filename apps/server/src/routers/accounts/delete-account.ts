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
  // drizzle's neon-http driver does not support transactions, so account
  // teardown runs as an ordered sequence of deletes instead.
  await db.delete(notification).where(eq(notification.accountId, accountId));
  await db.delete(message).where(eq(message.accountId, accountId));
  await db.delete(aiReport).where(eq(aiReport.accountId, accountId));
  await db.delete(aiCreditUsage).where(eq(aiCreditUsage.accountId, accountId));
  await db.delete(eaCandleDataSet).where(eq(eaCandleDataSet.accountId, accountId));

  await db
    .update(propChallengeInstance)
    .set({ currentAccountId: null, updatedAt: new Date() })
    .where(eq(propChallengeInstance.currentAccountId, accountId));

  await db.delete(edgeMissedTrade).where(eq(edgeMissedTrade.accountId, accountId));
  await db
    .delete(propChallengeStageAccount)
    .where(eq(propChallengeStageAccount.accountId, accountId));
  await db.delete(propDailySnapshot).where(eq(propDailySnapshot.accountId, accountId));
  await db
    .delete(performanceAlertRule)
    .where(eq(performanceAlertRule.accountId, accountId));
  await db.delete(performanceAlert).where(eq(performanceAlert.accountId, accountId));
  await db.delete(propAlert).where(eq(propAlert.accountId, accountId));
  await db.delete(tradingRuleSet).where(eq(tradingRuleSet.accountId, accountId));

  await db.delete(syncLog).where(eq(syncLog.accountId, accountId));
  await db.delete(equitySnapshot).where(eq(equitySnapshot.accountId, accountId));
  await db
    .delete(brokerSyncCheckpoint)
    .where(eq(brokerSyncCheckpoint.accountId, accountId));
  await db.delete(brokerSymbolSpec).where(eq(brokerSymbolSpec.accountId, accountId));
  await db
    .delete(brokerAccountSnapshot)
    .where(eq(brokerAccountSnapshot.accountId, accountId));
  await db
    .delete(brokerPositionSnapshot)
    .where(eq(brokerPositionSnapshot.accountId, accountId));
  await db.delete(brokerLedgerEvent).where(eq(brokerLedgerEvent.accountId, accountId));
  await db.delete(brokerOrderEvent).where(eq(brokerOrderEvent.accountId, accountId));
  await db.delete(brokerDealEvent).where(eq(brokerDealEvent.accountId, accountId));
  await db.delete(brokerSession).where(eq(brokerSession.accountId, accountId));
  await db
    .delete(platformConnection)
    .where(eq(platformConnection.accountId, accountId));

  await db.delete(publicAccountShare).where(eq(publicAccountShare.accountId, accountId));
  await db.delete(tradeTrustEvent).where(eq(tradeTrustEvent.accountId, accountId));
  await db.delete(goal).where(eq(goal.accountId, accountId));
  await db.delete(historicalPrices).where(eq(historicalPrices.accountId, accountId));
  await db
    .delete(deletedImportedTrade)
    .where(eq(deletedImportedTrade.accountId, accountId));
  await db.delete(openTrade).where(eq(openTrade.accountId, accountId));
  await db.delete(trade).where(eq(trade.accountId, accountId));

  await db.delete(tradingAccount).where(eq(tradingAccount.id, accountId));

  await db.execute(sql`
    delete from prop_challenge_instance as pci
    where pci.current_account_id is null
      and not exists (
        select 1
        from prop_challenge_stage_account as pcsa
        where pcsa.challenge_instance_id = pci.id
      )
  `);
}
