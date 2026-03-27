"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Layers3,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { GoalSurface } from "@/components/goals/goal-surface";

import {
  EDGE_ACTION_BUTTON_CLASSNAME,
  EDGE_PAGE_SHELL_CLASS,
  EdgeMetricCard,
  EdgePageHeader,
} from "@/components/edges/edge-page-primitives";
import {
  EdgeForkBadge,
  EdgeReadinessBadge,
  EdgeVisibilityBadge,
  getEdgeLineageHint,
  getEdgeReadinessSnapshot,
} from "@/components/edges/edge-surface-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import { trpc, trpcOptions } from "@/utils/trpc";

type EdgeSummary = {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  publicationMode: string;
  sourceEdgeId?: string | null;
  sourceEdge?: {
    id?: string | null;
    name?: string | null;
  } | null;
  color?: string | null;
  metrics?: {
    tradeCount?: number | null;
    winRate?: number | null;
    netPnl?: number | null;
    expectancy?: number | null;
  };
  publicStatsVisible?: boolean | null;
  passport?: {
    readiness?: {
      label?: string | null;
      score?: number | null;
      note?: string | null;
    } | null;
    lineage?: {
      forkCount?: number | null;
      descendantCount?: number | null;
      forkDepth?: number | null;
    } | null;
  } | null;
};

function formatPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "0%";
  return `${(value * 100).toFixed(1)}%`;
}

function formatMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatR(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "0R";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}R`;
}

export default function EdgesMyPage() {
  const router = useRouter();
  const edgesQuery = useQuery(trpcOptions.edges.listMy.queryOptions());
  const createEdge = trpc.edges.create.useMutation({
    onSuccess: (createdEdge) => {
      router.push(`/dashboard/edges/${createdEdge.id}`);
    },
  });

  const edges = (edgesQuery.data as EdgeSummary[] | undefined) ?? [];

  const summary = edges.reduce(
    (accumulator, currentEdge) => {
      accumulator.tradeCount += currentEdge.metrics?.tradeCount ?? 0;
      accumulator.netPnl += currentEdge.metrics?.netPnl ?? 0;
      accumulator.expectancySum += currentEdge.metrics?.expectancy ?? 0;
      accumulator.winRateSum += currentEdge.metrics?.winRate ?? 0;
      accumulator.publishedCount +=
        currentEdge.publicationMode === "library" ? 1 : 0;
      accumulator.forkCount += currentEdge.sourceEdgeId || currentEdge.sourceEdge ? 1 : 0;
      if (getEdgeReadinessSnapshot(currentEdge).tone === "ready") {
        accumulator.readyCount += 1;
      }
      accumulator.edgeCount += 1;
      return accumulator;
    },
    {
      tradeCount: 0,
      netPnl: 0,
      expectancySum: 0,
      winRateSum: 0,
      publishedCount: 0,
      forkCount: 0,
      readyCount: 0,
      edgeCount: 0,
    }
  );

  if (edgesQuery.isLoading) {
    return <RouteLoadingFallback route="edges" className="min-h-full" />;
  }

  return (
    <div className={EDGE_PAGE_SHELL_CLASS}>
      <EdgePageHeader
        eyebrow="Your Edge library"
        title="Edges"
        description="Build, refine, and review your own setups in one place. Keep branches private while they mature, then publish the forks that earn proof."
        actions={
          <>
            <Button
              className={EDGE_ACTION_BUTTON_CLASSNAME}
              disabled={createEdge.isPending}
              onClick={() =>
                createEdge.mutate({
                  name: "New Edge",
                  description: "A fresh Edge for setup review.",
                })
              }
            >
              <Plus className="size-3" />
              {createEdge.isPending ? "Creating..." : "Create Edge"}
            </Button>
            <Button
              className={EDGE_ACTION_BUTTON_CLASSNAME}
              onClick={() => router.push("/dashboard/edges/library")}
            >
              Browse Library
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <EdgeMetricCard
          icon={Target}
          label="Average win rate"
          value={
            summary.edgeCount > 0
              ? formatPercent(summary.winRateSum / summary.edgeCount)
              : "0%"
          }
          detail={`${summary.edgeCount} total Edges`}
        />
        <EdgeMetricCard
          icon={Layers3}
          label="Tagged trades"
          value={summary.tradeCount}
          detail="Executed with an Edge"
        />
        <EdgeMetricCard
          icon={TrendingUp}
          label="Net P&L"
          value={formatMoney(summary.netPnl)}
          detail="Across owned Edges"
        />
        <EdgeMetricCard
          icon={Sparkles}
          label="Ready Edges"
          value={summary.readyCount}
          detail={`${summary.publishedCount} public, ${summary.forkCount} forked`}
        />
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium text-white/72">Edges library</p>
          <p className="text-sm text-white/45">
            Owned Edges, forked variants, and the readiness signals that show
            which branches are strong enough to keep private, publish, or scale.
          </p>
        </div>

        {edges.length > 0 ? (
          <GoalSurface className="overflow-hidden" innerClassName="overflow-hidden">
            <div className="overflow-x-auto bg-white dark:bg-sidebar-accent">
              <div className="min-w-[1040px]">
                <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.7fr)_0.9fr_0.8fr_0.9fr_0.9fr_0.9fr_32px] gap-3 border-b border-white/8 px-4 py-3 text-sm text-white/45">
                  <span>Edge</span>
                  <span>Description</span>
                  <span>Status</span>
                  <span>Trades</span>
                  <span>Win rate</span>
                  <span>Net P&L</span>
                  <span>Expectancy</span>
                  <span />
                </div>

                {edges.map((currentEdge) => (
                  <Link
                    key={currentEdge.id}
                    href={`/dashboard/edges/${currentEdge.id}`}
                    className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.7fr)_0.9fr_0.8fr_0.9fr_0.9fr_0.9fr_32px] gap-3 border-b border-white/5 px-4 py-3 text-sm transition-colors last:border-b-0 hover:bg-white/5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {currentEdge.color ? (
                          <span
                            className="size-2.5 rounded-full"
                            style={{ backgroundColor: currentEdge.color }}
                          />
                        ) : null}
                        <span className="truncate font-medium text-white">
                          {currentEdge.name}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <EdgeVisibilityBadge edge={currentEdge} />
                        <EdgeForkBadge edge={currentEdge} />
                        <EdgeReadinessBadge edge={currentEdge} />
                      </div>
                      {getEdgeLineageHint(currentEdge) ? (
                        <p className="mt-2 truncate text-xs text-white/38">
                          {getEdgeLineageHint(currentEdge)}
                        </p>
                      ) : null}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-white/45">
                        {currentEdge.description || "No description yet."}
                      </p>
                      <p className="mt-2 truncate text-xs text-white/34">
                        {getEdgeReadinessSnapshot(currentEdge).detail}
                      </p>
                    </div>

                    <div className="flex items-center">
                      <Badge
                        variant="secondary"
                        className="border-white/10 bg-white/5 text-white/72"
                      >
                        {currentEdge.status === "archived"
                          ? "Archived"
                          : currentEdge.publicationMode === "library"
                          ? "Public"
                          : currentEdge.sourceEdgeId || currentEdge.sourceEdge
                          ? "Fork"
                          : "Private"}
                      </Badge>
                    </div>

                    <div className="flex items-center text-white/65">
                      {currentEdge.metrics?.tradeCount ?? 0}
                    </div>
                    <div className="flex items-center text-white/65">
                      {formatPercent(currentEdge.metrics?.winRate)}
                    </div>
                    <div className="flex items-center text-white/65">
                      {formatMoney(currentEdge.metrics?.netPnl)}
                    </div>
                    <div className="flex items-center text-white/65">
                      {formatR(currentEdge.metrics?.expectancy)}
                    </div>
                    <div className="flex items-center justify-end text-white/30">
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </GoalSurface>
        ) : (
          <div className="rounded-lg border border-dashed border-white/10 bg-black/20 px-4 py-5 text-sm text-white/48">
            No Edges yet. Create your first one here or assign an Edge
            directly from the trades table.
          </div>
        )}
      </div>
    </div>
  );
}
