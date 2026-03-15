import type { Filter } from "./query-plan";
import { FIELD_MAP } from "./trade-fields";
import {
  formatValue,
  formatWindowLabel,
  toSnakeCase,
} from "./query-executor-formatting";

type InsightCandidate = {
  text: string;
  recommendation?: string;
  score: number;
};

type GroupStats = {
  label: string;
  count: number;
  wins: number;
  winRate: number;
  totalProfit: number;
  avgProfit: number;
};

type ImprovementRow = { label: string; value: string; note?: string };

export function buildRecommendationsFromTrades(
  trades: Record<string, any>[]
): { insights: string[]; recommendations: string[] } {
  const candidates: InsightCandidate[] = [];
  const profitField = FIELD_MAP.get("profit");
  const realisedRRField = FIELD_MAP.get("realisedRR");
  const maxRRField = FIELD_MAP.get("maxRR");
  const captureField = FIELD_MAP.get("rrCaptureEfficiency");
  const postExitField = FIELD_MAP.get("mpeManipPE_R");
  const manipEffField = FIELD_MAP.get("manipRREfficiency");
  const exitEffField = FIELD_MAP.get("exitEfficiency");
  const plannedRRField = FIELD_MAP.get("plannedRR");

  const profits = trades
    .map((trade) => getNumericValue(trade, "profit"))
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const totalProfit = profits.reduce((sum, value) => sum + value, 0);
  const winProfits = profits.filter((value) => value > 0);
  const lossProfits = profits.filter((value) => value < 0);
  const winRate = profits.length > 0 ? (winProfits.length / profits.length) * 100 : 0;

  const avgWin = averageNumbers(winProfits);
  const avgLoss = averageNumbers(lossProfits.map((value) => Math.abs(value)));

  if (avgWin !== null && avgLoss !== null && avgLoss > avgWin * 1.1) {
    candidates.push({
      text: `Average loss (${formatValue(-avgLoss, profitField)}) is larger than average win (${formatValue(avgWin, profitField)}).`,
      recommendation:
        "Focus on reducing average loss size or improving reward-to-risk on winning trades.",
      score: avgLoss - avgWin,
    });
  } else if (profits.length >= 5 && winRate < 45) {
    candidates.push({
      text: `Win rate is ${formatPercent(winRate)} across ${formatCount(profits.length)} trades.`,
      recommendation:
        "Tighten entry criteria or prioritize higher-conviction setups to lift your win rate.",
      score: 45 - winRate,
    });
  } else if (profits.length >= 5 && totalProfit < 0) {
    candidates.push({
      text: `Net result is ${formatValue(totalProfit, profitField)} across ${formatCount(
        profits.length
      )} trades.`,
      recommendation:
        "Review recent losses and focus on preserving capital before increasing size.",
      score: Math.abs(totalProfit),
    });
  }

  const holdStats = buildHoldTimeStats(trades);
  const holdCandidates = holdStats.filter((stat) => stat.count >= 5);
  if (holdCandidates.length >= 2) {
    const best = holdCandidates.reduce((prev, curr) =>
      curr.winRate > prev.winRate ? curr : prev
    );
    const worst = holdCandidates.reduce((prev, curr) =>
      curr.winRate < prev.winRate ? curr : prev
    );
    const diff = best.winRate - worst.winRate;
    if (diff >= 10) {
      candidates.push({
        text: `Hold times ${best.label} perform best (${formatPercent(best.winRate)} win rate, n=${formatCount(
          best.count
        )}) vs ${worst.label} at ${formatPercent(worst.winRate)}.`,
        recommendation: `Consider emphasizing ${best.label} holds or tightening filters for ${worst.label} trades.`,
        score: diff,
      });
    }
  }

  const sessionStats = buildGroupStats(trades, "sessionTag");
  const sessionCandidates = sessionStats.filter((stat) => stat.count >= 5);
  if (sessionCandidates.length >= 2) {
    const sorted = [...sessionCandidates].sort((a, b) => b.totalProfit - a.totalProfit);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    if (best && worst && best.label !== worst.label) {
      const diff = Math.abs(best.totalProfit - worst.totalProfit);
      candidates.push({
        text: `Best session is ${best.label} (${formatValue(best.totalProfit, profitField)}, ${formatPercent(
          best.winRate
        )} win rate, n=${formatCount(best.count)}). Worst is ${worst.label} (${formatValue(
          worst.totalProfit,
          profitField
        )}, ${formatPercent(worst.winRate)} win rate).`,
        recommendation: `Prioritize setups in ${best.label} and review what is driving losses in ${worst.label}.`,
        score: diff,
      });
    }
  }

  const modelStats = buildGroupStats(trades, "modelTag", (label) => label.toLowerCase());
  const modelCandidates = modelStats.filter((stat) => stat.count >= 5);
  if (modelCandidates.length >= 2) {
    const sorted = [...modelCandidates].sort((a, b) => b.totalProfit - a.totalProfit);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    if (best && worst && best.label !== worst.label) {
      const diff = Math.abs(best.totalProfit - worst.totalProfit);
      candidates.push({
        text: `Best model tag is ${best.label} (${formatValue(best.totalProfit, profitField)}, ${formatPercent(
          best.winRate
        )} win rate, n=${formatCount(best.count)}). Worst is ${worst.label} (${formatValue(
          worst.totalProfit,
          profitField
        )}).`,
        recommendation: `Prioritize setups tagged ${best.label} and review what is underperforming in ${worst.label}.`,
        score: diff,
      });
    }
  }

  const volatilityStats = buildGroupStats(trades, "stdvBucket", (label) => label.trim());
  const volatilityCandidates = volatilityStats.filter((stat) => stat.count >= 5);
  if (volatilityCandidates.length >= 2) {
    const sorted = [...volatilityCandidates].sort((a, b) => b.totalProfit - a.totalProfit);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    if (best && worst && best.label !== worst.label) {
      const diff = Math.abs(best.totalProfit - worst.totalProfit);
      candidates.push({
        text: `Best volatility bucket is ${best.label} (${formatValue(best.totalProfit, profitField)}, ${formatPercent(
          best.winRate
        )} win rate). Worst is ${worst.label} (${formatValue(worst.totalProfit, profitField)}).`,
        recommendation: `Focus on trades that match the ${best.label} regime and tighten filters in ${worst.label} conditions.`,
        score: diff,
      });
    }
  }

  const protocolStats = buildGroupStats(trades, "protocolAlignment", (label) =>
    label.toLowerCase()
  );
  const aligned = protocolStats.find((stat) => stat.label === "aligned");
  const against = protocolStats.find((stat) => stat.label === "against");
  if (aligned && against && aligned.count >= 5 && against.count >= 5) {
    const diff = aligned.winRate - against.winRate;
    if (diff >= 10) {
      candidates.push({
        text: `Aligned trades outperform against trades (${formatPercent(aligned.winRate)} vs ${formatPercent(
          against.winRate
        )} win rate).`,
        recommendation:
          "Reduce against-protocol trades and double down on aligned setups.",
        score: diff,
      });
    }
  }

  const manipEffValues = trades
    .map((trade) => getNumericValue(trade, "manipRREfficiency"))
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const avgManipEff = averageNumbers(manipEffValues);
  if (avgManipEff !== null && manipEffValues.length >= 5 && avgManipEff < 50) {
    candidates.push({
      text: `Manipulation efficiency averages ${formatValue(avgManipEff, manipEffField)} across ${formatCount(
        manipEffValues.length
      )} trades.`,
      recommendation:
        "Refine manipulation entries or wait for cleaner liquidity grabs to improve efficiency.",
      score: 50 - avgManipEff,
    });
  }

  const exitEffValues = trades
    .map((trade) => getNumericValue(trade, "exitEfficiency"))
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const avgExitEff = averageNumbers(exitEffValues);
  if (avgExitEff !== null && exitEffValues.length >= 5 && avgExitEff < 40) {
    candidates.push({
      text: `Exit efficiency averages ${formatValue(avgExitEff, exitEffField)} across ${formatCount(
        exitEffValues.length
      )} trades.`,
      recommendation:
        "Review exit rules and consider scaling out closer to peak to improve exit timing.",
      score: 40 - avgExitEff,
    });
  }

  const captureValues = trades
    .map((trade) => getNumericValue(trade, "rrCaptureEfficiency"))
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const postExitValues = trades
    .map((trade) => getNumericValue(trade, "mpeManipPE_R"))
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const avgCapture = averageNumbers(captureValues);
  const avgPostExit = averageNumbers(postExitValues);

  if (avgCapture !== null && avgPostExit !== null && captureValues.length >= 5) {
    if (avgCapture < 40 && avgPostExit > 0.5) {
      candidates.push({
        text: `Post-exit continuation is ${formatValue(avgPostExit, postExitField)} while capture efficiency is only ${formatValue(
          avgCapture,
          captureField
        )}.`,
        recommendation:
          "Review exits and consider holding winners longer to capture more of the available R.",
        score: 40 - avgCapture,
      });
    } else if (avgCapture < 40) {
      candidates.push({
        text: `Capture efficiency averages ${formatValue(avgCapture, captureField)} across ${formatCount(
          captureValues.length
        )} trades.`,
        recommendation:
          "Tighten exit rules or scale out more systematically to improve capture efficiency.",
        score: 40 - avgCapture,
      });
    }
  }

  const plannedValues = trades
    .map((trade) => getNumericValue(trade, "plannedRR"))
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const realisedValues = trades
    .map((trade) => getNumericValue(trade, "realisedRR"))
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const maxValues = trades
    .map((trade) => getNumericValue(trade, "maxRR"))
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const avgRealised = averageNumbers(realisedValues);
  const avgMax = averageNumbers(maxValues);
  const avgPlanned = averageNumbers(plannedValues);

  if (
    avgPlanned !== null &&
    avgRealised !== null &&
    plannedValues.length >= 5 &&
    realisedValues.length >= 5
  ) {
    const gap = avgPlanned - avgRealised;
    if (gap > 0.5) {
      candidates.push({
        text: `Planned R:R averages ${formatValue(avgPlanned, plannedRRField)} while realised R:R is ${formatValue(
          avgRealised,
          realisedRRField
        )}.`,
        recommendation:
          "Adjust targets or improve trade management so realised R:R matches the plan.",
        score: gap * 10,
      });
    }
  }

  if (
    avgRealised !== null &&
    avgMax !== null &&
    avgMax > 0 &&
    realisedValues.length >= 5 &&
    maxValues.length >= 5
  ) {
    const captureRatio = avgRealised / avgMax;
    if (captureRatio < 0.6) {
      candidates.push({
        text: `Realised R averages ${formatValue(avgRealised, realisedRRField)} vs max R at ${formatValue(
          avgMax,
          maxRRField
        )}.`,
        recommendation:
          "Work on capturing more of the available R, especially on winners that reach higher max R.",
        score: (1 - captureRatio) * 100,
      });
    }
  }

  const symbolStats = buildGroupStats(trades, "symbol", (label) => label.toUpperCase());
  if (symbolStats.length >= 2) {
    const totalAbs = symbolStats.reduce((sum, stat) => sum + Math.abs(stat.totalProfit), 0);
    const sorted = [...symbolStats].sort(
      (a, b) => Math.abs(b.totalProfit) - Math.abs(a.totalProfit)
    );
    const top = sorted[0];
    if (top && totalAbs > 0) {
      const share = (Math.abs(top.totalProfit) / totalAbs) * 100;
      if (share >= 50) {
        candidates.push({
          text: `${top.label} drives ${formatPercent(share)} of total P&L (${formatValue(
            top.totalProfit,
            profitField
          )}).`,
          recommendation:
            "Lean into your strongest symbol or diversify to reduce concentration risk.",
          score: share,
        });
      }
    }
  }

  const totalCommissions = trades
    .map((trade) => getNumericValue(trade, "commissions"))
    .filter((value): value is number => value !== null && Number.isFinite(value))
    .reduce((sum, value) => sum + value, 0);
  const totalSwap = trades
    .map((trade) => getNumericValue(trade, "swap"))
    .filter((value): value is number => value !== null && Number.isFinite(value))
    .reduce((sum, value) => sum + value, 0);
  const totalCosts = Math.abs(totalCommissions + totalSwap);

  if (totalCosts > 0 && totalProfit > 0) {
    const ratio = (totalCosts / totalProfit) * 100;
    if (ratio >= 20) {
      candidates.push({
        text: `Trading costs are ${formatValue(totalCosts, profitField)}, about ${formatPercent(
          ratio
        )} of total profit.`,
        recommendation:
          "Reduce fee-heavy trades or avoid small targets where costs erode returns.",
        score: ratio,
      });
    }
  }

  const directionStats = buildGroupStats(trades, "tradeType", (label) =>
    label.toLowerCase()
  );
  const longStats = directionStats.find((stat) => stat.label === "long");
  const shortStats = directionStats.find((stat) => stat.label === "short");
  if (longStats && shortStats && longStats.count >= 5 && shortStats.count >= 5) {
    const diff = longStats.winRate - shortStats.winRate;
    if (Math.abs(diff) >= 10) {
      const better = diff > 0 ? longStats : shortStats;
      const weaker = diff > 0 ? shortStats : longStats;
      candidates.push({
        text: `${better.label} trades outperform ${weaker.label} trades (${formatPercent(
          better.winRate
        )} vs ${formatPercent(weaker.winRate)} win rate).`,
        recommendation: `Emphasize ${better.label} setups or tighten criteria on ${weaker.label} trades.`,
        score: Math.abs(diff),
      });
    }
  }

  const ranked = candidates.sort((a, b) => b.score - a.score);
  const insights = ranked.slice(0, 3).map((item) => item.text);
  const recommendations = ranked
    .filter((item) => item.recommendation)
    .slice(0, 3)
    .map((item) => item.recommendation as string);

  if (insights.length === 0 && profits.length > 0) {
    insights.push(
      `Overall result is ${formatValue(totalProfit, profitField)} across ${formatCount(
        profits.length
      )} trades.`
    );
  }

  if (recommendations.length === 0 && profits.length > 0) {
    recommendations.push(
      "Keep tracking more trades and tag sessions or models so we can surface stronger improvement signals."
    );
  }

  return { insights, recommendations };
}

export function buildImprovementsFromTrades(
  trades: Record<string, any>[]
): ImprovementRow[] {
  const now = Date.now();
  const lastStart = now - 30 * 24 * 60 * 60 * 1000;
  const prevStart = now - 60 * 24 * 60 * 60 * 1000;

  const dated = trades
    .map((trade) => ({ trade, time: getTradeTime(trade) }))
    .filter((item) => item.time !== null) as Array<{
    trade: Record<string, any>;
    time: number;
  }>;

  const lastTrades = dated
    .filter((item) => item.time >= lastStart && item.time <= now)
    .map((item) => item.trade);
  const prevTrades = dated
    .filter((item) => item.time >= prevStart && item.time < lastStart)
    .map((item) => item.trade);

  if (lastTrades.length < 5 || prevTrades.length < 5) {
    return [];
  }

  const metrics: Array<{
    key: string;
    label: string;
    compute: (items: Record<string, any>[]) => number | null;
    format: (value: number) => string;
  }> = [
    {
      key: "win_rate",
      label: "Win rate (last 30d)",
      compute: (items) => computeWinRate(items),
      format: (value) => formatPercent(value),
    },
    {
      key: "avg_profit",
      label: "Average profit (last 30d)",
      compute: (items) => averageFromField(items, "profit"),
      format: (value) => formatValue(value, FIELD_MAP.get("profit")),
    },
    {
      key: "avg_realised_rr",
      label: "Average realised r:r (last 30d)",
      compute: (items) => averageFromField(items, "realisedRR"),
      format: (value) => formatValue(value, FIELD_MAP.get("realisedRR")),
    },
    {
      key: "capture_efficiency",
      label: "Capture efficiency (last 30d)",
      compute: (items) => averageFromField(items, "rrCaptureEfficiency"),
      format: (value) => formatValue(value, FIELD_MAP.get("rrCaptureEfficiency")),
    },
    {
      key: "avg_hold_time",
      label: "Average hold time (last 30d)",
      compute: (items) => averageFromField(items, "tradeDurationSeconds"),
      format: (value) => formatValue(value, FIELD_MAP.get("tradeDurationSeconds")),
    },
  ];

  const rows: ImprovementRow[] = [];

  metrics.forEach((metric) => {
    const lastValue = metric.compute(lastTrades);
    const prevValue = metric.compute(prevTrades);
    if (lastValue === null || prevValue === null) return;
    if (!Number.isFinite(lastValue) || !Number.isFinite(prevValue)) return;

    const delta = lastValue - prevValue;
    rows.push({
      label: metric.label,
      value: metric.format(lastValue),
      note: `Change: ${formatMetricDelta(metric.key, delta)} vs prior 30d`,
    });
  });

  return rows;
}

export function getTradeTime(row: Record<string, any>): number | null {
  const value = row.open ?? row.openedAt ?? row.close ?? row.closedAt;
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

export function tradeMatchesFilters(
  row: Record<string, any>,
  filters: Filter[]
): boolean {
  return filters.every((filter) => {
    const raw = row[filter.field];
    if (filter.op === "between" && "from" in filter.value) {
      const value = raw instanceof Date ? raw.getTime() : new Date(raw).getTime();
      const from = new Date(filter.value.from).getTime();
      const to = new Date(filter.value.to).getTime();
      if (Number.isNaN(value) || Number.isNaN(from) || Number.isNaN(to)) return false;
      return value >= from && value <= to;
    }

    if (filter.op === "contains") {
      return String(raw || "")
        .toLowerCase()
        .includes(String(filter.value || "").toLowerCase());
    }

    if (filter.op === "in") {
      const list = Array.isArray(filter.value) ? filter.value : [filter.value];
      return list.map(String).includes(String(raw));
    }

    const numericValue =
      typeof filter.value === "number" ? filter.value : parseFloat(String(filter.value));
    const numericRaw = typeof raw === "number" ? raw : parseFloat(String(raw));
    const compareRaw = Number.isNaN(numericRaw) ? raw : numericRaw;
    const compareValue = Number.isNaN(numericValue) ? filter.value : numericValue;

    if (filter.op === "eq" && filter.field === "symbol") {
      return String(raw || "")
        .toLowerCase()
        .includes(String(filter.value || "").toLowerCase());
    }

    switch (filter.op) {
      case "eq":
        return String(compareRaw) === String(compareValue);
      case "neq":
        return String(compareRaw) !== String(compareValue);
      case "gt":
        return Number(compareRaw) > Number(compareValue);
      case "gte":
        return Number(compareRaw) >= Number(compareValue);
      case "lt":
        return Number(compareRaw) < Number(compareValue);
      case "lte":
        return Number(compareRaw) <= Number(compareValue);
      default:
        return true;
    }
  });
}

export function computeAggregateFromTrades(
  trades: Record<string, any>[],
  metric: { field: string; agg: string }
): number | null {
  if (metric.agg === "count") {
    return trades.length;
  }

  const values = trades
    .map((trade) => getNumericValue(trade, metric.field))
    .filter((value): value is number => value !== null && !Number.isNaN(value));

  if (values.length === 0) return null;

  switch (metric.agg) {
    case "sum":
      return values.reduce((sum, value) => sum + value, 0);
    case "avg":
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    case "min":
      return Math.min(...values);
    case "max":
      return Math.max(...values);
    case "p50":
      return percentile(values, 50);
    case "p90":
      return percentile(values, 90);
    default:
      return null;
  }
}

export function standardize(points: number[][]): number[][] {
  const dims = points[0]?.length || 0;
  const means = new Array(dims).fill(0);
  const stdevs = new Array(dims).fill(0);

  for (const point of points) {
    point.forEach((value, index) => {
      means[index] += value;
    });
  }
  means.forEach((sum, index) => {
    means[index] = sum / points.length;
  });

  for (const point of points) {
    point.forEach((value, index) => {
      stdevs[index] += Math.pow(value - means[index], 2);
    });
  }
  stdevs.forEach((sum, index) => {
    stdevs[index] = Math.sqrt(sum / points.length) || 1;
  });

  return points.map((point) =>
    point.map((value, index) => (value - means[index]) / stdevs[index])
  );
}

export function runKMeans(
  points: number[][],
  k: number,
  iterations = 15
): { assignments: number[] } {
  const centroids = points.slice(0, k).map((point) => [...point]);
  let assignments = new Array(points.length).fill(0);

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    assignments = points.map((point) => {
      let best = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      centroids.forEach((centroid, index) => {
        const dist = centroid.reduce((sum, centroidValue, dim) => {
          return sum + Math.pow(point[dim] - centroidValue, 2);
        }, 0);
        if (dist < bestDist) {
          bestDist = dist;
          best = index;
        }
      });
      return best;
    });

    const sums = centroids.map(() => new Array(points[0].length).fill(0));
    const counts = centroids.map(() => 0);

    points.forEach((point, index) => {
      const cluster = assignments[index];
      counts[cluster] += 1;
      point.forEach((value, dim) => {
        sums[cluster][dim] += value;
      });
    });

    centroids.forEach((centroid, index) => {
      const count = counts[index] || 1;
      centroid.forEach((_, dim) => {
        centroid[dim] = sums[index][dim] / count;
      });
    });
  }

  return { assignments };
}

export function buildClusterSummaries(
  trades: Record<string, any>[],
  assignments: number[]
): Array<Record<string, any>> {
  const clusters: Record<number, Record<string, any>[]> = {};
  trades.forEach((trade, index) => {
    const clusterId = assignments[index];
    clusters[clusterId] = clusters[clusterId] || [];
    clusters[clusterId].push(trade);
  });

  const overall = {
    hold: averageField(trades, "tradeDurationSeconds"),
    capture: averageField(trades, "rrCaptureEfficiency"),
    mfe: averageField(trades, "mfePips"),
    stdv: averageField(trades, "rawSTDV"),
  };

  return Object.entries(clusters).map(([clusterId, clusterTrades]) => {
    const avgHold = averageField(clusterTrades, "tradeDurationSeconds");
    const avgCapture = averageField(clusterTrades, "rrCaptureEfficiency");
    const avgMfe = averageField(clusterTrades, "mfePips");
    const avgStdv = averageField(clusterTrades, "rawSTDV");
    const avgRealised = averageField(clusterTrades, "realisedRR");

    return {
      state: labelCluster({
        avgHold,
        avgCapture,
        avgMfe,
        avgStdv,
        overall,
      }),
      trades: clusterTrades.length,
      avg_hold_time: avgHold,
      avg_capture_efficiency: avgCapture,
      avg_mfe: avgMfe,
      avg_volatility: avgStdv,
      avg_realised_rr: avgRealised,
    };
  });
}

export function buildPersonaRows(
  trades: Record<string, any>[],
  metrics: Array<{ field: string; agg: string }>,
  windowDays: number,
  startTime: number,
  endTime: number
): Array<Record<string, any>> {
  const windowMs = windowDays * 24 * 60 * 60 * 1000;

  const rows: Array<Record<string, any>> = [];
  let windowEnd = endTime;

  while (windowEnd > startTime) {
    const windowStart = windowEnd - windowMs;
    const windowTrades = trades.filter((trade) => {
      const time = getTradeTime(trade);
      if (!time) return false;
      return time > windowStart && time <= windowEnd;
    });

    const row: Record<string, any> = {
      window: formatWindowLabel(windowStart, windowEnd),
      trades: windowTrades.length,
    };

    metrics.forEach((metric) => {
      const key = `${metric.agg}_${toSnakeCase(metric.field)}`;
      row[key] = computeAggregateFromTrades(windowTrades, metric);
    });

    rows.push(row);
    windowEnd = windowStart;
  }

  return rows;
}

function computeWinRate(items: Record<string, any>[]): number | null {
  if (items.length === 0) return null;
  const wins = items.filter((item) =>
    isWinTrade(item, getNumericValue(item, "profit") ?? undefined)
  );
  return (wins.length / items.length) * 100;
}

function averageFromField(
  items: Record<string, any>[],
  field: string
): number | null {
  const values = items
    .map((item) => getNumericValue(item, field))
    .filter((value): value is number => value !== null && Number.isFinite(value));
  return averageNumbers(values);
}

function formatMetricDelta(metricKey: string, delta: number): string {
  const sign = delta > 0 ? "+" : delta < 0 ? "-" : "";
  const absDelta = Math.abs(delta);

  switch (metricKey) {
    case "win_rate":
      return `${sign}${formatPercent(absDelta)}`;
    case "avg_profit":
      return `${sign}${formatValue(absDelta, FIELD_MAP.get("profit"))}`;
    case "avg_realised_rr":
      return `${sign}${formatValue(absDelta, FIELD_MAP.get("realisedRR"))}`;
    case "capture_efficiency":
      return `${sign}${formatValue(absDelta, FIELD_MAP.get("rrCaptureEfficiency"))}`;
    case "avg_hold_time":
      return `${sign}${formatValue(absDelta, FIELD_MAP.get("tradeDurationSeconds"))}`;
    default:
      return `${sign}${absDelta.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })}`;
  }
}

function buildGroupStats(
  trades: Record<string, any>[],
  field: string,
  normalizeLabel?: (label: string) => string
): GroupStats[] {
  const map = new Map<string, GroupStats>();
  for (const tradeRow of trades) {
    const raw = tradeRow[field];
    if (raw === null || raw === undefined) continue;
    const label = String(raw).trim();
    if (!label) continue;
    const key = normalizeLabel ? normalizeLabel(label) : label.toLowerCase();

    let stats = map.get(key);
    if (!stats) {
      stats = {
        label: normalizeLabel ? normalizeLabel(label) : label,
        count: 0,
        wins: 0,
        winRate: 0,
        totalProfit: 0,
        avgProfit: 0,
      };
      map.set(key, stats);
    }

    const profit = getNumericValue(tradeRow, "profit") ?? 0;
    stats.count += 1;
    stats.totalProfit += profit;
    if (isWinTrade(tradeRow, profit)) {
      stats.wins += 1;
    }
  }

  return Array.from(map.values()).map((stats) => ({
    ...stats,
    winRate: stats.count > 0 ? (stats.wins / stats.count) * 100 : 0,
    avgProfit: stats.count > 0 ? stats.totalProfit / stats.count : 0,
  }));
}

function buildHoldTimeStats(trades: Record<string, any>[]): GroupStats[] {
  const buckets = new Map<string, GroupStats>();

  for (const tradeRow of trades) {
    const duration = getNumericValue(tradeRow, "tradeDurationSeconds");
    if (duration === null || !Number.isFinite(duration)) continue;

    const label =
      duration < 4 * 3600 ? "under 4h" : duration < 24 * 3600 ? "4-24h" : "over 24h";

    let stats = buckets.get(label);
    if (!stats) {
      stats = {
        label,
        count: 0,
        wins: 0,
        winRate: 0,
        totalProfit: 0,
        avgProfit: 0,
      };
      buckets.set(label, stats);
    }

    const profit = getNumericValue(tradeRow, "profit") ?? 0;
    stats.count += 1;
    stats.totalProfit += profit;
    if (isWinTrade(tradeRow, profit)) {
      stats.wins += 1;
    }
  }

  return Array.from(buckets.values()).map((stats) => ({
    ...stats,
    winRate: stats.count > 0 ? (stats.wins / stats.count) * 100 : 0,
    avgProfit: stats.count > 0 ? stats.totalProfit / stats.count : 0,
  }));
}

function isWinTrade(tradeRow: Record<string, any>, profit?: number): boolean {
  const resolvedProfit =
    typeof profit === "number" ? profit : getNumericValue(tradeRow, "profit");
  if (resolvedProfit !== null && Number.isFinite(resolvedProfit)) {
    return resolvedProfit > 0;
  }
  const outcome = String(tradeRow.outcome || "").toLowerCase();
  return outcome === "win" || outcome === "pw";
}

function averageNumbers(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const hasDecimal = Math.abs(rounded % 1) > 0;
  return `${rounded.toLocaleString(undefined, {
    minimumFractionDigits: hasDecimal ? 1 : 0,
    maximumFractionDigits: 1,
  })}%`;
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

export function getNumericValue(
  row: Record<string, any>,
  field: string
): number | null {
  const raw = row[field];
  if (raw === null || raw === undefined) return null;
  const num = typeof raw === "number" ? raw : parseFloat(String(raw));
  return Number.isNaN(num) ? null : num;
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

function averageField(trades: Record<string, any>[], field: string): number {
  const values = trades
    .map((trade) => getNumericValue(trade, field))
    .filter((value): value is number => value !== null && !Number.isNaN(value));
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function labelCluster(args: {
  avgHold: number;
  avgCapture: number;
  avgMfe: number;
  avgStdv: number;
  overall: { hold: number; capture: number; mfe: number; stdv: number };
}): string {
  const descriptors: string[] = [];
  const { avgHold, avgCapture, avgMfe, avgStdv, overall } = args;

  if (overall.hold && avgHold <= overall.hold * 0.75) descriptors.push("fast-exit");
  if (overall.hold && avgHold >= overall.hold * 1.25) descriptors.push("patient");
  if (overall.capture && avgCapture >= overall.capture * 1.2) descriptors.push("high-capture");
  if (overall.capture && avgCapture <= overall.capture * 0.8) descriptors.push("low-capture");
  if (overall.mfe && avgMfe >= overall.mfe * 1.2) descriptors.push("high-mfe");
  if (overall.stdv && avgStdv >= overall.stdv * 1.2) descriptors.push("high-volatility");

  if (descriptors.length === 0) return "balanced";
  return descriptors.slice(0, 2).join(" / ");
}
