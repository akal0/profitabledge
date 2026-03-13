"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type PropAccountLike = {
  propCurrentPhase?: number | null;
  propPhaseStatus?: string | null;
};

type PropDashboardLike = {
  effectivePhaseStatus?: string | null;
  ruleCheck?: {
    phaseStatus?: string | null;
  } | null;
  account?: {
    propCurrentPhase?: number | null;
  } | null;
  challengeRule?: {
    phases?: Array<{
      order?: number | null;
    }> | null;
  } | null;
};

type PropStatusAppearance = {
  label: string;
  className: string;
};

const DEFAULT_HEADER_BADGE_CLASS =
  "h-7 rounded-sm px-1.5 text-[10px] font-medium";
const FUNDED_APPEARANCE: PropStatusAppearance = {
  label: "Funded",
  className: "border-amber-400/25 bg-amber-400/10 text-amber-200",
};

export function getPropStatusAppearance(
  status: string | null | undefined
): PropStatusAppearance {
  switch (status) {
    case "active":
      return {
        label: "Active",
        className: "border-blue-500/30 bg-blue-500/15 text-blue-400",
      };
    case "passed":
      return {
        label: "Passed",
        className: "border-teal-500/30 bg-teal-500/15 text-teal-400",
      };
    case "failed":
      return {
        label: "Failed",
        className: "border-red-500/30 bg-red-500/15 text-red-400",
      };
    case "paused":
      return {
        label: "Paused",
        className: "border-white/10 bg-sidebar text-white/50",
      };
    default:
      return {
        label: "Unknown",
        className: "border-white/10 bg-black/10 text-white/50 dark:bg-sidebar",
      };
  }
}

export function getEffectivePropTrackerStatus(
  account: PropAccountLike,
  dashboard?: PropDashboardLike
) {
  return (
    dashboard?.effectivePhaseStatus ||
    dashboard?.ruleCheck?.phaseStatus ||
    account.propPhaseStatus ||
    "active"
  );
}

export function isFundedPropTrackerAccount(
  account: PropAccountLike,
  dashboard?: PropDashboardLike
) {
  return (
    (dashboard?.account?.propCurrentPhase ?? account.propCurrentPhase) === 0
  );
}

export function isAboutToPassPropTrackerAccount(
  account: PropAccountLike,
  dashboard?: PropDashboardLike
) {
  if (isFundedPropTrackerAccount(account, dashboard)) {
    return false;
  }

  const effectivePhaseStatus = getEffectivePropTrackerStatus(
    account,
    dashboard
  );
  if (effectivePhaseStatus !== "active") {
    return false;
  }

  const evaluationPhases = Array.isArray(dashboard?.challengeRule?.phases)
    ? dashboard.challengeRule.phases.filter((phase) => (phase?.order ?? 0) > 0)
    : [];
  const finalChallengePhaseOrder = evaluationPhases.reduce(
    (max, phase) => Math.max(max, Number(phase?.order) || 0),
    0
  );

  return (
    finalChallengePhaseOrder > 0 &&
    Number(account.propCurrentPhase || 0) === finalChallengePhaseOrder
  );
}

export function PropAccountStatusBadges({
  account,
  dashboard,
  badgeClassName = DEFAULT_HEADER_BADGE_CLASS,
  className,
}: {
  account: PropAccountLike;
  dashboard?: PropDashboardLike;
  badgeClassName?: string;
  className?: string;
}) {
  const isFunded = isFundedPropTrackerAccount(account, dashboard);
  const statusAppearance = isFunded
    ? FUNDED_APPEARANCE
    : getPropStatusAppearance(
        getEffectivePropTrackerStatus(account, dashboard)
      );
  const isAboutToPass = isAboutToPassPropTrackerAccount(account, dashboard);

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Badge
        variant="outline"
        className={cn(badgeClassName, statusAppearance.className)}
      >
        {statusAppearance.label}
      </Badge>
      {isAboutToPass ? (
        <Badge
          variant="outline"
          className={cn(
            badgeClassName,
            "border-amber-500/30 bg-amber-500/15 text-amber-300"
          )}
        >
          About to pass
        </Badge>
      ) : null}
    </div>
  );
}
