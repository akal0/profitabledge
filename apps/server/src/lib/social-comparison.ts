export type MirrorComparisonTradeRow = {
  tradeDurationSeconds?: string | number | null;
  openTime?: Date | string | null;
  closeTime?: Date | string | null;
  open?: string | null;
  close?: string | null;
  rrCaptureEfficiency?: string | number | null;
  exitEfficiency?: string | number | null;
  protocolAlignment?: string | null;
};

export type MirrorComparisonSideMetrics = {
  avgHoldTime: number;
  rrCaptureEfficiency: number;
  exitEfficiency: number;
  protocolRate: number;
  sampleSize: number;
};

export type MirrorComparisonData = {
  avgHoldTime: { mine: number; theirs: number };
  rrCaptureEfficiency: { mine: number; theirs: number };
  exitEfficiency: { mine: number; theirs: number };
  protocolRate: { mine: number; theirs: number };
};

function toNumericValue(value: string | number | null | undefined) {
  if (value == null) {
    return null;
  }

  const numericValue = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function parseDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function holdSeconds(trade: MirrorComparisonTradeRow) {
  const explicitDuration = toNumericValue(trade.tradeDurationSeconds);
  if (explicitDuration != null && explicitDuration > 0) {
    return explicitDuration;
  }

  const openTime = parseDate(trade.openTime) ?? parseDate(trade.open);
  const closeTime = parseDate(trade.closeTime) ?? parseDate(trade.close);

  if (!openTime || !closeTime) {
    return null;
  }

  const duration = Math.floor((closeTime.getTime() - openTime.getTime()) / 1000);
  return duration > 0 ? duration : null;
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function averagePositiveMetric(
  trades: MirrorComparisonTradeRow[],
  key: "rrCaptureEfficiency" | "exitEfficiency"
) {
  return average(
    trades
      .map((trade) => toNumericValue(trade[key]))
      .filter((value): value is number => value != null && value > 0)
  );
}

function calculateProtocolRate(trades: MirrorComparisonTradeRow[]) {
  if (trades.length === 0) {
    return 0;
  }

  const alignedCount = trades.filter(
    (trade) => trade.protocolAlignment === "aligned"
  ).length;
  return alignedCount / trades.length;
}

export function calculateMirrorComparisonSideMetrics(
  trades: MirrorComparisonTradeRow[]
): MirrorComparisonSideMetrics {
  const holdSamples = trades
    .map((trade) => holdSeconds(trade))
    .filter((value): value is number => value != null && value > 0);

  return {
    avgHoldTime: average(holdSamples),
    rrCaptureEfficiency: averagePositiveMetric(trades, "rrCaptureEfficiency"),
    exitEfficiency: averagePositiveMetric(trades, "exitEfficiency"),
    protocolRate: calculateProtocolRate(trades),
    sampleSize: trades.length,
  };
}

function formatSeconds(value: number) {
  if (value < 60) {
    return `${Math.round(value)}s`;
  }

  const minutes = Math.round(value / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.round((value / 60 / 60) * 10) / 10;
  return `${hours}h`;
}

function formatSignedDelta(value: number, unit: string) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}${unit}`;
}

export function buildMirrorComparisonInsights(args: {
  mine: MirrorComparisonSideMetrics;
  theirs: MirrorComparisonSideMetrics;
}) {
  const insights: string[] = [];

  if (args.mine.sampleSize === 0 || args.theirs.sampleSize === 0) {
    insights.push("One or both accounts have no closed trades to compare yet.");
    return insights;
  }

  const holdDelta = args.mine.avgHoldTime - args.theirs.avgHoldTime;
  if (Math.abs(holdDelta) > 60) {
    insights.push(
      `Your average hold time is ${formatSignedDelta(
        holdDelta / 60,
        "m"
      )} vs theirs.`
    );
  }

  const captureDelta = args.mine.rrCaptureEfficiency - args.theirs.rrCaptureEfficiency;
  if (Math.abs(captureDelta) > 1) {
    insights.push(
      `Your RR capture is ${formatSignedDelta(captureDelta, "pts")} vs theirs.`
    );
  }

  const exitDelta = args.mine.exitEfficiency - args.theirs.exitEfficiency;
  if (Math.abs(exitDelta) > 1) {
    insights.push(
      `Your exit efficiency is ${formatSignedDelta(exitDelta, "pts")} vs theirs.`
    );
  }

  const protocolDelta = args.mine.protocolRate - args.theirs.protocolRate;
  if (Math.abs(protocolDelta) > 0.01) {
    insights.push(
      `Your protocol adherence is ${formatSignedDelta(
        protocolDelta * 100,
        "pts"
      )} vs theirs.`
    );
  }

  if (insights.length === 0) {
    insights.push("Both accounts are operating at a similar level across the tracked metrics.");
  }

  return insights;
}

export function buildMirrorComparisonData(args: {
  mineTrades: MirrorComparisonTradeRow[];
  theirTrades: MirrorComparisonTradeRow[];
}) {
  const mine = calculateMirrorComparisonSideMetrics(args.mineTrades);
  const theirs = calculateMirrorComparisonSideMetrics(args.theirTrades);

  return {
    comparisonData: {
      avgHoldTime: { mine: mine.avgHoldTime, theirs: theirs.avgHoldTime },
      rrCaptureEfficiency: {
        mine: mine.rrCaptureEfficiency,
        theirs: theirs.rrCaptureEfficiency,
      },
      exitEfficiency: { mine: mine.exitEfficiency, theirs: theirs.exitEfficiency },
      protocolRate: { mine: mine.protocolRate, theirs: theirs.protocolRate },
    },
    insights: buildMirrorComparisonInsights({ mine, theirs }),
    sideMetrics: { mine, theirs },
  };
}
