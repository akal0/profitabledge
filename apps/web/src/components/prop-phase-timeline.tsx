"use client";

import { trpc } from "@/utils/trpc";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, Lock, Trophy, Shield } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

interface PhaseDefinition {
  order: number;
  name: string;
  profitTarget: number;
  profitTargetType: string;
  dailyLossLimit: number | null;
  maxLoss: number | null;
  maxLossType: string | null;
  timeLimitDays: number | null;
  minTradingDays: number | null;
}

type PhaseState = "completed" | "failed" | "active" | "pending";

function formatPhaseMetric(
  value: number | null | undefined,
  type: "percentage" | "absolute" = "percentage"
) {
  if (value == null) return "None";
  return type === "absolute" ? `$${value.toLocaleString()}` : `${value}%`;
}

function PhaseTooltipBody({
  phase,
}: {
  phase: Pick<
    PhaseDefinition,
    | "name"
    | "profitTarget"
    | "profitTargetType"
    | "dailyLossLimit"
    | "maxLoss"
    | "maxLossType"
    | "timeLimitDays"
    | "minTradingDays"
  >;
}) {
  const requirements = [
    {
      label: "Target",
      value:
        phase.profitTarget == null
          ? "No target"
          : formatPhaseMetric(
              phase.profitTarget,
              phase.profitTargetType === "absolute" ? "absolute" : "percentage"
            ),
    },
    {
      label: "Daily DD",
      value: formatPhaseMetric(phase.dailyLossLimit),
    },
    {
      label: "Max DD",
      value:
        phase.maxLoss == null
          ? "None"
          : `${formatPhaseMetric(phase.maxLoss)}${
              phase.maxLossType === "trailing" ? " trailing" : ""
            }`,
    },
    {
      label: "Min Days",
      value:
        phase.minTradingDays && phase.minTradingDays > 0
          ? `${phase.minTradingDays}`
          : "None",
    },
    {
      label: "Time Limit",
      value:
        phase.timeLimitDays && phase.timeLimitDays > 0
          ? `${phase.timeLimitDays}d`
          : "Unlimited",
    },
  ];

  return (
    <div className="min-w-[220px]">
      <div className="px-3 py-3">
        <p className="text-xs font-semibold text-white">{phase.name}</p>
      </div>
      <Separator />
      <div className="space-y-2 px-3 py-3">
        {requirements.map((requirement) => (
          <div
            key={requirement.label}
            className="flex items-center justify-between gap-4"
          >
            <span className="text-[11px] text-white/45">
              {requirement.label}
            </span>
            <span className="text-[11px] font-medium text-white/85">
              {requirement.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function getPhaseState(
  phaseOrder: number,
  currentPhase: number,
  phaseStatus: string | null
): PhaseState {
  // Phase 0 = funded. Phases are 1-indexed for challenges.
  // If the current phase is 0, the account is funded -- all challenge phases are completed.
  if (currentPhase === 0) {
    // Account is funded -- all challenge phases are done
    return "completed";
  }

  if (phaseOrder < currentPhase) {
    return "completed";
  }

  if (phaseOrder === currentPhase) {
    if (phaseStatus === "failed") return "failed";
    if (phaseStatus === "passed") return "completed";
    return "active";
  }

  return "pending";
}

function PhaseNode({
  phase,
  state,
  daysSpent,
  isLast,
}: {
  phase: PhaseDefinition;
  state: PhaseState;
  daysSpent: number | null;
  isLast: boolean;
}) {
  const profitDisplay =
    phase.profitTargetType === "percentage"
      ? `${phase.profitTarget}%`
      : `$${phase.profitTarget.toLocaleString()}`;

  return (
    <div className="flex items-start flex-1 min-w-0">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="flex flex-col items-center rounded-sm outline-none"
            aria-label={`View ${phase.name} requirements`}
          >
            {/* Node circle */}
            <div
              className={cn(
                "relative flex items-center justify-center size-9 rounded-full border-2 transition-all duration-300",
                state === "active" &&
                  "border-blue-400 bg-blue-400/10 shadow-[0_0_12px_rgba(96,165,250,0.4)]",
                state === "completed" && "border-emerald-400 bg-emerald-400/10",
                state === "failed" && "border-rose-400 bg-rose-400/10",
                state === "pending" && "border-white/10 bg-white/5"
              )}
            >
              {state === "completed" && (
                <CheckCircle2 className="size-4 text-emerald-400" />
              )}
              {state === "failed" && (
                <XCircle className="size-4 text-rose-400" />
              )}
              {state === "active" && (
                <div className="size-2.5 rounded-full bg-blue-400 animate-pulse" />
              )}
              {state === "pending" && (
                <Lock className="size-3.5 text-white/20" />
              )}
            </div>

            {/* Phase info below node */}
            <div className="mt-2.5 flex max-w-[140px] flex-col items-center text-center">
              <span
                className={cn(
                  "text-[10px] font-medium leading-tight",
                  state === "active" && "text-blue-400",
                  state === "completed" && "text-emerald-400",
                  state === "failed" && "text-rose-400",
                  state === "pending" && "text-white/25"
                )}
              >
                {phase.name}
              </span>

              {daysSpent !== null && state !== "pending" && (
                <span className="mt-0.5 text-[10px] tabular-nums text-white/30">
                  {daysSpent}d
                  {phase.timeLimitDays ? ` / ${phase.timeLimitDays}d` : ""}
                </span>
              )}

              {state === "completed" && (
                <span className="mt-0.5 text-[9px] text-emerald-400/60">
                  Passed
                </span>
              )}

              {state === "failed" && (
                <span className="mt-0.5 text-[9px] text-rose-400/60">
                  Failed
                </span>
              )}

              {state === "pending" && (
                <span className="mt-0.5 text-[9px] text-white/15">
                  Target: {profitDisplay}
                </span>
              )}
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={10} className="px-0 py-0">
          <PhaseTooltipBody phase={phase} />
        </TooltipContent>
      </Tooltip>

      {/* Connector line */}
      {!isLast && (
        <div className="flex-1 flex items-center pt-[18px] px-2 min-w-[24px]">
          <div
            className={cn(
              "h-px w-full",
              state === "completed" || state === "failed"
                ? "bg-white/15"
                : "bg-white/5"
            )}
          />
        </div>
      )}
    </div>
  );
}

function FundedNode({
  state,
  phase,
}: {
  state: PhaseState;
  phase?: PhaseDefinition | null;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="flex flex-col items-center rounded-sm outline-none"
          aria-label="View funded account requirements"
        >
          <div
            className={cn(
              "relative flex items-center justify-center size-9 rounded-full border-2 transition-all duration-300",
              state === "active" &&
                "border-amber-400 bg-amber-400/10 shadow-[0_0_14px_rgba(251,191,36,0.4)]",
              state === "completed" && "border-amber-400 bg-amber-400/10",
              state === "pending" && "border-white/10 bg-white/5"
            )}
          >
            {state === "completed" || state === "active" ? (
              <Trophy className="size-4 text-amber-400" />
            ) : (
              <Lock className="size-3.5 text-white/20" />
            )}
          </div>

          <div className="mt-2.5 flex flex-col items-center text-center">
            <span
              className={cn(
                "text-[10px] font-medium",
                state === "active" || state === "completed"
                  ? "text-amber-400"
                  : "text-white/25"
              )}
            >
              Funded
            </span>
            {(state === "active" || state === "completed") && (
              <span className="mt-0.5 text-[9px] text-amber-400/60">
                Achieved
              </span>
            )}
          </div>
        </button>
      </TooltipTrigger>
      {phase ? (
        <TooltipContent side="top" sideOffset={10} className="px-0 py-0">
          <PhaseTooltipBody phase={phase} />
        </TooltipContent>
      ) : null}
    </Tooltip>
  );
}

export function PropPhaseTimeline({
  accountId,
  className,
}: {
  accountId: string;
  className?: string;
}) {
  const { data: dashboard, isLoading } =
    trpc.propFirms.getTrackerDashboard.useQuery(
      { accountId },
      { enabled: !!accountId }
    );

  if (isLoading) {
    return (
      <div
        className={cn(
          "bg-sidebar border border-white/5 rounded-md p-4 py-6",
          className
        )}
      >
        <div className="flex items-center justify-center py-8">
          <div className="flex gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="size-9 rounded-full bg-white/5 animate-pulse" />
                <div className="h-2 w-16 rounded bg-white/5 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div
        className={cn(
          "bg-sidebar border border-white/5 rounded-md p-4 py-6",
          className
        )}
      >
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <Shield className="size-6 text-white/10 mb-2" />
          <p className="text-[10px] text-white/30">
            No prop challenge data available
          </p>
        </div>
      </div>
    );
  }

  const { account, challengeRule, ruleCheck } = dashboard;
  const phases = (challengeRule?.phases as PhaseDefinition[] | null) ?? [];

  // Keep challenge phases in the main rail and render funded separately.
  const sortedPhases = [...phases]
    .filter((phase) => phase.order > 0)
    .sort((a, b) => a.order - b.order);
  const hasFundedPhase = phases.some((phase) => phase.order === 0);
  const fundedPhase = phases.find((phase) => phase.order === 0) ?? null;

  const accountCurrentPhase = account.propCurrentPhase ?? 1;
  const accountPhaseStatus =
    dashboard.effectivePhaseStatus ||
    ruleCheck?.phaseStatus ||
    account.propPhaseStatus ||
    "active";

  // Determine funded node state
  const fundedState: PhaseState =
    accountCurrentPhase === 0
      ? "active"
      : sortedPhases.length > 0 &&
        accountCurrentPhase > sortedPhases[sortedPhases.length - 1]?.order
      ? "active"
      : "pending";

  return (
    <div
      className={cn(
        "bg-sidebar border border-white/5 rounded-md p-4 py-6",
        className
      )}
    >
      <div className="flex items-start justify-center px-2">
        {sortedPhases.map((phase: any) => {
          const state = getPhaseState(
            phase.order,
            accountCurrentPhase,
            accountPhaseStatus
          );

          // Calculate days spent for active or completed phases
          let daysSpent: number | null = null;
          if (state === "active") {
            daysSpent =
              ruleCheck?.metrics?.tradingDays ??
              account.propPhaseTradingDays ??
              0;
          } else if (state === "completed") {
            // For past completed phases we don't have individual historical data,
            // show null (the node will omit the days line)
            daysSpent = null;
          }

          return (
            <PhaseNode
              key={phase.order}
              phase={phase}
              state={state}
              daysSpent={daysSpent}
              isLast={false}
            />
          );
        })}

        {hasFundedPhase ? (
          <FundedNode state={fundedState} phase={fundedPhase} />
        ) : null}
      </div>
    </div>
  );
}
