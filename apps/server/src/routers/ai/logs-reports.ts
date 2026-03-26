import { protectedProcedure } from "../../lib/trpc";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";

import { db } from "../../db";
import { aiActionLog, aiChatMessage, aiReport } from "../../db/schema/ai";
import { isAllAccountsScope } from "../../lib/account-scope";

function normalizeReportAccountId(accountId?: string | null) {
  if (!accountId || isAllAccountsScope(accountId)) {
    return null;
  }

  return accountId;
}

async function ensureOwnedReport(reportId: string, userId: string) {
  const reports = await db
    .select()
    .from(aiReport)
    .where(and(eq(aiReport.id, reportId), eq(aiReport.userId, userId)))
    .limit(1);

  if (reports.length === 0) {
    throw new Error("Report not found");
  }

  return reports[0];
}

export const aiLogReportProcedures = {
  getLogs: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        accountId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const logs = await db
        .select()
        .from(aiActionLog)
        .where(and(eq(aiActionLog.userId, ctx.session.user.id)))
        .orderBy(desc(aiActionLog.startedAt))
        .limit(input.limit);

      return { items: logs };
    }),

  createLog: protectedProcedure
    .input(
      z.object({
        title: z.string(),
        intent: z.string(),
        userMessage: z.string(),
        messageId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [log] = await db
        .insert(aiActionLog)
        .values({
          id: crypto.randomUUID(),
          userId: ctx.session.user.id,
          title: input.title,
          intent: input.intent,
          userMessage: input.userMessage,
          messageId: input.messageId || null,
          status: "pending",
          startedAt: new Date(),
        })
        .returning();

      return log;
    }),

  updateLog: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["pending", "running", "completed", "failed"]),
        error: z.string().optional(),
        result: z.any().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [log] = await db
        .update(aiActionLog)
        .set({
          status: input.status,
          error: input.error,
          result: input.result,
          completedAt:
            input.status === "completed" || input.status === "failed"
              ? new Date()
              : undefined,
        })
        .where(
          and(
            eq(aiActionLog.id, input.id),
            eq(aiActionLog.userId, ctx.session.user.id)
          )
        )
        .returning();

      return log;
    }),

  deleteLog: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(aiActionLog)
        .where(
          and(
            eq(aiActionLog.id, input.id),
            eq(aiActionLog.userId, ctx.session.user.id)
          )
        );

      return { success: true };
    }),

  getReports: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        accountId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(aiReport.userId, ctx.session.user.id)];
      const normalizedAccountId = normalizeReportAccountId(input.accountId);
      if (normalizedAccountId) {
        conditions.push(eq(aiReport.accountId, normalizedAccountId));
      }

      const reports = await db
        .select()
        .from(aiReport)
        .where(and(...conditions))
        .orderBy(desc(aiReport.updatedAt))
        .limit(input.limit);

      return { items: reports };
    }),

  createReport: protectedProcedure
    .input(
      z.object({
        title: z.string(),
        description: z.string().optional(),
        accountId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const normalizedAccountId = normalizeReportAccountId(input.accountId);

      const [report] = await db
        .insert(aiReport)
        .values({
          id: crypto.randomUUID(),
          userId: ctx.session.user.id,
          accountId: normalizedAccountId,
          title: input.title,
          description: input.description,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return report;
    }),

  updateReport: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [report] = await db
        .update(aiReport)
        .set({
          title: input.title,
          description: input.description,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(aiReport.id, input.id),
            eq(aiReport.userId, ctx.session.user.id)
          )
        )
        .returning();

      return report;
    }),

  deleteReport: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(aiReport)
        .where(
          and(
            eq(aiReport.id, input.id),
            eq(aiReport.userId, ctx.session.user.id)
          )
        );

      return { success: true };
    }),

  getMessages: protectedProcedure
    .input(
      z.object({
        reportId: z.string(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      await ensureOwnedReport(input.reportId, ctx.session.user.id);

      const messages = await db
        .select()
        .from(aiChatMessage)
        .where(eq(aiChatMessage.reportId, input.reportId))
        .orderBy(aiChatMessage.createdAt)
        .limit(input.limit);

      return { items: messages };
    }),

  addMessage: protectedProcedure
    .input(
      z.object({
        reportId: z.string(),
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
        htmlContent: z.string().optional(),
        intent: z.string().optional(),
        confidence: z.string().optional(),
        data: z.any().optional(),
        status: z
          .enum(["pending", "running", "completed", "failed"])
          .optional(),
        error: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureOwnedReport(input.reportId, ctx.session.user.id);

      const [message] = await db
        .insert(aiChatMessage)
        .values({
          id: crypto.randomUUID(),
          reportId: input.reportId,
          role: input.role,
          content: input.content,
          htmlContent: input.htmlContent,
          intent: input.intent,
          confidence: input.confidence,
          data: input.data,
          status: input.status || "completed",
          error: input.error,
          createdAt: new Date(),
        })
        .returning();

      await db
        .update(aiReport)
        .set({ updatedAt: new Date() })
        .where(eq(aiReport.id, input.reportId));

      return message;
    }),

  updateMessage: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z
          .enum(["pending", "running", "completed", "failed"])
          .optional(),
        data: z.any().optional(),
        error: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const [message] = await db
        .update(aiChatMessage)
        .set({
          status: input.status,
          data: input.data,
          error: input.error,
        })
        .where(eq(aiChatMessage.id, input.id))
        .returning();

      return message;
    }),
};
