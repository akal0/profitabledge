import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";

import { db } from "../../db";
import { copyGroup, copySlave } from "../../db/schema/copier";
import { tradingAccount } from "../../db/schema/trading";
import { protectedProcedure } from "../../lib/trpc";
import {
  requireOwnedCopyGroup,
  requireOwnedCopySlave,
  slaveConfigSchema,
} from "./shared";

export const copierGroupProcedures = {
  listGroups: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const groups = await db
      .select({
        group: copyGroup,
        masterAccount: tradingAccount,
      })
      .from(copyGroup)
      .innerJoin(tradingAccount, eq(copyGroup.masterAccountId, tradingAccount.id))
      .where(eq(copyGroup.userId, userId))
      .orderBy(desc(copyGroup.createdAt));

    const groupsWithStats = await Promise.all(
      groups.map(async ({ group, masterAccount }) => {
        const slaves = await db
          .select({
            count: sql<string>`COUNT(*)`,
            activeCount: sql<string>`SUM(CASE WHEN ${copySlave.isActive} THEN 1 ELSE 0 END)`,
            totalProfit: sql<string>`COALESCE(SUM(${copySlave.totalProfit}), 0)`,
            totalTrades: sql<string>`COALESCE(SUM(${copySlave.totalCopiedTrades}), 0)`,
          })
          .from(copySlave)
          .where(eq(copySlave.copyGroupId, group.id));

        return {
          id: group.id,
          name: group.name,
          isActive: group.isActive,
          createdAt: group.createdAt,
          masterAccount: {
            id: masterAccount.id,
            name: masterAccount.name,
            broker: masterAccount.broker,
            accountNumber: masterAccount.accountNumber,
            liveBalance: masterAccount.liveBalance,
            liveEquity: masterAccount.liveEquity,
            isVerified: masterAccount.isVerified === 1,
          },
          stats: {
            slaveCount: parseInt(slaves[0]?.count ?? "0", 10),
            activeSlaveCount: parseInt(slaves[0]?.activeCount ?? "0", 10),
            totalProfit: parseFloat(slaves[0]?.totalProfit ?? "0"),
            totalTrades: parseInt(slaves[0]?.totalTrades ?? "0", 10),
          },
        };
      })
    );

    return groupsWithStats;
  }),

  getGroup: protectedProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const groups = await db
        .select({
          group: copyGroup,
          masterAccount: tradingAccount,
        })
        .from(copyGroup)
        .innerJoin(tradingAccount, eq(copyGroup.masterAccountId, tradingAccount.id))
        .where(and(eq(copyGroup.id, input.groupId), eq(copyGroup.userId, userId)))
        .limit(1);

      if (!groups.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Copy group not found" });
      }

      const { group, masterAccount } = groups[0];

      const slavesData = await db
        .select({
          slave: copySlave,
          slaveAccount: tradingAccount,
        })
        .from(copySlave)
        .innerJoin(tradingAccount, eq(copySlave.slaveAccountId, tradingAccount.id))
        .where(eq(copySlave.copyGroupId, group.id))
        .orderBy(desc(copySlave.createdAt));

      return {
        id: group.id,
        name: group.name,
        isActive: group.isActive,
        createdAt: group.createdAt,
        masterAccount: {
          id: masterAccount.id,
          name: masterAccount.name,
          broker: masterAccount.broker,
          accountNumber: masterAccount.accountNumber,
          liveBalance: masterAccount.liveBalance,
          liveEquity: masterAccount.liveEquity,
          isVerified: masterAccount.isVerified === 1,
        },
        slaves: slavesData.map(({ slave, slaveAccount }) => ({
          id: slave.id,
          isActive: slave.isActive,
          lotMode: slave.lotMode,
          fixedLot: slave.fixedLot,
          lotMultiplier: slave.lotMultiplier,
          riskPercent: slave.riskPercent,
          maxLotSize: slave.maxLotSize,
          maxDailyLoss: slave.maxDailyLoss,
          maxTradesPerDay: slave.maxTradesPerDay,
          maxDrawdownPercent: slave.maxDrawdownPercent,
          slMode: slave.slMode,
          slFixedPips: slave.slFixedPips,
          slMultiplier: slave.slMultiplier,
          tpMode: slave.tpMode,
          tpFixedPips: slave.tpFixedPips,
          tpMultiplier: slave.tpMultiplier,
          symbolWhitelist: slave.symbolWhitelist,
          symbolBlacklist: slave.symbolBlacklist,
          sessionFilter: slave.sessionFilter,
          minLotSize: slave.minLotSize,
          maxSlippagePips: slave.maxSlippagePips,
          copyPendingOrders: slave.copyPendingOrders,
          copySlTpModifications: slave.copySlTpModifications,
          reverseTrades: slave.reverseTrades,
          totalCopiedTrades: slave.totalCopiedTrades,
          totalProfit: slave.totalProfit,
          lastCopyAt: slave.lastCopyAt,
          createdAt: slave.createdAt,
          account: {
            id: slaveAccount.id,
            name: slaveAccount.name,
            broker: slaveAccount.broker,
            accountNumber: slaveAccount.accountNumber,
            liveBalance: slaveAccount.liveBalance,
            liveEquity: slaveAccount.liveEquity,
            isVerified: slaveAccount.isVerified === 1,
          },
        })),
      };
    }),

  createGroup: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        masterAccountId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const accounts = await db
        .select({ id: tradingAccount.id })
        .from(tradingAccount)
        .where(
          and(
            eq(tradingAccount.id, input.masterAccountId),
            eq(tradingAccount.userId, userId)
          )
        )
        .limit(1);

      if (!accounts.length) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Master account not found or does not belong to you",
        });
      }

      const groupId = nanoid();

      await db.insert(copyGroup).values({
        id: groupId,
        userId,
        name: input.name,
        masterAccountId: input.masterAccountId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return { id: groupId };
    }),

  updateGroup: protectedProcedure
    .input(
      z.object({
        groupId: z.string(),
        name: z.string().min(1).max(100).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireOwnedCopyGroup(ctx.session.user.id, input.groupId);

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (input.name !== undefined) updates.name = input.name;
      if (input.isActive !== undefined) updates.isActive = input.isActive;

      await db.update(copyGroup).set(updates).where(eq(copyGroup.id, input.groupId));

      return { success: true };
    }),

  deleteGroup: protectedProcedure
    .input(z.object({ groupId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireOwnedCopyGroup(ctx.session.user.id, input.groupId);

      await db.delete(copyGroup).where(eq(copyGroup.id, input.groupId));

      return { success: true };
    }),

  addSlave: protectedProcedure
    .input(
      z.object({
        groupId: z.string(),
        slaveAccountId: z.string(),
        config: slaveConfigSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const groups = await db
        .select({ id: copyGroup.id, masterAccountId: copyGroup.masterAccountId })
        .from(copyGroup)
        .where(and(eq(copyGroup.id, input.groupId), eq(copyGroup.userId, userId)))
        .limit(1);

      if (!groups.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Copy group not found",
        });
      }

      const accounts = await db
        .select({ id: tradingAccount.id })
        .from(tradingAccount)
        .where(
          and(
            eq(tradingAccount.id, input.slaveAccountId),
            eq(tradingAccount.userId, userId)
          )
        )
        .limit(1);

      if (!accounts.length) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Slave account not found or does not belong to you",
        });
      }

      if (input.slaveAccountId === groups[0].masterAccountId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot add master account as a slave",
        });
      }

      const existing = await db
        .select({ id: copySlave.id })
        .from(copySlave)
        .where(
          and(
            eq(copySlave.copyGroupId, input.groupId),
            eq(copySlave.slaveAccountId, input.slaveAccountId)
          )
        )
        .limit(1);

      if (existing.length) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This account is already a slave in this group",
        });
      }

      const slaveId = nanoid();
      const config = input.config;

      await db.insert(copySlave).values({
        id: slaveId,
        copyGroupId: input.groupId,
        slaveAccountId: input.slaveAccountId,
        isActive: true,
        lotMode: config?.lotMode ?? "multiplier",
        fixedLot: config?.fixedLot?.toString() ?? "0.01",
        lotMultiplier: config?.lotMultiplier?.toString() ?? "1.0",
        riskPercent: config?.riskPercent?.toString() ?? "1.0",
        maxLotSize: config?.maxLotSize?.toString() ?? "10.0",
        maxDailyLoss: config?.maxDailyLoss?.toString() ?? null,
        maxTradesPerDay: config?.maxTradesPerDay ?? null,
        maxDrawdownPercent: config?.maxDrawdownPercent?.toString() ?? null,
        slMode: config?.slMode ?? "copy",
        slFixedPips: config?.slFixedPips?.toString() ?? null,
        slMultiplier: config?.slMultiplier?.toString() ?? "1.0",
        tpMode: config?.tpMode ?? "copy",
        tpFixedPips: config?.tpFixedPips?.toString() ?? null,
        tpMultiplier: config?.tpMultiplier?.toString() ?? "1.0",
        symbolWhitelist: config?.symbolWhitelist ?? null,
        symbolBlacklist: config?.symbolBlacklist ?? null,
        sessionFilter: config?.sessionFilter ?? null,
        minLotSize: config?.minLotSize?.toString() ?? "0.01",
        maxSlippagePips: config?.maxSlippagePips?.toString() ?? "3.0",
        copyPendingOrders: config?.copyPendingOrders ?? false,
        copySlTpModifications: config?.copySlTpModifications ?? true,
        reverseTrades: config?.reverseTrades ?? false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return { id: slaveId };
    }),

  updateSlave: protectedProcedure
    .input(
      z.object({
        slaveId: z.string(),
        isActive: z.boolean().optional(),
        config: slaveConfigSchema.partial().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireOwnedCopySlave(ctx.session.user.id, input.slaveId);

      const updates: Record<string, unknown> = { updatedAt: new Date() };

      if (input.isActive !== undefined) {
        updates.isActive = input.isActive;
      }

      if (input.config) {
        const c = input.config;
        if (c.lotMode !== undefined) updates.lotMode = c.lotMode;
        if (c.fixedLot !== undefined) updates.fixedLot = c.fixedLot.toString();
        if (c.lotMultiplier !== undefined) updates.lotMultiplier = c.lotMultiplier.toString();
        if (c.riskPercent !== undefined) updates.riskPercent = c.riskPercent.toString();
        if (c.maxLotSize !== undefined) updates.maxLotSize = c.maxLotSize.toString();
        if (c.maxDailyLoss !== undefined) updates.maxDailyLoss = c.maxDailyLoss?.toString() ?? null;
        if (c.maxTradesPerDay !== undefined) updates.maxTradesPerDay = c.maxTradesPerDay ?? null;
        if (c.maxDrawdownPercent !== undefined) updates.maxDrawdownPercent = c.maxDrawdownPercent?.toString() ?? null;
        if (c.slMode !== undefined) updates.slMode = c.slMode;
        if (c.slFixedPips !== undefined) updates.slFixedPips = c.slFixedPips?.toString() ?? null;
        if (c.slMultiplier !== undefined) updates.slMultiplier = c.slMultiplier.toString();
        if (c.tpMode !== undefined) updates.tpMode = c.tpMode;
        if (c.tpFixedPips !== undefined) updates.tpFixedPips = c.tpFixedPips?.toString() ?? null;
        if (c.tpMultiplier !== undefined) updates.tpMultiplier = c.tpMultiplier.toString();
        if (c.symbolWhitelist !== undefined) updates.symbolWhitelist = c.symbolWhitelist ?? null;
        if (c.symbolBlacklist !== undefined) updates.symbolBlacklist = c.symbolBlacklist ?? null;
        if (c.sessionFilter !== undefined) updates.sessionFilter = c.sessionFilter ?? null;
        if (c.minLotSize !== undefined) updates.minLotSize = c.minLotSize.toString();
        if (c.maxSlippagePips !== undefined) updates.maxSlippagePips = c.maxSlippagePips.toString();
        if (c.copyPendingOrders !== undefined) updates.copyPendingOrders = c.copyPendingOrders;
        if (c.copySlTpModifications !== undefined) updates.copySlTpModifications = c.copySlTpModifications;
        if (c.reverseTrades !== undefined) updates.reverseTrades = c.reverseTrades;
      }

      await db.update(copySlave).set(updates).where(eq(copySlave.id, input.slaveId));

      return { success: true };
    }),

  removeSlave: protectedProcedure
    .input(z.object({ slaveId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireOwnedCopySlave(ctx.session.user.id, input.slaveId);

      await db.delete(copySlave).where(eq(copySlave.id, input.slaveId));

      return { success: true };
    }),

  getAvailableAccounts: protectedProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const group = await requireOwnedCopyGroup(userId, input.groupId);

      const existingSlaves = await db
        .select({ slaveAccountId: copySlave.slaveAccountId })
        .from(copySlave)
        .where(eq(copySlave.copyGroupId, input.groupId));

      const excludeIds = [
        group.masterAccountId,
        ...existingSlaves.map((slave) => slave.slaveAccountId),
      ];

      const accounts = await db
        .select()
        .from(tradingAccount)
        .where(
          and(
            eq(tradingAccount.userId, userId),
            sql`${tradingAccount.id} NOT IN (${sql.join(
              excludeIds.map((id) => sql`${id}`),
              sql`, `
            )})`
          )
        )
        .orderBy(desc(tradingAccount.createdAt));

      return accounts.map((account) => ({
        id: account.id,
        name: account.name,
        broker: account.broker,
        accountNumber: account.accountNumber,
        liveBalance: account.liveBalance,
        liveEquity: account.liveEquity,
        isVerified: account.isVerified === 1,
      }));
    }),
};
