"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import type {
  PropFirmLike,
  RuleWatchItem,
  SurvivalState,
} from "../lib/prop-tracker-detail";
import {
  FTMO_IMAGE_SRC,
  GOALS_PANEL_BODY_CLASS,
  GOALS_SURFACE_INNER_CLASS,
  GOALS_SURFACE_OUTER_CLASS,
  HEADER_BADGE_CLASS,
  PANEL_ROW_PADDING_CLASS,
  isFtmoFirm,
} from "../lib/prop-tracker-detail";

type PropTrackerAlert = {
  id: string;
  severity: "critical" | "warning" | "info" | string;
  message: string;
  createdAt: string | Date;
};

export function PropFirmAvatar({
  firm,
  className,
}: {
  firm?: PropFirmLike | null;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-sm border border-white/10 bg-white/[0.04]",
        className
      )}
    >
      {isFtmoFirm(firm) ? (
        <Image
          src={FTMO_IMAGE_SRC}
          alt="FTMO"
          fill
          sizes="64px"
          className="object-contain p-2"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Trophy className="size-5 text-white/55" />
        </div>
      )}
    </div>
  );
}

export function OverviewPanel({
  icon: Icon,
  title,
  description,
  badge,
  bodyClassName,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  badge?: ReactNode;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className={GOALS_SURFACE_OUTER_CLASS}>
      <div className={cn(GOALS_SURFACE_INNER_CLASS, "h-full")}>
        <div className="flex items-start justify-between gap-4 px-4 py-4 sm:px-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-sm border border-white/5 bg-sidebar p-2">
              <Icon className="h-4 w-4 text-white/60" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">{title}</h2>
              <p className="mt-0.5 text-xs text-white/40">{description}</p>
            </div>
          </div>
          {badge ? <div className="shrink-0">{badge}</div> : null}
        </div>
        <Separator />
        <div
          className={cn(
            "flex-1 overflow-hidden",
            GOALS_PANEL_BODY_CLASS,
            bodyClassName
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function ColumnMetric({
  label,
  value,
  hint,
  valueClassName,
}: {
  label: string;
  value: string;
  hint: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-2 text-center md:py-5">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/30">
        {label}
      </p>
      <p
        className={cn("mt-2 text-xl font-semibold text-white", valueClassName)}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-white/40">{hint}</p>
    </div>
  );
}

export function PassedMetricCheck() {
  return (
    <div className="mt-2 flex flex-col items-center">
      <div className="flex size-9 items-center justify-center rounded-full border-2 border-emerald-400 bg-emerald-400/10">
        <CheckCircle2 className="size-4 text-emerald-400" />
      </div>
      <p className="mt-1 text-[9px] text-emerald-400/70">Passed</p>
    </div>
  );
}

export function RuleWatchMetric({
  label,
  current,
  hint,
  status,
  currentClassName,
  completed = false,
}: RuleWatchItem) {
  const statusClassName =
    status === "danger"
      ? "text-rose-300"
      : status === "warning"
        ? "text-amber-300"
        : "text-teal-300";

  return (
    <div className="flex flex-1 flex-col items-center justify-center py-2 text-center md:py-5">
      <p className="text-[11px] uppercase tracking-[0.16em] text-white/35">
        {label}
      </p>
      {completed ? (
        <PassedMetricCheck />
      ) : (
        <p
          className={cn(
            "mt-2 text-xl font-semibold",
            currentClassName ?? statusClassName
          )}
        >
          {current}
        </p>
      )}
      <p className="mt-1 text-xs text-white/40">{hint}</p>
    </div>
  );
}

export function NextActionRow({
  text,
  survivalState,
}: {
  text: string;
  survivalState: SurvivalState;
}) {
  const toneClassName =
    survivalState === "critical"
      ? "bg-rose-400"
      : survivalState === "fragile"
        ? "bg-amber-300"
        : survivalState === "tight"
          ? "bg-yellow-300"
          : "bg-teal-400";

  const toneLabel =
    survivalState === "critical"
      ? "Critical"
      : survivalState === "fragile"
        ? "Fragile"
        : survivalState === "tight"
          ? "Tight"
          : "Stable";

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 transition-colors hover:bg-sidebar",
        PANEL_ROW_PADDING_CLASS
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className={cn("size-1.5 rounded-full", toneClassName)} />
          <p className="text-xs font-medium text-white">{toneLabel}</p>
        </div>
        <p className="mt-1 pl-4 text-xs leading-relaxed text-white/65">
          {text}
        </p>
      </div>
    </div>
  );
}

export function AlertRow({ alert }: { alert: PropTrackerAlert }) {
  const icon =
    alert.severity === "critical" ? (
      <AlertCircle className="size-3.5 text-rose-400" />
    ) : alert.severity === "warning" ? (
      <AlertTriangle className="size-3.5 text-amber-300" />
    ) : (
      <Trophy className="size-3.5 text-blue-400" />
    );

  const badgeClassName =
    alert.severity === "critical"
      ? "border-rose-500/30 bg-rose-500/15 text-rose-300"
      : alert.severity === "warning"
        ? "border-amber-500/30 bg-amber-500/15 text-amber-300"
        : "border-blue-500/30 bg-blue-500/15 text-blue-300";

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 transition-colors hover:bg-sidebar",
        PANEL_ROW_PADDING_CLASS
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="pt-0.5">{icon}</div>
        <div className="min-w-0">
          <p className="text-xs font-medium leading-relaxed text-white/80">
            {alert.message}
          </p>
          <p className="mt-1 text-[10px] text-white/35">
            {new Date(alert.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>
      <Badge
        variant="outline"
        className={cn(HEADER_BADGE_CLASS, badgeClassName)}
      >
        {alert.severity}
      </Badge>
    </div>
  );
}

export function PropTrackerLoadingState() {
  return (
    <main className="space-y-6 p-6 py-4">
      <div className="flex items-center gap-3">
        <div className="h-8 w-20 animate-pulse rounded-sm border border-white/5 bg-sidebar" />
        <div className="space-y-2">
          <div className="h-3 w-24 animate-pulse rounded-sm bg-sidebar" />
          <div className="h-6 w-44 animate-pulse rounded-sm bg-sidebar" />
        </div>
      </div>

      <div className="rounded-sm border border-white/5 bg-sidebar p-1.5">
        <div className="h-64 animate-pulse rounded-sm bg-sidebar-accent" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((key) => (
          <div
            key={key}
            className="rounded-sm border border-white/5 bg-sidebar p-1.5"
          >
            <div className="h-28 animate-pulse rounded-sm bg-sidebar-accent" />
          </div>
        ))}
      </div>
    </main>
  );
}

export function PropTrackerNotFoundState() {
  return (
    <main className="space-y-6 p-6 py-4">
      <div className={GOALS_SURFACE_OUTER_CLASS}>
        <div
          className={cn(
            GOALS_SURFACE_INNER_CLASS,
            "min-h-[320px] items-center justify-center px-8 py-10 text-center"
          )}
        >
          <AlertCircle className="mb-4 size-10 text-white/20" />
          <h2 className="text-lg font-semibold text-white">
            Prop account not found
          </h2>
          <p className="mt-2 max-w-md text-sm text-white/40">
            This account is unavailable or is no longer marked as a prop
            account.
          </p>
          <Link href="/dashboard/prop-tracker" className="mt-6">
            <Button className="h-9 rounded-sm border border-white/5 bg-sidebar px-4 text-xs text-white hover:bg-sidebar-accent hover:brightness-110">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Back to tracker
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
