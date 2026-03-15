import { z } from "zod";

export const mt5RawPayloadSchema = z.record(z.string(), z.unknown());
export const mt5DateTimeSchema = z.string().datetime({ offset: true });
const mt5ExecutionContextSchema = z.object({
  tradeKey: z.string().min(1),
  positionId: z.string().nullable().optional(),
  symbol: z.string().min(1),
  side: z.enum(["buy", "sell"]),
  lifecycleState: z.enum(["active", "post_exit"]),
  entryExpectedPrice: z.number().nullable().optional(),
  entrySpreadPips: z.number().nullable().optional(),
  lastBid: z.number().nullable().optional(),
  lastAsk: z.number().nullable().optional(),
  lastQuoteTime: mt5DateTimeSchema.nullable().optional(),
  exitReferenceBid: z.number().nullable().optional(),
  exitReferenceAsk: z.number().nullable().optional(),
  exitReferenceTime: mt5DateTimeSchema.nullable().optional(),
  closeTime: mt5DateTimeSchema.nullable().optional(),
});
const mt5SymbolSpecSchema = z.object({
  symbol: z.string().min(1),
  canonicalSymbol: z.string().nullable().optional(),
  digits: z.number().int().nullable().optional(),
  pointSize: z.number().positive().nullable().optional(),
  tickSize: z.number().positive().nullable().optional(),
  contractSize: z.number().positive().nullable().optional(),
  pipSize: z.number().positive().nullable().optional(),
  spreadPoints: z.number().int().nullable().optional(),
  spreadFloat: z.boolean().nullable().optional(),
  currencyBase: z.string().nullable().optional(),
  currencyProfit: z.string().nullable().optional(),
  currencyMargin: z.string().nullable().optional(),
  path: z.string().nullable().optional(),
  snapshotTime: mt5DateTimeSchema,
  rawPayload: mt5RawPayloadSchema.optional(),
});

export const mt5SyncFrameSchema = z.object({
  connectionId: z.string().min(1),
  session: z
    .object({
      workerHostId: z.string().min(1).optional(),
      sessionKey: z.string().min(1).optional(),
      status: z.string().min(1).optional(),
      lastError: z.string().min(1).nullable().optional(),
      heartbeatAt: mt5DateTimeSchema.optional(),
      lastLoginAt: mt5DateTimeSchema.optional(),
      meta: mt5RawPayloadSchema.optional(),
    })
    .optional(),
  account: z.object({
    login: z.string().min(1),
    serverName: z.string().min(1),
    brokerName: z.string().min(1),
    currency: z.string().min(1),
    leverage: z.number().int().nullable().optional(),
    balance: z.number(),
    equity: z.number(),
    margin: z.number().nullable().optional(),
    freeMargin: z.number().nullable().optional(),
    marginLevel: z.number().nullable().optional(),
    snapshotTime: mt5DateTimeSchema,
    rawPayload: mt5RawPayloadSchema.optional(),
  }),
  positions: z
    .array(
      z.object({
        remotePositionId: z.string().min(1),
        side: z.enum(["buy", "sell"]),
        symbol: z.string().min(1),
        volume: z.number().positive(),
        openPrice: z.number(),
        currentPrice: z.number().nullable().optional(),
        profit: z.number().nullable().optional(),
        swap: z.number().nullable().optional(),
        commission: z.number().nullable().optional(),
        sl: z.number().nullable().optional(),
        tp: z.number().nullable().optional(),
        comment: z.string().nullable().optional(),
        magicNumber: z.number().int().nullable().optional(),
        openTime: mt5DateTimeSchema,
        snapshotTime: mt5DateTimeSchema.optional(),
        rawPayload: mt5RawPayloadSchema.optional(),
      })
    )
    .default([]),
  deals: z
    .array(
      z.object({
        remoteDealId: z.string().min(1),
        remoteOrderId: z.string().nullable().optional(),
        positionId: z.string().nullable().optional(),
        entryType: z.enum(["in", "out", "inout", "out_by"]),
        side: z.enum(["buy", "sell"]),
        symbol: z.string().min(1),
        volume: z.number().nonnegative(),
        price: z.number(),
        profit: z.number().nullable().optional(),
        commission: z.number().nullable().optional(),
        swap: z.number().nullable().optional(),
        fee: z.number().nullable().optional(),
        sl: z.number().nullable().optional(),
        tp: z.number().nullable().optional(),
        comment: z.string().nullable().optional(),
        eventTime: mt5DateTimeSchema,
        rawPayload: mt5RawPayloadSchema.optional(),
      })
    )
    .default([]),
  orders: z
    .array(
      z.object({
        eventKey: z.string().min(1),
        remoteOrderId: z.string().min(1),
        positionId: z.string().nullable().optional(),
        side: z.enum(["buy", "sell"]).nullable().optional(),
        orderType: z.string().nullable().optional(),
        state: z.string().nullable().optional(),
        symbol: z.string().nullable().optional(),
        requestedVolume: z.number().nullable().optional(),
        filledVolume: z.number().nullable().optional(),
        price: z.number().nullable().optional(),
        sl: z.number().nullable().optional(),
        tp: z.number().nullable().optional(),
        comment: z.string().nullable().optional(),
        eventTime: mt5DateTimeSchema,
        rawPayload: mt5RawPayloadSchema.optional(),
      })
    )
    .default([]),
  ledgerEvents: z
    .array(
      z.object({
        remoteDealId: z.string().min(1),
        remoteOrderId: z.string().nullable().optional(),
        positionId: z.string().nullable().optional(),
        ledgerType: z.string().min(1).nullable().optional(),
        amount: z.number(),
        commission: z.number().nullable().optional(),
        swap: z.number().nullable().optional(),
        fee: z.number().nullable().optional(),
        comment: z.string().nullable().optional(),
        eventTime: mt5DateTimeSchema,
        rawPayload: mt5RawPayloadSchema.optional(),
      })
    )
    .default([]),
  executionContexts: z.array(mt5ExecutionContextSchema).default([]),
  symbolSpecs: z.array(mt5SymbolSpecSchema).default([]),
  priceSnapshots: z
    .array(
      z.object({
        symbol: z.string().min(1),
        bid: z.number(),
        ask: z.number(),
        timestamp: mt5DateTimeSchema,
        bidVolume: z.number().nullable().optional(),
        askVolume: z.number().nullable().optional(),
      })
    )
    .default([]),
  checkpoint: z
    .object({
      lastDealTime: mt5DateTimeSchema.optional(),
      lastDealId: z.string().optional(),
      lastOrderTime: mt5DateTimeSchema.optional(),
      lastPositionPollAt: mt5DateTimeSchema.optional(),
      lastAccountPollAt: mt5DateTimeSchema.optional(),
      lastFullReconcileAt: mt5DateTimeSchema.optional(),
    })
    .optional(),
});

export type Mt5SyncFrameInput = z.infer<typeof mt5SyncFrameSchema>;
export type Mt5SymbolSpec = z.infer<typeof mt5SymbolSpecSchema>;
export type Mt5ExecutionContext = z.infer<typeof mt5ExecutionContextSchema>;

export interface Mt5ProjectionTrade {
  tradeKey: string;
  symbol: string;
  tradeType: "long" | "short";
  volume: number;
  openPrice: number;
  closePrice: number;
  openTime: Date;
  closeTime: Date;
  profit: number | null;
  commissions: number | null;
  swap: number | null;
  pips: number;
  sl: number | null;
  tp: number | null;
  entryDealCount: number;
  exitDealCount: number;
  entryVolume: number;
  exitVolume: number;
  scaleInCount: number;
  scaleOutCount: number;
  provisional: boolean;
}

export interface Mt5TradeStateFallback {
  tradeKey: string;
  symbol: string | null;
  tradeType: "long" | "short" | null;
  volume: number | null;
  openPrice: number | null;
  openTime: Date | null;
  sl: number | null;
  tp: number | null;
  profit: number | null;
  swap: number | null;
  commission: number | null;
}

export interface RemovedOpenTradeSeed {
  ticket: string;
  symbol: string | null;
  tradeType: string | null;
  volume: string | null;
  openPrice: string | null;
  currentPrice: string | null;
  openTime: Date | null;
  sl: string | null;
  tp: string | null;
  profit: string | null;
  swap: string | null;
  commission: string | null;
  comment: string | null;
  magicNumber: number | null;
  brokerMeta: Record<string, unknown> | null;
}

export interface OpenedPositionSeed {
  ticket: string;
  symbol: string;
  tradeType: "buy" | "sell";
  volume: number;
  openPrice: number;
  openTime: Date;
  sl: number | null;
  tp: number | null;
  comment: string | null;
  magicNumber: number | null;
}

export interface ModifiedPositionSeed {
  ticket: string;
  newSl: number | null;
  newTp: number | null;
  comment: string | null;
  magicNumber: number | null;
}
