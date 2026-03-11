/**
 * Answer Assembler
 *
 * Formats execution results into human-readable answers with:
 * - Direct answer (numbers + units)
 * - How it was computed
 * - Filters used
 * - Caveats (sample size, missing data)
 */

import type { ExecutionResult } from "./query-executor";
import type { TradeQueryPlan } from "./query-plan";
import { getGuardrailStatus } from "./guardrails";
import type { CondensedProfile } from "./engine/types";

export interface FormattedAnswer {
  markdown: string;
  data: any;
}

/**
 * Assemble a profile summary answer (short-circuit for profile queries)
 */
export function assembleProfileAnswer(
  profile: CondensedProfile
): FormattedAnswer {
  let md = `### Your Trading Profile\n\n`;

  md += `**Overall:** ${profile.totalTrades} trades | ${profile.winRate.toFixed(1)}% win rate | PF ${profile.profitFactor.toFixed(2)} | Expectancy $${profile.expectancy.toFixed(2)}\n\n`;

  if (profile.bestSessions.length > 0) {
    md += `**Best sessions:** ${profile.bestSessions.join(", ")}\n\n`;
  }
  if (profile.worstSessions.length > 0) {
    md += `**Weakest sessions:** ${profile.worstSessions.join(", ")}\n\n`;
  }
  if (profile.bestSymbols.length > 0) {
    md += `**Best symbols:** ${profile.bestSymbols.join(", ")}\n\n`;
  }
  if (profile.worstSymbols.length > 0) {
    md += `**Weakest symbols:** ${profile.worstSymbols.join(", ")}\n\n`;
  }

  md += `**R:R sweet spot:** ${profile.rrSweetSpot}\n\n`;
  md += `**Hold time sweet spot:** ${profile.holdTimeSweetSpot}\n\n`;

  if (profile.topEdges.length > 0) {
    md += `### Your Edges\n\n`;
    profile.topEdges.forEach((e, i) => {
      md += `${i + 1}. ${e}\n`;
    });
    md += `\n`;
  }

  if (profile.topLeaks.length > 0) {
    md += `### Your Leaks\n\n`;
    profile.topLeaks.forEach((l, i) => {
      md += `${i + 1}. ${l}\n`;
    });
    md += `\n`;
  }

  if (profile.leavingProfitOnTable) {
    md += `### Money Left on the Table\n\n`;
    if (profile.pctExitingTooEarly > 0) {
      md += `**${profile.pctExitingTooEarly.toFixed(0)}%** of your trades continued running in your favor after you closed them.\n\n`;
    }
    if (profile.avgPostExitMove > 0) {
      md += `Price moved an average of **${profile.avgPostExitMove.toFixed(1)} points** in your favor after exit.\n\n`;
    }
    if (profile.avgProfitLeftPips > 0) {
      md += `You're capturing less than your peak favorable excursion by an average of **${profile.avgProfitLeftPips.toFixed(1)} points** per trade.\n\n`;
    }
    md += `Consider trailing stops or partial closes to capture more of these moves.\n\n`;
  }

  md += `**Current streak:** ${profile.currentStreak}\n\n`;

  return { markdown: md, data: profile };
}

/**
 * Assemble a complete answer from execution result
 */
export function assembleAnswer(
  result: ExecutionResult,
  plan: TradeQueryPlan,
  context?: { userMessage?: string; profile?: CondensedProfile }
): FormattedAnswer {
  if (!result.success) {
    return {
      markdown: `### Error\n\n${result.error || "Unknown error occurred"}`,
      data: null,
    };
  }

  let answer: FormattedAnswer;

  switch (plan.intent) {
    case "aggregate":
      answer = assembleAggregateAnswer(result, plan, context?.userMessage);
      break;
    case "compare":
      answer = assembleCompareAnswer(result, plan);
      break;
    case "list_trades":
      answer = assembleListAnswer(result, plan);
      break;
    case "diagnose":
      answer = assembleDiagnoseAnswer(result, plan);
      break;
    case "recommendation":
      answer = assembleRecommendationAnswer(result, plan);
      break;
    default:
      answer = {
        markdown: `### Result\n\n${JSON.stringify(result.data, null, 2)}`,
        data: result.data,
      };
      break;
  }

  const guardrail = getGuardrailStatus(result, plan);
  if (guardrail) {
    return {
      markdown: `### I don't know yet\n\n${guardrail.message}\n\n`,
      data: answer.data,
    };
  }

  const followUp = guardrail ? null : getSuggestedFollowUp(result, plan);
  if (followUp) {
    answer.markdown += `### Suggested follow-up\n\n${followUp}\n\n`;
  }

  answer.markdown = cleanupMarkdown(answer.markdown);

  return answer;
}

function isTimeSeriesGroupField(field?: string): boolean {
  return (
    field === "open" ||
    field === "close" ||
    field === "openedAt" ||
    field === "closedAt" ||
    field === "date"
  );
}

/**
 * Assemble aggregate answer
 */
function assembleAggregateAnswer(
  result: ExecutionResult,
  plan: TradeQueryPlan,
  userMessage?: string
): FormattedAnswer {
  const meta = result.meta!;
  let markdown = `### ${trimTitlePunctuation(sentenceCase(plan.explanation))}\n\n`;
  let hasPrimaryContent = false;

  // Main results
  if (plan.vizType === "win_rate_card" && result.meta?.aggregates) {
    const aggregates = result.meta.aggregates;
    const winRate = aggregates.win_rate ?? aggregates.winrate;
    if (winRate !== undefined) {
      markdown += `${formatAggregateValue("win_rate", winRate)}\n\n`;
      hasPrimaryContent = true;
    }
  } else if (result.meta?.aggregates) {
    for (const [key, value] of Object.entries(result.meta.aggregates)) {
      const label = sentenceCase(
        key
          .replace(/_/g, " ")
          .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
          .replace(/\s+/g, " ")
          .trim()
      );
      markdown += `**${label}:** ${formatAggregateValue(key, value)}\n`;
      hasPrimaryContent = true;
    }
    markdown += "\n";
  } else if (result.data?.count !== undefined) {
    markdown += `**Count:** ${formatCount(result.data.count)} trades\n\n`;
    hasPrimaryContent = true;
  }

  if (
    userMessage &&
    isMetricComparisonQuery(userMessage) &&
    result.meta?.aggregates
  ) {
    const entries = Object.entries(result.meta.aggregates).filter(
      ([, value]) => value !== null && value !== undefined
    );
    if (entries.length >= 2) {
      const [firstKey, firstValue] = entries[0];
      const [secondKey, secondValue] = entries[1];
      const firstNum = Number(firstValue);
      const secondNum = Number(secondValue);
      if (Number.isFinite(firstNum) && Number.isFinite(secondNum)) {
        const delta = firstNum - secondNum;
        const deltaPercent =
          secondNum !== 0 ? (delta / secondNum) * 100 : 0;
        markdown += `### Difference\n\n`;
        markdown += `${formatAggregateValue(
          firstKey,
          delta
        )} (${deltaPercent.toFixed(1)}%)\n\n`;
        const firstLabel = formatFieldLabel(firstKey);
        const secondLabel = formatFieldLabel(secondKey);
        const direction = delta > 0 ? "higher" : "lower";
        markdown += `### Interpretation\n\n`;
        markdown += `${firstLabel} is ${direction} than ${secondLabel} (${Math.abs(
          deltaPercent
        ).toFixed(1)}% ${direction}).\n\n`;
      }
    }
  }

  if (plan.vizType === "weekday_performance" && result.meta?.groups) {
    const groups = result.meta.groups;
    if (groups.length > 0) {
      const dayValueField =
        plan.aggregates?.[0]?.as ||
        Object.keys(groups[0] || {}).find((key) => key !== "open") ||
        "";
      const aggregatedByWeekday: Record<string, number> = {};
      for (const row of groups) {
        const rawValue = Number(row[dayValueField] ?? 0);
        const rawDay = row.open ?? row.date ?? row.close ?? row.day;
        const weekday = formatWeekdayLabel(rawDay);
        aggregatedByWeekday[weekday] =
          (aggregatedByWeekday[weekday] ?? 0) + rawValue;
      }
      const top = Object.entries(aggregatedByWeekday).reduce<
        { label: string; value: number } | null
      >((best, [label, value]) => {
        if (!best || value > best.value) return { label, value };
        return best;
      }, null);
      if (top) {
        markdown += `Most profitable day: ${sentenceCase(top.label)} (${formatAggregateValue("profit", top.value)})\n\n`;
        hasPrimaryContent = true;
      }
    }
  }

  if (plan.vizType === "daily_pnl" && result.meta?.groups) {
    const groups = result.meta.groups;
    const valueField =
      plan.aggregates?.[0]?.as ||
      Object.keys(groups[0] || {}).find((key) => key !== (plan.groupBy?.[0]?.field || "")) ||
      "";
    if (valueField) {
      const total = groups.reduce(
        (sum: number, row: Record<string, any>) =>
          sum + Number(row[valueField] ?? 0),
        0
      );
      markdown += `Total profit: ${formatAggregateValue("profit", total)}\n\n`;
      hasPrimaryContent = true;
    }
  }

  if (plan.groupBy && plan.groupBy.length > 0) {
    const groups = result.meta?.groups || [];
    if (groups.length > 0) {
      const groupField = plan.groupBy[0].field;
      const valueField =
        plan.aggregates?.[0]?.as ||
        Object.keys(groups[0] || {}).find((key) => key !== groupField) ||
        "";
      const topRow = groups[0] || {};
      const groupValue = formatGroupValue(topRow[groupField], groupField);
      const value = valueField
        ? formatAggregateValue(valueField, topRow[valueField])
        : "—";
      markdown += `Top result: ${groupValue} (${value})\n\n`;
      hasPrimaryContent = true;

      if (
        plan.displayMode === "singular" &&
        !isTimeSeriesGroupField(groupField) &&
        groups.length > 1
      ) {
        const runnerUps = groups.slice(1, 4);
        if (runnerUps.length > 0) {
          markdown += `### Context\n\n`;
          runnerUps.forEach((row) => {
            const label = formatGroupValue(row[groupField], groupField);
            const rowValue = valueField
              ? formatAggregateValue(valueField, row[valueField])
              : "—";
            markdown += `- ${label}: ${rowValue}\n`;
          });
          markdown += "\n";
        }
      }
    } else {
      markdown += `No data available for this breakdown\n\n`;
      hasPrimaryContent = true;
    }
  }

  if (!hasPrimaryContent) {
    markdown += "No data available for this request\n\n";
  }

  const negativeEvidence = getNegativeEvidenceItems(
    result,
    plan,
    userMessage
  );
  if (negativeEvidence.length > 0) {
    markdown += `### Why it may not be working\n\n`;
    negativeEvidence.forEach((item) => {
      markdown += `- ${item}\n`;
    });
    markdown += "\n";
  }

  // Sample size
  markdown += `### Sample size\n\n${formatCount(meta.rowCount)} trades\n\n`;

  // Timeframe
  if (meta.timeframe) {
    markdown += `### Timeframe\n\n${meta.timeframe}\n\n`;
  }

  // Filters
  if (meta.filters && meta.filters.length > 0) {
    markdown += `### Filters\n\n`;
    meta.filters.forEach((filter) => {
      markdown += `- ${filter}\n`;
    });
    markdown += "\n";
  }

  // Grouped results
  if (result.meta?.groups && result.meta.groups.length > 0) {
    markdown += `### Breakdown\n\n`;
    const groups = result.meta.groups;

    // Create a simple table
    if (groups.length > 0) {
      const headers = Object.keys(groups[0]);
      const headerLabels = headers.map((header) => formatFieldLabel(header));
      markdown += `| ${headerLabels.join(" | ")} |\n`;
      markdown += `| ${headers.map(() => "---").join(" | ")} |\n`;

      groups.forEach((row: Record<string, any>) => {
        const formatted = headers.map((h) =>
          formatBreakdownValue(row[h], h)
        );
        markdown += `| ${formatted.join(" | ")} |\n`;
      });
      markdown += "\n";
    }
  }

  return { markdown, data: result.data };
}

function formatFieldLabel(key: string): string {
  const cleaned = key
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  return sentenceCase(cleaned);
}

function formatBreakdownValue(value: any, column: string): string {
  if (value === null || value === undefined) return "—";
  const columnLower = column.toLowerCase().replace(/[\s_]/g, "");

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (isDateColumn(columnLower)) {
      const date = new Date(trimmed);
      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        });
      }
    }

    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      value = Number(trimmed);
    } else {
      return value;
    }
  }

  if (
    ["profit", "loss", "pnl", "balance", "commission", "commissions", "swap"].some(
      (key) => columnLower.includes(key)
    )
  ) {
    const sign = value < 0 ? "-$" : "$";
    return `${sign}${Math.abs(value).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  }

  if (typeof value === "number") {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  return String(value);
}

function formatGroupValue(value: any, column: string): string {
  if (value === null || value === undefined) return "Unknown";
  const columnLower = column.toLowerCase().replace(/[\s_]/g, "");
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (isDateColumn(columnLower)) {
      const date = new Date(trimmed);
      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        });
      }
    }
  }
  return String(value);
}

function formatAggregateValue(key: string, value: any): string {
  if (value === null || value === undefined) return "—";
  const keyLower = key.toLowerCase().replace(/[\s_]/g, "");
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      value = Number(trimmed);
    } else {
      return value;
    }
  }

  if (
    ["profit", "loss", "pnl", "balance", "commission", "commissions", "swap"].some(
      (k) => keyLower.includes(k)
    )
  ) {
    const sign = value < 0 ? "-$" : "$";
    return `${sign}${Math.abs(value).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  }

  if (
    keyLower.includes("rate") ||
    keyLower.includes("percent") ||
    keyLower.includes("efficiency")
  ) {
    const num = Number(value);
    if (Number.isFinite(num) && num % 1 === 0) {
      return `${num.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })}%`;
    }
    return `${num.toLocaleString(undefined, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}%`;
  }

  if (
    keyLower.includes("hold") ||
    keyLower.includes("duration") ||
    keyLower.includes("seconds")
  ) {
    return formatDurationSeconds(Number(value));
  }

  if (typeof value === "number") {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  return String(value);
}

function formatDurationSeconds(value: number): string {
  const total = Math.max(0, Math.round(value));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

function formatWeekdayLabel(value: any): string {
  if (value === null || value === undefined) return "Unknown";
  const raw = String(value);
  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleDateString("en-US", { weekday: "short" });
  }
  return raw;
}

function trimTitlePunctuation(value: string): string {
  return value.replace(/[.?!:]+$/g, "").trim();
}

function isDateColumn(columnLower: string): boolean {
  return (
    columnLower.includes("open") ||
    columnLower.includes("close") ||
    columnLower.includes("date") ||
    columnLower.includes("time")
  );
}

/**
 * Assemble compare answer
 */
function assembleCompareAnswer(
  result: ExecutionResult,
  plan: TradeQueryPlan
): FormattedAnswer {
  const meta = result.meta!;
  const data = result.data!;

  let markdown = `### ${sentenceCase(plan.explanation)}\n\n`;

  const comparisonMetric =
    plan.compare?.metric.field || plan.temporal?.metric.field || "metric";
  const labelA = plan.compare?.a.label || data.a.label;
  const labelB = plan.compare?.b.label || data.b.label;
  const formattedA = formatAggregateValue(comparisonMetric, data.a.value);
  const formattedB = formatAggregateValue(comparisonMetric, data.b.value);
  const formattedDelta = formatAggregateValue(comparisonMetric, data.delta);

  markdown += `### Comparison\n\n`;
  markdown += `${labelA}: ${formattedA}\n\n`;
  markdown += `${labelB}: ${formattedB}\n\n`;

  markdown += `### Difference\n\n`;
  markdown += `${formattedDelta} (${data.deltaPercent})\n\n`;

  // Interpretation
  const deltaNum = toNumericValue(data.delta);
  const direction = deltaNum > 0 ? "higher" : "lower";
  const absPercent = Math.abs(parseFloat(data.deltaPercent));

  markdown += `### Interpretation\n\n`;
  markdown += `${labelA} has ${direction} ${comparisonMetric} `;
  markdown += `compared to ${labelB} (${absPercent.toFixed(
    1
  )}% ${direction}).\n\n`;

  markdown += `### Sample size\n\n`;
  markdown += `${labelA}: ${formatCount(data.a.count)} trades\n`;
  markdown += `${labelB}: ${formatCount(data.b.count)} trades\n\n`;

  // Timeframe
  if (meta.timeframe) {
    markdown += `### Timeframe\n\n${meta.timeframe}\n\n`;
  }

  if (meta.filters && meta.filters.length > 0) {
    markdown += `### Filters\n\n`;
    meta.filters.forEach((filter) => {
      markdown += `- ${filter}\n`;
    });
    markdown += "\n";
  }

  // Caveats
  if (meta.caveats && meta.caveats.length > 0) {
    markdown += `### Caveats\n\n`;
    meta.caveats.forEach((note) => {
      markdown += `- ${note}\n`;
    });
    markdown += "\n";
  }

  return { markdown, data: result.data };
}

/**
 * Assemble list answer
 */
function assembleListAnswer(
  result: ExecutionResult,
  plan: TradeQueryPlan
): FormattedAnswer {
  const meta = result.meta!;
  const trades = result.data as any[];

  let markdown = `### ${sentenceCase(plan.explanation)}\n\n`;
  markdown += `Found ${formatCount(trades.length)} trades\n\n`;

  // Show summary info
  if (trades.length > 0) {
    if (trades.length > 10) {
      markdown += `Showing first 10 of ${formatCount(trades.length)} trades:\n\n`;
    }

    // Show first 10 trades
    const displayTrades = trades.slice(0, 10);
    displayTrades.forEach((trade, idx) => {
      markdown += `${idx + 1}. ${trade.symbol} ${trade.tradeType} - `;
      markdown += `${trade.outcome} - `;
      markdown += `${formatAggregateValue("profit", trade.profit || 0)}\n`;
    });
    markdown += `\n`;
  }

  // Filters
  if (meta.filters && meta.filters.length > 0) {
    markdown += `### Filters\n\n`;
    meta.filters.forEach((f) => (markdown += `- ${f}\n`));
    markdown += "\n";
  }

  // Timeframe
  if (meta.timeframe) {
    markdown += `### Timeframe\n\n${meta.timeframe}\n\n`;
  }

  // Sample size
  markdown += `### Sample size\n\n${formatCount(meta.rowCount)} trades\n\n`;

  return { markdown, data: result.data };
}

/**
 * Assemble diagnose answer
 */
function assembleDiagnoseAnswer(
  result: ExecutionResult,
  plan: TradeQueryPlan
): FormattedAnswer {
  if (plan.hiddenState && Array.isArray(result.data)) {
    const rows = result.data as Array<Record<string, any>>;
    let markdown = `### ${sentenceCase(plan.explanation)}\n\n`;

    if (rows.length === 0) {
      markdown += "No data available for this request\n\n";
    } else {
      const sorted = [...rows].sort(
        (a, b) => Number(b.trades || 0) - Number(a.trades || 0)
      );
      sorted.forEach((row) => {
        markdown += `- ${sentenceCase(String(row.state || "state"))} (${formatCount(row.trades)} trades): `;
        markdown += `avg hold time ${formatAggregateValue(
          "tradeDurationSeconds",
          row.avg_hold_time
        )}, `;
        markdown += `avg capture ${formatAggregateValue(
          "rrCaptureEfficiency",
          row.avg_capture_efficiency
        )}\n`;
      });
      markdown += "\n";
    }

    markdown += `### Sample size\n\n${formatCount(result.meta?.rowCount ?? 0)} trades\n\n`;
    if (result.meta?.timeframe) {
      markdown += `### Timeframe\n\n${result.meta.timeframe}\n\n`;
    }

    return { markdown, data: result.data };
  }

  if (plan.persona && Array.isArray(result.data)) {
    const rows = result.data as Array<Record<string, any>>;
    let markdown = `### ${sentenceCase(plan.explanation)}\n\n`;

    if (rows.length === 0) {
      markdown += "No data available for this request\n\n";
    } else {
      const latest = rows[0];
      markdown += `Latest window (${latest.window}):\n\n`;
      Object.entries(latest).forEach(([key, value]) => {
        if (key === "window") return;
        markdown += `- ${sentenceCase(key.replace(/_/g, " "))}: ${formatAggregateValue(
          key,
          value
        )}\n`;
      });
      markdown += "\n";
    }

    markdown += `### Sample size\n\n${formatCount(result.meta?.rowCount ?? 0)} trades\n\n`;
    if (result.meta?.timeframe) {
      markdown += `### Timeframe\n\n${result.meta.timeframe}\n\n`;
    }

    return { markdown, data: result.data };
  }

  return assembleAggregateAnswer(result, plan);
}

/**
 * Assemble recommendation answer
 */
function assembleRecommendationAnswer(
  result: ExecutionResult,
  plan: TradeQueryPlan
): FormattedAnswer {
  const improvements = Array.isArray(result.data?.improvements)
    ? result.data.improvements
    : [];
  const insights = Array.isArray(result.data?.insights)
    ? result.data.insights
    : [];
  const recommendations = Array.isArray(result.data?.recommendations)
    ? result.data.recommendations
    : [];

  if (improvements.length > 0 || insights.length > 0 || recommendations.length > 0) {
    let markdown = `### ${trimTitlePunctuation(sentenceCase(plan.explanation))}\n\n`;

    if (improvements.length > 0) {
      markdown += `### Improvements\n\n`;
      markdown += `${improvements
        .map((row: { label: string; value: string; note?: string }) => {
          const note = row.note ? ` (${row.note})` : "";
          return `- ${row.label}: ${row.value}${note}`;
        })
        .join("\n")}\n\n`;
    }

    if (insights.length > 0) {
      markdown += `### Insights\n\n`;
      markdown += `${insights.map((item: string) => `- ${item}`).join("\n")}\n\n`;
    }

    if (recommendations.length > 0) {
      markdown += `### Recommendations\n\n`;
      markdown += `${recommendations
        .map((item: string) => `- ${item}`)
        .join("\n")}\n\n`;
    }

    if (result.meta?.filters?.length) {
      markdown += `### Filters\n\n`;
      markdown += `${result.meta.filters
        .map((item: string) => `- ${item}`)
        .join("\n")}\n\n`;
    }

    if (result.meta?.rowCount !== undefined) {
      markdown += `### Sample size\n\n${formatCount(result.meta.rowCount)} trades\n\n`;
    }

    if (result.meta?.timeframe) {
      markdown += `### Timeframe\n\n${result.meta.timeframe}\n\n`;
    }

    return { markdown, data: result.data };
  }

  // If it's a compare, show as recommendation
  if (plan.compare) {
    const answer = assembleCompareAnswer(result, plan);

    // Add recommendation section
    const data = result.data!;
    const deltaNum = parseFloat(data.delta);
    const comparison = plan.compare;

    let recommendation = `\n#### Recommendation\n\n`;
    if (Math.abs(deltaNum) < 0.1) {
      recommendation += `Based on your data, there is no significant difference between `;
      recommendation += `${comparison.a.label} and ${comparison.b.label}. `;
      recommendation += `Both approaches yield similar results.\n`;
    } else if (deltaNum > 0) {
      recommendation += `Based on your historical data, ${comparison.a.label} shows better results. `;
      recommendation += `When you trade in ${comparison.a.label}, ${comparison.metric.field} is `;
      recommendation += `${data.deltaPercent} higher compared to ${comparison.b.label}.\n`;
    } else {
      recommendation += `Based on your historical data, ${comparison.b.label} shows better results. `;
      recommendation += `${comparison.a.label} has ${data.deltaPercent
        .replace("+", "")
        .replace("-", "")} lower `;
      recommendation += `${comparison.metric.field} compared to ${comparison.b.label}.\n`;
    }

    recommendation += `\n**Note:** This is based on correlation in your historical trades, not causation. `;
    recommendation += `Other factors may influence results.\n`;

    answer.markdown += recommendation;
    return answer;
  }

  // Otherwise use aggregate
  return assembleAggregateAnswer(result, plan);
}

/**
 * Capitalize first letter
 */
function sentenceCase(str: string): string {
  if (!str) return "";
  const trimmed = str.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

function formatCount(value: number | string | null | undefined): string {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return "0";
  return num.toLocaleString();
}

function cleanupMarkdown(value: string): string {
  return value.replace(/\\([.$])/g, "$1");
}

function toNumericValue(value: any): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    const num = Number(cleaned);
    return Number.isNaN(num) ? 0 : num;
  }
  return 0;
}

function getNegativeEvidenceItems(
  result: ExecutionResult,
  plan: TradeQueryPlan,
  userMessage?: string
): string[] {
  if (!isNegativeEvidenceQuestion(userMessage)) {
    return [];
  }

  const aggregates = result.meta?.aggregates || {};
  const items: string[] = [];

  const winRate = findAggregateValue(aggregates, [
    "win_rate",
    "winrate",
  ]);
  if (winRate !== null && winRate < 50) {
    items.push(`Win rate is ${formatAggregateValue("win_rate", winRate)}`);
  }

  const profit = findAggregateValueByMatch(aggregates, ["profit", "pnl"]);
  if (profit !== null && profit < 0) {
    items.push(`Overall profit is ${formatAggregateValue("profit", profit)}`);
  }

  const realisedRR = findAggregateValueByMatch(aggregates, [
    "realisedrr",
    "realizedrr",
  ]);
  if (realisedRR !== null && realisedRR < 1) {
    items.push(
      `Average realised r:r is ${formatAggregateValue("realisedrr", realisedRR)}`
    );
  }

  const rrCapture = findAggregateValueByMatch(aggregates, [
    "rrcaptureefficiency",
    "captureefficiency",
    "rrefficiency",
  ]);
  if (rrCapture !== null && rrCapture < 50) {
    items.push(
      `R:r capture efficiency is ${formatAggregateValue(
        "rrcaptureefficiency",
        rrCapture
      )}`
    );
  }

  if (items.length === 0 && result.meta?.rowCount) {
    items.push(
      `Sample size is ${formatCount(result.meta.rowCount)}, which limits reliability`
    );
  }

  return items;
}

function isMetricComparisonQuery(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("compare") ||
    lower.includes(" vs ") ||
    lower.includes(" versus ") ||
    lower.includes("compared to")
  );
}

function getSuggestedFollowUp(
  result: ExecutionResult,
  plan: TradeQueryPlan
): string | null {
  const rowCount = result.meta?.rowCount ?? 0;
  if (rowCount < 30) return null;
  if (plan.intent !== "aggregate") return null;
  if (plan.groupBy && plan.groupBy.length > 0) return null;
  if (plan.compare) return null;

  const hasSessionFilter = plan.filters.some(
    (filter) => filter.field === "sessionTag"
  );
  const hasSymbolFilter = plan.filters.some(
    (filter) => filter.field === "symbol"
  );

  if (hasSessionFilter && !hasSymbolFilter) {
    return "Do you want to break this down by symbol as well?";
  }
  if (hasSymbolFilter && !hasSessionFilter) {
    return "Do you want to break this down by session as well?";
  }

  return "Do you want to break this down by session?";
}

function isNegativeEvidenceQuestion(message?: string): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return (
    /why\s+(doesn'?t|dont|don't|isn'?t|arent|aren't|cant|can't)/.test(
      normalized
    ) ||
    /not\s+working/.test(normalized) ||
    /doesn'?t\s+work/.test(normalized) ||
    /why\s+do\s+i\s+lose/.test(normalized) ||
    /why\s+am\s+i\s+losing/.test(normalized) ||
    /why\s+is\s+.*\s+not/.test(normalized)
  );
}

function findAggregateValue(
  aggregates: Record<string, any>,
  keys: string[]
): number | null {
  for (const key of keys) {
    if (aggregates[key] !== undefined) {
      const num = Number(aggregates[key]);
      if (!Number.isNaN(num)) {
        return num;
      }
    }
  }
  return null;
}

function findAggregateValueByMatch(
  aggregates: Record<string, any>,
  needles: string[]
): number | null {
  const entries = Object.entries(aggregates);
  for (const [key, value] of entries) {
    const normalized = key.toLowerCase();
    if (needles.some((needle) => normalized.includes(needle))) {
      const num = Number(value);
      if (!Number.isNaN(num)) {
        return num;
      }
    }
  }
  return null;
}
