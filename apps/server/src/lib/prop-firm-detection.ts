import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "../db";
import { propFirm, tradingAccount } from "../db/schema/trading";

/**
 * Prop Firm Detection Library
 * Auto-detects prop firms based on broker name and server information
 */

export interface PropFirmDetectionResult {
  detected: boolean;
  propFirmId: string | null;
  propFirmName: string | null;
  confidence: "high" | "medium" | "low";
  matchedPattern: string | null;
}

type TradingAccountInsert = typeof tradingAccount.$inferInsert;
type TradingAccountSelect = typeof tradingAccount.$inferSelect;

type AutoPropAccountSeed = {
  broker: string | null;
  brokerServer: string | null;
  initialBalance?: string | number | null;
  liveBalance?: string | number | null;
  liveEquity?: string | number | null;
};

export interface AutoPropClassificationResult {
  detection: PropFirmDetectionResult;
  updates: Partial<TradingAccountInsert>;
  activated: boolean;
}

const DEFAULT_PROP_START_BALANCE = 100_000;

function toFiniteNumber(
  value: string | number | null | undefined
): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getPropStartMetrics(seed: AutoPropAccountSeed) {
  const startBalance =
    toFiniteNumber(seed.liveBalance) ??
    toFiniteNumber(seed.initialBalance) ??
    DEFAULT_PROP_START_BALANCE;
  const startEquity =
    toFiniteNumber(seed.liveEquity) ??
    toFiniteNumber(seed.liveBalance) ??
    toFiniteNumber(seed.initialBalance) ??
    DEFAULT_PROP_START_BALANCE;

  return {
    startBalance,
    startEquity,
  };
}

/**
 * Detect prop firm from broker and server information
 * @param broker - Broker company name (e.g., "FTMO", "ThinkCapital")
 * @param brokerServer - MT5 server name (e.g., "FTMO-Demo", "FundedNext-Live")
 * @returns PropFirmDetectionResult
 */
export async function detectPropFirm(
  broker: string | null,
  brokerServer: string | null
): Promise<PropFirmDetectionResult> {
  if (!broker && !brokerServer) {
    return {
      detected: false,
      propFirmId: null,
      propFirmName: null,
      confidence: "low",
      matchedPattern: null,
    };
  }

  // Fetch all active prop firms with their detection patterns
  const propFirms = await db.query.propFirm.findMany({
    where: (propFirm, { eq }) => eq(propFirm.active, true),
  });

  const searchText = `${broker || ""} ${brokerServer || ""}`.toLowerCase();

  for (const firm of propFirms) {
    const patterns = (firm.brokerDetectionPatterns as string[]) || [];

    for (const pattern of patterns) {
      const patternLower = pattern.toLowerCase();

      // Check if pattern matches
      if (searchText.includes(patternLower)) {
        // Determine confidence based on match quality
        let confidence: "high" | "medium" | "low" = "medium";

        // High confidence: exact match in server name
        if (brokerServer?.toLowerCase().includes(patternLower)) {
          confidence = "high";
        }
        // High confidence: broker name exact match
        else if (broker?.toLowerCase() === patternLower) {
          confidence = "high";
        }
        // Medium confidence: partial match
        else if (broker?.toLowerCase().includes(patternLower)) {
          confidence = "medium";
        }
        // Low confidence: weak match
        else {
          confidence = "low";
        }

        return {
          detected: true,
          propFirmId: firm.id,
          propFirmName: firm.displayName,
          confidence,
          matchedPattern: pattern,
        };
      }
    }
  }

  return {
    detected: false,
    propFirmId: null,
    propFirmName: null,
    confidence: "low",
    matchedPattern: null,
  };
}

export async function buildAutoPropAccountFields(
  seed: AutoPropAccountSeed
): Promise<AutoPropClassificationResult> {
  const detection = await detectPropFirm(seed.broker, seed.brokerServer);

  if (!detection.detected || !detection.propFirmId) {
    return {
      detection,
      updates: {},
      activated: false,
    };
  }

  if (detection.confidence !== "high") {
    return {
      detection,
      updates: {
        propDetectedFirmId: detection.propFirmId,
      },
      activated: false,
    };
  }

  const challengeRules = await getChallengeRulesForFirm(detection.propFirmId);
  const defaultRule = challengeRules[0];

  if (!defaultRule) {
    return {
      detection,
      updates: {
        propDetectedFirmId: detection.propFirmId,
      },
      activated: false,
    };
  }

  const today = new Date().toISOString().split("T")[0];
  const { startBalance, startEquity } = getPropStartMetrics(seed);

  return {
    detection,
    updates: {
      isPropAccount: true,
      propFirmId: detection.propFirmId,
      propChallengeRuleId: defaultRule.id,
      propCurrentPhase: 1,
      propPhaseStartDate: today,
      propPhaseStartBalance: startBalance.toString(),
      propPhaseStartEquity: startEquity.toString(),
      propDailyHighWaterMark: startEquity.toString(),
      propPhaseHighWaterMark: startEquity.toString(),
      propPhaseCurrentProfit: "0",
      propPhaseCurrentProfitPercent: "0",
      propPhaseTradingDays: 0,
      propPhaseStatus: "active",
      propPhaseBestDayProfit: "0",
      propPhaseBestDayProfitPercent: "0",
      propManualOverride: false,
      propDetectedFirmId: detection.propFirmId,
    },
    activated: true,
  };
}

function hasAutoClassificationChanges(
  account: Pick<
    TradingAccountSelect,
    | "isPropAccount"
    | "propFirmId"
    | "propChallengeRuleId"
    | "propDetectedFirmId"
  >,
  updates: Partial<TradingAccountInsert>
) {
  if (!Object.keys(updates).length) {
    return false;
  }

  if (updates.isPropAccount === true) {
    return (
      account.isPropAccount !== true ||
      (updates.propFirmId ?? null) !== (account.propFirmId ?? null) ||
      (updates.propChallengeRuleId ?? null) !==
        (account.propChallengeRuleId ?? null) ||
      (updates.propDetectedFirmId ?? null) !==
        (account.propDetectedFirmId ?? null)
    );
  }

  if ("propDetectedFirmId" in updates) {
    return (
      (updates.propDetectedFirmId ?? null) !==
      (account.propDetectedFirmId ?? null)
    );
  }

  return false;
}

export async function syncAutoPropClassificationForUser(userId: string) {
  const accounts = await db
    .select({
      id: tradingAccount.id,
      broker: tradingAccount.broker,
      brokerServer: tradingAccount.brokerServer,
      initialBalance: tradingAccount.initialBalance,
      liveBalance: tradingAccount.liveBalance,
      liveEquity: tradingAccount.liveEquity,
      isPropAccount: tradingAccount.isPropAccount,
      propFirmId: tradingAccount.propFirmId,
      propChallengeRuleId: tradingAccount.propChallengeRuleId,
      propDetectedFirmId: tradingAccount.propDetectedFirmId,
    })
    .from(tradingAccount)
    .where(
      and(
        eq(tradingAccount.userId, userId),
        or(
          eq(tradingAccount.isPropAccount, false),
          isNull(tradingAccount.isPropAccount)
        ),
        or(
          eq(tradingAccount.propManualOverride, false),
          isNull(tradingAccount.propManualOverride)
        )
      )
    );

  let updatedCount = 0;

  for (const account of accounts) {
    const { updates } = await buildAutoPropAccountFields(account);

    if (!hasAutoClassificationChanges(account, updates)) {
      continue;
    }

    await db
      .update(tradingAccount)
      .set(updates)
      .where(eq(tradingAccount.id, account.id));

    updatedCount += 1;
  }

  return {
    checkedCount: accounts.length,
    updatedCount,
  };
}

/**
 * Get all active prop firms
 */
export async function getAllPropFirms() {
  return db.query.propFirm.findMany({
    where: (propFirm, { eq }) => eq(propFirm.active, true),
    orderBy: (propFirm, { asc }) => [asc(propFirm.displayName)],
  });
}

/**
 * Get prop firm by ID
 */
export async function getPropFirmById(id: string) {
  return db.query.propFirm.findFirst({
    where: (propFirm, { eq }) => eq(propFirm.id, id),
  });
}

/**
 * Get challenge rules for a prop firm
 */
export async function getChallengeRulesForFirm(propFirmId: string) {
  return db.query.propChallengeRule.findMany({
    where: (propChallengeRule, { eq, and }) =>
      and(
        eq(propChallengeRule.propFirmId, propFirmId),
        eq(propChallengeRule.active, true)
      ),
    orderBy: (propChallengeRule, { asc }) => [
      asc(propChallengeRule.challengeType),
    ],
  });
}
