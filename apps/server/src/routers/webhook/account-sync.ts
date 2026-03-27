import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";

import { db } from "../../db";
import { equitySnapshot } from "../../db/schema/connections";
import { tradingAccount } from "../../db/schema/trading";
import { cache, cacheKeys } from "../../lib/cache";
import { createNotification } from "../../lib/notifications";
import {
  ensureActivationMilestone,
  recordAppEvent,
} from "../../lib/ops/event-log";
import { buildAutoPropAccountFields } from "../../lib/prop-firm-detection";
import { ensurePropChallengeLineageForAccount } from "../../lib/prop-challenge-lineage";
import { syncPropAccountState } from "../../lib/prop-rule-monitor";
import { publicProcedure } from "../../lib/trpc";
import { verifyApiKey } from "./shared";

export const accountWebhookProcedures = {
  registerAccount: publicProcedure
    .input(
      z.object({
        apiKey: z.string().min(1),
        accountNumber: z.string().min(1),
        accountName: z.string().optional(),
        broker: z.string().optional(),
        brokerServer: z.string().optional(),
        initialBalance: z.number().optional(),
        currency: z.string().optional(),
        leverage: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const userId = await verifyApiKey(input.apiKey);

      const existing = await db
        .select({
          id: tradingAccount.id,
        })
        .from(tradingAccount)
        .where(
          and(
            eq(tradingAccount.userId, userId),
            eq(tradingAccount.accountNumber, input.accountNumber),
            eq(tradingAccount.brokerServer, input.brokerServer || "")
          )
        )
        .limit(1);

      if (existing.length > 0) {
        return {
          success: true,
          accountId: existing[0].id,
          message: "Account already registered",
        };
      }

      const accountId = nanoid();
      const accountName = input.accountName || `MT5 ${input.accountNumber}`;
      const broker = input.broker?.toLowerCase() || "mt5";
      const { updates: autoPropFields } = await buildAutoPropAccountFields({
        broker,
        brokerServer: input.brokerServer || null,
        initialBalance: input.initialBalance ?? null,
      });

      await db.insert(tradingAccount).values({
        id: accountId,
        userId,
        name: accountName,
        broker,
        brokerServer: input.brokerServer || null,
        accountNumber: input.accountNumber,
        initialBalance: input.initialBalance?.toString() || null,
        initialCurrency: (input.currency as "$" | "£" | "€") || "$",
        brokerType: "mt5",
        ...autoPropFields,
        createdAt: new Date(),
      });

      if (autoPropFields.isPropAccount) {
        await ensurePropChallengeLineageForAccount(accountId);
      }

      await Promise.all([
        ensureActivationMilestone({
          userId,
          key: "account_connected",
          source: "webhook",
          metadata: {
            accountId,
            accountNumber: input.accountNumber,
            broker,
          },
        }),
        recordAppEvent({
          userId,
          category: "connections",
          name: "webhook.account.registered",
          source: "server",
          summary: accountName,
          metadata: {
            accountId,
            accountNumber: input.accountNumber,
            broker,
          },
        }),
        createNotification({
          userId,
          accountId,
          type: "settings_updated",
          title: "Account registered",
          body: `Account ${accountName} (${input.accountNumber}) registered.`,
          metadata: {
            accountId,
            accountNumber: input.accountNumber,
            broker,
          },
        }),
      ]);

      return {
        success: true,
        accountId,
        message: "Account registered successfully",
      };
    }),

  updateAccountStatus: publicProcedure
    .input(
      z.object({
        apiKey: z.string().min(1),
        accountNumber: z.string().min(1),
        balance: z.number(),
        equity: z.number(),
        margin: z.number().optional(),
        freeMargin: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const userId = await verifyApiKey(input.apiKey);

        const result = await db
          .update(tradingAccount)
          .set({
            liveBalance: input.balance.toString(),
            liveEquity: input.equity.toString(),
            liveMargin: input.margin?.toString() || null,
            liveFreeMargin: input.freeMargin?.toString() || null,
            isVerified: 1,
            lastSyncedAt: new Date(),
          })
          .where(
            and(
              eq(tradingAccount.userId, userId),
              eq(tradingAccount.accountNumber, input.accountNumber)
            )
          )
          .returning({
            id: tradingAccount.id,
            name: tradingAccount.name,
            initialBalance: tradingAccount.initialBalance,
            initialCurrency: tradingAccount.initialCurrency,
          });

        if (!result.length) {
          console.error(
            `[updateAccountStatus] Account not found: ${input.accountNumber}`
          );
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Account not found. Please register account first.",
          });
        }

        cache.invalidate(cacheKeys.liveMetrics(result[0].id));

        const today = new Date().toISOString().split("T")[0];
        await db
          .insert(equitySnapshot)
          .values({
            accountId: result[0].id,
            snapshotDate: today,
            balance: input.balance.toString(),
            equity: input.equity.toString(),
            source: "ea",
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [equitySnapshot.accountId, equitySnapshot.snapshotDate],
            set: {
              balance: input.balance.toString(),
              equity: input.equity.toString(),
              updatedAt: new Date(),
            },
          });

        await syncPropAccountState(result[0].id, { saveAlerts: true });

        const hourKey = new Date().toISOString().slice(0, 13);
        await createNotification({
          userId,
          accountId: result[0].id,
          type: "webhook_sync",
          title: "EA sync active",
          body: `Account ${result[0].name} is syncing live status.`,
          metadata: {
            kind: "account_summary",
            accountName: result[0].name,
            accountNumber: input.accountNumber,
            balance: input.balance,
            equity: input.equity,
            initialBalance:
              result[0].initialBalance == null
                ? null
                : Number(result[0].initialBalance),
            currencyCode: result[0].initialCurrency,
            pnl:
              result[0].initialBalance == null
                ? null
                : input.equity - Number(result[0].initialBalance),
            returnPct:
              result[0].initialBalance == null ||
              Number(result[0].initialBalance) === 0
                ? null
                : ((input.equity - Number(result[0].initialBalance)) /
                    Number(result[0].initialBalance)) *
                  100,
            url: "/dashboard",
          },
          dedupeKey: `webhook:account-status:${result[0].id}:${hourKey}`,
        });

        return {
          success: true,
          message: "Account status updated",
        };
      } catch (error) {
        console.error("[updateAccountStatus] ERROR:", error);
        throw error;
      }
    }),
};
