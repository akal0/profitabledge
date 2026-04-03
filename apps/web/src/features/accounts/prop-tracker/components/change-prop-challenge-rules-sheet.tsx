"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Minus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  HEADER_CONTROL_HEIGHT,
  type AccountRecord,
  type PropFirmOption,
} from "@/features/accounts/components/account-section-shell";
import {
  ChallengeRuleSelectOptionContent,
  ManualPropAccountSummary,
} from "@/features/accounts/components/manual-prop-account-dialog-sections";
import {
  createCustomChallengePhaseDraft,
  createCustomFundedPhaseDraft,
  ManualPropFlowBuilder,
  type CustomChallengePhaseDraft,
  type CustomFundedPhaseDraft,
} from "@/features/accounts/components/manual-prop-flow-builder";
import {
  EMPTY_CHALLENGE_RULES,
  getChallengeRuleOptions,
  getOrderedChallengePhases,
  getPropAssignSelectTriggerClassName,
  parseNonNegativeInteger,
  parseOptionalPositiveInteger,
  parsePositiveNumberField,
  PROP_ASSIGN_SELECT_CONTENT_CLASS,
  PROP_ASSIGN_SELECT_ITEM_CLASS,
  PROP_ASSIGN_SELECT_LABEL_CLASS,
  PROP_ASSIGN_SELECT_SEPARATOR_CLASS,
  type PropChallengeRuleOption,
} from "@/features/accounts/lib/manual-prop-account-dialog";
import { getPropAssignActionButtonClassName } from "@/features/accounts/lib/prop-assign-action-button";
import { cn } from "@/lib/utils";
import { queryClient, trpcClient, trpcOptions } from "@/utils/trpc";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function extractChallengeAccountSizes(rule: PropChallengeRuleOption | null) {
  const sizes = new Set<number>();

  for (const phase of Array.isArray(rule?.phases) ? rule.phases : []) {
    const phaseSizes = Array.isArray((phase as any)?.customRules?.challengeAccountSizes)
      ? (phase as any).customRules.challengeAccountSizes
      : [];

    for (const size of phaseSizes) {
      const parsed = Number(size);
      if (Number.isFinite(parsed) && parsed > 0) {
        sizes.add(parsed);
      }
    }
  }

  return Array.from(sizes).sort((left, right) => left - right);
}

export function ChangePropChallengeRulesSheet({
  account,
  open,
  onOpenChange,
}: {
  account: AccountRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const tanstackQueryClient = useQueryClient();
  const propFirmId = account.propFirmId || "";

  const [selectedChallengeRuleId, setSelectedChallengeRuleId] = useState("");
  const [showCustomFlowBuilder, setShowCustomFlowBuilder] = useState(false);
  const [customChallengePhases, setCustomChallengePhases] = useState<
    CustomChallengePhaseDraft[]
  >([createCustomChallengePhaseDraft(), createCustomChallengePhaseDraft()]);
  const [customFundedPhase, setCustomFundedPhase] =
    useState<CustomFundedPhaseDraft>(createCustomFundedPhaseDraft());
  const [customMetricMode, setCustomMetricMode] = useState<
    "percentage" | "absolute"
  >("percentage");
  const [customMaxLossType, setCustomMaxLossType] = useState<
    "absolute" | "trailing"
  >("absolute");
  const [applySharedMaxLoss, setApplySharedMaxLoss] = useState(false);
  const [sharedMaxLoss, setSharedMaxLoss] = useState("");
  const [applySharedMinTradingDays, setApplySharedMinTradingDays] =
    useState(false);
  const [sharedMinTradingDays, setSharedMinTradingDays] = useState("0");

  const { data: propFirm } = useQuery({
    ...trpcOptions.propFirms.getById.queryOptions({ id: propFirmId }),
    enabled: open && Boolean(propFirmId),
  });
  const { data: challengeRules = EMPTY_CHALLENGE_RULES } = useQuery({
    ...trpcOptions.propFirms.getChallengeRules.queryOptions({ propFirmId }),
    enabled: open && Boolean(propFirmId),
  });

  const challengeRuleOptions = useMemo(
    () => getChallengeRuleOptions(propFirmId, challengeRules as PropChallengeRuleOption[]),
    [challengeRules, propFirmId]
  );

  const selectedChallengeRule = useMemo(
    () =>
      challengeRuleOptions.find((rule) => rule.id === selectedChallengeRuleId) ||
      null,
    [challengeRuleOptions, selectedChallengeRuleId]
  );

  const selectedRuleAccountSizes = useMemo(
    () => extractChallengeAccountSizes(selectedChallengeRule),
    [selectedChallengeRule]
  );
  const accountInitialBalance = Number(account.initialBalance ?? 0);
  const selectedRuleBalanceMismatch =
    selectedRuleAccountSizes.length > 0 &&
    Number.isFinite(accountInitialBalance) &&
    accountInitialBalance > 0 &&
    !selectedRuleAccountSizes.includes(accountInitialBalance);

  useEffect(() => {
    if (!open) {
      setShowCustomFlowBuilder(false);
      return;
    }

    setSelectedChallengeRuleId((current) => {
      if (challengeRuleOptions.some((rule) => rule.id === current)) {
        return current;
      }

      if (
        account.propChallengeRuleId &&
        challengeRuleOptions.some((rule) => rule.id === account.propChallengeRuleId)
      ) {
        return account.propChallengeRuleId;
      }

      return challengeRuleOptions[0]?.id || "";
    });
  }, [account.propChallengeRuleId, challengeRuleOptions, open]);

  const updateCustomChallengePhase = (
    phaseIndex: number,
    key: keyof CustomChallengePhaseDraft,
    value: string
  ) => {
    setCustomChallengePhases((current) =>
      current.map((phase, index) =>
        index === phaseIndex ? { ...phase, [key]: value } : phase
      )
    );
  };

  const updateSharedChallengePhaseField = (
    key: "maxLoss" | "minTradingDays",
    value: string
  ) => {
    setCustomChallengePhases((current) =>
      current.map((phase) => ({ ...phase, [key]: value }))
    );
  };

  const handleSharedMaxLossToggle = (checked: boolean) => {
    setApplySharedMaxLoss(checked);
    if (!checked) return;

    const nextValue = sharedMaxLoss || customChallengePhases[0]?.maxLoss || "";
    setSharedMaxLoss(nextValue);
    updateSharedChallengePhaseField("maxLoss", nextValue);
  };

  const handleSharedMinTradingDaysToggle = (checked: boolean) => {
    setApplySharedMinTradingDays(checked);
    if (!checked) return;

    const nextValue =
      sharedMinTradingDays || customChallengePhases[0]?.minTradingDays || "0";
    setSharedMinTradingDays(nextValue);
    updateSharedChallengePhaseField("minTradingDays", nextValue);
  };

  const updateCustomFundedPhase = (
    key: keyof CustomFundedPhaseDraft,
    value: string
  ) => {
    setCustomFundedPhase((current) => ({ ...current, [key]: value }));
  };

  const resetCustomFlowBuilder = () => {
    setShowCustomFlowBuilder(false);
    setCustomChallengePhases([
      createCustomChallengePhaseDraft(),
      createCustomChallengePhaseDraft(),
    ]);
    setCustomFundedPhase(createCustomFundedPhaseDraft());
    setCustomMetricMode("percentage");
    setCustomMaxLossType("absolute");
    setApplySharedMaxLoss(false);
    setSharedMaxLoss("");
    setApplySharedMinTradingDays(false);
    setSharedMinTradingDays("0");
  };

  const hydrateCustomBuilderFromRule = (
    rule: PropChallengeRuleOption | null | undefined
  ) => {
    const orderedPhases = getOrderedChallengePhases(rule?.phases);
    const evaluationPhases = orderedPhases.filter(
      (phase) => Number(phase?.order) > 0
    );
    const fundedPhase =
      orderedPhases.find((phase) => Number(phase?.order) === 0) ?? null;
    const primaryPhase = evaluationPhases[0] ?? fundedPhase ?? null;

    setCustomMetricMode(
      primaryPhase?.profitTargetType === "absolute" ? "absolute" : "percentage"
    );
    setCustomMaxLossType(
      primaryPhase?.maxLossType === "trailing" ? "trailing" : "absolute"
    );

    setCustomChallengePhases(
      evaluationPhases.length
        ? evaluationPhases.map((phase) => ({
            profitTarget:
              phase?.profitTarget == null ? "" : String(phase.profitTarget),
            dailyLossLimit:
              phase?.dailyLossLimit == null ? "" : String(phase.dailyLossLimit),
            maxLoss: phase?.maxLoss == null ? "" : String(phase.maxLoss),
            timeLimitDays:
              phase?.timeLimitDays == null ? "" : String(phase.timeLimitDays),
            minTradingDays:
              phase?.minTradingDays == null ? "0" : String(phase.minTradingDays),
          }))
        : [createCustomChallengePhaseDraft(), createCustomChallengePhaseDraft()]
    );

    setCustomFundedPhase({
      dailyLossLimit:
        fundedPhase?.dailyLossLimit == null ? "" : String(fundedPhase.dailyLossLimit),
      maxLoss: fundedPhase?.maxLoss == null ? "" : String(fundedPhase.maxLoss),
      timeLimitDays:
        fundedPhase?.timeLimitDays == null ? "" : String(fundedPhase.timeLimitDays),
      minTradingDays:
        fundedPhase?.minTradingDays == null ? "0" : String(fundedPhase.minTradingDays),
    });

    setApplySharedMaxLoss(false);
    setSharedMaxLoss("");
    setApplySharedMinTradingDays(false);
    setSharedMinTradingDays("0");
  };

  const createCustomFlowMutation = useMutation({
    mutationFn: (input: {
      propFirmId: string;
      challengeDisplayName: string;
      metricMode: "percentage" | "absolute";
      maxLossType: "absolute" | "trailing";
      challengePhases: Array<{
        profitTarget: number;
        dailyLossLimit: number;
        maxLoss: number;
        timeLimitDays: number | null;
        minTradingDays: number;
      }>;
      fundedPhase: {
        dailyLossLimit: number;
        maxLoss: number;
        timeLimitDays: number | null;
        minTradingDays: number;
      };
    }) => trpcClient.propFirms.createCustomFlow.mutate(input),
    onSuccess: (data) => {
      tanstackQueryClient.invalidateQueries({
        queryKey: trpcOptions.propFirms.getChallengeRules.queryOptions({
          propFirmId,
        }).queryKey,
      });
      setSelectedChallengeRuleId(data.challengeRule.id);
      toast.success("Custom challenge template created.");
      resetCustomFlowBuilder();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to create custom challenge template"));
    },
  });

  const changeChallengeRuleMutation = useMutation({
    mutationFn: (input: { accountId: string; challengeRuleId: string }) =>
      trpcClient.propFirms.changeChallengeRule.mutate(input),
    onSuccess: async () => {
      await Promise.all([
        tanstackQueryClient.invalidateQueries({
          queryKey: trpcOptions.accounts.list.queryOptions().queryKey,
        }),
        tanstackQueryClient.invalidateQueries({
          queryKey: trpcOptions.propFirms.getTrackerDashboard.queryOptions({
            accountId: account.id,
          }).queryKey,
        }),
        tanstackQueryClient.invalidateQueries({
          queryKey: trpcOptions.propFirms.getTrackerDashboards.queryOptions({
            accountIds: [account.id],
          }).queryKey,
        }),
      ]);
      toast.success("Challenge rules updated.");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to update challenge rules"));
    },
  });

  const handleCreateCustomFlow = () => {
    try {
      if (!propFirmId) {
        throw new Error("Prop firm not found");
      }

      const challengePhases = customChallengePhases.map((phase, index) => ({
        profitTarget: parsePositiveNumberField(
          `Phase ${index + 1} target`,
          phase.profitTarget
        ),
        dailyLossLimit: parsePositiveNumberField(
          `Phase ${index + 1} daily limit`,
          phase.dailyLossLimit
        ),
        maxLoss: parsePositiveNumberField(
          `Phase ${index + 1} max loss`,
          phase.maxLoss
        ),
        timeLimitDays: parseOptionalPositiveInteger(phase.timeLimitDays),
        minTradingDays: parseNonNegativeInteger(
          `Phase ${index + 1} minimum trading days`,
          phase.minTradingDays
        ),
      }));

      const fundedPhase = {
        dailyLossLimit: parsePositiveNumberField(
          "Funded daily loss",
          customFundedPhase.dailyLossLimit
        ),
        maxLoss: parsePositiveNumberField(
          "Funded max loss",
          customFundedPhase.maxLoss
        ),
        timeLimitDays: parseOptionalPositiveInteger(customFundedPhase.timeLimitDays),
        minTradingDays: parseNonNegativeInteger(
          "Funded minimum trading days",
          customFundedPhase.minTradingDays
        ),
      };

      createCustomFlowMutation.mutate({
        propFirmId,
        challengeDisplayName: `${propFirm?.displayName || account.broker || "Prop firm"} ${challengePhases.length}-Phase Custom`,
        metricMode: customMetricMode,
        maxLossType: customMaxLossType,
        challengePhases,
        fundedPhase,
      });
    } catch (error) {
      toast.error(getErrorMessage(error, "Invalid custom challenge template"));
    }
  };

  const handleApplyChallengeRule = () => {
    if (!selectedChallengeRuleId) return;
    changeChallengeRuleMutation.mutate({
      accountId: account.id,
      challengeRuleId: selectedChallengeRuleId,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto rounded-md p-0 sm:max-w-xl md:max-w-2xl lg:max-w-3xl">
        <div className="px-6 py-5 pb-0">
          <SheetHeader className="p-0">
            <SheetTitle className="text-base font-semibold text-white">
              Change challenge rules
            </SheetTitle>
            <SheetDescription className="text-xs text-white/40">
              Switch this prop account to a different standard rule set or create a custom template for this firm.
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="flex flex-col">
          <Separator />
          <div className="px-6 py-3">
            <h3 className="text-xs font-semibold tracking-wide text-white/70">
              Account
            </h3>
          </div>
          <Separator />
          <div className="space-y-4 px-6 py-5">
            <ManualPropAccountSummary
              account={account}
              detectedPropFirmName={propFirm?.displayName || null}
            />
          </div>

          <Separator />
          <div className="px-6 py-3">
            <h3 className="text-xs font-semibold tracking-wide text-white/70">
              Challenge rules
            </h3>
          </div>
          <Separator />

          <div className="space-y-4 px-6 py-5">
            <div className="space-y-2">
              <p className="text-xs text-white/50">Prop firm</p>
              <div
                className={cn(
                  getPropAssignSelectTriggerClassName("min-h-[85px] px-6"),
                  "pointer-events-none"
                )}
              >
                <div className="flex w-full min-w-0 flex-1 items-center gap-3 pr-6">
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-sm font-semibold text-white">
                      {propFirm?.displayName || account.broker || "Prop firm"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-white/45">
                      Challenge rules stay within this prop firm.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-white/50">Challenge rule</p>
                <Button
                  type="button"
                  className={getPropAssignActionButtonClassName({
                    tone: showCustomFlowBuilder ? "neutral" : "teal",
                    size: "sm",
                    className: "gap-1",
                  })}
                  onClick={() => {
                    if (showCustomFlowBuilder) {
                      resetCustomFlowBuilder();
                      return;
                    }

                    hydrateCustomBuilderFromRule(selectedChallengeRule);
                    setShowCustomFlowBuilder(true);
                  }}
                >
                  {showCustomFlowBuilder ? <Minus className="size-3" /> : <Plus className="size-3" />}
                  {showCustomFlowBuilder ? "Hide custom builder" : "Custom template for this firm"}
                </Button>
              </div>

              {!showCustomFlowBuilder ? (
                <Select
                  value={selectedChallengeRuleId}
                  onValueChange={setSelectedChallengeRuleId}
                  disabled={!challengeRuleOptions.length}
                >
                  <SelectTrigger
                    className={getPropAssignSelectTriggerClassName(
                      "min-h-[75px] px-6"
                    )}
                  >
                    {selectedChallengeRule ? (
                      <div className="min-w-0 w-full flex-1 pr-6 text-left">
                        <ChallengeRuleSelectOptionContent rule={selectedChallengeRule} />
                      </div>
                    ) : (
                      <span className="text-sm text-white/45">
                        No challenge rules configured for this firm
                      </span>
                    )}
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    className={PROP_ASSIGN_SELECT_CONTENT_CLASS}
                  >
                    <div className={PROP_ASSIGN_SELECT_LABEL_CLASS}>Challenge rules</div>
                    <Separator className={PROP_ASSIGN_SELECT_SEPARATOR_CLASS} />
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
              ) : (
                <ManualPropFlowBuilder
                  customPropFirmName={propFirm?.displayName || account.broker || ""}
                  onCustomPropFirmNameChange={() => {}}
                  customChallengePhases={customChallengePhases}
                  customFundedPhase={customFundedPhase}
                  applySharedMaxLoss={applySharedMaxLoss}
                  sharedMaxLoss={sharedMaxLoss}
                  applySharedMinTradingDays={applySharedMinTradingDays}
                  sharedMinTradingDays={sharedMinTradingDays}
                  metricMode={customMetricMode}
                  maxLossType={customMaxLossType}
                  onAddPhase={() =>
                    setCustomChallengePhases((current) => [
                      ...current,
                      {
                        ...createCustomChallengePhaseDraft(),
                        maxLoss: applySharedMaxLoss ? sharedMaxLoss : "",
                        minTradingDays: applySharedMinTradingDays
                          ? sharedMinTradingDays
                          : "0",
                      },
                    ])
                  }
                  onCustomChallengePhaseChange={updateCustomChallengePhase}
                  onRemoveChallengePhase={(phaseIndex) =>
                    setCustomChallengePhases((current) =>
                      current.filter((_, index) => index !== phaseIndex)
                    )
                  }
                  onCustomFundedPhaseChange={updateCustomFundedPhase}
                  onApplySharedMaxLossChange={handleSharedMaxLossToggle}
                  onSharedMaxLossChange={(value) => {
                    setSharedMaxLoss(value);
                    if (applySharedMaxLoss) {
                      updateSharedChallengePhaseField("maxLoss", value);
                    }
                  }}
                  onApplySharedMinTradingDaysChange={handleSharedMinTradingDaysToggle}
                  onSharedMinTradingDaysChange={(value) => {
                    setSharedMinTradingDays(value);
                    if (applySharedMinTradingDays) {
                      updateSharedChallengePhaseField("minTradingDays", value);
                    }
                  }}
                  onMetricModeChange={setCustomMetricMode}
                  onMaxLossTypeChange={setCustomMaxLossType}
                  onReset={resetCustomFlowBuilder}
                  onSave={handleCreateCustomFlow}
                  isSaving={createCustomFlowMutation.isPending}
                  propFirmNameLocked={propFirm?.displayName || account.broker || "Prop firm"}
                />
              )}

              {selectedRuleBalanceMismatch ? (
                <p className="text-xs leading-relaxed text-amber-200/80">
                  This account's starting balance does not match this rule's published challenge sizes. Supported sizes: {selectedRuleAccountSizes.map((size) => size.toLocaleString()).join(", ")}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <SheetFooter className="px-6 pb-6">
          <div className="flex w-full justify-end gap-2">
            <Button
              onClick={() => onOpenChange(false)}
              className={getPropAssignActionButtonClassName({ tone: "neutral" })}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApplyChallengeRule}
              disabled={
                !selectedChallengeRuleId ||
                showCustomFlowBuilder ||
                changeChallengeRuleMutation.isPending ||
                selectedRuleBalanceMismatch
              }
              className={getPropAssignActionButtonClassName({ tone: "teal" })}
            >
              {changeChallengeRuleMutation.isPending ? "Updating..." : "Apply rules"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
