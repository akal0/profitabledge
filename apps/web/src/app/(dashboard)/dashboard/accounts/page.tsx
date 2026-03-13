"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  Building2,
  ChevronRight,
  type LucideIcon,
  Plus,
  ShieldCheck,
  Trophy,
} from "lucide-react";

import { AddAccountSheet } from "@/features/accounts/components/add-account-sheet";
import { WIDGET_CONTENT_SEPARATOR_CLASS } from "@/features/dashboard/widgets/lib/widget-shared";
import {
  WidgetLoading,
  WidgetWrapper,
} from "@/components/dashboard/widget-wrapper";
import {
  PropAccountStatusBadges,
  getPropStatusAppearance,
} from "@/components/prop-account-status-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { TRADE_SURFACE_CARD_CLASS } from "@/components/trades/trade-identifier-pill";
import { cn } from "@/lib/utils";
import { queryClient, trpcClient, trpcOptions } from "@/utils/trpc";

type AccountRecord = any;
type PropFirmOption = {
  id: string;
  createdByUserId?: string | null;
  displayName?: string | null;
  description?: string | null;
};
type PropChallengeRuleOption = {
  id: string;
  createdByUserId?: string | null;
  displayName?: string | null;
  challengeType?: string | null;
  phases?: any[] | null;
};
type ContinuableChallengeOption = {
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
  } | null;
  propFirm?: PropFirmOption | null;
  challengeRule?: PropChallengeRuleOption | null;
};

type CustomChallengePhaseDraft = {
  profitTarget: string;
  dailyLossLimit: string;
  maxLoss: string;
  timeLimitDays: string;
  minTradingDays: string;
};

type CustomFundedPhaseDraft = Omit<CustomChallengePhaseDraft, "profitTarget">;

const HEADER_CONTROL_HEIGHT = "h-7";
const HEADER_ICON_BUTTON_CLASS = `${HEADER_CONTROL_HEIGHT} rounded-sm border-white/10 bg-sidebar px-2 text-xs text-white/35 hover:bg-sidebar`;
const HEADER_BADGE_CLASS = `${HEADER_CONTROL_HEIGHT} rounded-sm px-1.5 text-[10px] font-medium`;
const FTMO_PROP_FIRM_ID = "ftmo";
const FTMO_IMAGE_SRC = "/brokers/FTMO.png";
const FALLBACK_FTMO_PROP_FIRM: PropFirmOption = {
  id: FTMO_PROP_FIRM_ID,
  displayName: "FTMO",
  description:
    "One of the world's leading prop trading firms with a proven track record since 2015.",
};
const FALLBACK_FTMO_CHALLENGE_RULE: PropChallengeRuleOption = {
  id: "ftmo-2step",
  displayName: "FTMO 2-Step Challenge",
  challengeType: "standard",
  phases: [
    {
      order: 1,
      profitTarget: 10,
      dailyLossLimit: 5,
      maxLoss: 10,
    },
    {
      order: 2,
      profitTarget: 5,
      dailyLossLimit: 5,
      maxLoss: 10,
    },
    {
      order: 0,
      profitTarget: null,
      dailyLossLimit: 5,
      maxLoss: 10,
    },
  ],
};

function toFiniteNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isFtmoFirm(firm?: Pick<PropFirmOption, "id" | "displayName"> | null) {
  const id = String(firm?.id || "").toLowerCase();
  const displayName = String(firm?.displayName || "").toLowerCase();
  return id === FTMO_PROP_FIRM_ID || displayName === "ftmo";
}

function getPropFirmOptions(propFirms: PropFirmOption[]) {
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

function getChallengeRuleOptions(
  propFirmId: string,
  challengeRules: PropChallengeRuleOption[]
) {
  if (propFirmId !== FTMO_PROP_FIRM_ID) {
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

function getChallengeRuleMetrics(rule: PropChallengeRuleOption) {
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

function createCustomChallengePhaseDraft(): CustomChallengePhaseDraft {
  return {
    profitTarget: "",
    dailyLossLimit: "",
    maxLoss: "",
    timeLimitDays: "",
    minTradingDays: "0",
  };
}

function createCustomFundedPhaseDraft(): CustomFundedPhaseDraft {
  return {
    dailyLossLimit: "",
    maxLoss: "",
    timeLimitDays: "",
    minTradingDays: "0",
  };
}

const EMPTY_PROP_FIRMS: PropFirmOption[] = [];
const EMPTY_CHALLENGE_RULES: PropChallengeRuleOption[] = [];
const EMPTY_CONTINUABLE_CHALLENGES: ContinuableChallengeOption[] = [];

function parsePositiveNumberField(label: string, rawValue: string) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be greater than 0`);
  }
  return parsed;
}

function parseOptionalPositiveInteger(rawValue: string) {
  if (!rawValue.trim()) return null;
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Time limit must be a whole number greater than 0");
  }
  return parsed;
}

function parseNonNegativeInteger(label: string, rawValue: string) {
  const normalized = rawValue.trim() || "0";
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be 0 or greater`);
  }
  return parsed;
}

function PropFirmAvatar({
  firm,
  className,
}: {
  firm?: PropFirmOption | null;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-sm border border-white/10 bg-white/[0.04]",
        className
      )}
    >
      {isFtmoFirm(firm) ? (
        <Image
          src={FTMO_IMAGE_SRC}
          alt="FTMO"
          fill
          sizes="64px"
          className="object-contain p-2"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Trophy className="size-5 text-white/55" />
        </div>
      )}
    </div>
  );
}

function BrokerAccountAvatar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-sm border border-white/10 bg-white/[0.04]",
        className
      )}
    >
      <Building2 className="size-5 text-white/55" />
    </div>
  );
}

function formatUsd(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function getAccountBalance(account: AccountRecord) {
  return parseFloat(account.liveBalance || account.initialBalance || "0");
}

function getAccountEquity(account: AccountRecord) {
  return account.liveEquity ? parseFloat(account.liveEquity) : null;
}

function isCurrentPropStageAccount(account: AccountRecord) {
  return account.isPropAccount && account.propIsCurrentChallengeStage !== false;
}

function SectionHeader({
  icon: Icon,
  label,
  count,
  action,
}: {
  icon: LucideIcon;
  label: string;
  count: number;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-1">
      <Icon className="size-3.5 text-white/45" />
      <h2 className="text-xs font-semibold text-white/45">{label}</h2>
      <Badge
        variant="outline"
        className="h-5 rounded-sm border-white/10 px-1.5 text-[10px] text-white/55"
      >
        {count}
      </Badge>
      {action ? <div className="ml-auto">{action}</div> : null}
    </div>
  );
}

function AccountsEmptyState({
  icon: Icon,
  title,
  description,
  ctaLabel,
  onAccountCreated,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel: string;
  onAccountCreated: () => void;
}) {
  return (
    <WidgetWrapper
      icon={Icon}
      title={title}
      showHeader
      className="h-auto"
      contentClassName="h-auto flex-col items-center justify-center px-6 py-10 text-center"
    >
      <Icon className="mb-2 size-8 text-white/60" />
      <p className="max-w-sm text-xs text-white/60 font-medium">
        {description}
      </p>
      <div className="mt-4">
        <AddAccountSheet
          onAccountCreated={onAccountCreated}
          trigger={
            <Button className="h-8 rounded-sm border border-white/5 bg-sidebar text-xs text-white hover:bg-sidebar-accent hover:brightness-110">
              <Plus className=" h-3.5 w-3.5" />
              {ctaLabel}
            </Button>
          }
        />
      </div>
    </WidgetWrapper>
  );
}

function AccountWidgetFrame({
  icon,
  title,
  headerRight,
  className,
  contentClassName,
  children,
}: {
  icon: LucideIcon;
  title: string;
  headerRight?: ReactNode;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <WidgetWrapper
      icon={icon}
      title={title}
      headerRight={headerRight}
      showHeader
      className={cn("h-auto", className)}
      contentClassName={cn("h-auto flex-col p-6 py-3.5", contentClassName)}
    >
      {children}
    </WidgetWrapper>
  );
}

function CustomPhaseEditor({
  title,
  description,
  phase,
  onPhaseChange,
  showTarget = true,
  onRemove,
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
}) {
  return (
    <div className="rounded-sm border border-white/5 bg-sidebar p-1.5">
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
              variant="outline"
              size="sm"
              className="h-7 rounded-sm border-white/10 bg-sidebar px-2 text-[10px] text-white/55 hover:bg-sidebar"
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
              <p className="text-[11px] font-medium text-white/55">Target %</p>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={"profitTarget" in phase ? phase.profitTarget : ""}
                onChange={(event) =>
                  onPhaseChange("profitTarget", event.target.value)
                }
                placeholder="10"
                className="h-9 rounded-sm border-white/10 bg-sidebar text-sm text-white"
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-white/55">Daily DD %</p>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={phase.dailyLossLimit}
              onChange={(event) =>
                onPhaseChange("dailyLossLimit", event.target.value)
              }
              placeholder="5"
              className="h-9 rounded-sm border-white/10 bg-sidebar text-sm text-white"
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-white/55">Max DD %</p>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={phase.maxLoss}
              onChange={(event) => onPhaseChange("maxLoss", event.target.value)}
              placeholder="10"
              className="h-9 rounded-sm border-white/10 bg-sidebar text-sm text-white"
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
              className="h-9 rounded-sm border-white/10 bg-sidebar text-sm text-white"
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
              className="h-9 rounded-sm border-white/10 bg-sidebar text-sm text-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ManualPropAccountDialog({ account }: { account: AccountRecord }) {
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
  const continuableChallengeOptions =
    continuableChallenges as ContinuableChallengeOption[];

  const resetCustomFlowBuilder = () => {
    setShowCustomFlowBuilder(false);
    setCustomPropFirmName("");
    setCustomChallengePhases([
      createCustomChallengePhaseDraft(),
      createCustomChallengePhaseDraft(),
    ]);
    setCustomFundedPhase(createCustomFundedPhaseDraft());
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
    onError: (error: any) => {
      toast.error(error.message || "Failed to set account as prop");
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
    onSuccess: (data: any) => {
      queryClient.setQueryData(
        propFirmsListQueryOptions.queryKey,
        (current: PropFirmOption[] | undefined) => {
          const next = current || [];
          return next.some((firm) => firm.id === data.propFirm.id)
            ? next
            : [...next, data.propFirm];
        }
      );
      queryClient.setQueryData(
        trpcOptions.propFirms.getChallengeRules.queryOptions({
          propFirmId: data.propFirm.id,
        }).queryKey,
        (current: PropChallengeRuleOption[] | undefined) => {
          const next = current || [];
          return next.some((rule) => rule.id === data.challengeRule.id)
            ? next
            : [...next, data.challengeRule];
        }
      );
      queryClient.invalidateQueries({
        queryKey: propFirmsListQueryOptions.queryKey,
      });
      setAssignmentMode("new");
      setSelectedPropFirmId(data.propFirm.id);
      setSelectedChallengeRuleId(data.challengeRule.id);
      toast.success("Custom prop flow created.");
      resetCustomFlowBuilder();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create custom prop flow");
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
    } catch (error: any) {
      toast.error(error.message || "Invalid custom prop flow");
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

  const updateCustomFundedPhase = (
    key: keyof CustomFundedPhaseDraft,
    value: string
  ) => {
    setCustomFundedPhase((current) => ({ ...current, [key]: value }));
  };

  const handleAssign = () => {
    if (assignmentMode === "continue") {
      if (!selectedChallengeInstanceId) return;

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
          variant="outline"
          size="sm"
          className={cn(
            HEADER_CONTROL_HEIGHT,
            "rounded-sm border-white/10 bg-sidebar px-2.5 text-[10px] font-medium text-white/65 hover:bg-sidebar hover:text-white"
          )}
        >
          Change to prop firm account
        </Button>
      </SheetTrigger>

      <SheetContent className="w-full overflow-y-auto rounded-md p-0 sm:max-w-lg">
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
            <div className={cn(TRADE_SURFACE_CARD_CLASS, "space-y-2 p-4")}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {account.name}
                  </p>
                  <p className="mt-1 text-xs text-white/45">{account.broker}</p>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    HEADER_BADGE_CLASS,
                    "border-white/10 bg-sidebar text-white/55"
                  )}
                >
                  Broker account
                </Badge>
              </div>
              {account.propDetectedFirmId ? (
                <div className="rounded-sm border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/75">
                  We detected this might already be{" "}
                  {detectedPropFirm?.displayName || "a prop account"}. Confirm
                  the firm below and save.
                </div>
              ) : null}
            </div>
          </div>

          <Separator />

          <div className="px-6 py-3">
            <h3 className="text-xs font-semibold tracking-wide text-white/70">
              Challenge flow
            </h3>
          </div>
          <Separator />
          <div className="space-y-3 px-6 py-5">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAssignmentMode("new")}
                className={cn(
                  TRADE_SURFACE_CARD_CLASS,
                  "rounded-sm px-3 py-3 text-left transition-all",
                  assignmentMode === "new"
                    ? "border-teal-400/25 bg-teal-400/10"
                    : "hover:border-white/12 hover:bg-white/[0.05]"
                )}
              >
                <p className="text-xs font-semibold text-white">Start new</p>
                <p className="mt-1 text-[11px] leading-relaxed text-white/45">
                  Use this account as a fresh challenge at Phase 1.
                </p>
              </button>
              <button
                type="button"
                onClick={() =>
                  continuableChallengeOptions.length > 0 &&
                  setAssignmentMode("continue")
                }
                disabled={continuableChallengeOptions.length === 0}
                className={cn(
                  TRADE_SURFACE_CARD_CLASS,
                  "rounded-sm px-3 py-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-45",
                  assignmentMode === "continue"
                    ? "border-teal-400/25 bg-teal-400/10"
                    : "hover:border-white/12 hover:bg-white/[0.05]"
                )}
              >
                <p className="text-xs font-semibold text-white">
                  Continue existing
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-white/45">
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

          <Separator />

          <div className="px-6 py-3">
            <h3 className="text-xs font-semibold tracking-wide text-white/70">
              Prop setup
            </h3>
          </div>
          <Separator />
          <div className="space-y-4 px-6 py-5">
            {assignmentMode === "continue" ? (
              <div className="space-y-2">
                <p className="text-xs text-white/50">Existing challenge</p>
                <div className="grid gap-3">
                  {continuableChallengeOptions.map((challenge) => {
                    const isSelected =
                      selectedChallengeInstanceId === challenge.id;
                    const statusAppearance = getPropStatusAppearance(
                      challenge.status
                    );
                    const phaseName =
                      challenge.currentPhase?.order === 0
                        ? "Funded"
                        : challenge.currentPhase?.name ||
                          `Phase ${challenge.currentPhase?.order ?? 1}`;
                    return (
                      <button
                        key={challenge.id}
                        type="button"
                        onClick={() =>
                          setSelectedChallengeInstanceId(challenge.id)
                        }
                        className={cn(
                          "rounded-sm border border-white/5 bg-sidebar p-1.5 text-left transition-all",
                          isSelected
                            ? "border-teal-400/25"
                            : "hover:border-white/12"
                        )}
                      >
                        <div
                          className={cn(
                            TRADE_SURFACE_CARD_CLASS,
                            "rounded-sm px-4 py-4 transition-all",
                            isSelected
                              ? "border-teal-400/25 bg-teal-400/10"
                              : "hover:border-white/12 hover:bg-white/[0.05]"
                          )}
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
                                  {challenge.currentAccount?.name
                                    ? ` • ${challenge.currentAccount.name}`
                                    : ""}
                                </p>
                              </div>
                            </div>
                            <Badge
                              variant="outline"
                              className={cn(
                                HEADER_BADGE_CLASS,
                                isSelected
                                  ? "border-teal-400/25 bg-teal-400/10 text-teal-200"
                                  : statusAppearance.className
                              )}
                            >
                              {isSelected ? "Selected" : statusAppearance.label}
                            </Badge>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                {selectedPropFirm ? (
                  <div className="rounded-sm border border-white/5 bg-sidebar p-1.5">
                    <div
                      className={cn(
                        TRADE_SURFACE_CARD_CLASS,
                        "rounded-sm px-4 py-4"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-4">
                          <PropFirmAvatar
                            firm={selectedPropFirm}
                            className="size-12 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-medium tracking-[0.16em] text-white/35">
                              Selected flow
                            </p>
                            <p className="mt-1 text-sm font-semibold text-white">
                              {selectedPropFirm.displayName || "Prop firm"}
                            </p>
                            <p className="mt-1 text-xs text-white/45">
                              {selectedChallengeRule?.displayName ||
                                "Select a challenge rule below"}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            HEADER_BADGE_CLASS,
                            selectedPropFirm.createdByUserId
                              ? "border-teal-400/25 bg-teal-400/10 text-teal-200"
                              : "border-white/10 bg-sidebar text-white/55"
                          )}
                        >
                          {selectedPropFirm.createdByUserId
                            ? "Custom"
                            : "Selected"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold tracking-wide text-white/70">
                        Custom prop flow
                      </p>
                      <p className="mt-1 text-[11px] text-white/40">
                        Create a private multi-step challenge template and
                        assign it to this account.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-sm border-white/10 bg-sidebar px-2.5 text-[11px] text-white/65 hover:bg-sidebar"
                      onClick={() =>
                        setShowCustomFlowBuilder((current) => !current)
                      }
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      {showCustomFlowBuilder ? "Hide builder" : "Create flow"}
                    </Button>
                  </div>

                  {showCustomFlowBuilder ? (
                    <div className="rounded-sm border border-white/5 bg-sidebar p-1.5">
                      <div
                        className={cn(
                          TRADE_SURFACE_CARD_CLASS,
                          "space-y-4 rounded-sm p-4"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">
                              Private prop challenge builder
                            </p>
                            <p className="mt-1 text-[11px] leading-relaxed text-white/45">
                              Set the rules for each phase, save the flow, then
                              assign this account into that challenge.
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className="h-7 rounded-sm border-white/10 bg-sidebar px-1.5 text-[10px] text-white/55"
                          >
                            Private
                          </Badge>
                        </div>

                        <div className="space-y-1.5">
                          <p className="text-[11px] font-medium text-white/55">
                            Prop firm name
                          </p>
                          <Input
                            value={customPropFirmName}
                            onChange={(event) =>
                              setCustomPropFirmName(event.target.value)
                            }
                            placeholder="E8 Funding"
                            className="h-9 rounded-sm border-white/10 bg-sidebar text-sm text-white"
                          />
                        </div>

                        <Separator />

                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold text-white/70">
                                Challenge phases
                              </p>
                              <p className="mt-1 text-[11px] text-white/40">
                                Add as many phases as you need before funded.
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 rounded-sm border-white/10 bg-sidebar px-2 text-[10px] text-white/60 hover:bg-sidebar"
                              onClick={() =>
                                setCustomChallengePhases((current) => [
                                  ...current,
                                  createCustomChallengePhaseDraft(),
                                ])
                              }
                            >
                              <Plus className="mr-1 h-3 w-3" />
                              Add phase
                            </Button>
                          </div>

                          <div className="grid gap-3">
                            {customChallengePhases.map((phase, index) => (
                              <CustomPhaseEditor
                                key={`custom-phase-${index}`}
                                title={`Phase ${index + 1}`}
                                description="Target, drawdown, and time requirements for this stage."
                                phase={phase}
                                onPhaseChange={(key, value) =>
                                  updateCustomChallengePhase(
                                    index,
                                    key as keyof CustomChallengePhaseDraft,
                                    value
                                  )
                                }
                                onRemove={
                                  customChallengePhases.length > 1
                                    ? () =>
                                        setCustomChallengePhases((current) =>
                                          current.filter(
                                            (_, phaseIndex) =>
                                              phaseIndex !== index
                                          )
                                        )
                                    : undefined
                                }
                              />
                            ))}
                          </div>
                        </div>

                        <Separator />

                        <CustomPhaseEditor
                          title="Funded"
                          description="Ongoing risk rules after the account reaches funded."
                          phase={customFundedPhase}
                          onPhaseChange={(key, value) =>
                            updateCustomFundedPhase(
                              key as keyof CustomFundedPhaseDraft,
                              value
                            )
                          }
                          showTarget={false}
                        />

                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-sm border-white/10 bg-sidebar px-3 text-xs text-white/65 hover:bg-sidebar"
                            onClick={resetCustomFlowBuilder}
                          >
                            Reset
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 rounded-sm bg-teal-600 px-3 text-xs text-white hover:bg-teal-500"
                            onClick={handleCreateCustomFlow}
                            disabled={createCustomFlowMutation.isPending}
                          >
                            Save custom flow
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-white/50">Prop firm</p>
                  <div className="grid gap-3">
                    {propFirmOptions.map((firm) => {
                      const isSelected = selectedPropFirmId === firm.id;
                      return (
                        <button
                          key={firm.id}
                          type="button"
                          onClick={() => setSelectedPropFirmId(firm.id)}
                          className={cn(
                            "rounded-sm border border-white/5 bg-sidebar p-1.5 text-left transition-all",
                            isSelected
                              ? "border-teal-400/25"
                              : "hover:border-white/12"
                          )}
                        >
                          <div
                            className={cn(
                              "relative overflow-hidden rounded-sm border border-white/5 bg-sidebar-accent px-4 py-4 transition-all",
                              isSelected
                                ? "bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.16),rgba(17,24,39,0.98)_58%)]"
                                : "hover:brightness-110"
                            )}
                          >
                            <div className="pointer-events-none absolute inset-y-0 right-0 w-28 bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.14),transparent_70%)]" />
                            <div className="relative flex items-center gap-4">
                              <PropFirmAvatar
                                firm={firm}
                                className="size-14 shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="mt-1 text-sm font-semibold text-white">
                                  {firm.displayName}
                                </p>
                                <p className="mt-1 text-xs leading-relaxed text-white/45">
                                  {firm.description ||
                                    "Move this account into prop accounts with its challenge rules attached."}
                                </p>
                              </div>
                              <Badge
                                variant="outline"
                                className={cn(
                                  HEADER_BADGE_CLASS,
                                  isSelected
                                    ? "border-teal-400/25 bg-teal-400/10 text-teal-200"
                                    : "border-white/10 bg-sidebar text-white/50"
                                )}
                              >
                                {isSelected
                                  ? "Selected"
                                  : firm.createdByUserId
                                  ? "Custom"
                                  : isFtmoFirm(firm)
                                  ? "Ready"
                                  : "Choose"}
                              </Badge>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-white/50">Challenge rule</p>
                  <div className="grid gap-3">
                    {challengeRuleOptions.map((rule) => {
                      const isSelected = selectedChallengeRuleId === rule.id;
                      const metrics = getChallengeRuleMetrics(rule);
                      return (
                        <button
                          key={rule.id}
                          type="button"
                          onClick={() => setSelectedChallengeRuleId(rule.id)}
                          disabled={!selectedPropFirmId}
                          className={cn(
                            "rounded-sm border border-white/5 bg-sidebar p-1.5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50",
                            isSelected
                              ? "border-teal-400/25"
                              : "hover:border-white/12"
                          )}
                        >
                          <div
                            className={cn(
                              TRADE_SURFACE_CARD_CLASS,
                              "rounded-sm px-4 py-4 transition-all",
                              isSelected
                                ? "border-teal-400/25 bg-teal-400/10"
                                : "hover:border-white/12 hover:bg-white/[0.05]"
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-white">
                                  {rule.displayName}
                                </p>
                                <p className="mt-1 text-xs tracking-[0.16em] text-white/35">
                                  {(rule.challengeType || "standard").replace(
                                    "-",
                                    " "
                                  )}
                                </p>
                              </div>
                              <Badge
                                variant="outline"
                                className={cn(
                                  HEADER_BADGE_CLASS,
                                  isSelected
                                    ? "border-teal-400/25 bg-teal-400/10 text-teal-200"
                                    : "border-white/10 bg-sidebar text-white/50"
                                )}
                              >
                                {isSelected ? "Selected" : "Choose"}
                              </Badge>
                            </div>

                            <div className="mt-4 grid grid-cols-3 gap-2">
                              <div className="rounded-sm border border-white/5 bg-sidebar px-3 py-2">
                                <p className="text-[10px]  tracking-[0.16em] text-white/35">
                                  Steps
                                </p>
                                <p className="mt-1 text-sm font-medium text-white/85">
                                  {metrics.evaluationPhases}
                                </p>
                              </div>
                              <div className="rounded-sm border border-white/5 bg-sidebar px-3 py-2">
                                <p className="text-[10px]  tracking-[0.16em] text-white/35">
                                  Target
                                </p>
                                <p className="mt-1 text-sm font-medium text-white/85">
                                  {metrics.profitTarget === null
                                    ? "—"
                                    : `${metrics.profitTarget}%`}
                                </p>
                              </div>
                              <div className="rounded-sm border border-white/5 bg-sidebar px-3 py-2">
                                <p className="text-[10px]  tracking-[0.16em] text-white/35">
                                  Daily Loss
                                </p>
                                <p className="mt-1 text-sm font-medium text-white/85">
                                  {metrics.dailyLossLimit === null
                                    ? metrics.maxLoss === null
                                      ? "—"
                                      : `${metrics.maxLoss}%`
                                    : `${metrics.dailyLossLimit}%`}
                                </p>
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {!selectedPropFirmId ? (
                    <p className="text-xs text-white/35">
                      Select a prop firm first.
                    </p>
                  ) : null}
                  {selectedPropFirmId && challengeRuleOptions.length === 0 ? (
                    <p className="text-xs text-white/35">
                      No challenge rules are configured for this firm yet.
                    </p>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>

        <SheetFooter className="px-6 pb-6">
          <div className="flex w-full gap-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1 border-white/10 bg-sidebar text-white/70 hover:bg-sidebar-accent hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={
                assignPropMutation.isPending ||
                (assignmentMode === "continue"
                  ? !selectedChallengeInstanceId
                  : !selectedPropFirmId || !selectedChallengeRuleId)
              }
              className="flex-1 bg-teal-600 text-white hover:bg-teal-500"
            >
              {assignPropMutation.isPending ? "Saving..." : "Save Prop Account"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default function AccountsPage() {
  const { data: accounts, isLoading } = useQuery(
    trpcOptions.accounts.list.queryOptions()
  );
  const { data: archivedData } = useQuery(
    trpcOptions.accounts.getArchivedIds.queryOptions()
  );
  const [showArchived, setShowArchived] = useState(false);

  const archivedIds = new Set<string>(archivedData?.archivedAccounts || []);
  const allBrokerAccounts =
    accounts?.filter((account: AccountRecord) => !account.isPropAccount) || [];
  const allPropAccounts =
    accounts?.filter((account: AccountRecord) =>
      isCurrentPropStageAccount(account)
    ) || [];

  const brokerAccounts = allBrokerAccounts.filter(
    (account: AccountRecord) => !archivedIds.has(account.id)
  );
  const propAccounts = allPropAccounts.filter(
    (account: AccountRecord) => !archivedIds.has(account.id)
  );
  const archivedAccounts = (accounts || []).filter((account: AccountRecord) =>
    archivedIds.has(account.id)
  );

  const handleAccountCreated = () => {
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
  };

  if (isLoading) {
    return (
      <main className="space-y-5 p-6 py-4">
        <div className="flex justify-end">
          <div className="h-9 w-32 animate-pulse rounded-sm border border-white/5 bg-sidebar" />
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((key) => (
            <WidgetLoading key={key} />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-5 p-6 py-4">
      <section className="space-y-3">
        <SectionHeader
          icon={Building2}
          label="Broker accounts"
          count={brokerAccounts.length}
        />

        {brokerAccounts.length === 0 ? (
          <AccountsEmptyState
            icon={Building2}
            title="No broker accounts"
            description="Add your first broker account to start tracking balances, syncs, and trade history."
            ctaLabel="Add broker account"
            onAccountCreated={handleAccountCreated}
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {brokerAccounts.map((account: AccountRecord) => (
              <BrokerAccountCard key={account.id} account={account} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeader
          icon={Trophy}
          label="Prop accounts"
          count={propAccounts.length}
        />

        {propAccounts.length === 0 ? (
          <AccountsEmptyState
            icon={Trophy}
            title="No prop accounts"
            description="Recognized prop brokers now classify automatically. Add one to start challenge tracking."
            ctaLabel="Add Prop Account"
            onAccountCreated={handleAccountCreated}
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {propAccounts.map((account: AccountRecord) => (
              <PropAccountCard key={account.id} account={account} />
            ))}
          </div>
        )}
      </section>

      {archivedAccounts.length > 0 ? (
        <section className="space-y-3">
          <SectionHeader
            icon={Archive}
            label="Archived"
            count={archivedAccounts.length}
            action={
              <button
                type="button"
                onClick={() => setShowArchived((current) => !current)}
                className="text-[11px] text-white/35 transition-colors hover:text-white/70"
              >
                {showArchived ? "Hide" : "Show"}
              </button>
            }
          />

          {showArchived ? (
            <div className="grid gap-3 opacity-70 md:grid-cols-2 xl:grid-cols-3">
              {archivedAccounts.map((account: AccountRecord) => (
                <ArchivedAccountCard key={account.id} account={account} />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

function ArchivedAccountCard({ account }: { account: AccountRecord }) {
  const balance = getAccountBalance(account);
  const unarchiveMutation = useMutation({
    mutationFn: (input: { accountId: string; archive: boolean }) =>
      trpcClient.accounts.toggleArchive.mutate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });

  return (
    <AccountWidgetFrame
      icon={Archive}
      title={account.name}
      className="border-dashed border-white/10"
      contentClassName="justify-between"
      headerRight={
        <Badge
          variant="outline"
          className={cn(
            HEADER_BADGE_CLASS,
            "border-white/10 text-[10px] text-white/45"
          )}
        >
          Archived
        </Badge>
      }
    >
      <div>
        <p className="text-xs text-white/40">{account.broker}</p>
        <p className="mt-2 text-lg font-semibold text-white/75">
          {formatUsd(balance)}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="h-8 rounded-sm border-white/10 px-3 text-xs text-white/65 hover:bg-sidebar hover:text-white"
        onClick={() =>
          unarchiveMutation.mutate({
            accountId: account.id,
            archive: false,
          })
        }
        disabled={unarchiveMutation.isPending}
      >
        <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" />
        Restore
      </Button>
    </AccountWidgetFrame>
  );
}

function BrokerAccountCard({ account }: { account: AccountRecord }) {
  const balance = getAccountBalance(account);
  const equity = getAccountEquity(account);
  const isVerified = account.isVerified === 1;
  const brokerLabel = account.broker || "Broker account";
  const detectedPropFirmLabel = isFtmoFirm({
    id: account.propDetectedFirmId,
    displayName: account.propDetectedFirmId,
  })
    ? "FTMO"
    : "a prop firm";
  const archiveMutation = useMutation({
    mutationFn: (input: { accountId: string; archive: boolean }) =>
      trpcClient.accounts.toggleArchive.mutate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
  const trackRecordMutation = useMutation({
    mutationFn: (input: { accountId: string }) =>
      trpcClient.accounts.generateTrackRecord.mutate(input),
    onSuccess: (data: any) => {
      const url = `${window.location.origin}/verified/${data.shareId}`;
      navigator.clipboard.writeText(url);
      toast.success("Track record generated. Link copied to clipboard.");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to generate track record");
    },
  });

  return (
    <AccountWidgetFrame
      icon={Building2}
      title={account.name}
      headerRight={
        <div className="flex items-center gap-1.5">
          <ManualPropAccountDialog account={account} />
          <Badge
            variant="outline"
            className={cn(
              HEADER_BADGE_CLASS,
              isVerified
                ? "border-teal-500/30 bg-teal-500/15 text-teal-400"
                : "border-white/10 bg-sidebar text-white/50"
            )}
          >
            {isVerified ? "EA Synced" : "Manual"}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            className={cn(HEADER_ICON_BUTTON_CLASS, "hover:text-emerald-400")}
            onClick={() =>
              trackRecordMutation.mutate({ accountId: account.id })
            }
            disabled={trackRecordMutation.isPending}
            title="Generate verified track record"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={cn(HEADER_ICON_BUTTON_CLASS, "hover:text-white")}
            onClick={() =>
              archiveMutation.mutate({ accountId: account.id, archive: true })
            }
            disabled={archiveMutation.isPending}
            title="Archive account"
          >
            <Archive className="h-3.5 w-3.5" />
          </Button>
        </div>
      }
      contentClassName="justify-between"
    >
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <BrokerAccountAvatar className="size-12 shrink-0 rounded-full!" />
          <div>
            <p className="text-sm font-semibold text-white">{brokerLabel}</p>
            <p className="mt-0.5 text-xs font-medium text-white/50">
              {account.name}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium text-white/45">Balance</p>
          <p className="text-lg font-medium tracking-tight text-teal-400 mt-0.5">
            {formatUsd(balance)}
          </p>
        </div>
      </div>

      <Separator
        className={cn(WIDGET_CONTENT_SEPARATOR_CLASS, "my-5 -mx-6!")}
      />

      <div className="flex flex-wrap items-start justify-between gap-y-4">
        <div className="basis-1/2 text-center sm:basis-0 sm:flex-1">
          <p className="text-xs text-white/35">Balance</p>
          <p className="mt-1 text-sm font-semibold text-white/85">
            {formatUsd(balance)}
          </p>
        </div>
        <div className="basis-1/2 text-center sm:basis-0 sm:flex-1">
          <p className="text-xs text-white/35">Equity</p>
          <p className="mt-1 text-sm font-semibold text-white/85">
            {equity !== null ? formatUsd(equity) : "—"}
          </p>
        </div>
        <div className="basis-1/2 text-center sm:basis-0 sm:flex-1">
          <p className="text-xs text-white/35">Broker</p>
          <p className="mt-1 text-sm font-semibold text-white/85">
            {brokerLabel}
          </p>
        </div>
        <div className="basis-1/2 text-center sm:basis-0 sm:flex-1">
          <p className="text-xs text-white/35">Prop match</p>
          <p className="mt-1 text-sm font-semibold text-white/85">
            {account.propDetectedFirmId ? detectedPropFirmLabel : "None"}
          </p>
        </div>
      </div>

      <Link href={`/dashboard?accountId=${account.id}`} className="mt-5 block">
        <Button className="h-8 w-full gap-0.5 rounded-sm bg-teal-600 text-xs text-white hover:bg-teal-500">
          View dashboard
          <ChevronRight className="size-3" />
        </Button>
      </Link>
    </AccountWidgetFrame>
  );
}

function PropAccountCard({ account }: { account: AccountRecord }) {
  const { data: dashboard } = useQuery({
    ...trpcOptions.propFirms.getTrackerDashboard.queryOptions({
      accountId: account.id,
    }),
    enabled: !!account.isPropAccount,
  });

  const balance = getAccountBalance(account);
  const propFirm: PropFirmOption = {
    id: account.propFirmId || "",
    displayName:
      dashboard?.propFirm?.displayName || account.broker || "Prop firm",
    description: dashboard?.propFirm?.description,
  };
  const currentProfitPercent =
    dashboard?.ruleCheck?.metrics?.currentProfitPercent ??
    parseFloat(account.propPhaseCurrentProfitPercent || "0");
  const tradingDays =
    dashboard?.ruleCheck?.metrics?.tradingDays ??
    account.propPhaseTradingDays ??
    0;
  const minTradingDays = dashboard?.currentPhase?.minTradingDays || 0;
  const hasPhase =
    account.propCurrentPhase !== null && account.propCurrentPhase !== undefined;
  const phaseLabel =
    account.propCurrentPhase === 0
      ? "Funded"
      : dashboard?.currentPhase?.name ||
        `Phase ${account.propCurrentPhase || 1}`;
  const phaseTarget = dashboard?.currentPhase?.profitTarget || 10;

  return (
    <AccountWidgetFrame
      icon={Trophy}
      title={propFirm.displayName || "Prop firm"}
      headerRight={
        <PropAccountStatusBadges
          account={account}
          dashboard={dashboard}
          badgeClassName={HEADER_BADGE_CLASS}
        />
      }
      contentClassName="justify-between"
    >
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <PropFirmAvatar
            firm={propFirm}
            className="size-12 shrink-0 rounded-full!"
          />
          <div>
            <p className="text-sm font-semibold text-white">
              {propFirm.displayName}
            </p>
            <p className="mt-0.5 text-xs font-medium text-white/50">
              {account.name}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className={cn(" text-xs text-white/50")}>Balance</p>
          <p className="text-lg font-medium tracking-tight text-teal-400 mt-0.5">
            {formatUsd(balance)}
          </p>
        </div>
      </div>

      <Separator
        className={cn(WIDGET_CONTENT_SEPARATOR_CLASS, "my-5 -mx-6!")}
      />

      {hasPhase ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="mt-1 text-sm font-semibold text-white">
                {phaseLabel}
              </p>
            </div>
            <div className="text-right">
              <p
                className={cn(
                  "mt-1 text-lg font-semibold",
                  currentProfitPercent >= 0 ? "text-teal-400" : "text-red-400"
                )}
              >
                {currentProfitPercent >= 0 ? "+" : ""}
                {currentProfitPercent.toFixed(2)}%
              </p>
            </div>
          </div>

          <Separator
            className={cn(WIDGET_CONTENT_SEPARATOR_CLASS, "my-5 -mx-6!")}
          />
        </>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-y-4">
        <div className="basis-1/2 text-center sm:basis-0 sm:flex-1">
          <p className="text-xs text-white/35">Trading days</p>
          <p className="mt-1 text-sm font-semibold text-white/85">
            {tradingDays}
            {minTradingDays > 0 ? ` / ${minTradingDays}` : ""}
          </p>
        </div>
        <div className="basis-1/2 text-center sm:basis-0 sm:flex-1">
          <p className="text-xs text-white/35">Max DD</p>
          <p className="mt-1 text-sm font-semibold text-white/85">
            {dashboard?.ruleCheck
              ? `${dashboard.ruleCheck.metrics.maxDrawdownPercent.toFixed(2)}%`
              : "—"}
          </p>
        </div>
        <div className="basis-1/2 text-center sm:basis-0 sm:flex-1">
          <p className="text-xs text-white/35">Daily DD</p>
          <p className="mt-1 text-sm font-semibold text-white/85">
            {dashboard?.ruleCheck
              ? `${dashboard.ruleCheck.metrics.dailyDrawdownPercent.toFixed(
                  2
                )}%`
              : "—"}
          </p>
        </div>
        <div className="basis-1/2 text-center sm:basis-0 sm:flex-1">
          <p className="text-xs text-white/35">Target</p>
          <p className="mt-1 text-sm font-semibold text-white/85">
            {phaseTarget}%
          </p>
        </div>
      </div>

      <Link
        href={`/dashboard/prop-tracker/${account.id}`}
        className="mt-5 block"
      >
        <Button className="h-8 w-full rounded-sm bg-teal-600 text-xs text-white hover:bg-teal-500 gap-0.5">
          View tracker
          <ChevronRight className="size-3" />
        </Button>
      </Link>
    </AccountWidgetFrame>
  );
}
