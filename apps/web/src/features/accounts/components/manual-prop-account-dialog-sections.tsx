"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Minus, Plus } from "lucide-react";

import {
  HEADER_BADGE_CLASS,
  PropFirmAvatar,
  TRADE_SURFACE_CARD_CLASS,
  type AccountRecord,
  type PropFirmOption,
} from "@/features/accounts/components/account-section-shell";
import { ManualPropFlowBuilder } from "@/features/accounts/components/manual-prop-flow-builder";
import { getPropAssignActionButtonClassName } from "@/features/accounts/lib/prop-assign-action-button";
import type {
  ContinuableChallengeOption,
  PropChallengeRuleOption,
} from "@/features/accounts/lib/manual-prop-account-dialog";
import {
  PROP_ASSIGN_SELECT_CONTENT_CLASS,
  PROP_ASSIGN_SELECT_ITEM_CLASS,
  PROP_ASSIGN_SELECT_LABEL_CLASS,
  PROP_ASSIGN_SELECT_SEPARATOR_CLASS,
  formatChallengeRuleRequirements,
  getContinuableChallengeAccountName,
  getPropAssignSelectTriggerClassName,
  getPropAssignSelectableSurfaceClassName,
  isFundedContinuableChallenge,
} from "@/features/accounts/lib/manual-prop-account-dialog";
import { cn } from "@/lib/utils";

type BuilderState = {
  customPropFirmName: string;
  customChallengePhases: React.ComponentProps<
    typeof ManualPropFlowBuilder
  >["customChallengePhases"];
  customFundedPhase: React.ComponentProps<
    typeof ManualPropFlowBuilder
  >["customFundedPhase"];
  applySharedMaxLoss: boolean;
  sharedMaxLoss: string;
  applySharedMinTradingDays: boolean;
  sharedMinTradingDays: string;
  metricMode: "percentage" | "absolute";
  maxLossType: "absolute" | "trailing";
};

export function PropFirmSelectOptionContent({
  firm,
  compact = false,
}: {
  firm: PropFirmOption;
  compact?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <PropFirmAvatar
        firm={firm}
        className={cn(compact ? "size-8" : "size-10", "shrink-0")}
      />
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-5 text-white">
          {firm.displayName || "Prop firm"}
        </p>
        <p className="mt-0.5 whitespace-normal break-words text-[11px] leading-relaxed text-white/45">
          {firm.description ||
            (firm.createdByUserId
              ? "Private custom prop flow for your workspace."
              : "Move this account into prop accounts with its challenge rules attached.")}
        </p>
      </div>
    </div>
  );
}

export function ChallengeRuleSelectOptionContent({
  rule,
}: {
  rule: PropChallengeRuleOption;
}) {
  const summary = formatChallengeRuleRequirements(rule);
  const isCustom = Boolean(rule.createdByUserId);

  return (
    <div className="min-w-full w-full">
      <div className="flex items-center justify-between gap-2 w-full">
        <p className=" truncate text-xs font-semibold leading-5 text-white">
          {rule.displayName || "Challenge rule"}
        </p>
        <Badge
          variant="outline"
          className={cn(
            HEADER_BADGE_CLASS,
            isCustom
              ? "ring-teal-400/20 bg-teal-400/10 text-teal-100/80"
              : "ring-white/10 bg-transparent text-white/55"
          )}
        >
          {isCustom ? "Custom" : "Standard"}
        </Badge>
      </div>
      <p className="mt-0.5 whitespace-normal break-words text-[11px] leading-relaxed text-white/45">
        {rule.createdByUserId
          ? `Custom template${summary ? ` • ${summary}` : ""}`
          : summary}
      </p>
    </div>
  );
}

export function ManualPropAccountSummary({
  account,
  detectedPropFirmName,
}: {
  account: AccountRecord;
  detectedPropFirmName: string | null;
}) {
  return (
    <div className={cn(TRADE_SURFACE_CARD_CLASS, "space-y-2 p-4")}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{account.name}</p>
          <p className="mt-1 text-xs text-white/45">{account.broker}</p>
        </div>
        <Badge
          variant="outline"
          className={cn(
            HEADER_BADGE_CLASS,
            "ring-white/10 bg-transparent text-white/55"
          )}
        >
          Broker account
        </Badge>
      </div>
      {account.propDetectedFirmId ? (
        <div className="rounded-sm ring-1 ring-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/75">
          We detected this might already be{" "}
          {detectedPropFirmName || "a prop account"}. Confirm the firm below and
          save.
        </div>
      ) : null}
    </div>
  );
}

export function ManualPropAssignmentModeSection({
  assignmentMode,
  onAssignmentModeChange,
  continuableChallengeOptions,
}: {
  assignmentMode: "new" | "continue";
  onAssignmentModeChange: (mode: "new" | "continue") => void;
  continuableChallengeOptions: ContinuableChallengeOption[];
}) {
  return (
    <div className="space-y-3 px-6 py-5">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onAssignmentModeChange("new")}
          className={getPropAssignSelectableSurfaceClassName({
            selected: assignmentMode === "new",
            tone: "teal",
            className: "px-3 py-3 cursor-pointer",
          })}
        >
          <p className="text-xs font-semibold text-white">Start new</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-white/45">
            Use this account as a fresh challenge at Phase 1.
          </p>
        </button>
        <button
          type="button"
          onClick={() =>
            continuableChallengeOptions.length > 0 &&
            onAssignmentModeChange("continue")
          }
          disabled={continuableChallengeOptions.length === 0}
          className={getPropAssignSelectableSurfaceClassName({
            selected: assignmentMode === "continue",
            tone: "teal",
            className: "px-3 py-3 cursor-pointer",
          })}
        >
          <p className="text-xs font-semibold text-white">Continue existing</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-white/45">
            Link this account to a passed stage and keep the same tracker.
          </p>
        </button>
      </div>
      {assignmentMode === "continue" &&
      continuableChallengeOptions.length === 0 ? (
        <p className="text-xs text-white/35">
          No active or passed challenges are available yet. Start a new
          challenge first.
        </p>
      ) : null}
    </div>
  );
}

export function ManualPropContinuableChallenges({
  continuableChallengeOptions,
  selectedChallengeInstanceId,
  onSelectChallenge,
}: {
  continuableChallengeOptions: ContinuableChallengeOption[];
  selectedChallengeInstanceId: string;
  onSelectChallenge: (challengeId: string) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-white/50">Existing challenge</p>
      <div className="grid gap-3">
        {continuableChallengeOptions.map((challenge) => {
          const isSelected = selectedChallengeInstanceId === challenge.id;
          const isFundedChallenge = isFundedContinuableChallenge(challenge);
          const phaseName = isFundedChallenge
            ? "Funded"
            : challenge.currentPhase?.name ||
              `Phase ${challenge.currentPhase?.order ?? 1}`;
          const challengeAccountName =
            getContinuableChallengeAccountName(challenge);
          const statusLabel = isFundedChallenge
            ? "Funded"
            : challenge.status || "Challenge";

          return (
            <button
              key={challenge.id}
              type="button"
              onClick={() => onSelectChallenge(challenge.id)}
              className={getPropAssignSelectableSurfaceClassName({
                selected: isSelected,
                tone: isFundedChallenge ? "gold" : "teal",
                className: "px-4 py-4 cursor-pointer",
              })}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-4">
                  <PropFirmAvatar
                    firm={challenge.propFirm}
                    className="size-12 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">
                      {challenge.propFirm?.displayName ||
                        challenge.challengeRule?.displayName ||
                        "Challenge"}
                    </p>
                    <p className="mt-1 text-xs text-white/45">
                      {phaseName}
                      {challengeAccountName ? ` • ${challengeAccountName}` : ""}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    HEADER_BADGE_CLASS,
                    "ring-white/10 bg-transparent text-white/55"
                  )}
                >
                  {statusLabel}
                </Badge>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ManualPropFlowSelectionSection({
  showCustomFlowBuilder,
  customFlowMode,
  onToggleSelectedFirmBuilder,
  onTogglePrivateFirmBuilder,
  builderState,
  onBuilderStateChange,
  onAddPhase,
  onRemoveChallengePhase,
  onResetBuilder,
  onSaveCustomFlow,
  isSavingCustomFlow,
  selectedPropFirmId,
  selectedChallengeRuleId,
  selectedPropFirm,
  selectedChallengeRule,
  propFirmOptions,
  challengeRuleOptions,
  onSelectPropFirm,
  onSelectChallengeRule,
}: {
  showCustomFlowBuilder: boolean;
  customFlowMode: "selected-firm" | "private-firm";
  onToggleSelectedFirmBuilder: () => void;
  onTogglePrivateFirmBuilder: () => void;
  builderState: BuilderState;
  onBuilderStateChange: {
    setCustomPropFirmName: (value: string) => void;
    updateCustomChallengePhase: (
      phaseIndex: number,
      key: keyof BuilderState["customChallengePhases"][number],
      value: string
    ) => void;
    updateCustomFundedPhase: (
      key: keyof BuilderState["customFundedPhase"],
      value: string
    ) => void;
    setSharedMaxLoss: (value: string) => void;
    setSharedMinTradingDays: (value: string) => void;
    setMetricMode: (value: "percentage" | "absolute") => void;
    setMaxLossType: (value: "absolute" | "trailing") => void;
    toggleSharedMaxLoss: (checked: boolean) => void;
    toggleSharedMinTradingDays: (checked: boolean) => void;
  };
  onAddPhase: () => void;
  onRemoveChallengePhase: (phaseIndex: number) => void;
  onResetBuilder: () => void;
  onSaveCustomFlow: () => void;
  isSavingCustomFlow: boolean;
  selectedPropFirmId: string;
  selectedChallengeRuleId: string;
  selectedPropFirm: PropFirmOption | null;
  selectedChallengeRule: PropChallengeRuleOption | null;
  propFirmOptions: PropFirmOption[];
  challengeRuleOptions: PropChallengeRuleOption[];
  onSelectPropFirm: (value: string) => void;
  onSelectChallengeRule: (value: string) => void;
}) {
  const {
    customPropFirmName,
    customChallengePhases,
    customFundedPhase,
    applySharedMaxLoss,
    sharedMaxLoss,
    applySharedMinTradingDays,
    sharedMinTradingDays,
  } = builderState;

  return (
    <>
      <div className="space-y-3">
        <div className="space-y-3.5">
          <div>
            <p className="text-xs font-semibold tracking-wide text-white/70">
              Custom challenge template
            </p>
          </div>
          <Separator className="-mx-6" />
          <div className="space-y-3">
            <p className="max-w-full text-xs leading-relaxed text-white/40">
              Save your own rule template under the selected prop firm, or make
              a completely private prop firm flow.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                disabled={!selectedPropFirmId}
                className={getPropAssignActionButtonClassName({
                  tone:
                    showCustomFlowBuilder && customFlowMode === "selected-firm"
                      ? "neutral"
                      : "teal",
                  size: "sm",
                  className: "gap-1",
                })}
                onClick={onToggleSelectedFirmBuilder}
              >
                {showCustomFlowBuilder && customFlowMode === "selected-firm" ? (
                  <Minus className="size-3" />
                ) : (
                  <Plus className="size-3" />
                )}
                {showCustomFlowBuilder && customFlowMode === "selected-firm"
                  ? "Hide template builder"
                  : "Custom template for selected firm"}
              </Button>

              <Button
                type="button"
                className={getPropAssignActionButtonClassName({
                  tone:
                    showCustomFlowBuilder && customFlowMode === "private-firm"
                      ? "neutral"
                      : "neutral",
                  size: "sm",
                  className: "gap-1",
                })}
                onClick={onTogglePrivateFirmBuilder}
              >
                {showCustomFlowBuilder && customFlowMode === "private-firm" ? (
                  <Minus className="size-3" />
                ) : (
                  <Plus className="size-3" />
                )}
                {showCustomFlowBuilder && customFlowMode === "private-firm"
                  ? "Hide private flow builder"
                  : "Private custom firm"}
              </Button>
            </div>
          </div>
        </div>

        {showCustomFlowBuilder ? (
          <ManualPropFlowBuilder
            customPropFirmName={customPropFirmName}
            onCustomPropFirmNameChange={
              onBuilderStateChange.setCustomPropFirmName
            }
            customChallengePhases={customChallengePhases}
            customFundedPhase={customFundedPhase}
            applySharedMaxLoss={applySharedMaxLoss}
            sharedMaxLoss={sharedMaxLoss}
            applySharedMinTradingDays={applySharedMinTradingDays}
            sharedMinTradingDays={sharedMinTradingDays}
            metricMode={builderState.metricMode}
            maxLossType={builderState.maxLossType}
            onAddPhase={onAddPhase}
            onCustomChallengePhaseChange={
              onBuilderStateChange.updateCustomChallengePhase
            }
            onRemoveChallengePhase={onRemoveChallengePhase}
            onCustomFundedPhaseChange={
              onBuilderStateChange.updateCustomFundedPhase
            }
            onApplySharedMaxLossChange={
              onBuilderStateChange.toggleSharedMaxLoss
            }
            onSharedMaxLossChange={onBuilderStateChange.setSharedMaxLoss}
            onApplySharedMinTradingDaysChange={
              onBuilderStateChange.toggleSharedMinTradingDays
            }
            onSharedMinTradingDaysChange={
              onBuilderStateChange.setSharedMinTradingDays
            }
            onMetricModeChange={onBuilderStateChange.setMetricMode}
            onMaxLossTypeChange={onBuilderStateChange.setMaxLossType}
            onReset={onResetBuilder}
            onSave={onSaveCustomFlow}
            isSaving={isSavingCustomFlow}
            propFirmNameLocked={
              customFlowMode === "selected-firm"
                ? selectedPropFirm?.displayName || selectedPropFirm?.id || null
                : null
            }
          />
        ) : null}
      </div>

      {!showCustomFlowBuilder ? (
        <>
          <Separator className="-mx-6" />

          <div className="space-y-3.5">
            <p className="text-xs font-semibold tracking-wide text-white/70">
              Selected flow
            </p>
            <Separator className="-mx-6" />
            <div className="space-y-3">
              <p className="text-xs text-white/50">Prop firm</p>
              <Select
                value={selectedPropFirmId}
                onValueChange={onSelectPropFirm}
              >
                <SelectTrigger
                  className={getPropAssignSelectTriggerClassName(
                    "min-h-[85px]"
                  )}
                >
                  {selectedPropFirm ? (
                    <div className="flex w-full min-w-0 flex-1 items-center gap-3 pr-6">
                      <div className="min-w-0 flex-1 text-left">
                        <PropFirmSelectOptionContent firm={selectedPropFirm} />
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-white/45">
                      Select prop firm
                    </span>
                  )}
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  className={PROP_ASSIGN_SELECT_CONTENT_CLASS}
                >
                  <div className={PROP_ASSIGN_SELECT_LABEL_CLASS}>
                    Prop firms
                  </div>
                  <SelectSeparator
                    className={PROP_ASSIGN_SELECT_SEPARATOR_CLASS}
                  />
                  {propFirmOptions.map((firm) => (
                    <SelectItem
                      key={firm.id}
                      value={firm.id}
                      className={PROP_ASSIGN_SELECT_ITEM_CLASS}
                    >
                      <PropFirmSelectOptionContent firm={firm} compact />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-white/50">Challenge rule</p>
              <Select
                value={selectedChallengeRuleId}
                onValueChange={onSelectChallengeRule}
                disabled={!selectedPropFirmId}
              >
                <SelectTrigger
                  className={getPropAssignSelectTriggerClassName(
                    "min-h-[75px] px-6"
                  )}
                >
                  {selectedChallengeRule ? (
                    <div className="min-w-0 w-full flex-1 pr-6 text-left">
                      <ChallengeRuleSelectOptionContent
                        rule={selectedChallengeRule}
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-white/45">
                      {selectedPropFirmId
                        ? "Select challenge rule"
                        : "Select a prop firm first"}
                    </span>
                  )}
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  className={PROP_ASSIGN_SELECT_CONTENT_CLASS}
                >
                  <div className={PROP_ASSIGN_SELECT_LABEL_CLASS}>
                    Challenge rules
                  </div>
                  <SelectSeparator
                    className={PROP_ASSIGN_SELECT_SEPARATOR_CLASS}
                  />
                  {challengeRuleOptions.map((rule) => (
                    <SelectItem
                      key={rule.id}
                      value={rule.id}
                      className={PROP_ASSIGN_SELECT_ITEM_CLASS}
                    >
                      <ChallengeRuleSelectOptionContent rule={rule} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!selectedPropFirmId ? (
              <p className="text-xs text-white/35">Select a prop firm first.</p>
            ) : null}
            {selectedPropFirmId && challengeRuleOptions.length === 0 ? (
              <p className="text-xs text-white/35">
                No challenge rules are configured for this firm yet.
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </>
  );
}
