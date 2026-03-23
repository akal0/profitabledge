"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useRef, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  BarChart3,
  BookOpenText,
  ChevronLeft,
  Clock3,
  Edit3,
  Eye,
  EyeOff,
  Globe2,
  GripVertical,
  ImageIcon,
  Layers3,
  Lock,
  ListChecks,
  Plus,
  Save,
  Table2,
  Target,
  TrendingUp,
  UsersRound,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  EDGE_ACTION_BUTTON_CLASSNAME,
  EDGE_PAGE_SHELL_CLASS,
  EdgeMetricCard,
  EdgePanel,
} from "@/components/edges/edge-page-primitives";
import { EdgeCoverBanner } from "@/components/edges/edge-cover-banner";
import { EdgeExecutedTradesTable } from "@/components/edges/edge-executed-trades-table";
import { EdgeShareSheet } from "@/components/edges/edge-share-sheet";
import {
  CoverImageCropDialog,
  type CoverFrameDimensions,
} from "@/components/cover-image-crop-dialog";
import {
  EdgeBreakdownBarCard,
  EdgeEquityCurveCard,
  EdgeRMultipleSpreadCard,
} from "@/components/edges/edge-overview-charts";
import {
  journalActionButtonMutedClassName,
  journalActionIconButtonClassName,
} from "@/components/journal/action-button-styles";
import { JournalEditor } from "@/components/journal/editor";
import { JournalEditorStyles } from "@/components/journal/editor/journal-editor-styles";
import type { JournalBlock } from "@/components/journal/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { trpc, trpcOptions } from "@/utils/trpc";

const EDGE_TABS = [
  "content",
  "rules",
  "examples",
  "overview",
  "executed-trades",
  "missed-trades",
  "entries",
] as const;

const EDGE_OVERVIEW_ENTRIES_PAGE_SIZE = 8;

type EdgeTab = (typeof EDGE_TABS)[number];

type EdgeDetailResponse = {
  edge: {
    id: string;
    name: string;
    description?: string | null;
    color?: string | null;
    isDemoSeeded?: boolean;
    isFeatured?: boolean;
    coverImageUrl?: string | null;
    coverImagePosition?: number | null;
    contentBlocks?: JournalBlock[] | null;
    contentHtml?: string | null;
    examplesBlocks?: JournalBlock[] | null;
    examplesHtml?: string | null;
    status: string;
    publicationMode: string;
    publicStatsVisible?: boolean | null;
    sourceEdgeId?: string | null;
    metrics: {
      tradeCount: number;
      winRate: number | null;
      netPnl: number;
      expectancy: number | null;
      averageR: number | null;
      profitFactor: number | null;
      missedTradeCount: number;
      missedTradeOpportunity: number;
      shareCount: number;
      copyCount: number;
      followThroughRate: number | null;
      reviewCoverage: number | null;
      reviewCounts: {
        followed: number;
        broken: number;
        notReviewed: number;
        applicable: number;
        reviewed: number;
      };
      charts: {
        equityCurve: Array<{ index: number; equity: number; label: string }>;
        outcomeBreakdown: Array<{ label: string; value: number }>;
        sessionBreakdown: Array<{ label: string; value: number }>;
        rDistribution: Array<{ label: string; value: number }>;
      };
    } | null;
  };
  canEdit: boolean;
  viewerCanSeeStats: boolean;
  viewerCanSeePrivateActivity: boolean;
  publishCapabilities: {
    canFeature: boolean;
    canPublishLibrary: boolean;
  } | undefined;
  sections: Array<{
    id: string;
    title: string;
    description?: string | null;
    metrics: {
      followThroughRate: number | null;
      reviewCoverage: number | null;
      reviewedCount: number;
      sampleSize: number;
      netPnl: number;
    };
    rules: Array<{
      id: string;
      title: string;
      description?: string | null;
      appliesOutcomes?: string[] | null;
      metrics: {
        followThroughRate: number | null;
        reviewedCount: number;
        sampleSize: number;
        netPnl: number;
        expectancy: number | null;
        winRateWhenFollowed: number | null;
        winRateWhenBroken: number | null;
      };
    }>;
  }>;
  executedTrades: Array<{
    id: string;
    symbol?: string | null;
    tradeType?: string | null;
    tradeDirection?: string | null;
    profit?: number | null;
    outcome?: string | null;
    sessionTag?: string | null;
    openTime?: string | Date | null;
    closeTime?: string | Date | null;
    realisedRR?: number | null;
  }>;
  missedTrades: Array<{
    id: string;
    symbol?: string | null;
    tradeType?: string | null;
    sessionTag?: string | null;
    setupTime?: string | Date | null;
    reasonMissed?: string | null;
    notes?: string | null;
    estimatedOutcome?: string | null;
    estimatedRR?: number | null;
    estimatedPnl?: number | null;
  }>;
  entries: Array<{
    id: string;
    title: string;
    entryType: string;
    journalDate?: string | Date | null;
    updatedAt?: string | Date | null;
  }>;
  sharedMembers: Array<{
    id: string;
    userId: string;
    name: string | null;
    displayName: string | null;
    username: string | null;
    email: string | null;
    image: string | null;
    role: "viewer" | "editor";
    createdAt?: string | Date | null;
    updatedAt?: string | Date | null;
  }>;
};

const RULE_OUTCOME_OPTIONS = [
  { value: "all", label: "All outcomes" },
  { value: "winner", label: "Winner" },
  { value: "partial_win", label: "Partial win" },
  { value: "loser", label: "Loser" },
  { value: "breakeven", label: "Breakeven" },
  { value: "cut_trade", label: "Cut trade" },
] as const;

type RuleDraft = {
  title: string;
  description: string;
  appliesOutcomes: string[];
};

type EdgePublicationState = "private" | "library" | "featured";

function isEdgeTab(value: string | null): value is EdgeTab {
  return value !== null && EDGE_TABS.includes(value as EdgeTab);
}

function formatPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function formatMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatR(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}R`;
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "Unscheduled";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unscheduled";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatTradeOutcome(outcome: string | null | undefined) {
  if (!outcome) return "Unclassified";

  switch (outcome) {
    case "Win":
      return "Winner";
    case "PW":
      return "Partial win";
    case "Loss":
      return "Loser";
    case "BE":
      return "Breakeven";
    default:
      return outcome
        .replace(/_/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase());
  }
}

function formatEntryTypeLabel(entryType: string) {
  return entryType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatRuleOutcomeLabel(outcome: string) {
  const matchedOption = RULE_OUTCOME_OPTIONS.find(
    (option) => option.value === outcome
  );
  if (matchedOption) {
    return matchedOption.label;
  }

  return outcome
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getOverviewGridClass(count: number) {
  if (count >= 5) {
    return "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5";
  }

  if (count === 4) {
    return "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4";
  }

  if (count === 3) {
    return "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3";
  }

  if (count === 2) {
    return "grid grid-cols-1 gap-4 md:grid-cols-2";
  }

  return "grid grid-cols-1 gap-4";
}

function createEmptyRuleDraft(): RuleDraft {
  return {
    title: "",
    description: "",
    appliesOutcomes: ["all"],
  };
}

function parseCoverPosition(objectPosition: string) {
  const y = objectPosition.trim().split(/\s+/)[1] ?? "50%";
  const nextPosition = Number.parseFloat(y.replace("%", ""));

  if (!Number.isFinite(nextPosition)) {
    return 50;
  }

  return Math.max(0, Math.min(100, Math.round(nextPosition)));
}

function normalizeOutcomeSelection(outcomes: string[]) {
  const deduped = Array.from(new Set(outcomes));
  if (deduped.length === 0 || deduped.includes("all")) {
    return ["all"];
  }
  return deduped;
}

function EdgeBuilderPreview({
  html,
  emptyLabel,
  transparent = false,
}: {
  html?: string | null;
  emptyLabel: string;
  transparent?: boolean;
}) {
  if (!html?.trim()) {
    return (
      <div
        className={cn(
          "flex min-h-56 items-center justify-center px-5 py-6 text-xs text-white/45",
          transparent
            ? "bg-transparent"
            : "rounded-lg border border-dashed border-white/10 bg-black/20"
        )}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "px-5 py-4",
        transparent
          ? "bg-transparent px-0 py-0"
          : "rounded-lg border border-white/8 bg-black/20"
      )}
    >
      <div className="journal-editor" data-compact="true">
        <JournalEditorStyles />
        <article
          className="journal-editor-content focus:outline-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}

export default function EdgeDetailPage({
  params,
}: {
  params: Promise<{ edgeId: string }>;
}) {
  const { edgeId } = use(params);
  const coverImageRef = useRef<HTMLInputElement>(null);
  const coverContainerRef = useRef<HTMLDivElement>(null);
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils() as any;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const safePathname = pathname ?? `/dashboard/edges/${edgeId}`;
  const requestedTab = searchParams?.get("tab") ?? null;
  const activeTab = isEdgeTab(requestedTab) ? requestedTab : "content";
  const [builderEditorSeed, setBuilderEditorSeed] = useState(0);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [pendingCoverSrc, setPendingCoverSrc] = useState("");
  const [coverFrameDimensions, setCoverFrameDimensions] =
    useState<CoverFrameDimensions | null>(null);
  const [edgeDraft, setEdgeDraft] = useState({
    name: "",
    description: "",
    coverImageUrl: null as string | null,
    coverImagePosition: 50,
    contentBlocks: [] as JournalBlock[],
    contentHtml: "",
    examplesBlocks: [] as JournalBlock[],
    examplesHtml: "",
    color: "#3B82F6",
    publicationMode: "private" as EdgePublicationState,
    publicStatsVisible: true,
    status: "active",
  });
  const [newSectionDraft, setNewSectionDraft] = useState({
    title: "",
    description: "",
  });
  const [sectionDrafts, setSectionDrafts] = useState<
    Record<string, { title: string; description: string }>
  >({});
  const [activeRuleComposerSectionId, setActiveRuleComposerSectionId] = useState<
    string | null
  >(null);
  const [overviewEntriesPage, setOverviewEntriesPage] = useState(0);
  const [newRuleDrafts, setNewRuleDrafts] = useState<Record<string, RuleDraft>>(
    {}
  );
  const [draggedRule, setDraggedRule] = useState<{
    sectionId: string;
    ruleId: string;
  } | null>(null);
  const [dragOverRuleId, setDragOverRuleId] = useState<string | null>(null);
  const detailQuery = useQuery(
    trpcOptions.edges.getDetail.queryOptions({ edgeId })
  );
  const updateEdge = trpc.edges.update.useMutation();
  const duplicateEdge = trpc.edges.duplicate.useMutation();
  const publishEdge = trpc.edges.publish.useMutation();
  const upsertSection = trpc.edges.upsertSection.useMutation();
  const upsertRule = trpc.edges.upsertRule.useMutation();
  const reorderRule = trpc.edges.upsertRule.useMutation();
  const detail = detailQuery.data as EdgeDetailResponse | undefined;
  const detailEdge = detail?.edge;
  const measureCoverFrame = useCallback(() => {
    const coverRect = coverContainerRef.current?.getBoundingClientRect();
    if (coverRect && coverRect.width > 0 && coverRect.height > 0) {
      const nextDimensions = {
        width: coverRect.width,
        height: coverRect.height,
      };
      setCoverFrameDimensions(nextDimensions);
      return nextDimensions;
    }

    const pageRect = pageContainerRef.current?.getBoundingClientRect();
    if (pageRect && pageRect.width > 0) {
      const nextDimensions = {
        width: pageRect.width,
        height: window.matchMedia("(min-width: 768px)").matches ? 288 : 224,
      };
      setCoverFrameDimensions(nextDimensions);
      return nextDimensions;
    }

    return null;
  }, []);
  const openCoverCropDialog = useCallback(
    (imageSrc: string) => {
      measureCoverFrame();
      setPendingCoverSrc(imageSrc);
      setCropDialogOpen(true);
    },
    [measureCoverFrame]
  );
  const refreshEdgeData = async () => {
    await Promise.all([
      utils.edges.getDetail.invalidate({ edgeId }),
      utils.edges.listMy.invalidate(),
      utils.edges.listShared.invalidate(),
    ]);
  };

  useEffect(() => {
    if (!detailEdge) {
      return;
    }

    setEdgeDraft({
      name: detailEdge.name,
      description: detailEdge.description ?? "",
      coverImageUrl: detailEdge.coverImageUrl ?? null,
      coverImagePosition: detailEdge.coverImagePosition ?? 50,
      contentBlocks: detailEdge.contentBlocks ?? [],
      contentHtml: detailEdge.contentHtml ?? "",
      examplesBlocks: detailEdge.examplesBlocks ?? [],
      examplesHtml: detailEdge.examplesHtml ?? "",
      color: detailEdge.color ?? "#3B82F6",
      publicationMode: detailEdge.isFeatured
        ? "featured"
        : detailEdge.publicationMode === "library"
          ? "library"
          : "private",
      publicStatsVisible: detailEdge.publicStatsVisible ?? true,
      status: detailEdge.status,
    });
  }, [
    detailEdge?.coverImagePosition,
    detailEdge?.coverImageUrl,
    detailEdge?.contentBlocks,
    detailEdge?.contentHtml,
    detailEdge?.color,
    detailEdge?.description,
    detailEdge?.examplesBlocks,
    detailEdge?.examplesHtml,
    detailEdge?.isFeatured,
    detailEdge?.name,
    detailEdge?.publicStatsVisible,
    detailEdge?.publicationMode,
    detailEdge?.status,
  ]);

  useEffect(() => {
    setBuilderEditorSeed((currentSeed) => currentSeed + 1);
  }, [detailEdge?.id, detailEdge?.contentHtml, detailEdge?.examplesHtml]);

  useEffect(() => {
    setIsEditingDescription(false);
  }, [detailEdge?.id, detailEdge?.description]);

  useEffect(() => {
    setOverviewEntriesPage(0);
  }, [detailEdge?.id, detail?.entries.length]);

  useEffect(() => {
    if (!detail) {
      return;
    }

    setSectionDrafts(
      Object.fromEntries(
        detail.sections.map((section) => [
          section.id,
          {
            title: section.title,
            description: section.description ?? "",
          },
        ])
      )
    );
    setNewRuleDrafts((previousDrafts) => {
      const nextDrafts = { ...previousDrafts };
      for (const section of detail.sections) {
        nextDrafts[section.id] = nextDrafts[section.id] ?? createEmptyRuleDraft();
      }
      return nextDrafts;
    });
  }, [detail]);

  const hasEdgeChanges = useMemo(
    () =>
      detailEdge
        ? edgeDraft.name.trim() !== detailEdge.name ||
          (edgeDraft.description.trim() || "") !==
            (detailEdge.description ?? "") ||
          (edgeDraft.coverImageUrl ?? null) !==
            (detailEdge.coverImageUrl ?? null) ||
          edgeDraft.coverImagePosition !== (detailEdge.coverImagePosition ?? 50) ||
          (edgeDraft.contentHtml || "") !== (detailEdge.contentHtml ?? "") ||
          (edgeDraft.examplesHtml || "") !== (detailEdge.examplesHtml ?? "") ||
          edgeDraft.color !== (detailEdge.color ?? "#3B82F6") ||
          edgeDraft.publicationMode !==
            (detailEdge.isFeatured
              ? "featured"
              : detailEdge.publicationMode === "library"
                ? "library"
                : "private") ||
          edgeDraft.publicStatsVisible !==
            (detailEdge.publicStatsVisible ?? true) ||
          edgeDraft.status !== detailEdge.status
        : false,
    [detailEdge, edgeDraft]
  );

  if (detailQuery.isLoading) {
    return <RouteLoadingFallback route="edges" className="min-h-full" />;
  }

  if (!detail) {
    return (
      <div className={EDGE_PAGE_SHELL_CLASS}>
        <div className="rounded-lg border border-dashed border-white/10 bg-black/20 px-5 py-6 text-xs text-white/48">
          This Edge could not be loaded.
        </div>
      </div>
    );
  }

  const currentEdge = detail.edge;
  const metrics = currentEdge.metrics;
  const canShowStats = detail.viewerCanSeeStats && metrics != null;
  const canShowPrivateActivity = detail.viewerCanSeePrivateActivity;
  const isPublicTemplateView =
    !detail.canEdit &&
    (currentEdge.isFeatured || currentEdge.publicationMode === "library");
  const totalRuleCount = detail.sections.reduce(
    (count, section) => count + section.rules.length,
    0
  );
  const canEditCover = detail.canEdit && !currentEdge.isDemoSeeded;
  const visibleDescription = detail.canEdit
    ? edgeDraft.description.trim()
    : currentEdge.description ?? "";
  const visibleCoverImageUrl = detail.canEdit
    ? edgeDraft.coverImageUrl
    : currentEdge.coverImageUrl ?? null;
  const visibleCoverImagePosition = detail.canEdit
    ? edgeDraft.coverImagePosition
    : currentEdge.coverImagePosition ?? 50;
  const visibleColor = detail.canEdit
    ? edgeDraft.color
    : currentEdge.color ?? "#3B82F6";
  const visiblePublicationMode = detail.canEdit
    ? edgeDraft.publicationMode
    : currentEdge.isFeatured
      ? "featured"
      : currentEdge.publicationMode === "library"
        ? "library"
        : "private";
  const visiblePublicStatsVisible = detail.canEdit
    ? edgeDraft.publicStatsVisible
    : currentEdge.publicStatsVisible ?? true;
  const visibleStatus = detail.canEdit ? edgeDraft.status : currentEdge.status;
  const overviewEntriesPageCount = Math.max(
    1,
    Math.ceil(detail.entries.length / EDGE_OVERVIEW_ENTRIES_PAGE_SIZE)
  );
  const clampedOverviewEntriesPage = Math.min(
    overviewEntriesPage,
    Math.max(overviewEntriesPageCount - 1, 0)
  );
  const overviewEntries = detail.entries.slice(
    clampedOverviewEntriesPage * EDGE_OVERVIEW_ENTRIES_PAGE_SIZE,
    (clampedOverviewEntriesPage + 1) * EDGE_OVERVIEW_ENTRIES_PAGE_SIZE
  );
  const visibleTabs = [
    { id: "content", label: "Content", icon: Edit3 },
    { id: "rules", label: "Rules", icon: ListChecks },
    { id: "examples", label: "Examples", icon: ImageIcon },
    { id: "overview", label: "Overview", icon: BarChart3 },
    ...(canShowPrivateActivity
      ? ([
          { id: "executed-trades", label: "Executed Trades", icon: Table2 },
          { id: "missed-trades", label: "Missed Trades", icon: Clock3 },
          { id: "entries", label: "Entries", icon: BookOpenText },
        ] as const)
      : []),
  ];
  const resolvedActiveTab = visibleTabs.some((tab) => tab.id === activeTab)
    ? activeTab
    : "content";
  const publishCapabilities = detail.publishCapabilities ?? {
    canFeature: false,
    canPublishLibrary: false,
  };
  const overviewMetricCards = canShowStats
    ? [
        {
          icon: Target,
          label: "Win rate",
          value: formatPercent(metrics!.winRate),
          detail: `${metrics!.tradeCount} trades`,
        },
        {
          icon: TrendingUp,
          label: "Net P&L",
          value: formatMoney(metrics!.netPnl),
          detail: formatR(metrics!.expectancy),
        },
        {
          icon: ListChecks,
          label: "Follow-through",
          value: formatPercent(metrics!.followThroughRate),
          detail: `${metrics!.reviewCounts.reviewed} reviewed`,
        },
        ...(canShowPrivateActivity
          ? [
              {
                icon: BookOpenText,
                label: "Linked entries",
                value: detail.entries.length,
                detail: "Edge-specific notes",
              },
              {
                icon: Clock3,
                label: "Missed trades",
                value: metrics!.missedTradeCount,
                detail: formatMoney(metrics!.missedTradeOpportunity),
              },
            ]
          : []),
      ]
    : [];
  const edgeProfileCards = canShowStats
    ? [
        {
          icon: Layers3,
          label: "Profit factor",
          value:
            metrics!.profitFactor != null ? metrics!.profitFactor.toFixed(2) : "—",
          detail: "Gross wins / losses",
        },
        {
          icon: TrendingUp,
          label: "Average R",
          value: formatR(metrics!.averageR),
          detail: "Realised trade sample",
        },
        {
          icon: ListChecks,
          label: "Review coverage",
          value: formatPercent(metrics!.reviewCoverage),
          detail: `${metrics!.reviewCounts.applicable} applicable`,
        },
        ...(canShowPrivateActivity
          ? [
              {
                icon: Clock3,
                label: "Missed-trade opportunity",
                value: formatMoney(metrics!.missedTradeOpportunity),
                detail: `${metrics!.missedTradeCount} missed`,
              },
            ]
          : []),
        {
          icon: UsersRound,
          label: "Copies / shares",
          value: `${metrics!.copyCount} / ${metrics!.shareCount}`,
          detail: "Imported / shared",
        },
      ]
    : [];

  const handleReorderRules = async (
    sectionId: string,
    sourceRuleId: string,
    targetRuleId: string
  ) => {
    if (sourceRuleId === targetRuleId || reorderRule.isPending) {
      setDraggedRule(null);
      setDragOverRuleId(null);
      return;
    }

    const currentSection = detail.sections.find(
      (section) => section.id === sectionId
    );
    if (!currentSection) {
      setDraggedRule(null);
      setDragOverRuleId(null);
      return;
    }

    const sourceIndex = currentSection.rules.findIndex(
      (rule) => rule.id === sourceRuleId
    );
    const targetIndex = currentSection.rules.findIndex(
      (rule) => rule.id === targetRuleId
    );

    if (sourceIndex === -1 || targetIndex === -1) {
      setDraggedRule(null);
      setDragOverRuleId(null);
      return;
    }

    const reorderedRules = [...currentSection.rules];
    const [movedRule] = reorderedRules.splice(sourceIndex, 1);
    reorderedRules.splice(targetIndex, 0, movedRule);

    setDraggedRule(null);
    setDragOverRuleId(null);

    try {
      for (const [sortOrder, rule] of reorderedRules.entries()) {
        await reorderRule.mutateAsync({
          edgeId,
          ruleId: rule.id,
          sectionId,
          title: rule.title,
          description: rule.description ?? null,
          sortOrder,
          appliesOutcomes:
            (rule.appliesOutcomes as Array<
              | "winner"
              | "partial_win"
              | "loser"
              | "breakeven"
              | "cut_trade"
              | "all"
            > | null) ?? ["all"],
        });
      }

      await refreshEdgeData();
      toast.success("Rules reordered");
    } catch {
      // Mutation cache handles the error toast.
    }
  };

  const handleCoverImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image must be under 8MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const result = readerEvent.target?.result;
      if (typeof result !== "string" || !result) {
        toast.error("Failed to read cover image");
        return;
      }

      openCoverCropDialog(result);
    };
    reader.onerror = () => {
      toast.error("Failed to read cover image");
    };
    reader.readAsDataURL(file);
  };

  const handleEditCover = () => {
    const currentCoverSource =
      edgeDraft.coverImageUrl ?? currentEdge.coverImageUrl ?? null;
    if (!currentCoverSource) {
      coverImageRef.current?.click();
      return;
    }

    openCoverCropDialog(currentCoverSource);
  };

  const handleCropApply = (objectPosition: string) => {
    if (!pendingCoverSrc) {
      return;
    }

    setEdgeDraft((currentDraft) => ({
      ...currentDraft,
      coverImageUrl: pendingCoverSrc,
      coverImagePosition: parseCoverPosition(objectPosition),
    }));
    setPendingCoverSrc("");
    setCropDialogOpen(false);
  };

  const handleCropCancel = () => {
    setPendingCoverSrc("");
    setCropDialogOpen(false);
  };

  const handleSaveEdge = async () => {
    const trimmedName = edgeDraft.name.trim();
    if (!trimmedName) {
      toast.error("Edge name is required");
      return;
    }

    try {
      await updateEdge.mutateAsync({
        edgeId,
        name: trimmedName,
        description: edgeDraft.description.trim() || null,
        coverImageUrl: edgeDraft.coverImageUrl,
        coverImagePosition: edgeDraft.coverImagePosition,
        contentBlocks: edgeDraft.contentBlocks,
        contentHtml: edgeDraft.contentHtml || null,
        examplesBlocks: edgeDraft.examplesBlocks,
        examplesHtml: edgeDraft.examplesHtml || null,
        color: edgeDraft.color,
        publicStatsVisible: edgeDraft.publicStatsVisible,
        status:
          edgeDraft.status === "archived" ? "archived" : "active",
      });

      const currentPublicationState: EdgePublicationState = currentEdge.isFeatured
        ? "featured"
        : currentEdge.publicationMode === "library"
          ? "library"
          : "private";

      if (edgeDraft.publicationMode !== currentPublicationState) {
        await publishEdge.mutateAsync({
          edgeId,
          publicationMode:
            edgeDraft.publicationMode === "private" ? "private" : "library",
          featured: edgeDraft.publicationMode === "featured",
        });
      }

      await refreshEdgeData();
      setIsEditingDescription(false);
      toast.success("Edge updated");
    } catch {
      // Mutation cache handles the error toast.
    }
  };

  const handleSaveSection = async (sectionId: string) => {
    const draft = sectionDrafts[sectionId];
    if (!draft?.title.trim()) {
      toast.error("Section title is required");
      return;
    }

    try {
      await upsertSection.mutateAsync({
        edgeId,
        sectionId,
        title: draft.title.trim(),
        description: draft.description.trim() || null,
      });
      await refreshEdgeData();
      toast.success("Section updated");
    } catch {
      // Mutation cache handles the error toast.
    }
  };

  const handleCreateSection = async () => {
    if (!newSectionDraft.title.trim()) {
      toast.error("Section title is required");
      return;
    }

    try {
      await upsertSection.mutateAsync({
        edgeId,
        title: newSectionDraft.title.trim(),
        description: newSectionDraft.description.trim() || null,
        sortOrder: detail.sections.length,
      });
      setNewSectionDraft({ title: "", description: "" });
      await refreshEdgeData();
      toast.success("Section created");
    } catch {
      // Mutation cache handles the error toast.
    }
  };

  const handleCreateRule = async (sectionId: string, sortOrder: number) => {
    const draft = newRuleDrafts[sectionId] ?? createEmptyRuleDraft();
    if (!draft.title.trim()) {
      toast.error("Rule title is required");
      return;
    }

    try {
      await upsertRule.mutateAsync({
        edgeId,
        sectionId,
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        sortOrder,
        appliesOutcomes: normalizeOutcomeSelection(draft.appliesOutcomes) as Array<
          "winner" | "partial_win" | "loser" | "breakeven" | "cut_trade" | "all"
        >,
      });
      setNewRuleDrafts((previousDrafts) => ({
        ...previousDrafts,
        [sectionId]: createEmptyRuleDraft(),
      }));
      setActiveRuleComposerSectionId(null);
      await refreshEdgeData();
      toast.success("Rule added");
    } catch {
      // Mutation cache handles the error toast.
    }
  };

  const handleImportEdge = async () => {
    try {
      const importedEdge = await duplicateEdge.mutateAsync({ edgeId });
      await utils.edges.listMy.invalidate();
      await utils.edges.getDetail.invalidate({ edgeId: importedEdge.id });
      toast.success("Edge imported to My Edges");
      router.push(`/dashboard/edges/${importedEdge.id}`);
    } catch {
      // Mutation cache handles the error toast.
    }
  };

  return (
    <div
      ref={pageContainerRef}
      className="flex min-h-0 w-full flex-1 flex-col"
    >
      <div className="sticky top-0 z-20 bg-sidebar backdrop-blur supports-[backdrop-filter]:bg-sidebar/60">
        <div className="flex items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              size="sm"
              onClick={() => router.push("/dashboard/edges")}
              className={journalActionIconButtonClassName}
            >
              <ChevronLeft className="size-3" />
            </Button>
            <div className="flex min-w-0 items-center gap-1.5 text-xs text-white/40">
              <span>Edges</span>
              <span>/</span>
              <span className="truncate text-white">
                {edgeDraft.name.trim() || currentEdge.name}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {detail.canEdit && hasEdgeChanges ? (
              <span className="text-xs text-white/40">Unsaved changes</span>
            ) : null}
            {detail.canEdit ? (
              <>
                {!currentEdge.isDemoSeeded ? (
                  <Button
                    size="sm"
                    className={journalActionButtonMutedClassName}
                    onClick={() => setShareSheetOpen(true)}
                  >
                    <UsersRound className="size-3" />
                    Share
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  className={journalActionButtonMutedClassName}
                  disabled={
                    !hasEdgeChanges ||
                    updateEdge.isPending ||
                    publishEdge.isPending
                  }
                  onClick={handleSaveEdge}
                >
                  <Save className="size-3" />
                  {updateEdge.isPending || publishEdge.isPending
                    ? "Saving..."
                    : "Save changes"}
                </Button>
                <Button
                  size="sm"
                  className={journalActionButtonMutedClassName}
                  disabled={!hasEdgeChanges}
                  onClick={() =>
                    {
                      setEdgeDraft({
                        name: currentEdge.name,
                        description: currentEdge.description ?? "",
                        coverImageUrl: currentEdge.coverImageUrl ?? null,
                        coverImagePosition: currentEdge.coverImagePosition ?? 50,
                        contentBlocks: currentEdge.contentBlocks ?? [],
                        contentHtml: currentEdge.contentHtml ?? "",
                        examplesBlocks: currentEdge.examplesBlocks ?? [],
                        examplesHtml: currentEdge.examplesHtml ?? "",
                        color: currentEdge.color ?? "#3B82F6",
                        publicationMode: currentEdge.isFeatured
                          ? "featured"
                          : currentEdge.publicationMode === "library"
                            ? "library"
                            : "private",
                        publicStatsVisible: currentEdge.publicStatsVisible ?? true,
                        status: currentEdge.status,
                      });
                      setIsEditingDescription(false);
                    }
                  }
                >
                  <X className="size-3" />
                  Reset changes
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                className={journalActionButtonMutedClassName}
                disabled={duplicateEdge.isPending}
                onClick={handleImportEdge}
              >
                <Plus className="size-3" />
                {duplicateEdge.isPending
                  ? "Importing..."
                  : "Import to My Edges"}
              </Button>
            )}
          </div>
        </div>
      </div>

      <Separator />

      <div className="flex-1 overflow-y-auto">
        <input
          ref={coverImageRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleCoverImageChange}
        />
        <EdgeCoverBanner
          title={edgeDraft.name.trim() || currentEdge.name}
          color={visibleColor}
          coverImageUrl={visibleCoverImageUrl}
          coverImagePosition={visibleCoverImagePosition}
          containerRef={coverContainerRef}
          editable={canEditCover}
          onAddCover={() => coverImageRef.current?.click()}
          onEditCover={handleEditCover}
          onRemoveCover={() =>
            setEdgeDraft((currentDraft) => ({
              ...currentDraft,
              coverImageUrl: null,
              coverImagePosition: 50,
            }))
          }
          className="h-48 rounded-none border-x-0 border-t-0 md:h-64"
        />
        <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto mb-8 max-w-3xl">
            {detail.canEdit ? (
              <input
                type="text"
                value={edgeDraft.name}
                onChange={(event) =>
                  setEdgeDraft((currentDraft) => ({
                    ...currentDraft,
                    name: event.target.value,
                  }))
                }
                placeholder="New Edge"
                className="w-full border-none bg-transparent text-4xl font-bold text-white outline-none placeholder:text-white/20"
              />
            ) : (
              <h1 className="text-4xl font-bold text-white">{currentEdge.name}</h1>
            )}

            {detail.canEdit ? (
              isEditingDescription ? (
                <Textarea
                  value={edgeDraft.description}
                  onChange={(event) =>
                    setEdgeDraft((currentDraft) => ({
                      ...currentDraft,
                      description: event.target.value,
                    }))
                  }
                  onBlur={() => setIsEditingDescription(false)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setIsEditingDescription(false);
                      event.currentTarget.blur();
                    }
                  }}
                  rows={3}
                  autoFocus
                  placeholder="Describe the setup, execution criteria, and review focus for this Edge."
                  className="mt-3 min-h-0 resize-none border-none bg-transparent px-0 py-0 text-sm leading-6 text-white/52 shadow-none placeholder:text-white/28 focus-visible:ring-0"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingDescription(true)}
                  className="mt-3 block w-full text-left text-sm leading-6 text-white/52 transition-colors hover:text-white/72"
                >
                  {visibleDescription ? (
                    <span className="whitespace-pre-wrap">{visibleDescription}</span>
                  ) : (
                    <span className="text-white/32">
                      Add a description in Edge details to explain how this setup
                      should be traded and reviewed.
                    </span>
                  )}
                </button>
              )
            ) : visibleDescription ? (
              <p className="mt-3 text-sm leading-6 text-white/52">
                {visibleDescription}
              </p>
            ) : null}

            <div className="mt-6 border-b border-white/5 pb-4 text-xs text-white/40">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Target className="size-3.5" />
                  {canShowStats ? `${metrics!.tradeCount} executed trades` : "Public stats hidden"}
                </div>
                <div className="flex items-center gap-1.5">
                  <ListChecks className="size-3.5" />
                  {detail.sections.length} sections / {totalRuleCount} rules
                </div>
                {canShowStats ? (
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="size-3.5" />
                    {formatPercent(metrics!.winRate)} win rate
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {detail.canEdit ? (
                  <>
                    <label className="inline-flex h-7 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2.5 text-xs text-white/72">
                      <input
                        type="color"
                        value={edgeDraft.color}
                        onChange={(event) =>
                          setEdgeDraft((currentDraft) => ({
                            ...currentDraft,
                            color: event.target.value,
                          }))
                        }
                        className="size-4 cursor-pointer rounded-full border-0 bg-transparent p-0"
                        aria-label="Edge color"
                      />
                      <input
                        value={edgeDraft.color}
                        onChange={(event) =>
                          setEdgeDraft((currentDraft) => ({
                            ...currentDraft,
                            color: event.target.value,
                          }))
                        }
                        className="w-16 border-none bg-transparent p-0 text-xs text-white/72 outline-none placeholder:text-white/28"
                        placeholder="#3B82F6"
                        aria-label="Edge color hex"
                      />
                    </label>

                    {currentEdge.isDemoSeeded ? (
                      <Badge
                        variant="secondary"
                        className="border-white/10 bg-white/5 text-white/72"
                      >
                        <Lock className="mr-2 size-3.5" />
                        Demo Edge
                      </Badge>
                    ) : (
                      <Select
                        value={edgeDraft.publicationMode}
                        onValueChange={(value) =>
                          setEdgeDraft((currentDraft) => ({
                            ...currentDraft,
                            publicationMode: value as EdgePublicationState,
                          }))
                        }
                      >
                        <SelectTrigger className="h-7 w-auto rounded-full border-white/10 bg-white/5 px-2.5 text-xs text-white/72 shadow-none focus:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="private">
                            <span className="flex items-center gap-2">
                              <Lock className="size-3.5" />
                              Private
                            </span>
                          </SelectItem>
                          {publishCapabilities.canPublishLibrary ? (
                            <SelectItem value="library">
                              <span className="flex items-center gap-2">
                                <Globe2 className="size-3.5" />
                                Library Edge
                              </span>
                            </SelectItem>
                          ) : null}
                          {publishCapabilities.canFeature ? (
                            <SelectItem value="featured">
                              <span className="flex items-center gap-2">
                                <TrendingUp className="size-3.5" />
                                Featured Edge
                              </span>
                            </SelectItem>
                          ) : null}
                        </SelectContent>
                      </Select>
                    )}

                    {edgeDraft.publicationMode === "library" ? (
                      <Select
                        value={edgeDraft.publicStatsVisible ? "shown" : "hidden"}
                        onValueChange={(value) =>
                          setEdgeDraft((currentDraft) => ({
                            ...currentDraft,
                            publicStatsVisible: value === "shown",
                          }))
                        }
                      >
                        <SelectTrigger className="h-7 w-auto rounded-full border-white/10 bg-white/5 px-2.5 text-xs text-white/72 shadow-none focus:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="shown">
                            <span className="flex items-center gap-2">
                              <Eye className="size-3.5" />
                              Show stats
                            </span>
                          </SelectItem>
                          <SelectItem value="hidden">
                            <span className="flex items-center gap-2">
                              <EyeOff className="size-3.5" />
                              Hide stats
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ) : edgeDraft.publicationMode === "featured" ? (
                      <Badge
                        variant="secondary"
                        className="border-white/10 bg-white/5 text-white/72"
                      >
                        <Eye className="mr-2 size-3.5" />
                        Featured stats visible
                      </Badge>
                    ) : null}

                    <Select
                      value={edgeDraft.status}
                      onValueChange={(value) =>
                        setEdgeDraft((currentDraft) => ({
                          ...currentDraft,
                          status: value,
                        }))
                      }
                    >
                      <SelectTrigger className="h-7 w-auto rounded-full border-white/10 bg-white/5 px-2.5 text-xs text-white/72 shadow-none focus:ring-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="archived">
                          <span className="flex items-center gap-2">
                            <Archive className="size-3.5" />
                            Archived
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </>
                ) : (
                  <>
                    {visibleColor ? (
                      <Badge
                        variant="secondary"
                        className="border-white/10 bg-white/5 text-white/72"
                      >
                        <span
                          className="mr-2 inline-flex size-2 rounded-full"
                          style={{ backgroundColor: visibleColor }}
                        />
                        Color mapped
                      </Badge>
                    ) : null}
                    <Badge
                      variant="secondary"
                      className="border-white/10 bg-white/5 text-white/72"
                    >
                      {visiblePublicationMode === "featured"
                        ? "Featured Edge"
                        : visiblePublicationMode === "library"
                          ? "Library Edge"
                          : "Private"}
                    </Badge>
                    {visiblePublicationMode === "featured" ? (
                      <Badge
                        variant="secondary"
                        className="border-white/10 bg-white/5 text-white/72"
                      >
                        <Eye className="mr-2 size-3.5" />
                        Stats visible
                      </Badge>
                    ) : visiblePublicationMode === "library" ? (
                      <Badge
                        variant="secondary"
                        className="border-white/10 bg-white/5 text-white/72"
                      >
                        {visiblePublicStatsVisible ? (
                          <Eye className="mr-2 size-3.5" />
                        ) : (
                          <EyeOff className="mr-2 size-3.5" />
                        )}
                        {visiblePublicStatsVisible ? "Stats shown" : "Stats hidden"}
                      </Badge>
                    ) : null}
                    <Badge
                      variant="secondary"
                      className="border-white/10 bg-white/5 text-white/72"
                    >
                      {visibleStatus === "archived" ? "Archived" : "Active"}
                    </Badge>
                  </>
                )}
                {currentEdge.sourceEdgeId ? (
                  <Badge
                    variant="secondary"
                    className="border-white/10 bg-white/5 text-white/72"
                  >
                    Forked from shared source
                  </Badge>
                ) : null}
              </div>
            </div>

          </div>

          <Tabs
            value={resolvedActiveTab}
            onValueChange={(value) => {
              const nextHref =
                value === "content"
                  ? safePathname
                  : `${safePathname}?tab=${value}`;
              router.replace(nextHref, { scroll: false });
            }}
            className="w-full"
          >
            <div className="mx-auto max-w-3xl overflow-x-auto">
              <TabsList className="mb-6 h-auto rounded-none border-b border-white/10 bg-transparent p-0">
                {visibleTabs.map((item) => (
                  <TabsTrigger
                    key={item.id}
                    value={item.id}
                    className="rounded-none border-b-2 border-transparent px-4 py-2 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent"
                  >
                    <item.icon className="mr-2 size-3.5" />
                    {item.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

        <TabsContent value="content" className="mt-0">
          <div className="mx-auto w-full max-w-3xl space-y-6">
            <div className="border-b border-white/8 pb-4">
              <p className="text-xs font-medium text-white/72">Content</p>
              <p className="mt-1 text-xs text-white/45">
                Write the core thesis for this Edge: the market context, setup
                structure, execution framework, and what should stand out when
                you review it later.
              </p>
            </div>

            {detail.canEdit ? (
              <JournalEditor
                key={`${currentEdge.id}-content-${builderEditorSeed}`}
                compact
                initialContent={edgeDraft.contentBlocks}
                onChange={(content, html) =>
                  setEdgeDraft((currentDraft) => ({
                    ...currentDraft,
                    contentBlocks: content,
                    contentHtml: html,
                  }))
                }
                placeholder="Start writing the Edge thesis, context, and execution framework..."
              />
            ) : (
              <EdgeBuilderPreview
                html={currentEdge.contentHtml}
                emptyLabel="No Edge content has been published yet."
                transparent={isPublicTemplateView}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="overview" className="mt-0">
          <div className="w-full space-y-6">
          {canShowStats ? (
            <>
              <div className={getOverviewGridClass(overviewMetricCards.length)}>
                {overviewMetricCards.map((card) => (
                  <EdgeMetricCard
                    key={card.label}
                    icon={card.icon}
                    label={card.label}
                    value={card.value}
                    detail={card.detail}
                  />
                ))}
              </div>

              <div className="space-y-6">
                <EdgeEquityCurveCard className="w-full" points={metrics!.charts.equityCurve} />

                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-white/72">Edge profile</p>
                    <p className="text-sm text-white/40">
                      The current operating characteristics of this Edge.
                    </p>
                  </div>

                  <div className={getOverviewGridClass(edgeProfileCards.length)}>
                    {edgeProfileCards.map((card) => (
                      <EdgeMetricCard
                        key={card.label}
                        icon={card.icon}
                        label={card.label}
                        value={card.value}
                        detail={card.detail}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-3">
                <EdgeBreakdownBarCard
                  title="Outcome mix"
                  items={metrics!.charts.outcomeBreakdown}
                  emptyLabel="No outcome breakdown yet."
                />
                <EdgeBreakdownBarCard
                  title="Session mix"
                  items={metrics!.charts.sessionBreakdown}
                  emptyLabel="Session data will appear after assignments."
                />
                <EdgeRMultipleSpreadCard items={metrics!.charts.rDistribution} />
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-white/10 bg-black/20 px-5 py-6 text-xs text-white/48">
              This creator chose to hide public Library stats for this Edge.
              Featured Edges always show their public performance metrics.
            </div>
          )}

          {canShowPrivateActivity ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white/72">Linked entries</p>
                  <p className="text-sm text-white/40">
                    Edge-linked reflections, reviews, and notes.
                  </p>
                </div>
                <p className="text-xs text-white/34">
                  {detail.entries.length} total entries
                </p>
              </div>

              {detail.entries.length > 0 ? (
                <>
                  <div className="overflow-hidden border border-white/5 bg-sidebar/45">
                    <table className="min-w-full text-xs">
                      <thead className="border-b border-white/5 bg-sidebar-accent">
                        <tr>
                          <th className="px-6 py-4 text-left font-medium text-white/70">
                            Entry
                          </th>
                          <th className="px-6 py-4 text-left font-medium text-white/70">
                            Type
                          </th>
                          <th className="px-6 py-4 text-left font-medium text-white/70">
                            Journal date
                          </th>
                          <th className="px-6 py-4 text-left font-medium text-white/70">
                            Updated
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {overviewEntries.map((entry) => (
                          <tr
                            key={entry.id}
                            className="cursor-pointer border-b border-white/5 transition-colors hover:bg-white/[0.03] last:border-b-0"
                            onClick={() =>
                              router.push(`/dashboard/journal?entryId=${entry.id}`)
                            }
                          >
                            <td className="px-6 py-4">
                              <Link
                                href={`/dashboard/journal?entryId=${entry.id}`}
                                onClick={(event) => event.stopPropagation()}
                                className="font-medium text-white transition-colors hover:text-teal-300"
                              >
                                {entry.title}
                              </Link>
                            </td>
                            <td className="px-6 py-4 text-white/55">
                              {formatEntryTypeLabel(entry.entryType)}
                            </td>
                            <td className="px-6 py-4 text-white/55">
                              {formatDate(entry.journalDate)}
                            </td>
                            <td className="px-6 py-4 text-white/55">
                              {formatDate(entry.updatedAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-white/38">
                      Showing{" "}
                      {clampedOverviewEntriesPage * EDGE_OVERVIEW_ENTRIES_PAGE_SIZE + 1}
                      -
                      {Math.min(
                        (clampedOverviewEntriesPage + 1) *
                          EDGE_OVERVIEW_ENTRIES_PAGE_SIZE,
                        detail.entries.length
                      )}{" "}
                      of {detail.entries.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 border-white/10 bg-white/5 text-xs text-white/72 hover:bg-white/10"
                        disabled={clampedOverviewEntriesPage === 0}
                        onClick={() =>
                          setOverviewEntriesPage((currentPage) =>
                            Math.max(currentPage - 1, 0)
                          )
                        }
                      >
                        Previous
                      </Button>
                      <div className="text-xs text-white/48">
                        Page {clampedOverviewEntriesPage + 1} of{" "}
                        {overviewEntriesPageCount}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 border-white/10 bg-white/5 text-xs text-white/72 hover:bg-white/10"
                        disabled={
                          clampedOverviewEntriesPage >= overviewEntriesPageCount - 1
                        }
                        onClick={() =>
                          setOverviewEntriesPage((currentPage) =>
                            Math.min(
                              currentPage + 1,
                              Math.max(overviewEntriesPageCount - 1, 0)
                            )
                          )
                        }
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-md border border-dashed border-white/10 bg-sidebar px-5 py-6 text-sm text-white/45">
                  No linked entries yet.
                </div>
              )}
            </div>
          ) : null}
          </div>
        </TabsContent>

        <TabsContent value="rules" className="mt-0 space-y-6">
          <div className="mx-auto w-full max-w-4xl space-y-6">
            <div className="border-b border-white/8 pb-4">
              <p className="text-xs font-medium text-white/72">Rules</p>
              <p className="mt-1 text-xs text-white/45">
                Break the Edge into reviewable sections, define the exact rules
                that matter, and control which outcomes each rule should appear
                against when trades get reviewed.
              </p>
            </div>

            {detail.canEdit ? (
              <EdgePanel
                icon={Plus}
                title="Create section"
                description="Add another rule section for this Edge, like entry rules, exit rules, or anything specific to your workflow."
                bodyClassName="space-y-3"
              >
                <div className="grid gap-3 xl:grid-cols-[0.9fr_1.1fr_auto]">
                  <Input
                    value={newSectionDraft.title}
                    onChange={(event) =>
                      setNewSectionDraft((currentDraft) => ({
                        ...currentDraft,
                        title: event.target.value,
                      }))
                    }
                    placeholder="Section title"
                  />
                  <Input
                    value={newSectionDraft.description}
                    onChange={(event) =>
                      setNewSectionDraft((currentDraft) => ({
                        ...currentDraft,
                        description: event.target.value,
                      }))
                    }
                    placeholder="What should this section measure?"
                  />
                  <Button
                    className={EDGE_ACTION_BUTTON_CLASSNAME}
                    disabled={upsertSection.isPending}
                    onClick={handleCreateSection}
                  >
                    <Plus className="size-3" />
                    Add section
                  </Button>
                </div>
              </EdgePanel>
            ) : null}

            {detail.sections.length > 0 ? (
              detail.sections.map((section) => (
                <EdgePanel
                  key={section.id}
                  icon={ListChecks}
                  title={section.title}
                  description={
                    section.description ||
                    "Rules inside this section are measured against reviewed trades."
                  }
                  bodyClassName="space-y-4"
                  action={
                    detail.canEdit ? (
                      <Button
                        className={EDGE_ACTION_BUTTON_CLASSNAME}
                        onClick={() =>
                          setActiveRuleComposerSectionId((currentSectionId) =>
                            currentSectionId === section.id ? null : section.id
                          )
                        }
                      >
                        <Plus className="size-3" />
                        Add rule
                      </Button>
                    ) : null
                  }
                >
                  {detail.canEdit ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <Input
                        className="min-w-[15rem] flex-1"
                        value={sectionDrafts[section.id]?.title ?? ""}
                        onChange={(event) =>
                          setSectionDrafts((currentDrafts) => ({
                            ...currentDrafts,
                            [section.id]: {
                              title: event.target.value,
                              description:
                                currentDrafts[section.id]?.description ?? "",
                            },
                          }))
                        }
                        placeholder="Section title"
                      />
                      <Input
                        className="min-w-[18rem] flex-[1.2]"
                        value={sectionDrafts[section.id]?.description ?? ""}
                        onChange={(event) =>
                          setSectionDrafts((currentDrafts) => ({
                            ...currentDrafts,
                            [section.id]: {
                              title: currentDrafts[section.id]?.title ?? "",
                              description: event.target.value,
                            },
                          }))
                        }
                        placeholder="Section description"
                      />
                      <Button
                        className={EDGE_ACTION_BUTTON_CLASSNAME}
                        disabled={
                          upsertSection.isPending ||
                          (sectionDrafts[section.id]?.title ?? "").trim() ===
                            section.title &&
                            (sectionDrafts[section.id]?.description ?? "").trim() ===
                              (section.description ?? "")
                        }
                        onClick={() => handleSaveSection(section.id)}
                      >
                        <Save className="size-3" />
                        Save section
                      </Button>
                    </div>
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-4">
                    {[
                      {
                        label: "Follow-through",
                        value: formatPercent(section.metrics.followThroughRate),
                      },
                      {
                        label: "Reviewed",
                        value: `${section.metrics.reviewedCount}/${section.metrics.sampleSize}`,
                      },
                      {
                        label: "Review coverage",
                        value: formatPercent(section.metrics.reviewCoverage),
                      },
                      {
                        label: "Net P&L",
                        value: formatMoney(section.metrics.netPnl),
                      },
                    ].map((item) => (
                      <div
                        key={`${section.id}-${item.label}`}
                        className="rounded-lg border border-white/8 bg-black/20 px-4 py-3"
                      >
                        <p className="text-xs text-white/34">
                          {item.label}
                        </p>
                        <p className="mt-1 text-xs font-medium text-white">
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4">
                    {section.rules.length > 0 ? (
                      section.rules.map((rule) => (
                        <div
                          key={rule.id}
                          draggable={detail.canEdit && section.rules.length > 1}
                          onDragStart={() => {
                            if (!detail.canEdit || section.rules.length <= 1) {
                              return;
                            }
                            setDraggedRule({
                              sectionId: section.id,
                              ruleId: rule.id,
                            });
                            setDragOverRuleId(rule.id);
                          }}
                          onDragOver={(event) => {
                            if (
                              !detail.canEdit ||
                              !draggedRule ||
                              draggedRule.sectionId !== section.id ||
                              draggedRule.ruleId === rule.id
                            ) {
                              return;
                            }

                            event.preventDefault();
                            setDragOverRuleId(rule.id);
                          }}
                          onDrop={async (event) => {
                            event.preventDefault();
                            if (
                              !detail.canEdit ||
                              !draggedRule ||
                              draggedRule.sectionId !== section.id
                            ) {
                              return;
                            }

                            await handleReorderRules(
                              section.id,
                              draggedRule.ruleId,
                              rule.id
                            );
                          }}
                          onDragEnd={() => {
                            setDraggedRule(null);
                            setDragOverRuleId(null);
                          }}
                          className={cn(
                            "w-full rounded-lg border border-white/8 bg-black/20 p-4 transition-colors",
                            detail.canEdit &&
                              section.rules.length > 1 &&
                              "cursor-grab active:cursor-grabbing",
                            draggedRule?.ruleId === rule.id && "opacity-55",
                            dragOverRuleId === rule.id &&
                              draggedRule?.ruleId !== rule.id &&
                              "border-teal-400/35 bg-teal-400/[0.04]"
                          )}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex min-w-0 items-start gap-3">
                              {detail.canEdit && section.rules.length > 1 ? (
                                <div className="mt-0.5 text-white/28">
                                  <GripVertical className="size-4" />
                                </div>
                              ) : null}
                              <div className="min-w-0 space-y-1">
                                <p className="text-xs font-medium text-white">
                                  {rule.title}
                                </p>
                                <p className="text-xs leading-5 text-white/50">
                                  {rule.description || "No rule note yet."}
                                </p>
                              </div>
                            </div>
                            <Badge
                              variant="secondary"
                              className="border-white/10 bg-white/5 text-white/70"
                            >
                              {rule.metrics.reviewedCount} reviewed
                            </Badge>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            {(rule.appliesOutcomes ?? []).map((outcome) => (
                              <Badge
                                key={`${rule.id}-${outcome}`}
                                variant="outline"
                                className="border-white/10 bg-black/20 text-white/62"
                              >
                                {formatRuleOutcomeLabel(outcome)}
                              </Badge>
                            ))}
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            {[
                              {
                                label: "Follow-through",
                                value: formatPercent(rule.metrics.followThroughRate),
                              },
                              {
                                label: "Expectancy",
                                value: formatMoney(rule.metrics.expectancy),
                              },
                              {
                                label: "Win rate when followed",
                                value: formatPercent(rule.metrics.winRateWhenFollowed),
                              },
                              {
                                label: "Win rate when broken",
                                value: formatPercent(rule.metrics.winRateWhenBroken),
                              },
                            ].map((item) => (
                              <div key={`${rule.id}-${item.label}`}>
                                <p className="text-xs text-white/34">
                                  {item.label}
                                </p>
                                <p className="mt-1 text-xs font-medium text-white">
                                  {item.value}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-lg border border-dashed border-white/10 bg-black/20 px-4 py-5 text-xs text-white/48">
                        No rules in this section yet.
                      </div>
                    )}
                  </div>

                  {detail.canEdit && activeRuleComposerSectionId === section.id ? (
                    <div className="space-y-3 rounded-lg border border-white/8 bg-black/20 p-4">
                      <div className="grid gap-3 xl:grid-cols-2">
                        <Input
                          value={newRuleDrafts[section.id]?.title ?? ""}
                          onChange={(event) =>
                            setNewRuleDrafts((currentDrafts) => ({
                              ...currentDrafts,
                              [section.id]: {
                                ...(currentDrafts[section.id] ?? createEmptyRuleDraft()),
                                title: event.target.value,
                              },
                            }))
                          }
                          placeholder="Rule title"
                        />
                        <Input
                          value={newRuleDrafts[section.id]?.description ?? ""}
                          onChange={(event) =>
                            setNewRuleDrafts((currentDrafts) => ({
                              ...currentDrafts,
                              [section.id]: {
                                ...(currentDrafts[section.id] ?? createEmptyRuleDraft()),
                                description: event.target.value,
                              },
                            }))
                          }
                          placeholder="How should this rule be reviewed?"
                        />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {RULE_OUTCOME_OPTIONS.map((option) => {
                          const selectedOutcomes = normalizeOutcomeSelection(
                            newRuleDrafts[section.id]?.appliesOutcomes ?? ["all"]
                          );
                          const isSelected = selectedOutcomes.includes(option.value);

                          return (
                            <button
                              key={`${section.id}-${option.value}`}
                              type="button"
                              onClick={() =>
                                setNewRuleDrafts((currentDrafts) => {
                                  const currentDraft =
                                    currentDrafts[section.id] ?? createEmptyRuleDraft();
                                  const currentOutcomes = normalizeOutcomeSelection(
                                    currentDraft.appliesOutcomes
                                  );
                                  const nextOutcomes =
                                    option.value === "all"
                                      ? ["all"]
                                      : currentOutcomes.includes(option.value)
                                      ? currentOutcomes.filter(
                                          (outcome) => outcome !== option.value
                                        )
                                      : currentOutcomes
                                          .filter((outcome) => outcome !== "all")
                                          .concat(option.value);

                                  return {
                                    ...currentDrafts,
                                    [section.id]: {
                                      ...currentDraft,
                                      appliesOutcomes:
                                        normalizeOutcomeSelection(nextOutcomes),
                                    },
                                  };
                                })
                              }
                              className={cn(
                                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                                isSelected
                                  ? "border-teal-400/30 bg-teal-400/12 text-teal-200"
                                  : "border-white/10 bg-white/5 text-white/52 hover:bg-white/10"
                              )}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <Button
                          className={EDGE_ACTION_BUTTON_CLASSNAME}
                          disabled={upsertRule.isPending}
                          onClick={() => handleCreateRule(section.id, section.rules.length)}
                        >
                          <Save className="size-3" />
                          Save rule
                        </Button>
                        <Button
                          className={EDGE_ACTION_BUTTON_CLASSNAME}
                          onClick={() => {
                            setActiveRuleComposerSectionId(null);
                            setNewRuleDrafts((currentDrafts) => ({
                              ...currentDrafts,
                              [section.id]: createEmptyRuleDraft(),
                            }));
                          }}
                        >
                          <X className="size-3" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </EdgePanel>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-white/10 bg-black/20 px-5 py-6 text-xs text-white/48">
                No rule sections yet.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="examples" className="mt-0">
          <div className="mx-auto w-full max-w-3xl space-y-6">
            <div className="border-b border-white/8 pb-4">
              <p className="text-xs font-medium text-white/72">Examples</p>
              <p className="mt-1 text-xs text-white/45">
                Keep reference charts, annotated screenshots, and concrete
                examples of what this Edge should and should not look like in
                the wild.
              </p>
            </div>

            {detail.canEdit ? (
              <JournalEditor
                key={`${currentEdge.id}-examples-${builderEditorSeed}`}
                compact
                initialContent={edgeDraft.examplesBlocks}
                onChange={(content, html) =>
                  setEdgeDraft((currentDraft) => ({
                    ...currentDraft,
                    examplesBlocks: content,
                    examplesHtml: html,
                  }))
                }
                placeholder="Add annotated examples, screenshots, and scenario breakdowns..."
              />
            ) : (
              <EdgeBuilderPreview
                html={currentEdge.examplesHtml}
                emptyLabel="No Edge examples have been published yet."
                transparent={isPublicTemplateView}
              />
            )}
          </div>
        </TabsContent>

        {canShowPrivateActivity ? (
          <TabsContent value="executed-trades" className="mt-0">
            <EdgeExecutedTradesTable edgeId={edgeId} />
          </TabsContent>
        ) : null}

        {canShowPrivateActivity ? (
          <TabsContent value="missed-trades" className="mt-0">
            <EdgePanel
              icon={Clock3}
              title="Missed trades"
              description="Manual opportunity log for setups that matched the Edge but were not executed."
              bodyClassName="space-y-3"
            >
              {detail.missedTrades.length > 0 ? (
                detail.missedTrades.map((tradeRow) => (
                  <div
                    key={tradeRow.id}
                    className="rounded-lg border border-white/8 bg-black/20 p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-white">
                            {tradeRow.symbol || "Unspecified market"}
                          </p>
                          <Badge
                            variant="secondary"
                            className="border-white/10 bg-white/5 text-white/70"
                          >
                            {tradeRow.tradeType || "Missed"}
                          </Badge>
                          {tradeRow.estimatedOutcome ? (
                            <Badge
                              variant="outline"
                              className="border-white/10 bg-black/20 text-white/62"
                            >
                              {formatTradeOutcome(tradeRow.estimatedOutcome)}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-white/50">
                          {formatDate(tradeRow.setupTime)} ·{" "}
                          {tradeRow.sessionTag || "Unassigned session"}
                        </p>
                        <p className="text-xs leading-5 text-white/50">
                          {tradeRow.reasonMissed || tradeRow.notes || "No note yet."}
                        </p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border border-white/8 bg-white/5 px-4 py-3">
                          <p className="text-xs text-white/34">
                            Estimated P&L
                          </p>
                          <p className="mt-1 text-xs font-medium text-white">
                            {formatMoney(tradeRow.estimatedPnl)}
                          </p>
                        </div>
                        <div className="rounded-lg border border-white/8 bg-white/5 px-4 py-3">
                          <p className="text-xs text-white/34">
                            Estimated R
                          </p>
                          <p className="mt-1 text-xs font-medium text-white">
                            {formatR(tradeRow.estimatedRR)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-white/10 bg-black/20 px-4 py-5 text-xs text-white/48">
                  No missed trades logged for this Edge yet.
                </div>
              )}
            </EdgePanel>
          </TabsContent>
        ) : null}

        {canShowPrivateActivity ? (
          <TabsContent value="entries" className="mt-0">
            <EdgePanel
              icon={BookOpenText}
              title="Entries"
              description="Edge-specific journal entries linked back into your broader journal workspace."
              bodyClassName="space-y-3"
            >
              {detail.entries.length > 0 ? (
                detail.entries.map((entry) => (
                  <Link
                    key={entry.id}
                    href={`/dashboard/journal?entryId=${entry.id}`}
                    className="block rounded-lg border border-white/8 bg-black/20 px-4 py-4 transition-colors hover:border-teal-400/30 hover:bg-black/25"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <p className="font-medium text-white">{entry.title}</p>
                        <p className="text-xs text-white/48">
                          {formatDate(entry.journalDate ?? entry.updatedAt)}
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className="border-white/10 bg-white/5 text-white/70"
                      >
                        {entry.entryType.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-white/10 bg-black/20 px-4 py-5 text-xs text-white/48">
                  No entries linked to this Edge yet.
                </div>
              )}
            </EdgePanel>
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
      </div>
      <CoverImageCropDialog
        open={cropDialogOpen}
        imageSrc={pendingCoverSrc}
        frameDimensions={coverFrameDimensions}
        onApply={handleCropApply}
        onCancel={handleCropCancel}
      />
      <EdgeShareSheet
        open={shareSheetOpen}
        onOpenChange={setShareSheetOpen}
        edgeId={edgeId}
        edgeName={edgeDraft.name.trim() || currentEdge.name}
        sharedMembers={detail.sharedMembers ?? []}
        onSharedStateChange={refreshEdgeData}
      />
    </div>
  );
}
