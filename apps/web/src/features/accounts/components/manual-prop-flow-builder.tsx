"use client";

import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { TRADE_SURFACE_CARD_CLASS } from "@/components/trades/trade-identifier-pill";
import { getPropAssignActionButtonClassName } from "@/features/accounts/lib/prop-assign-action-button";
import { cn } from "@/lib/utils";

export type CustomChallengePhaseDraft = {
  profitTarget: string;
  dailyLossLimit: string;
  maxLoss: string;
  timeLimitDays: string;
  minTradingDays: string;
};

export type CustomFundedPhaseDraft = Omit<
  CustomChallengePhaseDraft,
  "profitTarget"
>;

export function createCustomChallengePhaseDraft(): CustomChallengePhaseDraft {
  return {
    profitTarget: "",
    dailyLossLimit: "",
    maxLoss: "",
    timeLimitDays: "",
    minTradingDays: "0",
  };
}

export function createCustomFundedPhaseDraft(): CustomFundedPhaseDraft {
  return {
    dailyLossLimit: "",
    maxLoss: "",
    timeLimitDays: "",
    minTradingDays: "0",
  };
}

export function CustomPhaseEditor({
  title,
  description,
  phase,
  onPhaseChange,
  showTarget = true,
  onRemove,
  disableMaxLoss = false,
  disableMinTradingDays = false,
  metricMode = "percentage",
  maxLossType = "absolute",
}: {
  title: string;
  description: string;
  phase: CustomChallengePhaseDraft | CustomFundedPhaseDraft;
  onPhaseChange: (
    key: keyof CustomChallengePhaseDraft | keyof CustomFundedPhaseDraft,
    value: string
  ) => void;
  showTarget?: boolean;
  onRemove?: () => void;
  disableMaxLoss?: boolean;
  disableMinTradingDays?: boolean;
  metricMode?: "percentage" | "absolute";
  maxLossType?: "absolute" | "trailing";
}) {
  const targetLabel = metricMode === "absolute" ? "Target" : "Target %";
  const dailyLabel =
    metricMode === "absolute" ? "Daily limit" : "Daily DD %";
  const maxLossLabel =
    metricMode === "absolute"
      ? maxLossType === "trailing"
        ? "Trailing loss"
        : "Max loss"
      : maxLossType === "trailing"
        ? "Trailing DD %"
        : "Max DD %";

  return (
    <div className={cn(TRADE_SURFACE_CARD_CLASS, "space-y-4 rounded-sm p-4")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-white/45">
            {description}
          </p>
        </div>
        {onRemove ? (
          <Button
            type="button"
            className={getPropAssignActionButtonClassName({
              tone: "danger",
              size: "xs",
            })}
            onClick={onRemove}
          >
            Remove
          </Button>
        ) : null}
      </div>

      <div
        className={cn(
          "grid gap-3",
          showTarget ? "sm:grid-cols-2 xl:grid-cols-5" : "sm:grid-cols-2"
        )}
      >
        {showTarget ? (
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-white/55">{targetLabel}</p>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="1"
              value={"profitTarget" in phase ? phase.profitTarget : ""}
              onChange={(event) =>
                onPhaseChange("profitTarget", event.target.value)
              }
              placeholder="10"
              className="h-9 rounded-sm ring-white/10 bg-sidebar text-sm text-white"
            />
          </div>
        ) : null}

        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-white/55">{dailyLabel}</p>
          <Input
            type="number"
            inputMode="decimal"
            min="0"
            step="1"
            value={phase.dailyLossLimit}
            onChange={(event) =>
              onPhaseChange("dailyLossLimit", event.target.value)
            }
            placeholder="5"
            className="h-9 rounded-sm ring-white/10 bg-sidebar text-sm text-white"
          />
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-white/55">{maxLossLabel}</p>
          <Input
            type="number"
            inputMode="decimal"
            min="0"
            step="1"
            value={phase.maxLoss}
            onChange={(event) => onPhaseChange("maxLoss", event.target.value)}
            placeholder="10"
            disabled={disableMaxLoss}
            className="h-9 rounded-sm ring-white/10 bg-sidebar text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-white/55">Min days</p>
          <Input
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            value={phase.minTradingDays}
            onChange={(event) =>
              onPhaseChange("minTradingDays", event.target.value)
            }
            placeholder="4"
            disabled={disableMinTradingDays}
            className="h-9 rounded-sm ring-white/10 bg-sidebar text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-white/55">
            Time limit (days)
          </p>
          <Input
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            value={phase.timeLimitDays}
            onChange={(event) =>
              onPhaseChange("timeLimitDays", event.target.value)
            }
            placeholder="30"
            className="h-9 rounded-sm ring-white/10 bg-sidebar text-sm text-white"
          />
        </div>
      </div>
    </div>
  );
}

export function ManualPropFlowBuilder({
  customPropFirmName,
  onCustomPropFirmNameChange,
  customChallengePhases,
  customFundedPhase,
  applySharedMaxLoss,
  sharedMaxLoss,
  applySharedMinTradingDays,
  sharedMinTradingDays,
  metricMode,
  maxLossType,
  onAddPhase,
  onCustomChallengePhaseChange,
  onRemoveChallengePhase,
  onCustomFundedPhaseChange,
  onApplySharedMaxLossChange,
  onSharedMaxLossChange,
  onApplySharedMinTradingDaysChange,
  onSharedMinTradingDaysChange,
  onMetricModeChange,
  onMaxLossTypeChange,
  onReset,
  onSave,
  isSaving,
  propFirmNameLocked,
}: {
  customPropFirmName: string;
  onCustomPropFirmNameChange: (value: string) => void;
  customChallengePhases: CustomChallengePhaseDraft[];
  customFundedPhase: CustomFundedPhaseDraft;
  applySharedMaxLoss: boolean;
  sharedMaxLoss: string;
  applySharedMinTradingDays: boolean;
  sharedMinTradingDays: string;
  metricMode: "percentage" | "absolute";
  maxLossType: "absolute" | "trailing";
  onAddPhase: () => void;
  onCustomChallengePhaseChange: (
    phaseIndex: number,
    key: keyof CustomChallengePhaseDraft,
    value: string
  ) => void;
  onRemoveChallengePhase: (phaseIndex: number) => void;
  onCustomFundedPhaseChange: (
    key: keyof CustomFundedPhaseDraft,
    value: string
  ) => void;
  onApplySharedMaxLossChange: (checked: boolean) => void;
  onSharedMaxLossChange: (value: string) => void;
  onApplySharedMinTradingDaysChange: (checked: boolean) => void;
  onSharedMinTradingDaysChange: (value: string) => void;
  onMetricModeChange: (value: "percentage" | "absolute") => void;
  onMaxLossTypeChange: (value: "absolute" | "trailing") => void;
  onReset: () => void;
  onSave: () => void;
  isSaving: boolean;
  propFirmNameLocked?: string | null;
}) {
  return (
    <div className="-mx-6">
      <Separator />

      <div className="space-y-4 px-6 py-5">
        {propFirmNameLocked ? (
          <div className="space-y-2">
            <p className="text-xs text-white/50">Prop firm</p>
            <div
              className={cn(
                TRADE_SURFACE_CARD_CLASS,
                "rounded-sm px-4 py-3 text-sm text-white"
              )}
            >
              {propFirmNameLocked}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-white/50">Prop firm name</p>
            <Input
              value={customPropFirmName}
              onChange={(event) => onCustomPropFirmNameChange(event.target.value)}
              placeholder="Profitabledge"
              className="h-9 rounded-sm ring-white/10 bg-sidebar text-sm text-white"
            />
          </div>
        )}
      </div>

      <Separator />
      <div className="px-6 py-5">
        <div className="mb-4 grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-white/55">Rule units</p>
            <Select value={metricMode} onValueChange={onMetricModeChange}>
              <SelectTrigger className="h-9 rounded-sm ring-white/10 bg-sidebar text-sm text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Percentage</SelectItem>
                <SelectItem value="absolute">Absolute</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-white/55">Max loss mode</p>
            <Select value={maxLossType} onValueChange={onMaxLossTypeChange}>
              <SelectTrigger className="h-9 rounded-sm ring-white/10 bg-sidebar text-sm text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="absolute">Static</SelectItem>
                <SelectItem value="trailing">Trailing</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-white/70">
              Challenge phases
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-white/40">
              Add as many phases as you need before funded.
            </p>
          </div>
          <Button
            type="button"
            className={cn(
              getPropAssignActionButtonClassName({
                tone: "teal",
                size: "xs",
              }),
              "gap-1 text-[11px]"
            )}
            onClick={onAddPhase}
          >
            <Plus className="size-3" />
            Add phase
          </Button>
        </div>
      </div>
      <Separator />

      <div className="space-y-4 px-6 py-5">
        <div className="grid gap-3 md:grid-cols-2">
          <div className={cn(TRADE_SURFACE_CARD_CLASS, "space-y-3 rounded-sm p-4")}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold text-white/70">
                  Same max drawdown every phase
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-white/40">
                  Apply one max drawdown rule across all challenge phases.
                </p>
              </div>
              <Switch
                checked={applySharedMaxLoss}
                onCheckedChange={onApplySharedMaxLossChange}
              />
            </div>
            <div className="space-y-1.5">
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="1"
                value={sharedMaxLoss}
                onChange={(event) => onSharedMaxLossChange(event.target.value)}
                disabled={!applySharedMaxLoss}
                placeholder="10"
                className="h-9 rounded-sm ring-white/10 bg-sidebar text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          </div>

          <div className={cn(TRADE_SURFACE_CARD_CLASS, "space-y-3 rounded-sm p-4")}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold text-white/70">
                  Same min days every phase
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-white/40">
                  Keep the same minimum trading days across every challenge phase.
                </p>
              </div>
              <Switch
                checked={applySharedMinTradingDays}
                onCheckedChange={onApplySharedMinTradingDaysChange}
              />
            </div>
            <div className="space-y-1.5">
              <Input
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={sharedMinTradingDays}
                onChange={(event) =>
                  onSharedMinTradingDaysChange(event.target.value)
                }
                disabled={!applySharedMinTradingDays}
                placeholder="4"
                className="h-9 rounded-sm ring-white/10 bg-sidebar text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          {customChallengePhases.map((phase, index) => (
            <CustomPhaseEditor
              key={`custom-phase-${index}`}
              title={`Phase ${index + 1}`}
              description="Target, drawdown, and time requirements for this stage."
              phase={phase}
              onPhaseChange={(key, value) =>
                onCustomChallengePhaseChange(index, key, value)
              }
              disableMaxLoss={applySharedMaxLoss}
              disableMinTradingDays={applySharedMinTradingDays}
              metricMode={metricMode}
              maxLossType={maxLossType}
              onRemove={
                customChallengePhases.length > 1
                  ? () => onRemoveChallengePhase(index)
                  : undefined
              }
            />
          ))}
        </div>
      </div>

      <Separator />
      <div className="px-6 py-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-white/70">
            Funded rules
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-white/40">
            Ongoing risk rules after the account reaches funded.
          </p>
        </div>
      </div>
      <Separator />

      <div className="px-6 py-5">
        <CustomPhaseEditor
          title="Funded"
          description="Ongoing risk rules after the account reaches funded."
          phase={customFundedPhase}
          onPhaseChange={(key, value) =>
            onCustomFundedPhaseChange(key as keyof CustomFundedPhaseDraft, value)
          }
          showTarget={false}
          metricMode={metricMode}
          maxLossType={maxLossType}
        />
      </div>

      <div className="px-6 py-5 pt-3">
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            className={getPropAssignActionButtonClassName({
              tone: "neutral",
              className: "bg-transparent",
            })}
            onClick={onReset}
          >
            Reset
          </Button>
          <Button
            type="button"
            className={getPropAssignActionButtonClassName({
              tone: "teal",
            })}
            onClick={onSave}
            disabled={isSaving}
          >
            Save custom flow
          </Button>
        </div>
      </div>
      <Separator />
    </div>
  );
}
