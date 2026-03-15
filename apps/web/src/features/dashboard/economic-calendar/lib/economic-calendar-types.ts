"use client";

export const CALENDAR_ENDPOINT = "/api/economic-calendar";

export const IMPACT_ORDER = ["High", "Medium", "Low", "Holiday"] as const;

export type ImpactLevel = (typeof IMPACT_ORDER)[number];

export type EconomicEvent = {
  title?: string;
  country?: string;
  date?: string;
  impact?: string;
  actual?: string;
  forecast?: string;
  previous?: string;
};

export type GroupedEvents = Record<string, EconomicEvent[]>;

export type ViewMode = "month" | "week" | "day" | "list";

export const CURRENCY_FLAGS: Record<string, string> = {
  USD: "🇺🇸",
  EUR: "🇪🇺",
  GBP: "🇬🇧",
  JPY: "🇯🇵",
  AUD: "🇦🇺",
  CAD: "🇨🇦",
  CHF: "🇨🇭",
  NZD: "🇳🇿",
  CNY: "🇨🇳",
  HKD: "🇭🇰",
  SGD: "🇸🇬",
  NOK: "🇳🇴",
  SEK: "🇸🇪",
  DKK: "🇩🇰",
};

export const IMPACT_BADGE_CLASSES: Record<ImpactLevel, string> = {
  High: "border-red-500/30 bg-red-500/20 text-red-200",
  Medium: "border-orange-500/30 bg-orange-500/20 text-orange-200",
  Low: "border-yellow-500/30 bg-yellow-500/20 text-yellow-200",
  Holiday: "border-neutral-500/30 bg-neutral-500/20 text-neutral-200",
};

const impactSortOrder: ImpactLevel[] = ["Holiday", "Low", "Medium", "High"];

export const IMPACT_SORT_RANK = impactSortOrder.reduce<Record<string, number>>(
  (accumulator, impact, index) => {
    accumulator[impact] = index;
    return accumulator;
  },
  {}
);
