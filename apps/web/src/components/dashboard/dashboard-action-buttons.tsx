"use client";

import EditWidgets from "@/public/icons/edit-widgets.svg";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WidgetPresets } from "./widget-presets";
import { exportWidgetsAsJson, exportWidgetsAsCsv } from "./widget-export";
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
  accountAction?: DashboardAccountAction | null;
  widgets?: WidgetType[];
  widgetSpans?: Partial<Record<WidgetType, number>>;
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
  accountAction = null,
  widgets = [],
  widgetSpans = {},
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

  return (
    <div className="flex gap-2 items-center">
      <div className="bg-white w-max h-max flex items-center gap-1 p-[3px] dark:bg-muted/15 rounded-md ring ring-white/5">
        <Button
          onClick={() => onValueModeChange?.("usd")}
          className={cn(
            "cursor-pointer flex transform items-center justify-center gap-2 rounded-md py-2 h-max transition-all active:scale-95 w-max text-xs duration-250",
            valueMode === "usd"
              ? "bg-[#222225] text-white hover:bg-[#222225] hover:!brightness-120 ring ring-white/5"
              : "bg-[#222225]/25 text-white/25 hover:bg-[#222225] hover:!brightness-105 hover:text-white ring-0"
          )}
        >
          <span className="px-2">{currencyLabel}</span>
        </Button>

        <Button
          onClick={() => onValueModeChange?.("percent")}
          className={cn(
            "cursor-pointer flex transform items-center justify-center gap-2 rounded-md py-2 h-max transition-all active:scale-95 w-max text-xs duration-250",
            valueMode === "percent"
              ? "bg-[#222225] text-white hover:bg-[#222225] hover:!brightness-120 ring ring-white/5"
              : "bg-[#222225]/25 text-white/25 hover:bg-[#222225] hover:!brightness-105 hover:text-white ring-0"
          )}
        >
          <span className="px-0">Return (%)</span>
        </Button>

        <Button
          onClick={() => onValueModeChange?.("rr")}
          className={cn(
            "cursor-pointer flex transform items-center justify-center gap-2 rounded-md py-2 h-max transition-all active:scale-95 w-max text-xs duration-250",
            valueMode === "rr"
              ? "bg-[#222225] text-white hover:bg-[#222225] hover:!brightness-120 ring ring-white/5"
              : "bg-[#222225]/25 text-white/25 hover:bg-[#222225] hover:!brightness-105 hover:text-white ring-0"
          )}
        >
          <span className="px-2">RR</span>
        </Button>
      </div>

      {accountAction ? (
        <div className="flex items-center overflow-hidden ring ring-white/5 bg-sidebar group rounded-md">
          <Button
            className="cursor-default rounded-md bg-sidebar px-4 py-2 text-xs text-white/25 hover:bg-sidebar-accent"
          >
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
      <Button
        onClick={onToggleEdit}
        className="cursor-pointer flex items-center justify-center py-2 h-[38px] transition-all active:scale-95 text-white w-max text-xs hover:brightness-110 duration-250 ring ring-white/5 bg-sidebar rounded-md hover:bg-sidebar-accent px-3"
      >
        <EditWidgets className="size-3.5 fill-white/75" />
        <span>{isEditing ? "Save" : "Customize widgets"}</span>
      </Button>
    </div>
  );
};

export default DashboardActionButtons;
