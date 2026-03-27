"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { LibraryBig, Sparkles, Target, UsersRound } from "lucide-react";

import { EdgeLibraryCard } from "@/components/edges/edge-library-card";
import {
  EDGE_ACTION_BUTTON_CLASSNAME,
  EDGE_PAGE_SHELL_CLASS,
  EdgeMetricCard,
  EdgePageHeader,
} from "@/components/edges/edge-page-primitives";
import { getEdgeReadinessSnapshot } from "@/components/edges/edge-surface-badges";
import { Button } from "@/components/ui/button";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import { trpcOptions } from "@/utils/trpc";

type LibraryEdge = {
  id: string;
  name: string;
  description?: string | null;
  publicationMode?: string | null;
  publicStatsVisible?: boolean | null;
  color?: string | null;
  isFeatured?: boolean | null;
  sourceEdgeId?: string | null;
  sourceEdge?: {
    id?: string | null;
    name?: string | null;
  } | null;
  owner?: {
    id: string;
    name: string;
    displayName?: string | null;
    username?: string | null;
    image?: string | null;
  } | null;
  metrics?: {
    tradeCount?: number | null;
    winRate?: number | null;
    expectancy?: number | null;
    netPnl?: number | null;
  } | null;
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

export default function EdgeLibraryIndexPage() {
  const router = useRouter();
  const discoveryQuery = useQuery(trpcOptions.edges.listShared.queryOptions());

  if (discoveryQuery.isLoading) {
    return <RouteLoadingFallback route="edges" className="min-h-full" />;
  }

  const library =
    ((discoveryQuery.data as { library?: LibraryEdge[] } | undefined)?.library ??
      []) as LibraryEdge[];

  const summary = library.reduce(
    (accumulator, currentEdge) => {
      accumulator.edgeCount += 1;
      if (currentEdge.metrics) {
        accumulator.tradeCount += currentEdge.metrics.tradeCount ?? 0;
        accumulator.winRateSum += currentEdge.metrics.winRate ?? 0;
        accumulator.statsVisibleCount += 1;
      }
      if (getEdgeReadinessSnapshot(currentEdge).tone === "ready") {
        accumulator.readyCount += 1;
      }
      if (currentEdge.owner?.id) {
        accumulator.ownerIds.add(currentEdge.owner.id);
      }
      return accumulator;
    },
    {
      edgeCount: 0,
      tradeCount: 0,
      winRateSum: 0,
      statsVisibleCount: 0,
      readyCount: 0,
      ownerIds: new Set<string>(),
    }
  );

  return (
    <div className={EDGE_PAGE_SHELL_CLASS}>
      <EdgePageHeader
        eyebrow="Public Edge templates"
        title="Library"
        description="Browse public Edge templates in one place. Fork privately by default, then decide later whether your version should stay private or go public."
        actions={
          <>
            <Button
              className={EDGE_ACTION_BUTTON_CLASSNAME}
              onClick={() => router.push("/dashboard/edges/featured")}
            >
              View Featured
            </Button>
            <Button
              className={EDGE_ACTION_BUTTON_CLASSNAME}
              onClick={() => router.push("/dashboard/edges")}
            >
              Back to Edges
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <EdgeMetricCard
          icon={LibraryBig}
          label="Public Edges"
          value={summary.edgeCount}
          detail="Available templates"
        />
        <EdgeMetricCard
          icon={Sparkles}
          label="Ready to fork"
          value={summary.readyCount}
          detail="Higher-confidence public templates"
        />
        <EdgeMetricCard
          icon={UsersRound}
          label="Creators"
          value={summary.ownerIds.size}
          detail="Publishing publicly"
        />
        <EdgeMetricCard
          icon={Target}
          label="Average win rate"
          value={
            summary.statsVisibleCount > 0
              ? formatPercent(summary.winRateSum / summary.statsVisibleCount)
              : "—"
          }
          detail={
            summary.statsVisibleCount > 0
              ? `${summary.tradeCount} tagged trades`
              : "Shown when creators share stats"
          }
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-white/72">All public Edges</p>
            <p className="text-sm text-white/40">
              Open a creator library, inspect the proof, and fork privately before you decide whether your branch should become public.
            </p>
          </div>
          <p className="text-xs text-white/34">{summary.edgeCount} templates</p>
        </div>

        {library.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {library.map((edge) => (
              <EdgeLibraryCard
                key={edge.id}
                edge={edge}
                edgeHref={`/dashboard/edges/${edge.id}`}
                libraryHref={
                  edge.owner?.id
                    ? `/dashboard/edges/library/${edge.owner.id}`
                    : undefined
                }
              />
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-white/10 bg-sidebar px-5 py-6 text-sm text-white/45">
            No public Edges are live in the library yet.
          </div>
        )}
      </div>
    </div>
  );
}
