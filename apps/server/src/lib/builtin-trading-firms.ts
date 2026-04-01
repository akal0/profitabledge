import {
  PROP_FIRM_CATALOG,
  type PropFirmCatalogEntry,
} from "@profitabledge/contracts/trading-catalog";
import {
  RESEARCHED_PROP_FIRM_RULES_BY_ID,
  type ResearchedPropChallenge,
} from "./researched-prop-firm-rules";

export const BUILTIN_PROP_TIMESTAMP = new Date("2025-01-01T00:00:00.000Z");

type PropFirmSeedRow = {
  id: string;
  createdByUserId: null;
  name: string;
  displayName: string;
  description: string;
  logo: string;
  website: string;
  supportedPlatforms: string[];
  brokerDetectionPatterns: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type PropChallengePhase = {
  order: number;
  name: string;
  profitTarget: number | null;
  profitTargetType: "percentage" | "absolute";
  dailyLossLimit: number | null;
  dailyLossLimitType?: "percentage" | "absolute" | null;
  maxLoss: number | null;
  maxLossType: "absolute" | "trailing";
  timeLimitDays: number | null;
  minTradingDays: number | null;
  consistencyRule: number | null;
  customRules: Record<string, unknown>;
};

type PropChallengeRuleSeedRow = {
  id: string;
  createdByUserId: null;
  propFirmId: string;
  challengeType: string;
  displayName: string;
  phases: PropChallengePhase[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function normalizeChallengeType(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseProfitSplit(input: string) {
  const match = input.match(/(\d{2,3})/);
  return match ? Number(match[1]) : null;
}

function buildFundedPhase(firm: PropFirmCatalogEntry): PropChallengePhase {
  return {
    order: 0,
    name: "Funded Account",
    profitTarget: null,
    profitTargetType: "percentage",
    dailyLossLimit: firm.category === "futures" ? null : 5,
    dailyLossLimitType: firm.category === "futures" ? null : "percentage",
    maxLoss: firm.category === "futures" ? null : 10,
    maxLossType: firm.category === "futures" ? "trailing" : "absolute",
    timeLimitDays: null,
    minTradingDays: 0,
    consistencyRule: null,
    customRules: {
      profitSplit: parseProfitSplit(firm.payoutSplit),
      payoutSplit: firm.payoutSplit,
      accountSizes: firm.accountSizes,
      description: firm.description,
    },
  };
}

function buildTwoStepPhases(firm: PropFirmCatalogEntry): PropChallengePhase[] {
  return [
    {
      order: 1,
      name: "Phase 1",
      profitTarget: 8,
      profitTargetType: "percentage",
      dailyLossLimit: 5,
      dailyLossLimitType: "percentage",
      maxLoss: 10,
      maxLossType: "absolute",
      timeLimitDays: null,
      minTradingDays: 3,
      consistencyRule: null,
      customRules: {
        description: `${firm.displayName} evaluation phase 1`,
      },
    },
    {
      order: 2,
      name: "Phase 2",
      profitTarget: 5,
      profitTargetType: "percentage",
      dailyLossLimit: 5,
      dailyLossLimitType: "percentage",
      maxLoss: 10,
      maxLossType: "absolute",
      timeLimitDays: null,
      minTradingDays: 3,
      consistencyRule: null,
      customRules: {
        description: `${firm.displayName} verification phase`,
      },
    },
    buildFundedPhase(firm),
  ];
}

function buildOneStepPhases(firm: PropFirmCatalogEntry): PropChallengePhase[] {
  return [
    {
      order: 1,
      name: "Evaluation",
      profitTarget: 10,
      profitTargetType: "percentage",
      dailyLossLimit: 4,
      dailyLossLimitType: "percentage",
      maxLoss: 6,
      maxLossType: "absolute",
      timeLimitDays: null,
      minTradingDays: 3,
      consistencyRule: null,
      customRules: {
        description: `${firm.displayName} one-step evaluation`,
      },
    },
    buildFundedPhase(firm),
  ];
}

function buildInstantPhases(firm: PropFirmCatalogEntry): PropChallengePhase[] {
  return [
    {
      ...buildFundedPhase(firm),
      name: "Instant Funded",
    },
  ];
}

function buildFuturesPhases(firm: PropFirmCatalogEntry): PropChallengePhase[] {
  const referenceSize = firm.accountSizes.find((size) => size >= 25_000) ?? 50_000;
  const profitTarget =
    referenceSize >= 150_000 ? 9_000 : referenceSize >= 100_000 ? 6_000 : 3_000;
  const maxLoss =
    referenceSize >= 150_000 ? 4_500 : referenceSize >= 100_000 ? 3_000 : 2_500;

  return [
    {
      order: 1,
      name: "Evaluation",
      profitTarget,
      profitTargetType: "absolute",
      dailyLossLimit: null,
      dailyLossLimitType: null,
      maxLoss,
      maxLossType: "trailing",
      timeLimitDays: null,
      minTradingDays: 5,
      consistencyRule: null,
      customRules: {
        referenceSize,
        description: `${firm.displayName} futures evaluation`,
      },
    },
    {
      order: 0,
      name: "Funded Account",
      profitTarget: null,
      profitTargetType: "absolute",
      dailyLossLimit: null,
      dailyLossLimitType: null,
      maxLoss: null,
      maxLossType: "trailing",
      timeLimitDays: null,
      minTradingDays: 0,
      consistencyRule: null,
      customRules: {
        profitSplit: parseProfitSplit(firm.payoutSplit),
        payoutSplit: firm.payoutSplit,
        accountSizes: firm.accountSizes,
        description: firm.description,
      },
    },
  ];
}

function buildStockPropPhases(firm: PropFirmCatalogEntry): PropChallengePhase[] {
  return [
    {
      order: 1,
      name: "Application",
      profitTarget: null,
      profitTargetType: "absolute",
      dailyLossLimit: null,
      dailyLossLimitType: null,
      maxLoss: null,
      maxLossType: "absolute",
      timeLimitDays: null,
      minTradingDays: null,
      consistencyRule: null,
      customRules: {
        description: firm.description,
        payoutSplit: firm.payoutSplit,
      },
    },
  ];
}

function challengeTypesForFirm(firm: PropFirmCatalogEntry) {
  const researched = RESEARCHED_PROP_FIRM_RULES_BY_ID.get(firm.id);
  if (researched) {
    return researched.challenges.map((challenge) =>
      mapResearchedChallenge(challenge)
    );
  }

  const normalized = firm.challengeTypes.map(normalizeChallengeType);
  const entries: Array<{ challengeType: string; displayName: string; phases: PropChallengePhase[] }> = [];

  if (firm.category === "futures") {
    entries.push({
      challengeType: normalized[0] || "evaluation",
      displayName: firm.challengeTypes[0] || `${firm.displayName} Evaluation`,
      phases: buildFuturesPhases(firm),
    });
    return entries;
  }

  if (firm.category === "stocks") {
    entries.push({
      challengeType: normalized[0] || "application",
      displayName: firm.challengeTypes[0] || `${firm.displayName} Program`,
      phases: buildStockPropPhases(firm),
    });
    return entries;
  }

  const hasTwoStep = normalized.some(
    (type) =>
      type.includes("2-step") ||
      type.includes("two-step") ||
      type.includes("stellar") ||
      type.includes("challenge")
  );
  const hasOneStep = normalized.some(
    (type) =>
      type.includes("1-step") ||
      type.includes("one-step") ||
      type.includes("evaluation") ||
      type.includes("rapid")
  );
  const hasInstant = normalized.some(
    (type) =>
      type.includes("instant") ||
      type.includes("direct") ||
      type.includes("funded")
  );

  if (hasTwoStep) {
    entries.push({
      challengeType: "standard",
      displayName: firm.challengeTypes.find((value) =>
        normalizeChallengeType(value).includes("2-step")
      ) || `${firm.displayName} 2-Step`,
      phases: buildTwoStepPhases(firm),
    });
  } else if (hasOneStep) {
    entries.push({
      challengeType: "evaluation",
      displayName: firm.challengeTypes[0] || `${firm.displayName} Evaluation`,
      phases: buildOneStepPhases(firm),
    });
  }

  if (!entries.length) {
    entries.push({
      challengeType: "evaluation",
      displayName: firm.challengeTypes[0] || `${firm.displayName} Evaluation`,
      phases: buildOneStepPhases(firm),
    });
  }

  if (hasInstant) {
    entries.push({
      challengeType: "instant",
      displayName: `${firm.displayName} Instant`,
      phases: buildInstantPhases(firm),
    });
  }

  return entries;
}

function mapResearchedChallenge(
  challenge: ResearchedPropChallenge
): {
  challengeType: string;
  displayName: string;
  phases: PropChallengePhase[];
} {
  return {
    challengeType: normalizeChallengeType(challenge.challengeType),
    displayName: challenge.displayName,
    phases: challenge.phases.map((phase) => ({
      order: phase.order,
      name: phase.name,
      profitTarget: phase.profitTarget,
      profitTargetType: phase.profitTargetType,
      dailyLossLimit: phase.dailyLossLimit,
      dailyLossLimitType: phase.dailyLossLimitType ?? null,
      maxLoss: phase.maxLoss,
      maxLossType: phase.maxLossType,
      timeLimitDays: phase.timeLimitDays,
      minTradingDays: phase.minTradingDays,
      consistencyRule: phase.consistencyRule,
      customRules: {
        ...phase.customRules,
        challengeAccountSizes: challenge.accountSizes,
        challengePricing: challenge.pricing,
        challengeSources: challenge.sources,
      },
    })),
  };
}

export function getBuiltinPropFirmSeeds(): PropFirmSeedRow[] {
  return PROP_FIRM_CATALOG.map((firm) => ({
    id: firm.id,
    createdByUserId: null,
    name: firm.name,
    displayName: firm.displayName,
    description: firm.description,
    logo: firm.logo,
    website: firm.website,
    supportedPlatforms: firm.supportedPlatforms,
    brokerDetectionPatterns: [
      ...new Set([...firm.brokerDetectionPatterns, ...firm.aliases]),
    ],
    active: firm.status === "active",
    createdAt: BUILTIN_PROP_TIMESTAMP,
    updatedAt: BUILTIN_PROP_TIMESTAMP,
  }));
}

export function getBuiltinPropChallengeRuleSeeds(): PropChallengeRuleSeedRow[] {
  return PROP_FIRM_CATALOG.filter((firm) => firm.status === "active").flatMap(
    (firm) => {
      const seenChallengeTypes = new Map<string, number>();

      return challengeTypesForFirm(firm).map((entry) => {
        const nextCount = (seenChallengeTypes.get(entry.challengeType) ?? 0) + 1;
        seenChallengeTypes.set(entry.challengeType, nextCount);

        return {
          id:
            nextCount === 1
              ? `${firm.id}-${entry.challengeType}`
              : `${firm.id}-${entry.challengeType}-${nextCount}`,
        createdByUserId: null,
        propFirmId: firm.id,
        challengeType: entry.challengeType,
        displayName: entry.displayName,
        phases: entry.phases,
        active: true,
        createdAt: BUILTIN_PROP_TIMESTAMP,
        updatedAt: BUILTIN_PROP_TIMESTAMP,
        };
      });
    }
  );
}
