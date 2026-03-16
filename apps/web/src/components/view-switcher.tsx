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
} from "@/components/ui/tooltip";
import {
  toolbarFilterMenuContentClass,
  toolbarFilterMenuItemClass,
  toolbarFilterMenuMainSeparatorClass,
  toolbarFilterMenuSectionTitleClass,
  toolbarSelectTriggerButtonClassName,
} from "@/components/ui/filter-menu-styles";

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
    advancedGate?.isUnlocked === false ? advancedGate.message : "";

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

  const contentClass = cn(toolbarFilterMenuContentClass, "w-[320px]");
  const sectionTitleClass = toolbarFilterMenuSectionTitleClass;
  const separatorClass = toolbarFilterMenuMainSeparatorClass;
  const itemClass = cn(toolbarFilterMenuItemClass, "rounded-sm");

  if (isLoading) {
    return (
      <Button
        disabled
        className={cn(toolbarSelectTriggerButtonClassName, "text-white/40")}
      >
        <Settings2 className="h-4 w-4 text-white/40" />
        Loading...
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className={toolbarSelectTriggerButtonClassName}>
          {currentView?.icon && <span>{currentView.icon}</span>}
          <Settings2 className="size-3 text-white/60" />
          <span className="hidden sm:inline">
            {currentView?.name || "Complete view"}
          </span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={contentClass}>
        <div className={sectionTitleClass}>Views</div>

        <Separator className={separatorClass} />

        <div className="py-1">
          {/* Complete view (all columns, no filters) */}
          <DropdownMenuItem
            onClick={() => onViewChange(null)}
            className={cn(itemClass, isCompleteView && "bg-sidebar-accent/80")}
          >
            <div className="flex flex-1 items-center gap-2">
              <span>📊</span>
              <span>Complete view</span>
            </div>
          </DropdownMenuItem>
        </div>

        <Separator className={separatorClass} />

        <div className="py-1">
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
                    isLocked && "cursor-not-allowed opacity-50"
                  )}
                >
                  <div className="flex flex-1 items-center gap-2">
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
            <DropdownMenuItem
              disabled
              className={cn(itemClass, "cursor-default text-white/40")}
            >
              No saved views
            </DropdownMenuItem>
          )}
        </div>

        {onManageViews && (
          <>
            <Separator className={separatorClass} />
            <div className="pt-1">
              <DropdownMenuItem onClick={onManageViews} className={itemClass}>
                <Settings2 className=" size-3.5 text-white/60" />
                <span>Manage views...</span>
              </DropdownMenuItem>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
