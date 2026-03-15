"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ModelTagCell } from "@/components/model-tag-cell";
import { ProtocolAlignmentCell } from "@/components/protocol-alignment-cell";
import { SessionTagCell } from "@/components/session-tag-cell";
import {
  TRADE_IDENTIFIER_PILL_CLASS,
  TRADE_IDENTIFIER_TONES,
} from "@/components/trades/trade-identifier-pill";
import { formatNumberValue } from "@/lib/trade-formatting";
import { cn } from "@/lib/utils";
import {
  getTradeCommissionTone,
  getTradeProfitTone,
  getTradeSwapTone,
  formatTradeTableDuration,
  withTradeTableHeaderTooltip,
} from "@/features/trades/table/lib/trade-table-formatting";
import { formatTradePnlDisplayValue } from "@/features/trades/table/lib/trade-table-pnl-display";
import {
  EMPTY_TRADE_CELL,
  formatTradeTimestamp,
  renderNullableTradePrice,
} from "@/features/trades/table/lib/trade-table-column-shared";
import {
  EditableTradeDateTimeCell,
  EditableTradeDirectionCell,
  EditableTradeNumberCell,
  EditableTradeTextCell,
  LIVE_TRADE_EDIT_BLOCK_MESSAGE,
} from "@/features/trades/table/components/trade-inline-editors";
import type {
  TradeRow,
  TradeTableMeta,
} from "@/features/trades/table/lib/trade-table-types";

const getTradeTableMeta = (meta: unknown): TradeTableMeta =>
  (meta as TradeTableMeta | undefined) ?? {};

export const tradeTableCoreColumns: ColumnDef<TradeRow>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllRowsSelected() ||
          (table.getIsSomeRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllRowsSelected(!!value)}
        aria-label="Select all"
        className="translate-y-[2px] cursor-pointer rounded-none border-white/5"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        className="translate-y-[2px] cursor-pointer rounded-none border-white/5"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      />
    ),
    enableSorting: false,
    enableHiding: false,
    size: 32,
    minSize: 32,
    maxSize: 56,
  },
  {
    accessorKey: "symbol",
    header: () => withTradeTableHeaderTooltip("symbol", "Symbol"),
    cell: ({ getValue, row, table }) => {
      const updateTrade = getTradeTableMeta(table.options.meta).updateTrade;
      const value = getValue<string>();

      if (!updateTrade) {
        return (
          <span className="font-medium tracking-wide text-white">{value}</span>
        );
      }

      return (
        <EditableTradeTextCell
          value={value}
          displayValue={
            <span className="font-medium tracking-wide text-white">
              {value}
            </span>
          }
          placeholder="Symbol"
          blockedReason={
            row.original.isLive ? LIVE_TRADE_EDIT_BLOCK_MESSAGE : undefined
          }
          onSave={(nextValue) =>
            updateTrade({ tradeId: row.original.id, symbol: nextValue })
          }
        />
      );
    },
  },
  {
    accessorKey: "tradeDirection",
    header: () => withTradeTableHeaderTooltip("tradeDirection", "Direction"),
    cell: ({ getValue, row, table }) => {
      const updateTrade = getTradeTableMeta(table.options.meta).updateTrade;
      const value = getValue<"long" | "short">();

      if (!updateTrade) {
        return value === "long" ? "Long" : "Short";
      }

      return (
        <EditableTradeDirectionCell
          value={value}
          blockedReason={
            row.original.isLive ? LIVE_TRADE_EDIT_BLOCK_MESSAGE : undefined
          }
          onSave={(nextValue) =>
            updateTrade({ tradeId: row.original.id, tradeType: nextValue })
          }
        />
      );
    },
  },
  {
    accessorKey: "sessionTag",
    header: () => withTradeTableHeaderTooltip("sessionTag", "Session"),
    cell: ({ row }) => (
      <SessionTagCell
        tradeId={row.original.id}
        sessionTag={row.original.sessionTag}
        sessionTagColor={row.original.sessionTagColor}
        isLive={row.original.isLive}
      />
    ),
  },
  {
    accessorKey: "modelTag",
    header: () => withTradeTableHeaderTooltip("modelTag", "Model"),
    cell: ({ row }) => (
      <ModelTagCell
        tradeId={row.original.id}
        modelTag={row.original.modelTag}
        modelTagColor={row.original.modelTagColor}
        isLive={row.original.isLive}
      />
    ),
  },
  {
    accessorKey: "protocolAlignment",
    header: () => withTradeTableHeaderTooltip("protocolAlignment", "Protocol"),
    cell: ({ row }) => (
      <ProtocolAlignmentCell
        tradeId={row.original.id}
        protocolAlignment={row.original.protocolAlignment}
        isLive={row.original.isLive}
      />
    ),
  },
  {
    accessorKey: "outcome",
    header: () => withTradeTableHeaderTooltip("outcome", "Outcome"),
    cell: ({ getValue, row }) => {
      const trade = row.original;
      if (trade.isLive) {
        return (
          <span
            className={cn(
              TRADE_IDENTIFIER_PILL_CLASS,
              TRADE_IDENTIFIER_TONES.live,
              "gap-2"
            )}
          >
            <span className="size-1.5 rounded-full bg-teal-400 shadow-[0_0_8px_2px_rgba(45,212,191,0.4)]" />
            Live
          </span>
        );
      }

      const value = getValue<"Win" | "Loss" | "BE" | "PW" | undefined>();
      if (!value) return EMPTY_TRADE_CELL;

      let chipClass: string = TRADE_IDENTIFIER_TONES.neutral;
      let label: string = value;

      if (value === "Win") chipClass = TRADE_IDENTIFIER_TONES.positive;
      if (value === "Loss") chipClass = TRADE_IDENTIFIER_TONES.negative;
      if (value === "BE") label = "Breakeven";
      if (value === "PW") {
        chipClass = TRADE_IDENTIFIER_TONES.warning;
        label = "Partial win";
      }

      return (
        <span className={cn(TRADE_IDENTIFIER_PILL_CLASS, chipClass)}>
          {label}
        </span>
      );
    },
  },
  {
    accessorKey: "complianceStatus",
    header: () => withTradeTableHeaderTooltip("complianceStatus", "Compliance"),
    cell: ({ row }) => {
      const status = row.original.complianceStatus || "unknown";
      const flags = row.original.complianceFlags || [];
      let chipClass: string = TRADE_IDENTIFIER_TONES.neutral;
      let label = "Unknown";

      if (status === "pass") {
        chipClass = TRADE_IDENTIFIER_TONES.positive;
        label = "Pass";
      } else if (status === "fail") {
        chipClass = TRADE_IDENTIFIER_TONES.negative;
        label = "Flagged";
      }

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
              {label}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {flags.length > 0 ? flags.join(", ") : "No compliance flags."}
          </TooltipContent>
        </Tooltip>
      );
    },
  },
  {
    id: "streak",
    header: () => withTradeTableHeaderTooltip("streak", "Streak"),
    cell: ({ row, table }) => {
      const streakEntry = getTradeTableMeta(table.options.meta)
        .streakByTradeId?.[row.original.id];
      if (!streakEntry || streakEntry.count < 2) {
        return <span className="text-white/25">—</span>;
      }

      const isWin = streakEntry.type === "win";
      const streak = streakEntry.count;

      return (
        <span
          className={cn(
            TRADE_IDENTIFIER_PILL_CLASS,
            "min-h-6 px-2 py-0.5 text-[10px] font-semibold",
            isWin
              ? streak >= 4
                ? "ring-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                : TRADE_IDENTIFIER_TONES.positive
              : streak >= 4
              ? "ring-red-400/50 bg-red-400/10 text-red-300"
              : TRADE_IDENTIFIER_TONES.negative
          )}
        >
          {isWin ? "W" : "L"}
          {streak}
          {streak >= 4 && (isWin ? " 🔥" : " ⚠️")}
        </span>
      );
    },
  },
  {
    accessorKey: "tp",
    header: () => withTradeTableHeaderTooltip("tp", "Take profit"),
    cell: ({ row, table }) => {
      const updateTrade = getTradeTableMeta(table.options.meta).updateTrade;

      if (!updateTrade) {
        return renderNullableTradePrice(row.original.tp);
      }

      return (
        <EditableTradeNumberCell
          value={row.original.tp}
          displayValue={renderNullableTradePrice(row.original.tp)}
          placeholder="Take profit"
          nullable
          blockedReason={
            row.original.isLive ? LIVE_TRADE_EDIT_BLOCK_MESSAGE : undefined
          }
          onSave={(nextValue) =>
            updateTrade({ tradeId: row.original.id, tp: nextValue })
          }
        />
      );
    },
  },
  {
    accessorKey: "sl",
    header: () => withTradeTableHeaderTooltip("sl", "Stop loss"),
    cell: ({ row, table }) => {
      const updateTrade = getTradeTableMeta(table.options.meta).updateTrade;

      if (!updateTrade) {
        return renderNullableTradePrice(row.original.sl);
      }

      return (
        <EditableTradeNumberCell
          value={row.original.sl}
          displayValue={renderNullableTradePrice(row.original.sl)}
          placeholder="Stop loss"
          nullable
          blockedReason={
            row.original.isLive ? LIVE_TRADE_EDIT_BLOCK_MESSAGE : undefined
          }
          onSave={(nextValue) =>
            updateTrade({ tradeId: row.original.id, sl: nextValue })
          }
        />
      );
    },
  },
  {
    accessorKey: "open",
    header: () => withTradeTableHeaderTooltip("open", "Open"),
    cell: ({ getValue, row, table }) => {
      const updateTrade = getTradeTableMeta(table.options.meta).updateTrade;
      const value = getValue<string>();
      const displayValue = (
        <p className="font-medium tracking-wide text-white">
          {row.original.openText
            ? row.original.openText
            : formatTradeTimestamp(value)}
        </p>
      );

      if (!updateTrade) {
        return displayValue;
      }

      return (
        <EditableTradeDateTimeCell
          value={value}
          displayValue={displayValue}
          blockedReason={
            row.original.isLive ? LIVE_TRADE_EDIT_BLOCK_MESSAGE : undefined
          }
          onSave={(nextValue) =>
            updateTrade({ tradeId: row.original.id, openTime: nextValue })
          }
        />
      );
    },
  },
  {
    accessorKey: "close",
    header: () => withTradeTableHeaderTooltip("close", "Close"),
    cell: ({ getValue, row, table }) => {
      const updateTrade = getTradeTableMeta(table.options.meta).updateTrade;
      const value = getValue<string>();
      const displayValue = (
        <p className="font-medium tracking-wide text-white">
          {row.original.closeText
            ? row.original.closeText
            : formatTradeTimestamp(value)}
        </p>
      );

      if (!updateTrade) {
        return displayValue;
      }

      return (
        <EditableTradeDateTimeCell
          value={value}
          displayValue={displayValue}
          blockedReason={
            row.original.isLive ? LIVE_TRADE_EDIT_BLOCK_MESSAGE : undefined
          }
          onSave={(nextValue) =>
            updateTrade({ tradeId: row.original.id, closeTime: nextValue })
          }
        />
      );
    },
  },
  {
    accessorKey: "holdSeconds",
    header: () => withTradeTableHeaderTooltip("holdSeconds", "Hold time"),
    cell: ({ getValue }) => (
      <span className="text-white/80">
        {formatTradeTableDuration(Number(getValue<number>() || 0))}
      </span>
    ),
  },
  {
    accessorKey: "volume",
    header: () => withTradeTableHeaderTooltip("volume", "Volume"),
    cell: ({ getValue, row, table }) => {
      const updateTrade = getTradeTableMeta(table.options.meta).updateTrade;
      const value = Number(getValue<number>() || 0);
      const displayValue = (
        <span className="font-medium tracking-wide text-white">
          {formatNumberValue(value, {
            maximumFractionDigits: 2,
          })}
        </span>
      );

      if (!updateTrade) {
        return displayValue;
      }

      return (
        <EditableTradeNumberCell
          value={value}
          displayValue={displayValue}
          placeholder="Volume"
          blockedReason={
            row.original.isLive ? LIVE_TRADE_EDIT_BLOCK_MESSAGE : undefined
          }
          onSave={(nextValue) =>
            updateTrade({ tradeId: row.original.id, volume: nextValue ?? 0 })
          }
        />
      );
    },
  },
  {
    accessorKey: "profit",
    header: () => withTradeTableHeaderTooltip("profit", "Profit and loss"),
    cell: ({ getValue, row, table }) => {
      const value = Number(getValue<number>() || 0);
      const { pnlMode, baselineInitialBalance, updateTrade } =
        getTradeTableMeta(table.options.meta);
      const displayValue = (
        <span
          className={cn(TRADE_IDENTIFIER_PILL_CLASS, getTradeProfitTone(value))}
        >
          {formatTradePnlDisplayValue(value, {
            mode: pnlMode,
            initialBalance: baselineInitialBalance,
            currencyOptions: { maximumFractionDigits: 2 },
          })}
        </span>
      );

      if (!updateTrade) {
        return displayValue;
      }

      return (
        <EditableTradeNumberCell
          value={value}
          displayValue={displayValue}
          placeholder="Profit"
          blockedReason={
            row.original.isLive ? LIVE_TRADE_EDIT_BLOCK_MESSAGE : undefined
          }
          onSave={(nextValue) =>
            updateTrade({ tradeId: row.original.id, profit: nextValue ?? 0 })
          }
        />
      );
    },
  },
  {
    accessorKey: "commissions",
    header: () => withTradeTableHeaderTooltip("commissions", "Commissions"),
    cell: ({ getValue, row, table }) => {
      const value = Number(getValue<number>() || 0);
      const { pnlMode, baselineInitialBalance, updateTrade } =
        getTradeTableMeta(table.options.meta);
      const displayValue = (
        <span
          className={cn(
            TRADE_IDENTIFIER_PILL_CLASS,
            getTradeCommissionTone(value)
          )}
        >
          {formatTradePnlDisplayValue(value, {
            mode: pnlMode,
            initialBalance: baselineInitialBalance,
            currencyOptions: { maximumFractionDigits: 2 },
          })}
        </span>
      );

      if (!updateTrade) {
        return displayValue;
      }

      return (
        <EditableTradeNumberCell
          value={value}
          displayValue={displayValue}
          placeholder="Commissions"
          blockedReason={
            row.original.isLive ? LIVE_TRADE_EDIT_BLOCK_MESSAGE : undefined
          }
          onSave={(nextValue) =>
            updateTrade({
              tradeId: row.original.id,
              commissions: nextValue ?? 0,
            })
          }
        />
      );
    },
  },
  {
    accessorKey: "swap",
    header: () => withTradeTableHeaderTooltip("swap", "Swap"),
    cell: ({ getValue, row, table }) => {
      const value = Number(getValue<number>() || 0);
      const { pnlMode, baselineInitialBalance, updateTrade } =
        getTradeTableMeta(table.options.meta);
      const displayValue = (
        <span
          className={cn(TRADE_IDENTIFIER_PILL_CLASS, getTradeSwapTone(value))}
        >
          {formatTradePnlDisplayValue(value, {
            mode: pnlMode,
            initialBalance: baselineInitialBalance,
            currencyOptions: { maximumFractionDigits: 2 },
          })}
        </span>
      );

      if (!updateTrade) {
        return displayValue;
      }

      return (
        <EditableTradeNumberCell
          value={value}
          displayValue={displayValue}
          placeholder="Swap"
          blockedReason={
            row.original.isLive ? LIVE_TRADE_EDIT_BLOCK_MESSAGE : undefined
          }
          onSave={(nextValue) =>
            updateTrade({ tradeId: row.original.id, swap: nextValue ?? 0 })
          }
        />
      );
    },
  },
];
