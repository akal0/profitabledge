"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Copy, Eye, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  buildTradeIdeaDescription,
  formatDirectionArrow,
  formatDirectionLabel,
  formatPrice,
  formatRiskReward,
  generateTradeIdeaTitle,
  getIdeaAuthorHandle,
  getIdeaAuthorName,
  getIdeaInitials,
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

  const handleCopy = async () => {
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Trade idea link copied");
  };

  return (
    <div className="min-h-screen bg-[#06080d] text-white">
      <div className="relative overflow-hidden border-b border-white/8">
        {idea.authorBannerUrl ? (
          <img
            src={idea.authorBannerUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-25"
          />
        ) : null}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(70,214,207,0.18),transparent_40%),linear-gradient(180deg,rgba(6,8,13,0.25),rgba(6,8,13,0.94))]" />

        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-12 md:px-6 lg:px-8 lg:py-16">
          <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.18em] text-white/42">
            <span>profitabledge</span>
            <span>·</span>
            <span>Trade idea</span>
          </div>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge className="border-teal-500/20 bg-teal-500/10 text-teal-100">
                  {idea.symbol} {formatDirectionArrow(idea.direction)} {formatDirectionLabel(idea.direction)}
                </Badge>
                {idea.showRR !== false && idea.riskReward ? (
                  <Badge className="border-cyan-500/20 bg-cyan-500/10 text-cyan-100">
                    {formatRiskReward(idea.riskReward)}
                  </Badge>
                ) : null}
                {idea.session ? (
                  <Badge className="border-white/10 bg-white/[0.05] text-white/75">
                    {idea.session}
                  </Badge>
                ) : null}
                {idea.timeframe ? (
                  <Badge className="border-white/10 bg-white/[0.05] text-white/75">
                    {idea.timeframe}
                  </Badge>
                ) : null}
              </div>

              <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
                {title}
              </h1>

              <p className="max-w-2xl text-base leading-7 text-white/62 md:text-lg">
                {description}
              </p>

              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/42">
                <span className="inline-flex items-center gap-1.5">
                  <Eye className="size-4" />
                  {viewCount} views
                </span>
                <span>
                  Shared {formatDistanceToNow(new Date(idea.createdAt || Date.now()), { addSuffix: true })}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={handleCopy} className="h-10 rounded-sm bg-white text-black hover:bg-white/90">
                <Copy className="mr-2 size-4" />
                Copy link
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-10 rounded-sm border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
              >
                <Link href="/sign-up">
                  <Share2 className="mr-2 size-4" />
                  Build your own
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-10 md:px-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.72fr)] lg:px-8 lg:py-12">
        <section className="overflow-hidden rounded-[28px] border border-white/8 bg-white/[0.03]">
          <div className="relative aspect-[16/9] bg-[#090d14]">
            {idea.chartImageUrl ? (
              <img
                src={idea.chartImageUrl}
                alt={`${idea.symbol} chart image`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm uppercase tracking-[0.18em] text-white/35">
                No chart image
              </div>
            )}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(6,8,13,0.2)_60%,rgba(6,8,13,0.62))]" />
          </div>

          <div className="space-y-4 p-5 md:p-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Entry" value={idea.showPrices === false ? "Hidden" : formatPrice(idea.entryPrice)} />
              <StatCard label="Stop Loss" value={idea.showPrices === false ? "Hidden" : formatPrice(idea.stopLoss)} />
              <StatCard label="Take Profit" value={idea.showPrices === false ? "Hidden" : formatPrice(idea.takeProfit)} />
              <StatCard label="R:R" value={idea.showRR === false ? "Hidden" : formatRiskReward(idea.riskReward)} />
            </div>

            {description ? (
              <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/34">
                  Notes
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-white/66">
                  {description}
                </p>
              </div>
            ) : null}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-[28px] border border-white/8 bg-white/[0.03] p-5">
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/34">
              Trader
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Avatar className="size-14 rounded-full ring-1 ring-white/10">
                <AvatarImage src={idea.authorAvatarUrl || undefined} alt={authorName} className="object-cover" />
                <AvatarFallback className="bg-white/[0.08] text-base font-semibold text-white">
                  {getIdeaInitials(authorName)}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="text-base font-semibold text-white">{authorName}</div>
                {idea.showUsername === false ? null : (
                  <div className="mt-1 text-sm text-white/46">{handle}</div>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-white/8 bg-white/[0.03] p-5">
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/34">
              Setup details
            </div>
            <div className="mt-4 space-y-3 text-sm text-white/72">
              <InfoRow label="Symbol" value={idea.symbol} />
              <InfoRow label="Direction" value={`${formatDirectionArrow(idea.direction)} ${formatDirectionLabel(idea.direction)}`} />
              {idea.session ? <InfoRow label="Session" value={idea.session} /> : null}
              {idea.timeframe ? <InfoRow label="Timeframe" value={idea.timeframe} /> : null}
              {idea.strategyName ? <InfoRow label="Strategy" value={idea.strategyName} /> : null}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-white/8 bg-black/20 p-4">
      <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/34">
        {label}
      </div>
      <div className="mt-3 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/8 bg-black/20 px-3 py-3">
      <span className="text-white/42">{label}</span>
      <span className="text-right text-white">{value}</span>
    </div>
  );
}
