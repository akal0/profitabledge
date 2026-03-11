"use client";

import { trpc } from "@/utils/trpc";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  XCircle,
  Lock,
  Trophy,
  Calendar,
  Target,
  AlertTriangle,
  Shield,
  Clock,
} from "lucide-react";

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
  currentProfit,
  isLast,
}: {
  phase: PhaseDefinition;
  state: PhaseState;
  daysSpent: number | null;
  currentProfit: number | null;
  isLast: boolean;
}) {
  const profitDisplay =
    phase.profitTargetType === "percentage"
      ? `${phase.profitTarget}%`
      : `$${phase.profitTarget.toLocaleString()}`;

  const currentProfitDisplay =
    currentProfit !== null
      ? phase.profitTargetType === "percentage"
        ? `${currentProfit >= 0 ? "+" : ""}${currentProfit.toFixed(2)}%`
        : `$${currentProfit.toLocaleString()}`
      : null;

  return (
    <div className="flex items-start flex-1 min-w-0">
      <div className="flex flex-col items-center">
        {/* Node circle */}
        <div
          className={cn(
            "relative flex items-center justify-center size-9 rounded-full border-2 transition-all duration-300",
            state === "active" &&
              "border-blue-400 bg-blue-400/10 shadow-[0_0_12px_rgba(96,165,250,0.4)]",
            state === "completed" &&
              "border-emerald-400 bg-emerald-400/10",
            state === "failed" &&
              "border-rose-400 bg-rose-400/10",
            state === "pending" &&
              "border-white/10 bg-white/5"
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
        <div className="mt-2.5 flex flex-col items-center text-center max-w-[120px]">
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

          {/* Days spent */}
          {daysSpent !== null && state !== "pending" && (
            <span className="text-[10px] text-white/30 mt-0.5 tabular-nums">
              {daysSpent}d
              {phase.timeLimitDays ? ` / ${phase.timeLimitDays}d` : ""}
            </span>
          )}

          {/* Profit vs target */}
          {state === "active" && currentProfitDisplay !== null && (
            <div className="mt-1 flex flex-col items-center">
              <span
                className={cn(
                  "text-xs font-semibold tabular-nums",
                  (currentProfit ?? 0) >= 0
                    ? "text-emerald-400"
                    : "text-rose-400"
                )}
              >
                {currentProfitDisplay}
              </span>
              <span className="text-[9px] text-white/20">
                of {profitDisplay}
              </span>
            </div>
          )}

          {state === "completed" && (
            <span className="text-[9px] text-emerald-400/60 mt-0.5">
              Passed
            </span>
          )}

          {state === "failed" && (
            <span className="text-[9px] text-rose-400/60 mt-0.5">
              Failed
            </span>
          )}

          {state === "pending" && (
            <span className="text-[9px] text-white/15 mt-0.5">
              Target: {profitDisplay}
            </span>
          )}
        </div>
      </div>

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
}: {
  state: PhaseState;
}) {
  return (
    <div className="flex flex-col items-center">
      {/* Node circle */}
      <div
        className={cn(
          "relative flex items-center justify-center size-9 rounded-full border-2 transition-all duration-300",
          state === "active" &&
            "border-amber-400 bg-amber-400/10 shadow-[0_0_14px_rgba(251,191,36,0.4)]",
          state === "completed" &&
            "border-amber-400 bg-amber-400/10",
          state === "pending" &&
            "border-white/10 bg-white/5"
        )}
      >
        {state === "completed" || state === "active" ? (
          <Trophy className="size-4 text-amber-400" />
        ) : (
          <Lock className="size-3.5 text-white/20" />
        )}
      </div>

      {/* Label */}
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
          <span className="text-[9px] text-amber-400/60 mt-0.5">
            Achieved
          </span>
        )}
      </div>
    </div>
  );
}

function CurrentPhaseRules({ phase }: { phase: PhaseDefinition }) {
  return (
    <div className="bg-sidebar border border-white/5 rounded-md mt-4">
      <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-white/5">
        <Shield className="size-3.5 text-blue-400" />
        <span className="text-[10px] font-medium text-white/50 uppercase tracking-wider">
          Current Phase Rules
        </span>
        <span className="text-[10px] text-blue-400 ml-auto">
          {phase.name}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 p-3">
        {/* Profit Target */}
        <div className="flex items-center gap-2">
          <Target className="size-3 text-emerald-400/60 shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] text-white/30">Profit Target</div>
            <div className="text-xs font-medium text-white/80 tabular-nums">
              {phase.profitTargetType === "percentage"
                ? `${phase.profitTarget}%`
                : `$${phase.profitTarget.toLocaleString()}`}
            </div>
          </div>
        </div>

        {/* Daily Loss Limit */}
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-3 text-rose-400/60 shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] text-white/30">Daily Loss Limit</div>
            <div className="text-xs font-medium text-white/80 tabular-nums">
              {phase.dailyLossLimit !== null
                ? `${phase.dailyLossLimit}%`
                : "None"}
            </div>
          </div>
        </div>

        {/* Max Loss */}
        <div className="flex items-center gap-2">
          <Shield className="size-3 text-rose-400/60 shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] text-white/30">Max Drawdown</div>
            <div className="text-xs font-medium text-white/80 tabular-nums">
              {phase.maxLoss !== null
                ? `${phase.maxLoss}%`
                : "None"}
            </div>
          </div>
        </div>

        {/* Time Limit */}
        <div className="flex items-center gap-2">
          <Clock className="size-3 text-white/30 shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] text-white/30">Time Limit</div>
            <div className="text-xs font-medium text-white/80 tabular-nums">
              {phase.timeLimitDays !== null
                ? `${phase.timeLimitDays} days`
                : "Unlimited"}
            </div>
          </div>
        </div>

        {/* Min Trading Days */}
        <div className="flex items-center gap-2">
          <Calendar className="size-3 text-white/30 shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] text-white/30">Min Trading Days</div>
            <div className="text-xs font-medium text-white/80 tabular-nums">
              {phase.minTradingDays !== null && phase.minTradingDays > 0
                ? `${phase.minTradingDays} days`
                : "None"}
            </div>
          </div>
        </div>
      </div>
    </div>
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
          "bg-sidebar border border-white/5 rounded-md p-4",
          className
        )}
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="size-4 rounded bg-white/5 animate-pulse" />
          <div className="h-3 w-32 rounded bg-white/5 animate-pulse" />
        </div>
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
          "bg-sidebar border border-white/5 rounded-md p-4",
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

  const { account, challengeRule, currentPhase } = dashboard;
  const phases = (challengeRule?.phases as PhaseDefinition[] | null) ?? [];

  // Sort phases by order
  const sortedPhases = [...phases].sort((a, b) => a.order - b.order);

  const accountCurrentPhase = account.propCurrentPhase ?? 1;
  const accountPhaseStatus = account.propPhaseStatus ?? "active";

  // Determine funded node state
  const fundedState: PhaseState =
    accountCurrentPhase === 0
      ? "active"
      : sortedPhases.length > 0 &&
          accountCurrentPhase > sortedPhases[sortedPhases.length - 1]?.order
        ? "active"
        : "pending";

  // Find the active current-phase definition for the rules summary
  const activePhaseDefinition =
    currentPhase as PhaseDefinition | null ??
    sortedPhases.find((p: any) => p.order === accountCurrentPhase) ??
    null;

  return (
    <div className={cn("bg-sidebar border border-white/5 rounded-md p-4", className)}>
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-5">
        <Trophy className="size-4 text-amber-400/70" />
        <span className="text-xs font-medium text-white/50">
          Phase Timeline
        </span>
      </div>

      {/* Timeline */}
      <div className="flex items-start justify-center px-2">
        {sortedPhases.map((phase: any, idx: number) => {
          const state = getPhaseState(
            phase.order,
            accountCurrentPhase,
            accountPhaseStatus
          );

          // Calculate days spent for active or completed phases
          let daysSpent: number | null = null;
          if (state === "active") {
            daysSpent = account.propPhaseTradingDays ?? 0;
          } else if (state === "completed") {
            // For past completed phases we don't have individual historical data,
            // show null (the node will omit the days line)
            daysSpent = null;
          }

          // Current profit only for the active phase
          const currentProfit =
            state === "active"
              ? parseFloat(
                  account.propPhaseCurrentProfitPercent?.toString() || "0"
                )
              : null;

          return (
            <PhaseNode
              key={phase.order}
              phase={phase}
              state={state}
              daysSpent={daysSpent}
              currentProfit={currentProfit}
              isLast={false}
            />
          );
        })}

        {/* Funded node */}
        <FundedNode state={fundedState} />
      </div>

      {/* Current Phase Rules Summary */}
      {activePhaseDefinition && accountCurrentPhase !== 0 && (
        <CurrentPhaseRules phase={activePhaseDefinition} />
      )}
    </div>
  );
}
