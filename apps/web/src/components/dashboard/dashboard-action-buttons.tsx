"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import EditWidgets from "@/public/icons/edit-widgets.svg";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isTerminalProvider } from "@/features/settings/connections/lib/connection-status";
import { trpcOptions } from "@/utils/trpc";
import { WidgetPresets } from "./widget-presets";
import { exportWidgetsAsJson, exportWidgetsAsCsv } from "./widget-export";
import type { WidgetType } from "./widgets";
import type { WidgetValueMode } from "@/features/dashboard/widgets/lib/widget-shared";

export type DashboardAccountAction =
  | {
      type: "sync";
      label: "Sync account";
      timestampLabel: "Last synced";
      timestamp?: string | Date | null;
      connectionId: string;
      provider: string;
    }
  | {
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
  onApplyPreset?: (
    widgets: WidgetType[],
    spans: Partial<Record<WidgetType, number>>
  ) => void;
};

import Resync from "@/public/icons/resync.svg";
const DashboardActionButtons: React.FC<Props> = ({
  isEditing = false,
  onToggleEdit,
  valueMode = "usd",
  onValueModeChange,
  currencyLabel = "Currency",
  accountAction = null,
  widgets = [],
  widgetSpans = {},
  onApplyPreset,
}) => {
  const queryClient = useQueryClient();
  const syncNow = useMutation(
    trpcOptions.connections.syncNow.mutationOptions()
  );

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

  const handleSyncAccount = async () => {
    if (!accountAction || accountAction.type !== "sync") return;

    try {
      const result = await syncNow.mutateAsync({
        connectionId: accountAction.connectionId,
      });

      if (result.status === "success") {
        if (isTerminalProvider(accountAction.provider)) {
          toast.success("Sync started");
        } else {
          toast.success(
            `Synced ${result.tradesInserted} new trade${
              result.tradesInserted !== 1 ? "s" : ""
            }`
          );
        }
      } else if (result.status === "skipped") {
        toast.info("Sync is paused");
      } else {
        toast.error(result.errorMessage || "Sync failed");
      }

      await queryClient.invalidateQueries();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Sync failed");
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
            className={cn(
              "rounded-l-sm! rounded-r-none bg-sidebar hover:bg-sidebar-accent text-white/25 text-xs py-2 px-4 cursor-default",
              accountAction.type === "timestamp" && "rounded-md"
            )}
          >
            {accountAction.timestampLabel}: {formattedAccountTimestamp}
          </Button>

          {accountAction.type === "sync" ? (
            <>
              <div className="h-9 w-[1px] bg-white/5 mx-0" />
              <Button
                className="rounded-none bg-sidebar hover:bg-sidebar-accent text-white text-xs py-2"
                onClick={() => void handleSyncAccount()}
                disabled={syncNow.isPending}
              >
                <Resync
                  className={cn(
                    "size-3.5 fill-white",
                    syncNow.isPending && "animate-spin"
                  )}
                  style={{ animationDuration: "1.5s" }}
                />
                {syncNow.isPending ? "Syncing..." : accountAction.label}
              </Button>
            </>
          ) : null}
        </div>
      ) : null}

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
