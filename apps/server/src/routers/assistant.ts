import { and, asc, desc, eq, inArray, lt, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { db } from "../db";
import { conversation, message } from "../db/schema/assistant";
import { tradingAccount } from "../db/schema/trading";
import { protectedProcedure, router } from "../lib/trpc";
import { isAllAccountsScope } from "../lib/account-scope";
import { buildRenderedWidgets } from "../lib/assistant/presentation";
import { collectAssistantResponse } from "../lib/assistant/runtime";
import { getSuggestedQuestionsForAccount } from "../lib/assistant/suggestions";

function normalizeConversationAccountId(accountId?: string | null) {
  if (!accountId || isAllAccountsScope(accountId)) {
    return null;
  }

  return accountId;
}

async function ensureOwnedConversation(conversationId: string, userId: string) {
  const rows = await db
    .select()
    .from(conversation)
    .where(and(eq(conversation.id, conversationId), eq(conversation.userId, userId)))
    .limit(1);

  if (rows.length === 0) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Conversation not found",
    });
  }

  return rows[0];
}

export const assistantRouter = router({
  getConversations: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).default(20),
          accountId: z.string().optional(),
          cursor: z
            .object({
              lastMessageAtISO: z.string(),
              id: z.string(),
            })
            .optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 20;
      const normalizedAccountId = normalizeConversationAccountId(input?.accountId);
      const conditions = [eq(conversation.userId, ctx.session.user.id)];

      if (normalizedAccountId) {
        const scopedConversationIds = await db
          .selectDistinct({ conversationId: message.conversationId })
          .from(message)
          .where(eq(message.accountId, normalizedAccountId));

        const conversationIds = scopedConversationIds
          .map((row) => row.conversationId)
          .filter((value): value is string => Boolean(value));

        if (conversationIds.length === 0) {
          return {
            items: [],
            nextCursor: undefined,
          } as const;
        }

        conditions.push(inArray(conversation.id, conversationIds));
      }

      if (input?.cursor) {
        const cursorDate = new Date(input.cursor.lastMessageAtISO);
        conditions.push(
          or(
            lt(conversation.lastMessageAt, cursorDate),
            and(
              eq(conversation.lastMessageAt, cursorDate),
              lt(conversation.id, input.cursor.id)
            )
          )!
        );
      }

      const rows = await db
        .select()
        .from(conversation)
        .where(and(...conditions))
        .orderBy(desc(conversation.lastMessageAt), desc(conversation.id))
        .limit(limit + 1);

      const items = rows.slice(0, limit);
      const next = rows.length > limit ? rows[limit] : null;

      return {
        items,
        nextCursor: next
          ? {
              lastMessageAtISO: next.lastMessageAt.toISOString(),
              id: next.id,
            }
          : undefined,
      };
    }),

  getConversation: protectedProcedure
    .input(z.object({ conversationId: z.string() }))
    .query(async ({ ctx, input }) => {
      const currentConversation = await ensureOwnedConversation(
        input.conversationId,
        ctx.session.user.id
      );

      const messages = await db
        .select()
        .from(message)
        .where(eq(message.conversationId, input.conversationId))
        .orderBy(asc(message.createdAt));

      return {
        conversation: currentConversation,
        messages,
      };
    }),

  createConversation: protectedProcedure
    .input(
      z.object({
        title: z.string().trim().min(1).max(200).optional(),
        accountId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [created] = await db
        .insert(conversation)
        .values({
          id: crypto.randomUUID(),
          userId: ctx.session.user.id,
          title: input.title || "New conversation",
          lastMessageAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return created;
    }),

  renameConversation: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        title: z.string().trim().min(1).max(200),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureOwnedConversation(input.conversationId, ctx.session.user.id);

      const [updated] = await db
        .update(conversation)
        .set({
          title: input.title,
          updatedAt: new Date(),
        })
        .where(eq(conversation.id, input.conversationId))
        .returning();

      return updated;
    }),

  deleteConversation: protectedProcedure
    .input(z.object({ conversationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ensureOwnedConversation(input.conversationId, ctx.session.user.id);

      await db.delete(conversation).where(eq(conversation.id, input.conversationId));

      return { success: true };
    }),

  addMessage: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
        widgets: z.array(z.any()).optional(),
        toolCalls: z.array(z.any()).optional(),
        context: z.any().optional(),
        accountId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensureOwnedConversation(input.conversationId, ctx.session.user.id);

      const [created] = await db
        .insert(message)
        .values({
          id: crypto.randomUUID(),
          conversationId: input.conversationId,
          role: input.role,
          content: input.content,
          widgets: input.widgets ?? [],
          toolCalls: input.toolCalls ?? [],
          context: input.context,
          accountId: normalizeConversationAccountId(input.accountId),
          createdAt: new Date(),
        })
        .returning();

      await db
        .update(conversation)
        .set({
          lastMessageAt: created.createdAt,
          updatedAt: new Date(),
        })
        .where(eq(conversation.id, input.conversationId));

      return created;
    }),

  sendMessage: protectedProcedure
    .input(
      z.object({
        conversationId: z.string().optional(),
        accountId: z.string().min(1),
        content: z.string().trim().min(1),
        pageContext: z.any().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const normalizedAccountId = normalizeConversationAccountId(input.accountId);
      let currentConversation = input.conversationId
        ? await ensureOwnedConversation(input.conversationId, ctx.session.user.id)
        : null;

      if (!currentConversation) {
        const [created] = await db
          .insert(conversation)
          .values({
            id: crypto.randomUUID(),
            userId: ctx.session.user.id,
            title:
              input.content.slice(0, 80) +
              (input.content.length > 80 ? "..." : ""),
            lastMessageAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        currentConversation = created;
      }

      const previousMessages = await db
        .select({ role: message.role, content: message.content })
        .from(message)
        .where(eq(message.conversationId, currentConversation.id))
        .orderBy(asc(message.createdAt));

      const history = previousMessages
        .slice(-12)
        .map((entry: any) => `${entry.role}: ${entry.content}`);

      const [userMessage] = await db
        .insert(message)
        .values({
          id: crypto.randomUUID(),
          conversationId: currentConversation.id,
          role: "user",
          content: input.content,
          widgets: [],
          toolCalls: [],
          accountId: normalizedAccountId,
          createdAt: new Date(),
        })
        .returning();

      const response = await collectAssistantResponse(input.content, {
        userId: ctx.session.user.id,
        accountId: input.accountId,
        conversationHistory: [...history, `user: ${input.content}`],
        pageContext: input.pageContext,
      });

      const widgets = buildRenderedWidgets({
        visualization: response.visualization,
        analysisBlocks: response.analysisBlocks,
      });

      const [assistantMessage] = await db
        .insert(message)
        .values({
          id: crypto.randomUUID(),
          conversationId: currentConversation.id,
          role: "assistant",
          content:
            response.content ||
            response.error ||
            "I ran into an issue fetching your data. Try again in a moment.",
          widgets,
          toolCalls: response.metadata?.toolCalls ?? [],
          context: response.metadata?.context,
          accountId: normalizedAccountId,
          createdAt: new Date(),
        })
        .returning();

      await db
        .update(conversation)
        .set({
          lastMessageAt: assistantMessage.createdAt,
          updatedAt: new Date(),
        })
        .where(eq(conversation.id, currentConversation.id));

      return {
        conversation: currentConversation,
        userMessage,
        assistantMessage,
      };
    }),

  getSuggestedQuestions: protectedProcedure
    .input(
      z.object({
        accountId: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      const isAllAccounts = isAllAccountsScope(input.accountId);
      const accountIds = isAllAccountsScope(input.accountId)
        ? await db
            .select({ id: tradingAccount.id })
            .from(tradingAccount)
            .where(eq(tradingAccount.userId, ctx.session.user.id))
        : null;

      const ownedAccount = isAllAccounts
        ? null
        : await db
            .select({ id: tradingAccount.id })
            .from(tradingAccount)
            .where(
              and(
                eq(tradingAccount.id, input.accountId),
                eq(tradingAccount.userId, ctx.session.user.id)
              )
            )
            .limit(1);

      if (!isAllAccounts && !ownedAccount?.[0]) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Account not found",
        });
      }

      if (isAllAccounts && (accountIds?.length ?? 0) === 0) {
        return [];
      }

      return getSuggestedQuestionsForAccount({
        userId: ctx.session.user.id,
        accountId: input.accountId,
      });
    }),
});
