"use client";

import { useMemo } from "react";

import { useDateRangeStore } from "@/stores/date-range";

export function useChartRangeQueryParams() {
  const { start, end } = useDateRangeStore();

  return useMemo(
    () => ({
      startISO: start ? new Date(start).toISOString() : undefined,
      endISO: end ? new Date(end).toISOString() : undefined,
    }),
    [end, start]
  );
}
