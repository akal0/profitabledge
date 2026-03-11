/**
 * Trade Copier Engine
 *
 * Core logic for calculating lot sizes, applying risk limits,
 * and generating copy signals for slave accounts.
 */

import { db } from "../db";
import { copySlave, copySignal, copyGroup } from "../db/schema/copier";
import { tradingAccount } from "../db/schema/trading";
import { eq, and, sql, gte, desc } from "drizzle-orm";
import { nanoid } from "nanoid";

// Types for the copy engine
export type LotMode = "fixed" | "multiplier" | "balance_ratio" | "risk_percent";
export type SlTpMode = "copy" | "fixed_pips" | "adjusted";
export type SignalType = "open" | "modify" | "close";
export type SignalStatus = "pending" | "sent" | "executed" | "failed" | "rejected";

export interface SlaveConfig {
  id: string;
  slaveAccountId: string;
  isActive: boolean;
  lotMode: LotMode;
  fixedLot: number;
  lotMultiplier: number;
  riskPercent: number;
  maxLotSize: number;
  maxDailyLoss: number | null;
  maxTradesPerDay: number | null;
  maxDrawdownPercent: number | null;
  slMode: SlTpMode;
  slFixedPips: number | null;
  slMultiplier: number;
  tpMode: SlTpMode;
  tpFixedPips: number | null;
  tpMultiplier: number;
  symbolWhitelist: string[] | null;
  symbolBlacklist: string[] | null;
  sessionFilter: string[] | null;
  minLotSize: number;
  maxSlippagePips: number;
  copyPendingOrders: boolean;
  copySlTpModifications: boolean;
  reverseTrades: boolean;
}

export interface MasterTrade {
  ticket: string;
  symbol: string;
  tradeType: "buy" | "sell";
  volume: number;
  openPrice: number;
  sl?: number;
  tp?: number;
  sessionTag?: string;
}

export interface AccountMetrics {
  balance: number;
  equity: number;
  initialBalance: number;
}

export interface SignalResult {
  success: boolean;
  signalId?: string;
  slaveVolume?: number;
  rejectionReason?: string;
}

type ExistingSignalRow = {
  id: string;
  signalType: string | null;
  status: string | null;
  newSl: string | null;
  newTp: string | null;
};

// Pip sizes for different instrument types
const PIP_SIZES: Record<string, number> = {
  // JPY pairs
  JPY: 0.01,
  // Metals
  XAU: 0.01,
  XAG: 0.01,
  // Indices
  US100: 1.0,
  NAS100: 1.0,
  US500: 1.0,
  SPX: 1.0,
  US30: 1.0,
  DJ30: 1.0,
  DOW: 1.0,
  GER30: 1.0,
  GER40: 1.0,
  DE30: 1.0,
  DE40: 1.0,
  // Default forex
  DEFAULT: 0.0001,
};

/**
 * Get pip size for a symbol
 */
export function getPipSize(symbol: string): number {
  const upper = symbol.toUpperCase();

  for (const [key, value] of Object.entries(PIP_SIZES)) {
    if (upper.includes(key)) {
      return value;
    }
  }

  return PIP_SIZES.DEFAULT;
}

/**
 * Calculate pip value per lot for a symbol
 * This is a simplified calculation - in production you'd want to fetch
 * actual pip values from the broker based on account currency
 */
export function getPipValuePerLot(symbol: string): number {
  const upper = symbol.toUpperCase();

  // Standard forex pairs: ~$10 per pip per lot
  if (upper.includes("USD") || upper.match(/^[A-Z]{6}$/)) {
    return 10;
  }

  // Gold: ~$10 per pip per lot
  if (upper.includes("XAU")) {
    return 10;
  }

  // Indices: varies widely, use conservative estimate
  if (upper.includes("US100") || upper.includes("NAS")) {
    return 1;
  }
  if (upper.includes("US500") || upper.includes("SPX")) {
    return 10;
  }
  if (upper.includes("US30") || upper.includes("DOW") || upper.includes("DJ")) {
    return 1;
  }

  // Default
  return 10;
}

/**
 * Calculate the slave volume based on lot mode
 */
export function calculateSlaveVolume(
  config: SlaveConfig,
  masterTrade: MasterTrade,
  masterMetrics: AccountMetrics,
  slaveMetrics: AccountMetrics
): { volume: number; rejectionReason?: string } {
  let volume: number;

  switch (config.lotMode) {
    case "fixed":
      volume = config.fixedLot;
      break;

    case "multiplier":
      volume = masterTrade.volume * config.lotMultiplier;
      break;

    case "balance_ratio":
      // Match master's risk proportionally based on balance
      const ratio = slaveMetrics.balance / masterMetrics.balance;
      volume = masterTrade.volume * ratio;
      break;

    case "risk_percent":
      // Calculate volume based on risk % of account
      if (!masterTrade.sl || masterTrade.sl <= 0) {
        // No SL set - can't calculate risk-based size
        // Fall back to multiplier mode
        volume = masterTrade.volume * config.lotMultiplier;
      } else {
        const riskAmount = slaveMetrics.balance * (config.riskPercent / 100);
        const pipSize = getPipSize(masterTrade.symbol);
        const pipValue = getPipValuePerLot(masterTrade.symbol);

        // Calculate SL distance in pips
        let slPips: number;
        if (masterTrade.tradeType === "buy") {
          slPips = Math.abs(masterTrade.openPrice - masterTrade.sl) / pipSize;
        } else {
          slPips = Math.abs(masterTrade.sl - masterTrade.openPrice) / pipSize;
        }

        if (slPips <= 0) {
          volume = masterTrade.volume * config.lotMultiplier;
        } else {
          // Volume = Risk Amount / (SL pips * pip value)
          volume = riskAmount / (slPips * pipValue);
        }
      }
      break;

    default:
      volume = masterTrade.volume;
  }

  // Apply min/max constraints
  if (volume < config.minLotSize) {
    return {
      volume: 0,
      rejectionReason: `Calculated volume ${volume.toFixed(2)} below minimum ${config.minLotSize}`,
    };
  }

  volume = Math.min(volume, config.maxLotSize);

  // Round to 2 decimal places (standard lot precision)
  volume = Math.round(volume * 100) / 100;

  return { volume };
}

/**
 * Apply SL adjustment based on slave config
 */
export function adjustStopLoss(
  config: SlaveConfig,
  masterTrade: MasterTrade,
  slaveOpenPrice: number
): number | null {
  if (!masterTrade.sl || masterTrade.sl <= 0) {
    return null;
  }

  const pipSize = getPipSize(masterTrade.symbol);

  switch (config.slMode) {
    case "copy":
      return masterTrade.sl;

    case "fixed_pips":
      if (!config.slFixedPips) return masterTrade.sl;
      const slDistance = config.slFixedPips * pipSize;
      if (masterTrade.tradeType === "buy") {
        return slaveOpenPrice - slDistance;
      } else {
        return slaveOpenPrice + slDistance;
      }

    case "adjusted":
      // Multiply the SL distance from entry
      const originalDistance = Math.abs(masterTrade.openPrice - masterTrade.sl);
      const adjustedDistance = originalDistance * config.slMultiplier;
      if (masterTrade.tradeType === "buy") {
        return slaveOpenPrice - adjustedDistance;
      } else {
        return slaveOpenPrice + adjustedDistance;
      }

    default:
      return masterTrade.sl;
  }
}

/**
 * Apply TP adjustment based on slave config
 */
export function adjustTakeProfit(
  config: SlaveConfig,
  masterTrade: MasterTrade,
  slaveOpenPrice: number
): number | null {
  if (!masterTrade.tp || masterTrade.tp <= 0) {
    return null;
  }

  const pipSize = getPipSize(masterTrade.symbol);

  switch (config.tpMode) {
    case "copy":
      return masterTrade.tp;

    case "fixed_pips":
      if (!config.tpFixedPips) return masterTrade.tp;
      const tpDistance = config.tpFixedPips * pipSize;
      if (masterTrade.tradeType === "buy") {
        return slaveOpenPrice + tpDistance;
      } else {
        return slaveOpenPrice - tpDistance;
      }

    case "adjusted":
      // Multiply the TP distance from entry
      const originalDistance = Math.abs(masterTrade.tp - masterTrade.openPrice);
      const adjustedDistance = originalDistance * config.tpMultiplier;
      if (masterTrade.tradeType === "buy") {
        return slaveOpenPrice + adjustedDistance;
      } else {
        return slaveOpenPrice - adjustedDistance;
      }

    default:
      return masterTrade.tp;
  }
}

/**
 * Check if symbol passes whitelist/blacklist filters
 */
export function checkSymbolFilter(
  config: SlaveConfig,
  symbol: string
): { allowed: boolean; reason?: string } {
  const upperSymbol = symbol.toUpperCase();

  // Check whitelist (if set, symbol must be in it)
  if (config.symbolWhitelist && config.symbolWhitelist.length > 0) {
    const whitelistUpper = config.symbolWhitelist.map((s) => s.toUpperCase());
    if (!whitelistUpper.includes(upperSymbol)) {
      return {
        allowed: false,
        reason: `Symbol ${symbol} not in whitelist`,
      };
    }
  }

  // Check blacklist (if set, symbol must NOT be in it)
  if (config.symbolBlacklist && config.symbolBlacklist.length > 0) {
    const blacklistUpper = config.symbolBlacklist.map((s) => s.toUpperCase());
    if (blacklistUpper.includes(upperSymbol)) {
      return {
        allowed: false,
        reason: `Symbol ${symbol} is blacklisted`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Check if session passes filter
 */
export function checkSessionFilter(
  config: SlaveConfig,
  sessionTag?: string
): { allowed: boolean; reason?: string } {
  if (!config.sessionFilter || config.sessionFilter.length === 0) {
    return { allowed: true };
  }

  if (!sessionTag) {
    return {
      allowed: false,
      reason: "No session tag on trade, filter requires specific sessions",
    };
  }

  const filterLower = config.sessionFilter.map((s) => s.toLowerCase());
  if (!filterLower.includes(sessionTag.toLowerCase())) {
    return {
      allowed: false,
      reason: `Session ${sessionTag} not in filter list`,
    };
  }

  return { allowed: true };
}

/**
 * Check daily loss limit
 */
export async function checkDailyLossLimit(
  config: SlaveConfig
): Promise<{ allowed: boolean; reason?: string; currentLoss?: number }> {
  if (!config.maxDailyLoss || config.maxDailyLoss <= 0) {
    return { allowed: true };
  }

  // Get today's executed signals for this slave
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result = await db
    .select({
      totalLoss: sql<string>`COALESCE(SUM(CASE WHEN ${copySignal.profit} < 0 THEN ${copySignal.profit} ELSE 0 END), 0)`,
    })
    .from(copySignal)
    .where(
      and(
        eq(copySignal.copySlaveId, config.id),
        eq(copySignal.status, "executed"),
        gte(copySignal.executedAt, today)
      )
    );

  const currentLoss = Math.abs(parseFloat(result[0]?.totalLoss || "0"));

  if (currentLoss >= config.maxDailyLoss) {
    return {
      allowed: false,
      reason: `Daily loss limit reached: $${currentLoss.toFixed(2)} of $${config.maxDailyLoss} max`,
      currentLoss,
    };
  }

  return { allowed: true, currentLoss };
}

/**
 * Check max trades per day limit
 */
export async function checkTradesPerDayLimit(
  config: SlaveConfig
): Promise<{ allowed: boolean; reason?: string; currentCount?: number }> {
  if (!config.maxTradesPerDay || config.maxTradesPerDay <= 0) {
    return { allowed: true };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result = await db
    .select({
      count: sql<string>`COUNT(*)`,
    })
    .from(copySignal)
    .where(
      and(
        eq(copySignal.copySlaveId, config.id),
        eq(copySignal.signalType, "open"),
        eq(copySignal.status, "executed"),
        gte(copySignal.createdAt, today)
      )
    );

  const currentCount = parseInt(result[0]?.count || "0", 10);

  if (currentCount >= config.maxTradesPerDay) {
    return {
      allowed: false,
      reason: `Max trades per day reached: ${currentCount} of ${config.maxTradesPerDay}`,
      currentCount,
    };
  }

  return { allowed: true, currentCount };
}

/**
 * Check drawdown limit
 */
export function checkDrawdownLimit(
  config: SlaveConfig,
  slaveMetrics: AccountMetrics
): { allowed: boolean; reason?: string; currentDrawdown?: number } {
  if (!config.maxDrawdownPercent || config.maxDrawdownPercent <= 0) {
    return { allowed: true };
  }

  if (slaveMetrics.initialBalance <= 0) {
    return { allowed: true };
  }

  const drawdown = ((slaveMetrics.initialBalance - slaveMetrics.equity) / slaveMetrics.initialBalance) * 100;

  if (drawdown >= config.maxDrawdownPercent) {
    return {
      allowed: false,
      reason: `Drawdown limit exceeded: ${drawdown.toFixed(2)}% of ${config.maxDrawdownPercent}% max`,
      currentDrawdown: drawdown,
    };
  }

  return { allowed: true, currentDrawdown: drawdown };
}

async function getExistingSignalsForMasterTicket(
  slaveId: string,
  masterTicket: string
): Promise<ExistingSignalRow[]> {
  return db
    .select({
      id: copySignal.id,
      signalType: copySignal.signalType,
      status: copySignal.status,
      newSl: copySignal.newSl,
      newTp: copySignal.newTp,
    })
    .from(copySignal)
    .where(
      and(
        eq(copySignal.copySlaveId, slaveId),
        eq(copySignal.masterTicket, masterTicket)
      )
    )
    .orderBy(desc(copySignal.createdAt))
    .limit(25);
}

function hasExistingSignalType(
  signals: ExistingSignalRow[],
  signalType: SignalType
) {
  return signals.some((signal) => signal.signalType === signalType);
}

function hasExistingModifySignal(
  signals: ExistingSignalRow[],
  newSl: number | null,
  newTp: number | null
) {
  const nextSl = newSl == null ? null : newSl.toString();
  const nextTp = newTp == null ? null : newTp.toString();

  return signals.some(
    (signal) =>
      signal.signalType === "modify" &&
      signal.newSl === nextSl &&
      signal.newTp === nextTp
  );
}

/**
 * Generate a copy signal for a slave account
 * This is the main entry point for creating signals
 */
export async function generateCopySignal(
  slaveId: string,
  masterTrade: MasterTrade,
  signalType: SignalType,
  masterMetrics: AccountMetrics,
  slaveMetrics: AccountMetrics
): Promise<SignalResult> {
  // Get slave config
  const slaves = await db
    .select()
    .from(copySlave)
    .where(eq(copySlave.id, slaveId))
    .limit(1);

  if (!slaves.length) {
    return { success: false, rejectionReason: "Slave not found" };
  }

  const slave = slaves[0];

  // Convert to config type
  const config: SlaveConfig = {
    id: slave.id,
    slaveAccountId: slave.slaveAccountId,
    isActive: slave.isActive ?? true,
    lotMode: (slave.lotMode as LotMode) ?? "multiplier",
    fixedLot: parseFloat(slave.fixedLot ?? "0.01"),
    lotMultiplier: parseFloat(slave.lotMultiplier ?? "1.0"),
    riskPercent: parseFloat(slave.riskPercent ?? "1.0"),
    maxLotSize: parseFloat(slave.maxLotSize ?? "10.0"),
    maxDailyLoss: slave.maxDailyLoss ? parseFloat(slave.maxDailyLoss) : null,
    maxTradesPerDay: slave.maxTradesPerDay,
    maxDrawdownPercent: slave.maxDrawdownPercent ? parseFloat(slave.maxDrawdownPercent) : null,
    slMode: (slave.slMode as SlTpMode) ?? "copy",
    slFixedPips: slave.slFixedPips ? parseFloat(slave.slFixedPips) : null,
    slMultiplier: parseFloat(slave.slMultiplier ?? "1.0"),
    tpMode: (slave.tpMode as SlTpMode) ?? "copy",
    tpFixedPips: slave.tpFixedPips ? parseFloat(slave.tpFixedPips) : null,
    tpMultiplier: parseFloat(slave.tpMultiplier ?? "1.0"),
    symbolWhitelist: slave.symbolWhitelist as string[] | null,
    symbolBlacklist: slave.symbolBlacklist as string[] | null,
    sessionFilter: slave.sessionFilter as string[] | null,
    minLotSize: parseFloat(slave.minLotSize ?? "0.01"),
    maxSlippagePips: parseFloat(slave.maxSlippagePips ?? "3.0"),
    copyPendingOrders: slave.copyPendingOrders ?? false,
    copySlTpModifications: slave.copySlTpModifications ?? true,
    reverseTrades: slave.reverseTrades ?? false,
  };

  // Check if slave is active
  if (!config.isActive) {
    return { success: false, rejectionReason: "Slave is not active" };
  }

  const existingSignals = await getExistingSignalsForMasterTicket(
    slaveId,
    masterTrade.ticket
  );

  if (signalType === "open" && hasExistingSignalType(existingSignals, "open")) {
    return {
      success: false,
      rejectionReason: "Duplicate open signal skipped",
    };
  }

  // For open signals, run all checks
  if (signalType === "open") {
    // Check symbol filter
    const symbolCheck = checkSymbolFilter(config, masterTrade.symbol);
    if (!symbolCheck.allowed) {
      return { success: false, rejectionReason: symbolCheck.reason };
    }

    // Check session filter
    const sessionCheck = checkSessionFilter(config, masterTrade.sessionTag);
    if (!sessionCheck.allowed) {
      return { success: false, rejectionReason: sessionCheck.reason };
    }

    // Check daily loss limit
    const lossCheck = await checkDailyLossLimit(config);
    if (!lossCheck.allowed) {
      return { success: false, rejectionReason: lossCheck.reason };
    }

    // Check trades per day limit
    const tradesCheck = await checkTradesPerDayLimit(config);
    if (!tradesCheck.allowed) {
      return { success: false, rejectionReason: tradesCheck.reason };
    }

    // Check drawdown limit
    const ddCheck = checkDrawdownLimit(config, slaveMetrics);
    if (!ddCheck.allowed) {
      return { success: false, rejectionReason: ddCheck.reason };
    }
  }

  // Calculate slave volume
  const volumeResult = calculateSlaveVolume(config, masterTrade, masterMetrics, slaveMetrics);
  if (volumeResult.rejectionReason) {
    return { success: false, rejectionReason: volumeResult.rejectionReason };
  }

  // Determine trade type (possibly reversed)
  let tradeType = masterTrade.tradeType;
  if (config.reverseTrades) {
    tradeType = tradeType === "buy" ? "sell" : "buy";
  }

  // Calculate adjusted SL/TP
  const adjustedSl = adjustStopLoss(config, masterTrade, masterTrade.openPrice);
  const adjustedTp = adjustTakeProfit(config, masterTrade, masterTrade.openPrice);

  // Create the signal
  const signalId = nanoid();

  await db.insert(copySignal).values({
    id: signalId,
    copySlaveId: slaveId,
    masterTicket: masterTrade.ticket,
    signalType,
    status: "pending",
    symbol: masterTrade.symbol,
    tradeType,
    masterVolume: masterTrade.volume.toString(),
    slaveVolume: volumeResult.volume.toString(),
    openPrice: masterTrade.openPrice.toString(),
    sl: adjustedSl?.toString() ?? null,
    tp: adjustedTp?.toString() ?? null,
    createdAt: new Date(),
  });

  return {
    success: true,
    signalId,
    slaveVolume: volumeResult.volume,
  };
}

/**
 * Generate copy signals for all active slaves in a group
 */
export async function generateSignalsForGroup(
  groupId: string,
  masterTrade: MasterTrade,
  signalType: SignalType,
  masterMetrics: AccountMetrics
): Promise<{ slaveId: string; result: SignalResult }[]> {
  // Get all active slaves in the group
  const slaves = await db
    .select({
      slave: copySlave,
      slaveAccount: tradingAccount,
    })
    .from(copySlave)
    .innerJoin(tradingAccount, eq(copySlave.slaveAccountId, tradingAccount.id))
    .where(
      and(
        eq(copySlave.copyGroupId, groupId),
        eq(copySlave.isActive, true)
      )
    );

  const results: { slaveId: string; result: SignalResult }[] = [];

  for (const { slave, slaveAccount } of slaves) {
    const slaveMetrics: AccountMetrics = {
      balance: parseFloat(slaveAccount.liveBalance ?? slaveAccount.initialBalance ?? "0"),
      equity: parseFloat(slaveAccount.liveEquity ?? slaveAccount.liveBalance ?? slaveAccount.initialBalance ?? "0"),
      initialBalance: parseFloat(slaveAccount.initialBalance ?? "0"),
    };

    const result = await generateCopySignal(
      slave.id,
      masterTrade,
      signalType,
      masterMetrics,
      slaveMetrics
    );

    results.push({ slaveId: slave.id, result });
  }

  return results;
}

/**
 * Find all groups where the given account is the master
 */
export async function findGroupsForMaster(
  accountId: string
): Promise<string[]> {
  const groups = await db
    .select({ id: copyGroup.id })
    .from(copyGroup)
    .where(
      and(
        eq(copyGroup.masterAccountId, accountId),
        eq(copyGroup.isActive, true)
      )
    );

  return groups.map((g) => g.id);
}

/**
 * Process a new trade from the master account
 * This is called when the master EA reports a new trade
 */
export async function processMasterTradeOpen(
  masterAccountId: string,
  trade: MasterTrade,
  masterMetrics: AccountMetrics
): Promise<void> {
  const groupIds = await findGroupsForMaster(masterAccountId);

  for (const groupId of groupIds) {
    const results = await generateSignalsForGroup(groupId, trade, "open", masterMetrics);

    for (const { slaveId, result } of results) {
      if (!result.success) {
        // Log rejection
        console.log(`[CopyEngine] Signal rejected for slave ${slaveId}: ${result.rejectionReason}`);
      } else {
        console.log(`[CopyEngine] Signal created for slave ${slaveId}: ${result.signalId}`);
      }
    }
  }
}

/**
 * Process a trade close from the master account
 */
export async function processMasterTradeClose(
  masterAccountId: string,
  masterTicket: string,
  closePrice: number,
  profit: number
): Promise<void> {
  const groupIds = await findGroupsForMaster(masterAccountId);

  for (const groupId of groupIds) {
    // Get all slaves in this group
    const slaves = await db
      .select({ id: copySlave.id })
      .from(copySlave)
      .where(eq(copySlave.copyGroupId, groupId));

    for (const slave of slaves) {
      const existingSignals = await getExistingSignalsForMasterTicket(
        slave.id,
        masterTicket
      );

      if (hasExistingSignalType(existingSignals, "close")) {
        console.log(
          `[CopyEngine] Duplicate close signal skipped for slave ${slave.id}: ${masterTicket}`
        );
        continue;
      }

      // Create close signal
      const signalId = nanoid();

      await db.insert(copySignal).values({
        id: signalId,
        copySlaveId: slave.id,
        masterTicket,
        signalType: "close",
        status: "pending",
        symbol: "", // Will be filled by EA
        tradeType: "buy", // Doesn't matter for close
        masterVolume: "0",
        closePrice: closePrice.toString(),
        profit: profit.toString(),
        createdAt: new Date(),
      });

      console.log(`[CopyEngine] Close signal created for slave ${slave.id}: ${signalId}`);
    }
  }
}

/**
 * Process a SL/TP modification from the master account
 */
export async function processMasterTradeModify(
  masterAccountId: string,
  masterTicket: string,
  newSl: number | null,
  newTp: number | null
): Promise<void> {
  const groupIds = await findGroupsForMaster(masterAccountId);

  for (const groupId of groupIds) {
    // Get all slaves in this group that have copySlTpModifications enabled
    const slaves = await db
      .select({ id: copySlave.id })
      .from(copySlave)
      .where(
        and(
          eq(copySlave.copyGroupId, groupId),
          eq(copySlave.copySlTpModifications, true)
        )
      );

    for (const slave of slaves) {
      const existingSignals = await getExistingSignalsForMasterTicket(
        slave.id,
        masterTicket
      );

      if (hasExistingModifySignal(existingSignals, newSl, newTp)) {
        console.log(
          `[CopyEngine] Duplicate modify signal skipped for slave ${slave.id}: ${masterTicket}`
        );
        continue;
      }

      // Create modify signal
      const signalId = nanoid();

      await db.insert(copySignal).values({
        id: signalId,
        copySlaveId: slave.id,
        masterTicket,
        signalType: "modify",
        status: "pending",
        symbol: "", // Will be filled by EA
        tradeType: "buy", // Doesn't matter for modify
        masterVolume: "0",
        newSl: newSl?.toString() ?? null,
        newTp: newTp?.toString() ?? null,
        createdAt: new Date(),
      });

      console.log(`[CopyEngine] Modify signal created for slave ${slave.id}: ${signalId}`);
    }
  }
}
