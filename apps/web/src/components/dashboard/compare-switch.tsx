"use client";

import { useId, useMemo, useState } from "react";

import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useDateRangeStore } from "@/stores/date-range";
import { useComparisonStore } from "@/stores/comparison";
import { Badge } from "@/components/ui/badge";
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
  const id = useId();
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
    return getComparisonRange("thisWeek", range, { minDate: min, maxDate: max });
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

  const handleOpenMenu = (e: React.SyntheticEvent) => {
    stop(e);
    if (!canOpen) return;
    setOpen(true);
  };

  const daysSelectedLabel = (() => {
    if (daysSelected <= 0) return "range";
    return daysSelected === 1 ? "day" : `${daysSelected} days`;
  })();

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <div
        className="group inline-flex items-center gap-2 border border-white/5 px-2 py-1.5"
        data-state={checked ? "checked" : "unchecked"}
        onPointerDown={stop}
        onPointerUp={stop}
        onClick={handleOpenMenu}
      >
        <DropdownMenuTrigger asChild>
          <span className="outline-none">
            <Switch
              id={id}
              checked={checked}
              onCheckedChange={() => {
                if (checked) {
                  clearMode();
                  return;
                }
                if (!canOpen) return;
                setOpen(true);
              }}
              aria-labelledby={`${id}-off ${id}-on`}
            />
          </span>
        </DropdownMenuTrigger>
        <span
          id={`${id}-on`}
          className="group-data-[state=unchecked]:text-white/25 flex-1 cursor-pointer text-left text-xs font-medium"
          aria-controls={id}
          onClick={handleOpenMenu}
          onPointerDown={stop}
        >
          Comparison
        </span>
        {checked && selectedLabel ? (
          <Badge
            variant="outline"
            className="text-xs gap-1 px-2 py-0.5 text-white/80 border-white/10 rounded-none ml-2"
          >
            <span className="pointer-events-none">{selectedLabel}</span>
            <button
              aria-label="Remove comparison"
              className="-mr-1.5 ml-1 rounded-none hover:bg-white/5 p-0.5"
              onPointerDown={stop}
              onClick={(e) => {
                stop(e);
                clearMode();
              }}
            >
              <X className="size-3.5" />
            </button>
          </Badge>
        ) : null}
      </div>
      <DropdownMenuContent
        className="w-56 rounded-none border border-white/5 mr-5 mt-4 bg-sidebar"
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
        <DropdownMenuItem
          onSelect={clearMode}
          disabled={!checked}
        >
          Turn off
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
