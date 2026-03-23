"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import {
  TRADE_IDENTIFIER_PILL_CLASS,
  TRADE_IDENTIFIER_TONES,
} from "@/components/trades/trade-identifier-pill";
import { DrawdownCell } from "@/features/trades/table/components/drawdown-cell";
import {
  formatTradeTablePercent,
  getTradeEfficiencyTone,
  getTradeMaxRRTone,
  getTradeRealisedRRTone,
  getTradeStdvDescriptor,
} from "@/features/trades/table/lib/trade-table-formatting";
import {
  EMPTY_TRADE_CELL,
  renderNullableTradeCount,
  renderNullableTradeCurrency,
  renderNullableTradeDuration,
  renderNullableTradeNumber,
  renderNullableTradePercent,
  renderNullableTradePips,
  renderTradeTableInfoHeader,
} from "@/features/trades/table/lib/trade-table-column-shared";
import type {
  TradeRow,
  TradeTableMeta,
} from "@/features/trades/table/lib/trade-table-types";
import { cn } from "@/lib/utils";

export const tradeTableAnalyticsColumns: ColumnDef<TradeRow>[] = [
  {
    accessorKey: "manipulationPips",
    header: () =>
      renderTradeTableInfoHeader("manipulationPips", "Manipulation pips"),
    cell: ({ getValue, row }) =>
      renderNullableTradePips(
        getValue<number | null | undefined>(),
        row.original
      ),
  },
  {
    accessorKey: "mfePips",
    header: () =>
      renderTradeTableInfoHeader(
        "mfePips",
        "Maximum favorable excursion (pips)"
      ),
    cell: ({ getValue, row }) =>
      renderNullableTradePips(
        getValue<number | null | undefined>(),
        row.original
      ),
  },
  {
    accessorKey: "maePips",
    header: () =>
      renderTradeTableInfoHeader("maePips", "Maximum adverse excursion (pips)"),
    cell: ({ getValue, row }) =>
      renderNullableTradePips(
        getValue<number | null | undefined>(),
        row.original
      ),
  },
  {
    accessorKey: "entrySpreadPips",
    header: () =>
      renderTradeTableInfoHeader("entrySpreadPips", "Entry spread (pips)"),
    cell: ({ getValue, row }) =>
      renderNullableTradePips(
        getValue<number | null | undefined>(),
        row.original
      ),
  },
  {
    accessorKey: "exitSpreadPips",
    header: () =>
      renderTradeTableInfoHeader("exitSpreadPips", "Exit spread (pips)"),
    cell: ({ getValue, row }) =>
      renderNullableTradePips(
        getValue<number | null | undefined>(),
        row.original
      ),
  },
  {
    accessorKey: "entrySlippagePips",
    header: () =>
      renderTradeTableInfoHeader("entrySlippagePips", "Entry slippage (pips)"),
    cell: ({ getValue, row }) =>
      renderNullableTradePips(
        getValue<number | null | undefined>(),
        row.original
      ),
  },
  {
    accessorKey: "exitSlippagePips",
    header: () =>
      renderTradeTableInfoHeader("exitSlippagePips", "Exit slippage (pips)"),
    cell: ({ getValue, row }) =>
      renderNullableTradePips(
        getValue<number | null | undefined>(),
        row.original
      ),
  },
  {
    accessorKey: "slModCount",
    header: () =>
      renderTradeTableInfoHeader("slModCount", "Stop loss modifications"),
    cell: ({ getValue }) =>
      renderNullableTradeCount(getValue<number | null | undefined>()),
  },
  {
    accessorKey: "tpModCount",
    header: () =>
      renderTradeTableInfoHeader("tpModCount", "Take profit modifications"),
    cell: ({ getValue }) =>
      renderNullableTradeCount(getValue<number | null | undefined>()),
  },
  {
    accessorKey: "partialCloseCount",
    header: () =>
      renderTradeTableInfoHeader("partialCloseCount", "Partial closes"),
    cell: ({ getValue }) =>
      renderNullableTradeCount(getValue<number | null | undefined>()),
  },
  {
    accessorKey: "exitDealCount",
    header: () => renderTradeTableInfoHeader("exitDealCount", "Exit deals"),
    cell: ({ getValue }) =>
      renderNullableTradeCount(getValue<number | null | undefined>()),
  },
  {
    accessorKey: "exitVolume",
    header: () => renderTradeTableInfoHeader("exitVolume", "Exit volume"),
    cell: ({ getValue }) =>
      renderNullableTradeNumber(getValue<number | null | undefined>(), 2),
  },
  {
    accessorKey: "entryBalance",
    header: () => renderTradeTableInfoHeader("entryBalance", "Entry balance"),
    cell: ({ getValue }) =>
      renderNullableTradeCurrency(getValue<number | null | undefined>(), 2),
  },
  {
    accessorKey: "entryEquity",
    header: () => renderTradeTableInfoHeader("entryEquity", "Entry equity"),
    cell: ({ getValue }) =>
      renderNullableTradeCurrency(getValue<number | null | undefined>(), 2),
  },
  {
    accessorKey: "entryMargin",
    header: () => renderTradeTableInfoHeader("entryMargin", "Entry margin"),
    cell: ({ getValue }) =>
      renderNullableTradeCurrency(getValue<number | null | undefined>(), 2),
  },
  {
    accessorKey: "entryFreeMargin",
    header: () =>
      renderTradeTableInfoHeader("entryFreeMargin", "Entry free margin"),
    cell: ({ getValue }) =>
      renderNullableTradeCurrency(getValue<number | null | undefined>(), 2),
  },
  {
    accessorKey: "entryMarginLevel",
    header: () =>
      renderTradeTableInfoHeader("entryMarginLevel", "Entry margin level"),
    cell: ({ getValue }) =>
      renderNullableTradePercent(getValue<number | null | undefined>(), 2),
  },
  {
    accessorKey: "entryDealCount",
    header: () => renderTradeTableInfoHeader("entryDealCount", "Entry deals"),
    cell: ({ getValue }) =>
      renderNullableTradeCount(getValue<number | null | undefined>()),
  },
  {
    accessorKey: "entryVolume",
    header: () => renderTradeTableInfoHeader("entryVolume", "Entry volume"),
    cell: ({ getValue }) =>
      renderNullableTradeNumber(getValue<number | null | undefined>(), 2),
  },
  {
    accessorKey: "scaleInCount",
    header: () => renderTradeTableInfoHeader("scaleInCount", "Scale in"),
    cell: ({ getValue }) =>
      renderNullableTradeCount(getValue<number | null | undefined>()),
  },
  {
    accessorKey: "scaleOutCount",
    header: () => renderTradeTableInfoHeader("scaleOutCount", "Scale out"),
    cell: ({ getValue }) =>
      renderNullableTradeCount(getValue<number | null | undefined>()),
  },
  {
    accessorKey: "trailingStopDetected",
    header: () =>
      renderTradeTableInfoHeader("trailingStopDetected", "Trailing stop"),
    cell: ({ getValue }) => {
      const value = getValue<boolean | null | undefined>();
      if (value == null) return EMPTY_TRADE_CELL;
      return (
        <span className={value ? "text-teal-400" : "text-white/40"}>
          {value ? "Yes" : "No"}
        </span>
      );
    },
  },
  {
    accessorKey: "entryPeakDurationSeconds",
    header: () =>
      renderTradeTableInfoHeader("entryPeakDurationSeconds", "Time to peak"),
    cell: ({ getValue }) =>
      renderNullableTradeDuration(getValue<number | null | undefined>()),
  },
  {
    accessorKey: "postExitPeakDurationSeconds",
    header: () =>
      renderTradeTableInfoHeader("postExitPeakDurationSeconds", "Time to PE"),
    cell: ({ getValue }) =>
      renderNullableTradeDuration(getValue<number | null | undefined>()),
  },
  {
    accessorKey: "mpeManipLegR",
    header: () =>
      renderTradeTableInfoHeader(
        "mpeManipLegR",
        "Maximum price excursion manipulation leg (risk units)"
      ),
    cell: ({ getValue }) => {
      const value = getValue<number | null | undefined>();
      if (value == null) return EMPTY_TRADE_CELL;
      return <span className="text-white/70">{value.toFixed(2)}R</span>;
    },
  },
  {
    accessorKey: "mpeManipPE_R",
    header: () =>
      renderTradeTableInfoHeader(
        "mpeManipPE_R",
        "Maximum price excursion manipulation post exit (risk units)"
      ),
    cell: ({ getValue }) => {
      const value = getValue<number | null | undefined>();
      if (value == null) return EMPTY_TRADE_CELL;
      return <span className="text-white/70">{value.toFixed(2)}R</span>;
    },
  },
  {
    accessorKey: "maxRR",
    header: () => renderTradeTableInfoHeader("maxRR", "Maximum reward to risk"),
    cell: ({ getValue }) => {
      const value = getValue<number | null | undefined>();
      if (value == null) return EMPTY_TRADE_CELL;
      return (
        <span
          className={cn(TRADE_IDENTIFIER_PILL_CLASS, getTradeMaxRRTone(value))}
        >
          {value.toFixed(2)}R
        </span>
      );
    },
  },
  {
    accessorKey: "realisedRR",
    header: () =>
      renderTradeTableInfoHeader("realisedRR", "Realised reward to risk"),
    cell: ({ getValue }) => {
      const value = getValue<number | null | undefined>();
      if (value == null) return EMPTY_TRADE_CELL;
      return (
        <span
          className={cn(
            TRADE_IDENTIFIER_PILL_CLASS,
            getTradeRealisedRRTone(value)
          )}
        >
          {value > 0 ? "+" : ""}
          {value.toFixed(2)}R
        </span>
      );
    },
  },
  {
    accessorKey: "rrCaptureEfficiency",
    header: () =>
      renderTradeTableInfoHeader(
        "rrCaptureEfficiency",
        "Reward to risk capture efficiency (percent)"
      ),
    cell: ({ getValue }) => {
      const value = getValue<number | null | undefined>();
      if (value == null) return EMPTY_TRADE_CELL;
      const pct = Math.round(value);
      return (
        <span
          className={cn(
            TRADE_IDENTIFIER_PILL_CLASS,
            getTradeEfficiencyTone(pct, 75, 50, 25)
          )}
        >
          {formatTradeTablePercent(pct, 0)}
        </span>
      );
    },
  },
  {
    accessorKey: "manipRREfficiency",
    header: () =>
      renderTradeTableInfoHeader(
        "manipRREfficiency",
        "Manipulation reward to risk efficiency (percent)"
      ),
    cell: ({ getValue }) => {
      const value = getValue<number | null | undefined>();
      if (value == null) return EMPTY_TRADE_CELL;
      const pct = Math.round(value);
      return (
        <span
          className={cn(
            TRADE_IDENTIFIER_PILL_CLASS,
            getTradeEfficiencyTone(pct, 100, 75, 50)
          )}
        >
          {formatTradeTablePercent(pct, 0)}
        </span>
      );
    },
  },
  {
    accessorKey: "rawSTDV",
    header: () =>
      renderTradeTableInfoHeader("rawSTDV", "Raw standard deviation"),
    cell: ({ getValue }) =>
      renderNullableTradeNumber(getValue<number | null | undefined>(), 2),
  },
  {
    accessorKey: "rawSTDV_PE",
    header: () =>
      renderTradeTableInfoHeader(
        "rawSTDV_PE",
        "Raw standard deviation post exit"
      ),
    cell: ({ getValue }) =>
      renderNullableTradeNumber(getValue<number | null | undefined>(), 2),
  },
  {
    accessorKey: "stdvBucket",
    header: () => renderTradeTableInfoHeader("stdvBucket", "Volatility"),
    cell: ({ getValue }) => {
      const value = getValue<string | null | undefined>();
      if (!value) return EMPTY_TRADE_CELL;

      const { chipClass, label, description } = getTradeStdvDescriptor(value);

      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                TRADE_IDENTIFIER_PILL_CLASS,
                "cursor-help",
                chipClass
              )}
            >
              <span className="opacity-60">{value}</span>
              <span>{label}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent
            sideOffset={6}
            className="w-max max-w-[360px] px-0 py-3"
          >
            <div className="flex min-w-[280px] max-w-[360px] flex-col">
              <div className="flex items-center justify-between px-3 text-[11px] text-white/60">
                <span>Volatility</span>
                <span>{value}</span>
              </div>
              <Separator className="mt-2 w-full" />
              <div className="flex flex-col gap-2 px-3 pt-2">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      TRADE_IDENTIFIER_PILL_CLASS,
                      "min-h-0 px-1.5 py-0 text-[10px]",
                      chipClass
                    )}
                  >
                    {label}
                  </span>
                  <span className="text-[11px] text-white/70">
                    {description}
                  </span>
                </div>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] text-white/50">
                  <span>Bucket</span>
                  <span className="text-white/80">{value}</span>
                  <span>Interpretation</span>
                  <span className="text-white/80">{label} volatility</span>
                </div>
                <div className="text-[11px] text-white/50">
                  Standard deviation compares this trade&apos;s available range
                  against your normal distribution of trades.
                </div>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      );
    },
  },
  {
    accessorKey: "estimatedWeightedMPE_R",
    header: () =>
      renderTradeTableInfoHeader(
        "estimatedWeightedMPE_R",
        "Estimated weighted maximum price excursion (risk units)"
      ),
    cell: ({ getValue, table }) => {
      const value = getValue<number | null | undefined>();
      const meta = (table.options.meta as TradeTableMeta | undefined) ?? {};
      const totalTrades = meta.totalTradesCount ?? 0;
      const disableSampleGating = meta.disableSampleGating;
      const minRequired = 100;

      if (value != null) {
        return (
          <span
            className={cn(
              TRADE_IDENTIFIER_PILL_CLASS,
              TRADE_IDENTIFIER_TONES.info
            )}
          >
            {value.toFixed(2)}R
          </span>
        );
      }

      if (disableSampleGating === undefined) {
        return <span className="text-xs text-white/40">...</span>;
      }

      if (disableSampleGating === true) {
        return (
          <span
            className="text-xs text-white/40"
            title="No data available for this trade (missing manipulation or post-exit data)"
          >
            —
          </span>
        );
      }

      return (
        <span
          className={cn(
            TRADE_IDENTIFIER_PILL_CLASS,
            TRADE_IDENTIFIER_TONES.subdued,
            "text-[10px]"
          )}
          title={`Requires minimum ${minRequired} trades for statistical reliability. Current account has ${totalTrades} trades. Enable in Settings to override.`}
        >
          {totalTrades}/{minRequired}
        </span>
      );
    },
  },
  {
    accessorKey: "plannedRR",
    header: () =>
      renderTradeTableInfoHeader("plannedRR", "Planned reward to risk"),
    cell: ({ getValue }) => {
      const value = getValue<number | null | undefined>();
      if (value == null) return EMPTY_TRADE_CELL;
      return <span className="text-white/70">{value.toFixed(2)}R</span>;
    },
  },
  {
    accessorKey: "plannedRiskPips",
    header: () =>
      renderTradeTableInfoHeader("plannedRiskPips", "Planned risk (pips)"),
    cell: ({ getValue, row }) =>
      renderNullableTradePips(
        getValue<number | null | undefined>(),
        row.original
      ),
  },
  {
    accessorKey: "plannedTargetPips",
    header: () =>
      renderTradeTableInfoHeader("plannedTargetPips", "Planned target (pips)"),
    cell: ({ getValue, row }) =>
      renderNullableTradePips(
        getValue<number | null | undefined>(),
        row.original
      ),
  },
  {
    accessorKey: "exitEfficiency",
    header: () =>
      renderTradeTableInfoHeader("exitEfficiency", "Exit efficiency"),
    cell: ({ getValue }) => {
      const value = getValue<number | null | undefined>();
      if (value == null) return EMPTY_TRADE_CELL;
      const percentage = Math.round(value);
      const colorClass =
        percentage >= 80
          ? "text-teal-400"
          : percentage >= 50
          ? "text-yellow-400"
          : "text-orange-400";
      return (
        <span className={colorClass}>
          {formatTradeTablePercent(percentage, 0)}
        </span>
      );
    },
  },
  {
    accessorKey: "drawdown",
    header: () => renderTradeTableInfoHeader("drawdown", "Max drawdown"),
    cell: ({ row, table }) => {
      const meta = (table.options.meta as TradeTableMeta | undefined) ?? {};

      return (
        <DrawdownCell
          rowIndex={row.index}
          drawdown={meta.drawdownByTradeId?.[row.original.id]}
          isLoading={meta.drawdownLoading}
        />
      );
    },
  },
];
