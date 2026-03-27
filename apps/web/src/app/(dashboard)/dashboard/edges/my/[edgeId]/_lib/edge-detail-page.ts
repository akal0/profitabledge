import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@profitabledge/contracts/trpc";

export const EDGE_TABS = [
  "overview",
  "content",
  "examples",
  "rules",
  "executed-trades",
  "missed-trades",
  "passport",
  "versions",
  "entries",
] as const;

export const EDGE_OVERVIEW_ENTRIES_PAGE_SIZE = 8;

export type EdgeTab = (typeof EDGE_TABS)[number];

export type EdgePublicationState = "private" | "library" | "featured";

export type RuleDraft = {
  title: string;
  description: string;
  appliesOutcomes: string[];
};

type RouterOutputs = inferRouterOutputs<AppRouter>;

export type EdgeDetailResponse = RouterOutputs["edges"]["getDetail"];

export const RULE_OUTCOME_OPTIONS = [
  { value: "all", label: "All outcomes" },
  { value: "winner", label: "Winner" },
  { value: "partial_win", label: "Partial win" },
  { value: "loser", label: "Loser" },
  { value: "breakeven", label: "Breakeven" },
  { value: "cut_trade", label: "Cut trade" },
] as const;

export function isEdgeTab(value: string | null): value is EdgeTab {
  return value !== null && EDGE_TABS.includes(value as EdgeTab);
}

export function formatPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

export function formatMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatR(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}R`;
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "Unscheduled";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unscheduled";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatPublicationModeLabel(mode: EdgePublicationState) {
  if (mode === "featured") {
    return "Featured";
  }

  if (mode === "library") {
    return "Library";
  }

  return "Private";
}

export function formatEntryTypeLabel(entryType: string) {
  return entryType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function formatRuleOutcomeLabel(outcome: string) {
  const matchedOption = RULE_OUTCOME_OPTIONS.find(
    (option) => option.value === outcome
  );
  if (matchedOption) {
    return matchedOption.label;
  }

  return outcome
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function getOverviewGridClass(count: number) {
  if (count >= 5) {
    return "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5";
  }

  if (count === 4) {
    return "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4";
  }

  if (count === 3) {
    return "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3";
  }

  if (count === 2) {
    return "grid grid-cols-1 gap-4 md:grid-cols-2";
  }

  return "grid grid-cols-1 gap-4";
}

export function createEmptyRuleDraft(): RuleDraft {
  return {
    title: "",
    description: "",
    appliesOutcomes: ["all"],
  };
}

export function parseCoverPosition(objectPosition: string) {
  const y = objectPosition.trim().split(/\s+/)[1] ?? "50%";
  const nextPosition = Number.parseFloat(y.replace("%", ""));

  if (!Number.isFinite(nextPosition)) {
    return 50;
  }

  return Math.max(0, Math.min(100, Math.round(nextPosition)));
}

export function normalizeOutcomeSelection(outcomes: string[]) {
  const deduped = Array.from(new Set(outcomes));
  if (deduped.length === 0 || deduped.includes("all")) {
    return ["all"];
  }
  return deduped;
}
