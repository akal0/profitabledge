import { z } from "zod";

import { ackCopySignalExecution } from "../../lib/copy-signal-queue";
import { claimPendingCopySignalsForAccount } from "../../lib/copy-signal-queue";
import { publicProcedure } from "../../lib/trpc";
import {
  requireWebhookAccountIdByNumber,
  verifyApiKey,
} from "./shared";

export const copierWebhookProcedures = {
  getCopySignals: publicProcedure
    .input(
      z.object({
        apiKey: z.string().min(1),
        accountNumber: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const userId = await verifyApiKey(input.apiKey);
      const accountId = await requireWebhookAccountIdByNumber(
        userId,
        input.accountNumber
      ).catch(() => null);

      if (!accountId) {
        return { signals: [] };
      }

      const signals = await claimPendingCopySignalsForAccount(accountId);

      return {
        signals,
      };
    }),

  ackCopySignal: publicProcedure
    .input(
      z.object({
        apiKey: z.string().min(1),
        signalId: z.string().min(1),
        success: z.boolean(),
        slaveTicket: z.string().optional(),
        executedPrice: z.number().optional(),
        slippagePips: z.number().optional(),
        profit: z.number().optional(),
        errorMessage: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await verifyApiKey(input.apiKey);
      return ackCopySignalExecution({
        signalId: input.signalId,
        success: input.success,
        slaveTicket: input.slaveTicket,
        executedPrice: input.executedPrice,
        slippagePips: input.slippagePips,
        profit: input.profit,
        errorMessage: input.errorMessage,
      });
    }),

  masterTradeOpen: publicProcedure
    .input(
      z.object({
        apiKey: z.string().min(1),
        accountNumber: z.string().min(1),
        trade: z.object({
          ticket: z.string(),
          symbol: z.string(),
          type: z.enum(["buy", "sell"]),
          volume: z.number(),
          openPrice: z.number(),
          sl: z.number().optional(),
          tp: z.number().optional(),
          sessionTag: z.string().optional(),
        }),
        accountMetrics: z.object({
          balance: z.number(),
          equity: z.number(),
          initialBalance: z.number().optional(),
        }),
      })
    )
    .mutation(async ({ input }) => {
      const userId = await verifyApiKey(input.apiKey);
      const { processMasterTradeOpen } = await import("../../lib/copy-engine");
      const masterAccountId = await requireWebhookAccountIdByNumber(
        userId,
        input.accountNumber
      );

      await processMasterTradeOpen(
        masterAccountId,
        {
          ticket: input.trade.ticket,
          symbol: input.trade.symbol,
          tradeType: input.trade.type,
          volume: input.trade.volume,
          openPrice: input.trade.openPrice,
          sl: input.trade.sl,
          tp: input.trade.tp,
          sessionTag: input.trade.sessionTag,
        },
        {
          balance: input.accountMetrics.balance,
          equity: input.accountMetrics.equity,
          initialBalance:
            input.accountMetrics.initialBalance ?? input.accountMetrics.balance,
        }
      );

      return { success: true };
    }),

  masterTradeClose: publicProcedure
    .input(
      z.object({
        apiKey: z.string().min(1),
        accountNumber: z.string().min(1),
        ticket: z.string(),
        closePrice: z.number(),
        profit: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const userId = await verifyApiKey(input.apiKey);
      const { processMasterTradeClose } = await import("../../lib/copy-engine");
      const accountId = await requireWebhookAccountIdByNumber(
        userId,
        input.accountNumber
      );

      await processMasterTradeClose(
        accountId,
        input.ticket,
        input.closePrice,
        input.profit
      );

      return { success: true };
    }),

  masterTradeModify: publicProcedure
    .input(
      z.object({
        apiKey: z.string().min(1),
        accountNumber: z.string().min(1),
        ticket: z.string(),
        newSl: z.number().optional(),
        newTp: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const userId = await verifyApiKey(input.apiKey);
      const { processMasterTradeModify } = await import("../../lib/copy-engine");
      const accountId = await requireWebhookAccountIdByNumber(
        userId,
        input.accountNumber
      );

      await processMasterTradeModify(
        accountId,
        input.ticket,
        input.newSl ?? null,
        input.newTp ?? null
      );

      return { success: true };
    }),
};
