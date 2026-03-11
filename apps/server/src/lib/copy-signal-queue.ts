import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { copySignal, copySlave } from "../db/schema/copier";

function toNumberOrNull(value: string | number | null | undefined) {
  if (value == null) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export interface ClaimedCopySignal {
  id: string;
  copySlaveId: string;
  signalType: string;
  masterTicket: string;
  symbol: string;
  tradeType: string;
  volume: number | null;
  openPrice: number | null;
  sl: number | null;
  tp: number | null;
  newSl: number | null;
  newTp: number | null;
  closePrice: number | null;
  maxSlippagePips: number | null;
}

export async function claimPendingCopySignalsForAccount(
  accountId: string,
  limit = 50
): Promise<ClaimedCopySignal[]> {
  const signals = await db
    .select({
      id: copySignal.id,
      copySlaveId: copySignal.copySlaveId,
      signalType: copySignal.signalType,
      masterTicket: copySignal.masterTicket,
      symbol: copySignal.symbol,
      tradeType: copySignal.tradeType,
      volume: copySignal.slaveVolume,
      openPrice: copySignal.openPrice,
      sl: copySignal.sl,
      tp: copySignal.tp,
      newSl: copySignal.newSl,
      newTp: copySignal.newTp,
      closePrice: copySignal.closePrice,
      maxSlippagePips: copySlave.maxSlippagePips,
    })
    .from(copySignal)
    .innerJoin(copySlave, eq(copySignal.copySlaveId, copySlave.id))
    .where(
      and(
        eq(copySlave.slaveAccountId, accountId),
        eq(copySlave.isActive, true),
        eq(copySignal.status, "pending")
      )
    )
    .orderBy(copySignal.createdAt)
    .limit(limit);

  if (signals.length > 0) {
    await db
      .update(copySignal)
      .set({ status: "sent" })
      .where(
        inArray(
          copySignal.id,
          signals.map((signal) => signal.id)
        )
      );
  }

  return signals.map((signal) => ({
    id: signal.id,
    copySlaveId: signal.copySlaveId,
    signalType: signal.signalType,
    masterTicket: signal.masterTicket,
    symbol: signal.symbol,
    tradeType: signal.tradeType,
    volume: toNumberOrNull(signal.volume),
    openPrice: toNumberOrNull(signal.openPrice),
    sl: toNumberOrNull(signal.sl),
    tp: toNumberOrNull(signal.tp),
    newSl: toNumberOrNull(signal.newSl),
    newTp: toNumberOrNull(signal.newTp),
    closePrice: toNumberOrNull(signal.closePrice),
    maxSlippagePips: toNumberOrNull(signal.maxSlippagePips),
  }));
}

export interface AckCopySignalExecutionInput {
  signalId: string;
  success: boolean;
  slaveTicket?: string | null;
  executedPrice?: number | null;
  slippagePips?: number | null;
  profit?: number | null;
  errorMessage?: string | null;
}

export async function ackCopySignalExecution(
  input: AckCopySignalExecutionInput
) {
  const updates: Record<string, string | Date> = {
    status: input.success ? "executed" : "failed",
    executedAt: new Date(),
  };

  if (input.slaveTicket != null) {
    updates.slaveTicket = input.slaveTicket;
  }
  if (input.executedPrice != null) {
    updates.executedPrice = input.executedPrice.toString();
  }
  if (input.slippagePips != null) {
    updates.slippagePips = input.slippagePips.toString();
  }
  if (input.profit != null) {
    updates.profit = input.profit.toString();
  }
  if (input.errorMessage != null) {
    updates.errorMessage = input.errorMessage;
  }

  await db
    .update(copySignal)
    .set(updates)
    .where(eq(copySignal.id, input.signalId));

  if (!input.success) {
    return { success: true };
  }

  const signals = await db
    .select({
      copySlaveId: copySignal.copySlaveId,
      signalType: copySignal.signalType,
    })
    .from(copySignal)
    .where(eq(copySignal.id, input.signalId))
    .limit(1);

  if (!signals.length) {
    return { success: true };
  }

  const sig = signals[0];

  if (sig.signalType === "open") {
    await db
      .update(copySlave)
      .set({
        totalCopiedTrades: sql`${copySlave.totalCopiedTrades} + 1`,
        lastCopyAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(copySlave.id, sig.copySlaveId));
  }

  if (sig.signalType === "close" && input.profit != null) {
    await db
      .update(copySlave)
      .set({
        totalProfit: sql`${copySlave.totalProfit} + ${input.profit}`,
        updatedAt: new Date(),
      })
      .where(eq(copySlave.id, sig.copySlaveId));
  }

  return { success: true };
}
