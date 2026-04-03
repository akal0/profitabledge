"use client";

import { useState } from "react";

import { BellCurveChart } from "@/components/dashboard/charts/bell-curve-chart";
import { CorrelationMatrix } from "@/components/dashboard/charts/correlation-matrix";
import { MonteCarloChart } from "@/components/dashboard/charts/monte-carlo-chart";
import { RadarComparisonChart } from "@/components/dashboard/charts/radar-comparison";
import { RiskAdjustedChart } from "@/components/dashboard/charts/risk-adjusted-chart";
import { RollingPerformanceChart } from "@/components/dashboard/charts/rolling-performance-chart";

import {
  ChartHeaderMenu,
  ChartWidgetFrame,
  type ChartWidgetCardProps,
} from "./chart-card-shell";

export function MonteCarloCard({
  accountId,
  currencyCode,
  isEditing = false,
  className,
}: ChartWidgetCardProps) {
  const [simCount, setSimCount] = useState(100);

  return (
    <ChartWidgetFrame
      title="Monte Carlo simulation"
      isEditing={isEditing}
      className={className}
      headerRight={
        isEditing ? null : (
          <ChartHeaderMenu
            sections={[
              {
                label: "Simulation paths",
                value: String(simCount),
                onValueChange: (value) => setSimCount(Number(value)),
                items: [
                  { label: "50 paths", value: "50" },
                  { label: "100 paths", value: "100" },
                  { label: "200 paths", value: "200" },
                  { label: "500 paths", value: "500" },
                ],
              },
            ]}
          />
        )
      }
    >
      <div className="flex h-full flex-col p-3.5">
        <MonteCarloChart
          accountId={accountId}
          currencyCode={currencyCode}
          simCount={simCount}
        />
      </div>
    </ChartWidgetFrame>
  );
}

export function RollingPerformanceCard({
  accountId,
  currencyCode,
  isEditing = false,
  className,
}: ChartWidgetCardProps) {
  const [metric, setMetric] = useState<
    "winRate" | "profitFactor" | "avgRR" | "expectancy"
  >("winRate");
  const [window, setWindow] = useState<10 | 20 | 50>(20);

  return (
    <ChartWidgetFrame
      title="Rolling performance"
      isEditing={isEditing}
      className={className}
      headerRight={
        isEditing ? null : (
          <ChartHeaderMenu
            sections={[
              {
                label: "Metric",
                value: metric,
                onValueChange: (value) =>
                  setMetric(
                    value as "winRate" | "profitFactor" | "avgRR" | "expectancy"
                  ),
                items: [
                  { label: "Win rate", value: "winRate" },
                  { label: "Profit factor", value: "profitFactor" },
                  { label: "Avg R:R", value: "avgRR" },
                  { label: "Expectancy", value: "expectancy" },
                ],
              },
              {
                label: "Window",
                value: String(window),
                onValueChange: (value) =>
                  setWindow(Number(value) as 10 | 20 | 50),
                items: [
                  { label: "10 trades", value: "10" },
                  { label: "20 trades", value: "20" },
                  { label: "50 trades", value: "50" },
                ],
              },
            ]}
          />
        )
      }
    >
      <div className="flex h-full flex-col p-3.5">
        <RollingPerformanceChart
          accountId={accountId}
          currencyCode={currencyCode}
          metric={metric}
          window={window}
        />
      </div>
    </ChartWidgetFrame>
  );
}

export function CorrelationMatrixCard({
  accountId,
  currencyCode,
  isEditing = false,
  className,
}: ChartWidgetCardProps) {
  const [rowAxis, setRowAxis] = useState<"session" | "symbol" | "direction">(
    "session"
  );
  const [colAxis, setColAxis] = useState<"session" | "symbol" | "direction">(
    "symbol"
  );
  const [metric, setMetric] = useState<"winRate" | "avgRR" | "pnl" | "count">(
    "winRate"
  );

  return (
    <ChartWidgetFrame
      title="Correlation matrix"
      isEditing={isEditing}
      className={className}
      contentClassName="min-h-0 flex-1"
      headerRight={
        isEditing ? null : (
          <ChartHeaderMenu
            sections={[
              {
                label: "Rows",
                value: rowAxis,
                onValueChange: (value) =>
                  setRowAxis(value as "session" | "symbol" | "direction"),
                items: [
                  { label: "Session", value: "session" },
                  { label: "Symbol", value: "symbol" },
                  { label: "Direction", value: "direction" },
                ],
              },
              {
                label: "Columns",
                value: colAxis,
                onValueChange: (value) =>
                  setColAxis(value as "session" | "symbol" | "direction"),
                items: [
                  { label: "Session", value: "session" },
                  { label: "Symbol", value: "symbol" },
                  { label: "Direction", value: "direction" },
                ],
              },
              {
                label: "Metric",
                value: metric,
                onValueChange: (value) =>
                  setMetric(value as "winRate" | "avgRR" | "pnl" | "count"),
                items: [
                  { label: "Win %", value: "winRate" },
                  { label: "Avg RR", value: "avgRR" },
                  { label: "P&L", value: "pnl" },
                  { label: "Count", value: "count" },
                ],
              },
            ]}
          />
        )
      }
    >
      <div className="h-full w-full pb-2 pl-1 pr-2 pt-2">
        <CorrelationMatrix
          accountId={accountId}
          currencyCode={currencyCode}
          rowAxis={rowAxis}
          colAxis={colAxis}
          metric={metric}
        />
      </div>
    </ChartWidgetFrame>
  );
}

export function RadarComparisonCard({
  accountId,
  currencyCode,
  isEditing = false,
  className,
}: ChartWidgetCardProps) {
  const [groupBy, setGroupBy] = useState<"session" | "symbol">("session");

  return (
    <ChartWidgetFrame
      title="Strategy radar"
      isEditing={isEditing}
      className={className}
      contentClassName="min-h-0 flex-1"
      headerRight={
        isEditing ? null : (
          <ChartHeaderMenu
            sections={[
              {
                label: "Group by",
                value: groupBy,
                onValueChange: (value) =>
                  setGroupBy(value as "session" | "symbol"),
                items: [
                  { label: "Session", value: "session" },
                  { label: "Symbol", value: "symbol" },
                ],
              },
            ]}
          />
        )
      }
    >
      <div className="h-full w-full p-3.5 pt-2">
        <RadarComparisonChart
          accountId={accountId}
          currencyCode={currencyCode}
          groupBy={groupBy}
        />
      </div>
    </ChartWidgetFrame>
  );
}

export function RiskAdjustedCard({
  accountId,
  currencyCode,
  isEditing = false,
  className,
}: ChartWidgetCardProps) {
  const [metric, setMetric] = useState<
    "sharpe" | "sortino" | "calmar" | "riskAdjustedEquity"
  >("sharpe");
  const [window, setWindow] = useState<10 | 20 | 50>(20);

  return (
    <ChartWidgetFrame
      title="Risk-adjusted performance"
      isEditing={isEditing}
      className={className}
      contentClassName="min-h-0 flex-1 p-3.5"
      headerRight={
        isEditing ? null : (
          <ChartHeaderMenu
            sections={[
              {
                label: "Metric",
                value: metric,
                onValueChange: (value) =>
                  setMetric(
                    value as
                      | "sharpe"
                      | "sortino"
                      | "calmar"
                      | "riskAdjustedEquity"
                  ),
                items: [
                  { label: "Sharpe ratio", value: "sharpe" },
                  { label: "Sortino ratio", value: "sortino" },
                  { label: "Calmar ratio", value: "calmar" },
                  { label: "Risk-adj equity", value: "riskAdjustedEquity" },
                ],
              },
              {
                label: "Window",
                value: String(window),
                onValueChange: (value) =>
                  setWindow(Number(value) as 10 | 20 | 50),
                items: [
                  { label: "10 trades", value: "10" },
                  { label: "20 trades", value: "20" },
                  { label: "50 trades", value: "50" },
                ],
              },
            ]}
          />
        )
      }
    >
      <RiskAdjustedChart
        accountId={accountId}
        currencyCode={currencyCode}
        metric={metric}
        window={window}
      />
    </ChartWidgetFrame>
  );
}

export function BellCurveCard({
  accountId,
  currencyCode,
  isEditing = false,
  className,
}: ChartWidgetCardProps) {
  return (
    <ChartWidgetFrame
      title="Trade distribution - Bell curve"
      isEditing={isEditing}
      className={className}
      contentClassName="min-h-0 flex-1"
    >
      <div className="h-full w-full p-3.5 pt-2">
        <BellCurveChart accountId={accountId} currencyCode={currencyCode} />
      </div>
    </ChartWidgetFrame>
  );
}
