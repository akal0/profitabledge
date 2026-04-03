export type TradeIdeaDirection = "long" | "short";

export type TradeIdeaPresentation = {
  shareToken?: string;
  symbol: string;
  direction: TradeIdeaDirection;
  entryPrice?: string | null;
  stopLoss?: string | null;
  takeProfit?: string | null;
  riskReward?: string | null;
  title?: string | null;
  description?: string | null;
  strategyName?: string | null;
  timeframe?: string | null;
  session?: string | null;
  chartImageUrl?: string | null;
  chartImageWidth?: number | null;
  chartImageHeight?: number | null;
  showUsername?: boolean;
  showPrices?: boolean;
  showRR?: boolean;
  authorDisplayName?: string | null;
  authorUsername?: string | null;
  authorAvatarUrl?: string | null;
  authorBannerUrl?: string | null;
  authorProfileEffects?: unknown;
  viewCount?: number;
  createdAt?: string | Date;
  expiresAt?: string | Date | null;
};

export const TRADE_IDEA_TIMEFRAMES = [
  "1m",
  "5m",
  "15m",
  "30m",
  "1H",
  "4H",
  "1D",
  "1W",
  "1M",
] as const;

export const TRADE_IDEA_SESSIONS = [
  "Asian",
  "London",
  "New York",
  "Custom",
] as const;

export const TRADE_IDEA_EXPIRY_OPTIONS = [
  { label: "Never", value: "never", hours: undefined },
  { label: "24 hours", value: "24h", hours: 24 },
  { label: "7 days", value: "7d", hours: 24 * 7 },
  { label: "30 days", value: "30d", hours: 24 * 30 },
] as const;

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function truncateText(value: string | null | undefined, maxLength: number) {
  if (!value) return "";
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function formatDirectionLabel(direction: TradeIdeaDirection) {
  return direction === "short" ? "Short" : "Long";
}

export function formatDirectionArrow(direction: TradeIdeaDirection) {
  return direction === "short" ? "▼" : "▲";
}

export function getIdeaVersionKey(idea: {
  ogImageGeneratedAt?: string | Date | null;
  createdAt?: string | Date | null;
}) {
  const rawValue = idea.ogImageGeneratedAt ?? idea.createdAt ?? Date.now();
  const timestamp =
    rawValue instanceof Date ? rawValue.getTime() : new Date(rawValue).getTime();

  return Number.isFinite(timestamp) ? timestamp : Date.now();
}

export function buildTradeIdeaOgImagePath(idea: {
  shareToken: string;
  ogImageGeneratedAt?: string | Date | null;
  createdAt?: string | Date | null;
}) {
  return `/api/og/idea/${idea.shareToken}?v=${getIdeaVersionKey(idea)}`;
}

export function getIdeaAuthorName(idea: Pick<TradeIdeaPresentation, "authorDisplayName" | "authorUsername">) {
  return idea.authorDisplayName || idea.authorUsername || "Trader";
}

export function getIdeaAuthorHandle(idea: Pick<TradeIdeaPresentation, "authorUsername">) {
  return idea.authorUsername ? `@${idea.authorUsername}` : "@trader";
}

export function getIdeaInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "T";
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function formatPrice(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;

  const fraction = value.includes(".") ? value.split(".")[1]?.length ?? 0 : 0;
  return parsed.toLocaleString("en-US", {
    minimumFractionDigits: fraction,
    maximumFractionDigits: Math.max(fraction, 0),
  });
}

export function formatRiskReward(value: string | null | undefined) {
  if (!value) return "-";
  const normalized = value.trim();
  if (normalized.startsWith("1:")) {
    return normalized;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return normalized;
  }

  return `1:${parsed.toFixed(parsed >= 10 ? 1 : 2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")}`;
}

export function computeRiskReward(input: {
  direction: TradeIdeaDirection;
  entryPrice?: string | null;
  stopLoss?: string | null;
  takeProfit?: string | null;
}) {
  const entry = Number(input.entryPrice);
  const stop = Number(input.stopLoss);
  const takeProfit = Number(input.takeProfit);

  if (![entry, stop, takeProfit].every((value) => Number.isFinite(value))) {
    return null;
  }

  const risk = Math.abs(entry - stop);
  const reward = Math.abs(takeProfit - entry);
  if (risk <= 0 || reward <= 0) {
    return null;
  }

  return (reward / risk).toFixed(2);
}

export function generateTradeIdeaTitle(idea: Pick<TradeIdeaPresentation, "title" | "symbol" | "direction">) {
  if (idea.title?.trim() && idea.title.trim().toLowerCase() !== "untitled") {
    return truncateText(idea.title.trim(), 120);
  }

  return `${idea.symbol} ${formatDirectionLabel(idea.direction)} Setup`;
}

export function buildTradeIdeaDescription(idea: TradeIdeaPresentation) {
  const customDescription = truncateText(stripHtml(idea.description || ""), 500);
  if (customDescription) {
    return customDescription;
  }

  const direction = `${formatDirectionArrow(idea.direction)} ${formatDirectionLabel(
    idea.direction
  )}`;
  const priceBits = idea.showPrices === false
    ? []
    : [
        idea.entryPrice ? `Entry ${formatPrice(idea.entryPrice)}` : null,
        idea.stopLoss ? `SL ${formatPrice(idea.stopLoss)}` : null,
        idea.takeProfit ? `TP ${formatPrice(idea.takeProfit)}` : null,
      ].filter(Boolean);
  const rrBit =
    idea.showRR === false || !idea.riskReward
      ? null
      : `${formatRiskReward(idea.riskReward)} R:R`;
  const sessionBits = [idea.session, idea.timeframe, idea.strategyName].filter(Boolean);
  const author = getIdeaAuthorName(idea);

  const sentence = [
    `${idea.symbol} ${direction}`,
    [...priceBits, rrBit].filter(Boolean).join(", "),
    sessionBits.join(". "),
    `Pre-trade analysis by ${author} on profitabledge.`,
  ]
    .filter(Boolean)
    .join(". ");

  return truncateText(sentence, 200);
}

export function buildTradeIdeaMetaTitle(idea: TradeIdeaPresentation) {
  const rrBit =
    idea.showRR === false || !idea.riskReward
      ? null
      : `${formatRiskReward(idea.riskReward)} R:R`;
  const handle = idea.showUsername === false ? null : getIdeaAuthorHandle(idea);

  return truncateText(
    [
      `${idea.symbol} ${formatDirectionArrow(idea.direction)} ${formatDirectionLabel(
        idea.direction
      )}`,
      rrBit,
      handle,
    ]
      .filter(Boolean)
      .join(" - "),
    70
  );
}

export function getTradeIdeaStatus(idea: Pick<TradeIdeaPresentation, "expiresAt"> & { isActive?: boolean }) {
  if (idea.isActive === false) {
    return "deactivated";
  }

  if (!idea.expiresAt) {
    return "active";
  }

  const expiresAt = idea.expiresAt instanceof Date
    ? idea.expiresAt.getTime()
    : new Date(idea.expiresAt).getTime();

  return Number.isFinite(expiresAt) && expiresAt <= Date.now() ? "expired" : "active";
}
