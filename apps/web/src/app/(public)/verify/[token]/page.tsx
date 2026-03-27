"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import type { AppRouter } from "@profitabledge/contracts/trpc";
import type { inferRouterOutputs } from "@trpc/server";
import {
  AlertTriangle,
  ExternalLink,
  Lock,
} from "lucide-react";

import {
  GoalContentSeparator,
  GoalSurface,
} from "@/components/goals/goal-surface";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import { Widgets } from "@/components/dashboard/widgets";
import {
  ChartWidgets,
  chartWidgetCardComponents,
  type ChartWidgetType,
} from "@/components/dashboard/chart-widgets";
import { getPropAssignActionButtonClassName } from "@/features/accounts/lib/prop-assign-action-button";
import DashboardCalendar from "@/features/dashboard/calendar/components/dashboard-calendar";
import type { CalendarWidgetType, ViewMode } from "@/features/dashboard/calendar/lib/calendar-types";
import { dashboardWidgetCardComponents } from "@/features/dashboard/widgets/lib/widget-card-registry";
import type { WidgetType } from "@/features/dashboard/widgets/lib/widget-config";
import type { WidgetValueMode } from "@/features/dashboard/widgets/lib/widget-shared";
import { inferWidgetVerificationSurface } from "@/features/dashboard/widgets/lib/widget-verification-surface";
import { AffiliateNameEffectText } from "@/features/public-proof/components/affiliate-name-effect-text";
import {
  getAffiliatePfpEffectClassName,
  getAffiliatePfpEffectStyle,
  getAffiliatePfpWrapperClassName,
  getCustomPfpAnimationClassName,
} from "@/features/public-proof/lib/public-proof-badges";
import { cn } from "@/lib/utils";
import { useDateRangeStore } from "@/stores/date-range";
import { trpc } from "@/utils/trpc";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type VerificationRecord = RouterOutputs["verification"]["resolve"];
type ProofVerificationRecord = Extract<VerificationRecord, { kind: "proof" }>;
type WidgetVerificationRecord = Extract<VerificationRecord, { kind: "widget" }>;
type CardVerificationRecord = Extract<VerificationRecord, { kind: "card" }>;
type EdgeVerificationRecord = Extract<VerificationRecord, { kind: "edge" }>;
const FULL_BLEED_SEPARATOR_CLASS = "-mx-5 my-4 w-[calc(100%+2.5rem)]";

function formatIssuedAt(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function formatCurrency(value?: number | null, currencyCode?: string | null) {
  if (value == null || Number.isNaN(value)) return "—";
  const resolvedCurrency =
    typeof currencyCode === "string" && /^[A-Z]{3}$/.test(currencyCode)
      ? currencyCode
      : "USD";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: resolvedCurrency,
    maximumFractionDigits: 2,
  }).format(value);
}

function getStatusMeta(status: VerificationRecord["status"]) {
  switch (status) {
    case "active":
      return {
        label: "Active",
        className: "ring-teal-500/25 bg-teal-500/15 text-teal-300",
      };
    case "revoked":
      return {
        label: "Revoked",
        className: "ring-amber-500/25 bg-amber-500/15 text-amber-200",
      };
    case "expired":
      return {
        label: "Expired",
        className: "ring-amber-500/25 bg-amber-500/15 text-amber-200",
      };
    case "private":
      return {
        label: "Private",
        className: "ring-sky-500/25 bg-sky-500/15 text-sky-300",
      };
    default:
      return {
        label: "Unavailable",
        className: "ring-white/10 bg-white/5 text-white/60",
      };
  }
}

function FullBleedSeparator() {
  return <GoalContentSeparator className={FULL_BLEED_SEPARATOR_CLASS} />;
}

function VerificationOverview({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <GoalSurface className="h-full w-full">
      <div className="flex h-full flex-col p-4">
        <p className="text-xs text-white/50">{label}</p>
        <GoalContentSeparator className="mb-3 mt-3" />
        <p className="break-words text-base font-semibold text-white">{value}</p>
      </div>
    </GoalSurface>
  );
}

function LegacyWidgetPreview({
  title,
  imageUrl,
}: {
  title: string;
  imageUrl?: string | null;
}) {
  if (imageUrl) {
    return (
      <div className="w-full overflow-hidden rounded-sm">
        <img
          src={imageUrl}
          alt={title}
          className="h-auto w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div className="w-full rounded-sm border border-white/10 bg-white/[0.03] px-4 py-10 text-center text-sm text-white/50">
      Shared widget preview unavailable for this verification record.
    </div>
  );
}

type WidgetSurface = NonNullable<WidgetVerificationRecord["resource"]["surface"]>;
const VERIFIED_WIDGET_SURFACE_CLASS =
  "w-full min-w-0 [&_[data-widget-share-ignore]]:hidden";

function resolveRenderableWidgetSurface(
  resource: WidgetVerificationRecord["resource"]
) {
  if (resource.surface) {
    return resource.surface;
  }

  if (!resource.accountId) {
    return null;
  }

  return inferWidgetVerificationSurface({
    title: resource.title,
  });
}

function VerifiedSingleDashboardWidgetPreview({
  accountId,
  surface,
}: {
  accountId: string;
  surface: Extract<
    NonNullable<ReturnType<typeof resolveRenderableWidgetSurface>>,
    { kind: "dashboard" }
  >;
}) {
  const widgetType = surface.widgets[0] as WidgetType | undefined;
  if (!widgetType) {
    return null;
  }

  const CardComponent = dashboardWidgetCardComponents[widgetType];
  if (!CardComponent) {
    return null;
  }

  return (
    <div className={VERIFIED_WIDGET_SURFACE_CLASS}>
      <CardComponent
        accountId={accountId}
        className="h-full w-full"
        valueMode={(surface.valueMode ?? "usd") as WidgetValueMode}
        currencyCode={surface.currencyCode ?? undefined}
      />
    </div>
  );
}

function VerifiedSingleChartWidgetPreview({
  accountId,
  surface,
}: {
  accountId: string;
  surface: Extract<
    NonNullable<ReturnType<typeof resolveRenderableWidgetSurface>>,
    { kind: "chart" }
  >;
}) {
  const start = useDateRangeStore((state) => state.start);
  const end = useDateRangeStore((state) => state.end);
  const min = useDateRangeStore((state) => state.min);
  const max = useDateRangeStore((state) => state.max);
  const setRange = useDateRangeStore((state) => state.setRange);
  const setBounds = useDateRangeStore((state) => state.setBounds);
  const widgetType = surface.widgets[0] as ChartWidgetType | undefined;

  useEffect(() => {
    const previous = { start, end, min, max };
    const nextStart = surface.start ? new Date(surface.start) : null;
    const nextEnd = surface.end ? new Date(surface.end) : null;

    if (nextStart && nextEnd) {
      setBounds(nextStart, nextEnd);
      setRange(nextStart, nextEnd);
    }

    return () => {
      if (previous.min && previous.max) {
        setBounds(previous.min, previous.max);
      }
      if (previous.start && previous.end) {
        setRange(previous.start, previous.end);
      }
    };
  }, [end, max, min, setBounds, setRange, start, surface.end, surface.start]);

  if (!widgetType) {
    return null;
  }

  const CardComponent = chartWidgetCardComponents[widgetType];
  if (!CardComponent) {
    return null;
  }

  return (
    <div className={VERIFIED_WIDGET_SURFACE_CLASS}>
      <CardComponent
        accountId={accountId}
        className="h-full w-full"
        hideComparison
      />
    </div>
  );
}

function VerifiedChartWidgetsPreview({
  accountId,
  surface,
}: {
  accountId: string;
  surface: Extract<WidgetSurface, { kind: "chart" }>;
}) {
  const start = useDateRangeStore((state) => state.start);
  const end = useDateRangeStore((state) => state.end);
  const min = useDateRangeStore((state) => state.min);
  const max = useDateRangeStore((state) => state.max);
  const setRange = useDateRangeStore((state) => state.setRange);
  const setBounds = useDateRangeStore((state) => state.setBounds);

  useEffect(() => {
    const previous = { start, end, min, max };
    const nextStart = surface.start ? new Date(surface.start) : null;
    const nextEnd = surface.end ? new Date(surface.end) : null;

    if (nextStart && nextEnd) {
      setBounds(nextStart, nextEnd);
      setRange(nextStart, nextEnd);
    }

    return () => {
      if (previous.min && previous.max) {
        setBounds(previous.min, previous.max);
      }
      if (previous.start && previous.end) {
        setRange(previous.start, previous.end);
      }
    };
  }, [end, max, min, setBounds, setRange, start, surface.end, surface.start]);

  return (
    <div className={VERIFIED_WIDGET_SURFACE_CLASS}>
      <ChartWidgets
        enabledWidgets={surface.widgets as ChartWidgetType[]}
        accountId={accountId}
        showPresets={false}
        showShareButton={false}
        showEditButton={false}
      />
    </div>
  );
}

function ActualWidgetSurfacePreview({
  resource,
}: {
  resource: WidgetVerificationRecord["resource"];
}) {
  const surface = resolveRenderableWidgetSurface(resource);

  if (!resource.accountId || !surface) {
    return (
      <LegacyWidgetPreview
        title={resource.title}
        imageUrl={resource.imageUrl}
      />
    );
  }

  if (surface.kind === "calendar") {
    const initialRange =
      surface.start && surface.end
        ? {
            start: new Date(surface.start),
            end: new Date(surface.end),
          }
        : null;

    return (
      <div className="w-full min-w-0">
        <DashboardCalendar
          accountId={resource.accountId}
          initialRange={initialRange}
          initialViewMode={surface.viewMode as ViewMode}
          initialHeatmapEnabled={surface.heatmapEnabled ?? false}
          initialGoalOverlay={surface.goalOverlay ?? false}
          showPresets={false}
          showShareButton={false}
          readOnly
          summaryWidgets={surface.summaryWidgets as CalendarWidgetType[]}
          summaryWidgetSpans={
            surface.summaryWidgetSpans as Partial<Record<CalendarWidgetType, number>>
          }
        />
      </div>
    );
  }

  if (
    surface.kind === "dashboard" &&
    surface.widgets.length === 1 &&
    dashboardWidgetCardComponents[surface.widgets[0] as WidgetType]
  ) {
    return (
      <VerifiedSingleDashboardWidgetPreview
        accountId={resource.accountId}
        surface={surface}
      />
    );
  }

  if (surface.kind === "dashboard") {
    return (
      <div className="w-full min-w-0">
        <Widgets
          enabledWidgets={surface.widgets as WidgetType[]}
          accountId={resource.accountId}
          valueMode={(surface.valueMode ?? "usd") as WidgetValueMode}
          currencyCode={surface.currencyCode ?? undefined}
          widgetSpans={
            surface.widgetSpans as Partial<Record<WidgetType, number>>
          }
        />
      </div>
    );
  }

  if (
    surface.kind === "chart" &&
    surface.widgets.length === 1 &&
    chartWidgetCardComponents[surface.widgets[0] as ChartWidgetType]
  ) {
    return (
      <VerifiedSingleChartWidgetPreview
        accountId={resource.accountId}
        surface={surface}
      />
    );
  }

  if (surface.kind === "chart") {
    return (
      <div className="w-full min-w-0">
        <VerifiedChartWidgetsPreview
          accountId={resource.accountId}
          surface={surface}
        />
      </div>
    );
  }

  return (
    <LegacyWidgetPreview
      title={resource.title}
      imageUrl={resource.imageUrl}
    />
  );
}


function ProofVerificationPanel({ record }: { record: ProofVerificationRecord }) {
  const status = getStatusMeta(record.status);
  const resource = record.resource;
  const fallback = record.fallback;
  const path = resource?.path ?? fallback.path;
  const traderName = resource?.trader.name ?? fallback.username ?? "Trader";
  const traderUsername = resource?.trader.username ?? fallback.username ?? "trader";
  const traderInitial = traderName.charAt(0)?.toUpperCase() || "T";

  return (
    <div className="space-y-4">
      <GoalSurface innerClassName="overflow-hidden">
        <div className="overflow-hidden">
          <div className="relative h-40 bg-sidebar-accent md:h-48">
            {resource?.trader.profileBannerUrl ? (
              <img
                src={resource.trader.profileBannerUrl}
                alt={traderName}
                className="absolute inset-0 h-full w-full object-cover"
                style={{
                  objectPosition:
                    resource.trader.profileBannerPosition ?? "50% 50%",
                }}
              />
            ) : null}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(18,209,185,0.12),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(10,14,20,0.48))]" />
          </div>

          <div className="px-5 pb-5">
            <div className="-mt-10 flex flex-col gap-4">
              <Avatar className="size-20 rounded-full ring-4 ring-sidebar shadow-2xl">
                {resource?.trader.image ? (
                  <AvatarImage
                    src={resource.trader.image}
                    alt={traderName}
                    className="object-cover"
                  />
                ) : null}
                <AvatarFallback className="bg-sidebar-accent text-xl font-semibold text-white">
                  {traderInitial}
                </AvatarFallback>
              </Avatar>

              <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <div className="min-w-0 space-y-2">
                  <p className="text-xs text-teal-300/80">
                    @{traderUsername}&apos;s public proof page
                  </p>
                  <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                    Verified trading record
                  </h1>
                </div>

                <Badge
                  className={cn(
                    "w-max rounded-md ring-1 text-[11px]",
                    status.className
                  )}
                >
                  {status.label}
                </Badge>
              </div>
            </div>

            <FullBleedSeparator />

            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-md ring-1 ring-white/10 bg-white/5 text-[11px] text-white/72">
                {resource?.proof.connectionLabel ?? "Unavailable"}
              </Badge>
              <Badge className="rounded-md ring-1 ring-white/10 bg-white/5 text-[11px] text-white/72">
                {resource?.proof.verificationLabel ?? "Unavailable"}
              </Badge>
              <Badge className="rounded-md ring-1 ring-white/10 bg-white/5 text-[11px] text-white/60">
                {resource?.trust.sourceBadges.length ?? 0} source
                {(resource?.trust.sourceBadges.length ?? 0) === 1 ? "" : "s"}
              </Badge>
            </div>

            {resource?.path ? (
              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href={resource.path}
                  className={getPropAssignActionButtonClassName({
                    tone: "teal",
                    className: "inline-flex items-center gap-2",
                  })}
                >
                  Open proof page
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </GoalSurface>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <VerificationOverview
          label="Account baseline"
          value={formatCurrency(resource?.summary.initialBalance)}
        />
        <VerificationOverview
          label="Net P&L"
          value={formatCurrency(resource?.summary.totalPnl)}
        />
        <VerificationOverview
          label="Floating P&L"
          value={formatCurrency(resource?.summary.floatingPnl)}
        />
        <VerificationOverview
          label="Win rate"
          value={
            resource?.summary.winRate != null
              ? `${resource.summary.winRate.toFixed(1)}%`
              : "—"
          }
        />
        <VerificationOverview
          label="Total trades"
          value={resource?.summary.totalTrades?.toLocaleString() ?? "—"}
        />
        <VerificationOverview
          label="Open trades"
          value={resource?.summary.openTradesCount?.toLocaleString() ?? "—"}
        />
      </div>

      <GoalSurface innerClassName="overflow-hidden">
        <div className="p-5">
          <p className="text-sm text-white/34">Verification facts</p>
          <p className="mt-2 text-lg font-semibold text-white">
            Signed by Profitabledge
          </p>
          <p className="mt-2 text-xs leading-5 text-white/46">
            This record was resolved from a signed Profitabledge verification
            token. Viewers can confirm whether the linked proof page is still
            active and inspect its current trust state here.
          </p>

          <FullBleedSeparator />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <VerificationOverview
              label="Verification code"
              value={record.verificationCode}
            />
            <VerificationOverview
              label="Issued"
              value={formatIssuedAt(record.issuedAt)}
            />
            <VerificationOverview
              label="Link"
              value={path}
            />
            <VerificationOverview
              label="Profit factor"
              value={
                resource?.summary.profitFactor != null
                  ? resource.summary.profitFactor.toFixed(2)
                  : "—"
              }
            />
            <VerificationOverview
              label="Changed rows"
              value={resource?.trust.editedTradesCount?.toLocaleString() ?? "—"}
            />
          </div>

          <FullBleedSeparator />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <VerificationOverview
              label="Removed imported/synced"
              value={resource?.trust.removedTradesCount?.toLocaleString() ?? "—"}
            />
            <VerificationOverview
              label="Connection"
              value={resource?.proof.connectionLabel ?? "Unavailable"}
            />
            <VerificationOverview
              label="Verification"
              value={resource?.proof.verificationLabel ?? "Unavailable"}
            />
          </div>
        </div>
      </GoalSurface>
    </div>
  );
}

function WidgetVerificationPanel({
  record,
}: {
  record: WidgetVerificationRecord;
}) {
  const status = getStatusMeta(record.status);
  const resource = record.resource;
  const traderName = resource.trader.name || resource.trader.username || "Trader";
  const traderInitial = traderName.charAt(0)?.toUpperCase() || "T";
  const currencyCode = resource.summary.currencyCode;
  const profileEffects = resource.trader.profileEffects as
    | {
        pfpEffect?: string | null;
        nameEffect?: string | null;
        nameFont?: string | null;
        nameColor?: string | null;
        customGradientFrom?: string | null;
        customGradientTo?: string | null;
        customRingFrom?: string | null;
        customRingTo?: string | null;
        customRingEffect?: string | null;
      }
    | null;

  return (
    <div className="space-y-4">
      <GoalSurface innerClassName="overflow-hidden">
        <div className="overflow-hidden">
          <div className="relative h-40 bg-sidebar-accent md:h-48">
            {resource.trader.profileBannerUrl ? (
              <img
                src={resource.trader.profileBannerUrl}
                alt={traderName}
                className="absolute inset-0 h-full w-full object-cover"
                style={{
                  objectPosition:
                    resource.trader.profileBannerPosition ?? "50% 50%",
                }}
              />
            ) : null}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(18,209,185,0.12),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(10,14,20,0.48))]" />
          </div>

          <div className="px-5 pb-5">
            <div className="-mt-10 flex flex-col gap-4">
              {profileEffects?.pfpEffect &&
              profileEffects.pfpEffect !== "none" ? (
                <div
                  className={cn(
                    "inline-flex rounded-full",
                    getAffiliatePfpWrapperClassName(profileEffects.pfpEffect)
                  )}
                >
                  <Avatar
                    className={cn(
                      "size-20 rounded-full shadow-2xl",
                      getAffiliatePfpEffectClassName(profileEffects.pfpEffect),
                      profileEffects.pfpEffect === "custom" &&
                        getCustomPfpAnimationClassName(
                          profileEffects.customRingEffect
                        )
                    )}
                    style={
                      profileEffects.pfpEffect === "custom"
                        ? getAffiliatePfpEffectStyle("custom", {
                            from: profileEffects.customRingFrom ?? undefined,
                            to: profileEffects.customRingTo ?? undefined,
                          })
                        : undefined
                    }
                  >
                    {resource.trader.image ? (
                      <AvatarImage
                        src={resource.trader.image}
                        alt={traderName}
                        className="object-cover"
                      />
                    ) : null}
                    <AvatarFallback className="bg-sidebar-accent text-xl font-semibold text-white">
                      {traderInitial}
                    </AvatarFallback>
                  </Avatar>
                </div>
              ) : (
                <Avatar className="size-20 rounded-full ring-4 ring-sidebar shadow-2xl">
                  {resource.trader.image ? (
                    <AvatarImage
                      src={resource.trader.image}
                      alt={traderName}
                      className="object-cover"
                    />
                  ) : null}
                  <AvatarFallback className="bg-sidebar-accent text-xl font-semibold text-white">
                    {traderInitial}
                  </AvatarFallback>
                </Avatar>
              )}

              <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <div className="min-w-0 space-y-2">
                  <p className="text-xs">
                    <AffiliateNameEffectText
                      nameFont={profileEffects?.nameFont}
                      nameEffect={profileEffects?.nameEffect}
                      nameColor={profileEffects?.nameColor}
                      customGradient={
                        profileEffects?.nameColor === "custom"
                          ? {
                              from:
                                profileEffects.customGradientFrom ?? undefined,
                              to: profileEffects.customGradientTo ?? undefined,
                            }
                          : null
                      }
                      className={!profileEffects ? "text-teal-300/80" : undefined}
                    >
                      {resource.trader.username
                        ? `@${resource.trader.username}'s`
                        : `${traderName}'s`}
                    </AffiliateNameEffectText>{" "}
                    {resource.title.toLowerCase()}
                  </p>
                </div>

                <Badge
                  className={cn(
                    "w-max rounded-md ring-1 text-[11px]",
                    status.className
                  )}
                >
                  {status.label}
                </Badge>
              </div>
            </div>

            <FullBleedSeparator />

            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-md ring-1 ring-white/10 bg-white/5 text-[11px] text-white/72">
                Widget share
              </Badge>
              <Badge className="rounded-md ring-1 ring-white/10 bg-white/5 text-[11px] text-white/60">
                Signed by Profitabledge
              </Badge>
            </div>

          </div>
        </div>
      </GoalSurface>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-8">
        <VerificationOverview
          label="Account baseline"
          value={formatCurrency(resource.summary.initialBalance, currencyCode)}
        />
        <VerificationOverview
          label="Account balance"
          value={formatCurrency(resource.summary.accountBalance, currencyCode)}
        />
        <VerificationOverview
          label="Net P&L"
          value={formatCurrency(resource.summary.totalPnl, currencyCode)}
        />
        <VerificationOverview
          label="Floating P&L"
          value={formatCurrency(resource.summary.floatingPnl, currencyCode)}
        />
        <VerificationOverview
          label="Win rate"
          value={
            resource.summary.winRate != null
              ? `${resource.summary.winRate.toFixed(1)}%`
              : "—"
          }
        />
        <VerificationOverview
          label="Total trades"
          value={resource.summary.totalTrades?.toLocaleString() ?? "—"}
        />
        <VerificationOverview
          label="Open trades"
          value={resource.summary.openTradesCount?.toLocaleString() ?? "—"}
        />
        <VerificationOverview
          label="Profit factor"
          value={
            resource.summary.profitFactor != null
              ? resource.summary.profitFactor.toFixed(2)
              : "—"
          }
        />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <VerificationOverview
          label="Share type"
          value="Widget verification"
        />
        <VerificationOverview
          label="Verification code"
          value={record.verificationCode}
        />
        <VerificationOverview
          label="Issued"
          value={formatIssuedAt(record.issuedAt)}
        />
      </div>

      <ActualWidgetSurfacePreview resource={resource} />
    </div>
  );
}

function CardVerificationPanel({ record }: { record: CardVerificationRecord }) {
  const status = getStatusMeta(record.status);
  const resource = record.resource;
  const fallback = record.fallback;
  const snapshot = resource?.snapshot ?? fallback;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_360px]">
      <GoalSurface innerClassName="overflow-hidden">
        <div className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-teal-300/80">Shared card</p>
              <h1 className="mt-2 text-2xl font-semibold text-white md:text-3xl">
                {snapshot.symbol ?? "Trade performance card"}
              </h1>
              <p className="mt-2 text-sm text-white/48">
                {snapshot.tradeType ?? "Trade type unavailable"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                className={cn(
                  "rounded-md ring-1 text-[11px]",
                  status.className
                )}
              >
                {status.label}
              </Badge>
              {resource?.passwordProtected ? (
                <Badge className="rounded-md ring-1 ring-sky-500/25 bg-sky-500/15 text-[11px] text-sky-300">
                  <Lock className="mr-1 h-3 w-3" />
                  Password share
                </Badge>
              ) : null}
            </div>
          </div>

          <FullBleedSeparator />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <VerificationOverview
              label="Outcome"
              value={snapshot.outcome ?? "—"}
            />
            <VerificationOverview
              label="Profit"
              value={formatCurrency(snapshot.profit)}
            />
            <VerificationOverview
              label="Realized R"
              value={
                snapshot.realisedRR != null
                  ? `${Number(snapshot.realisedRR).toFixed(2)}R`
                  : "—"
              }
            />
            <VerificationOverview
              label="Protected"
              value={resource?.passwordProtected ? "Password share" : "Public snapshot"}
            />
          </div>
        </div>
      </GoalSurface>

      <GoalSurface innerClassName="overflow-hidden">
        <div className="p-5">
          <p className="text-sm text-white/34">Verification facts</p>
          <p className="mt-2 text-lg font-semibold text-white">
            Signed by Profitabledge
          </p>
          <p className="mt-2 text-xs leading-5 text-white/46">
            This card was opened from a signed Profitabledge verification token.
            If the original share still exists, you can reopen the live version
            directly from here.
          </p>

          <FullBleedSeparator />

          <div className="space-y-3 text-sm text-white/70">
            <div>
              <p className="text-[11px] text-white/34">Verification code</p>
              <p className="mt-1 font-mono text-xs text-white/80">
                {record.verificationCode}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-white/34">Issued</p>
              <p className="mt-1 text-xs text-white/80">
                {formatIssuedAt(record.issuedAt)}
              </p>
            </div>
            {resource?.createdAt ? (
              <div>
                <p className="text-[11px] text-white/34">Share created</p>
                <p className="mt-1 text-xs text-white/80">
                  {formatIssuedAt(resource.createdAt)}
                </p>
              </div>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {resource?.sharePath ? (
              <Link
                href={resource.sharePath}
                className={getPropAssignActionButtonClassName({
                  tone: "teal",
                  className: "inline-flex items-center gap-2",
                })}
              >
                  Open shared card
                  <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            ) : null}

          </div>
        </div>
      </GoalSurface>
    </div>
  );
}

function EdgeVerificationPanel({ record }: { record: EdgeVerificationRecord }) {
  const status = getStatusMeta(record.status);
  const resource = record.resource;
  const fallback = record.fallback;
  const edgeDetails = resource?.edge;
  const owner = resource?.owner;
  const source = resource?.source;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_360px]">
      <GoalSurface innerClassName="overflow-hidden">
        <div className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-teal-300/80">Public edge</p>
              <h1 className="mt-2 text-2xl font-semibold text-white md:text-3xl">
                {edgeDetails?.name ?? fallback.edgeName ?? "Edge verification"}
              </h1>
              <p className="mt-2 text-sm text-white/48">
                {edgeDetails?.description ??
                  fallback.ownerName ??
                  "Signed public edge record"}
              </p>
            </div>
            <Badge
              className={cn("rounded-md ring-1 text-[11px]", status.className)}
            >
              {status.label}
            </Badge>
          </div>

          <FullBleedSeparator />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <VerificationOverview
              label="Owner"
              value={
                owner?.displayName ??
                owner?.name ??
                owner?.username ??
                fallback.ownerName ??
                "Unavailable"
              }
            />
            <VerificationOverview
              label="Visibility"
              value={
                edgeDetails?.publicationMode === "library"
                  ? "Library edge"
                  : edgeDetails?.publicationMode === "private"
                  ? "Private edge"
                  : "Public edge"
              }
            />
            <VerificationOverview
              label="Stats"
              value={
                edgeDetails?.publicStatsVisible === false
                  ? "Hidden"
                  : "Visible"
              }
            />
            <VerificationOverview
              label="Updated"
              value={
                edgeDetails?.updatedAt
                  ? formatIssuedAt(edgeDetails.updatedAt)
                  : formatIssuedAt(record.issuedAt)
              }
            />
          </div>

          {source ? (
            <>
              <FullBleedSeparator />
              <div className="rounded-sm border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs text-white/34">Source edge</p>
                <p className="mt-2 text-sm font-medium text-white">
                  {source.name}
                </p>
                <p className="mt-1 text-xs text-white/48">
                  {source.ownerName ??
                    source.ownerUsername ??
                    "Public source edge"}
                </p>
              </div>
            </>
          ) : null}
        </div>
      </GoalSurface>

      <GoalSurface innerClassName="overflow-hidden">
        <div className="p-5">
          <p className="text-sm text-white/34">Verification facts</p>
          <p className="mt-2 text-lg font-semibold text-white">
            Signed by Profitabledge
          </p>
          <p className="mt-2 text-xs leading-5 text-white/46">
            This public edge page was opened from a signed Profitabledge token.
            If the edge is still available, you can reopen the live page from
            here.
          </p>

          <FullBleedSeparator />

          <div className="space-y-3 text-sm text-white/70">
            <div>
              <p className="text-[11px] text-white/34">Verification code</p>
              <p className="mt-1 font-mono text-xs text-white/80">
                {record.verificationCode}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-white/34">Issued</p>
              <p className="mt-1 text-xs text-white/80">
                {formatIssuedAt(record.issuedAt)}
              </p>
            </div>
            {fallback.username ? (
              <div>
                <p className="text-[11px] text-white/34">Username</p>
                <p className="mt-1 text-xs text-white/80">@{fallback.username}</p>
              </div>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href={resource?.path ?? fallback.path}
              className={getPropAssignActionButtonClassName({
                tone: "teal",
                className: "inline-flex items-center gap-2",
              })}
            >
              Open public edge
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </GoalSurface>
    </div>
  );
}

export default function VerificationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const { data, isLoading, error } = trpc.verification.resolve.useQuery(
    { token },
    { enabled: Boolean(token) }
  );

  if (isLoading) {
    return (
      <RouteLoadingFallback
        route="verification"
        className="min-h-screen w-screen bg-sidebar"
      />
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen w-screen bg-sidebar">
        <div className="flex min-h-screen w-full items-center justify-center px-4 py-12 md:px-6 lg:px-8">
          <GoalSurface className="w-full max-w-3xl">
            <div className="p-6 text-center">
              <AlertTriangle className="mx-auto h-10 w-10 text-amber-300/80" />
              <p className="mt-4 text-xl font-semibold text-white">
                Verification record not found
              </p>
              <p className="mt-2 text-sm leading-6 text-white/46">
                This QR code or verification link is invalid, expired, or no
                longer available.
              </p>
            </div>
          </GoalSurface>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen bg-sidebar">
      <div className="flex w-full flex-col gap-6 px-4 py-8 md:px-6 lg:px-8">
        {data.kind === "proof" ? (
          <ProofVerificationPanel record={data} />
        ) : data.kind === "widget" ? (
          <WidgetVerificationPanel record={data} />
        ) : data.kind === "edge" ? (
          <EdgeVerificationPanel record={data} />
        ) : (
          <CardVerificationPanel record={data} />
        )}
      </div>
    </div>
  );
}
