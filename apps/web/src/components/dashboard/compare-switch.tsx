"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { VerticalSeparator } from "@/components/ui/separator";
import { useDateRangeStore } from "@/stores/date-range";
import { useComparisonStore } from "@/stores/comparison";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import {
  countRangeDays,
  getComparisonRange,
} from "@/components/dashboard/chart-comparison-utils";

export default function Component({
  ownerId = "default",
  hidePreviousDays = false,
  effectiveRange,
}: {
  ownerId?: string;
  hidePreviousDays?: boolean;
  effectiveRange?: { start: Date; end: Date };
}) {
  const [open, setOpen] = useState(false);
  const { min, max, start: globalStart, end: globalEnd } = useDateRangeStore();
  const setComparison = useComparisonStore((s) => s.setComparison);
  const comparisons = useComparisonStore((s) => s.comparisons);

  const start = effectiveRange?.start ?? globalStart;
  const end = effectiveRange?.end ?? globalEnd;

  const myMode = comparisons[ownerId] ?? "none";
  const checked = myMode !== "none";

  const stop = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  const range = useMemo(() => {
    if (!start || !end) return null;
    return { start: new Date(start), end: new Date(end) };
  }, [end, start]);

  const daysSelected = (() => {
    if (!range) return 0;
    return countRangeDays(range);
  })();

  const previousRange = useMemo(() => {
    if (!range) return null;
    return getComparisonRange("previous", range, { minDate: min });
  }, [min, range]);

  const lastWeekRange = useMemo(() => {
    if (!range) return null;
    return getComparisonRange("lastWeek", range, { minDate: min });
  }, [min, range]);

  const thisWeekRange = useMemo(() => {
    if (!range) return null;
    return getComparisonRange("thisWeek", range, {
      minDate: min,
      maxDate: max,
    });
  }, [max, min, range]);

  const isWeekRange = daysSelected === 7;
  const isMostRecentWeek = (() => {
    if (!isWeekRange || !end || !max) return false;
    const selectedEnd = new Date(end);
    selectedEnd.setHours(0, 0, 0, 0);
    const maxEnd = new Date(max);
    maxEnd.setHours(0, 0, 0, 0);
    return selectedEnd.getTime() === maxEnd.getTime();
  })();

  const disablePreviousDays = hidePreviousDays || !previousRange;
  const disableThisWeek = !isWeekRange || !thisWeekRange || isMostRecentWeek;
  const disableLastWeek = !isWeekRange || !lastWeekRange;

  const anyOptionAvailable =
    !disableThisWeek || !disableLastWeek || !disablePreviousDays;

  const selectedLabel = useMemo(() => {
    if (myMode === "none") return null;
    if (myMode === "thisWeek") return "This week";
    if (myMode === "lastWeek") return "Last week";
    if (daysSelected <= 0) return "Previous range";
    if (daysSelected === 1) return "Previous day";
    return `Previous ${daysSelected} days`;
  }, [daysSelected, myMode]);

  const selectMode = (mode: typeof myMode) => {
    setOpen(false);
    setComparison(ownerId, mode);
  };

  const clearMode = () => {
    setOpen(false);
    setComparison(ownerId, "none");
  };

  const canOpen = anyOptionAvailable || checked;

  const handleOpenMenu = (event?: React.SyntheticEvent) => {
    event?.stopPropagation();
    if (!canOpen) return;
    setOpen(true);
  };

  const daysSelectedLabel = (() => {
    if (daysSelected <= 0) return "range";
    return daysSelected === 1 ? "day" : `${daysSelected} days`;
  })();

  const comparisonButtonClass =
    "cursor-pointer flex h-7 items-center justify-center gap-2 rounded-sm border border-white/5 bg-sidebar px-1.5 text-xs text-white transition-all duration-250 hover:bg-sidebar-accent hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:text-white/25 disabled:hover:bg-sidebar disabled:hover:brightness-100";
  const selectedChipClass =
    "flex h-7 items-center rounded-sm border border-white/5 bg-sidebar pr-0.5 pl-3 text-white transition-all duration-250 hover:bg-sidebar-accent hover:brightness-110";

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <div className="inline-flex items-center gap-2" onPointerDown={stop}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            disabled={!canOpen}
            className={cn(
              comparisonButtonClass,
              checked ? "text-white" : "text-white/70"
            )}
            onClick={stop}
          >
            <span
              aria-hidden="true"
              className={cn(
                "relative inline-flex h-4 w-8 shrink-0 rounded-full transition-colors duration-300",
                checked ? "bg-teal-500" : "bg-[#29292D]"
              )}
            >
              <span
                className={cn(
                  "absolute top-1/2 left-0.5 size-3 -translate-y-1/2 rounded-full bg-sidebar shadow-xs transition-transform duration-300",
                  checked ? "translate-x-4 bg-sidebar-accent" : "translate-x-0"
                )}
              />
            </span>
            <span className="font-medium">Comparison</span>
          </Button>
        </DropdownMenuTrigger>

        {checked && selectedLabel ? (
          <div
            className={selectedChipClass}
            onClick={handleOpenMenu}
            onPointerUp={stop}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleOpenMenu(event);
              }
            }}
          >
            <span className="whitespace-nowrap text-xs">{selectedLabel}</span>
            <VerticalSeparator className="mr-0.5 ml-2 h-3.5" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-5 rounded-sm text-white/70 hover:bg-white/5 hover:text-white"
              onPointerDown={stop}
              onClick={(event) => {
                stop(event);
                clearMode();
              }}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        ) : null}
      </div>
      <DropdownMenuContent
        align="end"
        className="mr-5 mt-4 w-56 rounded-none border border-white/5 bg-sidebar"
        onPointerDown={stop}
        onClick={stop}
      >
        <DropdownMenuLabel className="text-xs text-white/40 font-normal">
          Compare with
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/5 h-px" />
        {!hidePreviousDays && (
          <DropdownMenuItem
            disabled={disablePreviousDays}
            onSelect={() => selectMode("previous")}
          >
            Previous {daysSelectedLabel}
          </DropdownMenuItem>
        )}

        <DropdownMenuItem
          disabled={disableThisWeek}
          onSelect={() => selectMode("thisWeek")}
        >
          This week
        </DropdownMenuItem>

        <DropdownMenuItem
          disabled={disableLastWeek}
          onSelect={() => selectMode("lastWeek")}
        >
          Last week
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={clearMode} disabled={!checked}>
          Turn off
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
