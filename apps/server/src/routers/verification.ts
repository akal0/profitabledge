import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, max, sql } from "drizzle-orm";
import { UTApi } from "uploadthing/server";
import { z } from "zod";

import { db } from "../db";
import { user as userTable } from "../db/schema/auth";
import { notification } from "../db/schema/notifications";
import {
  sharedPnlCard,
  trade,
  tradeTrustEvent,
  tradingAccount,
} from "../db/schema/trading";
import { listPublicProofLiveTrades } from "../lib/public-proof/live-trades";
import { buildPublicProofPageData } from "../lib/public-proof/page-data";
import { buildPublicProofPath } from "../lib/public-proof/share-slug";
import {
  buildVerificationCode,
  issueWidgetShareVerification,
  readVerificationToken,
  widgetShareSurfaceSchema,
} from "../lib/verification/share-verification";
import { protectedProcedure, publicProcedure, router } from "../lib/trpc";
import { loadPublicShareById } from "./proof/shared";

function parseNumericValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseNullableNumber(value: unknown) {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const MAX_WIDGET_SNAPSHOT_HTML_LENGTH = 250_000;
const uploadThingApi = new UTApi();

function sanitizeWidgetSnapshotHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<(iframe|object|embed)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<(iframe|object|embed|link|meta|base)\b[^>]*\/?>/gi, "")
    .replace(/\son[a-z-]+\s*=\s*(["']).*?\1/gi, "")
    .replace(/\son[a-z-]+\s*=\s*[^\s>]+/gi, "");
}

async function resolveWidgetSnapshotUrl(input: {
  snapshotKey?: string | null;
  snapshotUrl?: string | null;
}) {
  if (input.snapshotUrl) {
    return input.snapshotUrl;
  }

  if (!input.snapshotKey) {
    return null;
  }

  try {
    const response = await uploadThingApi.getFileUrls(input.snapshotKey);
    return response.data[0]?.url ?? null;
  } catch (error) {
    console.error(
      "[verification.widgetSnapshot] Failed to resolve snapshot URL",
      error
    );
    return null;
  }
}

async function loadWidgetSnapshotHtml(input: {
  snapshotKey?: string | null;
  snapshotUrl?: string | null;
}) {
  const snapshotUrl = await resolveWidgetSnapshotUrl(input);
  if (!snapshotUrl) {
    return {
      snapshotHtml: null,
      snapshotUrl: null,
    };
  }

  try {
    const response = await fetch(snapshotUrl, {
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        snapshotHtml: null,
        snapshotUrl,
      };
    }

    const html = await response.text();
    return {
      snapshotHtml: sanitizeWidgetSnapshotHtml(
        html.slice(0, MAX_WIDGET_SNAPSHOT_HTML_LENGTH)
      ),
      snapshotUrl,
    };
  } catch (error) {
    console.error("[verification.widgetSnapshot] Failed to load snapshot", error);
    return {
      snapshotHtml: null,
      snapshotUrl,
    };
  }
}

export const verificationRouter = router({
  issueWidgetShare: protectedProcedure
    .input(
      z.object({
        accountId: z.string().min(1),
        title: z.string().trim().min(1).max(160),
        snapshotKey: z.string().min(1),
        surface: widgetShareSurfaceSchema.nullable().optional(),
        summary: z.object({
          currencyCode: z.string().trim().min(1).nullable().optional(),
          initialBalance: z.number().nullable().optional(),
          accountBalance: z.number().nullable().optional(),
          totalPnl: z.number().nullable().optional(),
          floatingPnl: z.number().nullable().optional(),
          winRate: z.number().nullable().optional(),
          totalTrades: z.number().int().nullable().optional(),
          openTradesCount: z.number().int().nullable().optional(),
          profitFactor: z.number().nullable().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [account] = await db
        .select({
          id: tradingAccount.id,
          name: tradingAccount.name,
          broker: tradingAccount.broker,
        })
        .from(tradingAccount)
        .where(
          and(
            eq(tradingAccount.id, input.accountId),
            eq(tradingAccount.userId, ctx.session.user.id)
          )
        )
        .limit(1);

      if (!account) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Account not found",
        });
      }

      return issueWidgetShareVerification({
        accountId: account.id,
        title: input.title,
        snapshotKey: input.snapshotKey,
        surface: input.surface ?? null,
        accountName: account.name,
        broker: account.broker,
        currencyCode: input.summary.currencyCode ?? null,
        initialBalance: parseNullableNumber(input.summary.initialBalance),
        accountBalance: parseNullableNumber(input.summary.accountBalance),
        totalPnl: parseNullableNumber(input.summary.totalPnl),
        floatingPnl: parseNullableNumber(input.summary.floatingPnl),
        winRate: parseNullableNumber(input.summary.winRate),
        totalTrades: input.summary.totalTrades ?? null,
        openTradesCount: input.summary.openTradesCount ?? null,
        profitFactor: parseNullableNumber(input.summary.profitFactor),
      });
    }),

  resolve: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      const payload = readVerificationToken(input.token);

      if (!payload) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Verification record not found",
        });
      }

      const verificationCode = buildVerificationCode(input.token);
      const issuedAt = new Date(payload.i).toISOString();

      if (payload.r === "proof") {
        const share = await loadPublicShareById(payload.id);
        const fallbackPath = buildPublicProofPath(payload.u, payload.s);

        if (!share) {
          return {
            kind: "proof" as const,
            status: "unavailable" as const,
            verificationCode,
            issuedAt,
            fallback: {
              username: payload.u,
              publicAccountSlug: payload.s,
              accountName: payload.an ?? null,
              broker: payload.br ?? null,
              path: fallbackPath,
            },
            resource: null,
          };
        }

        const [
          lastImportedRow,
          tradeRows,
          liveTradeRows,
          editedSummary,
          removedSummary,
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
        ]);

        const page = buildPublicProofPageData({
          share,
          username: share.username ?? payload.u,
          publicAccountSlug: share.publicAccountSlug,
          lastImportedAt: lastImportedRow[0]?.lastImportedAt ?? null,
          storedTradeRows: tradeRows.map((row) => ({
            ...row,
            brokerMeta: row.brokerMeta as Record<string, unknown> | null,
          })),
          liveTradeRows,
          editedTradesCount: Number(editedSummary[0]?.count ?? 0),
          removedTradesCount: Number(removedSummary[0]?.count ?? 0),
        });

        return {
          kind: "proof" as const,
          status: share.isActive ? ("active" as const) : ("revoked" as const),
          verificationCode,
          issuedAt,
          fallback: {
            username: payload.u,
            publicAccountSlug: payload.s,
            accountName: payload.an ?? null,
            broker: payload.br ?? null,
            path: fallbackPath,
          },
          resource: {
            path: page.path,
            revokedAt: share.revokedAt?.toISOString() ?? null,
            trader: page.trader,
            account: page.account,
            proof: page.proof,
            summary: {
              totalTrades: page.summary.totalTrades,
              totalPnl: page.summary.totalPnl,
              floatingPnl: page.summary.floatingPnl,
              winRate: page.summary.winRate,
              openTradesCount: page.summary.openTradesCount,
              initialBalance: page.summary.initialBalance,
              profitFactor: page.summary.profitFactor,
            },
            trust: page.trust,
          },
        };
      }

      if (payload.r === "widget") {
        const snapshotAsset = await loadWidgetSnapshotHtml({
          snapshotKey: payload.v === 2 ? payload.wk : null,
          snapshotUrl: payload.v === 1 ? payload.ws ?? null : null,
        });

        if (payload.v === 2) {
          const [account] = await db
            .select({
              accountName: tradingAccount.name,
              accountBroker: tradingAccount.broker,
              traderName: userTable.name,
              traderUsername: userTable.username,
              traderImage: userTable.image,
              profileBannerUrl: userTable.profileBannerUrl,
              profileBannerPosition: userTable.profileBannerPosition,
              profileEffects: userTable.profileEffects,
            })
            .from(tradingAccount)
            .innerJoin(userTable, eq(userTable.id, tradingAccount.userId))
            .where(eq(tradingAccount.id, payload.a))
            .limit(1);

          return {
            kind: "widget" as const,
            status: "active" as const,
            verificationCode,
            issuedAt,
            resource: {
              title: payload.wt,
              accountId: payload.a,
              snapshotHtml: snapshotAsset.snapshotHtml,
              imageUrl: null,
              snapshotUrl: snapshotAsset.snapshotUrl,
              surface: payload.sv ?? null,
              trader: {
                name: account?.traderName ?? "Trader",
                username: account?.traderUsername ?? null,
                image: account?.traderImage ?? null,
                profileBannerUrl: account?.profileBannerUrl ?? null,
                profileBannerPosition: account?.profileBannerPosition ?? null,
                profileEffects: account?.profileEffects ?? null,
              },
              account: {
                name: account?.accountName ?? payload.an,
                broker: account?.accountBroker ?? payload.br ?? null,
              },
              summary: {
                currencyCode: payload.cc ?? null,
                initialBalance: payload.ib ?? null,
                accountBalance: payload.ab ?? null,
                totalPnl: payload.np ?? null,
                floatingPnl: payload.fp ?? null,
                winRate: payload.wr ?? null,
                totalTrades: payload.tt ?? null,
                openTradesCount: payload.oc ?? null,
                profitFactor: payload.pf ?? null,
              },
            },
          };
        }

        return {
          kind: "widget" as const,
          status: "active" as const,
          verificationCode,
          issuedAt,
          resource: {
            title: payload.wt,
            accountId: null,
            snapshotHtml: snapshotAsset.snapshotHtml,
            imageUrl: payload.wi ?? null,
            snapshotUrl: snapshotAsset.snapshotUrl,
            surface: null,
            trader: {
              name: payload.tn,
              username: payload.un ?? null,
              image: payload.ui ?? null,
              profileBannerUrl: payload.bu ?? null,
              profileBannerPosition: payload.bp ?? null,
              profileEffects: payload.pe ?? null,
            },
            account: {
              name: payload.an,
              broker: payload.br ?? null,
            },
            summary: {
              currencyCode: payload.cc ?? null,
              initialBalance: payload.ib ?? null,
              accountBalance: payload.ab ?? null,
              totalPnl: payload.np ?? null,
              floatingPnl: payload.fp ?? null,
              winRate: payload.wr ?? null,
              totalTrades: payload.tt ?? null,
              openTradesCount: payload.oc ?? null,
              profitFactor: payload.pf ?? null,
            },
          },
        };
      }

      const [card] = await db
        .select({
          shareId: sharedPnlCard.shareId,
          createdAt: sharedPnlCard.createdAt,
          expiresAt: sharedPnlCard.expiresAt,
          isPublic: sharedPnlCard.isPublic,
          password: sharedPnlCard.password,
          cardData: sharedPnlCard.cardData,
        })
        .from(sharedPnlCard)
        .where(eq(sharedPnlCard.shareId, payload.id))
        .limit(1);

      if (!card) {
        return {
          kind: "card" as const,
          status: "unavailable" as const,
          verificationCode,
          issuedAt,
          fallback: {
            sharePath: `/share/${payload.id}`,
            symbol: payload.sy ?? null,
            tradeType: payload.tt ?? null,
            profit: payload.pf ?? null,
            realisedRR: payload.rr ?? null,
            outcome: payload.oc ?? null,
          },
          resource: null,
        };
      }

      const cardData =
        card.cardData && typeof card.cardData === "object"
          ? (card.cardData as Record<string, unknown>)
          : {};

      const isExpired =
        card.expiresAt != null && new Date(card.expiresAt).getTime() < Date.now();

      return {
        kind: "card" as const,
        status: isExpired
          ? ("expired" as const)
          : card.isPublic === false
          ? ("private" as const)
          : ("active" as const),
        verificationCode,
        issuedAt,
        fallback: {
          sharePath: `/share/${payload.id}`,
          symbol: payload.sy ?? null,
          tradeType: payload.tt ?? null,
          profit: payload.pf ?? null,
          realisedRR: payload.rr ?? null,
          outcome: payload.oc ?? null,
        },
        resource: {
          sharePath: `/share/${card.shareId}`,
          createdAt: card.createdAt.toISOString(),
          expiresAt: card.expiresAt?.toISOString() ?? null,
          passwordProtected: Boolean(card.password),
          snapshot: {
            symbol:
              typeof cardData.symbol === "string" ? cardData.symbol : null,
            tradeType:
              typeof cardData.tradeType === "string"
                ? cardData.tradeType
                : null,
            profit: parseNumericValue(cardData.profit),
            realisedRR: parseNumericValue(cardData.realisedRR),
            outcome:
              typeof cardData.outcome === "string" ? cardData.outcome : null,
          },
        },
      };
    }),
});
