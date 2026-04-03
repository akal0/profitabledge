"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Skeleton as BoneyardSkeleton } from "boneyard-js/react";

import { Button } from "@/components/ui/button";
import { Skeleton as UiSkeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type TradeTableRouteSkeletonProps = {
  className?: string;
  timeoutMs?: number;
};

const TRADE_TABLE_HEADERS = [
  "Instrument",
  "Opened",
  "Direction",
  "Setup",
  "Risk",
  "P&L",
  "Outcome",
  "Tags",
] as const;

const TRADE_TABLE_ROWS = [
  {
    instrument: "EURUSD",
    opened: "08:34",
    direction: "Long",
    setup: "London pullback",
    risk: "0.50R",
    pnl: "+1.25R",
    outcome: "Closed cleanly",
    tags: "A+ / Momentum",
  },
  {
    instrument: "XAUUSD",
    opened: "09:12",
    direction: "Short",
    setup: "NY reversal",
    risk: "1.00R",
    pnl: "-0.40R",
    outcome: "Stopped partial",
    tags: "Fade / News",
  },
  {
    instrument: "NAS100",
    opened: "10:06",
    direction: "Long",
    setup: "Opening drive",
    risk: "0.75R",
    pnl: "+2.10R",
    outcome: "Runner held",
    tags: "A setup / Trend",
  },
  {
    instrument: "GBPJPY",
    opened: "11:48",
    direction: "Short",
    setup: "Session rollover",
    risk: "0.50R",
    pnl: "+0.65R",
    outcome: "Scaled at target",
    tags: "Killzone / Mean rev",
  },
  {
    instrument: "US30",
    opened: "13:05",
    direction: "Long",
    setup: "Liquidity sweep",
    risk: "1.00R",
    pnl: "+0.90R",
    outcome: "Closed into resistance",
    tags: "Sweep / Power hour",
  },
  {
    instrument: "BTCUSD",
    opened: "14:41",
    direction: "Short",
    setup: "Range fade",
    risk: "0.60R",
    pnl: "+0.35R",
    outcome: "Quick scalp",
    tags: "Countertrend / PM",
  },
] as const;

const TRADE_FILTER_CHIPS = [
  "All accounts",
  "Last 30 days",
  "Reviewed",
  "Saved view: Execution",
  "P&L in R",
] as const;

const TRADE_SUMMARY_METRICS = [
  { label: "Win rate", value: "58.4%" },
  { label: "Net P&L", value: "+12.8R" },
  { label: "Expectancy", value: "+0.42R" },
  { label: "Profit factor", value: "1.91" },
  { label: "Best trade", value: "+2.10R" },
  { label: "Current streak", value: "3 wins" },
] as const;

function TradeTableRouteFixture() {
  return (
    <div className="space-y-4">
      <section className="rounded-md border border-white/5 bg-sidebar p-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded-sm border border-white/10 bg-sidebar-accent px-3 py-2 text-sm font-medium text-white/78"
          >
            Accounts
          </button>
          <div className="min-w-[18rem] flex-1 rounded-sm border border-white/10 bg-sidebar-accent px-3 py-2.5 text-sm text-white/46">
            Search trades, tags, notes, or setups
          </div>
          <button
            type="button"
            className="rounded-sm border border-white/10 bg-sidebar-accent px-3 py-2 text-sm text-white/72"
          >
            Filters
          </button>
          <button
            type="button"
            className="rounded-sm border border-white/10 bg-sidebar-accent px-3 py-2 text-sm text-white/72"
          >
            Columns
          </button>
          <button
            type="button"
            className="ml-auto rounded-sm border border-teal-400/30 bg-teal-400/10 px-3 py-2 text-sm font-medium text-teal-200"
          >
            Export CSV
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {TRADE_FILTER_CHIPS.map((chip) => (
            <span
              key={chip}
              className="rounded-sm border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-white/54"
            >
              {chip}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-white/5 bg-sidebar p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-white/40">
              Trades workspace
            </p>
            <p className="mt-1 text-sm text-white/70">
              Review every execution, inspect process, and trim the noise.
            </p>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-sm border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/68"
            >
              Saved presets
            </button>
            <button
              type="button"
              className="rounded-sm border border-white/10 bg-sidebar-accent px-3 py-2 text-sm text-white/72"
            >
              Table view
            </button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-md border border-white/5 bg-sidebar">
        <div className="h-1 w-full bg-white/5">
          <div className="h-full w-1/3 rounded-full bg-teal-400/70" />
        </div>

        <div className="border-b border-white/5 px-4 py-3">
          <div className="grid grid-cols-8 gap-3">
            {TRADE_TABLE_HEADERS.map((header) => (
              <p
                key={header}
                className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/42"
              >
                {header}
              </p>
            ))}
          </div>
        </div>

        <div className="divide-y divide-white/5">
          {TRADE_TABLE_ROWS.map((row) => (
            <div key={`${row.instrument}-${row.opened}`} className="grid grid-cols-8 gap-3 px-4 py-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-white/88">{row.instrument}</p>
                <p className="text-xs text-white/42">Execution review</p>
              </div>
              <p className="text-sm text-white/68">{row.opened}</p>
              <p className="text-sm text-white/68">{row.direction}</p>
              <p className="text-sm text-white/72">{row.setup}</p>
              <p className="text-sm text-white/68">{row.risk}</p>
              <p className="text-sm font-medium text-white/84">{row.pnl}</p>
              <p className="text-sm text-white/64">{row.outcome}</p>
              <p className="text-sm text-white/48">{row.tags}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-white/5 bg-sidebar p-4">
        <div className="flex gap-4 overflow-hidden">
          {TRADE_SUMMARY_METRICS.map((metric) => (
            <div
              key={metric.label}
              className="min-w-32 space-y-2 border-r border-white/5 pr-4 last:border-r-0"
            >
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/38">
                {metric.label}
              </p>
              <p className="text-lg font-semibold text-white/86">{metric.value}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function TradeTableRouteFallbackFrame() {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-white/5 bg-sidebar p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <UiSkeleton className="h-9 w-28 rounded-sm bg-sidebar-accent" />
          <UiSkeleton className="h-9 w-[26rem] rounded-sm bg-sidebar-accent" />
          <UiSkeleton className="h-9 w-24 rounded-sm bg-sidebar-accent" />
          <UiSkeleton className="ml-auto h-9 w-32 rounded-sm bg-sidebar-accent" />
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <UiSkeleton
              key={index}
              className="h-7 w-24 rounded-sm bg-sidebar-accent"
            />
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-white/5 bg-sidebar">
        <div className="h-1 w-full overflow-hidden bg-white/5">
          <div className="h-full w-1/3 animate-pulse bg-teal-400/70" />
        </div>
        <div className="border-b border-white/5 px-4 py-3">
          <div className="grid grid-cols-8 gap-3">
            {Array.from({ length: 8 }).map((_, index) => (
              <UiSkeleton
                key={index}
                className="h-3 w-full rounded-sm bg-sidebar-accent"
              />
            ))}
          </div>
        </div>
        <div className="divide-y divide-white/5">
          {Array.from({ length: 10 }).map((_, rowIndex) => (
            <div key={rowIndex} className="grid grid-cols-8 gap-3 px-4 py-3">
              {Array.from({ length: 8 }).map((_, colIndex) => (
                <UiSkeleton
                  key={`${rowIndex}-${colIndex}`}
                  className={cn(
                    "h-5 rounded-sm bg-sidebar-accent",
                    colIndex === 0 ? "w-10" : colIndex === 1 ? "w-20" : "w-full"
                  )}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-white/5 bg-sidebar p-4">
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="min-w-28 space-y-2 border-r border-white/5 pr-4 last:border-r-0"
            >
              <UiSkeleton className="h-3 w-16 rounded-sm bg-sidebar-accent" />
              <UiSkeleton className="h-5 w-20 rounded-sm bg-sidebar-accent" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TradeTableRouteSkeleton({
  className,
  timeoutMs = 30_000,
}: TradeTableRouteSkeletonProps) {
  const router = useRouter();
  const [timedOut, setTimedOut] = React.useState(false);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => setTimedOut(true), timeoutMs);
    return () => window.clearTimeout(timeoutId);
  }, [timeoutMs]);

  return (
    <div className={cn("space-y-4", className)}>
      <BoneyardSkeleton
        name="trades-route"
        loading
        color="rgba(255,255,255,0.08)"
        darkColor="rgba(255,255,255,0.08)"
        fallback={<TradeTableRouteFallbackFrame />}
        fixture={<TradeTableRouteFixture />}
        snapshotConfig={{
          leafTags: ["span"],
        }}
      >
        <TradeTableRouteFixture />
      </BoneyardSkeleton>

      {timedOut ? (
        <div className="rounded-md border border-white/5 bg-sidebar p-4 text-sm text-white/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>Taking too long? Retry the trades view.</p>
            <Button
              type="button"
              variant="outline"
              className="h-8 rounded-sm bg-transparent px-3 text-xs text-white/80 hover:bg-sidebar-accent"
              onClick={() => router.refresh()}
            >
              Retry now
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
