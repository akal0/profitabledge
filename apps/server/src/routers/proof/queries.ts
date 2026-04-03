import { TRPCError } from "@trpc/server";
import {
  and,
  desc,
  eq,
  inArray,
  lt,
  max,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { z } from "zod";

import { db } from "../../db";
import { user as userTable } from "../../db/schema/auth";
import { notification } from "../../db/schema/notifications";
import {
  publicAccountShare,
  tradingAccount,
  trade,
  tradeTrustEvent,
} from "../../db/schema/trading";
import { listPublicProofLiveTrades } from "../../lib/public-proof/live-trades";
import { buildPublicProofPageData } from "../../lib/public-proof/page-data";
import type { StoredProfileEffects } from "../../lib/profile-effects";
import { issuePublicProofVerification } from "../../lib/verification/share-verification";
import {
  getTradeOriginLabel,
  resolveTradeOriginType,
} from "../../lib/public-proof/trust";
import { protectedProcedure, publicProcedure } from "../../lib/trpc";
import {
  ensureOwnedProofAccount,
  getPublicProofAffiliateState,
  getLatestOwnedPublicShare,
  getProofOwnerIdentity,
  resolveActivePublicShareOrThrow,
  serializeOwnedSharePath,
} from "./shared";

function parseNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toSortAtISO(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime())
    ? new Date(0).toISOString()
    : parsed.toISOString();
}

async function getOwnedProofContext(userId: string, accountId: string) {
  await ensureOwnedProofAccount(userId, accountId);

  const [account] = await db
    .select({
      id: tradingAccount.id,
      userId: tradingAccount.userId,
      accountName: tradingAccount.name,
      broker: tradingAccount.broker,
      brokerType: tradingAccount.brokerType,
      brokerServer: tradingAccount.brokerServer,
      accountNumber: tradingAccount.accountNumber,
      preferredDataSource: tradingAccount.preferredDataSource,
      verificationLevel: tradingAccount.verificationLevel,
      isVerified: tradingAccount.isVerified,
      lastSyncedAt: tradingAccount.lastSyncedAt,
      initialBalance: tradingAccount.initialBalance,
      initialCurrency: tradingAccount.initialCurrency,
      createdAt: tradingAccount.createdAt,
      username: userTable.username,
      traderName: userTable.name,
      traderImage: userTable.image,
      traderBannerUrl: userTable.profileBannerUrl,
      traderBannerPosition: userTable.profileBannerPosition,
      traderProfileEffects: userTable.profileEffects,
    })
    .from(tradingAccount)
    .innerJoin(userTable, eq(userTable.id, tradingAccount.userId))
    .where(
      and(
        eq(tradingAccount.id, accountId),
        eq(tradingAccount.userId, userId)
      )
    )
    .limit(1);

  if (!account) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Account not found",
    });
  }

  const latestShare = await getLatestOwnedPublicShare(accountId);
  const auditStartsAt = latestShare?.createdAt ?? account.createdAt;
  const fallbackUsername = account.username ?? account.userId;
  const fallbackSlug = latestShare?.publicAccountSlug ?? account.id;

  return {
    account,
    auditStartsAt,
    latestShare,
    shareLike: {
      accountId: account.id,
      accountName: account.accountName,
      broker: account.broker,
      brokerType: account.brokerType,
      brokerServer: account.brokerServer,
      accountNumber: account.accountNumber,
      preferredDataSource: account.preferredDataSource,
      createdAt: auditStartsAt,
      traderName: account.traderName,
      traderImage: account.traderImage ?? null,
      traderBannerUrl: account.traderBannerUrl ?? null,
      traderBannerPosition: account.traderBannerPosition ?? null,
      traderProfileEffects: (account.traderProfileEffects ?? null) as
        | StoredProfileEffects
        | null,
      verificationLevel: account.verificationLevel,
      isVerified: account.isVerified,
      lastSyncedAt: account.lastSyncedAt ?? null,
      initialBalance: account.initialBalance,
      initialCurrency: account.initialCurrency,
    },
    username: fallbackUsername,
    publicAccountSlug: fallbackSlug,
    publicPath:
      latestShare?.publicAccountSlug && account.username
        ? serializeOwnedSharePath(account.username, latestShare.publicAccountSlug)
        : null,
  };
}

const publicShareCursorSchema = z
  .object({
    sortAtISO: z.string(),
    id: z.string(),
  })
  .optional();

export const proofQueryProcedures = {
  getOwnedShareStatus: protectedProcedure
    .input(z.object({ accountId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await ensureOwnedProofAccount(ctx.session.user.id, input.accountId);
      const owner = await getProofOwnerIdentity(ctx.session.user.id);
      const latestShare = await getLatestOwnedPublicShare(input.accountId);

      return {
        username: owner.username,
        canCreate: Boolean(owner.username),
        activeShare:
          latestShare && latestShare.isActive
            ? {
                id: latestShare.id,
                publicAccountSlug: latestShare.publicAccountSlug,
                createdAt: latestShare.createdAt,
                updatedAt: latestShare.updatedAt,
                viewCount: latestShare.viewCount,
                lastViewedAt: latestShare.lastViewedAt,
                path:
                  owner.username != null
                    ? serializeOwnedSharePath(
                        owner.username,
                        latestShare.publicAccountSlug
                      )
                    : null,
              }
            : null,
        lastShare:
          latestShare && !latestShare.isActive
            ? {
                id: latestShare.id,
                publicAccountSlug: latestShare.publicAccountSlug,
                revokedAt: latestShare.revokedAt,
              }
            : null,
      };
    }),

  getOwnedPage: protectedProcedure
    .input(z.object({ accountId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const context = await getOwnedProofContext(
        ctx.session.user.id,
        input.accountId
      );

      const [lastImportedRow, tradeRows, liveTradeRows, editedSummary, removedSummary] =
        await Promise.all([
          db
            .select({
              lastImportedAt: max(notification.createdAt),
            })
            .from(notification)
            .where(
              and(
                eq(notification.accountId, input.accountId),
                eq(notification.type, "trade_imported")
              )
            ),
          db
            .select({
              id: trade.id,
              symbol: trade.symbol,
              profit: trade.profit,
              outcome: trade.outcome,
              plannedRR: trade.plannedRR,
              realisedRR: trade.realisedRR,
              openTime: trade.openTime,
              closeTime: trade.closeTime,
              createdAt: trade.createdAt,
              originType: trade.originType,
              brokerMeta: trade.brokerMeta,
              ticket: trade.ticket,
              useBrokerData: trade.useBrokerData,
            })
            .from(trade)
            .where(eq(trade.accountId, input.accountId))
            .orderBy(desc(trade.createdAt)),
          listPublicProofLiveTrades({
            accountId: input.accountId,
          }),
          db
            .select({
              count: sql<number>`COUNT(DISTINCT ${tradeTrustEvent.tradeId})`,
            })
            .from(tradeTrustEvent)
            .where(
              and(
                eq(tradeTrustEvent.accountId, input.accountId),
                eq(tradeTrustEvent.eventType, "update"),
                sql`${tradeTrustEvent.createdAt} >= ${context.auditStartsAt}`
              )
            ),
          db
            .select({
              count: sql<number>`COUNT(DISTINCT ${tradeTrustEvent.tradeId})`,
            })
            .from(tradeTrustEvent)
            .where(
              and(
                eq(tradeTrustEvent.accountId, input.accountId),
                eq(tradeTrustEvent.eventType, "delete"),
                inArray(tradeTrustEvent.originType, [
                  "broker_sync",
                  "csv_import",
                ]),
                sql`${tradeTrustEvent.createdAt} >= ${context.auditStartsAt}`
              )
            ),
        ]);

      return {
        ...buildPublicProofPageData({
          share: context.shareLike,
          username: context.username,
          publicAccountSlug: context.publicAccountSlug,
          lastImportedAt: lastImportedRow[0]?.lastImportedAt ?? null,
          storedTradeRows: tradeRows.map((row) => ({
            ...row,
            brokerMeta: row.brokerMeta as Record<string, unknown> | null,
          })),
          liveTradeRows,
          editedTradesCount: Number(editedSummary[0]?.count ?? 0),
          removedTradesCount: Number(removedSummary[0]?.count ?? 0),
        }),
        publicPath: context.publicPath,
        hasPublicShare: Boolean(context.latestShare?.isActive),
      };
    }),

  getPublicPage: publicProcedure
    .input(
      z.object({
        username: z.string().min(1),
        publicAccountSlug: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const share = await resolveActivePublicShareOrThrow(input);

      await db
        .update(publicAccountShare)
        .set({
          viewCount: sql`${publicAccountShare.viewCount} + 1`,
          lastViewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(publicAccountShare.id, share.id));

      const [
        lastImportedRow,
        tradeRows,
        liveTradeRows,
        editedSummary,
        removedSummary,
        affiliate,
      ] = await Promise.all([
        db
          .select({
            lastImportedAt: max(notification.createdAt),
          })
          .from(notification)
          .where(
            and(
              eq(notification.accountId, share.accountId),
              eq(notification.type, "trade_imported")
            )
          ),
        db
          .select({
            id: trade.id,
            symbol: trade.symbol,
            profit: trade.profit,
            outcome: trade.outcome,
            plannedRR: trade.plannedRR,
            realisedRR: trade.realisedRR,
            openTime: trade.openTime,
            closeTime: trade.closeTime,
            createdAt: trade.createdAt,
            originType: trade.originType,
            brokerMeta: trade.brokerMeta,
            ticket: trade.ticket,
            useBrokerData: trade.useBrokerData,
          })
          .from(trade)
          .where(eq(trade.accountId, share.accountId))
          .orderBy(desc(trade.createdAt)),
        listPublicProofLiveTrades({
          accountId: share.accountId,
        }),
        db
          .select({
            count: sql<number>`COUNT(DISTINCT ${tradeTrustEvent.tradeId})`,
          })
          .from(tradeTrustEvent)
          .where(
            and(
              eq(tradeTrustEvent.accountId, share.accountId),
              eq(tradeTrustEvent.eventType, "update"),
              sql`${tradeTrustEvent.createdAt} >= ${share.createdAt}`
            )
          ),
        db
          .select({
            count: sql<number>`COUNT(DISTINCT ${tradeTrustEvent.tradeId})`,
          })
          .from(tradeTrustEvent)
          .where(
            and(
              eq(tradeTrustEvent.accountId, share.accountId),
              eq(tradeTrustEvent.eventType, "delete"),
              inArray(tradeTrustEvent.originType, [
                "broker_sync",
                "csv_import",
              ]),
              sql`${tradeTrustEvent.createdAt} >= ${share.createdAt}`
            )
          ),
        getPublicProofAffiliateState(share.userId),
      ]);
      return {
        ...buildPublicProofPageData({
          share,
          username: input.username,
          publicAccountSlug: input.publicAccountSlug,
          lastImportedAt: lastImportedRow[0]?.lastImportedAt ?? null,
          storedTradeRows: tradeRows.map((row) => ({
            ...row,
            brokerMeta: row.brokerMeta as Record<string, unknown> | null,
          })),
          liveTradeRows,
          editedTradesCount: Number(editedSummary[0]?.count ?? 0),
          removedTradesCount: Number(removedSummary[0]?.count ?? 0),
        }),
        verification: issuePublicProofVerification({
          shareId: share.id,
          username: input.username,
          publicAccountSlug: input.publicAccountSlug,
          accountName: share.accountName,
          broker: share.broker,
        }),
        affiliate,
      };
    }),

  listOwnedTradesInfinite: protectedProcedure
    .input(
      z.object({
        accountId: z.string().min(1),
        limit: z.number().min(1).max(100).default(50),
        cursor: publicShareCursorSchema,
        q: z.string().trim().optional(),
        startISO: z.string().optional(),
        endISO: z.string().optional(),
        outcomes: z.array(z.enum(["Win", "Loss", "BE", "PW"])).optional(),
        originTypes: z
          .array(z.enum(["broker_sync", "csv_import", "manual_entry"]))
          .optional(),
        statuses: z.array(z.enum(["live", "closed"])).optional(),
        editedOnly: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const context = await getOwnedProofContext(
        ctx.session.user.id,
        input.accountId
      );
      const includeLiveRows = !input.cursor;
      const liveRows = includeLiveRows
        ? await listPublicProofLiveTrades({
            accountId: input.accountId,
            q: input.q,
            originTypes: input.originTypes,
            statuses: input.statuses,
          })
        : [];

      if (input.statuses?.length === 1 && input.statuses[0] === "live") {
        return {
          items: liveRows.slice(0, input.limit),
          nextCursor: undefined,
        };
      }

      const tradeSortTimestamp = sql<Date>`COALESCE(${trade.closeTime}, ${trade.openTime}, ${trade.createdAt})`;
      const whereClauses: SQL[] = [eq(trade.accountId, input.accountId)];

      if (input.cursor) {
        const cursorDate = new Date(input.cursor.sortAtISO);
        whereClauses.push(
          or(
            sql`${tradeSortTimestamp} < ${cursorDate}`,
            and(
              sql`${tradeSortTimestamp} = ${cursorDate}`,
              lt(trade.id, input.cursor.id)
            )
          )!
        );
      }

      if (input.startISO) {
        whereClauses.push(
          sql`COALESCE(${trade.closeTime}, ${trade.openTime}, ${
            trade.createdAt
          }) >= ${new Date(input.startISO)}`
        );
      }

      if (input.endISO) {
        whereClauses.push(
          sql`COALESCE(${trade.closeTime}, ${trade.openTime}, ${
            trade.createdAt
          }) <= ${new Date(input.endISO)}`
        );
      }

      if (input.outcomes?.length) {
        whereClauses.push(inArray(trade.outcome, input.outcomes));
      }

      if (input.originTypes?.length) {
        whereClauses.push(inArray(trade.originType, input.originTypes));
      }

      if (input.statuses?.length === 1 && input.statuses[0] === "closed") {
        whereClauses.push(sql`${trade.closeTime} IS NOT NULL`);
      }

      if (input.editedOnly) {
        whereClauses.push(
          sql`EXISTS (
            SELECT 1
            FROM ${tradeTrustEvent}
            WHERE ${tradeTrustEvent.tradeId} = ${trade.id}
              AND ${tradeTrustEvent.accountId} = ${input.accountId}
              AND ${tradeTrustEvent.eventType} = 'update'
              AND ${tradeTrustEvent.createdAt} >= ${context.auditStartsAt}
          )`
        );
      }

      if (input.q) {
        const searchTerm = `%${input.q.toLowerCase()}%`;
        whereClauses.push(
          sql`(
            LOWER(COALESCE(${trade.symbol}, '')) LIKE ${searchTerm}
            OR LOWER(COALESCE(${trade.tradeType}, '')) LIKE ${searchTerm}
            OR LOWER(COALESCE(${trade.outcome}, '')) LIKE ${searchTerm}
            OR LOWER(COALESCE(${trade.originLabel}, '')) LIKE ${searchTerm}
            OR LOWER(CASE WHEN ${trade.closeTime} IS NULL THEN 'live open' ELSE 'closed' END) LIKE ${searchTerm}
          )`
        );
      }

      const remainingSlots = Math.max(input.limit - liveRows.length, 0);
      const closedQueryLimit = remainingSlots > 0 ? remainingSlots + 1 : 0;
      const rows =
        closedQueryLimit > 0
          ? await db
              .select({
                id: trade.id,
                symbol: trade.symbol,
                tradeType: trade.tradeType,
                volume: sql<number | null>`CAST(${trade.volume} AS NUMERIC)`,
                openPrice: sql<number | null>`CAST(${trade.openPrice} AS NUMERIC)`,
                closePrice: sql<number | null>`CAST(${trade.closePrice} AS NUMERIC)`,
                profit: sql<number | null>`CAST(${trade.profit} AS NUMERIC)`,
                commissions: sql<number | null>`CAST(${trade.commissions} AS NUMERIC)`,
                swap: sql<number | null>`CAST(${trade.swap} AS NUMERIC)`,
                realisedRR: sql<number | null>`CAST(${trade.realisedRR} AS NUMERIC)`,
                plannedRR: sql<number | null>`CAST(${trade.plannedRR} AS NUMERIC)`,
                openTime: trade.openTime,
                closeTime: trade.closeTime,
                createdAt: trade.createdAt,
                sortAt: tradeSortTimestamp,
                outcome: trade.outcome,
                tradeDurationSeconds: trade.tradeDurationSeconds,
                originType: trade.originType,
                originLabel: trade.originLabel,
                ticket: trade.ticket,
                useBrokerData: trade.useBrokerData,
                brokerMeta: trade.brokerMeta,
              })
              .from(trade)
              .where(and(...whereClauses))
              .orderBy(desc(tradeSortTimestamp), desc(trade.id))
              .limit(closedQueryLimit)
          : [];

      const hasMore = rows.length > remainingSlots;
      const pageRows = hasMore ? rows.slice(0, remainingSlots) : rows;
      const pageTradeIds = pageRows.map((row) => row.id);

      const editedRows =
        pageTradeIds.length > 0
          ? await db
              .select({
                tradeId: tradeTrustEvent.tradeId,
              })
              .from(tradeTrustEvent)
              .where(
                and(
                  eq(tradeTrustEvent.accountId, input.accountId),
                  eq(tradeTrustEvent.eventType, "update"),
                  inArray(tradeTrustEvent.tradeId, pageTradeIds),
                  sql`${tradeTrustEvent.createdAt} >= ${context.auditStartsAt}`
                )
              )
          : [];

      const editedTradeIds = new Set(
        editedRows
          .map((row) => row.tradeId)
          .filter((value): value is string => typeof value === "string")
      );

      return {
        items: [
          ...liveRows,
          ...pageRows.map((row) => {
            const originType = resolveTradeOriginType({
              originType: row.originType,
              brokerMeta: row.brokerMeta as Record<string, unknown> | null,
              ticket: row.ticket,
              useBrokerData: row.useBrokerData,
              accountVerificationLevel: context.shareLike.verificationLevel,
              accountIsVerified: context.shareLike.isVerified,
            });
            return {
              id: row.id,
              symbol: row.symbol,
              tradeType: row.tradeType,
              volume: row.volume,
              openPrice: row.openPrice,
              closePrice: row.closePrice,
              profit: row.profit,
              commissions: row.commissions,
              swap: row.swap,
              rr:
                row.realisedRR != null &&
                Number.isFinite(Number(row.realisedRR))
                  ? Number(row.realisedRR)
                  : row.plannedRR != null &&
                    Number.isFinite(Number(row.plannedRR))
                  ? Number(row.plannedRR)
                  : null,
              outcome: row.outcome,
              openTime: row.openTime,
              closeTime: row.closeTime,
              createdAt: row.createdAt,
              isLive: row.closeTime == null,
              durationSeconds: parseNumber(row.tradeDurationSeconds),
              originType,
              originLabel: row.originLabel || getTradeOriginLabel(originType),
              edited: editedTradeIds.has(row.id),
            };
          }),
        ],
        nextCursor: hasMore
          ? {
              sortAtISO: toSortAtISO(pageRows[pageRows.length - 1]!.sortAt),
              id: pageRows[pageRows.length - 1]!.id,
            }
          : undefined,
      };
    }),

  listPublicTradesInfinite: publicProcedure
    .input(
      z.object({
        username: z.string().min(1),
        publicAccountSlug: z.string().min(1),
        limit: z.number().min(1).max(100).default(50),
        cursor: publicShareCursorSchema,
        q: z.string().trim().optional(),
        startISO: z.string().optional(),
        endISO: z.string().optional(),
        outcomes: z.array(z.enum(["Win", "Loss", "BE", "PW"])).optional(),
        originTypes: z
          .array(z.enum(["broker_sync", "csv_import", "manual_entry"]))
          .optional(),
        statuses: z.array(z.enum(["live", "closed"])).optional(),
        editedOnly: z.boolean().optional(),
      })
    )
    .query(async ({ input }) => {
      const share = await resolveActivePublicShareOrThrow(input);
      const includeLiveRows = !input.cursor;
      const liveRows = includeLiveRows
        ? await listPublicProofLiveTrades({
            accountId: share.accountId,
            q: input.q,
            originTypes: input.originTypes,
            statuses: input.statuses,
          })
        : [];

      if (input.statuses?.length === 1 && input.statuses[0] === "live") {
        return {
          items: liveRows.slice(0, input.limit),
          nextCursor: undefined,
        };
      }

      const tradeSortTimestamp = sql<Date>`COALESCE(${trade.closeTime}, ${trade.openTime}, ${trade.createdAt})`;
      const whereClauses: SQL[] = [eq(trade.accountId, share.accountId)];

      if (input.cursor) {
        const cursorDate = new Date(input.cursor.sortAtISO);
        whereClauses.push(
          or(
            sql`${tradeSortTimestamp} < ${cursorDate}`,
            and(
              sql`${tradeSortTimestamp} = ${cursorDate}`,
              lt(trade.id, input.cursor.id)
            )
          )!
        );
      }

      if (input.startISO) {
        whereClauses.push(
          sql`COALESCE(${trade.closeTime}, ${trade.openTime}, ${
            trade.createdAt
          }) >= ${new Date(input.startISO)}`
        );
      }

      if (input.endISO) {
        whereClauses.push(
          sql`COALESCE(${trade.closeTime}, ${trade.openTime}, ${
            trade.createdAt
          }) <= ${new Date(input.endISO)}`
        );
      }

      if (input.outcomes?.length) {
        whereClauses.push(inArray(trade.outcome, input.outcomes));
      }

      if (input.originTypes?.length) {
        whereClauses.push(inArray(trade.originType, input.originTypes));
      }

      if (input.statuses?.length === 1 && input.statuses[0] === "closed") {
        whereClauses.push(sql`${trade.closeTime} IS NOT NULL`);
      }

      if (input.editedOnly) {
        whereClauses.push(
          sql`EXISTS (
            SELECT 1
            FROM ${tradeTrustEvent}
            WHERE ${tradeTrustEvent.tradeId} = ${trade.id}
              AND ${tradeTrustEvent.accountId} = ${share.accountId}
              AND ${tradeTrustEvent.eventType} = 'update'
              AND ${tradeTrustEvent.createdAt} >= ${share.createdAt}
          )`
        );
      }

      if (input.q) {
        const searchTerm = `%${input.q.toLowerCase()}%`;
        whereClauses.push(
          sql`(
            LOWER(COALESCE(${trade.symbol}, '')) LIKE ${searchTerm}
            OR LOWER(COALESCE(${trade.tradeType}, '')) LIKE ${searchTerm}
            OR LOWER(COALESCE(${trade.outcome}, '')) LIKE ${searchTerm}
            OR LOWER(COALESCE(${trade.originLabel}, '')) LIKE ${searchTerm}
            OR LOWER(CASE WHEN ${trade.closeTime} IS NULL THEN 'live open' ELSE 'closed' END) LIKE ${searchTerm}
          )`
        );
      }

      const remainingSlots = Math.max(input.limit - liveRows.length, 0);
      const closedQueryLimit = remainingSlots > 0 ? remainingSlots + 1 : 0;
      const rows =
        closedQueryLimit > 0
          ? await db
              .select({
                id: trade.id,
                symbol: trade.symbol,
                tradeType: trade.tradeType,
                volume: sql<number | null>`CAST(${trade.volume} AS NUMERIC)`,
                openPrice: sql<
                  number | null
                >`CAST(${trade.openPrice} AS NUMERIC)`,
                closePrice: sql<
                  number | null
                >`CAST(${trade.closePrice} AS NUMERIC)`,
                profit: sql<number | null>`CAST(${trade.profit} AS NUMERIC)`,
                commissions: sql<
                  number | null
                >`CAST(${trade.commissions} AS NUMERIC)`,
                swap: sql<number | null>`CAST(${trade.swap} AS NUMERIC)`,
                realisedRR: sql<
                  number | null
                >`CAST(${trade.realisedRR} AS NUMERIC)`,
                plannedRR: sql<
                  number | null
                >`CAST(${trade.plannedRR} AS NUMERIC)`,
                openTime: trade.openTime,
                closeTime: trade.closeTime,
                createdAt: trade.createdAt,
                sortAt: tradeSortTimestamp,
                outcome: trade.outcome,
                tradeDurationSeconds: trade.tradeDurationSeconds,
                originType: trade.originType,
                originLabel: trade.originLabel,
                ticket: trade.ticket,
                useBrokerData: trade.useBrokerData,
                brokerMeta: trade.brokerMeta,
              })
              .from(trade)
              .where(and(...whereClauses))
              .orderBy(desc(tradeSortTimestamp), desc(trade.id))
              .limit(closedQueryLimit)
          : [];

      const hasMore = rows.length > remainingSlots;
      const pageRows = hasMore ? rows.slice(0, remainingSlots) : rows;
      const pageTradeIds = pageRows.map((row) => row.id);

      const editedRows =
        pageTradeIds.length > 0
          ? await db
              .select({
                tradeId: tradeTrustEvent.tradeId,
              })
              .from(tradeTrustEvent)
              .where(
                and(
                  eq(tradeTrustEvent.accountId, share.accountId),
                  eq(tradeTrustEvent.eventType, "update"),
                  inArray(tradeTrustEvent.tradeId, pageTradeIds),
                  sql`${tradeTrustEvent.createdAt} >= ${share.createdAt}`
                )
              )
          : [];

      const editedTradeIds = new Set(
        editedRows
          .map((row) => row.tradeId)
          .filter((value): value is string => typeof value === "string")
      );

      return {
        items: [
          ...liveRows,
          ...pageRows.map((row) => {
            const originType = resolveTradeOriginType({
              originType: row.originType,
              brokerMeta: row.brokerMeta as Record<string, unknown> | null,
              ticket: row.ticket,
              useBrokerData: row.useBrokerData,
              accountVerificationLevel: share.verificationLevel,
              accountIsVerified: share.isVerified,
            });
            return {
              id: row.id,
              symbol: row.symbol,
              tradeType: row.tradeType,
              volume: row.volume,
              openPrice: row.openPrice,
              closePrice: row.closePrice,
              profit: row.profit,
              commissions: row.commissions,
              swap: row.swap,
              rr:
                row.realisedRR != null &&
                Number.isFinite(Number(row.realisedRR))
                  ? Number(row.realisedRR)
                  : row.plannedRR != null &&
                    Number.isFinite(Number(row.plannedRR))
                  ? Number(row.plannedRR)
                  : null,
              outcome: row.outcome,
              openTime: row.openTime,
              closeTime: row.closeTime,
              createdAt: row.createdAt,
              isLive: row.closeTime == null,
              durationSeconds: parseNumber(row.tradeDurationSeconds),
              originType,
              originLabel: row.originLabel || getTradeOriginLabel(originType),
              edited: editedTradeIds.has(row.id),
            };
          }),
        ],
        nextCursor: hasMore
          ? {
              sortAtISO: toSortAtISO(pageRows[pageRows.length - 1]!.sortAt),
              id: pageRows[pageRows.length - 1]!.id,
            }
          : undefined,
      };
    }),
};
