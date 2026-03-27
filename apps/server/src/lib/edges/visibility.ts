export function canViewPublicEdgeStats(args: {
  publicationMode: string | null | undefined;
  isFeatured: boolean | null | undefined;
  publicStatsVisible: boolean | null | undefined;
}) {
  if (args.isFeatured) {
    return true;
  }

  if (args.publicationMode !== "library") {
    return true;
  }

  return args.publicStatsVisible !== false;
}

export function canViewPrivateEdgeActivity(args: {
  viewerIsOwner: boolean;
  viewerHasDirectShare: boolean;
}) {
  return args.viewerIsOwner || args.viewerHasDirectShare;
}

export function canViewPublicEdgePage(args: {
  status: string | null | undefined;
  publicationMode: string | null | undefined;
  isFeatured: boolean | null | undefined;
}) {
  if (args.status === "archived") {
    return false;
  }

  return args.isFeatured === true || args.publicationMode === "library";
}

export function buildPublicEdgePath(edgeId: string) {
  return `/edge/${edgeId}`;
}

export function getEdgeForkDepth(sourceEdgeId: string | null | undefined) {
  return sourceEdgeId ? 1 : 0;
}

export function applyPublicSummaryStatsVisibility<
  TSummary extends {
    publicationMode?: string | null;
    isFeatured?: boolean | null;
    publicStatsVisible?: boolean | null;
    metrics?: unknown;
    passport?: {
      cards?: unknown;
      fitNotes?: unknown;
      readiness?: unknown;
      lineage?: unknown;
    } | null;
  },
>(summary: TSummary) {
  if (
    canViewPublicEdgeStats({
      publicationMode: summary.publicationMode,
      isFeatured: summary.isFeatured,
      publicStatsVisible: summary.publicStatsVisible,
    })
  ) {
    return summary;
  }

  return {
    ...summary,
    metrics: null,
    passport: summary.passport
      ? {
          ...summary.passport,
          cards: null,
          fitNotes: [],
          readiness: null,
        }
      : summary.passport,
  };
}
