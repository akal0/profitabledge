"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Brain, Calendar, Clock, Edit3, Lightbulb, Paperclip, Tag } from "lucide-react";

import { JournalShareBlockRenderer } from "@/components/journal/share/block-renderer";
import type { SharedJournalEntryPayload } from "@/components/journal/share/types";
import { PsychologySummary } from "@/components/journal/psychology-tracker";
import { TradePhaseBadge } from "@/components/journal/trade-phase-selector";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const shareTradePhases = new Set(["pre-trade", "during-trade", "post-trade"]);

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="rounded-md border border-white/8 bg-white/[0.03] px-3 py-2">
      <div className="text-[11px] uppercase tracking-[0.16em] text-white/28">{label}</div>
      <div className="mt-1 text-sm text-white/82">{value}</div>
    </div>
  );
}

export function JournalShareEntryView({ entry }: { entry: SharedJournalEntryPayload }) {
  const [activeTab, setActiveTab] = useState("content");
  const readTimeMinutes = Math.max(entry.readTimeMinutes || 0, 1);

  const hasTradeIdea =
    entry.plannedEntryPrice ||
    entry.plannedExitPrice ||
    entry.plannedStopLoss ||
    entry.plannedTakeProfit ||
    entry.plannedRiskReward ||
    entry.plannedNotes ||
    entry.actualOutcome ||
    entry.actualPnl ||
    entry.actualPips ||
    entry.postTradeAnalysis ||
    entry.lessonsLearned;

  const hasPsychology = Boolean(entry.psychology);

  return (
    <article className="min-h-0 overflow-y-auto">
      {entry.coverImageUrl ? (
        <div className="h-48 overflow-hidden bg-sidebar-accent md:h-64">
          <img
            src={entry.coverImageUrl}
            alt=""
            className="h-full w-full object-cover"
            style={{ objectPosition: `center ${entry.coverImagePosition ?? 50}%` }}
          />
        </div>
      ) : null}

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {entry.emoji ? (
          <div className="mb-4 text-5xl leading-none">{entry.emoji}</div>
        ) : null}

        <h1 className="text-4xl font-semibold tracking-[-0.05em] text-white">
          {entry.title}
        </h1>

        {entry.tradePhase && shareTradePhases.has(entry.tradePhase) ? (
          <div className="mt-4">
            <TradePhaseBadge
              phase={entry.tradePhase as "pre-trade" | "during-trade" | "post-trade"}
            />
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-white/42">
          <div className="flex items-center gap-1.5">
            <Calendar className="size-4" />
            <span>
              {entry.journalDate
                ? format(new Date(entry.journalDate), "MMM d, yyyy")
                : format(new Date(entry.createdAt), "MMM d, yyyy")}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="size-4" />
            <span>{readTimeMinutes} min read</span>
          </div>
          {(entry.wordCount ?? 0) > 0 ? (
            <span>{entry.wordCount} words</span>
          ) : null}
        </div>

        {entry.tags.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Tag className="size-4 text-white/32" />
            {entry.tags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="border-white/10 bg-transparent text-xs text-white/58"
              >
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}

        <Separator className="my-6 bg-white/10" />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 h-auto rounded-none border-b border-white/10 bg-transparent p-0">
            <TabsTrigger
              value="content"
              className="rounded-none border-b-2 border-transparent px-4 py-2 text-xs data-[state=active]:border-teal-400 data-[state=active]:bg-transparent data-[state=active]:text-teal-400"
            >
              <Edit3 className="mr-2 h-3 w-3" />
              Content
            </TabsTrigger>
            <TabsTrigger
              value="trade-idea"
              className="rounded-none border-b-2 border-transparent px-4 py-2 text-xs data-[state=active]:border-teal-400 data-[state=active]:bg-transparent data-[state=active]:text-teal-400"
            >
              <Lightbulb className="mr-2 h-3 w-3" />
              Trade Idea
              {hasTradeIdea ? (
                <span className="ml-1.5 size-1.5 rounded-full bg-teal-400/60 inline-block" />
              ) : null}
            </TabsTrigger>
            <TabsTrigger
              value="psychology"
              className="rounded-none border-b-2 border-transparent px-4 py-2 text-xs data-[state=active]:border-teal-400 data-[state=active]:bg-transparent data-[state=active]:text-teal-400"
            >
              <Brain className="mr-2 h-3 w-3" />
              Psychology
              {hasPsychology ? (
                <span className="ml-1.5 size-1.5 rounded-full bg-teal-400/60 inline-block" />
              ) : null}
            </TabsTrigger>
            <TabsTrigger
              value="media"
              className="rounded-none border-b-2 border-transparent px-4 py-2 text-xs data-[state=active]:border-teal-400 data-[state=active]:bg-transparent data-[state=active]:text-teal-400"
            >
              <Paperclip className="mr-2 h-3 w-3" />
              Media
            </TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="mt-0">
            <JournalShareBlockRenderer blocks={entry.content} />
          </TabsContent>

          <TabsContent value="trade-idea" className="mt-0 space-y-6">
            {hasTradeIdea ? (
              <>
                {(entry.plannedEntryPrice ||
                  entry.plannedExitPrice ||
                  entry.plannedStopLoss ||
                  entry.plannedTakeProfit ||
                  entry.plannedRiskReward ||
                  entry.plannedNotes) ? (
                  <section className="space-y-4">
                    <h2 className="text-base font-semibold text-white">Trade idea</h2>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      <InfoRow label="Planned entry" value={entry.plannedEntryPrice} />
                      <InfoRow label="Planned exit" value={entry.plannedExitPrice} />
                      <InfoRow label="Stop loss" value={entry.plannedStopLoss} />
                      <InfoRow label="Take profit" value={entry.plannedTakeProfit} />
                      <InfoRow label="Risk reward" value={entry.plannedRiskReward} />
                    </div>
                    <InfoRow label="Notes" value={entry.plannedNotes} />
                  </section>
                ) : null}

                {(entry.actualOutcome ||
                  entry.actualPnl ||
                  entry.actualPips ||
                  entry.postTradeAnalysis ||
                  entry.lessonsLearned) ? (
                  <section className="space-y-4">
                    <h2 className="text-base font-semibold text-white">Post-trade review</h2>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      <InfoRow label="Outcome" value={entry.actualOutcome} />
                      <InfoRow label="Actual P&L" value={entry.actualPnl} />
                      <InfoRow label="Actual pips" value={entry.actualPips} />
                    </div>
                    <InfoRow label="Post-trade analysis" value={entry.postTradeAnalysis} />
                    <InfoRow label="Lessons learned" value={entry.lessonsLearned} />
                  </section>
                ) : null}
              </>
            ) : (
              <div className="py-12 text-center text-sm text-white/38">
                No trade idea or post-trade review for this entry.
              </div>
            )}
          </TabsContent>

          <TabsContent value="psychology" className="mt-0">
            {hasPsychology ? (
              <PsychologySummary psychology={entry.psychology!} />
            ) : (
              <div className="py-12 text-center text-sm text-white/38">
                No psychology snapshot recorded for this entry.
              </div>
            )}
          </TabsContent>

          <TabsContent value="media" className="mt-0">
            {(() => {
              const mediaBlocks = entry.content.filter(
                (b) => b.type === "image" || b.type === "video"
              );
              if (mediaBlocks.length === 0) {
                return (
                  <div className="py-12 text-center text-sm text-white/38">
                    No media attachments in this entry.
                  </div>
                );
              }
              return (
                <div className="grid gap-4 sm:grid-cols-2">
                  {mediaBlocks.map((block) =>
                    block.type === "image" && block.props?.imageUrl ? (
                      <figure key={block.id} className="space-y-2">
                        <img
                          src={block.props.imageUrl}
                          alt={block.props.imageAlt || ""}
                          className="w-full rounded-md border border-white/10 object-cover"
                        />
                        {block.props.imageCaption ? (
                          <figcaption className="text-xs text-white/42">
                            {block.props.imageCaption}
                          </figcaption>
                        ) : null}
                      </figure>
                    ) : block.type === "video" && block.props?.videoUrl ? (
                      <figure key={block.id} className="space-y-2">
                        <video
                          controls
                          poster={block.props.videoThumbnail}
                          className="w-full rounded-md border border-white/10 bg-black/30"
                        >
                          <source src={block.props.videoUrl} />
                        </video>
                        {block.props.videoCaption ? (
                          <figcaption className="text-xs text-white/42">
                            {block.props.videoCaption}
                          </figcaption>
                        ) : null}
                      </figure>
                    ) : null
                  )}
                </div>
              );
            })()}
          </TabsContent>
        </Tabs>
      </div>
    </article>
  );
}
