"use client";

import {
  Scatter,
  ScatterChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
  ZAxis,
} from "recharts";

import { useChartTrades } from "./use-chart-trades";
import {
  DashboardChartTooltipFrame,
  DashboardChartTooltipRow,
  formatSignedCurrency,
} from "./dashboard-chart-ui";

interface MAEMFEScatterProps {
  accountId?: string;
}

export function MAEMFEScatterChart({ accountId }: MAEMFEScatterProps) {
  const { trades, isLoading } = useChartTrades(accountId);

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-xs text-white/30">Loading...</p>
      </div>
    );
  }

  // Calculate MAE (Maximum Adverse Excursion) and MFE (Maximum Favorable Excursion)
  const scatterData = trades
    .filter((trade) => {
      return (
        trade.maePips !== null &&
        trade.maePips !== undefined &&
        trade.mfePips !== null &&
        trade.mfePips !== undefined &&
        trade.profit !== null &&
        trade.profit !== undefined
      );
    })
    .map((trade) => ({
      mae: Math.abs(trade.maePips ?? 0),
      mfe: Math.abs(trade.mfePips ?? 0),
      profit: trade.profit ?? 0,
      symbol: trade.symbol,
      size: Math.max(1, Math.abs(trade.profit ?? 0)),
    }));

  if (scatterData.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-xs text-white/30">No MAE/MFE data available</p>
      </div>
    );
  }

  // Separate winning and losing trades
  const winningTrades = scatterData.filter((d) => d.profit > 0);
  const losingTrades = scatterData.filter((d) => d.profit <= 0);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart>
        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
        <XAxis
          type="number"
          dataKey="mae"
          name="MAE"
          stroke="#ffffff50"
          tick={{ fill: "#ffffff70", fontSize: 11 }}
          label={{
            value: "MAE (pips)",
            position: "insideBottom",
            offset: -5,
            fill: "#ffffff50",
          }}
        />
        <YAxis
          type="number"
          dataKey="mfe"
          name="MFE"
          stroke="#ffffff50"
          tick={{ fill: "#ffffff70", fontSize: 11 }}
          label={{
            value: "MFE (pips)",
            angle: -90,
            position: "insideLeft",
            fill: "#ffffff50",
          }}
        />
        <ZAxis type="number" dataKey="size" range={[20, 200]} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const point = payload[0].payload as {
              mae: number;
              mfe: number;
              profit: number;
              symbol?: string;
            };
            return (
              <DashboardChartTooltipFrame title={point.symbol || "Trade"}>
                <DashboardChartTooltipRow
                  label="MAE"
                  value={`${point.mae.toFixed(1)} pips`}
                />
                <DashboardChartTooltipRow
                  label="MFE"
                  value={`${point.mfe.toFixed(1)} pips`}
                />
                <DashboardChartTooltipRow
                  label="P&L"
                  value={formatSignedCurrency(point.profit, 2)}
                  tone={point.profit >= 0 ? "positive" : "negative"}
                />
              </DashboardChartTooltipFrame>
            );
          }}
        />
        <ReferenceLine x={0} stroke="#ffffff30" strokeWidth={1} />
        <ReferenceLine y={0} stroke="#ffffff30" strokeWidth={1} />
        <Scatter
          name="Winning Trades"
          data={winningTrades}
          fill="#10b981"
          fillOpacity={0.6}
        />
        <Scatter
          name="Losing Trades"
          data={losingTrades}
          fill="#ef4444"
          fillOpacity={0.6}
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
