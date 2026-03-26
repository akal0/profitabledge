interface Mt5RuntimePostExitTrackingEntry {
  tradeKey: string;
  symbol: string;
  side: "buy" | "sell";
  closeTime: string;
  trackingEndTime: string;
  entryExpectedPrice: number | null;
  entrySpreadPips: number | null;
  lastBid: number | null;
  lastAsk: number | null;
  lastQuoteTime: string | null;
  exitReferenceBid: number | null;
  exitReferenceAsk: number | null;
  exitReferenceTime: string | null;
}

export interface Mt5ConnectionRuntimeState {
  postExitTracking: Mt5RuntimePostExitTrackingEntry[];
  postExitBoostUntil: string | null;
  quoteCursorBySymbol: Record<string, string>;
  postExitTrackingSeconds: number | null;
  updatedAt: string | null;
}

function asRecord(
  value: unknown
): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parsePositiveInteger(value: unknown) {
  const parsed = parseFiniteNumber(value);
  if (parsed == null) {
    return null;
  }

  const integer = Math.trunc(parsed);
  return integer > 0 ? integer : null;
}

function parseIsoTimestamp(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseSide(value: unknown) {
  return value === "buy" || value === "sell" ? value : null;
}

export function sanitizeMt5RuntimeState(
  value: unknown,
  now: Date = new Date()
): Mt5ConnectionRuntimeState {
  const runtime = asRecord(value);
  const rawTracking = Array.isArray(runtime?.postExitTracking)
    ? runtime.postExitTracking
    : [];
  const postExitTracking = rawTracking
    .map((entry) => {
      const record = asRecord(entry);
      if (!record) {
        return null;
      }

      const tradeKey =
        typeof record.tradeKey === "string" ? record.tradeKey.trim() : "";
      const symbol =
        typeof record.symbol === "string" ? record.symbol.trim().toUpperCase() : "";
      const side = parseSide(record.side);
      const closeTime = parseIsoTimestamp(record.closeTime);
      const trackingEndTime = parseIsoTimestamp(record.trackingEndTime);
      if (
        !tradeKey ||
        !symbol ||
        !side ||
        !closeTime ||
        !trackingEndTime ||
        new Date(trackingEndTime).getTime() <= now.getTime()
      ) {
        return null;
      }

      return {
        tradeKey,
        symbol,
        side,
        closeTime,
        trackingEndTime,
        entryExpectedPrice: parseFiniteNumber(record.entryExpectedPrice),
        entrySpreadPips: parseFiniteNumber(record.entrySpreadPips),
        lastBid: parseFiniteNumber(record.lastBid),
        lastAsk: parseFiniteNumber(record.lastAsk),
        lastQuoteTime: parseIsoTimestamp(record.lastQuoteTime),
        exitReferenceBid: parseFiniteNumber(record.exitReferenceBid),
        exitReferenceAsk: parseFiniteNumber(record.exitReferenceAsk),
        exitReferenceTime: parseIsoTimestamp(record.exitReferenceTime),
      } satisfies Mt5RuntimePostExitTrackingEntry;
    })
    .filter(
      (entry): entry is Mt5RuntimePostExitTrackingEntry => entry !== null
    )
    .sort(
      (left, right) =>
        new Date(left.trackingEndTime).getTime() -
        new Date(right.trackingEndTime).getTime()
    );

  const activeTrackingSymbols = new Set(
    postExitTracking.map((entry) => entry.symbol)
  );
  const rawQuoteCursorBySymbol = asRecord(runtime?.quoteCursorBySymbol);
  const quoteCursorEntries = Object.entries(rawQuoteCursorBySymbol ?? {}).map(
    ([symbol, timestamp]) =>
      [symbol.trim().toUpperCase(), parseIsoTimestamp(timestamp)] as const
  );
  const quoteCursorBySymbol = Object.fromEntries(
    quoteCursorEntries
      .filter(
        (entry): entry is [string, string] =>
          entry[0].length > 0 &&
          entry[1] !== null &&
          (activeTrackingSymbols.size === 0 || activeTrackingSymbols.has(entry[0]))
      )
  );
  const persistedBoostUntil = parseIsoTimestamp(runtime?.postExitBoostUntil);
  const trackedBoostUntil =
    postExitTracking[postExitTracking.length - 1]?.trackingEndTime ?? null;
  const postExitBoostUntil = [persistedBoostUntil, trackedBoostUntil]
    .filter((value): value is string => value != null)
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0];

  return {
    postExitTracking,
    postExitBoostUntil:
      postExitBoostUntil &&
      new Date(postExitBoostUntil).getTime() > now.getTime()
        ? postExitBoostUntil
        : null,
    quoteCursorBySymbol,
    postExitTrackingSeconds: parsePositiveInteger(runtime?.postExitTrackingSeconds),
    updatedAt: parseIsoTimestamp(runtime?.updatedAt),
  };
}

export function getMt5RuntimeState(
  meta: unknown,
  now: Date = new Date()
) {
  const record = asRecord(meta);
  return sanitizeMt5RuntimeState(record?.mt5Runtime, now);
}

export function withMt5RuntimeState(
  meta: Record<string, unknown> | null | undefined,
  runtimeState: Mt5ConnectionRuntimeState
) {
  const currentMeta = meta ?? {};
  const currentRuntime = asRecord(currentMeta.mt5Runtime) ?? {};

  return {
    ...currentMeta,
    mt5Runtime: {
      ...currentRuntime,
      postExitTracking: runtimeState.postExitTracking,
      postExitBoostUntil: runtimeState.postExitBoostUntil,
      quoteCursorBySymbol: runtimeState.quoteCursorBySymbol,
      postExitTrackingSeconds: runtimeState.postExitTrackingSeconds,
      updatedAt: runtimeState.updatedAt ?? new Date().toISOString(),
    },
  };
}
