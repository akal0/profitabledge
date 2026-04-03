"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Copy, Eye, Share2 } from "lucide-react";
import { toast } from "sonner";

import { GoalContentSeparator, GoalSurface } from "@/components/goals/goal-surface";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  buildTradeIdeaFieldRows,
  buildTradeIdeaDescription,
  formatDirectionArrow,
  formatDirectionLabel,
  formatPrice,
  formatRiskReward,
  generateTradeIdeaTitle,
  getIdeaAuthorHandle,
  getIdeaAuthorName,
  getIdeaInitials,
  getTradeIdeaPhase,
  getTradeIdeaPhaseLabel,
  type TradeIdeaPresentation,
} from "@/features/trade-ideas/lib/trade-idea-utils";
import { trpc } from "@/utils/trpc";

type TradeIdeaPublicPageProps = {
  token: string;
  idea: TradeIdeaPresentation;
};

export function TradeIdeaPublicPage({ token, idea }: TradeIdeaPublicPageProps) {
  const viewedRef = useRef(false);
  const [viewCount, setViewCount] = useState(idea.viewCount ?? 0);
  const recordView = trpc.tradeIdeas.recordView.useMutation({
    onSuccess: (result) => {
      setViewCount(result.viewCount);
    },
  });

  useEffect(() => {
    if (viewedRef.current) {
      return;
    }

    viewedRef.current = true;
    recordView.mutate({ token });
  }, [recordView, token]);

  const authorName = getIdeaAuthorName(idea);
  const handle = getIdeaAuthorHandle(idea);
  const description = buildTradeIdeaDescription(idea);
  const title = generateTradeIdeaTitle(idea);
  const phaseLabel = getTradeIdeaPhaseLabel(getTradeIdeaPhase(idea));
  const fieldRows = buildTradeIdeaFieldRows(idea);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Trade idea link copied");
  };

  return (
    <div className="min-h-screen bg-sidebar text-white">
      <div className="relative">
        <div className="relative h-52 overflow-hidden border-b border-white/8 md:h-64">
          {idea.authorBannerUrl ? (
            <img
              src={idea.authorBannerUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : null}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(21,24,31,0.18),rgba(21,24,31,0.78)),radial-gradient(circle_at_top_left,rgba(20,184,166,0.2),transparent_36%)]" />
        </div>

        <div className="relative px-4 md:px-6 lg:px-8">
          <div className="-mt-12 flex items-start justify-between gap-4 pb-4">
            <div className="relative inline-flex">
              <Avatar className="size-[72px] rounded-full ring-4 ring-sidebar shadow-lg">
                <AvatarImage
                  src={idea.authorAvatarUrl || undefined}
                  alt={authorName}
                  className="object-cover"
                />
                <AvatarFallback className="bg-sidebar-accent text-xl font-semibold text-white">
                  {getIdeaInitials(authorName)}
                </AvatarFallback>
              </Avatar>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleCopy}
                className="h-9 rounded-sm border border-white/5 bg-white px-3 text-xs text-black transition-all duration-250 hover:bg-white/90"
              >
                <Copy className="mr-2 size-3.5" />
                Copy link
              </Button>
              <Button
                asChild
                className="h-9 rounded-sm border border-white/5 bg-sidebar px-3 text-xs text-white/75 transition-all duration-250 hover:bg-sidebar-accent hover:text-white"
              >
                <Link href="/sign-up">
                  <Share2 className="mr-2 size-3.5" />
                  Build your own
                </Link>
              </Button>
            </div>
          </div>

          <div className="flex w-full flex-col gap-5 py-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0 space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-teal-300/80">
                  {idea.showUsername === false ? authorName : handle} shared a trade idea
                </p>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                    {title}
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm leading-7 text-white/58 md:text-base">
                    {description}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-sm border border-teal-500/20 bg-teal-500/10 text-teal-100">
                  {idea.symbol} {formatDirectionArrow(idea.direction)} {formatDirectionLabel(idea.direction)}
                </Badge>
                <Badge className="rounded-sm border border-white/10 bg-white/5 text-white/75">
                  {phaseLabel}
                </Badge>
                {idea.showRR !== false && idea.riskReward ? (
                  <Badge className="rounded-sm border border-cyan-500/20 bg-cyan-500/10 text-cyan-100">
                    {formatRiskReward(idea.riskReward)}
                  </Badge>
                ) : null}
                {idea.session ? (
                  <Badge className="rounded-sm border border-white/10 bg-white/5 text-white/75">
                    {idea.session}
                  </Badge>
                ) : null}
                {idea.timeframe ? (
                  <Badge className="rounded-sm border border-white/10 bg-white/5 text-white/75">
                    {idea.timeframe}
                  </Badge>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/45">
                <span className="inline-flex items-center gap-1.5">
                  <Eye className="size-3.5" />
                  {viewCount} views
                </span>
                <span>
                  Shared {formatDistanceToNow(new Date(idea.createdAt || Date.now()), { addSuffix: true })}
                </span>
                {idea.strategyName ? <span>Strategy: {idea.strategyName}</span> : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      <div className="px-4 pb-10 pt-10 md:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <GoalSurface>
            <div className="p-3.5">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/65">
                {fieldRows.map((row) => (
                  <div key={row.label} className="flex items-center gap-2">
                    <span className="text-white/40">{row.label}</span>
                    <span
                      className={
                        row.label === "Stop loss" && idea.showPrices !== false
                          ? "text-rose-300"
                          : row.label === "Take profit" && idea.showPrices !== false
                            ? "text-teal-300"
                            : row.label === "Exit" && idea.showPrices !== false
                              ? "text-teal-300"
                              : "text-white"
                      }
                    >
                      {idea.showPrices === false ? "Hidden" : formatPrice(row.value)}
                    </span>
                  </div>
                ))}
                {idea.showRR !== false ? (
                  <div className="flex items-center gap-2">
                    <span className="text-white/40">Risk to reward</span>
                    <span className="text-teal-300">{formatRiskReward(idea.riskReward)}</span>
                  </div>
                ) : null}
              </div>
              <GoalContentSeparator className="mb-3.5 mt-3.5" />
              <div className="overflow-hidden rounded-sm border border-white/8 bg-black/20">
                <div className="relative aspect-[16/9] bg-[#090d14]">
                  {idea.chartImageUrl ? (
                    <img
                      src={idea.chartImageUrl}
                      alt={`${idea.symbol} chart image`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-white/35">
                      No chart image
                    </div>
                  )}
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(6,8,13,0.12)_55%,rgba(6,8,13,0.48))]" />
                </div>
              </div>
            </div>
          </GoalSurface>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <GoalSurface>
              <div className="p-3.5">
                <div className="flex items-center gap-2 text-sm text-white/55">
                  <span>Notes</span>
                </div>
                <GoalContentSeparator className="mb-3.5 mt-3.5" />
                <p className="whitespace-pre-wrap text-sm leading-7 text-white/66">
                  {description}
                </p>
              </div>
            </GoalSurface>

            <GoalSurface>
              <div className="p-3.5">
                <div className="flex items-center gap-2 text-sm text-white/55">
                  <span>Setup details</span>
                </div>
                <GoalContentSeparator className="mb-3.5 mt-3.5" />
                <div className="space-y-3 text-sm text-white/72">
                  <InfoRow label="Stage" value={phaseLabel} />
                  <InfoRow label="Symbol" value={idea.symbol} />
                  <InfoRow
                    label="Direction"
                    value={`${formatDirectionArrow(idea.direction)} ${formatDirectionLabel(idea.direction)}`}
                  />
                  {idea.session ? <InfoRow label="Session" value={idea.session} /> : null}
                  {idea.timeframe ? <InfoRow label="Timeframe" value={idea.timeframe} /> : null}
                  {idea.strategyName ? <InfoRow label="Strategy" value={idea.strategyName} /> : null}
                </div>
              </div>
            </GoalSurface>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-sm border border-white/8 bg-black/20 px-3 py-3">
      <span className="text-white/42">{label}</span>
      <span className="text-right text-white">{value}</span>
    </div>
  );
}
