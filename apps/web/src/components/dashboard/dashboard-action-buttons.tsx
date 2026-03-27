"use client";

import type { RefObject } from "react";
import { ChevronDown, Download } from "lucide-react";
import { toast } from "sonner";

import EditWidgets from "@/public/icons/edit-widgets.svg";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { WidgetPresets } from "./widget-presets";
import { exportWidgetsAsJson, exportWidgetsAsCsv } from "./widget-export";
import { exportWidgetsAsCombinedPng } from "@/features/dashboard/widgets/lib/widget-share";
import type { WidgetType } from "./widgets";
import type { WidgetValueMode } from "@/features/dashboard/widgets/lib/widget-shared";

export type DashboardAccountAction = {
  type: "timestamp";
  timestampLabel: "Last updated";
  timestamp?: string | Date | null;
};

type Props = {
  isEditing?: boolean;
  onToggleEdit?: () => void;
  valueMode?: WidgetValueMode;
  onValueModeChange?: (mode: WidgetValueMode) => void;
  currencyLabel?: string;
  currencyOptions?: string[];
  onCurrencyCodeChange?: (currencyCode: string) => void;
  accountAction?: DashboardAccountAction | null;
  widgets?: WidgetType[];
  widgetSpans?: Partial<Record<WidgetType, number>>;
  widgetsExportTargetRef?: RefObject<HTMLElement | null>;
  calendarExportTargetRef?: RefObject<HTMLElement | null>;
  chartWidgetsExportTargetRef?: RefObject<HTMLElement | null>;
  leadingActions?: React.ReactNode;
  onApplyPreset?: (
    widgets: WidgetType[],
    spans: Partial<Record<WidgetType, number>>
  ) => void;
};

const DashboardActionButtons: React.FC<Props> = ({
  isEditing = false,
  onToggleEdit,
  valueMode = "usd",
  onValueModeChange,
  currencyLabel = "Currency",
  currencyOptions = [],
  onCurrencyCodeChange,
  accountAction = null,
  widgets = [],
  widgetSpans = {},
  widgetsExportTargetRef,
  calendarExportTargetRef,
  chartWidgetsExportTargetRef,
  leadingActions,
  onApplyPreset,
}) => {
  const formatDate = (value: string | Date | null | undefined) => {
    if (!value) return "Never";
    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return String(value);
    const day = date.getDate();
    const suffix = (n: number) => {
      const j = n % 10,
        k = n % 100;
      if (j === 1 && k !== 11) return "st";
      if (j === 2 && k !== 12) return "nd";
      if (j === 3 && k !== 13) return "rd";
      return "th";
    };
    const month = date.toLocaleString("en-US", { month: "long" });
    const year = date.getFullYear();
    return `${day}${suffix(day)} ${month}, ${year}`;
  };
  const formattedAccountTimestamp = formatDate(accountAction?.timestamp);

  const handleExport = (format: "json" | "csv", fileName?: string) => {
    if (format === "json") {
      exportWidgetsAsJson(widgets, widgetSpans, fileName);
    } else {
      exportWidgetsAsCsv(widgets, widgetSpans, fileName);
    }
  };
  const hasCurrencySelector =
    currencyOptions.length > 1 && !!onCurrencyCodeChange;
  const shareOptions = [
    {
      key: "all-widgets",
      label: "All widgets",
      title: "dashboard-all-widgets",
      minimumNodes: 3,
      getNodes: () =>
        [
          widgetsExportTargetRef?.current,
          calendarExportTargetRef?.current,
          chartWidgetsExportTargetRef?.current,
        ].filter(Boolean) as HTMLElement[],
    },
    {
      key: "widgets-only",
      label: "Widget only",
      title: "dashboard-widgets",
      minimumNodes: 1,
      getNodes: () => [widgetsExportTargetRef?.current].filter(Boolean) as HTMLElement[],
    },
    {
      key: "widgets-calendar",
      label: "Widgets + calendar",
      title: "dashboard-widgets-calendar",
      minimumNodes: 2,
      getNodes: () =>
        [widgetsExportTargetRef?.current, calendarExportTargetRef?.current].filter(
          Boolean
        ) as HTMLElement[],
    },
    {
      key: "widgets-chart-widgets",
      label: "Widgets + chart widgets",
      title: "dashboard-widgets-chart-widgets",
      minimumNodes: 2,
      getNodes: () =>
        [
          widgetsExportTargetRef?.current,
          chartWidgetsExportTargetRef?.current,
        ].filter(Boolean) as HTMLElement[],
    },
    {
      key: "calendar-chart-widgets",
      label: "Calendar + chart widgets",
      title: "dashboard-calendar-chart-widgets",
      minimumNodes: 2,
      getNodes: () =>
        [calendarExportTargetRef?.current, chartWidgetsExportTargetRef?.current].filter(
          Boolean
        ) as HTMLElement[],
    },
  ] as const;
  const modeButtonClassName = (isActive: boolean) =>
    cn(
      "cursor-pointer flex transform items-center justify-center gap-2 rounded-md py-2 h-max transition-all active:scale-95 w-max text-xs duration-250",
      isActive
        ? "bg-[#222225] text-white hover:bg-[#222225] hover:!brightness-120 ring ring-white/5"
        : "bg-[#222225]/25 text-white/25 hover:bg-[#222225] hover:!brightness-105 hover:text-white ring-0"
    );

  const controlButtonClassName =
    "cursor-pointer flex items-center justify-center py-2 h-[38px] transition-all active:scale-95 text-white w-max text-xs hover:brightness-110 duration-250 ring ring-white/5 bg-sidebar rounded-md hover:bg-sidebar-accent px-3";

  const handleShare = async (title: string, nodes: HTMLElement[]) => {
    if (nodes.length === 0) {
      toast.error("Nothing to share yet");
      return;
    }

    try {
      await exportWidgetsAsCombinedPng({ nodes, title });
      toast.success("Dashboard PNG downloaded");
    } catch (error) {
      console.error(error);
      toast.error("Failed to export dashboard PNG");
    }
  };

  return (
    <div className="flex gap-2 items-center">
      <div className="bg-white w-max h-max flex items-center gap-1 p-[3px] dark:bg-muted/15 rounded-md ring ring-white/5">
        {hasCurrencySelector ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                onClick={() => onValueModeChange?.("usd")}
                className={modeButtonClassName(valueMode === "usd")}
              >
                <span className="px-2">{currencyLabel}</span>
                <ChevronDown className="size-3.5 -ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-44 rounded-md bg-sidebar ring-white/5 p-1 text-white"
            >
              <DropdownMenuLabel className="px-3 py-2 text-xs font-normal text-white/40">
                Preferred currency
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuRadioGroup
                value={currencyLabel}
                onValueChange={(value) => {
                  onCurrencyCodeChange?.(value);
                  onValueModeChange?.("usd");
                }}
              >
                {currencyOptions.map((currencyCode) => (
                  <DropdownMenuRadioItem
                    key={currencyCode}
                    value={currencyCode}
                    className="rounded-sm px-3 py-2 text-xs text-white/80 focus:bg-sidebar-accent focus:text-white"
                  >
                    {currencyCode}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            onClick={() => onValueModeChange?.("usd")}
            className={modeButtonClassName(valueMode === "usd")}
          >
            <span className="px-2">{currencyLabel}</span>
          </Button>
        )}

        <Button
          onClick={() => onValueModeChange?.("percent")}
          className={modeButtonClassName(valueMode === "percent")}
        >
          <span className="px-0">Return (%)</span>
        </Button>

        <Button
          onClick={() => onValueModeChange?.("rr")}
          className={modeButtonClassName(valueMode === "rr")}
        >
          <span className="px-2">RR</span>
        </Button>
      </div>

      {accountAction ? (
        <div className="flex items-center overflow-hidden ring ring-white/5 bg-sidebar group rounded-md">
          <Button className="cursor-default rounded-md bg-sidebar px-4 py-2 text-xs text-white/25 hover:bg-sidebar-accent">
            {accountAction.timestampLabel}: {formattedAccountTimestamp}
          </Button>
        </div>
      ) : null}

      {leadingActions}

      <WidgetPresets
        currentWidgets={widgets}
        currentSpans={widgetSpans}
        onApplyPreset={onApplyPreset || (() => {})}
        onExport={handleExport}
      />
      {!isEditing && widgetsExportTargetRef ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className={controlButtonClassName}>
              <Download className="size-3.5 text-white/75" />
              <span>Share</span>
              <ChevronDown className="size-3.5 text-white/60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 rounded-md bg-sidebar p-1 text-white ring-white/5"
          >
            <DropdownMenuLabel className="px-3 py-2 text-xs font-normal text-white/40">
              Export scope
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-white/5" />
            {shareOptions.map((option) => {
              const nodes = option.getNodes();
              const isDisabled = nodes.length < option.minimumNodes;

              return (
                <DropdownMenuItem
                  key={option.key}
                  disabled={isDisabled}
                  className="cursor-pointer rounded-sm px-3 py-2 text-xs text-white/80 focus:bg-sidebar-accent focus:text-white"
                  onSelect={(event) => {
                    event.preventDefault();
                    void handleShare(option.title, nodes);
                  }}
                >
                  {option.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      <Button onClick={onToggleEdit} className={controlButtonClassName}>
        <EditWidgets className="size-3.5 fill-white/75" />
        <span>{isEditing ? "Save" : "Customize widgets"}</span>
      </Button>
    </div>
  );
};

export default DashboardActionButtons;
