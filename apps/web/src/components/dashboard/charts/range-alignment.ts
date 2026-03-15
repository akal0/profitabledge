import {
  countRangeDays,
  type DateRange,
} from "@/components/dashboard/chart-comparison-utils";

const HOUR_MS = 60 * 60 * 1000;

export type RelativeSeriesPoint = {
  relativeMs: number;
  value: number;
};

type RelativeDensityPreset = {
  sampleStepMs: number | null;
  axisTickStepMs: number | null;
  bucketed: boolean;
  axisLabel:
    | "hour"
    | "weekday-hour"
    | "weekday"
    | "month-day";
  tooltipLabel: "minute" | "hour" | "date";
};

function getRelativeDensityPreset(range: DateRange): RelativeDensityPreset {
  const days = countRangeDays(range);

  if (days <= 1) {
    return {
      sampleStepMs: HOUR_MS,
      axisTickStepMs: HOUR_MS * 4,
      bucketed: true,
      axisLabel: "hour",
      tooltipLabel: "minute",
    };
  }

  if (days <= 3) {
    return {
      sampleStepMs: HOUR_MS * 2,
      axisTickStepMs: HOUR_MS * 12,
      bucketed: true,
      axisLabel: "weekday-hour",
      tooltipLabel: "hour",
    };
  }

  if (days <= 7) {
    return {
      sampleStepMs: HOUR_MS * 4,
      axisTickStepMs: HOUR_MS * 24,
      bucketed: true,
      axisLabel: "weekday",
      tooltipLabel: "hour",
    };
  }

  if (days <= 14) {
    return {
      sampleStepMs: HOUR_MS * 12,
      axisTickStepMs: HOUR_MS * 48,
      bucketed: true,
      axisLabel: "month-day",
      tooltipLabel: "hour",
    };
  }

  return {
    sampleStepMs: null,
    axisTickStepMs: null,
    bucketed: false,
    axisLabel: "month-day",
    tooltipLabel: "date",
  };
}

export function getRangeDurationMs(range: DateRange) {
  return Math.max(0, range.end.getTime() - range.start.getTime());
}

export function clampRelativeMs(timestampMs: number, range: DateRange) {
  return Math.max(
    0,
    Math.min(getRangeDurationMs(range), timestampMs - range.start.getTime())
  );
}

export function formatRelativeDate(range: DateRange, relativeMs: number) {
  const durationMs = getRangeDurationMs(range);
  const clampedMs = Math.max(0, Math.min(durationMs, relativeMs));
  const date = new Date(range.start.getTime() + clampedMs);
  const preset = getRelativeDensityPreset(range);

  if (preset.axisLabel === "hour") {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
    });
  }

  if (preset.axisLabel === "weekday-hour") {
    return date.toLocaleString("en-US", {
      weekday: "short",
      hour: "numeric",
    });
  }

  if (preset.axisLabel === "weekday") {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
    });
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function formatRelativeTooltipDate(range: DateRange, relativeMs: number) {
  const durationMs = getRangeDurationMs(range);
  const clampedMs = Math.max(0, Math.min(durationMs, relativeMs));
  const date = new Date(range.start.getTime() + clampedMs);
  const preset = getRelativeDensityPreset(range);

  if (preset.tooltipLabel === "minute") {
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  if (preset.tooltipLabel === "hour") {
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
    });
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function getRelativeSamplingStepMs(range: DateRange) {
  return getRelativeDensityPreset(range).sampleStepMs;
}

export function getRelativeAxisTickStepMs(range: DateRange) {
  return getRelativeDensityPreset(range).axisTickStepMs;
}

export function usesBucketedRelativeSampling(range: DateRange) {
  return getRelativeDensityPreset(range).bucketed;
}

export function buildRelativeAxisTicks(
  durationMs: number,
  tickCount = 6,
  stepMs?: number | null
) {
  if (durationMs <= 0 || tickCount <= 1) {
    return [0];
  }

  if (stepMs && stepMs > 0) {
    const ticks = [0];

    for (let relativeMs = stepMs; relativeMs < durationMs; relativeMs += stepMs) {
      ticks.push(relativeMs);
    }

    if (ticks[ticks.length - 1] !== durationMs) {
      ticks.push(durationMs);
    }

    return ticks;
  }

  return Array.from({ length: tickCount }, (_, index) =>
    Math.round((durationMs / (tickCount - 1)) * index)
  );
}

export function getSeriesValueAt(
  series: RelativeSeriesPoint[],
  relativeMs: number
) {
  let value = series[0]?.value ?? 0;

  for (const point of series) {
    if (point.relativeMs > relativeMs) {
      break;
    }
    value = point.value;
  }

  return value;
}

export function getMergedRelativePositions(
  primarySeries: RelativeSeriesPoint[],
  comparisonSeries: RelativeSeriesPoint[],
  durationMs: number,
  sampleStepMs?: number | null,
  options?: {
    includeSeriesPoints?: boolean;
  }
) {
  const includeSeriesPoints = options?.includeSeriesPoints ?? true;

  return Array.from(
    new Set<number>([
      0,
      durationMs,
      ...(sampleStepMs && sampleStepMs > 0
        ? Array.from(
            { length: Math.floor(durationMs / sampleStepMs) },
            (_, index) => sampleStepMs * (index + 1)
          ).filter((relativeMs) => relativeMs < durationMs)
        : []),
      ...(includeSeriesPoints
        ? primarySeries.map((point) => point.relativeMs)
        : []),
      ...(includeSeriesPoints
        ? comparisonSeries.map((point) => point.relativeMs)
        : []),
    ])
  ).sort((a, b) => a - b);
}
