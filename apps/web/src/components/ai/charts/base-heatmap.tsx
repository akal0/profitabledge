"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface HeatmapCell {
  x: string;
  y: string;
  value: number;
  label?: string;
}

export interface BaseHeatmapProps {
  data: HeatmapCell[];
  xLabels: string[];
  yLabels: string[];
  height?: number;
  formatValue?: (v: number) => string;
  colorPositive?: string;
  colorNegative?: string;
  className?: string;
}

export function BaseHeatmap({
  data,
  xLabels,
  yLabels,
  height,
  formatValue: fmt = (v) => v.toFixed(1),
  colorPositive = "teal",
  colorNegative = "rose",
  className,
}: BaseHeatmapProps) {
  const maxAbs = Math.max(
    ...data.map((d) => Math.abs(d.value)),
    1
  );

  const getCell = (x: string, y: string) =>
    data.find((d) => d.x === x && d.y === y);

  const getCellColor = (value: number) => {
    const intensity = Math.min(Math.abs(value) / maxAbs, 1);
    if (value >= 0) {
      return `rgba(45, 212, 191, ${0.1 + intensity * 0.5})`;
    }
    return `rgba(251, 113, 133, ${0.1 + intensity * 0.5})`;
  };

  return (
    <div className={cn("w-full overflow-x-auto", className)} style={height ? { height } : undefined}>
      <div className="inline-grid gap-1" style={{
        gridTemplateColumns: `auto repeat(${xLabels.length}, minmax(40px, 1fr))`,
      }}>
        {/* Header row */}
        <div />
        {xLabels.map((x) => (
          <div key={x} className="text-[10px] text-white/40 text-center px-1 truncate">
            {x}
          </div>
        ))}

        {/* Data rows */}
        {yLabels.map((y) => (
          <React.Fragment key={y}>
            <div className="text-[10px] text-white/40 pr-2 flex items-center">
              {y}
            </div>
            {xLabels.map((x) => {
              const cell = getCell(x, y);
              const value = cell?.value ?? 0;
              return (
                <div
                  key={`${x}-${y}`}
                  className="aspect-square rounded flex items-center justify-center text-[9px] font-medium min-w-[32px]"
                  style={{ backgroundColor: getCellColor(value) }}
                  title={cell?.label || `${x}, ${y}: ${fmt(value)}`}
                >
                  <span
                    className={cn(
                      value >= 0 ? `text-${colorPositive}-400` : `text-${colorNegative}-400`
                    )}
                  >
                    {fmt(value)}
                  </span>
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
