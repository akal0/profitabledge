"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Sparkles, Target, TrendingUp, UsersRound } from "lucide-react";

import { EdgeLibraryCard } from "@/components/edges/edge-library-card";
import {
  EDGE_ACTION_BUTTON_CLASSNAME,
  EDGE_PAGE_SHELL_CLASS,
  EdgeMetricCard,
  EdgePageHeader,
} from "@/components/edges/edge-page-primitives";
import { Button } from "@/components/ui/button";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import { trpcOptions } from "@/utils/trpc";

type FeaturedEdge = {
  id: string;
  name: string;
  description?: string | null;
  publicationMode?: string | null;
  color?: string | null;
  isFeatured?: boolean | null;
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

export default function EdgeFeaturedPage() {
  const router = useRouter();
  const discoveryQuery = useQuery(trpcOptions.edges.listShared.queryOptions());

  if (discoveryQuery.isLoading) {
    return <RouteLoadingFallback route="edges" className="min-h-full" />;
  }

  const featured =
    ((discoveryQuery.data as { featured?: FeaturedEdge[] } | undefined)
      ?.featured ?? []) as FeaturedEdge[];

  const summary = featured.reduce(
    (accumulator, currentEdge) => {
      accumulator.edgeCount += 1;
      accumulator.tradeCount += currentEdge.metrics?.tradeCount ?? 0;
      accumulator.netPnl += currentEdge.metrics?.netPnl ?? 0;
      accumulator.winRateSum += currentEdge.metrics?.winRate ?? 0;
      if (currentEdge.owner?.id) {
        accumulator.ownerIds.add(currentEdge.owner.id);
      }
      return accumulator;
    },
    {
      edgeCount: 0,
      tradeCount: 0,
      netPnl: 0,
      winRateSum: 0,
      ownerIds: new Set<string>(),
    }
  );

  return (
    <div className={EDGE_PAGE_SHELL_CLASS}>
      <EdgePageHeader
        eyebrow="Featured public Edges"
        title="Featured"
        description="These are the public Edges surfaced from approved affiliate creators. They remain visible in the main library and act as the highest-signal templates."
        actions={
          <>
            <Button
              className={EDGE_ACTION_BUTTON_CLASSNAME}
              onClick={() => router.push("/dashboard/edges/library")}
            >
              Open Library
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
          icon={Sparkles}
          label="Featured Edges"
          value={summary.edgeCount}
          detail="Affiliate-curated"
        />
        <EdgeMetricCard
          icon={UsersRound}
          label="Creators"
          value={summary.ownerIds.size}
          detail="Approved affiliates"
        />
        <EdgeMetricCard
          icon={Target}
          label="Average win rate"
          value={
            summary.edgeCount > 0
              ? formatPercent(summary.winRateSum / summary.edgeCount)
              : "0%"
          }
          detail={`${summary.tradeCount} tagged trades`}
        />
        <EdgeMetricCard
          icon={TrendingUp}
          label="Net P&L"
          value={formatMoney(summary.netPnl)}
          detail="Executed trade sample"
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-white/72">Featured creators</p>
            <p className="text-sm text-white/40">
              Each featured Edge is public in the library as well, so you can review the creator profile or open the template directly from either route.
            </p>
          </div>
          <p className="text-xs text-white/34">{summary.edgeCount} featured</p>
        </div>

        {featured.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {featured.map((edge) => (
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
            No featured Edges are live yet.
          </div>
        )}
      </div>
    </div>
  );
}
