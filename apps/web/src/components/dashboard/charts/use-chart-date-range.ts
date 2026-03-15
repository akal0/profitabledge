"use client";

import React from "react";

import { useDateRangeStore } from "@/stores/date-range";

import { useChartRenderMode } from "./chart-render-mode";

function getEmbeddedWeekRange() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 6);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    min: undefined,
    max: undefined,
  };
}

export function useChartDateRange() {
  const renderMode = useChartRenderMode();
  const range = useDateRangeStore();

  return React.useMemo(() => {
    if (renderMode !== "embedded") {
      return range;
    }

    return getEmbeddedWeekRange();
  }, [range, renderMode]);
}
