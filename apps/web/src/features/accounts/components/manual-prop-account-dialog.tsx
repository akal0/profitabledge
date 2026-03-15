"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  HEADER_CONTROL_HEIGHT,
  type AccountRecord,
  type PropFirmOption,
  toFiniteNumber,
} from "@/features/accounts/components/account-section-shell";
import {
  ManualPropAccountSummary,
  ManualPropAssignmentModeSection,
  ManualPropContinuableChallenges,
  ManualPropFlowSelectionSection,
} from "@/features/accounts/components/manual-prop-account-dialog-sections";
import {
  createCustomChallengePhaseDraft,
  createCustomFundedPhaseDraft,
  type CustomChallengePhaseDraft,
  type CustomFundedPhaseDraft,
} from "@/features/accounts/components/manual-prop-flow-builder";
import {
  EMPTY_CHALLENGE_RULES,
  EMPTY_CONTINUABLE_CHALLENGES,
  EMPTY_PROP_FIRMS,
  getChallengeRuleOptions,
  getContinuableChallengeAccountName,
  getNextChallengePhaseForContinuation,
  getPropFirmOptions,
  getSortedContinuableChallenges,
  isFundedContinuableChallenge,
  parseNonNegativeInteger,
  parseOptionalPositiveInteger,
  parsePositiveNumberField,
  type ContinuableChallengeOption,
  type PropChallengeRuleOption,
} from "@/features/accounts/lib/manual-prop-account-dialog";
import { getPropAssignActionButtonClassName } from "@/features/accounts/lib/prop-assign-action-button";
import { queryClient, trpcClient, trpcOptions } from "@/utils/trpc";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function ManualPropAccountDialog({ account }: { account: AccountRecord }) {
  const [open, setOpen] = useState(false);
  const [assignmentMode, setAssignmentMode] = useState<"new" | "continue">(
    "new"
  );
  const [selectedPropFirmId, setSelectedPropFirmId] = useState("");
  const [selectedChallengeRuleId, setSelectedChallengeRuleId] = useState("");
  const [selectedChallengeInstanceId, setSelectedChallengeInstanceId] =
    useState("");
  const [showCustomFlowBuilder, setShowCustomFlowBuilder] = useState(false);
  const [customPropFirmName, setCustomPropFirmName] = useState("");
  const [customChallengePhases, setCustomChallengePhases] = useState<
    CustomChallengePhaseDraft[]
  >([createCustomChallengePhaseDraft(), createCustomChallengePhaseDraft()]);
  const [customFundedPhase, setCustomFundedPhase] =
    useState<CustomFundedPhaseDraft>(createCustomFundedPhaseDraft());
  const [applySharedMaxLoss, setApplySharedMaxLoss] = useState(false);
  const [sharedMaxLoss, setSharedMaxLoss] = useState("");
  const [applySharedMinTradingDays, setApplySharedMinTradingDays] =
    useState(false);
  const [sharedMinTradingDays, setSharedMinTradingDays] = useState("0");

  const propFirmsListQueryOptions = trpcOptions.propFirms.list.queryOptions();
  const continuableChallengesQueryOptions =
    trpcOptions.propFirms.listContinuableChallenges.queryOptions();

  const { data: propFirms = EMPTY_PROP_FIRMS } = useQuery(
    propFirmsListQueryOptions
  );
  const { data: continuableChallenges = EMPTY_CONTINUABLE_CHALLENGES } =
    useQuery(continuableChallengesQueryOptions);
  const challengeRulesQueryOptions =
    trpcOptions.propFirms.getChallengeRules.queryOptions({
      propFirmId: selectedPropFirmId,
    });
  const { data: challengeRules = EMPTY_CHALLENGE_RULES } = useQuery({
    ...challengeRulesQueryOptions,
    enabled: !!selectedPropFirmId,
  });

  const propFirmOptions = getPropFirmOptions(propFirms as PropFirmOption[]);
  const challengeRuleOptions = getChallengeRuleOptions(
    selectedPropFirmId,
    challengeRules as PropChallengeRuleOption[]
  );
  const selectedPropFirm =
    propFirmOptions.find((firm) => firm.id === selectedPropFirmId) ?? null;
  const selectedChallengeRule =
    challengeRuleOptions.find((rule) => rule.id === selectedChallengeRuleId) ??
    null;
  const detectedPropFirm = propFirmOptions.find(
    (firm) => firm.id === account.propDetectedFirmId
  );
  const continuableChallengeOptions = getSortedContinuableChallenges(
    continuableChallenges as ContinuableChallengeOption[]
  );
  const selectedContinuableChallenge =
    continuableChallengeOptions.find(
      (challenge) => challenge.id === selectedChallengeInstanceId
    ) ?? null;
  const selectedContinuationNextPhase = getNextChallengePhaseForContinuation(
    selectedContinuableChallenge
  );
  const selectedContinuationCurrentPhaseName = isFundedContinuableChallenge(
    selectedContinuableChallenge
  )
    ? "Funded"
    : selectedContinuableChallenge?.currentPhase?.name ||
      `Phase ${selectedContinuableChallenge?.currentPhase?.order ?? 1}`;
  const canContinueSelectedChallenge =
    assignmentMode !== "continue"
      ? true
      : selectedContinuableChallenge?.currentAccount?.propPhaseStatus ===
          "passed" &&
        selectedContinuationNextPhase != null &&
        toFiniteNumber(selectedContinuationNextPhase?.order) !== null;
  const continueActionLabel = !selectedChallengeInstanceId
    ? "Select an existing challenge"
    : isFundedContinuableChallenge(selectedContinuableChallenge)
      ? "Challenge already funded"
      : selectedContinuableChallenge?.currentAccount?.propPhaseStatus !==
          "passed"
        ? `Pass ${selectedContinuationCurrentPhaseName} before continuing`
        : `Continue to ${
            selectedContinuationNextPhase?.order === 0
              ? "Funded"
              : selectedContinuationNextPhase?.name ||
                `Phase ${selectedContinuationNextPhase?.order ?? 1}`
          }`;
  const continueActionButtonClassName =
    assignmentMode !== "continue"
      ? getPropAssignActionButtonClassName({ tone: "teal" })
      : isFundedContinuableChallenge(selectedContinuableChallenge)
        ? getPropAssignActionButtonClassName({ tone: "gold" })
        : getPropAssignActionButtonClassName({
            tone: canContinueSelectedChallenge ? "teal" : "amber",
          });

  const resetCustomFlowBuilder = () => {
    setShowCustomFlowBuilder(false);
    setCustomPropFirmName("");
    setCustomChallengePhases([
      createCustomChallengePhaseDraft(),
      createCustomChallengePhaseDraft(),
    ]);
    setCustomFundedPhase(createCustomFundedPhaseDraft());
    setApplySharedMaxLoss(false);
    setSharedMaxLoss("");
    setApplySharedMinTradingDays(false);
    setSharedMinTradingDays("0");
  };

  useEffect(() => {
    if (!open) {
      resetCustomFlowBuilder();
      setAssignmentMode("new");
      setSelectedPropFirmId("");
      setSelectedChallengeRuleId("");
      setSelectedChallengeInstanceId("");
      return;
    }

    setAssignmentMode("new");
    setSelectedPropFirmId(account.propDetectedFirmId || "");
    setSelectedChallengeRuleId("");
    setSelectedChallengeInstanceId("");
  }, [account.propDetectedFirmId, open]);

  useEffect(() => {
    if (!open || selectedPropFirmId) return;
    const nextPropFirmOptions = getPropFirmOptions(
      propFirms as PropFirmOption[]
    );
    setSelectedPropFirmId(
      account.propDetectedFirmId || nextPropFirmOptions[0]?.id || ""
    );
  }, [account.propDetectedFirmId, open, propFirms, selectedPropFirmId]);

  useEffect(() => {
    const nextChallengeRules = getChallengeRuleOptions(
      selectedPropFirmId,
      challengeRules as PropChallengeRuleOption[]
    );

    if (!nextChallengeRules.length) {
      setSelectedChallengeRuleId("");
      return;
    }

    setSelectedChallengeRuleId((current) =>
      nextChallengeRules.some((rule) => rule.id === current)
        ? current
        : nextChallengeRules[0].id
    );
  }, [challengeRules, selectedPropFirmId]);

  useEffect(() => {
    if (assignmentMode !== "continue") return;
    setSelectedChallengeInstanceId((current) =>
      continuableChallengeOptions.some((challenge) => challenge.id === current)
        ? current
        : continuableChallengeOptions[0]?.id || ""
    );
  }, [assignmentMode, continuableChallengeOptions]);

  const assignPropMutation = useMutation({
    mutationFn: (input: {
      accountId: string;
      propFirmId?: string;
      challengeRuleId?: string;
      currentPhase?: number;
      challengeInstanceId?: string;
      phaseStartDate?: string;
      manualOverride: boolean;
    }) => trpcClient.propFirms.assignToAccount.mutate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["propFirms"] });
      toast.success("Account moved to prop accounts.");
      setOpen(false);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to set account as prop"));
    },
  });

  const createCustomFlowMutation = useMutation({
    mutationFn: (input: {
      propFirmName: string;
      challengeDisplayName: string;
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
      queryClient.invalidateQueries({
        queryKey: propFirmsListQueryOptions.queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: trpcOptions.propFirms.getChallengeRules.queryOptions({
          propFirmId: data.propFirm.id,
        }).queryKey,
      });
      setAssignmentMode("new");
      setSelectedPropFirmId(data.propFirm.id);
      setSelectedChallengeRuleId(data.challengeRule.id);
      toast.success("Custom prop flow created.");
      resetCustomFlowBuilder();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to create custom prop flow"));
    },
  });

  const handleCreateCustomFlow = () => {
    try {
      const propFirmName = customPropFirmName.trim();
      if (!propFirmName) {
        throw new Error("Prop firm name is required");
      }

      const challengePhases = customChallengePhases.map((phase, index) => ({
        profitTarget: parsePositiveNumberField(
          `Phase ${index + 1} target`,
          phase.profitTarget
        ),
        dailyLossLimit: parsePositiveNumberField(
          `Phase ${index + 1} daily DD`,
          phase.dailyLossLimit
        ),
        maxLoss: parsePositiveNumberField(
          `Phase ${index + 1} max DD`,
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
          "Funded daily DD",
          customFundedPhase.dailyLossLimit
        ),
        maxLoss: parsePositiveNumberField(
          "Funded max DD",
          customFundedPhase.maxLoss
        ),
        timeLimitDays: parseOptionalPositiveInteger(
          customFundedPhase.timeLimitDays
        ),
        minTradingDays: parseNonNegativeInteger(
          "Funded minimum trading days",
          customFundedPhase.minTradingDays
        ),
      };

      createCustomFlowMutation.mutate({
        propFirmName,
        challengeDisplayName: `${propFirmName} ${challengePhases.length}-Step Flow`,
        challengePhases,
        fundedPhase,
      });
    } catch (error) {
      toast.error(getErrorMessage(error, "Invalid custom prop flow"));
    }
  };

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

  const handleAssign = () => {
    if (assignmentMode === "continue") {
      if (!selectedChallengeInstanceId || !canContinueSelectedChallenge) return;
      assignPropMutation.mutate({
        accountId: account.id,
        challengeInstanceId: selectedChallengeInstanceId,
        phaseStartDate: new Date().toISOString().slice(0, 10),
        manualOverride: true,
      });
      return;
    }

    if (!selectedPropFirmId || !selectedChallengeRuleId) return;

    assignPropMutation.mutate({
      accountId: account.id,
      propFirmId: selectedPropFirmId,
      challengeRuleId: selectedChallengeRuleId,
      currentPhase: 1,
      phaseStartDate: new Date().toISOString().slice(0, 10),
      manualOverride: true,
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          className={getPropAssignActionButtonClassName({
            tone: "neutral",
            className: `${HEADER_CONTROL_HEIGHT} px-2.5 text-[10px]`,
          })}
        >
          Change to prop firm account
        </Button>
      </SheetTrigger>

      <SheetContent className="w-full overflow-y-auto rounded-md p-0 sm:max-w-xl md:max-w-2xl lg:max-w-3xl">
        <div className="px-6 py-5 pb-0">
          <SheetHeader className="p-0">
            <SheetTitle className="text-base font-semibold text-white">
              Change to prop firm account
            </SheetTitle>
            <SheetDescription className="text-xs text-white/40">
              Start a new prop challenge or continue an existing one. Saving
              will move this account into the tracked prop flow.
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
              detectedPropFirmName={detectedPropFirm?.displayName || null}
            />
          </div>

          <Separator />

          <div className="px-6 py-3">
            <h3 className="text-xs font-semibold tracking-wide text-white/70">
              Challenge flow
            </h3>
          </div>
          <Separator />

          <ManualPropAssignmentModeSection
            assignmentMode={assignmentMode}
            onAssignmentModeChange={setAssignmentMode}
            continuableChallengeOptions={continuableChallengeOptions}
          />

          <Separator />
          <div className="space-y-4 px-6 py-5">
            {assignmentMode === "continue" ? (
              <ManualPropContinuableChallenges
                continuableChallengeOptions={continuableChallengeOptions}
                selectedChallengeInstanceId={selectedChallengeInstanceId}
                onSelectChallenge={setSelectedChallengeInstanceId}
              />
            ) : (
              <ManualPropFlowSelectionSection
                showCustomFlowBuilder={showCustomFlowBuilder}
                onToggleBuilder={() =>
                  setShowCustomFlowBuilder((current) => !current)
                }
                builderState={{
                  customPropFirmName,
                  customChallengePhases,
                  customFundedPhase,
                  applySharedMaxLoss,
                  sharedMaxLoss,
                  applySharedMinTradingDays,
                  sharedMinTradingDays,
                }}
                onBuilderStateChange={{
                  setCustomPropFirmName,
                  updateCustomChallengePhase,
                  updateCustomFundedPhase,
                  setSharedMaxLoss: (nextValue) => {
                    setSharedMaxLoss(nextValue);
                    if (applySharedMaxLoss) {
                      updateSharedChallengePhaseField("maxLoss", nextValue);
                    }
                  },
                  setSharedMinTradingDays: (nextValue) => {
                    setSharedMinTradingDays(nextValue);
                    if (applySharedMinTradingDays) {
                      updateSharedChallengePhaseField(
                        "minTradingDays",
                        nextValue
                      );
                    }
                  },
                  toggleSharedMaxLoss: handleSharedMaxLossToggle,
                  toggleSharedMinTradingDays:
                    handleSharedMinTradingDaysToggle,
                }}
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
                onRemoveChallengePhase={(phaseIndex) =>
                  setCustomChallengePhases((current) =>
                    current.filter((_, index) => index !== phaseIndex)
                  )
                }
                onResetBuilder={resetCustomFlowBuilder}
                onSaveCustomFlow={handleCreateCustomFlow}
                isSavingCustomFlow={createCustomFlowMutation.isPending}
                selectedPropFirmId={selectedPropFirmId}
                selectedChallengeRuleId={selectedChallengeRuleId}
                selectedPropFirm={selectedPropFirm}
                selectedChallengeRule={selectedChallengeRule}
                propFirmOptions={propFirmOptions}
                challengeRuleOptions={challengeRuleOptions}
                onSelectPropFirm={setSelectedPropFirmId}
                onSelectChallengeRule={setSelectedChallengeRuleId}
              />
            )}
          </div>
        </div>

        <SheetFooter className="px-6 pb-6">
          <div className="flex w-full justify-end gap-2">
            <Button
              onClick={() => setOpen(false)}
              className={getPropAssignActionButtonClassName({
                tone: "neutral",
              })}
            >
              Cancel
            </Button>

            <Button
              onClick={handleAssign}
              disabled={
                assignPropMutation.isPending ||
                (assignmentMode === "continue"
                  ? !selectedChallengeInstanceId ||
                    !canContinueSelectedChallenge
                  : !selectedPropFirmId || !selectedChallengeRuleId)
              }
              className={continueActionButtonClassName}
            >
              {assignPropMutation.isPending
                ? assignmentMode === "continue"
                  ? "Continuing..."
                  : "Changing..."
                : assignmentMode === "continue"
                  ? continueActionLabel
                  : "Change to prop account"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
