import { and, eq } from "drizzle-orm";

import { db } from "../../db";
import { user as userTable } from "../../db/schema/auth";
import { journalEntry, journalMedia, type JournalBlock } from "../../db/schema/journal";
import { edge, trade } from "../../db/schema/trading";
import {
  type TradeIdeaPhase,
  tradeIdeaShare,
  type TradeIdeaDirection,
} from "../../db/schema/trade-ideas";

export type TradeIdeaDraft = {
  journalEntryId: string;
  tradePhase: TradeIdeaPhase | null;
  symbol: string | null;
  direction: TradeIdeaDirection | null;
  entryPrice: string | null;
  stopLoss: string | null;
  takeProfit: string | null;
  exitPrice: string | null;
  riskReward: string | null;
  title: string;
  description: string;
  strategyName: string | null;
  chartImageUrl: string | null;
  chartImageWidth: number | null;
  chartImageHeight: number | null;
  authorDisplayName: string | null;
  authorUsername: string | null;
  authorAvatarUrl: string | null;
  authorBannerUrl: string | null;
  authorProfileEffects: unknown;
};

export type PublicTradeIdea = {
  id: string;
  shareToken: string;
  sharePath: string;
  symbol: string;
  direction: TradeIdeaDirection;
  entryPrice: string | null;
  stopLoss: string | null;
  takeProfit: string | null;
  riskReward: string | null;
  title: string | null;
  description: string | null;
  tradePhase: TradeIdeaPhase | null;
  strategyName: string | null;
  timeframe: string | null;
  session: string | null;
  chartImageUrl: string | null;
  chartImageWidth: number | null;
  chartImageHeight: number | null;
  ogImageUrl: string | null;
  ogImageGeneratedAt: Date | null;
  showUsername: boolean;
  showPrices: boolean;
  showRR: boolean;
  authorDisplayName: string | null;
  authorUsername: string | null;
  authorAvatarUrl: string | null;
  authorBannerUrl: string | null;
  authorProfileEffects: unknown;
  viewCount: number;
  createdAt: Date;
  expiresAt: Date | null;
  isActive: boolean;
};

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function truncate(value: string | null | undefined, maxLength: number) {
  if (!value) return "";
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function findFirstImageBlockUrl(blocks: JournalBlock[] | null | undefined): string | null {
  if (!Array.isArray(blocks)) {
    return null;
  }

  for (const block of blocks) {
    if (block.type === "image" && block.props?.imageUrl) {
      return block.props.imageUrl;
    }

    if (block.children?.length) {
      const nestedUrl = findFirstImageBlockUrl(block.children);
      if (nestedUrl) {
        return nestedUrl;
      }
    }
  }

  return null;
}

function inferSymbolFromText(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (!value) continue;
    const match = value.toUpperCase().match(/\b([A-Z]{2,10}(?:[\/:.-][A-Z]{2,10})?)\b/);
    if (match?.[1]) {
      return match[1].replace(/[^A-Z0-9/:.-]/g, "");
    }
  }

  return null;
}

function inferDirectionFromText(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (!value) continue;
    const normalized = value.toLowerCase();
    if (/\b(long|buy|bullish)\b/.test(normalized)) {
      return "long" as const;
    }
    if (/\b(short|sell|bearish)\b/.test(normalized)) {
      return "short" as const;
    }
  }

  return null;
}

export function generateTradeIdeaTitle(input: {
  title?: string | null;
  symbol?: string | null;
  direction?: TradeIdeaDirection | null;
}) {
  const explicitTitle = normalizeText(input.title);
  if (explicitTitle && explicitTitle.toLowerCase() !== "untitled") {
    return truncate(explicitTitle, 120);
  }

  const symbol = normalizeText(input.symbol) ?? "Trade";
  const directionLabel = input.direction === "short" ? "short" : "long";
  return truncate(`${symbol} ${directionLabel} setup`, 120);
}

export function generateTradeIdeaDescription(value?: string | null) {
  return truncate(stripHtml(value || ""), 500);
}

export function getTradeIdeaPhaseLabel(phase: TradeIdeaPhase | null | undefined) {
  switch (phase) {
    case "during-trade":
      return "During-trade update";
    case "post-trade":
      return "Post-trade review";
    case "pre-trade":
    default:
      return "Pre-trade analysis";
  }
}

export function isTradeIdeaExpired(expiresAt: Date | null | undefined) {
  return Boolean(expiresAt && expiresAt.getTime() <= Date.now());
}

export async function buildTradeIdeaDraft(userId: string, journalEntryId: string) {
  const [entry, media, author] = await Promise.all([
    db
      .select({
        id: journalEntry.id,
        userId: journalEntry.userId,
        title: journalEntry.title,
        content: journalEntry.content,
        tradePhase: journalEntry.tradePhase,
        plannedEntryPrice: journalEntry.plannedEntryPrice,
        plannedStopLoss: journalEntry.plannedStopLoss,
        plannedTakeProfit: journalEntry.plannedTakeProfit,
        plannedRiskReward: journalEntry.plannedRiskReward,
        plannedExitPrice: journalEntry.plannedExitPrice,
        plannedNotes: journalEntry.plannedNotes,
        linkedTradeIds: journalEntry.linkedTradeIds,
        linkedEdgeId: journalEntry.linkedEdgeId,
        coverImageUrl: journalEntry.coverImageUrl,
      })
      .from(journalEntry)
      .where(and(eq(journalEntry.id, journalEntryId), eq(journalEntry.userId, userId)))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({
        url: journalMedia.url,
        width: journalMedia.width,
        height: journalMedia.height,
        sortOrder: journalMedia.sortOrder,
      })
      .from(journalMedia)
      .where(and(eq(journalMedia.entryId, journalEntryId), eq(journalMedia.userId, userId)))
      .orderBy(journalMedia.sortOrder),
    db
      .select({
        displayName: userTable.displayName,
        name: userTable.name,
        username: userTable.username,
        avatarUrl: userTable.image,
        bannerUrl: userTable.profileBannerUrl,
        profileEffects: userTable.profileEffects,
      })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  if (!entry) {
    return null;
  }

  const linkedTradeIds = (entry.linkedTradeIds as string[] | null) ?? [];
  const [linkedTrade, linkedEdge] = await Promise.all([
    linkedTradeIds.length > 0
      ? db
          .select({
            symbol: trade.symbol,
            tradeType: trade.tradeType,
            openPrice: trade.openPrice,
            closePrice: trade.closePrice,
            sl: trade.sl,
            tp: trade.tp,
          })
          .from(trade)
          .where(eq(trade.id, linkedTradeIds[0]!))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    entry.linkedEdgeId
      ? db
          .select({ name: edge.name })
          .from(edge)
          .where(eq(edge.id, entry.linkedEdgeId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
  ]);

  const symbol =
    normalizeText(linkedTrade?.symbol) ??
    inferSymbolFromText(entry.title, entry.plannedNotes);
  const direction =
    (linkedTrade?.tradeType as TradeIdeaDirection | null | undefined) ??
    inferDirectionFromText(entry.title, entry.plannedNotes);
  const imageFromBlocks = findFirstImageBlockUrl(entry.content as JournalBlock[] | null);
  const firstMedia = media.find((item) => Boolean(item.url));
  const chartImageUrl =
    normalizeText(firstMedia?.url) ?? imageFromBlocks ?? normalizeText(entry.coverImageUrl);
  const description = generateTradeIdeaDescription(entry.plannedNotes);

  return {
    journalEntryId: entry.id,
    tradePhase: (entry.tradePhase as TradeIdeaPhase | null) ?? null,
    symbol,
    direction,
    entryPrice: normalizeText(entry.plannedEntryPrice) ?? normalizeText(linkedTrade?.openPrice),
    stopLoss: normalizeText(entry.plannedStopLoss) ?? normalizeText(linkedTrade?.sl),
    takeProfit: normalizeText(entry.plannedTakeProfit) ?? normalizeText(linkedTrade?.tp),
    exitPrice: normalizeText(linkedTrade?.closePrice) ?? normalizeText(entry.plannedExitPrice),
    riskReward: normalizeText(entry.plannedRiskReward),
    title: generateTradeIdeaTitle({
      title: entry.title,
      symbol,
      direction,
    }),
    description,
    strategyName: normalizeText(linkedEdge?.name),
    chartImageUrl,
    chartImageWidth: firstMedia?.width ?? null,
    chartImageHeight: firstMedia?.height ?? null,
    authorDisplayName: normalizeText(author?.displayName) ?? normalizeText(author?.name),
    authorUsername: normalizeText(author?.username),
    authorAvatarUrl: normalizeText(author?.avatarUrl),
    authorBannerUrl: normalizeText(author?.bannerUrl),
    authorProfileEffects: author?.profileEffects ?? null,
  } satisfies TradeIdeaDraft;
}

export async function getTradeIdeaByToken(token: string) {
  const row = await db
    .select()
    .from(tradeIdeaShare)
    .where(eq(tradeIdeaShare.shareToken, token))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!row) {
    return null;
  }

  return {
    ...row,
    sharePath: `/idea/${row.shareToken}`,
  } satisfies PublicTradeIdea;
}
