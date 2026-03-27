"use client";

import Link from "next/link";
import {
  use,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  useState,
  type ComponentProps,
} from "react";
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
  History,
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
  EdgePanel,
} from "@/components/edges/edge-page-primitives";
import { EdgeCoverBanner } from "@/components/edges/edge-cover-banner";
import { EdgeExecutedTradesTable } from "@/components/edges/edge-executed-trades-table";
import {
  EdgeForkSheet,
  type EdgeForkSheetSubmit,
} from "@/components/edges/edge-fork-sheet";
import { EdgeMissedTradesSection } from "@/components/edges/edge-missed-trades-section";
import { EdgePassportSection } from "@/components/edges/edge-passport-section";
import { EdgeShareSheet } from "@/components/edges/edge-share-sheet";
import {
  EdgeVersionHistoryPanel,
  type EdgeVersionHistoryData,
} from "@/components/edges/edge-version-history-panel";
import type { EdgeAccountFitData } from "@/components/edges/edge-account-fit-section";
import type { EdgeLineageData } from "@/components/edges/edge-lineage-graph";
import type { EdgeReadinessData } from "@/components/edges/edge-readiness-section";
import {
  CoverImageCropDialog,
  type CoverFrameDimensions,
} from "@/components/cover-image-crop-dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EdgeDetailOverviewSection } from "@/app/(dashboard)/dashboard/edges/my/[edgeId]/_components/edge-detail-overview-section";
import {
  EDGE_OVERVIEW_ENTRIES_PAGE_SIZE,
  EDGE_TABS,
  formatDate,
  formatMoney,
  formatPercent,
  formatPublicationModeLabel,
  formatR,
  formatRuleOutcomeLabel,
  RULE_OUTCOME_OPTIONS,
  isEdgeTab,
  type EdgeDetailResponse,
  type EdgePublicationState,
  type EdgeTab,
  type RuleDraft,
  createEmptyRuleDraft,
  normalizeOutcomeSelection,
  parseCoverPosition,
} from "@/app/(dashboard)/dashboard/edges/my/[edgeId]/_lib/edge-detail-page";
import { cn } from "@/lib/utils";
import { trpc, trpcOptions } from "@/utils/trpc";

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

type EdgePassportData = ComponentProps<typeof EdgePassportSection>["passport"];
type SharedMember = ComponentProps<typeof EdgeShareSheet>["sharedMembers"][number];

const READINESS_TONES = [
  "positive",
  "warning",
  "critical",
  "neutral",
] as const;
const PASSPORT_TONES = ["teal", "blue", "amber", "rose", "slate"] as const;

function isJournalBlock(value: unknown): value is JournalBlock {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<JournalBlock>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.type === "string" &&
    typeof candidate.content === "string"
  );
}

function normalizeJournalBlocks(value: unknown): JournalBlock[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isJournalBlock)
    .map((block) => ({
      ...block,
      children: block.children ? normalizeJournalBlocks(block.children) : undefined,
    }));
}

function normalizeReadiness(
  readiness: EdgeDetailResponse["edge"]["readiness"] | null | undefined
): EdgeReadinessData | null {
  if (!readiness) {
    return null;
  }

  return {
    ...readiness,
    badges: readiness.badges.map((badge) => ({
      ...badge,
      tone: READINESS_TONES.includes(
        badge.tone as (typeof READINESS_TONES)[number]
      )
        ? (badge.tone as EdgeReadinessData["badges"][number]["tone"])
        : "neutral",
    })),
  };
}

function normalizePassportTone(
  tone: unknown
): EdgePassportData["cards"]["sample"]["tone"] {
  return PASSPORT_TONES.includes(tone as (typeof PASSPORT_TONES)[number])
    ? (tone as EdgePassportData["cards"]["sample"]["tone"])
    : "slate";
}

function normalizePassport(
  passport: EdgeDetailResponse["edge"]["passport"] | null | undefined
): EdgePassportData | null {
  if (!passport) {
    return null;
  }

  return {
    ...passport,
    cards: {
      sample: {
        ...passport.cards.sample,
        tone: normalizePassportTone(passport.cards.sample.tone),
      },
      proof: {
        ...passport.cards.proof,
        tone: normalizePassportTone(passport.cards.proof.tone),
      },
      process: {
        ...passport.cards.process,
        tone: normalizePassportTone(passport.cards.process.tone),
      },
      prop: {
        ...passport.cards.prop,
        tone: normalizePassportTone(passport.cards.prop.tone),
      },
    },
  };
}

function normalizeSharedMembers(
  members: EdgeDetailResponse["sharedMembers"] | null | undefined
): SharedMember[] {
  if (!Array.isArray(members)) {
    return [];
  }

  return members.map((member) => ({
    ...member,
    role: member.role === "editor" ? "editor" : "viewer",
  }));
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
  const [forkSheetOpen, setForkSheetOpen] = useState(false);
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
  const [activeRuleComposerSectionId, setActiveRuleComposerSectionId] =
    useState<string | null>(null);
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
      contentBlocks: normalizeJournalBlocks(detailEdge.contentBlocks),
      contentHtml: detailEdge.contentHtml ?? "",
      examplesBlocks: normalizeJournalBlocks(detailEdge.examplesBlocks),
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
        nextDrafts[section.id] =
          nextDrafts[section.id] ?? createEmptyRuleDraft();
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
          edgeDraft.coverImagePosition !==
            (detailEdge.coverImagePosition ?? 50) ||
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

  const resolvedReadiness = useMemo<EdgeReadinessData | null>(() => {
    if (!detailEdge) {
      return null;
    }

    if (detailEdge.readiness) {
      return normalizeReadiness(detailEdge.readiness);
    }

    const fallbackMetrics = detailEdge.metrics;
    const fallbackPassport = detailEdge.passport;

    if (!fallbackMetrics && !fallbackPassport) {
      return null;
    }

    const tradeCount = fallbackMetrics?.tradeCount ?? 0;
    const expectancy = fallbackMetrics?.expectancy ?? 0;
    const winRate = fallbackMetrics?.winRate ?? 0;
    const followThrough = fallbackMetrics?.followThroughRate ?? 0;
    const reviewCoverage = fallbackMetrics?.reviewCoverage ?? 0;
    const proofTone = fallbackPassport?.cards.proof.tone;

    let score = 8;
    score += Math.min(tradeCount, 40) * 0.85;
    score += expectancy > 0 ? 18 : tradeCount > 0 ? 6 : 0;
    score += Math.min(Math.max(winRate, 0), 1) * 16;
    score += Math.min(Math.max(followThrough, 0), 1) * 12;
    score += Math.min(Math.max(reviewCoverage, 0), 1) * 12;
    score +=
      proofTone === "teal" || proofTone === "blue"
        ? 8
        : proofTone === "amber"
        ? 4
        : 0;

    const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));
    const blockers: string[] = [];
    if (tradeCount < 12) {
      blockers.push("Sample size is still thin for reliable deployment.");
    }
    if (fallbackMetrics && expectancy <= 0) {
      blockers.push("Expectancy is not positive yet.");
    }
    if (fallbackMetrics && reviewCoverage < 0.55) {
      blockers.push("Review coverage is too low to trust the rule stack.");
    }
    if (fallbackMetrics && followThrough < 0.6) {
      blockers.push("Execution discipline is not yet stable across reviews.");
    }

    const nextActions: string[] = [];
    if (tradeCount < 20) {
      nextActions.push(
        "Tag 20+ clean samples before treating this as a primary Edge."
      );
    }
    if (fallbackMetrics && reviewCoverage < 0.8) {
      nextActions.push(
        "Review more completed trades so the edge profile reflects actual behavior."
      );
    }
    if (fallbackMetrics && followThrough < 0.75) {
      nextActions.push(
        "Tighten guardrails around rule adherence before sizing up."
      );
    }

    return normalizeReadiness({
      score: normalizedScore,
      label:
        normalizedScore >= 75
          ? "Deployment ready"
          : normalizedScore >= 50
          ? "Building conviction"
          : "Needs more proof",
      summary:
        normalizedScore >= 75
          ? "This Edge has enough structure and proof to deploy with confidence, while still benefiting from version tracking."
          : normalizedScore >= 50
          ? "The pattern is promising, but it still needs cleaner execution and a deeper sample before it becomes a core allocation."
          : "This Edge is still in proof-building mode. Keep iterating privately until the sample and process signals stabilize.",
      badges: [
        {
          label: "Sample",
          value: `${tradeCount} trades`,
          tone:
            tradeCount >= 40
              ? "positive"
              : tradeCount >= 15
              ? "warning"
              : "critical",
        },
        {
          label: "Expectancy",
          value: formatR(fallbackMetrics?.expectancy),
          tone:
            fallbackMetrics?.expectancy != null &&
            fallbackMetrics.expectancy > 0
              ? "positive"
              : fallbackMetrics?.expectancy != null
              ? "critical"
              : "neutral",
        },
        {
          label: "Review coverage",
          value: formatPercent(fallbackMetrics?.reviewCoverage),
          tone:
            reviewCoverage >= 0.75
              ? "positive"
              : reviewCoverage >= 0.5
              ? "warning"
              : "critical",
        },
        {
          label: "Discipline",
          value: formatPercent(fallbackMetrics?.followThroughRate),
          tone:
            followThrough >= 0.75
              ? "positive"
              : followThrough >= 0.5
              ? "warning"
              : "critical",
        },
      ],
      blockers,
      nextActions,
    });
  }, [detailEdge]);

  const resolvedAccountFit = useMemo<EdgeAccountFitData | null>(() => {
    if (!detailEdge) {
      return null;
    }

    if (detailEdge.accountFit) {
      return detailEdge.accountFit;
    }

    const propCard = detailEdge.passport?.cards.prop;
    const fitNotes = detailEdge.passport?.fitNotes ?? [];

    if (!propCard && fitNotes.length === 0) {
      return null;
    }

    const toneScore =
      propCard?.tone === "teal"
        ? 86
        : propCard?.tone === "blue"
        ? 74
        : propCard?.tone === "amber"
        ? 57
        : propCard?.tone === "rose"
        ? 33
        : null;

    return {
      summary:
        "Current account-fit recommendations are inferred from this Edge passport until account-level matching data is available.",
      recommendations: [
        {
          accountId: `${detailEdge.id}-fit-profile`,
          accountName: propCard?.value || "Best-fit account profile",
          label:
            toneScore != null ? `${toneScore}% profile match` : "Profile match",
          score: toneScore,
          isProp:
            /prop/i.test(propCard?.value ?? "") ||
            fitNotes.some(
              (item) => /prop/i.test(item.label) || /prop/i.test(item.value)
            ),
          reasons: [
            ...(propCard?.detail ? [propCard.detail] : []),
            ...fitNotes.map((item) => `${item.label}: ${item.value}`),
          ],
        },
      ],
      cautions:
        detailEdge.status === "archived"
          ? [
              "This Edge is archived. Re-validate the setup before routing fresh capital into it.",
            ]
          : undefined,
    };
  }, [detailEdge]);

  const resolvedLineageGraph = useMemo<EdgeLineageData | null>(() => {
    if (!detailEdge) {
      return null;
    }

    if (detailEdge.lineageGraph) {
      return detailEdge.lineageGraph;
    }

    const rootSource =
      detailEdge.passport?.lineage.source ?? detailEdge.sourceEdge;
    const forkCount =
      detailEdge.passport?.lineage.forkCount ??
      detailEdge.metrics?.copyCount ??
      0;
    const shareCount =
      detailEdge.passport?.lineage.shareCount ??
      detailEdge.metrics?.shareCount ??
      0;

    if (!rootSource && forkCount === 0 && shareCount === 0) {
      return null;
    }

    return {
      current: {
        id: detailEdge.id,
        name: detailEdge.name,
        publicationLabel: formatPublicationModeLabel(
          detailEdge.isFeatured
            ? "featured"
            : detailEdge.publicationMode === "library"
            ? "library"
            : "private"
        ),
      },
      root: rootSource
        ? {
            id: rootSource.id,
            name: rootSource.name,
            ownerName: rootSource.ownerName,
            publicationLabel:
              detailEdge.passport?.lineage.publicationLabel ?? null,
          }
        : null,
      forkCount,
      shareCount,
    };
  }, [detailEdge]);

  const resolvedVersionHistory = useMemo<EdgeVersionHistoryData | null>(() => {
    if (!detailEdge) {
      return null;
    }

    if (detailEdge.versionHistory) {
      return detailEdge.versionHistory;
    }

    const publicationMode: EdgePublicationState = detailEdge.isFeatured
      ? "featured"
      : detailEdge.publicationMode === "library"
      ? "library"
      : "private";

    return {
      versions: [
        {
          id: `${detailEdge.id}-current`,
          label: "Current live version",
          createdAt: detailEdge.updatedAt ?? detailEdge.createdAt ?? null,
          authorName: detail.canEdit
            ? "You"
            : detailEdge.sourceEdge?.ownerName ?? null,
          summary:
            "This is the active Edge snapshot. Dedicated version records will appear here once backend history is available.",
          isCurrent: true,
          isPublished: publicationMode !== "private",
          changes: [
            {
              label: "Visibility",
              value: formatPublicationModeLabel(publicationMode),
            },
            {
              label: "Rules",
              value: `${
                detail.sections.length
              } sections / ${detail.sections.reduce(
                (count, section) => count + section.rules.length,
                0
              )} rules`,
            },
            ...(detailEdge.metrics
              ? [
                  {
                    label: "Sample",
                    value: `${detailEdge.metrics.tradeCount} trades`,
                  },
                ]
              : []),
          ],
        },
      ],
    };
  }, [detail, detailEdge]);

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
  const passport = normalizePassport(currentEdge.passport);
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
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "content", label: "Content", icon: Edit3 },
    { id: "examples", label: "Examples", icon: ImageIcon },
    { id: "rules", label: "Rules", icon: ListChecks },
    ...(canShowPrivateActivity
      ? ([
          { id: "executed-trades", label: "Executed Trades", icon: Table2 },
          { id: "missed-trades", label: "Missed Trades", icon: Clock3 },
        ] as const)
      : []),
    ...(canShowStats && passport
      ? ([{ id: "passport", label: "Passport", icon: Layers3 }] as const)
      : []),
    { id: "versions", label: "Versions", icon: History },
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
            metrics!.profitFactor != null
              ? metrics!.profitFactor.toFixed(2)
              : "—",
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
          label: "Forks / shares",
          value: `${metrics!.copyCount} / ${metrics!.shareCount}`,
          detail: "Forked / shared",
        },
      ]
    : [];
  const defaultForkName = `${currentEdge.name} Copy`;
  const canPublishForkToLibrary = !currentEdge.isDemoSeeded;
  const forkSheetHelperText = canPublishForkToLibrary
    ? "Start private or publish your fork straight to the Library. You can change visibility later from your own Edge."
    : "Demo Edges can only be forked privately.";
  const isForkPending =
    duplicateEdge.isPending || publishEdge.isPending || updateEdge.isPending;

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
          appliesOutcomes: (rule.appliesOutcomes as Array<
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

  const handleCoverImageChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
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
        status: edgeDraft.status === "archived" ? "archived" : "active",
      });

      const currentPublicationState: EdgePublicationState =
        currentEdge.isFeatured
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
        appliesOutcomes: normalizeOutcomeSelection(
          draft.appliesOutcomes
        ) as Array<
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

  const handleForkEdge = async ({
    name,
    publicationMode,
    publicStatsVisible,
  }: EdgeForkSheetSubmit) => {
    try {
      const forkedEdge = await (duplicateEdge as any).mutateAsync({
        edgeId,
        name,
        publicationMode,
        publicStatsVisible,
      });

      if (publicationMode === "library") {
        await updateEdge.mutateAsync({
          edgeId: forkedEdge.id,
          publicStatsVisible,
        });
        await publishEdge.mutateAsync({
          edgeId: forkedEdge.id,
          publicationMode: "library",
          featured: false,
        });
      }

      await utils.edges.listMy.invalidate();
      await utils.edges.getDetail.invalidate({ edgeId: forkedEdge.id });
      setForkSheetOpen(false);
      toast.success(
        publicationMode === "library"
          ? "Fork published to Library"
          : "Edge forked to My Edges"
      );
      router.push(`/dashboard/edges/${forkedEdge.id}`);
    } catch {
      // Mutation cache handles the error toast.
    }
  };

  return (
    <div ref={pageContainerRef} className="flex min-h-0 w-full flex-1 flex-col">
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
                  onClick={() => {
                    setEdgeDraft({
                      name: currentEdge.name,
                      description: currentEdge.description ?? "",
                      coverImageUrl: currentEdge.coverImageUrl ?? null,
                      coverImagePosition: currentEdge.coverImagePosition ?? 50,
                      contentBlocks: normalizeJournalBlocks(
                        currentEdge.contentBlocks
                      ),
                      contentHtml: currentEdge.contentHtml ?? "",
                      examplesBlocks: normalizeJournalBlocks(
                        currentEdge.examplesBlocks
                      ),
                      examplesHtml: currentEdge.examplesHtml ?? "",
                      color: currentEdge.color ?? "#3B82F6",
                      publicationMode: currentEdge.isFeatured
                        ? "featured"
                        : currentEdge.publicationMode === "library"
                        ? "library"
                        : "private",
                      publicStatsVisible:
                        currentEdge.publicStatsVisible ?? true,
                      status: currentEdge.status,
                    });
                    setIsEditingDescription(false);
                  }}
                >
                  <X className="size-3" />
                  Reset changes
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                className={journalActionButtonMutedClassName}
                disabled={isForkPending}
                onClick={() => setForkSheetOpen(true)}
              >
                <Plus className="size-3" />
                {isForkPending ? "Forking..." : "Fork Edge"}
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
        <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8 w-full">
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
              <h1 className="text-4xl font-bold text-white">
                {currentEdge.name}
              </h1>
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
                    <span className="whitespace-pre-wrap">
                      {visibleDescription}
                    </span>
                  ) : (
                    <span className="text-white/32">
                      Add a description in Edge details to explain how this
                      setup should be traded and reviewed.
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
                  {canShowStats
                    ? `${metrics!.tradeCount} executed trades`
                    : "Public stats hidden"}
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
                        value={
                          edgeDraft.publicStatsVisible ? "shown" : "hidden"
                        }
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
                        <Eye className="size-3" />
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
                          className="mr-1 inline-flex size-2 rounded-full"
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
                        <Eye className="size-3" />
                        Stats visible
                      </Badge>
                    ) : visiblePublicationMode === "library" ? (
                      <Badge
                        variant="secondary"
                        className="border-white/10 bg-white/5 text-white/72"
                      >
                        {visiblePublicStatsVisible ? (
                          <Eye className="size-3.5" />
                        ) : (
                          <EyeOff className="size-3.5" />
                        )}
                        {visiblePublicStatsVisible
                          ? "Stats shown"
                          : "Stats hidden"}
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
                {currentEdge.sourceEdge ? (
                  <Link
                    href={`/dashboard/edges/${currentEdge.sourceEdge.id}`}
                    className="inline-flex"
                  >
                    <Badge
                      variant="secondary"
                      className="border-white/10 bg-white/5 text-white/72 transition-colors hover:bg-white/10"
                    >
                      Forked from {currentEdge.sourceEdge.name}
                    </Badge>
                  </Link>
                ) : currentEdge.sourceEdgeId ? (
                  <Badge
                    variant="secondary"
                    className="border-white/10 bg-white/5 text-white/72"
                  >
                    Forked from source Edge
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
            <div className="mx-auto w-full">
              <TabsList className="mb-6 flex h-auto w-full flex-wrap rounded-none border-b border-white/10 bg-transparent p-0 xl:flex-nowrap">
                {visibleTabs.map((item) => (
                  <TabsTrigger
                    key={item.id}
                    value={item.id}
                    className="rounded-none border-b-2 border-transparent px-4 py-2 text-xs whitespace-nowrap xl:flex-1 xl:justify-center data-[state=active]:border-primary data-[state=active]:bg-transparent"
                  >
                    <item.icon className="mr-2 size-3.5" />
                    {item.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <TabsContent value="content" className="mt-0">
              <div className="w-full space-y-6">
                <div className="border-b border-white/8 pb-4">
                  <p className="text-xs font-medium text-white/72">Content</p>
                  <p className="mt-1 text-xs text-white/45">
                    Write the core thesis for this Edge: the market context,
                    setup structure, execution framework, and what should stand
                    out when you review it later.
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
              <EdgeDetailOverviewSection
                detail={detail}
                canShowStats={canShowStats}
                canShowPrivateActivity={canShowPrivateActivity}
                metrics={metrics}
                overviewMetricCards={overviewMetricCards}
                edgeProfileCards={edgeProfileCards}
                resolvedReadiness={resolvedReadiness}
                resolvedAccountFit={resolvedAccountFit}
                resolvedLineageGraph={resolvedLineageGraph}
                overviewEntries={overviewEntries}
                overviewEntriesPageCount={overviewEntriesPageCount}
                clampedOverviewEntriesPage={clampedOverviewEntriesPage}
                setOverviewEntriesPage={setOverviewEntriesPage}
              />
            </TabsContent>

            <TabsContent value="passport" className="mt-0">
              <div className="w-full space-y-6">
                <div className="border-b border-white/8 pb-4">
                  <p className="text-xs font-medium text-white/72">Passport</p>
                  <p className="mt-1 text-xs text-white/45">
                    Review the proof, sample quality, process context, and
                    lineage attached to this Edge.
                  </p>
                </div>

                {canShowStats && passport ? (
                  <EdgePassportSection passport={passport} />
                ) : (
                  <div className="rounded-lg border border-dashed border-white/10 bg-black/20 px-5 py-6 text-xs text-white/48">
                    Edge passport data is not available for this view.
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="versions" className="mt-0">
              <div className="w-full space-y-6">
                <div className="border-b border-white/8 pb-4">
                  <p className="text-xs font-medium text-white/72">Versions</p>
                  <p className="mt-1 text-xs text-white/45">
                    Track how this Edge evolves over time, from the current live
                    snapshot to future saved versions and forks.
                  </p>
                </div>

                <EdgeVersionHistoryPanel
                  versionHistory={resolvedVersionHistory}
                />
              </div>
            </TabsContent>

            <TabsContent value="rules" className="mt-0 space-y-6">
              <div className="w-full space-y-6">
                <div className="border-b border-white/8 pb-4">
                  <p className="text-xs font-medium text-white/72">Rules</p>
                  <p className="mt-1 text-xs text-white/45">
                    Break the Edge into reviewable sections, define the exact
                    rules that matter, and control which outcomes each rule
                    should appear against when trades get reviewed.
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
                              setActiveRuleComposerSectionId(
                                (currentSectionId) =>
                                  currentSectionId === section.id
                                    ? null
                                    : section.id
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
                                    currentDrafts[section.id]?.description ??
                                    "",
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
                              ((
                                sectionDrafts[section.id]?.title ?? ""
                              ).trim() === section.title &&
                                (
                                  sectionDrafts[section.id]?.description ?? ""
                                ).trim() === (section.description ?? ""))
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
                            value: formatPercent(
                              section.metrics.followThroughRate
                            ),
                          },
                          {
                            label: "Reviewed",
                            value: `${section.metrics.reviewedCount}/${section.metrics.sampleSize}`,
                          },
                          {
                            label: "Review coverage",
                            value: formatPercent(
                              section.metrics.reviewCoverage
                            ),
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
                              draggable={
                                detail.canEdit && section.rules.length > 1
                              }
                              onDragStart={() => {
                                if (
                                  !detail.canEdit ||
                                  section.rules.length <= 1
                                ) {
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
                                  {detail.canEdit &&
                                  section.rules.length > 1 ? (
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
                                {(rule.appliesOutcomes ?? []).map(
                                  (outcome: string) => (
                                  <Badge
                                    key={`${rule.id}-${outcome}`}
                                    variant="outline"
                                    className="border-white/10 bg-black/20 text-white/62"
                                  >
                                    {formatRuleOutcomeLabel(outcome)}
                                  </Badge>
                                  )
                                )}
                              </div>

                              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                {[
                                  {
                                    label: "Follow-through",
                                    value: formatPercent(
                                      rule.metrics.followThroughRate
                                    ),
                                  },
                                  {
                                    label: "Expectancy",
                                    value: formatMoney(rule.metrics.expectancy),
                                  },
                                  {
                                    label: "Win rate when followed",
                                    value: formatPercent(
                                      rule.metrics.winRateWhenFollowed
                                    ),
                                  },
                                  {
                                    label: "Win rate when broken",
                                    value: formatPercent(
                                      rule.metrics.winRateWhenBroken
                                    ),
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

                      {detail.canEdit &&
                      activeRuleComposerSectionId === section.id ? (
                        <div className="space-y-3 rounded-lg border border-white/8 bg-black/20 p-4">
                          <div className="grid gap-3 xl:grid-cols-2">
                            <Input
                              value={newRuleDrafts[section.id]?.title ?? ""}
                              onChange={(event) =>
                                setNewRuleDrafts((currentDrafts) => ({
                                  ...currentDrafts,
                                  [section.id]: {
                                    ...(currentDrafts[section.id] ??
                                      createEmptyRuleDraft()),
                                    title: event.target.value,
                                  },
                                }))
                              }
                              placeholder="Rule title"
                            />
                            <Input
                              value={
                                newRuleDrafts[section.id]?.description ?? ""
                              }
                              onChange={(event) =>
                                setNewRuleDrafts((currentDrafts) => ({
                                  ...currentDrafts,
                                  [section.id]: {
                                    ...(currentDrafts[section.id] ??
                                      createEmptyRuleDraft()),
                                    description: event.target.value,
                                  },
                                }))
                              }
                              placeholder="How should this rule be reviewed?"
                            />
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {RULE_OUTCOME_OPTIONS.map((option) => {
                              const selectedOutcomes =
                                normalizeOutcomeSelection(
                                  newRuleDrafts[section.id]
                                    ?.appliesOutcomes ?? ["all"]
                                );
                              const isSelected = selectedOutcomes.includes(
                                option.value
                              );

                              return (
                                <button
                                  key={`${section.id}-${option.value}`}
                                  type="button"
                                  onClick={() =>
                                    setNewRuleDrafts((currentDrafts) => {
                                      const currentDraft =
                                        currentDrafts[section.id] ??
                                        createEmptyRuleDraft();
                                      const currentOutcomes =
                                        normalizeOutcomeSelection(
                                          currentDraft.appliesOutcomes
                                        );
                                      const nextOutcomes =
                                        option.value === "all"
                                          ? ["all"]
                                          : currentOutcomes.includes(
                                              option.value
                                            )
                                          ? currentOutcomes.filter(
                                              (outcome) =>
                                                outcome !== option.value
                                            )
                                          : currentOutcomes
                                              .filter(
                                                (outcome) => outcome !== "all"
                                              )
                                              .concat(option.value);

                                      return {
                                        ...currentDrafts,
                                        [section.id]: {
                                          ...currentDraft,
                                          appliesOutcomes:
                                            normalizeOutcomeSelection(
                                              nextOutcomes
                                            ),
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
                              onClick={() =>
                                handleCreateRule(
                                  section.id,
                                  section.rules.length
                                )
                              }
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
              <div className="w-full space-y-6">
                <div className="border-b border-white/8 pb-4">
                  <p className="text-xs font-medium text-white/72">Examples</p>
                  <p className="mt-1 text-xs text-white/45">
                    Keep reference charts, annotated screenshots, and concrete
                    examples of what this Edge should and should not look like
                    in the wild.
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
                <EdgeMissedTradesSection
                  edgeId={edgeId}
                  edgeName={currentEdge.name}
                  canEdit={detail.canEdit}
                  missedTrades={detail.missedTrades}
                  onChanged={refreshEdgeData}
                />
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
                            <p className="font-medium text-white">
                              {entry.title}
                            </p>
                            <p className="text-xs text-white/48">
                              {formatDate(entry.journalDate ?? entry.updatedAt)}
                            </p>
                          </div>
                          <Badge
                            variant="secondary"
                            className="border-white/10 bg-white/5 text-white/70"
                          >
                            {(entry.entryType ?? "entry").replace(/_/g, " ")}
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
        sharedMembers={normalizeSharedMembers(detail.sharedMembers)}
        onSharedStateChange={refreshEdgeData}
      />
      <EdgeForkSheet
        open={forkSheetOpen}
        onOpenChange={setForkSheetOpen}
        edgeName={currentEdge.name}
        defaultName={defaultForkName}
        defaultPublicationMode="private"
        defaultPublicStatsVisible={true}
        canPublishPublicFork={canPublishForkToLibrary}
        helperText={forkSheetHelperText}
        isPending={isForkPending}
        onSubmit={handleForkEdge}
      />
    </div>
  );
}
