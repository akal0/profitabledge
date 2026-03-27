"use client";

import type { RefObject } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import DashboardActionButtons from "@/components/dashboard/dashboard-action-buttons";
import { InsightPanel } from "@/components/dashboard/insight-panel";
import { Skeleton } from "@/components/ui/skeleton";
import type { Me } from "@/types/user";
import type { WidgetType } from "@/components/dashboard/widgets";
import type { WidgetValueMode } from "@/features/dashboard/widgets/lib/widget-shared";
import type { DashboardAccountAction } from "@/components/dashboard/dashboard-action-buttons";

import { DashboardSessionBadge } from "./dashboard-session-badge";
import { getTimeGreeting } from "../lib/dashboard-greeting";

export function DashboardOverviewHeader({
  user,
  isEditing,
  valueMode,
  currencyLabel,
  currencyOptions,
  onCurrencyCodeChange,
  accountAction,
  leadingActions,
  widgetsExportTargetRef,
  calendarExportTargetRef,
  chartWidgetsExportTargetRef,
  widgets,
  widgetSpans,
  onValueModeChange,
  onToggleEdit,
  onApplyPreset,
}: {
  user: Me | null;
  isEditing: boolean;
  valueMode: WidgetValueMode;
  currencyLabel?: string;
  currencyOptions?: string[];
  onCurrencyCodeChange?: (currencyCode: string) => void;
  accountAction?: DashboardAccountAction | null;
  leadingActions?: React.ReactNode;
  widgetsExportTargetRef?: RefObject<HTMLElement | null>;
  calendarExportTargetRef?: RefObject<HTMLElement | null>;
  chartWidgetsExportTargetRef?: RefObject<HTMLElement | null>;
  widgets: WidgetType[];
  widgetSpans: Partial<Record<WidgetType, number>>;
  onValueModeChange: (value: WidgetValueMode) => void;
  onToggleEdit: () => void;
  onApplyPreset: (
    widgets: WidgetType[],
    spans: Partial<Record<WidgetType, number>>
  ) => Promise<void>;
}) {
  const greeting = getTimeGreeting();

  return (
    <div className="flex w-full shrink-0 items-center justify-between">
      <div className="flex w-full items-center gap-2 text-xl tracking-tight text-secondary dark:text-neutral-200">
        <h1 className="font-medium text-secondary">{greeting},</h1>

        <h1 className="flex items-center gap-1">
          <Avatar className="size-7 shadow-sidebar-button">
            <AvatarImage
              src={user?.image ?? ""}
              alt={user?.name ?? ""}
              className="object-cover"
            />
            <AvatarFallback>
              <Skeleton className="size-7 rounded-full" />
            </AvatarFallback>
          </Avatar>

          <span className="font-semibold text-black dark:text-white">
            {user?.username ?? <Skeleton className="h-7 w-32" />}
          </span>
        </h1>

        <DashboardSessionBadge />
      </div>

      <div className="flex items-center gap-2">
        <InsightPanel />
        <DashboardActionButtons
          isEditing={isEditing}
          valueMode={valueMode}
          currencyLabel={currencyLabel}
          currencyOptions={currencyOptions}
          onCurrencyCodeChange={onCurrencyCodeChange}
          accountAction={accountAction}
          leadingActions={leadingActions}
          widgetsExportTargetRef={widgetsExportTargetRef}
          calendarExportTargetRef={calendarExportTargetRef}
          chartWidgetsExportTargetRef={chartWidgetsExportTargetRef}
          onValueModeChange={onValueModeChange}
          onToggleEdit={onToggleEdit}
          widgets={widgets}
          widgetSpans={widgetSpans}
          onApplyPreset={onApplyPreset}
        />
      </div>
    </div>
  );
}
