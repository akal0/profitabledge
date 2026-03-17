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
import { notification } from "../../db/schema/notifications";
import {
  publicAccountShare,
  trade,
  tradeTrustEvent,
} from "../../db/schema/trading";
import { listPublicProofLiveTrades } from "../../lib/public-proof/live-trades";
import { buildPublicProofPath } from "../../lib/public-proof/share-slug";
import {
  getTradeOriginLabel,
  resolveAccountConnectionTrust,
  resolveTradeOriginType,
  type TradeOriginType,
} from "../../lib/public-proof/trust";
import { protectedProcedure, publicProcedure } from "../../lib/trpc";
import {
  ensureOwnedProofAccount,
  getLatestOwnedPublicShare,
  getProofOwnerIdentity,
  resolveActivePublicShareOrThrow,
  serializeOwnedSharePath,
} from "./shared";

function parseNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveTradeTimestamp(row: {
  closeTime?: Date | null;
  openTime?: Date | null;
  createdAt: Date;
}) {
  return row.closeTime ?? row.openTime ?? row.createdAt;
}

function downsampleCurve(
  points: Array<{ x: string; y: number }>,
  maxPoints = 64
) {
  if (points.length <= maxPoints) return points;

  const step = points.length / maxPoints;
  const sampled: Array<{ x: string; y: number }> = [];
  for (let index = 0; index < maxPoints; index += 1) {
    const point = points[Math.min(points.length - 1, Math.floor(index * step))];
    if (point) sampled.push(point);
  }
  return sampled;
}

function buildVerificationLabel(verificationLevel: string | null | undefined) {
  switch (verificationLevel) {
    case "api_verified":
      return "API verified";
    case "ea_synced":
      return "EA verified";
    case "prop_verified":
      return "Prop verified";
    default:
      return "Self-reported";
  }
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

      const [lastImportedRow, tradeRows, editedSummary, removedSummary] =
        await Promise.all([
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
        ]);

      const closedTradeRows = tradeRows.filter(
        (row) => row.closeTime != null || row.outcome != null
      );
      const pnls = tradeRows.map((row) => parseNumber(row.profit));
      const totalTrades = tradeRows.length;
      const totalPnl = pnls.reduce((sum, pnl) => sum + pnl, 0);
      const wins = closedTradeRows.filter((row) => {
        if (row.outcome) {
          return row.outcome === "Win" || row.outcome === "PW";
        }
        return parseNumber(row.profit) > 0;
      }).length;
      const closedLosses = closedTradeRows.filter((row) => {
        if (row.outcome) {
          return row.outcome === "Loss";
        }
        return parseNumber(row.profit) < 0;
      }).length;
      const winRate =
        closedTradeRows.length > 0
          ? Number(((wins / closedTradeRows.length) * 100).toFixed(1))
          : 0;
      const grossProfit = pnls
        .filter((value) => value > 0)
        .reduce((sum, value) => sum + value, 0);
      const grossLoss = Math.abs(
        pnls.filter((value) => value < 0).reduce((sum, value) => sum + value, 0)
      );
      const profitFactor =
        grossLoss > 0
          ? Number((grossProfit / grossLoss).toFixed(2))
          : grossProfit > 0
          ? 999
          : 0;

      const rrValues = closedTradeRows
        .map((row) =>
          parseNumber(row.realisedRR != null ? row.realisedRR : row.plannedRR)
        )
        .filter((value) => Number.isFinite(value) && value > 0);
      const averageRR =
        rrValues.length > 0
          ? Number(
              (
                rrValues.reduce((sum, value) => sum + value, 0) /
                rrValues.length
              ).toFixed(2)
            )
          : 0;

      const sortedForCurve = [...closedTradeRows].sort(
        (left, right) =>
          resolveTradeTimestamp(left).getTime() -
          resolveTradeTimestamp(right).getTime()
      );

      let equity = 0;
      let peak = 0;
      let maxDrawdown = 0;
      const curvePoints = sortedForCurve.map((row) => {
        equity += parseNumber(row.profit);
        peak = Math.max(peak, equity);
        maxDrawdown = Math.max(maxDrawdown, peak - equity);
        return {
          x: resolveTradeTimestamp(row).toISOString(),
          y: Number(equity.toFixed(2)),
        };
      });

      const sourceCounts = {
        brokerSync: 0,
        csvImport: 0,
        manualEntry: 0,
      };

      for (const row of tradeRows) {
        const originType = resolveTradeOriginType({
          originType: row.originType,
          brokerMeta: row.brokerMeta as Record<string, unknown> | null,
          ticket: row.ticket,
          useBrokerData: row.useBrokerData,
          accountVerificationLevel: share.verificationLevel,
          accountIsVerified: share.isVerified,
        });

        if (originType === "broker_sync") sourceCounts.brokerSync += 1;
        if (originType === "csv_import") sourceCounts.csvImport += 1;
        if (originType === "manual_entry") sourceCounts.manualEntry += 1;
      }

      const legacyAuditGap = tradeRows.some(
        (row) => row.createdAt.getTime() < share.createdAt.getTime()
      );
      const connectionTrust = resolveAccountConnectionTrust({
        verificationLevel: share.verificationLevel,
        isVerified: share.isVerified,
        brokerType: share.brokerType,
        brokerServer: share.brokerServer,
        lastImportedAt: lastImportedRow[0]?.lastImportedAt ?? null,
      });

      return {
        path: buildPublicProofPath(input.username, input.publicAccountSlug),
        trader: {
          username: input.username,
          name: share.traderName,
        },
        account: {
          name: share.accountName,
          broker: share.broker,
        },
        proof: {
          connectionKind: connectionTrust.kind,
          connectionLabel: connectionTrust.label,
          verificationLevel: share.verificationLevel ?? "unverified",
          verificationLabel: buildVerificationLabel(share.verificationLevel),
          auditCoverageStartsAt: share.createdAt,
          legacyAuditGap,
        },
        summary: {
          totalTrades,
          wins,
          losses: closedLosses,
          winRate,
          totalPnl: Number(totalPnl.toFixed(2)),
          profitFactor,
          averageRR,
          maxDrawdown: Number(maxDrawdown.toFixed(2)),
          curve: downsampleCurve(curvePoints),
        },
        trust: {
          editedTradesCount: Number(editedSummary[0]?.count ?? 0),
          removedTradesCount: Number(removedSummary[0]?.count ?? 0),
          sourceCounts,
        },
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
              sortAtISO: pageRows[pageRows.length - 1]!.sortAt.toISOString(),
              id: pageRows[pageRows.length - 1]!.id,
            }
          : undefined,
      };
    }),
};
