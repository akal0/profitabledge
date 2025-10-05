"use client";

import { useEffect, useId, useState } from "react";

import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useDateRangeStore } from "@/stores/date-range";
import { useComparisonStore } from "@/stores/comparison";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

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
  const [checked, setChecked] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const { min, max, start: globalStart, end: globalEnd } = useDateRangeStore();
  const setComparison = useComparisonStore((s) => s.setComparison);
  const comparisons = useComparisonStore((s) => s.comparisons);

  const start = effectiveRange?.start ?? globalStart;
  const end = effectiveRange?.end ?? globalEnd;

  const myMode = comparisons[ownerId] ?? "none";
  const toggleSwitch = () => {
    const next = !checked;
    if (next && !anyOptionAvailable) return;
    setChecked(next);
    setComparison(ownerId, next ? "previous" : "none");
    if (!next) setSelectedLabel(null);
  };

  // Sync local UI state with global store, so external range changes turn off UI
  useEffect(() => {
    const isOn = (comparisons[ownerId] ?? "none") !== "none";
    setChecked(isOn);
    if (!isOn) setSelectedLabel(null);
  }, [comparisons, ownerId]);

  const stop = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  const daysSelected = (() => {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    s.setHours(0, 0, 0, 0);
    e.setHours(0, 0, 0, 0);
    return Math.floor((+e - +s) / 86400000) + 1;
  })();
  const isWeekRange = daysSelected === 7;
  const hasPrevPeriod = (() => {
    if (!start || !min || daysSelected <= 0) return false;
    const prevStart = new Date(start);
    prevStart.setHours(0, 0, 0, 0);
    prevStart.setDate(prevStart.getDate() - daysSelected);
    const minJs = new Date(min);
    minJs.setHours(0, 0, 0, 0);
    return prevStart.getTime() >= minJs.getTime();
  })();
  const hasPrevForMostRecentWeek = (() => {
    if (!min || !max) return false;
    const mostRecentEnd = new Date(max);
    mostRecentEnd.setHours(0, 0, 0, 0);
    const mostRecentStart = new Date(mostRecentEnd);
    mostRecentStart.setDate(mostRecentEnd.getDate() - 6);
    const prevOfMostRecentStart = new Date(mostRecentStart);
    prevOfMostRecentStart.setDate(mostRecentStart.getDate() - 7);
    const minJs = new Date(min);
    minJs.setHours(0, 0, 0, 0);
    return prevOfMostRecentStart.getTime() >= minJs.getTime();
  })();

  const isMostRecentWeek = (() => {
    if (!isWeekRange || !end || !max) return false;
    const e = new Date(end);
    e.setHours(0, 0, 0, 0);
    const mx = new Date(max);
    mx.setHours(0, 0, 0, 0);
    return e.getTime() === mx.getTime();
  })();
  const isEarliestWeek = (() => {
    if (!isWeekRange || !start || !min) return false;
    const s = new Date(start);
    s.setHours(0, 0, 0, 0);
    const mn = new Date(min);
    mn.setHours(0, 0, 0, 0);
    return s.getTime() === mn.getTime();
  })();
  const isPenultimateWeek = (() => {
    if (!isWeekRange || !end || !max) return false;
    const e = new Date(end);
    e.setHours(0, 0, 0, 0);
    const mx = new Date(max);
    mx.setHours(0, 0, 0, 0);
    const penultimate = new Date(mx);
    penultimate.setDate(mx.getDate() - 7);
    return e.getTime() === penultimate.getTime();
  })();

  const disableThisWeek =
    !isWeekRange || isMostRecentWeek || !hasPrevForMostRecentWeek;
  const disableLastWeek = !isWeekRange || isEarliestWeek || isPenultimateWeek;
  const disablePreviousDays = isPenultimateWeek ? true : !hasPrevPeriod;

  const anyOptionAvailable =
    !disableThisWeek ||
    !disableLastWeek ||
    (!hidePreviousDays && !disablePreviousDays);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <div
        className="group inline-flex items-center gap-2 border border-white/5 px-2 py-1.5"
        data-state={checked ? "checked" : "unchecked"}
        onPointerDown={stop}
        onPointerUp={stop}
        onClick={(e) => {
          stop(e);
          setOpen(true);
        }}
      >
        <DropdownMenuTrigger asChild>
          <span className="outline-none">
            <Switch
              id={id}
              checked={checked}
              onCheckedChange={() => {}}
              aria-labelledby={`${id}-off ${id}-on`}
            />
          </span>
        </DropdownMenuTrigger>
        <span
          id={`${id}-on`}
          className="group-data-[state=unchecked]:text-white/25 flex-1 cursor-pointer text-left text-xs font-medium"
          aria-controls={id}
          onClick={(e) => {
            stop(e);
            setOpen(true);
          }}
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
                setOpen(false);
                setComparison(ownerId, "none");
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
            onSelect={() => {
              setOpen(false);
              setComparison(ownerId, "previous");
              setSelectedLabel("Previous days");
            }}
          >
            Previous days
          </DropdownMenuItem>
        )}

        <DropdownMenuItem
          disabled={disableThisWeek}
          onSelect={() => {
            setOpen(false);
            setComparison(ownerId, "thisWeek");
            setSelectedLabel("This week");
          }}
        >
          This week
        </DropdownMenuItem>

        <DropdownMenuItem
          disabled={disableLastWeek}
          onSelect={() => {
            setOpen(false);
            setComparison(ownerId, "previous");
            setSelectedLabel("Last week");
          }}
        >
          Last week
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            setOpen(false);
            setComparison(ownerId, "none");
            setSelectedLabel(null);
          }}
          disabled={!checked}
        >
          Turn off
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
