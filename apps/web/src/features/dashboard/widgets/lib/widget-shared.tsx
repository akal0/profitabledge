"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef } from "react";

import type { ChartConfig } from "@/components/ui/chart";
import { WidgetWrapper } from "@/components/dashboard/widget-wrapper";
import { useStatsStore, type AccountStats } from "@/stores/stats";
import { cn } from "@/lib/utils";
import { WidgetShareButton } from "@/features/dashboard/widgets/components/widget-share-button";
import { useAccountCatalog } from "@/features/accounts/hooks/use-account-catalog";
import { isAllAccountsScope } from "@/stores/account";

export const chartConfig = {
  wins: {
    label: "Wins",
    color: "#00E0C8",
  },
  losses: {
    label: "Losses",
    color: "#F76290",
  },
  breakeven: {
    label: "Breakeven",
    color: "#C0C2C9",
  },
} satisfies ChartConfig;

export const WIDGET_CONTENT_SEPARATOR_CLASS = "-mx-3.5 shrink-0 self-stretch";

export type WidgetValueMode = "usd" | "percent" | "rr";

export type WidgetCardProps = {
  accountId?: string;
  isEditing?: boolean;
  className?: string;
  currencyCode?: string;
};

export type WidgetValueCardProps = WidgetCardProps & {
  valueMode?: WidgetValueMode;
  currencyCode?: string;
};

export function toNumber(value: unknown) {
  if (value == null) return 0;
  const direct = Number(value);
  if (Number.isFinite(direct)) return direct;
  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

const CURRENCY_SYMBOL_TO_CODE: Record<string, string> = {
  $: "USD",
  "£": "GBP",
  "€": "EUR",
};

function resolveFractionDigits(options?: {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}) {
  const maximumFractionDigits = options?.maximumFractionDigits ?? 2;
  const minimumFractionDigits = Math.min(
    options?.minimumFractionDigits ?? maximumFractionDigits,
    maximumFractionDigits
  );

  return {
    minimumFractionDigits,
    maximumFractionDigits,
  };
}

function formatLocalizedNumber(
  value: number,
  options?: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    notation?: "standard" | "compact";
  }
) {
  const fractionDigits = resolveFractionDigits(options);

  return value.toLocaleString(undefined, {
    ...fractionDigits,
    notation: options?.notation ?? "standard",
    compactDisplay: options?.notation === "compact" ? "short" : undefined,
  });
}

export function normalizeCurrencyCode(currencyCode?: string | null) {
  const raw = String(currencyCode ?? "").trim();
  if (!raw) return undefined;

  const symbolCurrency = CURRENCY_SYMBOL_TO_CODE[raw];
  if (symbolCurrency) return symbolCurrency;

  const normalized = raw.toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : undefined;
}

export function formatCurrencyValue(
  value: number,
  currencyCode?: string | null,
  options?: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  }
) {
  const resolvedCurrency = normalizeCurrencyCode(currencyCode);
  const fractionDigits = resolveFractionDigits(options);
  if (!resolvedCurrency) {
    return formatLocalizedNumber(value, options);
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: resolvedCurrency,
      ...fractionDigits,
    }).format(value);
  } catch {
    return `${resolvedCurrency} ${formatLocalizedNumber(value, options)}`;
  }
}

export function formatCompactCurrencyValue(
  value: number,
  currencyCode?: string | null,
  options?: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  }
) {
  const resolvedCurrency = normalizeCurrencyCode(currencyCode);
  const fractionDigits = resolveFractionDigits(options);
  if (!resolvedCurrency) {
    return formatLocalizedNumber(value, {
      ...options,
      notation: "compact",
    });
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: resolvedCurrency,
      notation: "compact",
      compactDisplay: "short",
      ...fractionDigits,
    }).format(value);
  } catch {
    return `${resolvedCurrency} ${formatLocalizedNumber(value, {
      ...options,
      notation: "compact",
    })}`;
  }
}

export function formatSignedCurrencyValue(
  value: number,
  currencyCode?: string | null,
  options?: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    showPositiveSign?: boolean;
  }
) {
  const formatted = formatCurrencyValue(Math.abs(value), currencyCode, options);

  if (value < 0) return `-${formatted}`;
  if (options?.showPositiveSign && value > 0) return `+${formatted}`;
  return formatted;
}

export function formatRMultiple(value: number, digits = 2) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}R`;
}

export function getClosedTradeCount(stats?: Partial<AccountStats> | null) {
  return (
    Number(stats?.wins ?? 0) +
    Number(stats?.losses ?? 0) +
    Number(stats?.breakeven ?? 0)
  );
}

export function getBaselineRiskUnit(stats?: Partial<AccountStats> | null) {
  const initialBalance = Number(stats?.initialBalance ?? 0);
  if (!Number.isFinite(initialBalance) || initialBalance <= 0) return null;

  const riskUnit = initialBalance * 0.01;
  return Number.isFinite(riskUnit) && Math.abs(riskUnit) >= 0.000001
    ? riskUnit
    : null;
}

export function getNetReturnR(stats?: Partial<AccountStats> | null) {
  const totalProfit = Number(stats?.totalProfit ?? 0);
  if (!Number.isFinite(totalProfit)) return null;

  const riskUnit = getBaselineRiskUnit(stats);
  if (!riskUnit) return null;

  return totalProfit / riskUnit;
}

export function getRiskUnitForR(stats?: Partial<AccountStats> | null) {
  return getBaselineRiskUnit(stats);
}

export function toRValue(value: number, riskUnit?: number | null) {
  if (!riskUnit || Math.abs(riskUnit) < 0.000001) return null;
  const nextValue = value / riskUnit;
  return Number.isFinite(nextValue) ? nextValue : null;
}

export function DashboardWidgetFrame({
  title,
  icon,
  headerRight,
  isEditing = false,
  className,
  contentClassName,
  children,
}: {
  title: string;
  icon?: ReactNode;
  headerRight?: ReactNode;
  isEditing?: boolean;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  const widgetRef = useRef<HTMLDivElement | null>(null);

  return (
    <WidgetWrapper
      rootRef={widgetRef}
      isEditing={isEditing}
      className={className}
      header={
        <div className="widget-header flex w-full items-center gap-1.5 p-3.5">
          <div className="flex min-w-0 items-center gap-1.5">
            {icon}
            <h2 className="flex items-center gap-2 text-xs font-medium text-white/50 transition-all duration-250 group-hover:text-white">
              <span>{title}</span>
            </h2>
          </div>
          {headerRight || !isEditing ? (
            <div
              className="ml-auto flex items-center gap-2"
              data-widget-share-ignore="true"
            >
              {headerRight}
              {!isEditing ? (
                <WidgetShareButton targetRef={widgetRef} title={title} />
              ) : null}
            </div>
          ) : null}
        </div>
      }
      contentClassName={cn(
        "flex h-full w-full rounded-sm",
        contentClassName ?? "flex-col justify-between"
      )}
    >
      {children}
    </WidgetWrapper>
  );
}

export function useAccountStats(accountId?: string) {
  const fetchStats = useStatsStore((state) => state.fetchStats);
  const getStats = useStatsStore((state) => state.getStats);
  const { accounts } = useAccountCatalog();
  const hasValidAccountScope = useMemo(() => {
    if (!accountId) return false;
    if (isAllAccountsScope(accountId)) return true;
    return accounts.some((account) => account.id === accountId);
  }, [accountId, accounts]);
  const isLoading = useStatsStore((state) => state.isLoading(accountId));

  useEffect(() => {
    if (accountId && hasValidAccountScope) {
      fetchStats(accountId);
    }
  }, [accountId, fetchStats, hasValidAccountScope]);

  return {
    data: hasValidAccountScope ? getStats(accountId) ?? null : null,
    loading: hasValidAccountScope ? isLoading : false,
  };
}
