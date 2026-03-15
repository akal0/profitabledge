"use client";

import type { ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCurrencyValue, formatNumberValue } from "@/lib/trade-formatting";
import { TRADE_IDENTIFIER_TONES } from "@/components/trades/trade-identifier-pill";
import type { TradeRow } from "./trade-table-types";

const HEADER_TOOLTIPS: Record<string, string> = {
  symbol: "The name of what you traded.",
  tradeDirection: "Shows if you bought or sold.",
  sessionTag: "Shows the time window name for this trade.",
  modelTag: "Shows the setup name you used.",
  protocolAlignment: "Shows if you followed your rules.",
  outcome: "Shows if a trade is live, won, lost, broke even, or won part.",
  tp: "The price you wanted to take profit.",
  sl: "The price you wanted to stop loss.",
  open: "When the trade started.",
  close: "When the trade ended.",
  holdSeconds: "How long the trade stayed open.",
  volume: "How big the trade was.",
  profit: "How much money you made or lost.",
  commissions: "Fees the broker took.",
  swap: "Overnight fee or credit.",
  manipulationPips: "How big the setup move was.",
  mfePips: "How far price went your way while you were in.",
  maePips: "How far price went against you while you were in.",
  entrySpreadPips: "How wide the spread was when you entered.",
  exitSpreadPips: "How wide the spread was when you exited.",
  entrySlippagePips: "How far price slipped when you entered.",
  exitSlippagePips: "How far price slipped when you exited.",
  slModCount: "How many times stop loss changed.",
  tpModCount: "How many times take profit changed.",
  partialCloseCount: "How many times you closed a part.",
  exitDealCount: "How many exit deals were used.",
  exitVolume: "Total size closed at exit.",
  entryBalance: "Balance when you entered.",
  entryEquity: "Equity when you entered.",
  entryMargin: "Margin used at entry.",
  entryFreeMargin: "Free margin at entry.",
  entryMarginLevel: "Margin level at entry.",
  entryDealCount: "How many entry deals were used.",
  entryVolume: "Total size opened at entry.",
  scaleInCount: "How many extra entries you added.",
  scaleOutCount: "How many extra exits you added.",
  trailingStopDetected: "Shows if stop loss moved to follow price.",
  entryPeakDurationSeconds: "Time from entry to the best price.",
  postExitPeakDurationSeconds: "Time from exit to the best price after.",
  mpeManipLegR: "How big the best move was, using the setup move.",
  mpeManipPE_R: "How big the after-exit move was, using the setup move.",
  maxRR: "The biggest reward to risk you could have had.",
  realisedRR: "The reward to risk you actually got.",
  rrCaptureEfficiency: "How much of the possible move you kept.",
  manipRREfficiency: "How much of the setup move you kept.",
  rawSTDV: "How wild price was while you were in.",
  rawSTDV_PE: "How wild price was after you exited.",
  stdvBucket:
    "Shows volatility level: Very Low (-2σ), Low (-1σ), Normal (0σ), High (+1σ), Very High (+2σ).",
  estimatedWeightedMPE_R: "A realistic target based on your past trades.",
  plannedRR: "The reward to risk you planned.",
  plannedRiskPips: "How far your stop was in pips.",
  plannedTargetPips: "How far your target was in pips.",
  exitEfficiency: "How good your exit timing was.",
  drawdown: "How far price went against you.",
  complianceStatus: "Shows if the trade passed your rules.",
};

export const withTradeTableHeaderTooltip = (
  key: string,
  label: ReactNode
): ReactNode => (
  <Tooltip>
    <TooltipTrigger asChild>
      <span className="inline-flex cursor-pointer items-center gap-1">
        {label}
      </span>
    </TooltipTrigger>
    <TooltipContent className="mb-0">
      {HEADER_TOOLTIPS[key] || "Column details"}
    </TooltipContent>
  </Tooltip>
);

export const formatTradeTableNumber = (value: number, decimals = 2) =>
  formatNumberValue(value, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

export const formatTradeTableCount = (value: number) =>
  formatNumberValue(value, { maximumFractionDigits: 0 });

export const formatTradeTablePercent = (value: number, decimals = 0) =>
  `${formatTradeTableNumber(value, decimals)}%`;

export const formatTradeTableCurrency = (value: number, decimals = 2) =>
  formatCurrencyValue(value, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

export const getTradeProfitTone = (value: number) =>
  value < 0
    ? TRADE_IDENTIFIER_TONES.negative
    : value > 0
      ? TRADE_IDENTIFIER_TONES.positive
      : TRADE_IDENTIFIER_TONES.neutral;

export const getTradeCommissionTone = (value: number) =>
  value < 0 ? TRADE_IDENTIFIER_TONES.negative : TRADE_IDENTIFIER_TONES.neutral;

export const getTradeSwapTone = (value: number) =>
  value < 0
    ? TRADE_IDENTIFIER_TONES.negative
    : value > 0
      ? TRADE_IDENTIFIER_TONES.positive
      : TRADE_IDENTIFIER_TONES.neutral;

export const getTradeMaxRRTone = (value: number) =>
  value >= 2
    ? TRADE_IDENTIFIER_TONES.positive
    : value >= 1
      ? TRADE_IDENTIFIER_TONES.warning
      : TRADE_IDENTIFIER_TONES.neutral;

export const getTradeRealisedRRTone = (value: number) =>
  value < 0
    ? TRADE_IDENTIFIER_TONES.negative
    : value > 0
      ? TRADE_IDENTIFIER_TONES.positive
      : TRADE_IDENTIFIER_TONES.neutral;

export const getTradeEfficiencyTone = (
  value: number,
  strongThreshold: number,
  mediumThreshold: number,
  softThreshold: number
) =>
  value >= strongThreshold
    ? TRADE_IDENTIFIER_TONES.positive
    : value >= mediumThreshold
      ? TRADE_IDENTIFIER_TONES.warning
      : value >= softThreshold
        ? TRADE_IDENTIFIER_TONES.amber
        : TRADE_IDENTIFIER_TONES.negative;

export const getTradeExitEfficiencyTone = (value: number) =>
  value >= 80
    ? TRADE_IDENTIFIER_TONES.positive
    : value >= 50
      ? TRADE_IDENTIFIER_TONES.warning
      : TRADE_IDENTIFIER_TONES.amber;

export const getTradeComplianceTone = (status: string | null | undefined) =>
  status === "pass"
    ? TRADE_IDENTIFIER_TONES.positive
    : status === "fail"
      ? TRADE_IDENTIFIER_TONES.negative
      : TRADE_IDENTIFIER_TONES.neutral;

export const getTradeDrawdownMode = (): "pips" | "percent" | "usd" => {
  if (typeof window === "undefined") return "pips";
  try {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("dd") || "pips";
    return mode as "pips" | "percent" | "usd";
  } catch {
    return "pips";
  }
};

export const formatTradePipValue = (pips: number, row?: TradeRow): string => {
  const mode = getTradeDrawdownMode();

  if (mode === "percent") {
    if (row?.entryBalance && row.entryBalance > 0) {
      const pipValue = pips * (row.volume || 0) * 10;
      const percent = (pipValue / row.entryBalance) * 100;
      return `${formatTradeTableNumber(percent, 2)}%`;
    }

    return `${formatTradeTableNumber(pips, 1)}%`;
  }

  if (mode === "usd") {
    const pipValue = pips * (row?.volume || 0) * 10;
    return formatCurrencyValue(pipValue, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return `${formatTradeTableNumber(pips, 1)} pips`;
};

export const getTradeStdvDescriptor = (value: string) => {
  let chipClass: string = TRADE_IDENTIFIER_TONES.neutral;
  let label = "Normal";
  let description = "Average price movement versus your usual trade distribution.";

  if (value.includes("-2")) {
    chipClass = TRADE_IDENTIFIER_TONES.negative;
    label = "Very Low";
    description = "Price barely moved versus your baseline. Very compressed conditions.";
  } else if (value.includes("-1")) {
    chipClass = TRADE_IDENTIFIER_TONES.amber;
    label = "Low";
    description = "Below-average expansion. The trade stayed relatively quiet.";
  } else if (value.includes("+1")) {
    chipClass = TRADE_IDENTIFIER_TONES.warning;
    label = "High";
    description = "Above-average expansion. Volatility was elevated.";
  } else if (value.includes("+2")) {
    chipClass = TRADE_IDENTIFIER_TONES.positive;
    label = "Very High";
    description = "Extreme expansion versus baseline. Conditions were unusually volatile.";
  }

  return {
    chipClass,
    label,
    description,
  };
};

export const formatTradeTablePrice = (value: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 5,
  }).format(value);

export const formatTradeTableDuration = (totalSeconds: number) => {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};
