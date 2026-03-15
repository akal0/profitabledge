import { router, protectedProcedure, publicProcedure } from "../lib/trpc";
import { z } from "zod";
import { db } from "../db";
import {
  accountFollow,
  feedEvent,
  tradeAnnotation,
  patternFollow,
  patternMatch,
  mirrorComparison,
  leaderboardEntry,
  bookmark,
  activity,
  trade,
  tradingAccount,
} from "../db/schema";
import { user as userTable } from "../db/schema/auth";
import { eq, and, desc, sql, or, inArray, gte, lte, isNull, asc, ne } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";

const ANONYMOUS_BENCHMARK_MIN_TRADES = 25;
const ANONYMOUS_BENCHMARK_PROFIT_FACTOR_CAP = 10;

type AnonymousBenchmarkMetrics = {
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  avgRR: number;
  consistency: number;
};

function normalizeProfitFactor(grossProfit: number, grossLoss: number): number {
  if (grossLoss > 0) return grossProfit / grossLoss;
  if (grossProfit > 0) return ANONYMOUS_BENCHMARK_PROFIT_FACTOR_CAP;
  return 0;
}

function quantile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];

  const position = (sorted.length - 1) * percentile;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const lower = sorted[lowerIndex] ?? sorted[sorted.length - 1] ?? 0;
  const upper = sorted[upperIndex] ?? lower;

  if (lowerIndex === upperIndex) return lower;
  return lower + (upper - lower) * (position - lowerIndex);
}

function getBenchmarkLabel(percentile: number): string {
  if (percentile >= 90) return "Top 10%";
  if (percentile >= 75) return "Top 25%";
  if (percentile >= 50) return "Top 50%";
  if (percentile >= 25) return "Top 75%";
  return "Bottom 25%";
}

function getPercentileRank(value: number, values: number[]): number {
  if (values.length === 0) return 0;
  const lowerOrEqualCount = values.filter((candidate) => candidate <= value).length;
  return Math.max(1, Math.min(100, Math.round((lowerOrEqualCount / values.length) * 100)));
}

function buildDailyConsistencyMap(
  rows: Array<{ accountId: string; dayProfit: number }>
): Map<string, number> {
  const byAccount = new Map<string, { totalDays: number; greenDays: number }>();

  for (const row of rows) {
    const current = byAccount.get(row.accountId) ?? { totalDays: 0, greenDays: 0 };
    current.totalDays += 1;
    if (row.dayProfit > 0) current.greenDays += 1;
    byAccount.set(row.accountId, current);
  }

  return new Map(
    Array.from(byAccount.entries()).map(([accountId, value]) => [
      accountId,
      value.totalDays > 0 ? (value.greenDays / value.totalDays) * 100 : 0,
    ])
  );
}

export const socialRouter = router({
  // ============== ACCOUNT FOLLOWING (NOT PERSON) ==============

  // Follow an account (verified only)
  followAccount: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const followerUserId = ctx.session.user.id;

      // Check if account exists and is verified
      const account = await db
        .select({
          id: tradingAccount.id,
          userId: tradingAccount.userId,
          name: tradingAccount.name,
          verificationLevel: tradingAccount.verificationLevel,
          socialOptIn: tradingAccount.socialOptIn,
        })
        .from(tradingAccount)
        .where(eq(tradingAccount.id, input.accountId))
        .limit(1);

      if (!account[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
      }

      // Cannot follow unverified accounts
      if (account[0].verificationLevel === "unverified") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot follow unverified accounts",
        });
      }

      // Cannot follow accounts that haven't opted in
      if (!account[0].socialOptIn) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This account is not public",
        });
      }

      // Cannot follow your own accounts
      if (account[0].userId === followerUserId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot follow your own account",
        });
      }

      // Check if already following
      const existing = await db
        .select()
        .from(accountFollow)
        .where(
          and(
            eq(accountFollow.followerUserId, followerUserId),
            eq(accountFollow.followedAccountId, input.accountId)
          )
        )
        .limit(1);

      if (existing[0]) {
        return { success: true, alreadyFollowing: true };
      }

      // Create follow
      await db.insert(accountFollow).values({
        id: nanoid(),
        followerUserId,
        followedAccountId: input.accountId,
        followedUserId: account[0].userId,
      });

      // Update counts
      await db
        .update(tradingAccount)
        .set({ followerCount: sql`${tradingAccount.followerCount} + 1` })
        .where(eq(tradingAccount.id, input.accountId));

      await db
        .update(userTable)
        .set({
          accountsFollowingCount: sql`${userTable.accountsFollowingCount} + 1`,
        })
        .where(eq(userTable.id, followerUserId));

      // Log activity
      await db.insert(activity).values({
        id: nanoid(),
        userId: followerUserId,
        activityType: "account_follow",
        contentId: input.accountId,
        metadata: { accountName: account[0].name },
      });

      return { success: true, alreadyFollowing: false };
    }),

  // Unfollow account
  unfollowAccount: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const followerUserId = ctx.session.user.id;

      const result = await db
        .delete(accountFollow)
        .where(
          and(
            eq(accountFollow.followerUserId, followerUserId),
            eq(accountFollow.followedAccountId, input.accountId)
          )
        )
        .returning();

      if (result.length === 0) {
        return { success: true, wasNotFollowing: true };
      }

      // Update counts
      await db
        .update(tradingAccount)
        .set({
          followerCount: sql`GREATEST(0, ${tradingAccount.followerCount} - 1)`,
        })
        .where(eq(tradingAccount.id, input.accountId));

      await db
        .update(userTable)
        .set({
          accountsFollowingCount: sql`GREATEST(0, ${userTable.accountsFollowingCount} - 1)`,
        })
        .where(eq(userTable.id, followerUserId));

      return { success: true, wasNotFollowing: false };
    }),

  // Get accounts I'm following
  getFollowedAccounts: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const follows = await db
      .select({
        follow: accountFollow,
        account: {
          id: tradingAccount.id,
          name: tradingAccount.name,
          verificationLevel: tradingAccount.verificationLevel,
          followerCount: tradingAccount.followerCount,
          feedEventCount: tradingAccount.feedEventCount,
        },
        owner: {
          id: userTable.id,
          name: userTable.name,
          username: userTable.username,
          isVerified: userTable.isVerified,
        },
      })
      .from(accountFollow)
      .innerJoin(tradingAccount, eq(accountFollow.followedAccountId, tradingAccount.id))
      .innerJoin(userTable, eq(accountFollow.followedUserId, userTable.id))
      .where(eq(accountFollow.followerUserId, userId))
      .orderBy(desc(accountFollow.createdAt));

    return follows;
  }),

  // Get account followers
  getAccountFollowers: publicProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ input }) => {
      const followers = await db
        .select({
          user: {
            id: userTable.id,
            name: userTable.name,
            username: userTable.username,
            image: userTable.image,
            isVerified: userTable.isVerified,
            verifiedSince: userTable.verifiedSince,
            totalVerifiedTrades: userTable.totalVerifiedTrades,
          },
          followedAt: accountFollow.createdAt,
        })
        .from(accountFollow)
        .innerJoin(userTable, eq(accountFollow.followerUserId, userTable.id))
        .where(eq(accountFollow.followedAccountId, input.accountId))
        .orderBy(desc(accountFollow.createdAt))
        .limit(100);

      return followers;
    }),

  // ============== FEED (AUTO-GENERATED) ==============

  // Get feed from followed accounts
  getFeed: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
        eventTypes: z.array(z.string()).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      // Get followed account IDs
      const followedAccountIds = await db
        .select({ accountId: accountFollow.followedAccountId })
        .from(accountFollow)
        .where(eq(accountFollow.followerUserId, userId));

      if (followedAccountIds.length === 0) {
        return [];
      }

      const accountIds = followedAccountIds.map((f) => f.accountId);

      // Get feed events
      const events = await db
        .select({
          event: feedEvent,
          account: {
            id: tradingAccount.id,
            name: tradingAccount.name,
            verificationLevel: tradingAccount.verificationLevel,
          },
          owner: {
            id: userTable.id,
            name: userTable.name,
            username: userTable.username,
            isVerified: userTable.isVerified,
          },
        })
        .from(feedEvent)
        .innerJoin(tradingAccount, eq(feedEvent.accountId, tradingAccount.id))
        .innerJoin(userTable, eq(tradingAccount.userId, userTable.id))
        .where(
          and(
            inArray(feedEvent.accountId, accountIds),
            eq(feedEvent.isVisible, true),
            input.eventTypes && input.eventTypes.length > 0
              ? inArray(feedEvent.eventType, input.eventTypes)
              : undefined
          )
        )
        .orderBy(desc(feedEvent.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return events;
    }),

  // Get public feed (discover verified accounts)
  getPublicFeed: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
        offset: z.number().min(0).default(0),
        verificationLevel: z.enum(["ea_synced", "api_verified", "prop_verified"]).optional(),
      })
    )
    .query(async ({ input }) => {
      const events = await db
        .select({
          event: feedEvent,
          account: {
            id: tradingAccount.id,
            name: tradingAccount.name,
            verificationLevel: tradingAccount.verificationLevel,
            followerCount: tradingAccount.followerCount,
          },
          owner: {
            id: userTable.id,
            name: userTable.name,
            username: userTable.username,
            isVerified: userTable.isVerified,
            verifiedSince: userTable.verifiedSince,
          },
        })
        .from(feedEvent)
        .innerJoin(tradingAccount, eq(feedEvent.accountId, tradingAccount.id))
        .innerJoin(userTable, eq(tradingAccount.userId, userTable.id))
        .where(
          and(
            eq(feedEvent.isVisible, true),
            eq(tradingAccount.socialOptIn, true),
            ne(tradingAccount.verificationLevel, "unverified"),
            input.verificationLevel
              ? eq(tradingAccount.verificationLevel, input.verificationLevel)
              : undefined
          )
        )
        .orderBy(desc(feedEvent.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return events;
    }),

  // Get account feed
  getAccountFeed: publicProcedure
    .input(
      z.object({
        accountId: z.string(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      // Check if account is public
      const account = await db
        .select({
          socialOptIn: tradingAccount.socialOptIn,
          verificationLevel: tradingAccount.verificationLevel,
        })
        .from(tradingAccount)
        .where(eq(tradingAccount.id, input.accountId))
        .limit(1);

      if (!account[0] || !account[0].socialOptIn || account[0].verificationLevel === "unverified") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Account is not public" });
      }

      const events = await db
        .select()
        .from(feedEvent)
        .where(
          and(
            eq(feedEvent.accountId, input.accountId),
            eq(feedEvent.isVisible, true)
          )
        )
        .orderBy(desc(feedEvent.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return events;
    }),

  // ============== TRADE ANNOTATIONS ==============

  // Add annotation (within 24h of trade close)
  addTradeAnnotation: protectedProcedure
    .input(
      z.object({
        tradeId: z.string(),
        content: z.string().min(1).max(200),
        annotationType: z.enum(["execution_note", "emotion_note", "rule_note", "learning_note"]),
        isPublic: z.boolean().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      // Verify trade ownership and timing
      const tradeData = await db
        .select({
          id: trade.id,
          accountId: trade.accountId,
          closeTime: trade.closeTime,
        })
        .from(trade)
        .where(eq(trade.id, input.tradeId))
        .limit(1);

      if (!tradeData[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Trade not found" });
      }

      // Verify account ownership
      const account = await db
        .select({ userId: tradingAccount.userId })
        .from(tradingAccount)
        .where(eq(tradingAccount.id, tradeData[0].accountId))
        .limit(1);

      if (!account[0] || account[0].userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your trade" });
      }

      // Check if trade is closed and within 24h
      if (!tradeData[0].closeTime) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Trade not closed yet" });
      }

      const hoursSinceClose = (Date.now() - new Date(tradeData[0].closeTime).getTime()) / (1000 * 60 * 60);
      if (hoursSinceClose > 24) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Annotations must be added within 24h of trade close",
        });
      }

      // Check if annotation already exists
      const existing = await db
        .select()
        .from(tradeAnnotation)
        .where(eq(tradeAnnotation.tradeId, input.tradeId))
        .limit(1);

      if (existing[0]) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Trade already has an annotation",
        });
      }

      const editableUntil = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      const annotation = await db
        .insert(tradeAnnotation)
        .values({
          id: nanoid(),
          tradeId: input.tradeId,
          userId,
          content: input.content,
          annotationType: input.annotationType,
          isPublic: input.isPublic,
          editableUntil,
        })
        .returning();

      return annotation[0];
    }),

  // Update annotation (within 5 min grace period)
  updateTradeAnnotation: protectedProcedure
    .input(
      z.object({
        annotationId: z.string(),
        content: z.string().min(1).max(200),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      const annotation = await db
        .select()
        .from(tradeAnnotation)
        .where(eq(tradeAnnotation.id, input.annotationId))
        .limit(1);

      if (!annotation[0]) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (annotation[0].userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      if (new Date() > annotation[0].editableUntil) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Edit period expired (5 minutes)",
        });
      }

      const updated = await db
        .update(tradeAnnotation)
        .set({
          content: input.content,
          editedAt: new Date(),
        })
        .where(eq(tradeAnnotation.id, input.annotationId))
        .returning();

      return updated[0];
    }),

  // Get trade annotation
  getTradeAnnotation: publicProcedure
    .input(z.object({ tradeId: z.string() }))
    .query(async ({ input }) => {
      const annotations = await db
        .select({
          annotation: tradeAnnotation,
          author: {
            id: userTable.id,
            name: userTable.name,
            username: userTable.username,
            isVerified: userTable.isVerified,
          },
        })
        .from(tradeAnnotation)
        .innerJoin(userTable, eq(tradeAnnotation.userId, userTable.id))
        .where(
          and(
            eq(tradeAnnotation.tradeId, input.tradeId),
            eq(tradeAnnotation.isPublic, true)
          )
        )
        .limit(1);

      return annotations[0] || null;
    }),

  // ============== PATTERN FOLLOWS ==============

  // Create pattern follow
  createPatternFollow: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        pattern: z.object({
          session: z.string().optional(),
          symbol: z.string().optional(),
          minRRCapture: z.number().min(0).max(1).optional(),
          minSampleSize: z.number().int().min(1).optional(),
          minProtocolRate: z.number().min(0).max(1).optional(),
          maxDrawdown: z.number().min(0).max(1).optional(),
          propFirmId: z.string().optional(),
        }),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      const pattern = await db
        .insert(patternFollow)
        .values({
          id: nanoid(),
          userId,
          name: input.name,
          patternConfig: input.pattern as any,
        })
        .returning();

      // Update user pattern follow count
      await db
        .update(userTable)
        .set({
          patternFollowsCount: sql`${userTable.patternFollowsCount} + 1`,
        })
        .where(eq(userTable.id, userId));

      // Log activity
      await db.insert(activity).values({
        id: nanoid(),
        userId,
        activityType: "pattern_follow_created",
        contentId: pattern[0].id,
        metadata: { patternName: input.name },
      });

      return pattern[0];
    }),

  // Get my pattern follows
  getMyPatternFollows: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const patterns = await db
      .select()
      .from(patternFollow)
      .where(
        and(eq(patternFollow.userId, userId), eq(patternFollow.isActive, true))
      )
      .orderBy(desc(patternFollow.createdAt));

    return patterns;
  }),

  // Get pattern matches
  getPatternMatches: protectedProcedure
    .input(z.object({ patternId: z.string() }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      // Verify ownership
      const pattern = await db
        .select()
        .from(patternFollow)
        .where(eq(patternFollow.id, input.patternId))
        .limit(1);

      if (!pattern[0] || pattern[0].userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const matches = await db
        .select({
          match: patternMatch,
          account: {
            id: tradingAccount.id,
            name: tradingAccount.name,
            verificationLevel: tradingAccount.verificationLevel,
            followerCount: tradingAccount.followerCount,
          },
          owner: {
            id: userTable.id,
            name: userTable.name,
            username: userTable.username,
            isVerified: userTable.isVerified,
          },
        })
        .from(patternMatch)
        .innerJoin(tradingAccount, eq(patternMatch.accountId, tradingAccount.id))
        .innerJoin(userTable, eq(tradingAccount.userId, userTable.id))
        .where(eq(patternMatch.patternFollowId, input.patternId))
        .orderBy(desc(patternMatch.matchScore));

      return matches;
    }),

  // Delete pattern follow
  deletePatternFollow: protectedProcedure
    .input(z.object({ patternId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      const pattern = await db
        .select()
        .from(patternFollow)
        .where(eq(patternFollow.id, input.patternId))
        .limit(1);

      if (!pattern[0] || pattern[0].userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await db.delete(patternFollow).where(eq(patternFollow.id, input.patternId));

      // Update count
      await db
        .update(userTable)
        .set({
          patternFollowsCount: sql`GREATEST(0, ${userTable.patternFollowsCount} - 1)`,
        })
        .where(eq(userTable.id, userId));

      return { success: true };
    }),

  // ============== MIRROR COMPARISON (PRIVATE) ==============

  // Create mirror comparison
  createMirrorComparison: protectedProcedure
    .input(
      z.object({
        myAccountId: z.string(),
        theirAccountId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      // Verify my account ownership
      const myAccount = await db
        .select({ userId: tradingAccount.userId })
        .from(tradingAccount)
        .where(eq(tradingAccount.id, input.myAccountId))
        .limit(1);

      if (!myAccount[0] || myAccount[0].userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your account" });
      }

      // Check their account is public
      const theirAccount = await db
        .select({
          socialOptIn: tradingAccount.socialOptIn,
          verificationLevel: tradingAccount.verificationLevel,
        })
        .from(tradingAccount)
        .where(eq(tradingAccount.id, input.theirAccountId))
        .limit(1);

      if (
        !theirAccount[0] ||
        !theirAccount[0].socialOptIn ||
        theirAccount[0].verificationLevel === "unverified"
      ) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Account not public" });
      }

      // TODO: Calculate comparison metrics
      // This would be a complex calculation comparing:
      // - Avg hold time
      // - RR capture efficiency
      // - Exit efficiency
      // - Protocol rate
      // For now, return placeholder

      const comparisonData = {
        avgHoldTime: { mine: 0, theirs: 0 },
        rrCaptureEfficiency: { mine: 0, theirs: 0 },
        exitEfficiency: { mine: 0, theirs: 0 },
        protocolRate: { mine: 0, theirs: 0 },
      };

      const comparison = await db
        .insert(mirrorComparison)
        .values({
          id: nanoid(),
          userId,
          myAccountId: input.myAccountId,
          theirAccountId: input.theirAccountId,
          comparisonData: comparisonData as any,
          insights: [],
        })
        .returning();

      return comparison[0];
    }),

  // Get my mirror comparisons
  getMyMirrorComparisons: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const comparisons = await db
      .select({
        comparison: mirrorComparison,
        myAccount: {
          id: tradingAccount.id,
          name: tradingAccount.name,
        },
        theirAccount: sql<{ id: string; name: string }>`NULL`, // Join separately
      })
      .from(mirrorComparison)
      .innerJoin(tradingAccount, eq(mirrorComparison.myAccountId, tradingAccount.id))
      .where(eq(mirrorComparison.userId, userId))
      .orderBy(desc(mirrorComparison.createdAt))
      .limit(20);

    return comparisons;
  }),

  getAnonymousBenchmark: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      const ownedAccount = await db
        .select({ id: tradingAccount.id })
        .from(tradingAccount)
        .where(
          and(
            eq(tradingAccount.id, input.accountId),
            eq(tradingAccount.userId, userId)
          )
        )
        .limit(1);

      if (!ownedAccount[0]) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Account not found" });
      }

      const closedTradeFilter = or(
        sql`${trade.closeTime} IS NOT NULL`,
        sql`${trade.close} IS NOT NULL`
      );

      const [userAggregateRows, userDailyRows, platformAggregateRows, platformDailyRows] =
        await Promise.all([
          db
            .select({
              accountId: trade.accountId,
              totalTrades: sql<number>`COUNT(*)`,
              wins: sql<number>`SUM(CASE WHEN CAST(${trade.profit} AS NUMERIC) > 0 THEN 1 ELSE 0 END)`,
              grossProfit: sql<number>`COALESCE(SUM(CASE WHEN CAST(${trade.profit} AS NUMERIC) > 0 THEN CAST(${trade.profit} AS NUMERIC) ELSE 0 END), 0)`,
              grossLoss: sql<number>`ABS(COALESCE(SUM(CASE WHEN CAST(${trade.profit} AS NUMERIC) < 0 THEN CAST(${trade.profit} AS NUMERIC) ELSE 0 END), 0))`,
              avgRR: sql<number>`COALESCE(AVG(CASE WHEN ${trade.realisedRR} IS NOT NULL THEN CAST(${trade.realisedRR} AS NUMERIC) END), 0)`,
            })
            .from(trade)
            .where(and(eq(trade.accountId, input.accountId), closedTradeFilter))
            .groupBy(trade.accountId),
          db
            .select({
              accountId: trade.accountId,
              dayProfit: sql<number>`COALESCE(SUM(CAST(${trade.profit} AS NUMERIC)), 0)`,
            })
            .from(trade)
            .where(and(eq(trade.accountId, input.accountId), sql`${trade.closeTime} IS NOT NULL`))
            .groupBy(trade.accountId, sql`DATE(${trade.closeTime})`),
          db
            .select({
              accountId: trade.accountId,
              totalTrades: sql<number>`COUNT(*)`,
              wins: sql<number>`SUM(CASE WHEN CAST(${trade.profit} AS NUMERIC) > 0 THEN 1 ELSE 0 END)`,
              grossProfit: sql<number>`COALESCE(SUM(CASE WHEN CAST(${trade.profit} AS NUMERIC) > 0 THEN CAST(${trade.profit} AS NUMERIC) ELSE 0 END), 0)`,
              grossLoss: sql<number>`ABS(COALESCE(SUM(CASE WHEN CAST(${trade.profit} AS NUMERIC) < 0 THEN CAST(${trade.profit} AS NUMERIC) ELSE 0 END), 0))`,
              avgRR: sql<number>`COALESCE(AVG(CASE WHEN ${trade.realisedRR} IS NOT NULL THEN CAST(${trade.realisedRR} AS NUMERIC) END), 0)`,
            })
            .from(trade)
            .innerJoin(tradingAccount, eq(trade.accountId, tradingAccount.id))
            .where(
              and(
                closedTradeFilter,
                eq(tradingAccount.socialOptIn, true),
                ne(tradingAccount.verificationLevel, "unverified")
              )
            )
            .groupBy(trade.accountId),
          db
            .select({
              accountId: trade.accountId,
              dayProfit: sql<number>`COALESCE(SUM(CAST(${trade.profit} AS NUMERIC)), 0)`,
            })
            .from(trade)
            .innerJoin(tradingAccount, eq(trade.accountId, tradingAccount.id))
            .where(
              and(
                sql`${trade.closeTime} IS NOT NULL`,
                eq(tradingAccount.socialOptIn, true),
                ne(tradingAccount.verificationLevel, "unverified")
              )
            )
            .groupBy(trade.accountId, sql`DATE(${trade.closeTime})`),
        ]);

      const userConsistencyMap = buildDailyConsistencyMap(userDailyRows);
      const userAggregate = userAggregateRows[0];
      const userMetrics: AnonymousBenchmarkMetrics = {
        totalTrades: Number(userAggregate?.totalTrades ?? 0),
        winRate:
          Number(userAggregate?.totalTrades ?? 0) > 0
            ? (Number(userAggregate?.wins ?? 0) / Number(userAggregate?.totalTrades ?? 0)) * 100
            : 0,
        profitFactor: normalizeProfitFactor(
          Number(userAggregate?.grossProfit ?? 0),
          Number(userAggregate?.grossLoss ?? 0)
        ),
        avgRR: Number(userAggregate?.avgRR ?? 0),
        consistency: userConsistencyMap.get(input.accountId) ?? 0,
      };

      if (userMetrics.totalTrades < 5) {
        return {
          populationSize: 0,
          minTradesRequired: ANONYMOUS_BENCHMARK_MIN_TRADES,
          user: userMetrics,
          metrics: null,
        };
      }

      const platformConsistencyMap = buildDailyConsistencyMap(platformDailyRows);
      const platformMetrics = platformAggregateRows
        .map((row) => {
          const totalTrades = Number(row.totalTrades ?? 0);
          return {
            accountId: row.accountId,
            totalTrades,
            winRate: totalTrades > 0 ? (Number(row.wins ?? 0) / totalTrades) * 100 : 0,
            profitFactor: normalizeProfitFactor(
              Number(row.grossProfit ?? 0),
              Number(row.grossLoss ?? 0)
            ),
            avgRR: Number(row.avgRR ?? 0),
            consistency: platformConsistencyMap.get(row.accountId) ?? 0,
          };
        })
        .filter((row) => row.totalTrades >= ANONYMOUS_BENCHMARK_MIN_TRADES);

      if (platformMetrics.length === 0) {
        return {
          populationSize: 0,
          minTradesRequired: ANONYMOUS_BENCHMARK_MIN_TRADES,
          user: userMetrics,
          metrics: null,
        };
      }

      const metricValues = {
        winRate: platformMetrics.map((row) => row.winRate),
        profitFactor: platformMetrics.map((row) => row.profitFactor),
        avgRR: platformMetrics.map((row) => row.avgRR),
        consistency: platformMetrics.map((row) => row.consistency),
      };

      return {
        populationSize: platformMetrics.length,
        minTradesRequired: ANONYMOUS_BENCHMARK_MIN_TRADES,
        user: userMetrics,
        metrics: {
          winRate: {
            p25: quantile(metricValues.winRate, 0.25),
            p50: quantile(metricValues.winRate, 0.5),
            p75: quantile(metricValues.winRate, 0.75),
            p90: quantile(metricValues.winRate, 0.9),
            percentile: getPercentileRank(userMetrics.winRate, metricValues.winRate),
          },
          profitFactor: {
            p25: quantile(metricValues.profitFactor, 0.25),
            p50: quantile(metricValues.profitFactor, 0.5),
            p75: quantile(metricValues.profitFactor, 0.75),
            p90: quantile(metricValues.profitFactor, 0.9),
            percentile: getPercentileRank(userMetrics.profitFactor, metricValues.profitFactor),
          },
          avgRR: {
            p25: quantile(metricValues.avgRR, 0.25),
            p50: quantile(metricValues.avgRR, 0.5),
            p75: quantile(metricValues.avgRR, 0.75),
            p90: quantile(metricValues.avgRR, 0.9),
            percentile: getPercentileRank(userMetrics.avgRR, metricValues.avgRR),
          },
          consistency: {
            p25: quantile(metricValues.consistency, 0.25),
            p50: quantile(metricValues.consistency, 0.5),
            p75: quantile(metricValues.consistency, 0.75),
            p90: quantile(metricValues.consistency, 0.9),
            percentile: getPercentileRank(userMetrics.consistency, metricValues.consistency),
          },
        },
        labels: {
          winRate: getBenchmarkLabel(getPercentileRank(userMetrics.winRate, metricValues.winRate)),
          profitFactor: getBenchmarkLabel(
            getPercentileRank(userMetrics.profitFactor, metricValues.profitFactor)
          ),
          avgRR: getBenchmarkLabel(getPercentileRank(userMetrics.avgRR, metricValues.avgRR)),
          consistency: getBenchmarkLabel(
            getPercentileRank(userMetrics.consistency, metricValues.consistency)
          ),
        },
      };
    }),

  // ============== LEADERBOARDS ==============

  // Get leaderboard
  getLeaderboard: publicProcedure
    .input(
      z.object({
        category: z.enum(["consistency", "execution", "discipline", "risk"]),
        period: z.enum(["30d", "90d", "all_time"]).default("30d"),
        limit: z.number().min(1).max(100).default(50),
        filters: z
          .object({
            propFirmId: z.string().optional(),
            sessionTag: z.string().optional(),
            symbol: z.string().optional(),
          })
          .optional(),
      })
    )
    .query(async ({ input }) => {
      // Calculate period start
      const now = new Date();
      let periodStart: string;

      switch (input.period) {
        case "30d":
          periodStart = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - 30
          )
            .toISOString()
            .slice(0, 10);
          break;
        case "90d":
          periodStart = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - 90
          )
            .toISOString()
            .slice(0, 10);
          break;
        case "all_time":
          periodStart = "2000-01-01";
          break;
      }

      const entries = await db
        .select({
          entry: leaderboardEntry,
          account: {
            id: tradingAccount.id,
            name: tradingAccount.name,
            verificationLevel: tradingAccount.verificationLevel,
          },
          owner: {
            username: userTable.username,
            isVerified: userTable.isVerified,
            verifiedSince: userTable.verifiedSince,
            totalVerifiedTrades: userTable.totalVerifiedTrades,
          },
        })
        .from(leaderboardEntry)
        .innerJoin(tradingAccount, eq(leaderboardEntry.accountId, tradingAccount.id))
        .innerJoin(userTable, eq(leaderboardEntry.userId, userTable.id))
        .where(
          and(
            eq(leaderboardEntry.category, input.category),
            eq(leaderboardEntry.period, input.period),
            gte(leaderboardEntry.periodStart, periodStart),
            eq(leaderboardEntry.sampleValid, true),
            input.filters?.propFirmId
              ? eq(leaderboardEntry.propFirmId, input.filters.propFirmId)
              : undefined,
            input.filters?.sessionTag
              ? eq(leaderboardEntry.sessionTag, input.filters.sessionTag)
              : undefined,
            input.filters?.symbol
              ? eq(leaderboardEntry.symbol, input.filters.symbol)
              : undefined
          )
        )
        .orderBy(asc(leaderboardEntry.percentile))
        .limit(input.limit);

      return entries;
    }),

  // Get my leaderboard position
  getMyLeaderboardPosition: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        category: z.enum(["consistency", "execution", "discipline", "risk"]),
        period: z.enum(["30d", "90d", "all_time"]).default("30d"),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      // Verify account ownership
      const account = await db
        .select({ userId: tradingAccount.userId })
        .from(tradingAccount)
        .where(eq(tradingAccount.id, input.accountId))
        .limit(1);

      if (!account[0] || account[0].userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const now = new Date();
      let periodStart: string;

      switch (input.period) {
        case "30d":
          periodStart = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - 30
          )
            .toISOString()
            .slice(0, 10);
          break;
        case "90d":
          periodStart = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - 90
          )
            .toISOString()
            .slice(0, 10);
          break;
        case "all_time":
          periodStart = "2000-01-01";
          break;
      }

      const entry = await db
        .select()
        .from(leaderboardEntry)
        .where(
          and(
            eq(leaderboardEntry.accountId, input.accountId),
            eq(leaderboardEntry.category, input.category),
            eq(leaderboardEntry.period, input.period),
            gte(leaderboardEntry.periodStart, periodStart)
          )
        )
        .limit(1);

      return entry[0] || null;
    }),

  // ============== ACCOUNT SETTINGS ==============

  // Toggle account social opt-in
  toggleAccountSocial: protectedProcedure
    .input(
      z.object({
        accountId: z.string(),
        optIn: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      // Verify account ownership
      const account = await db
        .select({
          userId: tradingAccount.userId,
          verificationLevel: tradingAccount.verificationLevel,
        })
        .from(tradingAccount)
        .where(eq(tradingAccount.id, input.accountId))
        .limit(1);

      if (!account[0] || account[0].userId !== userId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Cannot opt-in unverified accounts
      if (input.optIn && account[0].verificationLevel === "unverified") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only verified accounts can be made public",
        });
      }

      const updates: any = {
        socialOptIn: input.optIn,
      };

      if (input.optIn && !account[0].verificationLevel) {
        updates.socialVisibleSince = new Date();
      }

      await db
        .update(tradingAccount)
        .set(updates)
        .where(eq(tradingAccount.id, input.accountId));

      return { success: true };
    }),

  // ============== BOOKMARKS (PRIVATE FEATURE) ==============

  // Toggle bookmark
  toggleBookmark: protectedProcedure
    .input(
      z.object({
        contentType: z.enum(["feed_event", "trade", "account"]),
        contentId: z.string(),
        folder: z.string().optional(),
        notes: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      const existing = await db
        .select()
        .from(bookmark)
        .where(
          and(
            eq(bookmark.userId, userId),
            eq(bookmark.contentType, input.contentType),
            eq(bookmark.contentId, input.contentId)
          )
        )
        .limit(1);

      if (existing[0]) {
        // Remove bookmark
        await db
          .delete(bookmark)
          .where(
            and(
              eq(bookmark.userId, userId),
              eq(bookmark.contentType, input.contentType),
              eq(bookmark.contentId, input.contentId)
            )
          );

        return { bookmarked: false };
      } else {
        // Add bookmark
        await db.insert(bookmark).values({
          id: nanoid(),
          userId,
          contentType: input.contentType,
          contentId: input.contentId,
          folder: input.folder,
          notes: input.notes,
        });

        return { bookmarked: true };
      }
    }),

  // List bookmarks
  listMyBookmarks: protectedProcedure
    .input(
      z.object({
        contentType: z.enum(["feed_event", "trade", "account"]).optional(),
        folder: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      const bookmarks = await db
        .select()
        .from(bookmark)
        .where(
          and(
            eq(bookmark.userId, userId),
            input.contentType ? eq(bookmark.contentType, input.contentType) : undefined,
            input.folder ? eq(bookmark.folder, input.folder) : undefined
          )
        )
        .orderBy(desc(bookmark.createdAt));

      return bookmarks;
    }),
});
