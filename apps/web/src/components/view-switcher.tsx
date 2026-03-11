"use client";

import * as React from "react";
import { trpcOptions } from "@/utils/trpc";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Lock, Star, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  APP_TOOLTIP_SURFACE_CLASS,
} from "@/components/ui/tooltip";

interface ViewSwitcherProps {
  selectedViewId?: string | null;
  onViewChange: (viewId: string | null) => void;
  onManageViews?: () => void;
  accountId?: string | null;
}

export function ViewSwitcher({
  selectedViewId,
  onViewChange,
  onManageViews,
  accountId,
}: ViewSwitcherProps) {
  const { data: views, isLoading } = useQuery(
    trpcOptions.views.list.queryOptions()
  );
  const { data: defaultView } = useQuery(
    trpcOptions.views.getDefault.queryOptions()
  );
  const { data: gateStatus } = useQuery({
    ...trpcOptions.trades.getSampleGateStatus.queryOptions({
      accountId: accountId || "",
    }),
    enabled: Boolean(accountId),
  });

  const advancedGate = gateStatus?.find((g) => g.tier === "advanced");
  const isAdvancedUnlocked = advancedGate?.isUnlocked ?? true;
  const advancedGateLabel =
    advancedGate?.isUnlocked === false
      ? `${advancedGate.remaining} more trades needed`
      : "";

  const isAdvancedAlignment = (name?: string | null) =>
    (name || "").toLowerCase().includes("advanced alignment");

  const isCompleteView = selectedViewId === null;
  // Use selected view or fall back to default (unless Complete view is explicit)
  const gatedSelected =
    !isAdvancedUnlocked &&
    views?.find((v) => v.id === selectedViewId && isAdvancedAlignment(v.name));
  const currentViewId = isCompleteView
    ? null
    : gatedSelected
    ? defaultView?.id ?? null
    : selectedViewId ?? defaultView?.id;
  const currentView = views?.find((v) => v.id === currentViewId);

  React.useEffect(() => {
    if (gatedSelected) {
      onViewChange(defaultView?.id ?? null);
    }
  }, [gatedSelected, defaultView?.id, onViewChange]);

  const surfaceClass = cn(
    APP_TOOLTIP_SURFACE_CLASS,
    "border-white/6 bg-sidebar/95 text-white/80 shadow-[0_18px_40px_rgba(0,0,0,0.42)] backdrop-blur-xl"
  );
  const contentClass = cn(surfaceClass, "w-[320px] p-1.5");
  const sectionTitleClass =
    "px-4 py-2.5 text-[11px] font-semibold text-white/55";
  const separatorClass = "-mx-1.5 w-[calc(100%+0.75rem)]";
  const itemClass =
    "px-4 py-2.5 text-xs text-white/75 cursor-pointer data-[highlighted]:bg-sidebar-accent/80";

  if (isLoading) {
    return (
      <Button
        disabled
        className="cursor-pointer flex items-center justify-center gap-2 px-3 py-2 h-[38px] text-xs transition-all duration-250 border border-white/5 bg-sidebar text-white/40 hover:bg-sidebar-accent rounded-sm"
      >
        <Settings2 className="h-4 w-4 text-white/40" />
        Loading...
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="cursor-pointer flex items-center justify-center gap-2 px-3 py-2 h-[38px] text-xs text-white/70 transition-all active:scale-95 duration-250 border border-white/5 bg-sidebar rounded-sm hover:bg-sidebar-accent hover:brightness-110">
          {currentView?.icon && <span>{currentView.icon}</span>}
          <Settings2 className="h-4 w-4 text-white/60" />
          <span className="hidden sm:inline">
            {currentView?.name || "Complete view"}
          </span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={contentClass}>
        <div className={sectionTitleClass}>Views</div>

        <Separator className={separatorClass} />

        {/* Complete view (all columns, no filters) */}
        <DropdownMenuItem
          onClick={() => onViewChange(null)}
          className={cn(
            itemClass,
            isCompleteView && "bg-sidebar-accent/80"
          )}
        >
          <div className="flex items-center gap-2 flex-1">
            <span>📊</span>
            <span>Complete view</span>
          </div>
        </DropdownMenuItem>

        <Separator className={separatorClass} />

        {/* User's saved views */}
        {views && views.length > 0 ? (
          views.map((view) => {
            const isAdvanced = isAdvancedAlignment(view.name);
            const isLocked = isAdvanced && !isAdvancedUnlocked;
            const item = (
              <DropdownMenuItem
                key={view.id}
                onClick={() => !isLocked && onViewChange(view.id)}
                disabled={isLocked}
                className={cn(
                  itemClass,
                  currentViewId === view.id && "bg-sidebar-accent/80",
                  isLocked && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className="flex items-center gap-2 flex-1">
                  {view.icon && <span>{view.icon}</span>}
                  <span>{view.name}</span>
                  {view.isDefault && (
                    <Star className="ml-auto h-3 w-3 fill-yellow-500 text-yellow-500" />
                  )}
                  {isLocked && (
                    <Lock className="ml-auto h-3 w-3 text-white/60" />
                  )}
                </div>
              </DropdownMenuItem>
            );
            if (!isLocked) return item;
            return (
              <Tooltip key={view.id}>
                <TooltipTrigger asChild>{item}</TooltipTrigger>
                <TooltipContent>
                  {advancedGateLabel || "Requires more trades to unlock."}
                </TooltipContent>
              </Tooltip>
            );
          })
        ) : (
          <DropdownMenuItem disabled className="text-white/40 text-xs px-4 py-2.5">
            No saved views
          </DropdownMenuItem>
        )}

        {onManageViews && (
          <>
            <Separator className={separatorClass} />
            <DropdownMenuItem
              onClick={onManageViews}
              className={itemClass}
            >
              <Settings2 className="mr-2 h-4 w-4 text-white/60" />
              <span>Manage views...</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
