"use client";

import {
  PerformingAssetsBarChart,
  type PerformingAssetPoint,
} from "@/components/dashboard/charts/performing-assets";
import { ChartWidgetFrame } from "@/features/dashboard/charts/components/chart-card-shell";

export function PublicProofTopSymbolsCard({
  rows,
  currencyCode = "USD",
}: {
  rows: PerformingAssetPoint[];
  currencyCode?: string | null;
}) {
  return (
    <ChartWidgetFrame
      title="Performance by asset"
      className="h-full"
      showShareButton={false}
    >
      {rows.length === 0 ? (
        <div className="flex h-full items-center justify-center p-3.5 text-sm text-white/40">
          No symbol performance yet
        </div>
      ) : (
        <div className="flex h-full flex-col p-3.5">
          <PerformingAssetsBarChart
            ownerId="public-proof-performing-assets"
            comparisonMode="none"
            rows={rows}
            currencyCode={currencyCode}
            contentClassName="mt-auto overflow-visible pl-0 pr-0 pt-0 pb-0"
            chartMargin={{
              left: 24,
              right: 0,
              top: 8,
              bottom: -4,
            }}
          />
        </div>
      )}
    </ChartWidgetFrame>
  );
}
