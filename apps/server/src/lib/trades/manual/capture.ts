import { normalizeManualTradeDirection } from "./validation";
import type { ManualTradeDraft } from "./types";

const KEY_VALUE_PATTERNS = [
  /(?:^|\s)(symbol|pair|market)\s*[:=]\s*([A-Za-z0-9._-]+)/i,
  /(?:^|\s)(dir|direction|side)\s*[:=]\s*(long|short|buy|sell)/i,
  /(?:^|\s)(vol|volume|size|lots?)\s*[:=]\s*([0-9]+(?:\.[0-9]+)?)/i,
  /(?:^|\s)(entry|open|in)\s*[:=]\s*([0-9]+(?:\.[0-9]+)?)/i,
  /(?:^|\s)(exit|close|out)\s*[:=]\s*([0-9]+(?:\.[0-9]+)?)/i,
  /(?:^|\s)(sl|stop|stoploss)\s*[:=]\s*([0-9]+(?:\.[0-9]+)?)/i,
  /(?:^|\s)(tp|target|takeprofit)\s*[:=]\s*([0-9]+(?:\.[0-9]+)?)/i,
  /(?:^|\s)(pnl|profit|p&l)\s*[:=]\s*([+\-]?[0-9]+(?:\.[0-9]+)?)/i,
  /(?:^|\s)(commission|commissions|fees?)\s*[:=]\s*([+\-]?[0-9]+(?:\.[0-9]+)?)/i,
  /(?:^|\s)(swap|carry)\s*[:=]\s*([+\-]?[0-9]+(?:\.[0-9]+)?)/i,
];

function toNumber(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDatetimeCandidate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function splitRows(text: string) {
  return text
    .split(/\r?\n+/)
    .map((row) => row.trim())
    .filter(Boolean);
}

function parseKeyValueRow(row: string) {
  const draft: Partial<ManualTradeDraft> = {};

  for (const pattern of KEY_VALUE_PATTERNS) {
    const match = row.match(pattern);
    if (!match) continue;

    const key = match[1].toLowerCase();
    const value = match[2].trim();

    if (key === "symbol" || key === "pair" || key === "market") {
      draft.symbol = value.toUpperCase();
    } else if (key === "dir" || key === "direction" || key === "side") {
      draft.tradeType = normalizeManualTradeDirection(value) ?? undefined;
    } else if (
      key === "vol" ||
      key === "volume" ||
      key === "size" ||
      key === "lot" ||
      key === "lots"
    ) {
      draft.volume = toNumber(value);
    } else if (key === "entry" || key === "open" || key === "in") {
      draft.openPrice = toNumber(value);
    } else if (key === "exit" || key === "close" || key === "out") {
      draft.closePrice = toNumber(value);
    } else if (key === "sl" || key === "stop" || key === "stoploss") {
      draft.sl = toNumber(value);
    } else if (key === "tp" || key === "target" || key === "takeprofit") {
      draft.tp = toNumber(value);
    } else if (key === "pnl" || key === "profit" || key === "p&l") {
      draft.profit = toNumber(value);
    } else if (
      key === "commission" ||
      key === "commissions" ||
      key === "fee" ||
      key === "fees"
    ) {
      draft.commissions = toNumber(value);
    } else if (key === "swap" || key === "carry") {
      draft.swap = toNumber(value);
    }
  }

  return draft;
}

function parseLooseSentence(row: string) {
  const draft: Partial<ManualTradeDraft> = {};
  const symbolMatch = row.match(/\b([A-Z]{3,6}[A-Z0-9_./-]{0,10})\b/);
  if (symbolMatch) {
    draft.symbol = symbolMatch[1].toUpperCase();
  }

  const direction = normalizeManualTradeDirection(row);
  if (direction) {
    draft.tradeType = direction;
  }

  const prices = [...row.matchAll(/([0-9]+(?:\.[0-9]+)?)/g)].map((m) =>
    Number(m[1])
  );

  if (prices.length >= 1 && draft.openPrice == null) {
    draft.openPrice = prices[0];
  }
  if (prices.length >= 2 && draft.closePrice == null) {
    draft.closePrice = prices[1];
  }
  if (prices.length >= 3 && draft.sl == null) {
    draft.sl = prices[2];
  }
  if (prices.length >= 4 && draft.tp == null) {
    draft.tp = prices[3];
  }

  return draft;
}

export function parseManualTradeCapture(text: string) {
  const rows = splitRows(text);
  if (rows.length === 0) {
    return [];
  }

  const drafts = rows.map((row) => {
    const keyValueDraft = parseKeyValueRow(row);
    const looseDraft = parseLooseSentence(row);
    const combined = {
      ...looseDraft,
      ...keyValueDraft,
    } satisfies Partial<ManualTradeDraft>;

    return {
      symbol: combined.symbol?.toUpperCase() ?? null,
      tradeType: combined.tradeType ?? null,
      volume: combined.volume ?? null,
      openPrice: combined.openPrice ?? null,
      closePrice: combined.closePrice ?? null,
      sl: combined.sl ?? null,
      tp: combined.tp ?? null,
      profit: combined.profit ?? null,
      commissions: combined.commissions ?? null,
      swap: combined.swap ?? null,
    };
  });

  return drafts.filter(
    (draft) =>
      draft.symbol ||
      draft.tradeType ||
      draft.volume != null ||
      draft.openPrice != null ||
      draft.closePrice != null
  );
}

export function inferManualTradeTimestamps(input: {
  text: string;
  openTime?: Date | string | null;
  closeTime?: Date | string | null;
}) {
  const parsedDates = [
    ...input.text.matchAll(
      /(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?(?:Z|[+\-]\d{2}:?\d{2})?)/g
    ),
  ]
    .map((match) => parseDatetimeCandidate(match[1]))
    .filter((date): date is Date => Boolean(date));

  return {
    openTime: input.openTime ?? parsedDates[0] ?? null,
    closeTime: input.closeTime ?? parsedDates[1] ?? null,
  };
}
