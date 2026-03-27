"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Eye,
  GitFork,
  Layers3,
  ShieldCheck,
  Target,
  TrendingUp,
  UsersRound,
  Waypoints,
  type LucideIcon,
} from "lucide-react";

import {
  GoalContentSeparator,
  GoalSurface,
} from "@/components/goals/goal-surface";
import { JournalEditorStyles } from "@/components/journal/editor/journal-editor-styles";
import { ProfitabledgeVerificationCard, resolveAbsolutePublicUrl } from "@/components/verification/profitabledge-verification-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import {
  Tabs,
  TabsContent,
  TabsListUnderlined,
  TabsTriggerUnderlined,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { trpcOptions } from "@/utils/trpc";

type PublicPassportCard = {
  label?: string;
  value?: string;
  detail?: string;
  tone?: "teal" | "blue" | "amber" | "rose" | "slate";
};

type PublicLineageSource = {
  id?: string;
  shareId?: string;
  publicPath?: string | null;
  name?: string | null;
  ownerName?: string | null;
  ownerUsername?: string | null;
};

type PublicEdgeProofData = {
  edge?: {
    id?: string;
    name?: string | null;
    description?: string | null;
    coverImageUrl?: string | null;
    coverImagePosition?: number | null;
    color?: string | null;
    contentHtml?: string | null;
    examplesHtml?: string | null;
    metrics?: {
      tradeCount?: number | null;
      winRate?: number | null;
      netPnl?: number | null;
      expectancy?: number | null;
      followThroughRate?: number | null;
      reviewCoverage?: number | null;
      copyCount?: number | null;
      shareCount?: number | null;
    } | null;
    passport?: {
      cards?: {
        sample?: PublicPassportCard;
        proof?: PublicPassportCard;
        process?: PublicPassportCard;
        prop?: PublicPassportCard;
      };
      fitNotes?: Array<{ label?: string; value?: string }>;
      lineage?: {
        publicationLabel?: string | null;
        forkCount?: number | null;
        shareCount?: number | null;
        source?: PublicLineageSource | null;
      };
    } | null;
  } | null;
  owner?: {
    id?: string;
    name?: string | null;
    displayName?: string | null;
    username?: string | null;
    image?: string | null;
  } | null;
  verification?:
    | {
        path?: string;
        code?: string;
        issuedAt?: string;
      }
    | null;
};

function formatPercent(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function formatMoney(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatR(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}R`;
}

function getToneClasses(
  tone?: "teal" | "blue" | "amber" | "rose" | "slate"
) {
  switch (tone) {
    case "teal":
      return "border-teal-400/20 bg-teal-400/10 text-teal-100";
    case "blue":
      return "border-sky-400/20 bg-sky-400/10 text-sky-100";
    case "amber":
      return "border-amber-400/20 bg-amber-400/10 text-amber-100";
    case "rose":
      return "border-rose-400/20 bg-rose-400/10 text-rose-100";
    default:
      return "border-white/10 bg-white/5 text-white/80";
  }
}

function getOwnerLabel(owner?: PublicEdgeProofData["owner"] | null) {
  return (
    owner?.displayName?.trim() ||
    owner?.name?.trim() ||
    owner?.username?.trim() ||
    "Trader"
  );
}

function getOwnerSecondary(owner?: PublicEdgeProofData["owner"] | null) {
  return owner?.username?.trim() ? `@${owner.username.trim()}` : "Public edge";
}

function getOwnerInitials(owner?: PublicEdgeProofData["owner"] | null) {
  return getOwnerLabel(owner)
    .split(/\s+/)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}

function resolveSourceEdgeHref(source?: PublicLineageSource | null) {
  if (!source) return null;
  if (source.publicPath?.trim()) return source.publicPath.trim();
  if (source.shareId?.trim()) return `/edge/${source.shareId.trim()}`;
  return null;
}

function PublicMetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
}) {
  return (
    <GoalSurface className="w-full">
      <div className="p-3.5">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-teal-300" />
          <span className="text-xs text-white/50">{label}</span>
        </div>
        <GoalContentSeparator className="mb-3.5 mt-3.5" />
        <p className="text-2xl font-semibold text-white">{value}</p>
        <p className="mt-1 text-xs text-white/40">{detail}</p>
      </div>
    </GoalSurface>
  );
}

function PublicHtmlPreview({
  html,
  emptyLabel,
}: {
  html?: string | null;
  emptyLabel: string;
}) {
  if (!html?.trim()) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-sm border border-dashed border-white/10 bg-white/[0.03] px-5 py-6 text-sm text-white/45">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-white/8 bg-white/[0.03] px-5 py-4">
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

export function PublicEdgeProofPage({ shareId }: { shareId: string }) {
  const edgePublicFactory =
    (trpcOptions as any)?.edges?.getPublicEdgePage?.queryOptions ??
    (trpcOptions as any)?.edges?.getPublicPage?.queryOptions ??
    null;

  const queryOptions = useMemo(
    () =>
      edgePublicFactory
        ? edgePublicFactory({ shareId })
        : {
            queryKey: ["edges.public-edge-proof.unavailable", shareId],
            queryFn: async () => null,
            enabled: false,
          },
    [edgePublicFactory, shareId]
  );

  const { data, isLoading } = useQuery(queryOptions as any);
  const page = (data ?? null) as PublicEdgeProofData | null;
  const edge = page?.edge ?? null;
  const metrics = edge?.metrics ?? null;
  const passport = edge?.passport ?? null;
  const verification = page?.verification?.path
    ? {
        path: page.verification.path,
        code: page.verification.code ?? "Unavailable",
        issuedAt: page.verification.issuedAt ?? new Date().toISOString(),
      }
    : null;
  const sourceHref = resolveSourceEdgeHref(passport?.lineage?.source ?? null);

  if (isLoading) {
    return (
      <RouteLoadingFallback
        route="publicProof"
        className="min-h-screen bg-sidebar"
      />
    );
  }

  if (!edgePublicFactory) {
    return (
      <div className="min-h-screen bg-sidebar px-4 py-8 md:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <GoalSurface innerClassName="overflow-hidden">
            <div className="p-6 md:p-8">
              <p className="text-[10px] uppercase tracking-[0.18em] text-teal-300/82">
                Public edge proof
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                Public edge proof is not wired yet
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/46">
                This route is in place, but the matching public edge backend
                query is not available in the current branch yet.
              </p>
            </div>
          </GoalSurface>
        </div>
      </div>
    );
  }

  if (!page || !edge) {
    return (
      <div className="min-h-screen bg-sidebar px-4 py-8 md:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <GoalSurface innerClassName="overflow-hidden">
            <div className="p-6 md:p-8">
              <p className="text-[10px] uppercase tracking-[0.18em] text-teal-300/82">
                Public edge proof
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                Edge not found
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/46">
                This public edge may have been removed, made private, or the
                link is invalid.
              </p>
            </div>
          </GoalSurface>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sidebar px-4 py-8 md:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <GoalSurface innerClassName="overflow-hidden">
          <div className="overflow-hidden">
            {edge.coverImageUrl ? (
              <div className="h-52 overflow-hidden bg-sidebar-accent">
                <img
                  src={edge.coverImageUrl}
                  alt=""
                  className="h-full w-full object-cover opacity-80"
                  style={{
                    objectPosition: `center ${edge.coverImagePosition ?? 50}%`,
                  }}
                />
              </div>
            ) : (
              <div
                className="h-52"
                style={{
                  background:
                    edge.color != null
                      ? `linear-gradient(135deg, ${edge.color}, rgba(15,23,42,0.88) 72%)`
                      : "linear-gradient(135deg, rgba(20,184,166,0.35), rgba(15,23,42,0.92) 72%)",
                }}
              />
            )}

            <div className="p-6 md:p-8">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-white/10 bg-white/5 text-white/80">
                      Public edge proof
                    </Badge>
                    {passport?.lineage?.publicationLabel ? (
                      <Badge className="border-white/10 bg-white/5 text-white/80">
                        <Eye className="mr-1 h-3 w-3" />
                        {passport.lineage.publicationLabel}
                      </Badge>
                    ) : null}
                  </div>

                  <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                    {edge.name || "Untitled Edge"}
                  </h1>

                  {edge.description ? (
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-white/50">
                      {edge.description}
                    </p>
                  ) : null}

                  <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-white/45">
                    <div className="flex items-center gap-2">
                      <Avatar className="size-8 border border-white/10">
                        {page.owner?.image ? (
                          <AvatarImage
                            alt={getOwnerLabel(page.owner)}
                            src={page.owner.image}
                          />
                        ) : null}
                        <AvatarFallback className="bg-sidebar-accent text-[10px] font-semibold text-white/85">
                          {getOwnerInitials(page.owner)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm text-white/78">
                          {getOwnerLabel(page.owner)}
                        </p>
                        <p className="text-xs text-white/38">
                          {getOwnerSecondary(page.owner)}
                        </p>
                      </div>
                    </div>

                    {passport?.lineage?.source?.name ? (
                      <div className="flex items-center gap-2 text-xs text-white/45">
                        <GitFork className="h-3.5 w-3.5" />
                        Forked from {passport.lineage.source.name}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    asChild
                    variant="outline"
                    className="h-9 rounded-sm border-white/8 bg-white/5 text-white/78 hover:bg-white/10 hover:text-white"
                  >
                    <Link href="/">
                      Build your own edge
                    </Link>
                  </Button>
                  {verification ? (
                    <Button
                      asChild
                      className="h-9 rounded-sm bg-teal-500 text-black hover:bg-teal-400"
                    >
                      <Link href={resolveAbsolutePublicUrl(verification.path)}>
                        Verify proof
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </GoalSurface>

        {metrics ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
            <PublicMetricCard
              icon={Layers3}
              label="Trades"
              value={String(metrics.tradeCount ?? 0)}
              detail="Tagged sample"
            />
            <PublicMetricCard
              icon={TrendingUp}
              label="Win rate"
              value={formatPercent(metrics.winRate)}
              detail="Executed sample"
            />
            <PublicMetricCard
              icon={Target}
              label="Expectancy"
              value={formatR(metrics.expectancy)}
              detail="Average realized R"
            />
            <PublicMetricCard
              icon={BarChart3}
              label="Net P&L"
              value={formatMoney(metrics.netPnl)}
              detail="Across tagged trades"
            />
            <PublicMetricCard
              icon={CheckCircle2}
              label="Follow-through"
              value={formatPercent(metrics.followThroughRate)}
              detail="Rule execution"
            />
            <PublicMetricCard
              icon={UsersRound}
              label="Forks"
              value={String(metrics.copyCount ?? 0)}
              detail={`${metrics.shareCount ?? 0} direct shares`}
            />
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_360px]">
          {passport ? (
            <GoalSurface innerClassName="overflow-hidden">
              <div className="p-5 md:p-6">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-teal-300" />
                  <p className="text-sm font-medium text-white">Proof and readiness</p>
                </div>
                <GoalContentSeparator className="mb-4 mt-4" />

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {[
                    passport.cards?.sample,
                    passport.cards?.proof,
                    passport.cards?.process,
                    passport.cards?.prop,
                  ]
                    .filter(Boolean)
                    .map((card, index) => (
                      <div
                        key={`${card?.label ?? "card"}-${index}`}
                        className="rounded-sm border border-white/8 bg-white/[0.03] p-4"
                      >
                        <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                          {card?.label ?? "Status"}
                        </p>
                        <Badge
                          className={cn(
                            "mt-3 border text-xs",
                            getToneClasses(card?.tone)
                          )}
                        >
                          {card?.value ?? "Unavailable"}
                        </Badge>
                        <p className="mt-3 text-xs leading-5 text-white/46">
                          {card?.detail ?? "No detail available."}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            </GoalSurface>
          ) : null}

          <div className="space-y-4">
            {passport?.fitNotes?.length ? (
              <GoalSurface innerClassName="overflow-hidden">
                <div className="p-5">
                  <div className="flex items-center gap-2">
                    <Waypoints className="h-4 w-4 text-teal-300" />
                    <p className="text-sm font-medium text-white">Fit</p>
                  </div>
                  <GoalContentSeparator className="mb-4 mt-4" />
                  <div className="space-y-3">
                    {passport.fitNotes.map((note, index) => (
                      <div
                        key={`${note.label ?? "fit"}-${index}`}
                        className="rounded-sm border border-white/8 bg-white/[0.03] p-3"
                      >
                        <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                          {note.label ?? "Fit"}
                        </p>
                        <p className="mt-1 text-sm text-white/72">
                          {note.value ?? "Unavailable"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </GoalSurface>
            ) : null}

            <GoalSurface innerClassName="overflow-hidden">
              <div className="p-5">
                <div className="flex items-center gap-2">
                  <GitFork className="h-4 w-4 text-teal-300" />
                  <p className="text-sm font-medium text-white">Lineage</p>
                </div>
                <GoalContentSeparator className="mb-4 mt-4" />
                <div className="space-y-3">
                  <div className="rounded-sm border border-white/8 bg-white/[0.03] p-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                      Publication
                    </p>
                    <p className="mt-1 text-sm text-white/72">
                      {passport?.lineage?.publicationLabel ?? "Public edge"}
                    </p>
                  </div>
                  <div className="rounded-sm border border-white/8 bg-white/[0.03] p-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                      Source
                    </p>
                    {sourceHref ? (
                      <Link
                        href={sourceHref}
                        className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-teal-300 transition-colors hover:text-teal-200"
                      >
                        {passport?.lineage?.source?.name ?? "Open source edge"}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    ) : (
                      <p className="mt-1 text-sm text-white/72">
                        {passport?.lineage?.source?.name ?? "Original edge"}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </GoalSurface>

            {verification ? (
              <ProfitabledgeVerificationCard
                verification={verification}
                title="Signed proof verification"
                description="Open the verify page to confirm this public edge proof came from Profitabledge."
                compact
              />
            ) : null}
          </div>
        </div>

        <GoalSurface innerClassName="overflow-hidden">
          <div className="p-5 md:p-6">
            <Tabs defaultValue="thesis">
              <TabsListUnderlined className="mb-5">
                <TabsTriggerUnderlined value="thesis">
                  Thesis
                </TabsTriggerUnderlined>
                <TabsTriggerUnderlined value="examples">
                  Examples
                </TabsTriggerUnderlined>
              </TabsListUnderlined>

              <TabsContent value="thesis" className="mt-0">
                <PublicHtmlPreview
                  html={edge.contentHtml}
                  emptyLabel="No public thesis has been published for this edge yet."
                />
              </TabsContent>

              <TabsContent value="examples" className="mt-0">
                <PublicHtmlPreview
                  html={edge.examplesHtml}
                  emptyLabel="No public examples have been published for this edge yet."
                />
              </TabsContent>
            </Tabs>
          </div>
        </GoalSurface>

        <div className="text-center text-sm text-white/38">
          <p>
            Powered by{" "}
            <Link
              href="/"
              className="font-semibold text-white/65 transition-colors hover:text-teal-300"
            >
              profitabledge
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
