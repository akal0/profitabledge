"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Lightbulb,
  Plus,
  ShieldAlert,
  Sparkles,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAccountStore } from "@/stores/account";
import { trpc } from "@/utils/trpc";
import { cn } from "@/lib/utils";

type ComplianceRules = {
  requireSL?: boolean;
  requireTP?: boolean;
  requireSessionTag?: boolean;
  requireModelTag?: boolean;
  maxEntrySpreadPips?: number;
  maxEntrySlippagePips?: number;
  maxExitSlippagePips?: number;
  maxPlannedRiskPips?: number;
  minPlannedRR?: number;
  maxPlannedRR?: number;
  maxDrawdownPct?: number;
  disallowScaleIn?: boolean;
  disallowScaleOut?: boolean;
  disallowPartials?: boolean;
  minHoldSeconds?: number;
  maxHoldSeconds?: number;
};

type ComplianceRuleKey = keyof ComplianceRules;

const SECTION_CLASS =
  "rounded-xl border border-white/8 bg-white/[0.03] shadow-[0_0_0_1px_rgba(255,255,255,0.015)]";
const PANEL_CLASS = "rounded-lg border border-white/8 bg-white/[0.03]";

const CATEGORY_TONES: Record<string, string> = {
  session: "border-blue-500/20 bg-blue-500/10 text-blue-200",
  symbol: "border-violet-500/20 bg-violet-500/10 text-violet-200",
  risk: "border-rose-500/20 bg-rose-500/10 text-rose-200",
  timing: "border-amber-500/20 bg-amber-500/10 text-amber-200",
  setup: "border-teal-500/20 bg-teal-500/10 text-teal-200",
  psychology: "border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-200",
};

const REQUIRED_GUARDRAILS: Array<{
  key: ComplianceRuleKey;
  label: string;
  description: string;
}> = [
  {
    key: "requireSL",
    label: "Require stop loss",
    description: "Flag trades that were taken without a defined stop.",
  },
  {
    key: "requireTP",
    label: "Require take profit",
    description: "Keep planned exits explicit before the trade is live.",
  },
  {
    key: "requireSessionTag",
    label: "Require session tag",
    description: "Mark every trade with the session it belongs to.",
  },
  {
    key: "requireModelTag",
    label: "Require model tag",
    description: "Make setup classification mandatory for review quality.",
  },
];

const MANAGEMENT_GUARDRAILS: Array<{
  key: ComplianceRuleKey;
  label: string;
  description: string;
}> = [
  {
    key: "disallowScaleIn",
    label: "Disallow scale-ins",
    description: "Treat averaging into trades as a process violation.",
  },
  {
    key: "disallowScaleOut",
    label: "Disallow scale-outs",
    description: "Prevent partial de-risking from masking process quality.",
  },
  {
    key: "disallowPartials",
    label: "Disallow partial closes",
    description: "Keep trade management consistent across the sample.",
  },
];

const THRESHOLD_GUARDRAILS: Array<{
  key: ComplianceRuleKey;
  label: string;
  placeholder: string;
  group: "Risk thresholds" | "Execution quality";
}> = [
  {
    key: "maxPlannedRiskPips",
    label: "Max planned risk (pips)",
    placeholder: "e.g. 20",
    group: "Risk thresholds",
  },
  {
    key: "maxDrawdownPct",
    label: "Max drawdown (% of risk)",
    placeholder: "e.g. 75",
    group: "Risk thresholds",
  },
  {
    key: "minPlannedRR",
    label: "Min planned R:R",
    placeholder: "e.g. 1.5",
    group: "Risk thresholds",
  },
  {
    key: "maxPlannedRR",
    label: "Max planned R:R",
    placeholder: "e.g. 5",
    group: "Risk thresholds",
  },
  {
    key: "maxEntrySpreadPips",
    label: "Max entry spread (pips)",
    placeholder: "e.g. 1.2",
    group: "Execution quality",
  },
  {
    key: "maxEntrySlippagePips",
    label: "Max entry slippage (pips)",
    placeholder: "e.g. 0.8",
    group: "Execution quality",
  },
  {
    key: "maxExitSlippagePips",
    label: "Max exit slippage (pips)",
    placeholder: "e.g. 1.0",
    group: "Execution quality",
  },
  {
    key: "minHoldSeconds",
    label: "Min hold time (seconds)",
    placeholder: "e.g. 60",
    group: "Execution quality",
  },
  {
    key: "maxHoldSeconds",
    label: "Max hold time (seconds)",
    placeholder: "e.g. 14400",
    group: "Execution quality",
  },
];

const CHECKLIST_STARTERS = [
  {
    id: "trend-continuation",
    name: "Trend continuation",
    strategyTag: "Trend continuation",
    description:
      "Use for continuation setups where structure, momentum, and invalidation need to align before entry.",
    items: [
      { label: "Higher-timeframe trend is clearly intact", isRequired: true },
      { label: "Pullback has tapped the intended structure zone", isRequired: true },
      { label: "Entry trigger is confirmed on the execution timeframe", isRequired: true },
      { label: "Stop-loss is beyond invalidation, not inside noise", isRequired: true },
      { label: "Target offers at least planned minimum R:R", isRequired: true },
      { label: "No scheduled catalyst is about to disrupt the setup", isRequired: false },
    ],
  },
  {
    id: "opening-breakout",
    name: "Opening breakout",
    strategyTag: "Opening breakout",
    description:
      "Designed for session-opening expansion trades that need clean structure and controlled risk.",
    items: [
      { label: "Opening range or key level is clearly defined", isRequired: true },
      { label: "Breakout direction matches the higher-timeframe bias", isRequired: true },
      { label: "Volume or momentum confirms expansion", isRequired: true },
      { label: "Retest or invalidation level is mapped before entry", isRequired: true },
      { label: "Risk is sized for opening volatility", isRequired: true },
      { label: "News/event risk is checked for the next hour", isRequired: false },
    ],
  },
  {
    id: "mean-reversion",
    name: "Mean reversion",
    strategyTag: "Mean reversion",
    description:
      "Useful for exhaustion or snap-back setups where location and patience matter more than speed.",
    items: [
      { label: "Price is extended into a preplanned extreme", isRequired: true },
      { label: "Reversal signal is confirmed before entry", isRequired: true },
      { label: "Trade is not fighting fresh impulsive flow blindly", isRequired: true },
      { label: "Stop-loss is placed beyond the true failure level", isRequired: true },
      { label: "Target is defined back toward fair value or range mean", isRequired: true },
      { label: "Execution is being taken from patience, not revenge/FOMO", isRequired: false },
    ],
  },
  {
    id: "scalp-execution",
    name: "Scalp execution",
    strategyTag: "Scalp",
    description:
      "Built for short-duration execution where spread, timing, and discipline around trade quality matter most.",
    items: [
      { label: "Session quality and liquidity are acceptable", isRequired: true },
      { label: "Spread and slippage conditions are within plan", isRequired: true },
      { label: "Setup matches a predefined scalp model", isRequired: true },
      { label: "Stop-loss and take-profit are defined before clicking", isRequired: true },
      { label: "Position size respects max daily risk and max setup risk", isRequired: true },
      { label: "No impulse entry outside the scalp checklist", isRequired: false },
    ],
  },
] as const;

function parseChecklistItems(raw: string) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const isRequired = line.startsWith("*");
      return {
        label: isRequired ? line.slice(1).trim() : line,
        isRequired,
      };
    })
    .filter((item) => item.label.length > 0);
}

function parseNumber(value: string) {
  if (!value.trim()) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function cleanRules(rules: ComplianceRules) {
  return Object.fromEntries(
    Object.entries(rules).filter(
      ([, value]) => value !== undefined && value !== null
    )
  );
}

function formatConfidence(confidence: number | null | undefined) {
  if (typeof confidence !== "number") return "N/A";
  return `${Math.round(confidence * 100)}%`;
}

function renderParameterValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "object" && value !== null) {
    return JSON.stringify(value);
  }

  return String(value);
}

function numericInputValue(value: unknown) {
  return typeof value === "number" ? value : "";
}

export default function RulesPage() {
  const accountId = useAccountStore((state) => state.selectedAccountId);
  const [auditRules, setAuditRules] = useState<ComplianceRules>({});
  const [rulebookName, setRulebookName] = useState("");
  const [rulebookDescription, setRulebookDescription] = useState("");
  const [checklistName, setChecklistName] = useState("");
  const [checklistDescription, setChecklistDescription] = useState("");
  const [checklistStrategyTag, setChecklistStrategyTag] = useState("");
  const [checklistItems, setChecklistItems] = useState("");

  const compliancePrefsQuery = trpc.users.getCompliancePreferences.useQuery(
    { accountId: accountId || "" },
    { enabled: Boolean(accountId) }
  );
  const rulesQuery = trpc.ai.getRules.useQuery(
    { accountId: accountId || "" },
    { enabled: Boolean(accountId) }
  );
  const complianceQuery = trpc.ai.getDailyCompliance.useQuery(
    { accountId: accountId || "" },
    { enabled: Boolean(accountId) }
  );
  const suggestedRulesQuery = trpc.ai.getSuggestedRules.useQuery(
    { accountId: accountId || "" },
    { enabled: Boolean(accountId) }
  );
  const violationsQuery = trpc.ai.getRuleViolations.useQuery(
    { accountId: accountId || "", limit: 8 },
    { enabled: Boolean(accountId) }
  );
  const checklistTemplatesQuery = trpc.ai.getChecklistTemplates.useQuery(
    { accountId: accountId || "" },
    { enabled: Boolean(accountId) }
  );
  const ruleSetsQuery = trpc.rules.listRuleSets.useQuery(
    { accountId: accountId || undefined },
    { enabled: Boolean(accountId) }
  );

  useEffect(() => {
    setAuditRules((compliancePrefsQuery.data?.rules as ComplianceRules) || {});
  }, [compliancePrefsQuery.data?.rules, accountId]);

  const refreshRulesWorkspace = async () => {
    await Promise.allSettled([
      compliancePrefsQuery.refetch(),
      rulesQuery.refetch(),
      complianceQuery.refetch(),
      suggestedRulesQuery.refetch(),
      violationsQuery.refetch(),
      checklistTemplatesQuery.refetch(),
      ruleSetsQuery.refetch(),
    ]);
  };

  const updateCompliancePrefs = trpc.users.updateCompliancePreferences.useMutation(
    {
      onSuccess: async () => {
        toast.success("Audit guardrails saved");
        await Promise.allSettled([
          compliancePrefsQuery.refetch(),
          complianceQuery.refetch(),
        ]);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to save audit guardrails");
      },
    }
  );

  const createRule = trpc.ai.createRule.useMutation({
    onSuccess: async () => {
      toast.success("Rule added");
      await refreshRulesWorkspace();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateTradingRule = trpc.ai.updateRule.useMutation({
    onSuccess: async () => {
      toast.success("Rule updated");
      await refreshRulesWorkspace();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteRule = trpc.ai.deleteRule.useMutation({
    onSuccess: async () => {
      toast.success("Rule removed");
      await refreshRulesWorkspace();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const createRuleSet = trpc.rules.createRuleSet.useMutation({
    onSuccess: async () => {
      toast.success("Replay rulebook created");
      setRulebookName("");
      setRulebookDescription("");
      await ruleSetsQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateRuleSet = trpc.rules.updateRuleSet.useMutation({
    onSuccess: async () => {
      toast.success("Rulebook updated");
      await ruleSetsQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteRuleSet = trpc.rules.deleteRuleSet.useMutation({
    onSuccess: async () => {
      toast.success("Rulebook removed");
      await ruleSetsQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const createChecklistTemplate = trpc.ai.createChecklistTemplate.useMutation({
    onSuccess: async () => {
      toast.success("Checklist template created");
      setChecklistName("");
      setChecklistDescription("");
      setChecklistStrategyTag("");
      setChecklistItems("");
      await checklistTemplatesQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteChecklistTemplate = trpc.ai.deleteChecklistTemplate.useMutation({
    onSuccess: async () => {
      toast.success("Checklist template removed");
      await checklistTemplatesQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const parsedChecklistItems = useMemo(
    () => parseChecklistItems(checklistItems),
    [checklistItems]
  );

  const thresholdGroups = useMemo(
    () => ({
      risk: THRESHOLD_GUARDRAILS.filter(
        (item) => item.group === "Risk thresholds"
      ),
      execution: THRESHOLD_GUARDRAILS.filter(
        (item) => item.group === "Execution quality"
      ),
    }),
    []
  );

  if (!accountId) {
    return (
      <div className="px-6 sm:px-8 py-8">
        <p className="text-sm text-white/40 text-center">
          Select an account to manage rules, audit guardrails, and checklists.
        </p>
      </div>
    );
  }

  const isWorkspaceLoading =
    compliancePrefsQuery.isLoading ||
    rulesQuery.isLoading ||
    complianceQuery.isLoading ||
    suggestedRulesQuery.isLoading ||
    violationsQuery.isLoading ||
    checklistTemplatesQuery.isLoading ||
    ruleSetsQuery.isLoading;

  const activeRules = rulesQuery.data ?? [];
  const suggestedRules = suggestedRulesQuery.data ?? [];
  const checklistTemplates = checklistTemplatesQuery.data ?? [];
  const recentViolations = violationsQuery.data ?? [];
  const replayRulebooks = ruleSetsQuery.data ?? [];
  const complianceRate = Math.round(complianceQuery.data?.complianceRate ?? 100);
  const reviewedTrades = complianceQuery.data?.trades ?? 0;
  const unresolvedViolations = recentViolations.length;
  const configuredGuardrailCount = Object.keys(cleanRules(auditRules)).length;

  const updateAuditRule = <K extends ComplianceRuleKey>(
    key: K,
    value: ComplianceRules[K]
  ) => {
    setAuditRules((current) => ({ ...current, [key]: value }));
  };

  const handleSaveAuditGuardrails = async () => {
    if (!accountId) return;

    await updateCompliancePrefs.mutateAsync({
      accountId,
      rules: cleanRules(auditRules),
    });
  };

  const handleCreateSuggestion = async (suggestion: {
    category: string;
    ruleType: string;
    label: string;
    description: string;
    parameters: Record<string, unknown>;
  }) => {
    if (!accountId) return;

    await createRule.mutateAsync({
      accountId,
      category: suggestion.category,
      ruleType: suggestion.ruleType,
      label: suggestion.label,
      description: suggestion.description,
      parameters: suggestion.parameters,
    });
  };

  const handleCreateRulebook = async () => {
    if (!accountId) return;

    if (!rulebookName.trim()) {
      toast.error("Rulebook name is required");
      return;
    }

    await createRuleSet.mutateAsync({
      accountId,
      name: rulebookName.trim(),
      description: rulebookDescription.trim() || undefined,
      rules: cleanRules(auditRules),
    });
  };

  const handleCreateChecklist = async () => {
    if (!accountId) return;

    const items = parseChecklistItems(checklistItems);
    if (!checklistName.trim()) {
      toast.error("Checklist name is required");
      return;
    }

    if (items.length === 0) {
      toast.error("Add at least one checklist item");
      return;
    }

    await createChecklistTemplate.mutateAsync({
      accountId,
      name: checklistName.trim(),
      description: checklistDescription.trim() || undefined,
      strategyTag: checklistStrategyTag.trim() || undefined,
      isDefault: checklistTemplates.length === 0,
      items: items.map((item) => ({
        label: item.label,
        isRequired: item.isRequired,
      })),
    });
  };

  const handleApplyChecklistStarter = (starter: (typeof CHECKLIST_STARTERS)[number]) => {
    setChecklistName(starter.name);
    setChecklistStrategyTag(starter.strategyTag);
    setChecklistDescription(starter.description);
    setChecklistItems(
      starter.items
        .map((item) => `${item.isRequired ? "*" : ""}${item.label}`)
        .join("\n")
    );
  };

  return (
    <div className="flex flex-col w-full">
      <div className="px-6 sm:px-8 py-5 space-y-1">
        <h2 className="text-sm font-semibold text-white">
          Rulebook and checklists
        </h2>
        <p className="text-xs text-white/40">
          One place for live trading rules, compliance guardrails, replay
          rulebooks, and pre-trade checklists.
        </p>
      </div>

      <Separator />

      <div className="px-6 sm:px-8 py-5 space-y-5">
        <div className="grid gap-3 md:grid-cols-4">
          {isWorkspaceLoading ? (
            <>
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </>
          ) : (
            <>
              <div className={cn(SECTION_CLASS, "p-4")}>
                <div className="flex items-center gap-2 text-white/70">
                  <ShieldAlert className="size-4 text-teal-300" />
                  <span className="text-xs uppercase tracking-[0.18em]">
                    Active rules
                  </span>
                </div>
                <div className="mt-3 text-2xl font-semibold text-white">
                  {activeRules.length}
                </div>
                <p className="mt-1 text-xs text-white/40">
                  Live account rules currently enforcing your process.
                </p>
              </div>

              <div className={cn(SECTION_CLASS, "p-4")}>
                <div className="flex items-center gap-2 text-white/70">
                  <CheckCircle2 className="size-4 text-emerald-300" />
                  <span className="text-xs uppercase tracking-[0.18em]">
                    Daily compliance
                  </span>
                </div>
                <div className="mt-3 text-2xl font-semibold text-white">
                  {complianceRate}%
                </div>
                <p className="mt-1 text-xs text-white/40">
                  {reviewedTrades} recent trades reviewed against your live
                  process.
                </p>
              </div>

              <div className={cn(SECTION_CLASS, "p-4")}>
                <div className="flex items-center gap-2 text-white/70">
                  <Lightbulb className="size-4 text-amber-300" />
                  <span className="text-xs uppercase tracking-[0.18em]">
                    Guardrails
                  </span>
                </div>
                <div className="mt-3 text-2xl font-semibold text-white">
                  {configuredGuardrailCount}
                </div>
                <p className="mt-1 text-xs text-white/40">
                  Saved audit thresholds that also seed replay rulebooks.
                </p>
              </div>

              <div className={cn(SECTION_CLASS, "p-4")}>
                <div className="flex items-center gap-2 text-white/70">
                  <ClipboardList className="size-4 text-blue-300" />
                  <span className="text-xs uppercase tracking-[0.18em]">
                    Replay rulebooks
                  </span>
                </div>
                <div className="mt-3 text-2xl font-semibold text-white">
                  {replayRulebooks.length}
                </div>
                <p className="mt-1 text-xs text-white/40">
                  {unresolvedViolations} recent violations tracked across this
                  account.
                </p>
              </div>
            </>
          )}
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <section className={cn(SECTION_CLASS, "overflow-hidden")}>
            <div className="flex items-center justify-between gap-3 px-4 py-4">
              <div>
                <div className="flex items-center gap-2 text-white">
                  <Sparkles className="size-4 text-amber-300" />
                  <h3 className="text-sm font-semibold">AI suggested rules</h3>
                </div>
                <p className="mt-1 text-xs text-white/40">
                  Suggestions are generated from your actual edges, leaks, and
                  consistency profile.
                </p>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {suggestedRules.length} suggestions
              </Badge>
            </div>

            <Separator />

            <div className="p-4 space-y-3">
              {isWorkspaceLoading ? (
                <>
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </>
              ) : suggestedRules.length === 0 ? (
                <div className={cn(PANEL_CLASS, "p-4 text-sm text-white/45")}>
                  No strong AI suggestions yet. More trading history and profile
                  data will surface better rule ideas here.
                </div>
              ) : (
                suggestedRules.map((rule) => (
                  <div
                    key={`${rule.ruleType}-${rule.label}`}
                    className={cn(PANEL_CLASS, "p-4")}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-white">
                            {rule.label}
                          </p>
                          <span
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide",
                              CATEGORY_TONES[rule.category] ??
                                "border-white/10 bg-white/5 text-white/55"
                            )}
                          >
                            {rule.category}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/55">
                            Confidence {formatConfidence(rule.confidence)}
                          </span>
                        </div>
                        <p className="text-xs text-white/55">
                          {rule.description}
                        </p>
                        <div className="rounded-md border border-amber-500/15 bg-amber-500/8 px-3 py-2 text-[11px] text-amber-100/85">
                          <span className="font-medium text-amber-200">Why:</span>{" "}
                          {rule.reason}
                        </div>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => handleCreateSuggestion(rule)}
                        disabled={createRule.isPending}
                      >
                        <Plus className="size-3.5" />
                        Add rule
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className={cn(SECTION_CLASS, "overflow-hidden")}>
            <div className="px-4 py-4">
              <div className="flex items-center gap-2 text-white">
                <AlertTriangle className="size-4 text-rose-300" />
                <h3 className="text-sm font-semibold">Recent violations</h3>
              </div>
              <p className="mt-1 text-xs text-white/40">
                Latest account-level rule breaks captured by the coaching layer.
              </p>
            </div>

            <Separator />

            <div className="p-4 space-y-3">
              {isWorkspaceLoading ? (
                <>
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </>
              ) : recentViolations.length === 0 ? (
                <div className={cn(PANEL_CLASS, "p-4 text-sm text-white/45")}>
                  No recent violations. Keep it clean.
                </div>
              ) : (
                recentViolations.map((violation) => (
                  <div key={violation.id} className={cn(PANEL_CLASS, "p-3")}>
                    <div className="flex items-start gap-2">
                      <XCircle className="mt-0.5 size-4 shrink-0 text-rose-300" />
                      <div className="min-w-0">
                        <p className="text-sm text-white/85">
                          {violation.description}
                        </p>
                        <p className="mt-1 text-[11px] text-white/35">
                          {new Date(violation.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <section id="guardrails" className={cn(SECTION_CLASS, "overflow-hidden")}>
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
            <div>
              <div className="flex items-center gap-2 text-white">
                <ShieldAlert className="size-4 text-teal-300" />
                <h3 className="text-sm font-semibold">Audit guardrails</h3>
              </div>
              <p className="mt-1 text-xs text-white/40">
                These account-level constraints power compliance scoring today
                and can be promoted into replay rulebooks.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                {configuredGuardrailCount} configured
              </Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSaveAuditGuardrails}
                disabled={updateCompliancePrefs.isPending}
              >
                {updateCompliancePrefs.isPending ? "Saving..." : "Save guardrails"}
              </Button>
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 p-4 xl:grid-cols-[0.95fr_1.05fr_1fr]">
            <div className={cn(PANEL_CLASS, "p-4")}>
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-white">
                  Required fields
                </h4>
                <p className="text-xs text-white/40">
                  Mark missing planning metadata as process violations.
                </p>
              </div>
              <div className="mt-4 space-y-3">
                {REQUIRED_GUARDRAILS.map((field) => (
                  <div
                    key={field.key}
                    className="flex items-start justify-between gap-3 rounded-lg border border-white/8 bg-black/10 px-3 py-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm text-white/85">{field.label}</p>
                      <p className="text-[11px] text-white/35">
                        {field.description}
                      </p>
                    </div>
                    <Switch
                      checked={Boolean(auditRules[field.key])}
                      onCheckedChange={(next) =>
                        updateAuditRule(field.key, next as ComplianceRules[typeof field.key])
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className={cn(PANEL_CLASS, "p-4")}>
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-white">
                  Risk and execution thresholds
                </h4>
                <p className="text-xs text-white/40">
                  Flag trades that fall outside your intended risk and fill
                  quality.
                </p>
              </div>

              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                    Risk thresholds
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {thresholdGroups.risk.map((field) => (
                      <div key={field.key} className="space-y-1.5">
                        <Label className="text-[11px] text-white/60">
                          {field.label}
                        </Label>
                        <Input
                          value={numericInputValue(auditRules[field.key])}
                          onChange={(event) =>
                            updateAuditRule(
                              field.key,
                              parseNumber(event.target.value) as ComplianceRules[typeof field.key]
                            )
                          }
                          placeholder={field.placeholder}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                    Execution quality
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {thresholdGroups.execution.map((field) => (
                      <div key={field.key} className="space-y-1.5">
                        <Label className="text-[11px] text-white/60">
                          {field.label}
                        </Label>
                        <Input
                          value={numericInputValue(auditRules[field.key])}
                          onChange={(event) =>
                            updateAuditRule(
                              field.key,
                              parseNumber(event.target.value) as ComplianceRules[typeof field.key]
                            )
                          }
                          placeholder={field.placeholder}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className={cn(PANEL_CLASS, "p-4")}>
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-white">
                  Replay rulebooks
                </h4>
                <p className="text-xs text-white/40">
                  Create replay-ready rulebooks from your current guardrails.
                </p>
              </div>

              <div className="mt-4 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-white/60">
                    Rulebook name
                  </Label>
                  <Input
                    value={rulebookName}
                    onChange={(event) => setRulebookName(event.target.value)}
                    placeholder="Prop evaluation rulebook"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-white/60">
                    Description
                  </Label>
                  <Textarea
                    value={rulebookDescription}
                    onChange={(event) =>
                      setRulebookDescription(event.target.value)
                    }
                    placeholder="How this replay rulebook should be used"
                    className="min-h-24"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={handleCreateRulebook}
                    disabled={createRuleSet.isPending}
                  >
                    <Plus className="size-4" />
                    Create from guardrails
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/dashboard/backtest/replay">
                      Open replay
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={cn(SECTION_CLASS, "overflow-hidden")}>
          <div className="flex items-center justify-between gap-3 px-4 py-4">
            <div>
              <div className="flex items-center gap-2 text-white">
                <ShieldAlert className="size-4 text-teal-300" />
                <h3 className="text-sm font-semibold">Active trading rules</h3>
              </div>
              <p className="mt-1 text-xs text-white/40">
                Toggle or remove saved rules without leaving the account setup
                flow.
              </p>
            </div>
            <Badge variant="outline" className="text-[10px]">
              {activeRules.length} saved
            </Badge>
          </div>

          <Separator />

          <div className="p-4 space-y-3">
            {isWorkspaceLoading ? (
              <>
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </>
            ) : activeRules.length === 0 ? (
              <div className={cn(PANEL_CLASS, "p-4 text-sm text-white/45")}>
                No account rules saved yet. Accept an AI suggestion or build a
                checklist below to start tracking process discipline.
              </div>
            ) : (
              activeRules.map((rule) => (
                <div key={rule.id} className={cn(PANEL_CLASS, "p-4")}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-white">
                          {rule.label}
                        </p>
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide",
                            CATEGORY_TONES[rule.category] ??
                              "border-white/10 bg-white/5 text-white/55"
                          )}
                        >
                          {rule.category}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/55">
                          {rule.ruleType}
                        </span>
                      </div>

                      {rule.description ? (
                        <p className="text-xs text-white/55">
                          {rule.description}
                        </p>
                      ) : null}

                      <div className="flex flex-wrap gap-2 text-[11px]">
                        {Object.entries(
                          (rule.parameters ?? {}) as Record<string, unknown>
                        ).map(([key, value]) => (
                          <span
                            key={key}
                            className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-white/60"
                          >
                            {key}: {renderParameterValue(value)}
                          </span>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-4 text-[11px] text-white/35">
                        <span>
                          Violations:{" "}
                          <span className="text-white/60">
                            {rule.violationCount ?? 0}
                          </span>
                        </span>
                        {rule.lastViolatedAt ? (
                          <span>
                            Last hit:{" "}
                            <span className="text-white/60">
                              {new Date(rule.lastViolatedAt).toLocaleString()}
                            </span>
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                        <span className="text-[11px] text-white/45">
                          {rule.isActive ? "Live" : "Paused"}
                        </span>
                        <Switch
                          checked={rule.isActive}
                          onCheckedChange={(next) =>
                            updateTradingRule.mutate({
                              id: rule.id,
                              isActive: next,
                            })
                          }
                          disabled={updateTradingRule.isPending}
                        />
                      </div>
                      <Button
                        size="icon-sm"
                        variant="outline"
                        onClick={() => deleteRule.mutate({ id: rule.id })}
                        disabled={deleteRule.isPending}
                      >
                        <Trash2 className="size-3.5 text-rose-200" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className={cn(SECTION_CLASS, "overflow-hidden")}>
          <div className="flex items-center justify-between gap-3 px-4 py-4">
            <div>
              <div className="flex items-center gap-2 text-white">
                <Lightbulb className="size-4 text-violet-300" />
                <h3 className="text-sm font-semibold">Replay rulebooks</h3>
              </div>
              <p className="mt-1 text-xs text-white/40">
                These rule sets are available in replay and should mirror the
                process you expect live.
              </p>
            </div>
            <Badge variant="outline" className="text-[10px]">
              {replayRulebooks.length} rulebooks
            </Badge>
          </div>

          <Separator />

          <div className="p-4 space-y-3">
            {isWorkspaceLoading ? (
              <>
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </>
            ) : replayRulebooks.length === 0 ? (
              <div className={cn(PANEL_CLASS, "p-4 text-sm text-white/45")}>
                No replay rulebooks saved yet. Create one from your guardrails
                above so backtest replay evaluates the same process.
              </div>
            ) : (
              replayRulebooks.map((rulebook) => (
                <div key={rulebook.id} className={cn(PANEL_CLASS, "p-4")}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-white">
                          {rulebook.name}
                        </p>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/55">
                          {Object.keys(
                            (rulebook.rules ?? {}) as Record<string, unknown>
                          ).length}{" "}
                          checks
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/55">
                          {rulebook.isActive ? "Active in replay" : "Paused"}
                        </span>
                      </div>

                      {rulebook.description ? (
                        <p className="text-xs text-white/55">
                          {rulebook.description}
                        </p>
                      ) : null}

                      <p className="text-[11px] text-white/35">
                        Updated{" "}
                        <span className="text-white/60">
                          {new Date(rulebook.updatedAt).toLocaleString()}
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                        <span className="text-[11px] text-white/45">
                          {rulebook.isActive ? "Live" : "Paused"}
                        </span>
                        <Switch
                          checked={rulebook.isActive ?? true}
                          onCheckedChange={(next) =>
                            updateRuleSet.mutate({
                              ruleSetId: rulebook.id,
                              isActive: next,
                            })
                          }
                          disabled={updateRuleSet.isPending}
                        />
                      </div>
                      <Button
                        size="icon-sm"
                        variant="outline"
                        onClick={() =>
                          deleteRuleSet.mutate({ ruleSetId: rulebook.id })
                        }
                        disabled={deleteRuleSet.isPending}
                      >
                        <Trash2 className="size-3.5 text-rose-200" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className={cn(SECTION_CLASS, "overflow-hidden")}>
            <div className="px-4 py-4">
              <div className="flex items-center gap-2 text-white">
                <ClipboardList className="size-4 text-blue-300" />
                <h3 className="text-sm font-semibold">Create checklist</h3>
              </div>
              <p className="mt-1 text-xs text-white/40">
                One item per line. Prefix a line with{" "}
                <span className="text-white">*</span> to mark it required.
              </p>
            </div>

            <Separator />

            <div className="p-4 space-y-4">
              <div className="space-y-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                    Starter library
                  </p>
                  <p className="mt-1 text-xs text-white/40">
                    Start from an Edge template, then customize it to match
                    your actual setup rules.
                  </p>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  {CHECKLIST_STARTERS.map((starter) => (
                    <div
                      key={starter.id}
                      className="rounded-lg border border-white/8 bg-black/10 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-white">
                            {starter.name}
                          </p>
                          <p className="mt-1 text-xs text-white/45">
                            {starter.description}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleApplyChecklistStarter(starter)}
                        >
                          Use starter
                        </Button>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {starter.items.slice(0, 3).map((item) => (
                          <span
                            key={item.label}
                            className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/55"
                          >
                            {item.isRequired ? "Required" : "Optional"} · {item.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-xs text-white/70">Template name</Label>
                <Input
                  value={checklistName}
                  onChange={(event) => setChecklistName(event.target.value)}
                  placeholder="London breakout checklist"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-white/70">Strategy tag</Label>
                <Input
                  value={checklistStrategyTag}
                  onChange={(event) =>
                    setChecklistStrategyTag(event.target.value)
                  }
                  placeholder="Optional model or setup tag"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-white/70">Description</Label>
                <Textarea
                  value={checklistDescription}
                  onChange={(event) =>
                    setChecklistDescription(event.target.value)
                  }
                  placeholder="What this checklist protects or validates before entry"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-white/70">Checklist items</Label>
                <Textarea
                  value={checklistItems}
                  onChange={(event) => setChecklistItems(event.target.value)}
                  placeholder={
                    "* Bias aligned with higher timeframe\n* Stop-loss defined\nSession quality confirmed\nNews risk checked"
                  }
                  className="min-h-32"
                />
              </div>

              {parsedChecklistItems.length > 0 ? (
                <div className="rounded-lg border border-white/8 bg-black/10 p-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                    Preview
                  </p>
                  <div className="mt-3 space-y-2">
                    {parsedChecklistItems.map((item, index) => (
                      <div
                        key={`${item.label}-${index}`}
                        className="flex items-center gap-2 text-sm text-white/75"
                      >
                        {item.isRequired ? (
                          <Zap className="size-3.5 text-amber-300" />
                        ) : (
                          <CheckCircle2 className="size-3.5 text-teal-300" />
                        )}
                        <span>{item.label}</span>
                        {item.isRequired ? (
                          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-100">
                            Required
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <Button
                onClick={handleCreateChecklist}
                disabled={createChecklistTemplate.isPending}
              >
                <Plus className="size-4" />
                Save checklist template
              </Button>
            </div>
          </div>

          <div className={cn(SECTION_CLASS, "overflow-hidden")}>
            <div className="flex items-center justify-between gap-3 px-4 py-4">
              <div>
                <div className="flex items-center gap-2 text-white">
                  <ClipboardList className="size-4 text-blue-300" />
                  <h3 className="text-sm font-semibold">Saved templates</h3>
                </div>
                <p className="mt-1 text-xs text-white/40">
                  These templates feed checklist-completion metrics and keep
                  pre-entry routines repeatable.
                </p>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {checklistTemplates.length} templates
              </Badge>
            </div>

            <Separator />

            <div className="p-4 space-y-3">
              {isWorkspaceLoading ? (
                <>
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </>
              ) : checklistTemplates.length === 0 ? (
                <div className={cn(PANEL_CLASS, "p-4 text-sm text-white/45")}>
                  No templates saved yet. Build one from your best setup so
                  checklist completion becomes a meaningful process metric.
                </div>
              ) : (
                checklistTemplates.map((template) => (
                  <div key={template.id} className={cn(PANEL_CLASS, "p-4")}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-white">
                            {template.name}
                          </p>
                          {template.isDefault ? (
                            <span className="rounded-full border border-teal-500/20 bg-teal-500/10 px-2 py-0.5 text-[10px] text-teal-100">
                              Default
                            </span>
                          ) : null}
                          {template.strategyTag ? (
                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/55">
                              {template.strategyTag}
                            </span>
                          ) : null}
                        </div>

                        {template.description ? (
                          <p className="text-xs text-white/55">
                            {template.description}
                          </p>
                        ) : null}

                        <div className="space-y-1.5">
                          {template.items.map((item, index) => (
                            <div
                              key={`${template.id}-${index}`}
                              className="flex items-center gap-2 text-[12px] text-white/70"
                            >
                              {item.isRequired ? (
                                <Zap className="size-3.5 text-amber-300" />
                              ) : (
                                <CheckCircle2 className="size-3.5 text-teal-300" />
                              )}
                              <span>{item.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <Button
                        size="icon-sm"
                        variant="outline"
                        onClick={() =>
                          deleteChecklistTemplate.mutate({ id: template.id })
                        }
                        disabled={deleteChecklistTemplate.isPending}
                      >
                        <Trash2 className="size-3.5 text-rose-200" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
