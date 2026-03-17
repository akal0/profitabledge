"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { ListFilterPlus, X } from "lucide-react";

import PickerComponent from "@/components/dashboard/calendar/picker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { useAccountCatalog } from "@/features/accounts/hooks/use-account-catalog";
import { formatTriggerLabel } from "@/features/trades/table-toolbar/lib/trades-toolbar-utils";
import { tradesToolbarStyles } from "@/features/trades/table-toolbar/lib/trades-toolbar-styles";
import { cn } from "@/lib/utils";
import { trpcClient, trpcOptions } from "@/utils/trpc";
import type { AccountStats } from "@/stores/stats";

type DashboardFilteredTrade = {
  id: string;
  accountId?: string | null;
  open?: string | null;
  close?: string | null;
  symbol?: string | null;
  rawSymbol?: string | null;
  symbolGroup?: string | null;
  profit?: number | null;
  holdSeconds?: number | null;
  sessionTag?: string | null;
  modelTag?: string | null;
  customTags?: string[];
  realisedRR?: number | null;
};

type DashboardTradeFiltersContextValue = {
  accountId?: string;
  hasActiveFilters: boolean;
  isLoading: boolean;
  filteredTrades: DashboardFilteredTrade[];
  filteredStats: Partial<AccountStats> | null;
  accountBreakdown: Array<{
    id: string;
    name: string;
    isPropAccount?: boolean;
    totalTrades: number;
    winRate: number;
    totalProfit: number;
    contribution: number;
  }>;
  filters: {
    startDate: string;
    endDate: string;
    symbols: string[];
    sessionTags: string[];
    modelTags: string[];
    customTags: string[];
    accountTags: string[];
  };
  suggestions: {
    symbols: string[];
    sessionTags: string[];
    modelTags: string[];
    customTags: string[];
    accountTags: string[];
  };
  setStartDate: (value: string) => Promise<URLSearchParams>;
  setEndDate: (value: string) => Promise<URLSearchParams>;
  setSymbols: (value: string[]) => Promise<URLSearchParams>;
  setSessionTags: (value: string[]) => Promise<URLSearchParams>;
  setModelTags: (value: string[]) => Promise<URLSearchParams>;
  setCustomTags: (value: string[]) => Promise<URLSearchParams>;
  setAccountTags: (value: string[]) => Promise<URLSearchParams>;
  clearFilters: () => Promise<void>;
};

const DashboardTradeFiltersContext =
  createContext<DashboardTradeFiltersContextValue | null>(null);

const EMPTY_DASHBOARD_FILTERS = {
  startDate: "",
  endDate: "",
  symbols: [] as string[],
  sessionTags: [] as string[],
  modelTags: [] as string[],
  customTags: [] as string[],
  accountTags: [] as string[],
};

const EMPTY_DASHBOARD_SUGGESTIONS = {
  symbols: [] as string[],
  sessionTags: [] as string[],
  modelTags: [] as string[],
  customTags: [] as string[],
  accountTags: [] as string[],
};

const TRADE_PAGE_LIMIT = 200;
const TRADE_PAGE_MAX = 100;

function splitParam(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinParam(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean))
  ).join(",");
}

function getSortedFilterValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) =>
    left.localeCompare(right, undefined, {
      numeric: true,
      sensitivity: "base",
    })
  );
}

function startDateToIso(value: string) {
  if (!value) return undefined;
  return new Date(`${value}T00:00:00.000`).toISOString();
}

function endDateToIso(value: string) {
  if (!value) return undefined;
  return new Date(`${value}T23:59:59.999`).toISOString();
}

function parseFilterDateValue(value: string) {
  if (!value) return null;
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function formatFilterDateValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTradeTimestamp(trade: DashboardFilteredTrade) {
  return trade.open || trade.close || null;
}

function deriveFilteredStats(trades: DashboardFilteredTrade[]) {
  const profits = trades.map((trade) => Number(trade.profit ?? 0));
  const totalTrades = profits.length;
  const wins = profits.filter((profit) => profit > 0).length;
  const losses = profits.filter((profit) => profit < 0).length;
  const breakeven = totalTrades - wins - losses;
  const totalProfit = profits.reduce((sum, profit) => sum + profit, 0);
  const grossProfit = profits
    .filter((profit) => profit > 0)
    .reduce((sum, profit) => sum + profit, 0);
  const grossLossAbs = Math.abs(
    profits
      .filter((profit) => profit < 0)
      .reduce((sum, profit) => sum + profit, 0)
  );
  const holdValues = trades
    .map((trade) => Number(trade.holdSeconds ?? 0))
    .filter((value) => Number.isFinite(value) && value >= 0);
  const rrValues = trades
    .map((trade) => Number(trade.realisedRR))
    .filter((value) => Number.isFinite(value));
  const outcomeSequence = [...trades]
    .sort((left, right) => {
      const leftTime = new Date(getTradeTimestamp(left) || 0).getTime();
      const rightTime = new Date(getTradeTimestamp(right) || 0).getTime();
      return rightTime - leftTime;
    })
    .map((trade) => Number(trade.profit ?? 0))
    .filter((profit) => profit !== 0)
    .map((profit) => (profit > 0 ? "W" : "L")) as ("W" | "L")[];

  let winStreak = 0;
  for (const outcome of outcomeSequence) {
    if (outcome !== "W") {
      break;
    }
    winStreak += 1;
  }

  return {
    totalProfit,
    grossProfit,
    wins,
    losses,
    breakeven,
    winrate: totalTrades > 0 ? (wins / totalTrades) * 100 : 0,
    averageHoldSeconds:
      holdValues.length > 0
        ? holdValues.reduce((sum, value) => sum + value, 0) / holdValues.length
        : 0,
    averageRMultiple:
      rrValues.length > 0
        ? rrValues.reduce((sum, value) => sum + value, 0) / rrValues.length
        : null,
    profitFactor:
      grossLossAbs > 0 ? grossProfit / grossLossAbs : grossProfit > 0 ? null : 0,
    expectancy: totalTrades > 0 ? totalProfit / totalTrades : 0,
    winStreak,
    recentOutcomes: outcomeSequence.slice(0, 5),
    recentTrades: trades.slice(0, 5),
  } satisfies Partial<AccountStats> & { recentTrades: DashboardFilteredTrade[] };
}

function calculateSessionLabel(trade: DashboardFilteredTrade) {
  const timestamp = getTradeTimestamp(trade);
  if (!timestamp) return "Unknown";

  const hour = new Date(timestamp).getUTCHours();
  if (hour >= 0 && hour < 8) return "Asian";
  if (hour >= 8 && hour < 16) return "London";
  return "New York";
}

async function fetchFilteredTrades(input: {
  accountId: string;
  startDate: string;
  endDate: string;
  symbols: string[];
  sessionTags: string[];
  modelTags: string[];
  customTags: string[];
}) {
  const trades: DashboardFilteredTrade[] = [];
  let cursor: { createdAtISO: string; id: string } | undefined;
  let pageCount = 0;

  do {
    const page = await trpcClient.trades.listInfinite.query({
      accountId: input.accountId,
      limit: TRADE_PAGE_LIMIT,
      startISO: startDateToIso(input.startDate),
      endISO: endDateToIso(input.endDate),
      symbols: input.symbols.length ? input.symbols : undefined,
      sessionTags: input.sessionTags.length ? input.sessionTags : undefined,
      modelTags: input.modelTags.length ? input.modelTags : undefined,
      customTags: input.customTags.length ? input.customTags : undefined,
      cursor,
    });

    trades.push(...(page.items as DashboardFilteredTrade[]));
    cursor = "nextCursor" in page ? page.nextCursor ?? undefined : undefined;
    pageCount += 1;
  } while (cursor && pageCount < TRADE_PAGE_MAX);

  return trades;
}

export function DashboardTradeFiltersProvider({
  accountId,
  fetchMode = "filtered",
  children,
}: {
  accountId?: string;
  fetchMode?: "filtered" | "always";
  children: ReactNode;
}) {
  const [startDate, setStartDate] = useQueryState("dstart", {
    defaultValue: "",
  });
  const [endDate, setEndDate] = useQueryState("dend", {
    defaultValue: "",
  });
  const [symbolsParam, setSymbolsParam] = useQueryState("dsymbols", {
    defaultValue: "",
  });
  const [sessionTagsParam, setSessionTagsParam] = useQueryState("dsessions", {
    defaultValue: "",
  });
  const [modelTagsParam, setModelTagsParam] = useQueryState("dmodels", {
    defaultValue: "",
  });
  const [customTagsParam, setCustomTagsParam] = useQueryState("dtags", {
    defaultValue: "",
  });
  const [accountTagsParam, setAccountTagsParam] = useQueryState("daccounts", {
    defaultValue: "",
  });

  const { accounts } = useAccountCatalog({ enabled: Boolean(accountId) });

  const symbols = useMemo(() => splitParam(symbolsParam), [symbolsParam]);
  const sessionTags = useMemo(
    () => splitParam(sessionTagsParam),
    [sessionTagsParam]
  );
  const modelTags = useMemo(() => splitParam(modelTagsParam), [modelTagsParam]);
  const customTags = useMemo(
    () => splitParam(customTagsParam),
    [customTagsParam]
  );
  const accountTags = useMemo(
    () => splitParam(accountTagsParam),
    [accountTagsParam]
  );
  const hasActiveFilters = Boolean(
    startDate ||
      endDate ||
      symbols.length ||
      sessionTags.length ||
      modelTags.length ||
      customTags.length ||
      accountTags.length
  );
  const shouldFetchTradeDataset = Boolean(accountId) &&
    (fetchMode === "always" || hasActiveFilters);

  const symbolSuggestionsQuery = useQuery({
    ...trpcOptions.trades.listSymbols.queryOptions({ accountId: accountId || "" }),
    enabled: Boolean(accountId),
    staleTime: 30_000,
  });
  const sessionTagSuggestionsQuery = useQuery({
    ...trpcOptions.trades.listSessionTags.queryOptions({
      accountId: accountId || "",
    }),
    enabled: Boolean(accountId),
    staleTime: 30_000,
  });
  const modelTagSuggestionsQuery = useQuery({
    ...trpcOptions.trades.listModelTags.queryOptions({
      accountId: accountId || "",
    }),
    enabled: Boolean(accountId),
    staleTime: 30_000,
  });
  const customTagSuggestionsQuery = useQuery({
    ...trpcOptions.trades.listCustomTags.queryOptions({
      accountId: accountId || "",
    }),
    enabled: Boolean(accountId),
    staleTime: 30_000,
  });
  const accountTagSuggestionsQuery = useQuery({
    ...trpcOptions.accounts.listTags.queryOptions(),
    enabled: Boolean(accountId),
    staleTime: 30_000,
  });

  const tradeQuery = useQuery({
    queryKey: [
      "dashboard-filtered-trades",
      accountId ?? null,
      startDate,
      endDate,
      symbolsParam,
      sessionTagsParam,
      modelTagsParam,
      customTagsParam,
    ],
    enabled: shouldFetchTradeDataset,
    staleTime: 30_000,
    queryFn: async () =>
      fetchFilteredTrades({
        accountId: accountId || "",
        startDate,
        endDate,
        symbols,
        sessionTags,
        modelTags,
        customTags,
      }),
  });

  const accountIdsBySelectedTag = useMemo(() => {
    if (accountTags.length === 0) {
      return null;
    }

    return new Set(
      accounts
        .filter((account) => {
          const tags = Array.isArray(account.tags) ? account.tags : [];

          return accountTags.some((tag) => tags.includes(tag));
        })
        .map((account) => account.id)
    );
  }, [accountTags, accounts]);

  const filteredTrades = useMemo(() => {
    if (!shouldFetchTradeDataset) {
      return [] as DashboardFilteredTrade[];
    }

    const trades = (tradeQuery.data ?? []) as DashboardFilteredTrade[];

    if (!accountIdsBySelectedTag) {
      return trades;
    }

    return trades.filter(
      (trade) =>
        typeof trade.accountId === "string" &&
        accountIdsBySelectedTag.has(trade.accountId)
    );
  }, [accountIdsBySelectedTag, shouldFetchTradeDataset, tradeQuery.data]);

  const filteredStats = useMemo(() => {
    if (!shouldFetchTradeDataset) {
      return null;
    }

    return deriveFilteredStats(filteredTrades);
  }, [
    filteredTrades,
    shouldFetchTradeDataset,
  ]);

  const accountBreakdown = useMemo(() => {
    if (!filteredStats) {
      return [];
    }

    const byAccount = new Map<
      string,
      { name: string; isPropAccount?: boolean; trades: number; wins: number; totalProfit: number }
    >();

    for (const trade of filteredTrades) {
      const tradeAccountId = String(trade.accountId || "");
      if (!tradeAccountId) continue;

      const account = accounts.find((current) => current.id === tradeAccountId);
      const existing = byAccount.get(tradeAccountId) ?? {
        name: account?.name || "Account",
        isPropAccount: account?.isPropAccount,
        trades: 0,
        wins: 0,
        totalProfit: 0,
      };
      const profit = Number(trade.profit ?? 0);
      existing.trades += 1;
      existing.totalProfit += profit;
      if (profit > 0) {
        existing.wins += 1;
      }
      byAccount.set(tradeAccountId, existing);
    }

    const totalProfit = Number(filteredStats.totalProfit ?? 0);

    return Array.from(byAccount.entries())
      .map(([id, value]) => ({
        id,
        name: value.name,
        isPropAccount: value.isPropAccount,
        totalTrades: value.trades,
        winRate: value.trades > 0 ? (value.wins / value.trades) * 100 : 0,
        totalProfit: value.totalProfit,
        contribution:
          totalProfit !== 0 ? (value.totalProfit / totalProfit) * 100 : 0,
      }))
      .sort((left, right) => right.totalProfit - left.totalProfit);
  }, [accounts, filteredStats, filteredTrades]);

  const value = useMemo<DashboardTradeFiltersContextValue>(
    () => ({
      accountId,
      hasActiveFilters,
      isLoading: shouldFetchTradeDataset && tradeQuery.isLoading,
      filteredTrades,
      filteredStats,
      accountBreakdown,
      filters: {
        startDate,
        endDate,
        symbols,
        sessionTags,
        modelTags,
        customTags,
        accountTags,
      },
      suggestions: {
        symbols: (symbolSuggestionsQuery.data as string[] | undefined) ?? [],
        sessionTags:
          ((sessionTagSuggestionsQuery.data as Array<{ name: string }> | undefined) ??
            []).map((tag) => tag.name),
        modelTags:
          ((modelTagSuggestionsQuery.data as Array<{ name: string }> | undefined) ??
            []).map((tag) => tag.name),
        customTags:
          (customTagSuggestionsQuery.data as string[] | undefined) ?? [],
        accountTags:
          (accountTagSuggestionsQuery.data as string[] | undefined) ?? [],
      },
      setStartDate,
      setEndDate,
      setSymbols: (value) => setSymbolsParam(joinParam(value)),
      setSessionTags: (value) => setSessionTagsParam(joinParam(value)),
      setModelTags: (value) => setModelTagsParam(joinParam(value)),
      setCustomTags: (value) => setCustomTagsParam(joinParam(value)),
      setAccountTags: (value) => setAccountTagsParam(joinParam(value)),
      clearFilters: async () => {
        await Promise.all([
          setStartDate(""),
          setEndDate(""),
          setSymbolsParam(""),
          setSessionTagsParam(""),
          setModelTagsParam(""),
          setCustomTagsParam(""),
          setAccountTagsParam(""),
        ]);
      },
    }),
    [
      accountBreakdown,
      accountId,
      accountTagSuggestionsQuery.data,
      accountTags,
      customTagSuggestionsQuery.data,
      customTags,
      endDate,
      filteredStats,
      filteredTrades,
      hasActiveFilters,
      modelTagSuggestionsQuery.data,
      modelTags,
      sessionTagSuggestionsQuery.data,
      sessionTags,
      setAccountTagsParam,
      setCustomTagsParam,
      setEndDate,
      setModelTagsParam,
      setSessionTagsParam,
      setStartDate,
      setSymbolsParam,
      startDate,
      symbolSuggestionsQuery.data,
      symbols,
      shouldFetchTradeDataset,
      tradeQuery.isLoading,
    ]
  );

  return (
    <DashboardTradeFiltersContext.Provider value={value}>
      {children}
    </DashboardTradeFiltersContext.Provider>
  );
}

export function useDashboardTradeFilters() {
  return useContext(DashboardTradeFiltersContext);
}

function getDashboardAppliedFilterCount(
  filters: DashboardTradeFiltersContextValue["filters"]
) {
  return [
    filters.startDate || filters.endDate ? 1 : 0,
    filters.symbols.length > 0 ? 1 : 0,
    filters.sessionTags.length > 0 ? 1 : 0,
    filters.modelTags.length > 0 ? 1 : 0,
    filters.customTags.length > 0 ? 1 : 0,
    filters.accountTags.length > 0 ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0);
}

function DashboardSelectionSubmenu({
  triggerLabel,
  label,
  items,
  selectedValues,
  onSelectedValuesChange,
  onApply,
  renderItem,
  emptyLabel = "No options yet",
}: {
  triggerLabel: string;
  label: string;
  items: string[];
  selectedValues: string[];
  onSelectedValuesChange: (values: string[]) => void;
  onApply: (values: string[]) => void;
  renderItem?: (item: string) => ReactNode;
  emptyLabel?: string;
}) {
  const {
    filterMenuSubContentClass,
    filterMenuLabelClass,
    filterMenuSubSeparatorClass,
    filterMenuScrollableBodyClass,
    filterMenuOptionRowClass,
    filterMenuCheckboxClass,
    filterMenuFooterClass,
    filterMenuActionButtonClass,
    filterMenuTriggerClass,
  } = tradesToolbarStyles;

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className={filterMenuTriggerClass}>
        {triggerLabel}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent
        className={cn(filterMenuSubContentClass, "w-[280px] p-0")}
      >
        <DropdownMenuLabel className={filterMenuLabelClass}>
          {label}
        </DropdownMenuLabel>
        <Separator className={filterMenuSubSeparatorClass} />
        <div className={filterMenuScrollableBodyClass}>
          {items.length > 0 ? (
            items.map((item) => {
              const selected = selectedValues.includes(item);

              return (
                <label
                  key={item}
                  className={cn(
                    filterMenuOptionRowClass,
                    selected && "bg-sidebar-accent/40"
                  )}
                >
                  <Checkbox
                    checked={selected}
                    onCheckedChange={(checked) => {
                      const next = new Set(selectedValues);
                      if (checked) {
                        next.add(item);
                      } else {
                        next.delete(item);
                      }
                      onSelectedValuesChange(Array.from(next));
                    }}
                    className={filterMenuCheckboxClass}
                  />
                  {renderItem ? (
                    renderItem(item)
                  ) : (
                    <span className="text-white/75">{item}</span>
                  )}
                </label>
              );
            })
          ) : (
            <div className="px-4 py-3 text-xs text-white/40">{emptyLabel}</div>
          )}
        </div>
        <Separator className={filterMenuSubSeparatorClass} />
        <div className={filterMenuFooterClass}>
          <Button
            className={filterMenuActionButtonClass}
            onClick={(event) => {
              event.stopPropagation();
              onSelectedValuesChange([]);
            }}
          >
            Clear
          </Button>
          <Button
            className={filterMenuActionButtonClass}
            onClick={(event) => {
              event.stopPropagation();
              onApply(selectedValues);
            }}
          >
            Apply
          </Button>
        </div>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

export function DashboardTradeFiltersBar({
  mode = "bar",
}: {
  mode?: "bar" | "button";
}) {
  const context = useDashboardTradeFilters();
  const accountId = context?.accountId;
  const filters = context?.filters ?? EMPTY_DASHBOARD_FILTERS;
  const suggestions = context?.suggestions ?? EMPTY_DASHBOARD_SUGGESTIONS;
  const { data: boundsRaw } = useQuery({
    ...trpcOptions.accounts.opensBounds.queryOptions({
      accountId: accountId || "",
    }),
    enabled: Boolean(accountId),
    staleTime: 30_000,
  });
  const appliedFilterCount = getDashboardAppliedFilterCount(filters);
  const {
    activeBadgeClass,
    filterMenuContentClass,
    filterMenuSubContentClass,
    filterMenuSectionTitleClass,
    filterMenuMainSeparatorClass,
    filterMenuTriggerClass,
    iconBadgeClass,
  } = tradesToolbarStyles;
  const [stagedSelections, setStagedSelections] = useState(() => ({
    symbols: filters.symbols,
    sessionTags: filters.sessionTags,
    modelTags: filters.modelTags,
    customTags: filters.customTags,
    accountTags: filters.accountTags,
  }));

  useEffect(() => {
    setStagedSelections({
      symbols: filters.symbols,
      sessionTags: filters.sessionTags,
      modelTags: filters.modelTags,
      customTags: filters.customTags,
      accountTags: filters.accountTags,
    });
  }, [
    filters.accountTags,
    filters.customTags,
    filters.modelTags,
    filters.sessionTags,
    filters.symbols,
  ]);

  const availableSymbols = useMemo(
    () => getSortedFilterValues([...suggestions.symbols, ...filters.symbols]),
    [filters.symbols, suggestions.symbols]
  );
  const availableSessionTags = useMemo(
    () =>
      getSortedFilterValues([
        ...suggestions.sessionTags,
        ...filters.sessionTags,
      ]),
    [filters.sessionTags, suggestions.sessionTags]
  );
  const availableModelTags = useMemo(
    () => getSortedFilterValues([...suggestions.modelTags, ...filters.modelTags]),
    [filters.modelTags, suggestions.modelTags]
  );
  const availableCustomTags = useMemo(
    () => getSortedFilterValues([...suggestions.customTags, ...filters.customTags]),
    [filters.customTags, suggestions.customTags]
  );
  const availableAccountTags = useMemo(
    () =>
      getSortedFilterValues([
        ...suggestions.accountTags,
        ...filters.accountTags,
      ]),
    [filters.accountTags, suggestions.accountTags]
  );
  const summaryItems = [
    filters.startDate || filters.endDate
      ? filters.startDate && filters.endDate
        ? `${filters.startDate} to ${filters.endDate}`
        : filters.startDate
          ? `From ${filters.startDate}`
          : `Until ${filters.endDate}`
      : null,
    filters.symbols.length > 0
      ? `${filters.symbols.length} symbol${filters.symbols.length === 1 ? "" : "s"}`
      : null,
    filters.sessionTags.length > 0
      ? `${filters.sessionTags.length} session tag${filters.sessionTags.length === 1 ? "" : "s"}`
      : null,
    filters.modelTags.length > 0
      ? `${filters.modelTags.length} model tag${filters.modelTags.length === 1 ? "" : "s"}`
      : null,
    filters.customTags.length > 0
      ? `${filters.customTags.length} trade tag${filters.customTags.length === 1 ? "" : "s"}`
      : null,
    filters.accountTags.length > 0
      ? `${filters.accountTags.length} account tag${filters.accountTags.length === 1 ? "" : "s"}`
      : null,
  ].filter((value): value is string => Boolean(value));
  const bounds =
    boundsRaw &&
    typeof boundsRaw === "object" &&
    "minISO" in boundsRaw &&
    "maxISO" in boundsRaw &&
    boundsRaw.minISO &&
    boundsRaw.maxISO
      ? {
          min: new Date(boundsRaw.minISO as string),
          max: new Date(boundsRaw.maxISO as string),
        }
      : null;
  const pickerRange = bounds
    ? {
        start: parseFilterDateValue(filters.startDate) ?? bounds.min,
        end: parseFilterDateValue(filters.endDate) ?? bounds.max,
      }
    : null;
  const availableDays = bounds
    ? Math.max(
        1,
        Math.floor(
          (new Date(bounds.max).setHours(0, 0, 0, 0) -
            new Date(bounds.min).setHours(0, 0, 0, 0)) /
            86_400_000
        ) + 1
      )
    : 1;
  const dateQuickRanges =
    bounds && availableDays > 1
      ? [
          {
            label: "Last 7 days",
            getRange: (minDate: Date, maxDate: Date) => {
              const end = new Date(maxDate);
              end.setHours(0, 0, 0, 0);
              const start = new Date(end);
              start.setDate(end.getDate() - 6);
              return { start: start < minDate ? new Date(minDate) : start, end };
            },
          },
          {
            label: "Last 30 days",
            getRange: (minDate: Date, maxDate: Date) => {
              const end = new Date(maxDate);
              end.setHours(0, 0, 0, 0);
              const start = new Date(end);
              start.setDate(end.getDate() - 29);
              return { start: start < minDate ? new Date(minDate) : start, end };
            },
          },
          {
            label: "All time",
            getRange: (minDate: Date, maxDate: Date) => ({
              start: new Date(minDate),
              end: new Date(maxDate),
            }),
          },
        ]
      : [];

  if (!context || !accountId) {
    return null;
  }

  const filterMenu = (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        {mode === "button" ? (
          <Button
            className={cn(
              "relative flex h-[38px] w-max cursor-pointer items-center justify-center gap-2 rounded-md bg-sidebar px-3 py-2 text-xs text-white transition-all duration-250 ring ring-white/5 hover:bg-sidebar-accent hover:brightness-110 active:scale-95",
              context.hasActiveFilters && "bg-sidebar-accent"
            )}
            aria-label={
              context.hasActiveFilters
                ? `Dashboard filters applied: ${appliedFilterCount}`
                : "Open dashboard filters"
            }
          >
            <ListFilterPlus className="size-3.5 text-white/75" />
            <span>Filters</span>
            {context.hasActiveFilters ? (
              <span className="rounded-sm bg-teal-500/15 px-1.5 py-0.5 text-[10px] font-medium text-teal-300">
                {appliedFilterCount}
              </span>
            ) : null}
          </Button>
        ) : (
          <Button
            className={cn(
              "relative",
              iconBadgeClass,
              context.hasActiveFilters && activeBadgeClass,
              "rounded-none bg-transparent ring-0 hover:bg-transparent"
            )}
            aria-label={
              context.hasActiveFilters
                ? `Dashboard filters applied: ${appliedFilterCount}`
                : "Open dashboard filters"
            }
          >
            <ListFilterPlus className="size-4 text-white/60 hover:text-white" />
            {context.hasActiveFilters ? (
              <span className="absolute right-2 top-2 size-1.5 rounded-full bg-teal-400" />
            ) : null}
          </Button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={mode === "button" ? "end" : "start"}
        sideOffset={10}
        onCloseAutoFocus={(event) => event.preventDefault()}
        className={cn(
          filterMenuContentClass,
          "w-[240px] max-w-[calc(100vw-2rem)] p-0"
        )}
      >
        <div className={filterMenuSectionTitleClass}>Dashboard Filters</div>
        <Separator className={filterMenuMainSeparatorClass} />

        <div className="mt-1">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className={filterMenuTriggerClass}>
              {formatTriggerLabel(
                "Date",
                filters.startDate || filters.endDate ? 1 : 0
              )}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent
              className={cn(filterMenuSubContentClass, "w-[320px] p-4")}
            >
              {bounds && pickerRange ? (
                <div className="grid gap-3">
                  <PickerComponent
                    defaultStart={pickerRange.start}
                    defaultEnd={pickerRange.end}
                    minDate={bounds.min}
                    maxDate={bounds.max}
                    valueStart={pickerRange.start}
                    valueEnd={pickerRange.end}
                    minDays={1}
                    maxDays={availableDays}
                    quickRanges={dateQuickRanges}
                    fillWidth
                    popoverClassName="min-w-[28rem]"
                    popoverStyle={{
                      maxWidth: "min(28rem, calc(100vw - 2rem))",
                      width: "min(28rem, calc(100vw - 2rem))",
                    }}
                    calendarClassName="w-full"
                    calendarFullWidth
                    onRangeChange={(start, end) => {
                      void Promise.all([
                        context.setStartDate(formatFilterDateValue(start)),
                        context.setEndDate(formatFilterDateValue(end)),
                      ]);
                    }}
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-sm border border-white/5 bg-sidebar px-3 py-2 text-[11px] text-white/60">
                      <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-white/35">
                        Start
                      </div>
                      {filters.startDate || "Earliest"}
                    </div>
                    <div className="rounded-sm border border-white/5 bg-sidebar px-3 py-2 text-[11px] text-white/60">
                      <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-white/35">
                        End
                      </div>
                      {filters.endDate || "Latest"}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-[38px] items-center rounded-sm border border-white/5 bg-sidebar px-3 text-xs text-white/35">
                  Loading available date range
                </div>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </div>

        <DashboardSelectionSubmenu
          triggerLabel={formatTriggerLabel(
            "Symbols",
            filters.symbols.length
          )}
          label="Select symbols"
          items={availableSymbols}
          selectedValues={stagedSelections.symbols}
          onSelectedValuesChange={(value) =>
            setStagedSelections((current) => ({ ...current, symbols: value }))
          }
          onApply={(value) => void context.setSymbols(value)}
          renderItem={(item) => (
            <span className="select-none tracking-wide text-white/75">
              {item}
            </span>
          )}
          emptyLabel="No symbols found for this account"
        />

        <DashboardSelectionSubmenu
          triggerLabel={formatTriggerLabel(
            "Session tags",
            filters.sessionTags.length
          )}
          label="Select session tags"
          items={availableSessionTags}
          selectedValues={stagedSelections.sessionTags}
          onSelectedValuesChange={(value) =>
            setStagedSelections((current) => ({
              ...current,
              sessionTags: value,
            }))
          }
          onApply={(value) => void context.setSessionTags(value)}
          emptyLabel="No session tags found"
        />

        <DashboardSelectionSubmenu
          triggerLabel={formatTriggerLabel(
            "Model tags",
            filters.modelTags.length
          )}
          label="Select model tags"
          items={availableModelTags}
          selectedValues={stagedSelections.modelTags}
          onSelectedValuesChange={(value) =>
            setStagedSelections((current) => ({
              ...current,
              modelTags: value,
            }))
          }
          onApply={(value) => void context.setModelTags(value)}
          emptyLabel="No model tags found"
        />

        <DashboardSelectionSubmenu
          triggerLabel={formatTriggerLabel(
            "Trade tags",
            filters.customTags.length
          )}
          label="Select trade tags"
          items={availableCustomTags}
          selectedValues={stagedSelections.customTags}
          onSelectedValuesChange={(value) =>
            setStagedSelections((current) => ({
              ...current,
              customTags: value,
            }))
          }
          onApply={(value) => void context.setCustomTags(value)}
          emptyLabel="No trade tags found"
        />

        <DashboardSelectionSubmenu
          triggerLabel={formatTriggerLabel(
            "Account tags",
            filters.accountTags.length
          )}
          label="Select account tags"
          items={availableAccountTags}
          selectedValues={stagedSelections.accountTags}
          onSelectedValuesChange={(value) =>
            setStagedSelections((current) => ({
              ...current,
              accountTags: value,
            }))
          }
          onApply={(value) => void context.setAccountTags(value)}
          emptyLabel="No account tags found"
        />

        <Separator className={filterMenuMainSeparatorClass} />

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[11px] text-white/45">
          <div className="flex flex-wrap items-center gap-2">
            <span>
              {context.hasActiveFilters
                ? `${context.filteredTrades.length} filtered trades`
                : "Full account view"}
            </span>
            {context.hasActiveFilters ? (
              <>
                <span>•</span>
                <span>
                  Net P&amp;L{" "}
                  <span className="font-medium text-white/80">
                    {(context.filteredStats?.totalProfit ?? 0).toLocaleString(
                      undefined,
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }
                    )}
                  </span>
                </span>
                <span>•</span>
                <span>
                  Win rate{" "}
                  <span className="font-medium text-white/80">
                    {(context.filteredStats?.winrate ?? 0).toFixed(1)}%
                  </span>
                </span>
              </>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            className="h-8 rounded-sm px-3 text-xs text-white/65 hover:bg-sidebar-accent hover:text-white"
            onClick={() => void context.clearFilters()}
            disabled={!context.hasActiveFilters}
          >
            <X className="mr-1.5 size-3.5" />
            Clear
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (mode === "button") {
    return filterMenu;
  }

  return (
    <section className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {filterMenu}

        <div className="flex flex-wrap items-center gap-2">
          {context.hasActiveFilters ? (
            <>
              <span className="rounded-sm border border-teal-500/20 bg-teal-500/10 px-2 py-1 text-[10px] font-medium text-teal-300">
                {appliedFilterCount} active
              </span>
              {summaryItems.slice(0, 3).map((item) => (
                <span
                  key={item}
                  className="rounded-sm border border-white/8 bg-sidebar px-2 py-1 text-[10px] font-medium text-white/50"
                >
                  {item}
                </span>
              ))}
            </>
          ) : (
            <span className="rounded-sm border border-white/10 bg-sidebar px-2 py-1 text-[10px] font-medium text-white/45">
              Full account view
            </span>
          )}
        </div>
      </div>

      {context.hasActiveFilters ? (
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/50">
          <span>{context.filteredTrades.length} trades</span>
          <span>•</span>
          <span>
            Net{" "}
            <span className="font-medium text-white/80">
              {(context.filteredStats?.totalProfit ?? 0).toLocaleString(
                undefined,
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }
              )}
            </span>
          </span>
          <span>•</span>
          <span>
            WR{" "}
            <span className="font-medium text-white/80">
              {(context.filteredStats?.winrate ?? 0).toFixed(1)}%
            </span>
          </span>
        </div>
      ) : null}
    </section>
  );
}

export function buildSessionPerformanceFromTrades(
  trades: DashboardFilteredTrade[]
) {
  if (trades.length === 0) {
    return null;
  }

  const sessions: Record<string, { trades: number; profit: number; wins: number }> =
    {
      Asian: { trades: 0, profit: 0, wins: 0 },
      London: { trades: 0, profit: 0, wins: 0 },
      "New York": { trades: 0, profit: 0, wins: 0 },
    };

  for (const trade of trades) {
    const session = calculateSessionLabel(trade);
    const profit = Number(trade.profit ?? 0);

    if (!sessions[session]) {
      sessions[session] = { trades: 0, profit: 0, wins: 0 };
    }

    sessions[session].trades += 1;
    sessions[session].profit += profit;
    if (profit > 0) {
      sessions[session].wins += 1;
    }
  }

  return Object.entries(sessions).map(([name, value]) => ({
    name,
    trades: value.trades,
    profit: value.profit,
    winRate: value.trades > 0 ? (value.wins / value.trades) * 100 : 0,
  }));
}

export function buildTradeStreakCalendarFromTrades(
  trades: DashboardFilteredTrade[]
) {
  if (trades.length === 0) {
    return null;
  }

  const tradesByDate: Record<string, { profit: number; count: number }> = {};

  for (const trade of trades) {
    const timestamp = getTradeTimestamp(trade);
    if (!timestamp) continue;

    const date = new Date(timestamp).toISOString().split("T")[0];
    if (!date) continue;

    if (!tradesByDate[date]) {
      tradesByDate[date] = { profit: 0, count: 0 };
    }

    tradesByDate[date].profit += Number(trade.profit ?? 0);
    tradesByDate[date].count += 1;
  }

  const sortedDates = Object.keys(tradesByDate).sort();
  let maxWinStreak = 0;
  let maxLoseStreak = 0;
  let currentWinStreak = 0;
  let currentLoseStreak = 0;

  for (const date of sortedDates) {
    const dayProfit = tradesByDate[date].profit;
    if (dayProfit >= 0) {
      currentWinStreak += 1;
      currentLoseStreak = 0;
      maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
    } else {
      currentLoseStreak += 1;
      currentWinStreak = 0;
      maxLoseStreak = Math.max(maxLoseStreak, currentLoseStreak);
    }
  }

  const today = new Date();
  const calendar: Array<{ date: string; profit: number; count: number }> = [];
  for (let index = 29; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - index);
    const key = date.toISOString().split("T")[0];
    const dayData = tradesByDate[key] || { profit: 0, count: 0 };
    calendar.push({
      date: key,
      profit: dayData.profit,
      count: dayData.count,
    });
  }

  return {
    maxWinStreak,
    maxLoseStreak,
    calendar,
    totalGreenDays: calendar.filter((day) => day.profit > 0).length,
    totalRedDays: calendar.filter((day) => day.profit < 0).length,
  };
}
