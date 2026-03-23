"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Share2, Target, TrendingUp, UsersRound } from "lucide-react";

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

type SharedEdge = {
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

export default function EdgesSharedPage() {
  const router = useRouter();
  const discoveryQuery = useQuery(trpcOptions.edges.listShared.queryOptions());

  if (discoveryQuery.isLoading) {
    return <RouteLoadingFallback route="edges" className="min-h-full" />;
  }

  const sharedWithMe =
    ((discoveryQuery.data as { sharedWithMe?: SharedEdge[] } | undefined)
      ?.sharedWithMe ?? []) as SharedEdge[];

  const summary = sharedWithMe.reduce(
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
        eyebrow="Direct Edge shares"
        title="Shared Edges"
        description="Edges other traders have shared directly with you. Public templates stay in the library, while private collaborations and editor invites stay here."
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
          icon={Share2}
          label="Shared Edges"
          value={summary.edgeCount}
          detail="Direct access"
        />
        <EdgeMetricCard
          icon={UsersRound}
          label="Creators"
          value={summary.ownerIds.size}
          detail="Sharing with you"
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
            <p className="text-sm font-medium text-white/72">Shared with you</p>
            <p className="text-sm text-white/40">
              Open each shared Edge directly, or jump into the creator library when the Edge is also public.
            </p>
          </div>
          <p className="text-xs text-white/34">{summary.edgeCount} shared</p>
        </div>

        {sharedWithMe.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {sharedWithMe.map((edge) => (
              <EdgeLibraryCard
                key={edge.id}
                edge={edge}
                edgeHref={`/dashboard/edges/${edge.id}`}
                libraryHref={
                  edge.publicationMode === "library" && edge.owner?.id
                    ? `/dashboard/edges/library/${edge.owner.id}`
                    : undefined
                }
              />
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-white/10 bg-sidebar px-5 py-6 text-sm text-white/45">
            No Edges have been shared with you yet.
          </div>
        )}
      </div>
    </div>
  );
}
