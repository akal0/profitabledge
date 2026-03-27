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
import { getEdgeReadinessSnapshot } from "@/components/edges/edge-surface-badges";
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
  publicStatsVisible?: boolean | null;
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
      if (getEdgeReadinessSnapshot(currentEdge).tone === "ready") {
        accumulator.readyCount += 1;
      }
      if (currentEdge.publicationMode === "library") {
        accumulator.publicCount += 1;
      }
      if (currentEdge.owner?.id) {
        accumulator.ownerIds.add(currentEdge.owner.id);
      }
      return accumulator;
    },
    {
      edgeCount: 0,
      tradeCount: 0,
      readyCount: 0,
      publicCount: 0,
      ownerIds: new Set<string>(),
    }
  );

  return (
    <div className={EDGE_PAGE_SHELL_CLASS}>
      <EdgePageHeader
        eyebrow="Direct Edge shares"
        title="Shared Edges"
        description="Edges other traders have shared directly with you. Collaborate privately here, then fork into your own stack and decide later whether your branch should be public."
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
          label="Ready to adapt"
          value={summary.readyCount}
          detail={`${summary.tradeCount} tagged trades across shared Edges`}
        />
        <EdgeMetricCard
          icon={TrendingUp}
          label="Also public"
          value={summary.publicCount}
          detail={
            summary.publicCount > 0
              ? "Open the creator library or fork privately"
              : "Private collaboration only"
          }
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-white/72">Shared with you</p>
            <p className="text-sm text-white/40">
              Open each shared Edge directly, collaborate privately, or jump into the creator library when the Edge is also public and forkable.
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
