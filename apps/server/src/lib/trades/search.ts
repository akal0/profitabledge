import { ilike, or, sql, type SQL } from "drizzle-orm";

import { trade } from "../../db/schema/trading";

export function buildTradeSearchPredicates(query?: string | null): SQL[] {
  const trimmed = query?.trim();
  if (!trimmed) return [];

  const terms = trimmed.split(/\s+/).filter(Boolean);
  return terms.map((term) =>
    or(
      ilike(trade.symbol, `%${term}%`),
      ilike(trade.ticket, `%${term}%`),
      ilike(trade.sessionTag, `%${term}%`),
      ilike(trade.modelTag, `%${term}%`),
      ilike(trade.killzone, `%${term}%`),
      ilike(trade.protocolAlignment, `%${term}%`),
      ilike(trade.outcome, `%${term}%`),
      sql`CAST(${trade.profit} AS TEXT) ILIKE ${`%${term}%`}`
    ) as SQL
  );
}
