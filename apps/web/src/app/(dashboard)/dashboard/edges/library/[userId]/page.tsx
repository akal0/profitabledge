"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Layers3, Sparkles, TrendingUp, UsersRound } from "lucide-react";

import { EdgeLibraryCard } from "@/components/edges/edge-library-card";
import {
  EDGE_ACTION_BUTTON_CLASSNAME,
  EDGE_PAGE_SHELL_CLASS,
  EdgeMetricCard,
} from "@/components/edges/edge-page-primitives";
import { getEdgeReadinessSnapshot } from "@/components/edges/edge-surface-badges";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import { trpcOptions } from "@/utils/trpc";

type LibraryEdge = {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  publicationMode?: string | null;
  publicStatsVisible?: boolean | null;
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

type LibraryResponse = {
  owner: {
    id: string;
    name: string;
    displayName?: string | null;
    username?: string | null;
    image?: string | null;
    bio?: string | null;
  };
  edges: LibraryEdge[];
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

function getOwnerLabel(owner: LibraryResponse["owner"]) {
  return owner.displayName || owner.name || "Trader";
}

function getOwnerFallback(owner: LibraryResponse["owner"]) {
  return getOwnerLabel(owner)
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function EdgeCreatorLibraryPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = use(params);
  const router = useRouter();
  const libraryQuery = useQuery(
    trpcOptions.edges.getLibraryByOwner.queryOptions({
      ownerUserId: userId,
    })
  );

  if (libraryQuery.isLoading) {
    return <RouteLoadingFallback route="edges" className="min-h-full" />;
  }

  const data = libraryQuery.data as LibraryResponse | undefined;

  if (!data) {
    return (
      <div className={EDGE_PAGE_SHELL_CLASS}>
        <div className="rounded-md border border-dashed border-white/10 bg-sidebar px-5 py-6 text-sm text-white/45">
          This library could not be loaded.
        </div>
      </div>
    );
  }

  const summary = data.edges.reduce(
    (accumulator, currentEdge) => {
      accumulator.edgeCount += 1;
      if (currentEdge.metrics) {
        accumulator.tradeCount += currentEdge.metrics.tradeCount ?? 0;
        accumulator.netPnl += currentEdge.metrics.netPnl ?? 0;
        accumulator.winRateSum += currentEdge.metrics.winRate ?? 0;
        accumulator.statsVisibleCount += 1;
      }
      if (getEdgeReadinessSnapshot(currentEdge).tone === "ready") {
        accumulator.readyCount += 1;
      }
      return accumulator;
    },
    {
      edgeCount: 0,
      tradeCount: 0,
      netPnl: 0,
      winRateSum: 0,
      statsVisibleCount: 0,
      readyCount: 0,
    }
  );

  return (
    <div className={EDGE_PAGE_SHELL_CLASS}>
      <div className="overflow-hidden rounded-md border border-white/5 bg-sidebar">
        <div className="h-24 bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.25),_transparent_38%),linear-gradient(135deg,_rgba(255,255,255,0.08),_rgba(255,255,255,0.02))]" />
        <div className="px-5 pb-5">
          <div className="-mt-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="flex items-start gap-4">
              <Avatar className="size-16 border-4 border-sidebar shadow-lg">
                {data.owner.image ? (
                  <AvatarImage
                    alt={getOwnerLabel(data.owner)}
                    src={data.owner.image}
                  />
                ) : null}
                <AvatarFallback className="bg-sidebar-accent text-lg font-semibold text-white">
                  {getOwnerFallback(data.owner)}
                </AvatarFallback>
              </Avatar>

              <div className="space-y-2 pt-2">
                <div>
                  <p className="text-[11px] font-medium text-teal-400/78">
                    Creator library
                  </p>
                  <h1 className="text-2xl font-semibold text-white">
                    {getOwnerLabel(data.owner)}
                  </h1>
                  <p className="text-sm text-white/45">
                    {data.owner.username
                      ? `@${data.owner.username}`
                      : "Public Edge creator"}
                  </p>
                </div>
                <p className="max-w-3xl text-sm leading-6 text-white/52">
                  {data.owner.bio ||
                    "Public Edges from this creator, grouped into one library so you can inspect the template, fork it privately, and publish your own branch later if it earns proof."}
                </p>
              </div>
            </div>

            <Button
              className={EDGE_ACTION_BUTTON_CLASSNAME}
              onClick={() => router.push("/dashboard/edges/library")}
            >
              Back to Library
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <EdgeMetricCard
          icon={Layers3}
          label="Public Edges"
          value={summary.edgeCount}
          detail={data.owner.username ? `@${data.owner.username}` : "Library"}
        />
        <EdgeMetricCard
          icon={Sparkles}
          label="Ready to fork"
          value={summary.readyCount}
          detail="Stronger public templates"
        />
        <EdgeMetricCard
          icon={UsersRound}
          label="Tagged trades"
          value={summary.tradeCount}
          detail={
            summary.statsVisibleCount > 0
              ? "Across visible public stats"
              : "Shown when creators share stats"
          }
        />
        <EdgeMetricCard
          icon={TrendingUp}
          label="Average win rate"
          value={
            summary.statsVisibleCount > 0
              ? formatPercent(summary.winRateSum / summary.statsVisibleCount)
              : "—"
          }
          detail={
            summary.statsVisibleCount > 0
              ? formatMoney(summary.netPnl)
              : "Public stats hidden"
          }
        />
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-white/72">Public Edges</p>
            <p className="text-sm text-white/40">
              Every public Edge from this creator, with readiness, lineage, and proof signals up front before you fork your own branch.
            </p>
          </div>
          <p className="text-xs text-white/34">{summary.edgeCount} total</p>
        </div>

        {data.edges.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.edges.map((edge) => (
              <EdgeLibraryCard
                key={edge.id}
                edge={edge}
                edgeHref={`/dashboard/edges/${edge.id}`}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-white/10 bg-sidebar px-5 py-6 text-sm text-white/45">
            No public Edges in this library yet.
          </div>
        )}
      </div>
    </div>
  );
}
