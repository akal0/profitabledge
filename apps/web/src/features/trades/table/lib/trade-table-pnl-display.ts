import {
  formatCurrencyValue,
  formatNumberValue,
} from "@/lib/trade-formatting";

import type { TradePnlDisplayMode } from "./trade-table-types";

const DEFAULT_RISK_PERCENT = 1;

type CurrencyDisplayOptions = Parameters<typeof formatCurrencyValue>[1];

type TradePnlDisplayOptions = {
  mode?: TradePnlDisplayMode;
  initialBalance?: number | string | null;
  riskPercent?: number;
  currencyOptions?: CurrencyDisplayOptions;
  showPlus?: boolean;
  rrMinimumFractionDigits?: number;
  rrMaximumFractionDigits?: number;
};

export const normalizeInitialBalance = (
  initialBalance?: number | string | null
) => {
  const value =
    typeof initialBalance === "string"
      ? Number(initialBalance)
      : initialBalance ?? null;

  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
};

export const getTradeRiskUnit = (
  initialBalance?: number | string | null,
  riskPercent = DEFAULT_RISK_PERCENT
) => {
  const baseline = normalizeInitialBalance(initialBalance);
  const safeRiskPercent =
    typeof riskPercent === "number" && Number.isFinite(riskPercent)
      ? riskPercent
      : DEFAULT_RISK_PERCENT;

  if (!baseline || safeRiskPercent <= 0) {
    return null;
  }

  const riskUnit = (baseline * safeRiskPercent) / 100;
  return Number.isFinite(riskUnit) && riskUnit > 0 ? riskUnit : null;
};

export const toTradePnlMultiple = (
  value: number | null | undefined,
  initialBalance?: number | string | null,
  riskPercent = DEFAULT_RISK_PERCENT
) => {
  const safeValue = Number(value ?? 0);
  const riskUnit = getTradeRiskUnit(initialBalance, riskPercent);

  if (!Number.isFinite(safeValue) || !riskUnit) {
    return null;
  }

  return safeValue / riskUnit;
};

export const formatTradePnlDisplayValue = (
  value: number | null | undefined,
  {
    mode = "usd",
    initialBalance,
    riskPercent = DEFAULT_RISK_PERCENT,
    currencyOptions,
    showPlus = false,
    rrMinimumFractionDigits = 0,
    rrMaximumFractionDigits = 2,
  }: TradePnlDisplayOptions = {}
) => {
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;

  if (mode === "rr") {
    const multiple = toTradePnlMultiple(safeValue, initialBalance, riskPercent);

    if (multiple != null) {
      return `${formatNumberValue(multiple, {
        minimumFractionDigits: rrMinimumFractionDigits,
        maximumFractionDigits: rrMaximumFractionDigits,
        showPlus,
      })}R`;
    }
  }

  return formatCurrencyValue(safeValue, {
    showPlus,
    ...currencyOptions,
  });
};

export const getTradePnlModeDescription = (
  initialBalance?: number | string | null,
  riskPercent = DEFAULT_RISK_PERCENT
) => {
  const baseline = normalizeInitialBalance(initialBalance);
  const riskUnit = getTradeRiskUnit(baseline, riskPercent);

  if (!baseline || !riskUnit) {
    return "Set an account balance baseline to enable RR display.";
  }

  return `RR display uses ${riskPercent}% of your baseline. 1R = ${formatCurrencyValue(
    riskUnit,
    { maximumFractionDigits: 2 }
  )} from a ${formatCurrencyValue(baseline, {
    maximumFractionDigits: 2,
  })} baseline.`;
};
