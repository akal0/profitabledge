"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BadgePercent,
  Copy,
  DollarSign,
  Link2,
  Users,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import {
  GoalContentSeparator,
  GoalPanel,
  GoalSurface,
} from "@/components/goals/goal-surface";
import { trpcOptions } from "@/utils/trpc";

function formatDate(value?: string | Date | null) {
  if (!value) return "N/A";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(cents?: number | null) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format((cents ?? 0) / 100);
}

function formatCommissionSplit(bps?: number | null) {
  const percentage = (bps ?? 0) / 100;
  return `${
    Number.isInteger(percentage) ? percentage.toFixed(0) : percentage.toFixed(2)
  }%`;
}

function formatCurrencyCode(value?: string | null) {
  return (value || "USD").toUpperCase();
}

const SHARE_ASSET_INPUT_CLASS =
  "h-10 border-none ring ring-white/10! shadow-none bg-transparent! text-xs hover:bg-sidebar-accent hover:brightness-120";
const SHARE_ASSET_INLINE_BUTTON_CLASS =
  "h-10 rounded-sm border-none ring ring-white/10 bg-transparent px-2 text-xs text-white hover:bg-sidebar-accent hover:brightness-120";

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <GoalSurface>
      <div className="p-3.5">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-emerald-300" />
          <span className="text-xs text-white/50">{label}</span>
        </div>
        <GoalContentSeparator className="mb-3.5 mt-3.5" />
        <div className="text-2xl font-semibold text-white">{value}</div>
      </div>
    </GoalSurface>
  );
}

export default function AffiliateDashboardPage() {
  const affiliateDashboardQuery = useQuery(
    trpcOptions.billing.getAffiliateDashboard.queryOptions()
  );

  const dashboard = affiliateDashboardQuery.data?.dashboard as any;
  const isAdmin = affiliateDashboardQuery.data?.isAdmin === true;
  const profile = dashboard?.profile ?? null;
  const defaultOfferCode =
    dashboard?.defaultOffer?.code ??
    profile?.defaultOfferCode ??
    profile?.offerCode ??
    "";
  const channels = dashboard?.channels ?? [];

  const trackedClicks =
    typeof dashboard?.stats?.linkClicks === "number"
      ? dashboard.stats.linkClicks
      : channels.reduce((sum: number, ch: any) => sum + (ch.touches ?? 0), 0);

  const statCards = [
    {
      label: "Total commission",
      value: formatCurrency(dashboard?.stats?.totalCommissionAmount),
      icon: DollarSign,
    },
    {
      label: "Invited traders",
      value: String(dashboard?.stats?.signups ?? 0),
      icon: UserPlus,
    },
    {
      label: "Paid customers",
      value: String(dashboard?.stats?.paidCustomers ?? 0),
      icon: Users,
    },
    ...(trackedClicks > 0
      ? [{ label: "Tracked clicks", value: String(trackedClicks), icon: Link2 }]
      : []),
  ];

  const copyToClipboard = async (value: string, message: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(message);
    } catch {
      toast.error("Unable to copy right now");
    }
  };

  if (affiliateDashboardQuery.isLoading) {
    return (
      <RouteLoadingFallback
        route="affiliate"
        className="min-h-[calc(100vh-10rem)]"
      />
    );
  }

  if (!dashboard) {
    return (
      <main className="space-y-6 p-6 py-4">
        <GoalPanel icon={BadgePercent} title="Affiliate dashboard">
          <p className="text-sm leading-6 text-white/55">
            {isAdmin
              ? "This account has admin access but is not an approved affiliate. Review affiliate applications and waitlist entries from growth admin."
              : "Affiliate access is required to view this page."}
          </p>
        </GoalPanel>
      </main>
    );
  }

  return (
    <main className="space-y-6 p-6 py-4">
      <div
        className={`grid grid-cols-1 gap-4 ${
          statCards.length > 3 ? "md:grid-cols-4" : "md:grid-cols-3"
        }`}
      >
        {statCards.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            icon={stat.icon}
          />
        ))}
      </div>

      <GoalPanel
        icon={Link2}
        title="Share assets"
        action={
          <Button
            onClick={() =>
              profile?.shareUrl
                ? copyToClipboard(profile.shareUrl, "Affiliate link copied")
                : toast.error("Affiliate link is not ready yet")
            }
            className="h-7 gap-1.5 rounded-sm border-none ring ring-white/10 bg-transparent px-3 text-[11px] text-white hover:bg-sidebar-accent hover:brightness-120"
          >
            <Copy className="size-3" />
            Copy link
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5">
            <p className="text-[11px] text-white/30">Affiliate link</p>
            <Input
              readOnly
              value={profile?.shareUrl ?? ""}
              className={SHARE_ASSET_INPUT_CLASS}
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] text-white/30">Affiliate code</p>
            <div className="flex items-stretch gap-2">
              <Input
                readOnly
                value={profile?.code ?? ""}
                className={SHARE_ASSET_INPUT_CLASS}
              />
              <Button
                onClick={() =>
                  copyToClipboard(profile?.code ?? "", "Affiliate code copied")
                }
                disabled={!profile?.code}
                className={SHARE_ASSET_INLINE_BUTTON_CLASS}
              >
                <Copy className="size-3" />
              </Button>
            </div>
          </div>

          {defaultOfferCode ? (
            <div className="space-y-1.5">
              <p className="text-[11px] text-white/30">Default offer code</p>
              <div className="flex items-stretch gap-2">
                <Input
                  readOnly
                  value={defaultOfferCode}
                  className={SHARE_ASSET_INPUT_CLASS}
                />
                <Button
                  onClick={() =>
                    copyToClipboard(defaultOfferCode, "Offer code copied")
                  }
                  className={SHARE_ASSET_INLINE_BUTTON_CLASS}
                >
                  <BadgePercent className="size-3" />
                </Button>
              </div>
            </div>
          ) : null}

          {typeof profile?.commissionBps === "number" ? (
            <div className="space-y-1.5">
              <p className="text-[11px] text-white/30">Payout split</p>
              <div className="rounded-sm border border-white/5 bg-sidebar-accent p-3 text-xs text-white/55">
                <span className="font-medium text-white">
                  {formatCommissionSplit(profile.commissionBps)}
                </span>{" "}
                of the commissionable order amount
              </div>
            </div>
          ) : null}
        </div>
      </GoalPanel>

      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex size-9 items-center justify-center rounded-sm border border-white/5 bg-sidebar-accent">
              <DollarSign className="size-4 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-sm font-medium text-white">
                Commission history
              </h2>
              <p className="mt-1 text-sm leading-6 text-white/45">
                Every paid order tied to your affiliate customers.
              </p>
            </div>
          </div>

          <Badge className="rounded-full bg-white/5 text-[10px] text-white/65 ring ring-white/10">
            {dashboard.commissionEvents.length} events
          </Badge>
        </div>

        {dashboard.commissionEvents.length ? (
          <div className="overflow-hidden rounded-lg border border-white/5 bg-sidebar">
            <div className="overflow-x-auto">
              <table className="min-w-[1220px] w-full text-left">
                <thead className="bg-sidebar">
                  <tr className="border-b border-white/5">
                    {[
                      "Username",
                      "Email",
                      "Order",
                      "Date",
                      "Payment plan",
                      "Price",
                      "Currency",
                      "Commission",
                      "Commission split",
                    ].map((column) => (
                      <th
                        key={column}
                        className="px-4 py-3 text-xs font-medium text-white/55"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-sidebar-accent/60">
                  {dashboard.commissionEvents.map((event: any) => (
                    <tr
                      key={event.id}
                      className="border-b border-white/5 last:border-b-0"
                    >
                      <td className="px-4 py-3 align-top">
                        <p className="text-sm text-white">
                          {event.referredUsername
                            ? `@${event.referredUsername}`
                            : "—"}
                        </p>
                        {event.referredName ? (
                          <p className="mt-1 text-[11px] text-white/35">
                            {event.referredName}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-white/75">
                        {event.referredEmail ?? "—"}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="text-sm text-white">
                          {event.orderReference || event.polarOrderId || "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-white/75">
                        {formatDate(event.occurredAt)}
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-white/75">
                        {event.paymentPlanLabel ?? "Unknown"}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="text-sm text-white">
                          {formatCurrency(event.orderAmount)}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-white/75">
                        {formatCurrencyCode(event.currency)}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="text-sm text-white">
                          {formatCurrency(event.commissionAmount)}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="text-sm text-white">
                          {formatCommissionSplit(event.commissionBps)}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-sm border border-dashed border-white/10 p-4 text-xs text-white/30">
            No commission events yet.
          </div>
        )}
      </section>

      {channels.length > 0 && (
        <GoalPanel
          icon={Link2}
          title="Channels"
          description="Track where your sign-ups come from by appending ?channel=twitter, ?channel=discord, etc. to your invite link."
          action={
            <Badge className="rounded-full bg-white/5 text-[10px] text-white/65 ring ring-white/10">
              {channels.length} channels
            </Badge>
          }
        >
          <div className="space-y-2">
            {channels.map((ch: any) => (
              <div
                key={ch.channel}
                className="flex items-center justify-between gap-3 rounded-sm border border-white/5 bg-sidebar-accent p-3"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white">{ch.channel}</p>
                  <p className="mt-0.5 text-[10px] text-white/35">
                    {ch.touches} click{ch.touches !== 1 ? "s" : ""}
                  </p>
                </div>
                <Button
                  onClick={() =>
                    copyToClipboard(ch.shareUrl, `${ch.channel} link copied`)
                  }
                  className="h-7 rounded-sm border border-white/10 bg-sidebar px-2 text-[11px] text-white hover:bg-sidebar-accent"
                >
                  <Copy className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        </GoalPanel>
      )}
    </main>
  );
}
