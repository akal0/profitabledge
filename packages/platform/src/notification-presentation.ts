type UnknownRecord = Record<string, unknown>;

export type NotificationPresentationTone =
  | "teal"
  | "emerald"
  | "amber"
  | "rose"
  | "blue"
  | "violet"
  | "neutral";

export type NotificationPresentationIcon =
  | "report"
  | "sync"
  | "risk"
  | "insight"
  | "account"
  | "calendar"
  | "system";

export type NotificationPresentationBrandKey =
  | "profitabledge"
  | "ftmo"
  | "mt5"
  | "ctrader"
  | "tradovate";

export type NotificationPresentationBadge = {
  label: string;
  tone: NotificationPresentationTone;
};

export type NotificationPresentation = {
  eyebrow: string;
  title: string;
  message: string | null;
  tone: NotificationPresentationTone;
  icon: NotificationPresentationIcon;
  brandKey: NotificationPresentationBrandKey;
  badges: NotificationPresentationBadge[];
  pushTitle: string;
  pushBody: string;
  requireInteraction: boolean;
  isProcessing: boolean;
};

export type NotificationPresentationInput = {
  title?: string | null;
  body?: string | null;
  type?: string | null;
  metadata?: Record<string, unknown> | null;
};

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function pickString(
  metadata: UnknownRecord | null,
  details: UnknownRecord | null,
  ...keys: string[]
) {
  for (const key of keys) {
    const topLevel = asString(metadata?.[key]);
    if (topLevel) return topLevel;

    const nested = asString(details?.[key]);
    if (nested) return nested;
  }

  return null;
}

function pickNumber(
  metadata: UnknownRecord | null,
  details: UnknownRecord | null,
  ...keys: string[]
) {
  for (const key of keys) {
    const topLevel = asNumber(metadata?.[key]);
    if (topLevel !== null) return topLevel;

    const nested = asNumber(details?.[key]);
    if (nested !== null) return nested;
  }

  return null;
}

function normalizeCurrencyCode(code?: string | null) {
  const normalized = code?.trim().toUpperCase() || "";
  return /^[A-Z]{3}$/.test(normalized) ? normalized : "USD";
}

function formatSignedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(Math.abs(value) >= 10 ? 1 : 2)}%`;
}

function formatPlainPercent(value: number) {
  return `${value.toFixed(Math.abs(value) >= 10 ? 1 : 2)}%`;
}

function formatSignedCurrency(value: number, currencyCode?: string | null) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: normalizeCurrencyCode(currencyCode),
    maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2,
    minimumFractionDigits: 0,
    signDisplay: "always",
  }).format(value);
}

function formatAbsoluteCurrency(value: number, currencyCode?: string | null) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: normalizeCurrencyCode(currencyCode),
    maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2,
    minimumFractionDigits: 0,
  }).format(value);
}

function formatCount(value: number, singular: string, plural = `${singular}s`) {
  const rounded = Math.round(value);
  return `${rounded} ${rounded === 1 ? singular : plural}`;
}

function formatMetricValue(alertType: string | null, value: number) {
  if (!alertType) {
    return value.toFixed(value % 1 === 0 ? 0 : 2);
  }

  if (
    alertType.includes("drawdown") ||
    alertType.includes("rate") ||
    alertType.includes("loss")
  ) {
    return formatPlainPercent(value);
  }

  if (
    alertType.includes("streak") ||
    alertType.includes("consecutive") ||
    alertType.includes("count")
  ) {
    return String(Math.round(value));
  }

  if (alertType.includes("profit_factor")) {
    return value.toFixed(2);
  }

  return value.toFixed(value % 1 === 0 ? 0 : 2);
}

function inferBrandKeyFromString(
  value: string | null
): NotificationPresentationBrandKey | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (!normalized) {
    return null;
  }

  if (
    normalized.includes("profitabledge") ||
    normalized.includes("demo broker")
  ) {
    return "profitabledge";
  }

  if (
    normalized.includes("mt5") ||
    normalized.includes("mt4") ||
    normalized.includes("metatrader") ||
    normalized.includes("metaquotes")
  ) {
    return "mt5";
  }

  if (normalized.includes("ctrader")) {
    return "ctrader";
  }

  if (
    normalized.includes("tradovate") ||
    normalized.includes("topstepx") ||
    normalized.includes("rithmic") ||
    normalized.includes("ninjatrader")
  ) {
    return "tradovate";
  }

  if (
    normalized.includes("ftmo") ||
    normalized.includes("fundingpips") ||
    normalized.includes("alphacapitalgroup") ||
    normalized.includes("seacrestfunded")
  ) {
    return "ftmo";
  }

  return null;
}

function pickBrandKey(
  metadata: UnknownRecord | null,
  details: UnknownRecord | null
): NotificationPresentationBrandKey {
  const candidates = [
    pickString(metadata, details, "broker"),
    pickString(metadata, details, "provider"),
    pickString(metadata, details, "brokerType"),
    pickString(metadata, details, "displayName"),
    pickString(metadata, details, "accountName"),
    pickString(metadata, details, "brokerServer"),
  ];

  for (const candidate of candidates) {
    const brandKey = inferBrandKeyFromString(candidate);
    if (brandKey) {
      return brandKey;
    }
  }

  return "profitabledge";
}

function isProcessingState(
  metadata: UnknownRecord | null,
  details: UnknownRecord | null
) {
  const status = pickString(metadata, details, "status")?.toLowerCase() ?? "";
  const kind = pickString(metadata, details, "kind")?.toLowerCase() ?? "";

  if (
    [
      "processing",
      "pending",
      "queued",
      "creating",
      "generating",
      "hydrating",
      "running",
      "syncing",
      "uploading",
      "parsing",
    ].includes(status)
  ) {
    return true;
  }

  return /(creating|generating|hydrating|processing|syncing|uploading|parsing)/.test(
    kind
  );
}

function buildReportPresentation(
  input: NotificationPresentationInput,
  metadata: UnknownRecord | null,
  details: UnknownRecord | null
): NotificationPresentation {
  const isWeekly =
    pickString(metadata, details, "kind", "reportType") === "weekly_report";
  const tradeCount = pickNumber(metadata, details, "tradeCount", "tradesToday");
  const winRate = pickNumber(metadata, details, "winRate", "weeklyWinRate");
  const pnl = pickNumber(metadata, details, "pnl", "weeklyPnL");
  const weeklyPnL = pickNumber(metadata, details, "weeklyPnL");
  const reviewedLabel = pickString(metadata, details, "reviewedLabel", "label");
  const focusTitle = pickString(metadata, details, "focusTitle");
  const currencyCode = pickString(metadata, details, "currencyCode");
  const positivePnl =
    (pnl ?? weeklyPnL ?? 0) >= 0 ? "emerald" : ("rose" as const);
  const message =
    input.body ??
    (focusTitle
      ? `${focusTitle}.`
      : reviewedLabel
        ? `Reviewed ${reviewedLabel.toLowerCase()} with your latest stats.`
        : "Your latest report is ready.");

  const badges: NotificationPresentationBadge[] = [];
  if (reviewedLabel) {
    badges.push({ label: reviewedLabel, tone: "neutral" });
  }
  if (tradeCount !== null) {
    badges.push({
      label: formatCount(tradeCount, "trade"),
      tone: "blue",
    });
  }
  if (winRate !== null) {
    badges.push({
      label: `${formatPlainPercent(winRate)} WR`,
      tone: winRate >= 50 ? "teal" : "amber",
    });
  }
  if (pnl !== null) {
    badges.push({
      label: formatSignedCurrency(pnl, currencyCode),
      tone: pnl >= 0 ? "emerald" : "rose",
    });
  } else if (weeklyPnL !== null) {
    badges.push({
      label: formatSignedCurrency(weeklyPnL, currencyCode),
      tone: weeklyPnL >= 0 ? "emerald" : "rose",
    });
  }

  return {
    eyebrow: isWeekly ? "Weekly report" : "Daily report",
    title: asString(input.title) ?? (isWeekly ? "Weekly report ready" : "Daily report ready"),
    message,
    tone: positivePnl,
    icon: "report",
    brandKey: pickBrandKey(metadata, details),
    badges,
    pushTitle:
      asString(input.title) ?? (isWeekly ? "Weekly report ready" : "Daily report ready"),
    pushBody:
      reviewedLabel && tradeCount !== null
        ? `${reviewedLabel}: ${formatCount(tradeCount, "trade")} reviewed${pnl !== null ? `, ${formatSignedCurrency(pnl, currencyCode)}` : ""}.`
        : message,
    requireInteraction: false,
    isProcessing: false,
  };
}

function buildSyncPresentation(
  input: NotificationPresentationInput,
  metadata: UnknownRecord | null,
  details: UnknownRecord | null
): NotificationPresentation {
  const status = pickString(metadata, details, "status");
  const isError = status === "error" || input.type === "system_maintenance";
  const provider = pickString(metadata, details, "provider", "broker");
  const displayName = pickString(
    metadata,
    details,
    "displayName",
    "accountName",
    "accountNumber"
  );
  const tradesInserted = pickNumber(metadata, details, "tradesInserted");
  const tradesDuplicated = pickNumber(metadata, details, "tradesDuplicated");
  const title =
    asString(input.title) ??
    (isError ? "Connection sync failed" : displayName ?? "Account synced");
  const message =
    input.body ??
    (isError
      ? "We could not complete the latest account sync."
      : "Your latest account sync completed successfully.");
  const badges: NotificationPresentationBadge[] = [];

  if (provider) {
    badges.push({ label: provider.toUpperCase(), tone: "neutral" });
  }
  if (tradesInserted !== null) {
    badges.push({
      label:
        tradesInserted > 0
          ? `+${formatCount(tradesInserted, "trade")}`
          : "No new trades",
      tone: tradesInserted > 0 ? "teal" : "neutral",
    });
  }
  if ((tradesDuplicated ?? 0) > 0) {
    badges.push({
      label: `${formatCount(tradesDuplicated ?? 0, "duplicate")}`,
      tone: "blue",
    });
  }

  return {
    eyebrow: isError ? "Sync issue" : "Account synced",
    title,
    message,
    tone: isError ? "rose" : "teal",
    icon: "sync",
    brandKey: pickBrandKey(metadata, details),
    badges,
    pushTitle: title,
    pushBody: message,
    requireInteraction: isError,
    isProcessing: isProcessingState(metadata, details),
  };
}

function buildRiskPresentation(
  input: NotificationPresentationInput,
  metadata: UnknownRecord | null,
  details: UnknownRecord | null
): NotificationPresentation {
  const severity =
    pickString(metadata, details, "severity")?.toLowerCase() ?? "warning";
  const alertType = pickString(metadata, details, "alertType");
  const currentValue = pickNumber(metadata, details, "currentValue");
  const thresholdValue = pickNumber(metadata, details, "thresholdValue");
  const badges: NotificationPresentationBadge[] = [];

  if (currentValue !== null) {
    badges.push({
      label: `Current ${formatMetricValue(alertType, currentValue)}`,
      tone: severity === "critical" ? "rose" : "amber",
    });
  }
  if (thresholdValue !== null) {
    badges.push({
      label: `Limit ${formatMetricValue(alertType, thresholdValue)}`,
      tone: "neutral",
    });
  }

  return {
    eyebrow: "Risk warning",
    title: asString(input.title) ?? "Risk alert triggered",
    message:
      input.body ?? "Your latest trading activity crossed one of your alert thresholds.",
    tone: severity === "critical" ? "rose" : "amber",
    icon: "risk",
    brandKey: pickBrandKey(metadata, details),
    badges,
    pushTitle: asString(input.title) ?? "Risk alert triggered",
    pushBody:
      input.body ?? "Your latest trading activity crossed one of your thresholds.",
    requireInteraction: true,
    isProcessing: false,
  };
}

function buildAccountPresentation(
  input: NotificationPresentationInput,
  metadata: UnknownRecord | null,
  details: UnknownRecord | null
): NotificationPresentation {
  const accountName = pickString(
    metadata,
    details,
    "accountName",
    "displayName",
    "accountNumber"
  );
  const balance = pickNumber(metadata, details, "balance");
  const equity = pickNumber(metadata, details, "equity");
  const currencyCode = pickString(metadata, details, "currencyCode");
  const initialBalance = pickNumber(metadata, details, "initialBalance");
  const computedPnl =
    pickNumber(metadata, details, "pnl") ??
    (initialBalance !== null
      ? (equity ?? balance ?? initialBalance) - initialBalance
      : null);
  const computedReturnPct =
    pickNumber(metadata, details, "returnPct") ??
    (initialBalance && computedPnl !== null
      ? (computedPnl / initialBalance) * 100
      : null);
  const positive = (computedPnl ?? 0) >= 0;
  const badges: NotificationPresentationBadge[] = [];

  if (computedReturnPct !== null) {
    badges.push({
      label: formatSignedPercent(computedReturnPct),
      tone: positive ? "teal" : "rose",
    });
  }
  if (computedPnl !== null) {
    badges.push({
      label: formatSignedCurrency(computedPnl, currencyCode),
      tone: positive ? "emerald" : "rose",
    });
  }
  if (equity !== null) {
    badges.push({
      label: `Equity ${formatAbsoluteCurrency(equity, currencyCode)}`,
      tone: "blue",
    });
  }

  return {
    eyebrow: "Account update",
    title: accountName ?? asString(input.title) ?? "Live account update",
    message:
      input.body ??
      (computedReturnPct !== null
        ? `Now ${positive ? "up" : "down"} ${formatSignedPercent(computedReturnPct)} from baseline.`
        : "Your live balance and equity just refreshed."),
    tone: positive ? "teal" : "rose",
    icon: "account",
    brandKey: pickBrandKey(metadata, details),
    badges,
    pushTitle: accountName ? `${accountName} updated` : "Account update",
    pushBody:
      computedPnl !== null
        ? `${computedPnl >= 0 ? "Up" : "Down"} ${formatAbsoluteCurrency(Math.abs(computedPnl), currencyCode)}${computedReturnPct !== null ? ` (${formatSignedPercent(computedReturnPct)})` : ""}.`
        : input.body ?? "Your account sync is active.",
    requireInteraction: false,
    isProcessing: isProcessingState(metadata, details),
  };
}

function buildAccountCreatedPresentation(
  input: NotificationPresentationInput,
  metadata: UnknownRecord | null,
  details: UnknownRecord | null
): NotificationPresentation {
  const accountName = pickString(
    metadata,
    details,
    "accountName",
    "displayName",
    "accountNumber"
  );
  const broker = pickString(metadata, details, "broker", "provider");
  const balance =
    pickNumber(metadata, details, "initialBalance") ??
    pickNumber(metadata, details, "balance");
  const currencyCode = pickString(metadata, details, "currencyCode");
  const badges: NotificationPresentationBadge[] = [];

  if (broker) {
    badges.push({ label: broker.toUpperCase(), tone: "neutral" });
  }
  if (balance !== null) {
    badges.push({
      label: formatAbsoluteCurrency(balance, currencyCode),
      tone: "blue",
    });
  }

  const createdMessage = accountName
    ? `${accountName} has been created.`
    : "Your account has been created.";

  return {
    eyebrow: "Account created",
    title: accountName ?? asString(input.title) ?? "New account ready",
    message: createdMessage,
    tone: "blue",
    icon: "account",
    brandKey: pickBrandKey(metadata, details),
    badges,
    pushTitle: accountName ? `${accountName} created` : "Account created",
    pushBody: createdMessage,
    requireInteraction: false,
    isProcessing: false,
  };
}

function buildImportPresentation(
  input: NotificationPresentationInput,
  metadata: UnknownRecord | null,
  details: UnknownRecord | null
): NotificationPresentation {
  const accountName = pickString(
    metadata,
    details,
    "accountName",
    "displayName",
    "accountNumber"
  );
  const broker = pickString(metadata, details, "broker", "provider");
  const tradesImported =
    pickNumber(metadata, details, "tradesImported") ??
    pickNumber(metadata, details, "tradesCreated");
  const tradesUpdated = pickNumber(metadata, details, "tradesUpdated");
  const isProcessing = isProcessingState(metadata, details);
  const badges: NotificationPresentationBadge[] = [];

  if (broker) {
    badges.push({ label: broker.toUpperCase(), tone: "neutral" });
  }
  if (tradesImported !== null) {
    badges.push({
      label: `+${formatCount(tradesImported, "trade")}`,
      tone: "teal",
    });
  }
  if (tradesUpdated !== null) {
    badges.push({
      label: `${formatCount(tradesUpdated, "update")}`,
      tone: "blue",
    });
  }

  const title =
    asString(input.title) ??
    (isProcessing ? "Importing account file" : "Trade import complete");
  const message =
    input.body ??
    (isProcessing
      ? accountName
        ? `Importing files for ${accountName}.`
        : "Importing your account file."
      : accountName
        ? `${accountName} has been updated from your latest import.`
        : "Your latest account import has finished.");

  return {
    eyebrow: isProcessing ? "Import in progress" : "Trade import",
    title,
    message,
    tone: isProcessing ? "blue" : "teal",
    icon: "sync",
    brandKey: pickBrandKey(metadata, details),
    badges,
    pushTitle: title,
    pushBody: message,
    requireInteraction: false,
    isProcessing,
  };
}

function buildInsightPresentation(
  input: NotificationPresentationInput,
  metadata: UnknownRecord | null,
  details: UnknownRecord | null
): NotificationPresentation {
  const severity =
    pickString(metadata, details, "severity")?.toLowerCase() ?? "info";
  const currencyCode = pickString(metadata, details, "currencyCode");
  const edge = asRecord(metadata?.edge) ?? asRecord(details?.edge);
  const leak = asRecord(metadata?.leak) ?? asRecord(details?.leak);
  const winRate =
    pickNumber(metadata, details, "winRate", "recentWR") ??
    asNumber(edge?.winRate) ??
    asNumber(leak?.winRate);
  const trades =
    pickNumber(metadata, details, "trades", "recentMatches", "streak") ??
    asNumber(edge?.trades) ??
    asNumber(leak?.trades);
  const profit = pickNumber(metadata, details, "profit", "pnl");
  const badges: NotificationPresentationBadge[] = [];

  if (winRate !== null) {
    badges.push({
      label: `${formatPlainPercent(winRate)} WR`,
      tone: winRate >= 50 ? "teal" : "amber",
    });
  }
  if (profit !== null) {
    badges.push({
      label: formatSignedCurrency(profit, currencyCode),
      tone: profit >= 0 ? "emerald" : "rose",
    });
  }
  if (trades !== null) {
    badges.push({
      label: formatCount(trades, "match"),
      tone: "blue",
    });
  }

  const tone: NotificationPresentationTone =
    severity === "positive"
      ? "teal"
      : severity === "warning"
        ? "amber"
        : "blue";

  return {
    eyebrow: "Trading insight",
    title: asString(input.title) ?? "Insight ready",
    message: input.body ?? null,
    tone,
    icon: "insight",
    brandKey: pickBrandKey(metadata, details),
    badges,
    pushTitle: asString(input.title) ?? "Trading insight",
    pushBody: input.body ?? "You have a new trading insight.",
    requireInteraction: false,
    isProcessing: false,
  };
}

function buildCalendarPresentation(
  input: NotificationPresentationInput,
  metadata: UnknownRecord | null,
  details: UnknownRecord | null
): NotificationPresentation {
  const impact = pickString(metadata, details, "impact");
  const country = pickString(metadata, details, "country");
  const count = pickNumber(metadata, details, "eventCount", "count");
  const tone: NotificationPresentationTone =
    impact?.toLowerCase().includes("high")
      ? "rose"
      : impact?.toLowerCase().includes("medium")
        ? "amber"
        : "blue";
  const badges: NotificationPresentationBadge[] = [];

  if (impact) {
    badges.push({ label: impact, tone });
  }
  if (count !== null && count > 1) {
    badges.push({ label: formatCount(count, "event"), tone: "neutral" });
  }

  return {
    eyebrow: country ? `${country} calendar` : "Calendar update",
    title: asString(input.title) ?? "Economic events ahead",
    message: input.body ?? null,
    tone,
    icon: "calendar",
    brandKey: pickBrandKey(metadata, details),
    badges,
    pushTitle: asString(input.title) ?? "Economic events ahead",
    pushBody: input.body ?? "You have upcoming economic events to review.",
    requireInteraction: false,
    isProcessing: false,
  };
}

function buildSystemPresentation(
  input: NotificationPresentationInput,
  metadata: UnknownRecord | null,
  details: UnknownRecord | null
): NotificationPresentation {
  const title = asString(input.title) ?? "Notification";
  const message = asString(input.body);
  const isProcessing = isProcessingState(metadata, details);

  return {
    eyebrow: "Notification",
    title,
    message,
    tone: isProcessing ? "teal" : "neutral",
    icon: "system",
    brandKey: pickBrandKey(metadata, details),
    badges: [],
    pushTitle: title,
    pushBody: message ?? "You have a new notification.",
    requireInteraction: false,
    isProcessing,
  };
}

export function buildNotificationPresentation(
  input: NotificationPresentationInput
): NotificationPresentation {
  const metadata = asRecord(input.metadata);
  const details = asRecord(metadata?.data);
  const kind = pickString(metadata, details, "kind");

  if (kind === "daily_report" || kind === "weekly_report") {
    return buildReportPresentation(input, metadata, details);
  }

  if (kind === "account_summary") {
    return buildAccountPresentation(input, metadata, details);
  }

  if (kind === "account_created") {
    return buildAccountCreatedPresentation(input, metadata, details);
  }

  if (kind === "trade_import_processing" || input.type === "trade_imported") {
    return buildImportPresentation(input, metadata, details);
  }

  if (kind === "trading_insight") {
    return buildInsightPresentation(input, metadata, details);
  }

  if (kind === "risk_warning") {
    return buildRiskPresentation(input, metadata, details);
  }

  if (kind === "sync_success" || kind === "sync_error" || input.type === "webhook_sync") {
    if (kind === "account_summary") {
      return buildAccountPresentation(input, metadata, details);
    }
    return buildSyncPresentation(input, metadata, details);
  }

  if (input.type === "alert_triggered" || input.type === "prop_violation") {
    return buildRiskPresentation(input, metadata, details);
  }

  if (input.type === "news_upcoming") {
    return buildCalendarPresentation(input, metadata, details);
  }

  return buildSystemPresentation(input, metadata, details);
}
