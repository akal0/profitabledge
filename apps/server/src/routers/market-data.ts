import { router, protectedProcedure } from "../lib/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "../db";
import { sql, eq, and, gte, lte, desc, asc } from "drizzle-orm";
import { eaCandleDataSet, eaCandle } from "../db/schema/backtest";
import { fetchDukascopyCandles } from "../lib/dukascopy";

// In-memory cache for market data (stores indefinitely for simulated data)
const marketDataCache = new Map<string, { data: any; expiry: number; permanent?: boolean }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes for real data
const PERMANENT_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours for simulated data (effectively permanent)

// ============================================================================
// SEEDED RANDOM NUMBER GENERATOR
// Provides reproducible random sequences based on a seed string
// ============================================================================
class SeededRandom {
  private seed: number;

  constructor(seedString: string) {
    // Convert seed string to a number using a hash function
    this.seed = this.hashString(seedString);
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) || 1;
  }

  // Mulberry32 algorithm - fast and good quality PRNG
  next(): number {
    let t = this.seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  // Random number in range [min, max]
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  // Gaussian (normal) distribution using Box-Muller transform
  gaussian(mean: number = 0, stdDev: number = 1): number {
    const u1 = this.next();
    const u2 = this.next();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * stdDev + mean;
  }
}

// Twelve Data API (free tier: 800 calls/day, 8 calls/minute)
const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY || "";
const TWELVE_DATA_BASE_URL = "https://api.twelvedata.com";

// Symbol mapping for Twelve Data
const symbolMap: Record<string, string> = {
  EURUSD: "EUR/USD",
  GBPUSD: "GBP/USD",
  USDJPY: "USD/JPY",
  AUDUSD: "AUD/USD",
  USDCAD: "USD/CAD",
  NZDUSD: "NZD/USD",
  USDCHF: "USD/CHF",
  EURGBP: "EUR/GBP",
  EURJPY: "EUR/JPY",
  GBPJPY: "GBP/JPY",
  XAUUSD: "XAU/USD",
  BTCUSD: "BTC/USD",
  ETHUSD: "ETH/USD",
};

// Interval mapping
const intervalMap: Record<string, string> = {
  "1m": "1min",
  "5m": "5min",
  "15m": "15min",
  "30m": "30min",
  "1h": "1h",
  "4h": "4h",
  "1d": "1day",
  "1w": "1week",
};

interface CandleData {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

// Fetch from Twelve Data API
async function fetchFromTwelveData(
  symbol: string,
  interval: string,
  outputSize: number = 500
): Promise<CandleData[]> {
  const mappedSymbol = symbolMap[symbol] || symbol;
  const mappedInterval = intervalMap[interval] || interval;

  const url = new URL(`${TWELVE_DATA_BASE_URL}/time_series`);
  url.searchParams.set("symbol", mappedSymbol);
  url.searchParams.set("interval", mappedInterval);
  url.searchParams.set("outputsize", String(outputSize));
  url.searchParams.set("apikey", TWELVE_DATA_API_KEY);

  const response = await fetch(url.toString());
  
  if (!response.ok) {
    throw new Error(`Twelve Data API error: ${response.status}`);
  }

  const data = await response.json();

  if (data.status === "error") {
    throw new Error(data.message || "Twelve Data API error");
  }

  if (!data.values || !Array.isArray(data.values)) {
    return [];
  }

  // Convert to our format (reverse to get oldest first)
  return data.values.reverse().map((candle: any) => ({
    time: Math.floor(new Date(candle.datetime).getTime() / 1000),
    open: parseFloat(candle.open),
    high: parseFloat(candle.high),
    low: parseFloat(candle.low),
    close: parseFloat(candle.close),
    volume: candle.volume ? parseInt(candle.volume) : undefined,
  }));
}

// ============================================================================
// REALISTIC SIMULATED DATA GENERATOR
// Uses seeded random for reproducibility and generates realistic market patterns
// ============================================================================

// Market session times (UTC hours)
const MARKET_SESSIONS = {
  asia: { start: 0, end: 9 },    // Tokyo session
  london: { start: 7, end: 16 }, // London session  
  nyc: { start: 13, end: 22 },   // New York session
};

// Base prices and characteristics for each instrument
const INSTRUMENT_CONFIG: Record<string, {
  basePrice: number;
  volatility: number;
  decimals: number;
  typicalSpread: number;
}> = {
  EURUSD: { basePrice: 1.0850, volatility: 0.0006, decimals: 5, typicalSpread: 0.00010 },
  GBPUSD: { basePrice: 1.2650, volatility: 0.0008, decimals: 5, typicalSpread: 0.00015 },
  USDJPY: { basePrice: 149.50, volatility: 0.0006, decimals: 3, typicalSpread: 0.010 },
  AUDUSD: { basePrice: 0.6550, volatility: 0.0007, decimals: 5, typicalSpread: 0.00012 },
  USDCAD: { basePrice: 1.3550, volatility: 0.0006, decimals: 5, typicalSpread: 0.00015 },
  NZDUSD: { basePrice: 0.6050, volatility: 0.0007, decimals: 5, typicalSpread: 0.00015 },
  USDCHF: { basePrice: 0.8850, volatility: 0.0005, decimals: 5, typicalSpread: 0.00012 },
  EURGBP: { basePrice: 0.8550, volatility: 0.0004, decimals: 5, typicalSpread: 0.00012 },
  EURJPY: { basePrice: 162.00, volatility: 0.0007, decimals: 3, typicalSpread: 0.015 },
  GBPJPY: { basePrice: 189.00, volatility: 0.0010, decimals: 3, typicalSpread: 0.020 },
  XAUUSD: { basePrice: 2050.00, volatility: 0.0025, decimals: 2, typicalSpread: 0.30 },
  BTCUSD: { basePrice: 67500.00, volatility: 0.015, decimals: 2, typicalSpread: 5.00 },
  ETHUSD: { basePrice: 3500.00, volatility: 0.018, decimals: 2, typicalSpread: 1.00 },
};

// Interval configuration
const INTERVAL_CONFIG: Record<string, { minutes: number; volatilityMult: number }> = {
  "1m": { minutes: 1, volatilityMult: 0.3 },
  "5m": { minutes: 5, volatilityMult: 0.6 },
  "15m": { minutes: 15, volatilityMult: 0.85 },
  "30m": { minutes: 30, volatilityMult: 1.0 },
  "1h": { minutes: 60, volatilityMult: 1.3 },
  "4h": { minutes: 240, volatilityMult: 2.0 },
  "1d": { minutes: 1440, volatilityMult: 3.5 },
  "1w": { minutes: 10080, volatilityMult: 6.0 },
};

// Generate realistic simulated data with seeded random
function generateSimulatedData(
  symbol: string,
  interval: string,
  numCandles: number = 500,
  seedSuffix: string = "v1" // Version suffix allows regenerating data if needed
): CandleData[] {
  // Create seeded random generator - same symbol/interval always produces same data
  const seed = `${symbol}:${interval}:${seedSuffix}`;
  const rng = new SeededRandom(seed);

  const config = INSTRUMENT_CONFIG[symbol] || INSTRUMENT_CONFIG.EURUSD;
  const intervalConfig = INTERVAL_CONFIG[interval] || INTERVAL_CONFIG["5m"];
  
  // Adjust volatility for timeframe
  const volatility = config.volatility * intervalConfig.volatilityMult;
  
  const candles: CandleData[] = [];
  
  // Use a fixed reference date for consistent timestamps
  // This ensures the same candles are always returned
  const referenceDate = new Date("2025-01-15T00:00:00Z").getTime();
  const endTime = referenceDate;
  const startTime = endTime - numCandles * intervalConfig.minutes * 60 * 1000;

  // Generate starting price with some deterministic variation
  let currentPrice = config.basePrice * (1 + rng.range(-0.02, 0.02));
  
  // Market state variables
  let trend = rng.range(-0.5, 0.5) * 0.0001; // Initial trend direction
  let trendStrength = rng.range(0.5, 1.5);   // How strong the trend is
  let trendDuration = Math.floor(rng.range(20, 80)); // How long trend lasts
  let trendCounter = 0;
  
  // Range/consolidation tracking
  let isConsolidating = false;
  let consolidationCenter = currentPrice;
  let consolidationRange = volatility * currentPrice * 3;
  let consolidationDuration = 0;
  
  // Support/resistance levels (key psychological levels)
  const keyLevels = generateKeyLevels(config.basePrice, rng);

  for (let i = 0; i < numCandles; i++) {
    const candleTime = startTime + i * intervalConfig.minutes * 60 * 1000;
    const time = Math.floor(candleTime / 1000);
    
    // Get session-based volatility multiplier
    const hour = new Date(candleTime).getUTCHours();
    const sessionVolatility = getSessionVolatility(hour, symbol);
    
    // Update trend periodically
    trendCounter++;
    if (trendCounter >= trendDuration) {
      // Chance to enter consolidation
      if (!isConsolidating && rng.next() < 0.25) {
        isConsolidating = true;
        consolidationCenter = currentPrice;
        consolidationRange = volatility * currentPrice * rng.range(2, 5);
        consolidationDuration = Math.floor(rng.range(10, 40));
      } else {
        // Start new trend
        trend = rng.gaussian(0, 0.0001) * trendStrength;
        trendStrength = rng.range(0.3, 2.0);
        trendDuration = Math.floor(rng.range(15, 100));
        trendCounter = 0;
        isConsolidating = false;
      }
    }
    
    // Handle consolidation
    if (isConsolidating) {
      consolidationDuration--;
      if (consolidationDuration <= 0) {
        isConsolidating = false;
        // Breakout direction
        trend = rng.next() > 0.5 ? Math.abs(trend) * 1.5 : -Math.abs(trend) * 1.5;
      }
    }
    
    // Calculate price movement
    let baseMove: number;
    if (isConsolidating) {
      // Mean-reverting behavior during consolidation
      const distanceFromCenter = (currentPrice - consolidationCenter) / consolidationRange;
      baseMove = -distanceFromCenter * volatility * currentPrice * 0.3;
      baseMove += rng.gaussian(0, volatility * currentPrice * 0.5);
    } else {
      // Trending behavior with mean reversion to key levels
      baseMove = trend * currentPrice;
      baseMove += rng.gaussian(0, volatility * currentPrice * sessionVolatility);
      
      // Pull toward key levels
      const nearestLevel = findNearestLevel(currentPrice, keyLevels);
      if (nearestLevel) {
        const pullStrength = 0.05 / (1 + Math.abs(currentPrice - nearestLevel) / (volatility * currentPrice * 10));
        baseMove += (nearestLevel - currentPrice) * pullStrength * rng.next();
      }
    }
    
    // Generate OHLC with realistic candle patterns
    const open = currentPrice;
    const close = currentPrice + baseMove;
    
    // Realistic wicks based on session volatility
    const candleBody = Math.abs(close - open);
    const wickVolatility = volatility * currentPrice * sessionVolatility;
    
    // Upper wick
    const upperWickRatio = rng.range(0.1, 2.0);
    const upperWick = wickVolatility * upperWickRatio * rng.next();
    
    // Lower wick  
    const lowerWickRatio = rng.range(0.1, 2.0);
    const lowerWick = wickVolatility * lowerWickRatio * rng.next();
    
    const high = Math.max(open, close) + upperWick;
    const low = Math.min(open, close) - lowerWick;
    
    // Volume - higher during trends and session overlaps
    const isSessionOverlap = 
      (hour >= 7 && hour <= 9) ||   // Asia-London overlap
      (hour >= 13 && hour <= 16);   // London-NYC overlap
    const volumeMultiplier = isSessionOverlap ? 1.5 : 1.0;
    const trendVolumeBoost = Math.abs(trend) * 50000;
    const baseVolume = 1000 + rng.range(0, 500);
    const volume = Math.floor(
      (baseVolume + trendVolumeBoost) * 
      volumeMultiplier * 
      (0.7 + rng.next() * 0.6) *
      (1 + Math.abs(baseMove) / (volatility * currentPrice))
    );

    candles.push({
      time,
      open: Number(open.toFixed(config.decimals)),
      high: Number(high.toFixed(config.decimals)),
      low: Number(low.toFixed(config.decimals)),
      close: Number(close.toFixed(config.decimals)),
      volume,
    });

    currentPrice = close;
  }

  return candles;
}

// Generate key price levels (support/resistance)
function generateKeyLevels(basePrice: number, rng: SeededRandom): number[] {
  const levels: number[] = [];
  const step = basePrice * 0.01; // 1% increments
  
  for (let i = -10; i <= 10; i++) {
    if (i !== 0 && rng.next() < 0.4) {
      levels.push(basePrice + i * step + rng.range(-step * 0.1, step * 0.1));
    }
  }
  
  return levels;
}

// Find nearest key level
function findNearestLevel(price: number, levels: number[]): number | null {
  if (levels.length === 0) return null;
  
  let nearest = levels[0];
  let minDist = Math.abs(price - nearest);
  
  for (const level of levels) {
    const dist = Math.abs(price - level);
    if (dist < minDist) {
      minDist = dist;
      nearest = level;
    }
  }
  
  return nearest;
}

// Get session-based volatility multiplier
function getSessionVolatility(hour: number, symbol: string): number {
  // Check which sessions are active
  const asiaActive = hour >= MARKET_SESSIONS.asia.start && hour <= MARKET_SESSIONS.asia.end;
  const londonActive = hour >= MARKET_SESSIONS.london.start && hour <= MARKET_SESSIONS.london.end;
  const nycActive = hour >= MARKET_SESSIONS.nyc.start && hour <= MARKET_SESSIONS.nyc.end;
  
  let volatility = 0.7; // Base quiet hours
  
  // Session-specific adjustments
  if (symbol.includes("JPY") && asiaActive) {
    volatility = 1.2;
  } else if ((symbol.includes("EUR") || symbol.includes("GBP")) && londonActive) {
    volatility = 1.3;
  } else if (symbol.includes("USD") && nycActive) {
    volatility = 1.2;
  }
  
  // Session overlaps are most volatile
  if (londonActive && nycActive) {
    volatility = 1.5;
  } else if (asiaActive && londonActive) {
    volatility = 1.3;
  }
  
  // Weekend/quiet hours
  if (!asiaActive && !londonActive && !nycActive) {
    volatility = 0.4;
  }
  
  return volatility;
}

export const marketDataRouter = router({
  // Get historical candle data
  getCandles: protectedProcedure
    .input(
      z.object({
        symbol: z.string().min(1),
        interval: z.enum(["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"]),
        limit: z.number().min(10).max(1000).optional().default(500),
        useRealData: z.boolean().optional().default(false),
      })
    )
    .query(async ({ input }) => {
      const { symbol, interval, limit, useRealData } = input;
      const cacheKey = `candles:${symbol}:${interval}:${limit}`;

      // Check cache first
      const cached = marketDataCache.get(cacheKey);
      if (cached && (cached.permanent || cached.expiry > Date.now())) {
        return { 
          candles: cached.data, 
          source: cached.permanent ? "simulated-cached" : "cache",
          isCached: true,
        };
      }

      let candles: CandleData[] = [];
      let source = "simulated";
      let isPermanent = false;

      // Try to fetch real data if API key is configured and requested
      if (useRealData && TWELVE_DATA_API_KEY) {
        try {
          candles = await fetchFromTwelveData(symbol, interval, limit);
          source = "twelvedata";
        } catch (error) {
          console.error("[marketData.getCandles] API error:", error);
          // Fall back to simulated data
          candles = generateSimulatedData(symbol, interval, limit);
          isPermanent = true;
        }
      } else {
        // Generate simulated data (deterministic - same input = same output)
        candles = generateSimulatedData(symbol, interval, limit);
        source = "simulated";
        isPermanent = true; // Simulated data never changes, cache permanently
      }

      // Cache the result
      marketDataCache.set(cacheKey, {
        data: candles,
        expiry: Date.now() + (isPermanent ? PERMANENT_CACHE_TTL : CACHE_TTL),
        permanent: isPermanent,
      });

      return { candles, source, isCached: false };
    }),

  // Get current price for a symbol
  getCurrentPrice: protectedProcedure
    .input(z.object({ symbol: z.string().min(1) }))
    .query(async ({ input }) => {
      const { symbol } = input;
      const cacheKey = `price:${symbol}`;

      // Check cache
      const cached = marketDataCache.get(cacheKey);
      if (cached && cached.expiry > Date.now()) {
        return cached.data;
      }

      // If API key available, try to get real price
      if (TWELVE_DATA_API_KEY) {
        try {
          const mappedSymbol = symbolMap[symbol] || symbol;
          const url = new URL(`${TWELVE_DATA_BASE_URL}/price`);
          url.searchParams.set("symbol", mappedSymbol);
          url.searchParams.set("apikey", TWELVE_DATA_API_KEY);

          const response = await fetch(url.toString());
          const data = await response.json();

          if (data.price) {
            const result = {
              symbol,
              price: parseFloat(data.price),
              timestamp: Date.now(),
              source: "twelvedata",
            };
            marketDataCache.set(cacheKey, {
              data: result,
              expiry: Date.now() + 10000, // 10 second cache for live price
            });
            return result;
          }
        } catch (error) {
          console.error("[marketData.getCurrentPrice] API error:", error);
        }
      }

      // Return simulated price
      const startPrices: Record<string, number> = {
        EURUSD: 1.08,
        GBPUSD: 1.26,
        USDJPY: 148,
        AUDUSD: 0.65,
        USDCAD: 1.35,
        NZDUSD: 0.60,
        USDCHF: 0.88,
        EURGBP: 0.85,
        EURJPY: 160,
        GBPJPY: 187,
        XAUUSD: 2000,
        BTCUSD: 45000,
        ETHUSD: 2500,
      };

      return {
        symbol,
        price: startPrices[symbol] || 1.0,
        timestamp: Date.now(),
        source: "simulated",
      };
    }),

  // Get available symbols
  getSymbols: protectedProcedure.query(async () => {
    return Object.keys(symbolMap).map((symbol) => ({
      symbol,
      displayName: symbolMap[symbol],
      category: symbol.includes("XAU") || symbol.includes("XAG")
        ? "commodities"
        : symbol.includes("BTC") || symbol.includes("ETH")
        ? "crypto"
        : "forex",
    }));
  }),

  // Fetch historical candles from Dukascopy with DB caching
  fetchHistoricalCandles: protectedProcedure
    .input(
      z.object({
        symbol: z.string().min(1),
        timeframe: z.enum(["m1", "m5", "m15", "m30", "h1", "h4", "d1"]),
        from: z.string(), // ISO date string
        to: z.string(),   // ISO date string
      })
    )
    .query(async ({ ctx, input }) => {
      const { symbol, timeframe, from: fromStr, to: toStr } = input;
      const userId = ctx.session.user.id;
      const fromDate = new Date(fromStr);
      const toDate = new Date(toStr);
      const fromUnix = Math.floor(fromDate.getTime() / 1000);
      const toUnix = Math.floor(toDate.getTime() / 1000);

      // Check if we have this data cached in DB
      const existing = await db
        .select()
        .from(eaCandleDataSet)
        .where(
          and(
            eq(eaCandleDataSet.userId, userId),
            eq(eaCandleDataSet.symbol, symbol),
            eq(eaCandleDataSet.timeframe, timeframe),
            lte(eaCandleDataSet.startTime, fromDate),
            gte(eaCandleDataSet.endTime, toDate)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Return cached candles from DB
        const candles = await db
          .select({
            time: eaCandle.timeUnix,
            open: eaCandle.open,
            high: eaCandle.high,
            low: eaCandle.low,
            close: eaCandle.close,
            volume: eaCandle.volume,
          })
          .from(eaCandle)
          .where(
            and(
              eq(eaCandle.dataSetId, existing[0].id),
              gte(eaCandle.timeUnix, fromUnix),
              lte(eaCandle.timeUnix, toUnix)
            )
          )
          .orderBy(asc(eaCandle.timeUnix));

        // If dataset exists but has no candles, it's corrupted — delete it and re-fetch
        if (candles.length === 0) {
          console.log(`[Dukascopy] Stale dataset ${existing[0].id} found with no candles, removing...`);
          await db.delete(eaCandleDataSet).where(eq(eaCandleDataSet.id, existing[0].id));
          // Fall through to fetch from Dukascopy below
        } else {
          return {
            candles: candles.map((c) => ({
              time: c.time,
              open: Number(c.open),
              high: Number(c.high),
              low: Number(c.low),
              close: Number(c.close),
              volume: Number(c.volume ?? 0),
            })),
            source: "cached" as const,
            dataSetId: existing[0].id,
          };
        }
      }

      // Fetch from Dukascopy
      console.log(`[Dukascopy] Fetching ${symbol} ${timeframe} from ${fromStr} to ${toStr}...`);
      let candles: Awaited<ReturnType<typeof fetchDukascopyCandles>>;
      try {
        candles = await fetchDukascopyCandles(symbol, timeframe, fromDate, toDate);
      } catch (fetchErr: any) {
        console.error(`[Dukascopy] Fetch failed:`, fetchErr?.message || fetchErr);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to fetch data from Dukascopy: ${fetchErr?.message || "Unknown error"}`,
        });
      }
      console.log(`[Dukascopy] Got ${candles.length} candles`);

      if (candles.length === 0) {
        return { candles: [], source: "dukascopy" as const, dataSetId: null };
      }

      // Store in DB for future use
      try {
        const [dataSet] = await db
          .insert(eaCandleDataSet)
          .values({
            userId,
            name: `${symbol} ${timeframe} ${fromStr} to ${toStr}`,
            symbol,
            timeframe,
            startTime: fromDate,
            endTime: toDate,
            candleCount: candles.length,
            uploadedFrom: "api",
            hasVolume: true,
            status: "active",
          })
          .returning({ id: eaCandleDataSet.id });

        // Bulk insert candles in batches of 500
        const BATCH_SIZE = 500;
        for (let i = 0; i < candles.length; i += BATCH_SIZE) {
          const batch = candles.slice(i, i + BATCH_SIZE);
          await db.insert(eaCandle).values(
            batch.map((c) => ({
              dataSetId: dataSet.id,
              time: new Date(c.time * 1000),
              timeUnix: c.time,
              open: String(c.open),
              high: String(c.high),
              low: String(c.low),
              close: String(c.close),
              volume: String(c.volume),
            }))
          );
        }

        return {
          candles,
          source: "dukascopy" as const,
          dataSetId: dataSet.id,
        };
      } catch (dbErr: any) {
        console.error(`[Dukascopy] DB cache store failed:`, dbErr?.message || dbErr);
        // Still return the candles even if caching failed
        return {
          candles,
          source: "dukascopy" as const,
          dataSetId: null,
        };
      }
    }),

  // Clear cache (for admin/debugging)
  clearCache: protectedProcedure.mutation(async () => {
    marketDataCache.clear();
    return { success: true, message: "Cache cleared" };
  }),

  // Clear DB candle cache for a specific symbol/timeframe or all
  clearCandleCache: protectedProcedure
    .input(z.object({
      symbol: z.string().optional(),
      timeframe: z.string().optional(),
    }).optional())
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const filters: any[] = [eq(eaCandleDataSet.userId, userId)];
      if (input?.symbol) filters.push(eq(eaCandleDataSet.symbol, input.symbol));
      if (input?.timeframe) filters.push(eq(eaCandleDataSet.timeframe, input.timeframe));

      // Get dataset IDs to delete their candles
      const datasets = await db
        .select({ id: eaCandleDataSet.id })
        .from(eaCandleDataSet)
        .where(and(...filters));

      for (const ds of datasets) {
        await db.delete(eaCandle).where(eq(eaCandle.dataSetId, ds.id));
      }
      await db.delete(eaCandleDataSet).where(and(...filters));

      return { success: true, deleted: datasets.length };
    }),
});
