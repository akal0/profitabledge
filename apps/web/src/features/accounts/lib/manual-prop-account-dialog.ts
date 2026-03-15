import { cn } from "@/lib/utils";

import { getPropAssignActionButtonClassName } from "@/features/accounts/lib/prop-assign-action-button";
import {
  FALLBACK_FTMO_PROP_FIRM,
  PROP_ASSIGN_SELECT_SURFACE_CLASS,
  isFtmoFirm,
  toFiniteNumber,
  type PropFirmOption,
} from "@/features/accounts/components/account-section-shell";

export type PropChallengeRuleOption = {
  id: string;
  createdByUserId?: string | null;
  displayName?: string | null;
  challengeType?: string | null;
  phases?: any[] | null;
};

export type ContinuableChallengeOption = {
  id: string;
  status?: string | null;
  currentPhase?: {
    order?: number | null;
    name?: string | null;
  } | null;
  currentAccount?: {
    id?: string | null;
    name?: string | null;
    broker?: string | null;
    propPhaseStatus?: string | null;
  } | null;
  stageAccounts?: Array<{
    account?: {
      id?: string | null;
      name?: string | null;
      broker?: string | null;
    } | null;
  }> | null;
  propFirm?: PropFirmOption | null;
  challengeRule?: PropChallengeRuleOption | null;
};

export type PropAssignSelectableSurfaceTone =
  | "neutral"
  | "teal"
  | "amber"
  | "gold";

export const FALLBACK_FTMO_CHALLENGE_RULE: PropChallengeRuleOption = {
  id: "ftmo-2step",
  displayName: "FTMO 2-Step Challenge",
  challengeType: "standard",
  phases: [
    { order: 1, profitTarget: 10, dailyLossLimit: 5, maxLoss: 10 },
    { order: 2, profitTarget: 5, dailyLossLimit: 5, maxLoss: 10 },
    { order: 0, profitTarget: null, dailyLossLimit: 5, maxLoss: 10 },
  ],
};

export const EMPTY_PROP_FIRMS: PropFirmOption[] = [];
export const EMPTY_CHALLENGE_RULES: PropChallengeRuleOption[] = [];
export const EMPTY_CONTINUABLE_CHALLENGES: ContinuableChallengeOption[] = [];
export const PROP_ASSIGN_SELECT_CONTENT_CLASS = cn(
  PROP_ASSIGN_SELECT_SURFACE_CLASS,
  "max-w-[min(34rem,calc(100vw-3rem))] px-1.5 pb-1.5 pt-1"
);
export const PROP_ASSIGN_SELECT_LABEL_CLASS =
  "px-4 pb-2 pt-1 text-[11px] font-semibold text-white/55";
export const PROP_ASSIGN_SELECT_SEPARATOR_CLASS =
  "-mx-1.5 w-[calc(100%+0.75rem)]";
export const PROP_ASSIGN_SELECT_ITEM_CLASS =
  "h-auto items-start rounded-sm px-5 py-2.5 text-xs text-white/75 whitespace-normal data-[highlighted]:bg-sidebar-accent/80 data-[highlighted]:text-white";

export function getPropFirmOptions(propFirms: PropFirmOption[]) {
  const byId = new Map<string, PropFirmOption>([
    [FALLBACK_FTMO_PROP_FIRM.id, FALLBACK_FTMO_PROP_FIRM],
  ]);

  for (const firm of propFirms) {
    byId.set(firm.id, firm);
  }

  return Array.from(byId.values()).sort((left, right) => {
    if (isFtmoFirm(left) && !isFtmoFirm(right)) return -1;
    if (!isFtmoFirm(left) && isFtmoFirm(right)) return 1;
    return (left.displayName || left.id).localeCompare(
      right.displayName || right.id
    );
  });
}

export function getChallengeRuleOptions(
  propFirmId: string,
  challengeRules: PropChallengeRuleOption[]
) {
  if (propFirmId !== FALLBACK_FTMO_PROP_FIRM.id) {
    return challengeRules;
  }

  const byId = new Map<string, PropChallengeRuleOption>([
    [FALLBACK_FTMO_CHALLENGE_RULE.id, FALLBACK_FTMO_CHALLENGE_RULE],
  ]);

  for (const rule of challengeRules) {
    byId.set(rule.id, rule);
  }

  return Array.from(byId.values());
}

export function getChallengeRuleMetrics(rule: PropChallengeRuleOption) {
  const phases = Array.isArray(rule.phases) ? rule.phases : [];
  const evaluationPhases = phases.filter((phase) => {
    const order = toFiniteNumber(phase?.order);
    return order !== null && order > 0;
  });
  const primaryPhase = evaluationPhases[0] || phases[0] || null;

  return {
    evaluationPhases: evaluationPhases.length || 1,
    profitTarget: toFiniteNumber(primaryPhase?.profitTarget),
    dailyLossLimit: toFiniteNumber(primaryPhase?.dailyLossLimit),
    maxLoss: toFiniteNumber(primaryPhase?.maxLoss),
  };
}

export function formatChallengeRuleRequirements(rule: PropChallengeRuleOption) {
  const metrics = getChallengeRuleMetrics(rule);
  const parts = [
    `${metrics.evaluationPhases} step${
      metrics.evaluationPhases === 1 ? "" : "s"
    }`,
  ];

  if (metrics.profitTarget !== null) parts.push(`${metrics.profitTarget}% target`);
  if (metrics.dailyLossLimit !== null) {
    parts.push(`${metrics.dailyLossLimit}% daily DD`);
  }
  if (metrics.maxLoss !== null) parts.push(`${metrics.maxLoss}% max DD`);

  return parts.join(" • ");
}

export function getOrderedChallengePhases(phases: any[] | null | undefined) {
  return [...(Array.isArray(phases) ? phases : [])]
    .filter((phase) => Number.isFinite(Number(phase?.order)))
    .sort((left, right) => {
      const leftOrder = Number(left?.order);
      const rightOrder = Number(right?.order);
      if (leftOrder === 0) return 1;
      if (rightOrder === 0) return -1;
      return leftOrder - rightOrder;
    });
}

export function getNextChallengePhaseForContinuation(
  challenge: ContinuableChallengeOption | null | undefined
) {
  const currentPhaseOrder = toFiniteNumber(challenge?.currentPhase?.order);
  if (currentPhaseOrder == null || currentPhaseOrder === 0) {
    return null;
  }

  const orderedPhases = getOrderedChallengePhases(
    challenge?.challengeRule?.phases
  );
  const currentIndex = orderedPhases.findIndex(
    (phase) => Number(phase?.order) === currentPhaseOrder
  );

  if (currentIndex === -1) {
    return orderedPhases[0] ?? null;
  }

  return orderedPhases[currentIndex + 1] ?? { order: 0, name: "Funded" };
}

export function isFundedContinuableChallenge(
  challenge: ContinuableChallengeOption | null | undefined
) {
  return toFiniteNumber(challenge?.currentPhase?.order) === 0;
}

export function getContinuableChallengeAccountName(
  challenge: ContinuableChallengeOption | null | undefined
) {
  if (challenge?.currentAccount?.name) {
    return challenge.currentAccount.name;
  }

  return (
    challenge?.stageAccounts?.find((stage) => stage.account?.name)?.account
      ?.name || null
  );
}

export function getSortedContinuableChallenges(
  challenges: ContinuableChallengeOption[]
) {
  return [...challenges].sort((left, right) => {
    const leftIsFunded = isFundedContinuableChallenge(left);
    const rightIsFunded = isFundedContinuableChallenge(right);
    if (leftIsFunded === rightIsFunded) return 0;
    return leftIsFunded ? -1 : 1;
  });
}

export function getPropAssignSelectableSurfaceClassName({
  selected = false,
  tone = "neutral",
  className,
}: {
  selected?: boolean;
  tone?: PropAssignSelectableSurfaceTone;
  className?: string;
}) {
  const selectedToneClass = {
    neutral: "ring-white/14 bg-sidebar-accent/85",
    teal: "ring-teal-400/25 bg-teal-400/10",
    amber: "ring-orange-400/25 bg-orange-400/10",
    gold: "ring-amber-400/25 bg-amber-400/10",
  } as const;

  return cn(
    "rounded-sm ring-1 bg-sidebar text-left shadow-sm transition-all duration-250 active:scale-[0.995] disabled:pointer-events-none disabled:opacity-45",
    selected
      ? selectedToneClass[tone]
      : "ring-white/10 hover:bg-sidebar-accent hover:brightness-110 hover:ring-white/14",
    className
  );
}

export function getPropAssignSelectTriggerClassName(className?: string) {
  return getPropAssignActionButtonClassName({
    tone: "neutral",
    className: cn(
      "h-auto w-full whitespace-normal px-3 py-3 text-left text-sm font-normal text-white cursor-pointer",
      className
    ),
  });
}

export function parsePositiveNumberField(label: string, rawValue: string) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be greater than 0`);
  }
  return parsed;
}

export function parseOptionalPositiveInteger(rawValue: string) {
  if (!rawValue.trim()) return null;
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Time limit must be a whole number greater than 0");
  }
  return parsed;
}

export function parseNonNegativeInteger(label: string, rawValue: string) {
  const normalized = rawValue.trim() || "0";
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be 0 or greater`);
  }
  return parsed;
}
