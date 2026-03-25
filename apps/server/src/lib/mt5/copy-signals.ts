import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { db } from "../../db";
import { copyGroup, copySignal, copySlave } from "../../db/schema/copier";
import { platformConnection } from "../../db/schema/connections";
import { isMtTerminalProvider } from "./constants";

export interface Mt5CopySignalPayload {
  id: string;
  signalType: string;
  symbol: string;
  tradeType: string;
  masterTicket: string;
  slaveTicket: string | null;
  volume: number | null;
  openPrice: number | null;
  sl: number | null;
  tp: number | null;
  newSl: number | null;
  newTp: number | null;
  closePrice: number | null;
  maxSlippagePips: number | null;
  createdAt: string | null;
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export async function listPendingMt5CopySignals(connectionId: string) {
  const connection = await db.query.platformConnection.findFirst({
    where: eq(platformConnection.id, connectionId),
    columns: {
      id: true,
      provider: true,
      accountId: true,
    },
  });

  if (!connection || !isMtTerminalProvider(connection.provider)) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "MT terminal connection not found",
    });
  }

  if (!connection.accountId) {
    return [] as Mt5CopySignalPayload[];
  }

  const rows = await db
    .select({
      id: copySignal.id,
      signalType: copySignal.signalType,
      symbol: copySignal.symbol,
      tradeType: copySignal.tradeType,
      masterTicket: copySignal.masterTicket,
      slaveTicket: copySignal.slaveTicket,
      slaveVolume: copySignal.slaveVolume,
      masterVolume: copySignal.masterVolume,
      openPrice: copySignal.openPrice,
      sl: copySignal.sl,
      tp: copySignal.tp,
      newSl: copySignal.newSl,
      newTp: copySignal.newTp,
      closePrice: copySignal.closePrice,
      maxSlippagePips: copySlave.maxSlippagePips,
      createdAt: copySignal.createdAt,
    })
    .from(copySignal)
    .innerJoin(copySlave, eq(copySlave.id, copySignal.copySlaveId))
    .innerJoin(copyGroup, eq(copyGroup.id, copySlave.copyGroupId))
    .where(
      and(
        eq(copySlave.slaveAccountId, connection.accountId),
        eq(copySlave.isActive, true),
        eq(copyGroup.isActive, true),
        inArray(copySignal.status, ["pending"])
      )
    )
    .orderBy(asc(copySignal.createdAt))
    .limit(100);

  return rows.map((row) => ({
    id: row.id,
    signalType: row.signalType,
    symbol: row.symbol,
    tradeType: row.tradeType,
    masterTicket: row.masterTicket,
    slaveTicket: row.slaveTicket,
    volume: toNumber(row.slaveVolume) ?? toNumber(row.masterVolume),
    openPrice: toNumber(row.openPrice),
    sl: toNumber(row.sl),
    tp: toNumber(row.tp),
    newSl: toNumber(row.newSl),
    newTp: toNumber(row.newTp),
    closePrice: toNumber(row.closePrice),
    maxSlippagePips: toNumber(row.maxSlippagePips),
    createdAt: row.createdAt?.toISOString() ?? null,
  }));
}

export async function ackMt5CopySignal(input: {
  signalId: string;
  success: boolean;
  slaveTicket?: string | null;
  executedPrice?: number | null;
  slippagePips?: number | null;
  profit?: number | null;
  errorMessage?: string | null;
}) {
  const existing = await db
    .select({
      id: copySignal.id,
      copySlaveId: copySignal.copySlaveId,
      status: copySignal.status,
      signalType: copySignal.signalType,
    })
    .from(copySignal)
    .where(eq(copySignal.id, input.signalId))
    .limit(1);

  const row = existing[0];
  if (!row) {
    return {
      success: true,
      acknowledged: false,
    };
  }

  if (row.status === "executed" || row.status === "failed") {
    return {
      success: true,
      acknowledged: true,
    };
  }

  const executedAt = new Date();
  const executedPrice =
    typeof input.executedPrice === "number" && Number.isFinite(input.executedPrice)
      ? input.executedPrice.toString()
      : null;
  const slippagePips =
    typeof input.slippagePips === "number" && Number.isFinite(input.slippagePips)
      ? input.slippagePips.toString()
      : null;
  const profit =
    typeof input.profit === "number" && Number.isFinite(input.profit)
      ? input.profit
      : null;

  await db
    .update(copySignal)
    .set({
      status: input.success ? "executed" : "failed",
      slaveTicket: input.slaveTicket ?? null,
      executedAt,
      executedPrice,
      slippagePips,
      profit: profit !== null ? profit.toString() : null,
      errorMessage: input.success ? null : input.errorMessage ?? null,
    })
    .where(eq(copySignal.id, input.signalId));

  if (input.success) {
    const slaveUpdates: Record<string, unknown> = {
      lastCopyAt: executedAt,
      updatedAt: executedAt,
    };

    if (row.signalType === "open") {
      slaveUpdates.totalCopiedTrades =
        sql`COALESCE(${copySlave.totalCopiedTrades}, 0) + 1`;
    }

    if (profit !== null) {
      slaveUpdates.totalProfit = sql`COALESCE(${copySlave.totalProfit}, 0) + ${profit.toString()}::numeric`;
    }

    await db
      .update(copySlave)
      .set(slaveUpdates)
      .where(eq(copySlave.id, row.copySlaveId));
  }

  return {
    success: true,
    acknowledged: true,
  };
}
