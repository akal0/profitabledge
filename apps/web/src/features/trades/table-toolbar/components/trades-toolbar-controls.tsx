"use client";

import * as React from "react";
import { ChevronDown, Funnel, Rows3 } from "lucide-react";
import type { Table } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  getTradePnlModeDescription,
  getTradeRiskUnit,
} from "@/features/trades/table/lib/trade-table-pnl-display";
import {
  TRADE_TABLE_GROUP_OPTIONS,
  type TradeTableGroupBy,
} from "@/features/trades/table/lib/trade-table-grouping";
import type { TradePnlDisplayMode } from "@/features/trades/table/lib/trade-table-types";

import {
  columnGroups,
  columnLabels,
  columnTooltips,
  formatColumnLabel,
} from "../lib/trades-toolbar-column-config";
import { tradesToolbarStyles } from "../lib/trades-toolbar-styles";

const QUICK_SORTS = [
  { label: "Latest open", value: "open:desc" },
  { label: "Earliest open", value: "open:asc" },
  { label: "Highest profit and loss", value: "profit:desc" },
  { label: "Lowest profit and loss", value: "profit:asc" },
  { label: "Highest volume", value: "volume:desc" },
  { label: "Shortest hold", value: "holdSeconds:asc" },
  { label: "Longest hold", value: "holdSeconds:desc" },
] as const;

const SORTABLE_COLUMNS = [
  { id: "open", label: "Open" },
  { id: "close", label: "Close" },
  { id: "holdSeconds", label: "Hold time" },
  { id: "symbol", label: "Symbol" },
  { id: "tradeDirection", label: "Direction" },
  { id: "volume", label: "Volume" },
  { id: "profit", label: "Profit and loss" },
  { id: "commissions", label: "Commissions" },
  { id: "swap", label: "Swap" },
] as const;

type SegmentedModeOption<TValue extends string> = {
  value: TValue;
  label: string;
  disabled?: boolean;
  tooltip?: string;
};

function getTradesPnlModeTooltip(
  mode: TradePnlDisplayMode,
  baselineInitialBalance?: number | string | null
) {
  if (mode === "rr") {
    return `${getTradePnlModeDescription(
      baselineInitialBalance
    )} Affects P&L columns, grouped P&L totals, and the summary bar.`;
  }

  return "Shows P&L values in currency. Affects P&L columns, grouped P&L totals, and the summary bar.";
}

function getTradesDrawdownModeTooltip(mode: "pips" | "percent" | "usd") {
  switch (mode) {
    case "pips":
      return "Shows max drawdown in pips. Affects the drawdown column in the trades table.";
    case "usd":
      return "Shows max drawdown in currency. Affects the drawdown column in the trades table.";
    default:
      return "Shows max drawdown as a percentage. Affects the drawdown column in the trades table.";
  }
}

function SegmentedModeControl<TValue extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value?: TValue;
  options: SegmentedModeOption<TValue>[];
  onChange?: (next: TValue) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-sm bg-muted/25 p-[3px] ring ring-white/5">
      {options.map((option) => {
        const button = (
          <Button
            key={option.value}
            type="button"
            disabled={option.disabled}
            className={cn(
              "flex h-max cursor-pointer items-center justify-center rounded-sm px-3 py-2 text-xs transition-all duration-250 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40",
              value === option.value
                ? "bg-[#222225] text-white hover:bg-[#222225] hover:!brightness-120 ring ring-white/5"
                : "bg-[#222225]/25 text-white/25 hover:bg-[#222225] hover:!brightness-105 hover:text-white ring-0"
            )}
            onClick={() => onChange?.(option.value)}
          >
            {option.label}
          </Button>
        );

        if (!option.tooltip) {
          return button;
        }

        return (
          <Tooltip key={option.value}>
            <TooltipTrigger asChild>
              <span>{button}</span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              {option.tooltip}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

export function TradesToolbarSortControls({
  sortBadge,
  onSortChange,
  onClearSort,
}: {
  sortBadge: string;
  onSortChange?: (sortValue: string) => void;
  onClearSort?: () => void;
}) {
  const {
    badgeBaseClass,
    selectMenuContentClass,
    selectMenuSubContentClass,
    selectMenuItemClass,
    filterMenuSectionTitleClass,
    filterMenuMainSeparatorClass,
    filterMenuTriggerClass,
  } = tradesToolbarStyles;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className={badgeBaseClass}>
            Sort by
            <ChevronDown className="size-3.5 text-white/60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className={cn(selectMenuContentClass, "w-[280px]")}
        >
          <div className={filterMenuSectionTitleClass}>Sort by</div>
          <Separator className={filterMenuMainSeparatorClass} />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className={filterMenuTriggerClass}>
              Quick sorts
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent
              className={cn(selectMenuSubContentClass, "w-[220px]")}
            >
              {QUICK_SORTS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  className={selectMenuItemClass}
                  onSelect={() => onSortChange?.(option.value)}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <Separator className={filterMenuMainSeparatorClass} />
          {SORTABLE_COLUMNS.map((column) => (
            <DropdownMenuSub key={column.id}>
              <DropdownMenuSubTrigger className={filterMenuTriggerClass}>
                {column.label}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent
                className={cn(selectMenuSubContentClass, "w-[220px]")}
              >
                <DropdownMenuItem
                  className={selectMenuItemClass}
                  onSelect={() => onSortChange?.(`${column.id}:asc`)}
                >
                  Ascending
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={selectMenuItemClass}
                  onSelect={() => onSortChange?.(`${column.id}:desc`)}
                >
                  Descending
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ))}
          <Separator className={filterMenuMainSeparatorClass} />
          <DropdownMenuItem
            className={selectMenuItemClass}
            onSelect={onClearSort}
          >
            Clear sort
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {sortBadge ? (
        <Button className={badgeBaseClass} onClick={onClearSort}>
          {sortBadge}
          <span className="ml-2">×</span>
        </Button>
      ) : null}
    </>
  );
}

export function TradesToolbarGroupControl({
  groupBy,
  onGroupByChange,
}: {
  groupBy?: TradeTableGroupBy | null;
  onGroupByChange?: (groupBy: TradeTableGroupBy | null) => void;
}) {
  const {
    activeBadgeClass,
    iconBadgeClass,
    selectMenuContentClass,
    selectMenuItemClass,
    filterMenuSectionTitleClass,
    filterMenuMainSeparatorClass,
  } = tradesToolbarStyles;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className={cn(
            "relative",
            iconBadgeClass,
            groupBy && activeBadgeClass
          )}
          aria-label={groupBy ? `Grouped by ${groupBy}` : "Group trades"}
        >
          <Rows3 className="size-4" />
          {groupBy ? (
            <span className="absolute right-2 top-2 size-1.5 rounded-full bg-teal-400" />
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn(selectMenuContentClass, "w-[200px]")}
      >
        <div className={filterMenuSectionTitleClass}>Group by</div>
        <Separator className={filterMenuMainSeparatorClass} />
        {TRADE_TABLE_GROUP_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.key}
            className={cn(
              selectMenuItemClass,
              groupBy === option.key && "bg-sidebar-accent"
            )}
            onSelect={() =>
              onGroupByChange?.(groupBy === option.key ? null : option.key)
            }
          >
            {option.label}
            {groupBy === option.key ? (
              <span className="ml-auto text-teal-400">✓</span>
            ) : null}
          </DropdownMenuItem>
        ))}
        {groupBy ? (
          <>
            <Separator className={filterMenuMainSeparatorClass} />
            <DropdownMenuItem
              className={selectMenuItemClass}
              onSelect={() => onGroupByChange?.(null)}
            >
              Clear grouping
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TradesToolbarDisplayControls({
  pnlMode,
  onPnlModeChange,
  baselineInitialBalance,
  ddMode,
  onDdModeChange,
  table,
  tableId,
}: {
  pnlMode?: TradePnlDisplayMode;
  onPnlModeChange?: (mode: TradePnlDisplayMode) => void;
  baselineInitialBalance?: number | string | null;
  ddMode?: "pips" | "percent" | "usd";
  onDdModeChange?: (mode: "pips" | "percent" | "usd") => void;
  table: Table<any>;
  tableId?: string;
}) {
  const {
    iconBadgeClass,
    selectMenuContentClass,
    selectMenuCheckboxItemClass,
    selectMenuSubContentClass,
    filterMenuSectionTitleClass,
    filterMenuMainSeparatorClass,
    filterMenuTriggerClass,
  } = tradesToolbarStyles;

  const handleToggleColumn = React.useCallback(
    (column: any, checked: boolean) => {
      column.toggleVisibility(checked);
    },
    []
  );

  const columnsById = React.useMemo(
    () =>
      new Map(table.getAllLeafColumns().map((column) => [column.id, column])),
    [table]
  );

  const visibleGroups = React.useMemo(
    () =>
      columnGroups.filter((group) =>
        group.ids.some((id) => {
          const column = columnsById.get(id);
          return column && column.getCanHide();
        })
      ),
    [columnsById]
  );

  const canShowRR = getTradeRiskUnit(baselineInitialBalance) != null;

  return (
    <>
      <SegmentedModeControl
        label="PnL"
        value={pnlMode}
        onChange={onPnlModeChange}
        options={[
          {
            value: "usd",
            label: "$",
            tooltip: getTradesPnlModeTooltip("usd", baselineInitialBalance),
          },
          {
            value: "rr",
            label: "R",
            disabled: !canShowRR,
            tooltip: getTradesPnlModeTooltip("rr", baselineInitialBalance),
          },
        ]}
      />

      <SegmentedModeControl
        label="DD"
        value={ddMode}
        onChange={onDdModeChange}
        options={[
          {
            value: "pips",
            label: "Pips",
            tooltip: getTradesDrawdownModeTooltip("pips"),
          },
          {
            value: "percent",
            label: "%",
            tooltip: getTradesDrawdownModeTooltip("percent"),
          },
          {
            value: "usd",
            label: "$",
            tooltip: getTradesDrawdownModeTooltip("usd"),
          },
        ]}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className={cn(iconBadgeClass, "group")}>
            <Funnel className="size-3.5 text-white/60 group-hover:text-white" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className={cn(selectMenuContentClass, "w-[240px]")}
        >
          <div className={filterMenuSectionTitleClass}>Columns</div>
          <Separator className={filterMenuMainSeparatorClass} />
          {visibleGroups.map((group) => (
            <DropdownMenuSub key={group.label}>
              <DropdownMenuSubTrigger className={filterMenuTriggerClass}>
                {group.label}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent
                className={cn(selectMenuSubContentClass, "w-[240px]")}
              >
                {group.ids
                  .flatMap((id) => {
                    const column = columnsById.get(id);
                    return column && column.getCanHide() ? [column] : [];
                  })
                  .map((column) => {
                    const rawLabel =
                      columnLabels[column.id] ||
                      (typeof column.columnDef.header === "string"
                        ? (column.columnDef.header as string)
                        : column.id);
                    const label = formatColumnLabel(rawLabel);
                    const tooltip =
                      columnTooltips[column.id] || "Column details";

                    return (
                      <Tooltip key={column.id}>
                        <TooltipTrigger asChild>
                          <DropdownMenuCheckboxItem
                            checked={column.getIsVisible()}
                            onCheckedChange={(checked) =>
                              handleToggleColumn(column, Boolean(checked))
                            }
                            onSelect={(event) => event.preventDefault()}
                            className={selectMenuCheckboxItemClass}
                          >
                            {label}
                          </DropdownMenuCheckboxItem>
                        </TooltipTrigger>
                        <TooltipContent
                          side="left"
                          align="center"
                          className="mr-4 max-w-xs"
                        >
                          {tooltip}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                <Separator className={filterMenuMainSeparatorClass} />
                <div className="px-4 py-2 text-[11px] text-white/40">
                  Drag table headers to reorder columns.
                </div>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
