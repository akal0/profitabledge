"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, BarChart2, ExternalLink, PlayCircle } from "lucide-react";
import { format } from "date-fns";

import { PsychologySummary } from "@/components/journal/psychology-tracker";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { JournalBlock } from "@/components/journal/types";
import { cn } from "@/lib/utils";

function renderHtml(content: string) {
  return { __html: content };
}

function BlockBody({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div
      className={cn(className, "[&_a]:text-teal-300 [&_a]:underline")}
      dangerouslySetInnerHTML={renderHtml(content)}
    />
  );
}

function SharedTradeCard({ block }: { block: JournalBlock }) {
  const p = block.props ?? {};
  const isLong = p.tradeDirection === "long";
  const profit = p.profit ?? 0;
  const isWin = profit > 0;
  const isBE = Math.abs(profit) < 1;

  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isLong ? (
            <ArrowUpRight className="size-4 text-teal-400" />
          ) : (
            <ArrowDownRight className="size-4 text-rose-400" />
          )}
          <span className="text-sm font-medium text-white">{p.symbol || "Trade"}</span>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] border-white/10",
              isLong ? "text-teal-300" : "text-rose-300"
            )}
          >
            {p.tradeDirection || "unknown"}
          </Badge>
        </div>
        {p.outcome ? (
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] border-white/10",
              p.outcome === "win"
                ? "text-teal-300"
                : p.outcome === "loss"
                ? "text-rose-300"
                : "text-white/50"
            )}
          >
            {p.outcome}
          </Badge>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-sm">
        {profit !== 0 || p.profit !== undefined ? (
          <span
            className={cn(
              "font-medium",
              isWin ? "text-teal-400" : isBE ? "text-white/60" : "text-rose-400"
            )}
          >
            {isWin ? "+" : ""}
            {profit.toFixed(2)}
          </span>
        ) : null}
        {p.pips != null ? (
          <span className="text-white/50">
            {(p.pips as number) > 0 ? "+" : ""}
            {(p.pips as number).toFixed(1)} pips
          </span>
        ) : null}
        {p.closeTime ? (
          <span className="text-white/40 text-xs">
            {format(new Date(p.closeTime), "MMM d, yyyy HH:mm")}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function SharedChartPlaceholder({ chartType }: { chartType?: string }) {
  const label = chartType
    ? chartType.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Chart";
  return (
    <div className="flex items-center gap-3 rounded-md border border-white/8 bg-white/[0.02] px-4 py-3 text-white/40">
      <BarChart2 className="size-4 shrink-0" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

function ChecklistBlock({ content }: { content: string }) {
  return (
    <div
      className="[&_input]:pointer-events-none [&_input]:accent-teal-400 [&_label]:mr-2 [&_li]:mb-2 [&_ul]:list-none [&_ul]:pl-0"
      dangerouslySetInnerHTML={renderHtml(content)}
    />
  );
}

function TableBlock({ content }: { content: string }) {
  return (
    <div className="overflow-x-auto rounded-md border border-white/10">
      <table className="min-w-full text-sm text-white/80">
        <tbody dangerouslySetInnerHTML={renderHtml(content)} />
      </table>
    </div>
  );
}

export function JournalShareBlockRenderer({
  blocks,
  className,
}: {
  blocks: JournalBlock[];
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {blocks.map((block) => {
        switch (block.type) {
          case "heading1":
            return (
              <BlockBody
                key={block.id}
                content={block.content}
                className="text-3xl font-semibold tracking-[-0.04em] text-white"
              />
            );
          case "heading2":
            return (
              <BlockBody
                key={block.id}
                content={block.content}
                className="text-2xl font-semibold tracking-[-0.03em] text-white"
              />
            );
          case "heading3":
            return (
              <BlockBody
                key={block.id}
                content={block.content}
                className="text-lg font-semibold text-white"
              />
            );
          case "bulletList":
            return (
              <BlockBody
                key={block.id}
                content={block.content.includes("<li")
                  ? block.content
                  : `<ul class="list-disc pl-5"><li>${block.content}</li></ul>`}
                className="text-sm leading-7 text-white/82 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_li]:marker:text-white/30"
              />
            );
          case "numberedList":
            return (
              <BlockBody
                key={block.id}
                content={block.content.includes("<li")
                  ? block.content
                  : `<ol class="list-decimal pl-5"><li>${block.content}</li></ol>`}
                className="text-sm leading-7 text-white/82 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_li]:marker:text-white/30"
              />
            );
          case "checkList":
            return <ChecklistBlock key={block.id} content={block.content} />;
          case "quote":
            return (
              <blockquote
                key={block.id}
                className="border-l-2 border-teal-400/35 pl-4 text-sm italic leading-7 text-white/72"
              >
                <BlockBody content={block.content} />
              </blockquote>
            );
          case "callout":
            return (
              <div
                key={block.id}
                className="rounded-md border border-white/10 bg-white/[0.03] px-4 py-3"
              >
                <div className="mb-2 text-sm text-white/65">
                  {block.props?.calloutEmoji || "💡"}
                </div>
                <BlockBody
                  content={block.content}
                  className="text-sm leading-7 text-white/82"
                />
              </div>
            );
          case "divider":
            return <Separator key={block.id} className="bg-white/10" />;
          case "code":
            return (
              <pre
                key={block.id}
                className="overflow-x-auto rounded-md border border-white/10 bg-black/30 p-4 text-xs text-white/78"
              >
                <code>{block.content}</code>
              </pre>
            );
          case "table":
            return <TableBlock key={block.id} content={block.content} />;
          case "image":
            return (
              <figure key={block.id} className="space-y-3">
                {block.props?.imageUrl ? (
                  <img
                    src={block.props.imageUrl}
                    alt={block.props.imageAlt || ""}
                    className="w-full rounded-md border border-white/10 object-cover"
                  />
                ) : null}
                {block.props?.imageCaption ? (
                  <figcaption className="text-xs text-white/42">
                    {block.props.imageCaption}
                  </figcaption>
                ) : null}
              </figure>
            );
          case "video":
            return (
              <figure key={block.id} className="space-y-3">
                {block.props?.videoUrl ? (
                  <video
                    controls
                    poster={block.props.videoThumbnail}
                    className="w-full rounded-md border border-white/10 bg-black/30"
                  >
                    <source src={block.props.videoUrl} />
                  </video>
                ) : (
                  <div className="flex h-48 items-center justify-center rounded-md border border-white/10 bg-black/30 text-white/40">
                    <PlayCircle className="size-8" />
                  </div>
                )}
                {block.props?.videoCaption ? (
                  <figcaption className="text-xs text-white/42">
                    {block.props.videoCaption}
                  </figcaption>
                ) : null}
              </figure>
            );
          case "embed":
            return (
              <div
                key={block.id}
                className="rounded-md border border-white/10 bg-white/[0.03] px-4 py-3"
              >
                <div className="text-xs uppercase tracking-[0.16em] text-white/30">
                  Embedded link
                </div>
                {block.props?.embedUrl ? (
                  <Link
                    href={block.props.embedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-2 text-sm text-teal-300 hover:text-teal-200"
                  >
                    <span className="truncate">{block.props.embedUrl}</span>
                    <ExternalLink className="size-4 shrink-0" />
                  </Link>
                ) : null}
              </div>
            );
          case "psychology":
            return block.props?.psychologyData ? (
              <PsychologySummary
                key={block.id}
                psychology={block.props.psychologyData}
              />
            ) : null;
          case "chart":
            return (
              <SharedChartPlaceholder
                key={block.id}
                chartType={block.props?.chartConfig ? String(block.props.chartType ?? "") : block.props?.chartType ? String(block.props.chartType) : undefined}
              />
            );
          case "trade":
            return <SharedTradeCard key={block.id} block={block} />;
          case "tradeComparison":
            return block.props?.trades && (block.props.trades as any[]).length > 0 ? (
              <div key={block.id} className="space-y-2">
                {(block.props.trades as any[]).map((t: any, i: number) => (
                  <SharedTradeCard
                    key={t.id || i}
                    block={{ ...block, props: { ...block.props, symbol: t.symbol, tradeDirection: t.tradeDirection, profit: t.profit, pips: t.pips, outcome: t.outcome, closeTime: t.close } }}
                  />
                ))}
              </div>
            ) : null;
          case "statCard":
            return (
              <SharedChartPlaceholder
                key={block.id}
                chartType={block.props?.statType ? String(block.props.statType) : "Stat card"}
              />
            );
          case "paragraph":
          default:
            return (
              <BlockBody
                key={block.id}
                content={block.content}
                className="text-sm leading-7 text-white/82"
              />
            );
        }
      })}
    </div>
  );
}
