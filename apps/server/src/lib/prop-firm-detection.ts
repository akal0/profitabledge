import { and, asc, eq, isNull, or } from "drizzle-orm";
import { db } from "../db";
import {
  openTrade,
  propChallengeRule,
  propFirm,
  trade,
  tradingAccount,
} from "../db/schema/trading";
import { ensurePropChallengeLineageForAccount } from "./prop-challenge-lineage";

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
type PropFirmRecord = typeof propFirm.$inferSelect;
type PropChallengeRuleRecord = typeof propChallengeRule.$inferSelect;

type AutoPropAccountSeed = {
  accountId?: string | null;
  id?: string | null;
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
const BUILTIN_PROP_TIMESTAMP = new Date("2025-01-01T00:00:00.000Z");

const BUILTIN_PROP_FIRMS: PropFirmRecord[] = [
  {
    id: "ftmo",
    createdByUserId: null,
    name: "FTMO",
    displayName: "FTMO",
    description:
      "One of the world's leading prop trading firms with a proven track record since 2015.",
    logo: "/brokers/FTMO.png",
    website: "https://ftmo.com",
    supportedPlatforms: ["mt4", "mt5", "ctrader"],
    brokerDetectionPatterns: [
      "FTMO",
      "ftmo",
      "FTMO-Demo",
      "FTMO-Live",
      "FTMO-Server",
    ],
    active: true,
    createdAt: BUILTIN_PROP_TIMESTAMP,
    updatedAt: BUILTIN_PROP_TIMESTAMP,
  },
];

const BUILTIN_PROP_CHALLENGE_RULES: Record<string, PropChallengeRuleRecord[]> =
  {
    ftmo: [
      {
        id: "ftmo-2step",
        createdByUserId: null,
        propFirmId: "ftmo",
        challengeType: "standard",
        displayName: "FTMO 2-Step Challenge",
        phases: [
          {
            order: 1,
            name: "Phase 1 - FTMO Challenge",
            profitTarget: 10,
            profitTargetType: "percentage",
            dailyLossLimit: 5,
            maxLoss: 10,
            maxLossType: "absolute",
            timeLimitDays: null,
            minTradingDays: 4,
            consistencyRule: null,
            customRules: {
              description:
                "Achieve 10% profit while staying within risk limits",
            },
          },
          {
            order: 2,
            name: "Phase 2 - Verification",
            profitTarget: 5,
            profitTargetType: "percentage",
            dailyLossLimit: 5,
            maxLoss: 10,
            maxLossType: "absolute",
            timeLimitDays: null,
            minTradingDays: 4,
            consistencyRule: null,
            customRules: {
              description: "Achieve 5% profit to unlock your funded account",
            },
          },
          {
            order: 0,
            name: "Funded Account",
            profitTarget: null,
            profitTargetType: "percentage",
            dailyLossLimit: 5,
            maxLoss: 10,
            maxLossType: "absolute",
            timeLimitDays: null,
            minTradingDays: 0,
            consistencyRule: null,
            customRules: {
              profitSplit: 80,
              profitSplitScaled: 90,
              description: "80% profit split (90% after scaling)",
            },
          },
        ],
        active: true,
        createdAt: BUILTIN_PROP_TIMESTAMP,
        updatedAt: BUILTIN_PROP_TIMESTAMP,
      },
    ],
  };

function sortPropFirms(records: PropFirmRecord[]) {
  return [...records].sort((left, right) =>
    left.displayName.localeCompare(right.displayName)
  );
}

function sortPropChallengeRules(records: PropChallengeRuleRecord[]) {
  return [...records].sort((left, right) =>
    left.challengeType.localeCompare(right.challengeType)
  );
}

function mergePropFirmsWithBuiltIns(records: PropFirmRecord[]) {
  const byId = new Map<string, PropFirmRecord>(
    BUILTIN_PROP_FIRMS.map((firm) => [firm.id, firm])
  );

  for (const record of records) {
    byId.set(record.id, record);
  }

  return sortPropFirms(Array.from(byId.values()));
}

function mergeChallengeRulesWithBuiltIns(
  propFirmId: string,
  records: PropChallengeRuleRecord[]
) {
  const byId = new Map<string, PropChallengeRuleRecord>(
    (BUILTIN_PROP_CHALLENGE_RULES[propFirmId] || []).map((rule) => [
      rule.id,
      rule,
    ])
  );

  for (const record of records) {
    byId.set(record.id, record);
  }

  return sortPropChallengeRules(Array.from(byId.values()));
}

function buildPropFirmAccessCondition(userId?: string | null) {
  if (userId === undefined) {
    return undefined;
  }

  return userId
    ? or(isNull(propFirm.createdByUserId), eq(propFirm.createdByUserId, userId))
    : isNull(propFirm.createdByUserId);
}

function buildChallengeRuleAccessCondition(userId?: string | null) {
  if (userId === undefined) {
    return undefined;
  }

  return userId
    ? or(
        isNull(propChallengeRule.createdByUserId),
        eq(propChallengeRule.createdByUserId, userId)
      )
    : isNull(propChallengeRule.createdByUserId);
}

function toFiniteNumber(
  value: string | number | null | undefined
): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getPropStartMetrics(seed: AutoPropAccountSeed) {
  const startBalance =
    toFiniteNumber(seed.initialBalance) ??
    toFiniteNumber(seed.liveBalance) ??
    DEFAULT_PROP_START_BALANCE;
  const startEquity =
    toFiniteNumber(seed.initialBalance) ??
    toFiniteNumber(seed.liveEquity) ??
    toFiniteNumber(seed.liveBalance) ??
    DEFAULT_PROP_START_BALANCE;

  return {
    startBalance,
    startEquity,
  };
}

function formatDayValue(value: Date) {
  return value.toISOString().split("T")[0];
}

async function getEarliestAccountActivityDate(accountId?: string | null) {
  if (!accountId) return null;

  const [firstClosedTrade, firstOpenTrade] = await Promise.all([
    db.query.trade.findFirst({
      where: eq(trade.accountId, accountId),
      columns: {
        openTime: true,
        closeTime: true,
      },
      orderBy: (table) => [asc(table.openTime), asc(table.closeTime)],
    }),
    db.query.openTrade.findFirst({
      where: eq(openTrade.accountId, accountId),
      columns: {
        openTime: true,
      },
      orderBy: (table) => [asc(table.openTime)],
    }),
  ]);

  const candidates = [
    firstClosedTrade?.openTime,
    firstClosedTrade?.closeTime,
    firstOpenTrade?.openTime,
  ].filter((value): value is Date => value instanceof Date);

  if (!candidates.length) {
    return null;
  }

  return new Date(Math.min(...candidates.map((value) => value.getTime())));
}

export async function resolvePropTrackingSeed(
  seed: AutoPropAccountSeed,
  options: {
    phaseStartDate?: string | null;
  } = {}
) {
  const { startBalance, startEquity } = getPropStartMetrics(seed);
  const earliestActivityDate = await getEarliestAccountActivityDate(
    seed.accountId ?? seed.id ?? null
  );
  const preferredStartDate = options.phaseStartDate
    ? new Date(options.phaseStartDate)
    : null;
  const phaseStartDate = formatDayValue(
    earliestActivityDate ?? preferredStartDate ?? new Date()
  );

  return {
    phaseStartDate,
    startBalance,
    startEquity,
    inferredFromHistory: Boolean(earliestActivityDate),
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
  const propFirms = mergePropFirmsWithBuiltIns(
    await db.query.propFirm.findMany({
      where: and(eq(propFirm.active, true), isNull(propFirm.createdByUserId)),
    })
  );

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

  const { phaseStartDate, startBalance, startEquity } =
    await resolvePropTrackingSeed(seed);

  return {
    detection,
    updates: {
      isPropAccount: true,
      propFirmId: detection.propFirmId,
      propChallengeRuleId: defaultRule.id,
      propCurrentPhase: 1,
      propPhaseStartDate: phaseStartDate,
      propPhaseStartBalance: startBalance.toFixed(2),
      propPhaseStartEquity: startEquity.toFixed(2),
      propDailyHighWaterMark: startEquity.toFixed(2),
      propPhaseHighWaterMark: startEquity.toFixed(2),
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

    if (updates.isPropAccount) {
      await ensurePropChallengeLineageForAccount(account.id);
    }

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
  const rows = await db.query.propFirm.findMany({
    where: and(eq(propFirm.active, true), buildPropFirmAccessCondition(null)),
    orderBy: (propFirm, { asc }) => [asc(propFirm.displayName)],
  });

  return mergePropFirmsWithBuiltIns(rows);
}

export async function getAccessiblePropFirms(userId: string) {
  const rows = await db.query.propFirm.findMany({
    where: and(eq(propFirm.active, true), buildPropFirmAccessCondition(userId)),
    orderBy: (propFirm, { asc }) => [asc(propFirm.displayName)],
  });

  return mergePropFirmsWithBuiltIns(rows);
}

/**
 * Get prop firm by ID
 */
export async function getPropFirmById(id: string, userId?: string | null) {
  const row = await db.query.propFirm.findFirst({
    where:
      userId === undefined
        ? eq(propFirm.id, id)
        : and(eq(propFirm.id, id), buildPropFirmAccessCondition(userId)),
  });

  if (row) {
    return row;
  }

  return BUILTIN_PROP_FIRMS.find((firm) => firm.id === id) ?? null;
}

export async function getChallengeRuleById(id: string, userId?: string | null) {
  const row = await db.query.propChallengeRule.findFirst({
    where:
      userId === undefined
        ? eq(propChallengeRule.id, id)
        : and(
            eq(propChallengeRule.id, id),
            buildChallengeRuleAccessCondition(userId)
          ),
  });

  if (row) {
    return row;
  }

  for (const rules of Object.values(BUILTIN_PROP_CHALLENGE_RULES)) {
    const match = rules.find((rule) => rule.id === id);
    if (match) {
      return match;
    }
  }

  return null;
}

/**
 * Get challenge rules for a prop firm
 */
export async function getChallengeRulesForFirm(
  propFirmId: string,
  userId?: string | null
) {
  const rows = await db.query.propChallengeRule.findMany({
    where: (propChallengeRule, { eq, and }) =>
      userId === undefined
        ? and(
            eq(propChallengeRule.propFirmId, propFirmId),
            eq(propChallengeRule.active, true)
          )
        : and(
            eq(propChallengeRule.propFirmId, propFirmId),
            eq(propChallengeRule.active, true),
            buildChallengeRuleAccessCondition(userId)
          ),
    orderBy: (propChallengeRule, { asc }) => [
      asc(propChallengeRule.challengeType),
    ],
  });

  return mergeChallengeRulesWithBuiltIns(propFirmId, rows);
}
