import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "../../db";
import { copyGroup, copySlave } from "../../db/schema/copier";
import { tradingAccount } from "../../db/schema/trading";

export const lotModeSchema = z.enum([
  "fixed",
  "multiplier",
  "balance_ratio",
  "risk_percent",
]);

export const slTpModeSchema = z.enum(["copy", "fixed_pips", "adjusted"]);

export const slaveConfigSchema = z.object({
  lotMode: lotModeSchema.default("multiplier"),
  fixedLot: z.number().min(0.01).max(100).default(0.01),
  lotMultiplier: z.number().min(0.01).max(100).default(1.0),
  riskPercent: z.number().min(0.1).max(100).default(1.0),
  maxLotSize: z.number().min(0.01).max(100).default(10.0),
  maxDailyLoss: z.number().min(0).optional(),
  maxTradesPerDay: z.number().int().min(1).optional(),
  maxDrawdownPercent: z.number().min(0).max(100).optional(),
  slMode: slTpModeSchema.default("copy"),
  slFixedPips: z.number().min(0).optional(),
  slMultiplier: z.number().min(0.1).max(10).default(1.0),
  tpMode: slTpModeSchema.default("copy"),
  tpFixedPips: z.number().min(0).optional(),
  tpMultiplier: z.number().min(0.1).max(10).default(1.0),
  symbolWhitelist: z.array(z.string()).optional(),
  symbolBlacklist: z.array(z.string()).optional(),
  sessionFilter: z.array(z.string()).optional(),
  minLotSize: z.number().min(0.01).max(1).default(0.01),
  maxSlippagePips: z.number().min(0).max(50).default(3.0),
  copyPendingOrders: z.boolean().default(false),
  copySlTpModifications: z.boolean().default(true),
  reverseTrades: z.boolean().default(false),
});

export const COPIER_ACTIVITY_WINDOW_DAYS = 30;
export const COPIER_CONNECTION_FRESHNESS_MS = 15 * 60 * 1000;

export function parseNumeric(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isAccountConnected(
  isVerified: boolean | number | null | undefined,
  lastSyncedAt: Date | null,
  freshnessCutoff: Date
): boolean {
  const verified = typeof isVerified === "boolean" ? isVerified : isVerified === 1;
  return verified && !!lastSyncedAt && lastSyncedAt >= freshnessCutoff;
}

export async function requireOwnedCopyGroup(userId: string, groupId: string) {
  const groups = await db
    .select({ id: copyGroup.id, masterAccountId: copyGroup.masterAccountId })
    .from(copyGroup)
    .where(and(eq(copyGroup.id, groupId), eq(copyGroup.userId, userId)))
    .limit(1);

  if (!groups.length) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Copy group not found",
    });
  }

  return groups[0];
}

export async function requireOwnedTradingAccount(userId: string, accountId: string) {
  const accounts = await db
    .select({ id: tradingAccount.id })
    .from(tradingAccount)
    .where(and(eq(tradingAccount.id, accountId), eq(tradingAccount.userId, userId)))
    .limit(1);

  if (!accounts.length) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Trading account not found or does not belong to you",
    });
  }

  return accounts[0];
}

export async function requireOwnedCopySlave(userId: string, slaveId: string) {
  const slaves = await db
    .select({ slave: copySlave, group: copyGroup })
    .from(copySlave)
    .innerJoin(copyGroup, eq(copySlave.copyGroupId, copyGroup.id))
    .where(and(eq(copySlave.id, slaveId), eq(copyGroup.userId, userId)))
    .limit(1);

  if (!slaves.length) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Slave not found",
    });
  }

  return slaves[0];
}
