import "dotenv/config";
import { getHistoricalRates } from "dukascopy-node";
import { db } from "../db";
import { historicalPrices } from "../db/schema/trading";

type CliOptions = {
  instrument: string;
  months: number[];
  year: number;
  timeframe: string;
  pauseMs: number;
  chunkSize: number;
  format: "json" | "array" | "csv";
  priceType: "bid" | "ask";
  logRaw: boolean;
  bothSides: boolean;
  mergeSides: boolean;
};

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);

  const getFlag = (name: string) => {
    const idx = args.findIndex((a) => a === `--${name}`);
    if (idx !== -1) return args[idx + 1];
    const withEq = args.find((a) => a.startsWith(`--${name}=`));
    if (withEq) return withEq.split("=")[1];
    return undefined;
  };

  const monthsStr = getFlag("months") || process.env.DUKA_MONTHS || "2,3,5";
  const months = monthsStr
    .split(",")
    .map((m) => parseInt(m.trim(), 10))
    .filter((m) => !Number.isNaN(m) && m >= 1 && m <= 12);

  const instrument = (
    getFlag("instrument") ||
    process.env.DUKA_INSTRUMENT ||
    "eurusd"
  ).toLowerCase();

  const timeframe = (
    getFlag("timeframe") ||
    process.env.DUKA_TIMEFRAME ||
    "m15"
  ).toLowerCase();

  const pauseMs = parseInt(
    getFlag("pauseMs") || process.env.DUKA_PAUSE_MS || "250",
    10
  );

  const chunkSize = parseInt(
    getFlag("chunkSize") || process.env.DUKA_CHUNK_SIZE || "2000",
    10
  );

  const format = (
    getFlag("format") ||
    process.env.DUKA_FORMAT ||
    "json"
  ).toLowerCase() as CliOptions["format"];

  const priceType = (
    getFlag("priceType") ||
    process.env.DUKA_PRICE_TYPE ||
    "bid"
  ).toLowerCase() as CliOptions["priceType"];

  const logRaw = ["1", "true", "yes"].includes(
    (getFlag("logRaw") || process.env.DUKA_LOG_RAW || "false").toLowerCase()
  );

  const bothSides = ["1", "true", "yes"].includes(
    (
      getFlag("bothSides") ||
      process.env.DUKA_BOTH_SIDES ||
      "true"
    ).toLowerCase()
  );

  const mergeSides = ["1", "true", "yes"].includes(
    (
      getFlag("mergeSides") ||
      process.env.DUKA_MERGE_SIDES ||
      "true"
    ).toLowerCase()
  );

  const year = parseInt(
    getFlag("year") ||
      process.env.DUKA_YEAR ||
      String(new Date().getUTCFullYear()),
    10
  );

  return {
    instrument,
    months,
    year,
    timeframe,
    pauseMs,
    chunkSize,
    format,
    priceType,
    logRaw,
    bothSides,
    mergeSides,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0,
      0,
      0,
      0
    )
  );
}

function addUtcDays(date: Date, days: number) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function monthBoundsUtc(
  year: number,
  month1to12: number
): { from: Date; to: Date } {
  const from = new Date(Date.UTC(year, month1to12 - 1, 1, 0, 0, 0, 0));
  const to = new Date(Date.UTC(year, month1to12, 1, 0, 0, 0, 0));
  return { from, to };
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function normalizeTimestampToDate(value: unknown): Date | null {
  if (typeof value === "number") {
    const ms = value < 1e12 ? value * 1000 : value; // handle seconds
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "string") {
    // try parse int first
    const num = Number(value);
    if (Number.isFinite(num)) {
      const ms = num < 1e12 ? num * 1000 : num;
      const d = new Date(ms);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    // fallback to Date parse
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  return null;
}

async function downloadMonth(options: CliOptions, month: number) {
  const symbolUpper = options.instrument.toUpperCase();
  const { from: monthFrom, to: monthTo } = monthBoundsUtc(options.year, month);
  let current = startOfUtcDay(monthFrom);

  console.log(
    `[duka] ${symbolUpper} ${options.timeframe} ${options.year}-${String(
      month
    ).padStart(2, "0")} starting...`
  );

  while (current < monthTo) {
    const dayFrom = startOfUtcDay(current);
    const dayTo = addUtcDays(dayFrom, 1);

    try {
      const sides =
        options.timeframe === "tick" || !options.bothSides
          ? [options.priceType]
          : (["bid", "ask"] as const);

      // Merge Bid+Ask into a single candle row per timestamp
      if (
        options.timeframe !== "tick" &&
        options.mergeSides &&
        sides.length === 2
      ) {
        const [bidData, askData] = await Promise.all([
          getHistoricalRates({
            instrument: options.instrument,
            dates: { from: dayFrom, to: dayTo },
            timeframe: options.timeframe as any,
            format: options.format,
            priceType: "bid" as any,
            volumes: true,
            ignoreFlats: true,
            batchSize: 10,
            pauseBetweenBatchesMs: 1000,
          } as any),
          getHistoricalRates({
            instrument: options.instrument,
            dates: { from: dayFrom, to: dayTo },
            timeframe: options.timeframe as any,
            format: options.format,
            priceType: "ask" as any,
            volumes: true,
            ignoreFlats: true,
            batchSize: 10,
            pauseBetweenBatchesMs: 1000,
          } as any),
        ]);

        if (options.logRaw) {
          const logSide = (side: string, data: any) => {
            const sample = Array.isArray(data) ? data.slice(0, 3) : data;
            console.log(
              `[duka][raw] ${symbolUpper} ${options.timeframe} ${
                options.format
              } ${side} ${options.year}-${String(month).padStart(
                2,
                "0"
              )}-${String(dayFrom.getUTCDate()).padStart(2, "0")} count=${
                Array.isArray(data) ? data.length : typeof data
              }`
            );
            console.dir(sample, { depth: null });
          };
          logSide("bid", bidData);
          logSide("ask", askData);
        }

        const toMap = (data: any) => {
          const arr = Array.isArray(data) ? (data as any[]) : [];
          const map = new Map<
            number,
            { time: Date; o: number; h: number; l: number; c: number }
          >();
          for (const item of arr) {
            if (options.format === "array" && Array.isArray(item)) {
              // [timestamp, open, high, low, close, volume]
              const [ts, o, h, l, c] = item as [
                number,
                number,
                number,
                number,
                number,
                number?
              ];
              const when = normalizeTimestampToDate(ts);
              if (!when) continue;
              map.set(when.getTime(), {
                time: when,
                o: Number(o),
                h: Number(h),
                l: Number(l),
                c: Number(c),
              });
            } else {
              const when = normalizeTimestampToDate(
                (item as any).timestamp ??
                  (item as any).time ??
                  (item as any).date
              );
              if (!when) continue;
              map.set(when.getTime(), {
                time: when,
                o: Number((item as any).open),
                h: Number((item as any).high),
                l: Number((item as any).low),
                c: Number((item as any).close),
              });
            }
          }
          return map;
        };

        const bidMap = toMap(bidData);
        const askMap = toMap(askData);
        const keys = new Set<number>([...bidMap.keys(), ...askMap.keys()]);
        const rows = [...keys].map((ts) => {
          const bid = bidMap.get(ts);
          const ask = askMap.get(ts);
          const when = new Date(ts);
          return {
            id: `${symbolUpper}-${options.timeframe}-${Math.trunc(ts)}`,
            symbol: symbolUpper,
            timeframe: options.timeframe,
            time: when,
            openBid: bid?.o ?? null,
            highBid: bid?.h ?? null,
            lowBid: bid?.l ?? null,
            closeBid: bid?.c ?? null,
            openAsk: ask?.o ?? null,
            highAsk: ask?.h ?? null,
            lowAsk: ask?.l ?? null,
            closeAsk: ask?.c ?? null,
          } as const;
        });

        const chunks = chunkArray(rows, options.chunkSize);
        let inserted = 0;
        for (const chunk of chunks) {
          await db
            .insert(historicalPrices)
            .values(chunk as any)
            .onConflictDoNothing();
          inserted += chunk.length;
        }

        console.log(
          `[duka] Saved ${inserted} merged records for ${symbolUpper} on ${
            options.year
          }-${String(month).padStart(2, "0")}-${String(
            dayFrom.getUTCDate()
          ).padStart(2, "0")}`
        );

        // advance to next day
        current = dayTo;
        if (options.pauseMs > 0) await sleep(options.pauseMs);
        continue;
      }

      for (const side of sides) {
        const data = await getHistoricalRates({
          instrument: options.instrument,
          dates: { from: dayFrom, to: dayTo },
          timeframe: options.timeframe as any,
          format: options.format,
          priceType: side as any,
          volumes: true,
          ignoreFlats: true,
          batchSize: 10,
          pauseBetweenBatchesMs: 1000,
        } as any);

        const sampleOut = Array.isArray(data) ? data.slice(0, 3) : data;
        console.log(
          `[duka][raw] ${symbolUpper} ${options.timeframe} ${
            options.format
          } ${side} ${options.year}-${String(month).padStart(2, "0")}-${String(
            dayFrom.getUTCDate()
          ).padStart(2, "0")} count=${
            Array.isArray(data) ? data.length : typeof data
          }`
        );
        console.dir(sampleOut, { depth: null });

        const items: any[] = Array.isArray(data) ? data : [];
        if (!items || items.length === 0) {
          console.log(
            `[duka] ${symbolUpper} ${options.year}-${String(month).padStart(
              2,
              "0"
            )}-${String(dayFrom.getUTCDate()).padStart(
              2,
              "0"
            )} no data (${side})`
          );
          continue;
        }

        const rows = items
          .map((item) => {
            if (options.timeframe !== "tick") {
              if (options.format === "array" && Array.isArray(item)) {
                const [ts, o, h, l, c] = item as [
                  number,
                  number,
                  number,
                  number,
                  number,
                  number?
                ];
                const when = normalizeTimestampToDate(ts);
                if (!when) return null;
                return {
                  id: `${symbolUpper}-${options.timeframe}-${side}-${Math.trunc(
                    when.getTime()
                  )}`,
                  symbol: symbolUpper,
                  timeframe: options.timeframe,
                  priceType: side,
                  time: when,
                  open: Number(o),
                  high: Number(h),
                  low: Number(l),
                  close: Number(c),
                  bidPrice: null,
                  askPrice: null,
                  bidVolume: null,
                  askVolume: null,
                } as const;
              }
              const when = normalizeTimestampToDate(
                (item as any).timestamp ??
                  (item as any).time ??
                  (item as any).date
              );
              if (!when) return null;
              return {
                id: `${symbolUpper}-${options.timeframe}-${side}-${Math.trunc(
                  when.getTime()
                )}`,
                symbol: symbolUpper,
                timeframe: options.timeframe,
                priceType: side,
                time: when,
                open: Number((item as any).open),
                high: Number((item as any).high),
                low: Number((item as any).low),
                close: Number((item as any).close),
                bidPrice: null,
                askPrice: null,
                bidVolume: null,
                askVolume: null,
              } as const;
            }

            // tick timeframe: keep both bid/ask from each item
            if (options.format === "array" && Array.isArray(item)) {
              const [ts, ask, bid, aVol, bVol] = item as [
                number,
                number,
                number,
                number,
                number
              ];
              const when = normalizeTimestampToDate(ts);
              if (!when) return null;
              return {
                id: `${symbolUpper}-${options.timeframe}-${Math.trunc(
                  when.getTime()
                )}`,
                symbol: symbolUpper,
                timeframe: options.timeframe,
                time: when,
                bidPrice: Number(bid),
                askPrice: Number(ask),
                bidVolume: Number(bVol),
                askVolume: Number(aVol),
              } as const;
            }

            const when = normalizeTimestampToDate(
              (item as any).timestamp ??
                (item as any).time ??
                (item as any).ts ??
                (item as any).date
            );
            if (!when) return null;
            return {
              id: `${symbolUpper}-${options.timeframe}-${Math.trunc(
                when.getTime()
              )}`,
              symbol: symbolUpper,
              timeframe: options.timeframe,
              time: when,
              bidPrice: Number.isFinite((item as any).bidPrice)
                ? (item as any).bidPrice
                : null,
              askPrice: Number.isFinite((item as any).askPrice)
                ? (item as any).askPrice
                : null,
              bidVolume: Number.isFinite((item as any).bidVolume)
                ? (item as any).bidVolume
                : null,
              askVolume: Number.isFinite((item as any).askVolume)
                ? (item as any).askVolume
                : null,
            } as const;
          })
          .filter((r): r is NonNullable<typeof r> => r !== null);

        const chunks = chunkArray(rows, options.chunkSize);
        let inserted = 0;
        for (const chunk of chunks) {
          await db
            .insert(historicalPrices)
            .values(chunk as any)
            .onConflictDoNothing();
          inserted += chunk.length;
        }

        console.log(
          `[duka] Saved ${inserted} records for ${symbolUpper} on ${
            options.year
          }-${String(month).padStart(2, "0")}-${String(
            dayFrom.getUTCDate()
          ).padStart(2, "0")} (${side})`
        );
      }
    } catch (error) {
      console.error(
        `[duka] Error for ${symbolUpper} on ${options.year}-${String(
          month
        ).padStart(2, "0")}-${String(dayFrom.getUTCDate()).padStart(2, "0")}:`,
        error
      );
    }

    current = dayTo;
    if (options.pauseMs > 0) await sleep(options.pauseMs);
  }
}

async function main() {
  const options = parseArgs();
  if (!process.env.DATABASE_URL) {
    console.warn(
      "DATABASE_URL is not set. The script will fail to insert into DB."
    );
  }

  for (const m of options.months) {
    await downloadMonth(options, m);
  }

  console.log("[duka] Done.");
}

main().catch((err) => {
  console.error("[duka] Fatal error:", err);
  process.exit(1);
});
