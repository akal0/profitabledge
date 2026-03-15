type SerializableSessionDates = {
  startDate: Date | string | null;
  endDate: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  completedAt: Date | string | null;
};

type SerializableTradeDates = {
  entryTime: Date | string;
  exitTime: Date | string | null;
  createdAt: Date | string;
};

export function serializeSession<T extends SerializableSessionDates>(
  session: T
) {
  return {
    ...session,
    startDate:
      session.startDate instanceof Date
        ? session.startDate.toISOString()
        : session.startDate ?? null,
    endDate:
      session.endDate instanceof Date
        ? session.endDate.toISOString()
        : session.endDate ?? null,
    createdAt:
      session.createdAt instanceof Date
        ? session.createdAt.toISOString()
        : session.createdAt,
    updatedAt:
      session.updatedAt instanceof Date
        ? session.updatedAt.toISOString()
        : session.updatedAt,
    completedAt:
      session.completedAt instanceof Date
        ? session.completedAt.toISOString()
        : session.completedAt ?? null,
  };
}

export function serializeTrade<T extends SerializableTradeDates>(trade: T) {
  return {
    ...trade,
    entryTime:
      trade.entryTime instanceof Date
        ? trade.entryTime.toISOString()
        : trade.entryTime,
    exitTime:
      trade.exitTime instanceof Date
        ? trade.exitTime.toISOString()
        : trade.exitTime ?? null,
    createdAt:
      trade.createdAt instanceof Date
        ? trade.createdAt.toISOString()
        : trade.createdAt,
  };
}

export function numberOrNull(value: unknown) {
  if (value === null || value === undefined) return null;
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export function deriveBacktestSessionTag(entryTime: Date) {
  const hour = entryTime.getUTCHours();
  if (hour >= 13 && hour < 16) return "London / New York";
  if (hour >= 7 && hour < 11) return "London";
  if (hour >= 12 && hour < 20) return "New York";
  if (hour >= 0 && hour < 6) return "Asia";
  return "Core";
}

export function extractBacktestTag(tags: unknown, prefix: string) {
  if (!Array.isArray(tags)) return null;
  const match = tags.find(
    (value): value is string =>
      typeof value === "string" && value.startsWith(prefix)
  );
  return match ? match.slice(prefix.length) : null;
}
