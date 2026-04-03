"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Copy, Eye, Link2, Slash } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QuickTradeIdeaForm } from "@/features/trade-ideas/components/quick-trade-idea-form";
import {
  formatDirectionArrow,
  formatDirectionLabel,
  getTradeIdeaPhase,
  getTradeIdeaPhaseLabel,
  getTradeIdeaStatus,
} from "@/features/trade-ideas/lib/trade-idea-utils";
import { trpc } from "@/utils/trpc";

function getStatusBadgeClassName(status: string) {
  switch (status) {
    case "expired":
      return "border-amber-500/20 bg-amber-500/10 text-amber-100";
    case "deactivated":
      return "border-rose-500/20 bg-rose-500/10 text-rose-100";
    default:
      return "border-teal-500/20 bg-teal-500/10 text-teal-100";
  }
}

export function MySharedIdeasList() {
  const [quickShareOpen, setQuickShareOpen] = useState(false);
  const utils = trpc.useUtils() as any;
  const { data: ideas = [], isLoading } = trpc.tradeIdeas.listMine.useQuery();
  const deactivateMutation = trpc.tradeIdeas.deactivate.useMutation({
    onSuccess: async () => {
      await utils.tradeIdeas.listMine.invalidate();
      toast.success("Trade idea deactivated");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to deactivate trade idea");
    },
  });

  const handleCopy = async (sharePath: string) => {
    const url = `${window.location.origin}${sharePath}`;
    await navigator.clipboard.writeText(url);
    toast.success("Trade idea link copied");
  };

  return (
    <section className="space-y-4 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-white/38">
            My shared ideas
          </div>
          <p className="mt-2 text-sm text-white/46">
            Manage your active trade idea links and keep an eye on view counts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-white/65">
            {ideas.length} total
          </Badge>
          <Button
            onClick={() => setQuickShareOpen(true)}
            className="cursor-pointer rounded-sm border border-white/5 bg-sidebar px-3 py-2 text-xs text-white/75 transition-all duration-250 hover:bg-sidebar-accent hover:brightness-110 hover:text-white"
          >
            Share without journal
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-8 text-center text-sm text-white/42">
          Loading shared trade ideas...
        </div>
      ) : ideas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-white/38">
          No trade ideas shared yet.
        </div>
      ) : (
        <div className="space-y-3">
          {ideas.map((idea) => {
            const status = getTradeIdeaStatus(idea as any);
            return (
              <article
                key={idea.id}
                className="flex flex-col gap-4 rounded-2xl border border-white/8 bg-black/20 p-4 lg:flex-row lg:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <div className="size-20 shrink-0 overflow-hidden rounded-2xl border border-white/8 bg-white/[0.05]">
                    {idea.chartImageUrl ? (
                      <img
                        src={idea.chartImageUrl}
                        alt={`${idea.symbol} chart`}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-white">
                        {idea.symbol} {formatDirectionArrow(idea.direction as any)} {formatDirectionLabel(idea.direction as any)}
                      </h3>
                      <Badge className={`border ${getStatusBadgeClassName(status)}`}>
                        {status}
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-white/45">
                      {idea.title || idea.description || "Shared trade idea"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-white/38">
                      <span>{getTradeIdeaPhaseLabel(getTradeIdeaPhase(idea as any))}</span>
                      <span className="inline-flex items-center gap-1.5">
                        <Eye className="size-3.5" />
                        {idea.viewCount} views
                      </span>
                      <span>
                        Shared {formatDistanceToNow(new Date(idea.createdAt), { addSuffix: true })}
                      </span>
                      <span>{idea.sharePath}</span>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    onClick={() => handleCopy(idea.sharePath)}
                    className="h-9 rounded-sm bg-white text-black hover:bg-white/90"
                  >
                    <Copy className="mr-2 size-4" />
                    Copy link
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => window.open(idea.sharePath, "_blank", "noopener,noreferrer")}
                    className="h-9 rounded-sm border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                  >
                    <Link2 className="mr-2 size-4" />
                    Open
                  </Button>
                  {status === "active" ? (
                    <Button
                      variant="outline"
                      onClick={() => deactivateMutation.mutate({ id: idea.id })}
                      className="h-9 rounded-sm border-rose-500/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/18"
                    >
                      <Slash className="mr-2 size-4" />
                      Deactivate
                    </Button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <QuickTradeIdeaForm open={quickShareOpen} onOpenChange={setQuickShareOpen} />
    </section>
  );
}
