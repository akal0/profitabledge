"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { EntryCoverPattern } from "@/components/journal/list/entry-cover-pattern";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type LibraryEdgeCard = {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  coverImageUrl?: string | null;
  coverImagePosition?: number | null;
  publicationMode?: string | null;
  publicStatsVisible?: boolean | null;
  isFeatured?: boolean | null;
  metrics?: {
    tradeCount?: number | null;
    winRate?: number | null;
    expectancy?: number | null;
    netPnl?: number | null;
  } | null;
  owner?: {
    id: string;
    name: string;
    displayName?: string | null;
    username?: string | null;
    image?: string | null;
  } | null;
};

function formatPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "0%";
  return `${(value * 100).toFixed(1)}%`;
}

function formatMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatR(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "0R";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}R`;
}

function getOwnerName(edge: LibraryEdgeCard) {
  return edge.owner?.displayName || edge.owner?.name || "Trader";
}

function getOwnerFallback(edge: LibraryEdgeCard) {
  return getOwnerName(edge)
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function EdgeLibraryCard({
  edge,
  edgeHref,
  libraryHref,
  className,
}: {
  edge: LibraryEdgeCard;
  edgeHref: string;
  libraryHref?: string;
  className?: string;
}) {
  const router = useRouter();
  const ownerRow = (
    <div className="flex items-center gap-2">
      <Avatar className="size-7 border border-white/10">
        {edge.owner?.image ? (
          <AvatarImage alt={getOwnerName(edge)} src={edge.owner.image} />
        ) : null}
        <AvatarFallback className="bg-sidebar-accent text-[10px] font-semibold text-white/80">
          {getOwnerFallback(edge)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-white/72">
          {getOwnerName(edge)}
        </p>
        <p className="truncate text-xs text-white/38">
          {edge.owner?.username ? `@${edge.owner.username}` : "Published library"}
        </p>
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        "group flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-md border border-white/5 bg-sidebar transition-colors hover:border-white/10",
        className
      )}
      onClick={() => router.push(edgeHref)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          router.push(edgeHref);
        }
      }}
      role="link"
      tabIndex={0}
    >
      <div className="relative">
        {edge.coverImageUrl ? (
          <div className="h-24 overflow-hidden bg-sidebar-accent">
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
          <>
            <EntryCoverPattern
              entryType="edge"
              title={edge.name}
              className="h-24"
            />
            {edge.color ? (
              <div
                className="pointer-events-none absolute inset-0 opacity-20"
                style={{
                  background: `linear-gradient(135deg, ${edge.color}, transparent 72%)`,
                }}
              />
            ) : null}
          </>
        )}
      </div>

      <div className="flex h-full flex-1 flex-col p-4">
        {libraryHref ? (
          <Link
            href={libraryHref}
            className="inline-flex max-w-full rounded-sm transition-opacity hover:opacity-100"
            onClick={(event) => event.stopPropagation()}
          >
            {ownerRow}
          </Link>
        ) : (
          ownerRow
        )}

        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-medium text-white">{edge.name}</h3>
            {edge.description ? (
              <p className="mt-1 line-clamp-2 text-xs text-white/40">
                {edge.description}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            {edge.isFeatured ? (
              <Badge
                variant="outline"
                className="border-teal-400/25 bg-teal-400/10 text-xs text-teal-200"
              >
                Featured
              </Badge>
            ) : null}
            <Badge
              variant="outline"
              className="border-white/10 text-xs text-white/45"
            >
              {edge.isFeatured
                ? "Featured Edge"
                : edge.publicationMode === "library"
                  ? "Library Edge"
                  : "Edge"}
            </Badge>
          </div>
        </div>

        <div className="mt-4 flex flex-1 flex-wrap content-start gap-2">
          {edge.metrics ? (
            <>
              <Badge
                variant="secondary"
                className="border-white/10 bg-white/5 text-white/70"
              >
                {formatPercent(edge.metrics?.winRate)} win rate
              </Badge>
              <Badge
                variant="secondary"
                className="border-white/10 bg-white/5 text-white/70"
              >
                {edge.metrics?.tradeCount ?? 0} trades
              </Badge>
              <Badge
                variant="secondary"
                className="border-white/10 bg-white/5 text-white/70"
              >
                {formatR(edge.metrics?.expectancy)}
              </Badge>
              <Badge
                variant="secondary"
                className="border-white/10 bg-white/5 text-white/70"
              >
                {formatMoney(edge.metrics?.netPnl)}
              </Badge>
            </>
          ) : (
            <Badge
              variant="secondary"
              className="border-white/10 bg-white/5 text-white/70"
            >
              Stats hidden
            </Badge>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/5 pt-3">
          {libraryHref ? (
            <Link
              href={libraryHref}
              className="text-xs font-medium text-white/55 transition-colors hover:text-white/85"
              onClick={(event) => event.stopPropagation()}
            >
              View library
            </Link>
          ) : (
            <span className="text-xs text-white/30">
              {edge.isFeatured
                ? "Featured Edge"
                : edge.publicationMode === "library"
                  ? "Library Edge"
                  : "Shared Edge"}
            </span>
          )}

          <Link
            href={edgeHref}
            className="inline-flex items-center gap-1 text-xs font-medium text-teal-300 transition-colors hover:text-teal-200"
            onClick={(event) => event.stopPropagation()}
          >
            Open Edge
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
