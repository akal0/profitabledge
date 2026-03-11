"use client";

import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

import {
  APP_RECHARTS_TOOLTIP_CONTENT_STYLE,
  APP_RECHARTS_TOOLTIP_LABEL_STYLE,
} from "@/components/ui/tooltip";

interface DataPoint {
  mfe: number;
  mae: number;
  pnl: number;
  direction: string;
}

interface Props {
  data: DataPoint[];
}

export function BacktestMaeMfeScatter({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-white/40 text-sm">
        No MAE/MFE data
      </div>
    );
  }

  const winners = data.filter((d) => d.pnl > 0);
  const losers = data.filter((d) => d.pnl <= 0);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-baseline gap-3 mb-2">
        <span className="text-sm font-medium text-white/60">
          {data.length} trades plotted
        </span>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
            <XAxis type="number" dataKey="mae" name="MAE" tick={{ fill: "#ffffff60", fontSize: 10 }} tickLine={false} axisLine={false} label={{ value: "MAE (pips)", position: "insideBottom", offset: -2, fill: "#ffffff40", fontSize: 10 }} />
            <YAxis type="number" dataKey="mfe" name="MFE" tick={{ fill: "#ffffff60", fontSize: 10 }} tickLine={false} axisLine={false} width={30} label={{ value: "MFE", angle: -90, position: "insideLeft", fill: "#ffffff40", fontSize: 10 }} />
            <Tooltip
              contentStyle={APP_RECHARTS_TOOLTIP_CONTENT_STYLE}
              labelStyle={APP_RECHARTS_TOOLTIP_LABEL_STYLE}
              formatter={(value: any, name: string) => [
                `${Number(value).toFixed(1)} pips`,
                name,
              ]}
            />
            <ReferenceLine y={0} stroke="#ffffff20" />
            <ReferenceLine x={0} stroke="#ffffff20" />
            <Scatter name="Winners" data={winners} fill="#00E0C8" fillOpacity={0.7} r={3} />
            <Scatter name="Losers" data={losers} fill="#F76290" fillOpacity={0.7} r={3} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
