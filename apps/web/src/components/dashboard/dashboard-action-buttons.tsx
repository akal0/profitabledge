"use client";

import EditWidgets from "@/public/icons/edit-widgets.svg";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WidgetPresets } from "./widget-presets";
import { exportWidgetsAsJson, exportWidgetsAsCsv } from "./widget-export";
import type { WidgetType } from "./widgets";

type Me = {
  name: string;
  email: string;
  image: string | null;
  createdAt: string;
  updatedAt: string;
  emailVerified: boolean;
  username: string | null;
};

type Props = {
  user: Me | null;
  isEditing?: boolean;
  onToggleEdit?: () => void;
  valueMode?: "usd" | "percent";
  onValueModeChange?: (mode: "usd" | "percent") => void;
  widgets?: WidgetType[];
  widgetSpans?: Partial<Record<WidgetType, number>>;
  onApplyPreset?: (
    widgets: WidgetType[],
    spans: Partial<Record<WidgetType, number>>
  ) => void;
};

import Resync from "@/public/icons/resync.svg";
import { Skeleton } from "../ui/skeleton";

const DashboardActionButtons: React.FC<Props> = ({
  user,
  isEditing = false,
  onToggleEdit,
  valueMode = "usd",
  onValueModeChange,
  widgets = [],
  widgetSpans = {},
  onApplyPreset,
}) => {
  const formatDate = (iso: string) => {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return iso;
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

  const formattedUpdatedAt = user ? formatDate(user.updatedAt) : "";

  const handleExport = (format: "json" | "csv") => {
    if (format === "json") {
      exportWidgetsAsJson(widgets, widgetSpans);
    } else {
      exportWidgetsAsCsv(widgets, widgetSpans);
    }
  };

  return (
    <div className="flex gap-2 items-center">
      <div className="bg-white w-max h-max flex items-center gap-1 p-[3px] dark:bg-muted/25 rounded-sm">
        <Button
          onClick={() => onValueModeChange?.("usd")}
          className={cn(
            "cursor-pointer flex transform items-center justify-center gap-2 rounded-sm py-2 h-max transition-all active:scale-95 w-max text-xs duration-250",
            valueMode === "usd"
              ? "bg-[#222225] text-white hover:bg-[#222225] hover:!brightness-120"
              : "bg-[#222225]/25 text-white/25 hover:bg-[#222225] hover:!brightness-105 hover:text-white"
          )}
        >
          <span className="px-2">USD</span>
        </Button>

        <Button
          onClick={() => onValueModeChange?.("percent")}
          className={cn(
            "cursor-pointer flex transform items-center justify-center gap-2 rounded-sm py-2 h-max transition-all active:scale-95 w-max text-xs duration-250",
            valueMode === "percent"
              ? "bg-[#222225] text-white hover:bg-[#222225] hover:!brightness-120"
              : "bg-[#222225]/25 text-white/25 hover:bg-[#222225] hover:!brightness-105 hover:text-white"
          )}
        >
          <span className="px-0">Return (%)</span>
        </Button>
      </div>

      <div className="flex items-center overflow-hidden border border-white/5 bg-sidebar group rounded-sm">
        <Button className="rounded-sm! bg-sidebar hover:bg-sidebar-accent text-white/25 text-xs py-2 px-4 cursor-default">
          Last synced:{" "}
          {formattedUpdatedAt || (
            <Skeleton className="w-28 h-3.5 ml-1 rounded-none bg-sidebar-accent" />
          )}
        </Button>

        <div className="h-9 w-[1px] bg-white/5 mx-0" />
        <Button className="rounded-none bg-sidebar hover:bg-sidebar-accent text-white text-xs py-2">
          <Resync
            className="size-3.5 fill-white group-hover:animate-spin"
            style={{ animationDuration: "3s" }}
          />
          Update account
        </Button>
      </div>

      <WidgetPresets
        currentWidgets={widgets}
        currentSpans={widgetSpans}
        onApplyPreset={onApplyPreset || (() => {})}
        onExport={handleExport}
      />

      <Button
        onClick={onToggleEdit}
        className="cursor-pointer flex items-center justify-center py-2 h-[38px] transition-all active:scale-95 text-white w-max text-xs hover:brightness-110 duration-250 border border-white/5 bg-sidebar rounded-sm hover:bg-sidebar-accent px-3"
      >
        <EditWidgets className="size-3.5 fill-white/75" />
        <span>{isEditing ? "Save" : "Customize widgets"}</span>
      </Button>
    </div>
  );
};

export default DashboardActionButtons;
