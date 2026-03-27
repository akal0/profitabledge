"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type EdgeSurfaceMetrics = {
  tradeCount?: number | null;
  winRate?: number | null;
  expectancy?: number | null;
  netPnl?: number | null;
};

export type EdgeSurfacePassport = {
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
};

export type EdgeSurfaceSource = {
  id?: string | null;
  name?: string | null;
};

export type EdgeSurfaceMeta = {
  publicationMode?: string | null;
  publicStatsVisible?: boolean | null;
  sourceEdgeId?: string | null;
  sourceEdge?: EdgeSurfaceSource | null;
  metrics?: EdgeSurfaceMetrics | null;
  passport?: EdgeSurfacePassport | null;
};

type ReadinessTone = "ready" | "building" | "early" | "draft";

type ReadinessSnapshot = {
  label: string;
  detail: string;
  tone: ReadinessTone;
};

function normalizeReadinessTone(label: string): ReadinessTone {
  const normalized = label.trim().toLowerCase();
  if (
    normalized.includes("ready") ||
    normalized.includes("verified") ||
    normalized.includes("strong")
  ) {
    return "ready";
  }

  if (
    normalized.includes("build") ||
    normalized.includes("develop") ||
    normalized.includes("growing")
  ) {
    return "building";
  }

  if (
    normalized.includes("early") ||
    normalized.includes("emerging") ||
    normalized.includes("forming")
  ) {
    return "early";
  }

  return "draft";
}

export function getEdgeReadinessSnapshot(edge: EdgeSurfaceMeta): ReadinessSnapshot {
  const explicitLabel = edge.passport?.readiness?.label?.trim();
  const explicitDetail = edge.passport?.readiness?.note?.trim();
  if (explicitLabel) {
    return {
      label: explicitLabel,
      detail: explicitDetail || "Passport-backed readiness signal.",
      tone: normalizeReadinessTone(explicitLabel),
    };
  }

  const tradeCount = edge.metrics?.tradeCount ?? 0;
  const expectancy = edge.metrics?.expectancy ?? 0;
  const winRate = edge.metrics?.winRate ?? 0;

  if (tradeCount >= 40 && expectancy > 0 && winRate >= 0.5) {
    return {
      label: "Ready",
      detail: "Enough sample to fork, publish, or allocate with confidence.",
      tone: "ready",
    };
  }

  if (tradeCount >= 20 && expectancy > 0) {
    return {
      label: "Building",
      detail: "Promising sample. Keep tagging before you publish the fork.",
      tone: "building",
    };
  }

  if (tradeCount >= 8) {
    return {
      label: "Early",
      detail: "Pattern is visible, but the sample still needs work.",
      tone: "early",
    };
  }

  return {
    label: "Draft",
    detail: "Too little trade evidence yet. Keep refining privately.",
    tone: "draft",
  };
}

export function getEdgeVisibilityLabel(edge: EdgeSurfaceMeta) {
  if (edge.publicationMode === "library") {
    return edge.publicStatsVisible === false
      ? "Public template"
      : "Public forkable";
  }

  if (edge.publicationMode === "shared") {
    return "Shared access";
  }

  return "Private";
}

export function getEdgeVisibilityDetail(edge: EdgeSurfaceMeta) {
  if (edge.publicationMode === "library") {
    return edge.publicStatsVisible === false
      ? "Fork publicly visible logic, while the creator keeps stats private."
      : "Fork it privately now and choose later whether your version goes public.";
  }

  if (edge.publicationMode === "shared") {
    return "Direct collaboration stays private unless someone publishes a fork.";
  }

  return "Private builds stay yours until you choose to publish a fork.";
}

export function getEdgeLineageHint(edge: EdgeSurfaceMeta) {
  if (edge.sourceEdge?.name) {
    return `Forked from ${edge.sourceEdge.name}`;
  }

  if (edge.sourceEdgeId) {
    return "Forked from another Edge in your stack.";
  }

  const forkCount =
    edge.passport?.lineage?.forkCount ?? edge.passport?.lineage?.descendantCount;
  if (forkCount && forkCount > 0) {
    return `${forkCount} ${forkCount === 1 ? "fork" : "forks"} created from this Edge.`;
  }

  return null;
}

export function getEdgeForkPolicyHint(edge: EdgeSurfaceMeta) {
  if (edge.publicationMode === "library") {
    return "Fork privately first. Publish your version only when the proof is there.";
  }

  if (edge.sourceEdgeId || edge.sourceEdge) {
    return "This is your own branch. Keep it private or make the fork public later.";
  }

  return "Keep iterating privately until the setup earns a public passport.";
}

export function getEdgeForkCount(edge: EdgeSurfaceMeta) {
  return (
    edge.passport?.lineage?.forkCount ?? edge.passport?.lineage?.descendantCount ?? 0
  );
}

function readinessBadgeClassName(tone: ReadinessTone) {
  switch (tone) {
    case "ready":
      return "border-emerald-400/20 bg-emerald-400/12 text-emerald-200";
    case "building":
      return "border-sky-400/20 bg-sky-400/12 text-sky-200";
    case "early":
      return "border-amber-300/20 bg-amber-300/12 text-amber-100";
    default:
      return "border-white/10 bg-white/5 text-white/68";
  }
}

export function EdgeReadinessBadge({
  edge,
  className,
}: {
  edge: EdgeSurfaceMeta;
  className?: string;
}) {
  const readiness = getEdgeReadinessSnapshot(edge);

  return (
    <Badge
      variant="outline"
      className={cn(readinessBadgeClassName(readiness.tone), className)}
      title={readiness.detail}
    >
      {readiness.label}
    </Badge>
  );
}

export function EdgeVisibilityBadge({
  edge,
  className,
}: {
  edge: EdgeSurfaceMeta;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("border-white/10 text-white/58", className)}
      title={getEdgeVisibilityDetail(edge)}
    >
      {getEdgeVisibilityLabel(edge)}
    </Badge>
  );
}

export function EdgeForkBadge({
  edge,
  className,
}: {
  edge: EdgeSurfaceMeta;
  className?: string;
}) {
  if (!edge.sourceEdgeId && !edge.sourceEdge) {
    return null;
  }

  return (
    <Badge
      variant="outline"
      className={cn("border-teal-400/20 bg-teal-400/10 text-teal-200", className)}
      title={getEdgeForkPolicyHint(edge)}
    >
      Fork
    </Badge>
  );
}
