"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Copy,
  DollarSign,
  ExternalLink,
  Users,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  GrowthCardShell,
  GrowthPageBody,
  GrowthPageShell,
} from "@/features/growth/components/growth-page-primitives";
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

export default function AffiliateDashboardPage() {
  const affiliateDashboardQuery = useQuery(
    trpcOptions.billing.getAffiliateDashboard.queryOptions()
  );

  const dashboard = affiliateDashboardQuery.data?.dashboard;
  const isAdmin = affiliateDashboardQuery.data?.isAdmin === true;

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
      <GrowthPageShell
        title="Affiliate"
        description="Track recurring commissions, invite activity, and mentorship-group ownership"
      >
        <GrowthPageBody className="space-y-4">
          <div className="h-40 animate-pulse rounded-sm bg-sidebar" />
          <div className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-sm bg-sidebar"
              />
            ))}
          </div>
        </GrowthPageBody>
      </GrowthPageShell>
    );
  }

  if (!dashboard) {
    return (
      <GrowthPageShell
        title="Affiliate"
        description="Track recurring commissions, invite activity, and mentorship-group ownership"
      >
        <GrowthPageBody>
          <GrowthCardShell className="max-w-2xl">
            <div className="p-6">
              <p className="text-lg font-semibold text-white">Affiliate dashboard</p>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">
                {isAdmin
                  ? "This account has admin access but is not an approved affiliate. Review affiliate applications and waitlist entries from growth admin."
                  : "Affiliate access is required to view this page."}
              </p>
            </div>
          </GrowthCardShell>
        </GrowthPageBody>
      </GrowthPageShell>
    );
  }

  return (
    <GrowthPageShell
      title="Affiliate"
      description="Track recurring commissions, invite activity, and mentorship-group ownership"
    >
      <GrowthPageBody className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <GrowthCardShell className="overflow-hidden">
          <div className="border-b border-white/5 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <Badge className="rounded-full bg-emerald-500/10 text-[10px] text-emerald-300 ring ring-emerald-500/15">
                  Approved affiliate
                </Badge>
                <p className="mt-3 text-lg font-semibold tracking-[-0.04em] text-white">
                  Commission and invite performance
                </p>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">
                  Track recurring commissions, invite activity, and your
                  mentorship group from one place.
                </p>
              </div>
              <Button
                onClick={() =>
                  dashboard.profile.shareUrl
                    ? copyToClipboard(
                        dashboard.profile.shareUrl,
                        "Affiliate link copied"
                      )
                    : toast.error("Affiliate link is not ready yet")
                }
                className="h-10 gap-2 rounded-sm border border-white/10 bg-sidebar px-4 text-xs text-white hover:bg-sidebar"
              >
                <Copy className="size-3.5" />
                Copy share link
              </Button>
            </div>
          </div>

          <div className="grid gap-3 p-6 sm:grid-cols-3">
            {[
              {
                label: "Total commission",
                value: formatCurrency(dashboard.stats.totalCommissionAmount),
                icon: DollarSign,
              },
              {
                label: "Invited traders",
                value: String(dashboard.stats.signups),
                icon: UserPlus,
              },
              {
                label: "Paid customers",
                value: String(dashboard.stats.paidCustomers),
                icon: Users,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-sm ring ring-white/5 bg-sidebar p-4"
              >
                <stat.icon className="size-4 text-emerald-300" />
                <p className="mt-4 text-[11px] uppercase tracking-[0.16em] text-white/30">
                  {stat.label}
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </GrowthCardShell>

        <GrowthCardShell>
          <div className="p-5">
          <p className="text-sm font-medium text-white">Share assets</p>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/30">
                Affiliate link
              </p>
                <Input
                  readOnly
                  value={dashboard.profile.shareUrl}
                  className="h-10 border-white/10 bg-sidebar text-xs"
                />
            </div>

            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/30">
                Affiliate code
              </p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={dashboard.profile.code}
                  className="h-10 border-white/10 bg-sidebar text-xs"
                />
                <Button
                  onClick={() =>
                    copyToClipboard(
                      dashboard.profile.code,
                      "Affiliate code copied"
                    )
                  }
                  className="h-10 rounded-sm border border-white/10 bg-sidebar px-3 text-xs text-white hover:bg-sidebar"
                >
                  <Copy className="size-3.5" />
                </Button>
              </div>
            </div>

            {dashboard.group ? (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {dashboard.group.name}
                      </p>
                      <p className="text-xs text-white/40">
                        `{dashboard.group.slug}`
                      </p>
                    </div>
                    <Badge className="rounded-full bg-white/5 text-[10px] text-white/65 ring ring-white/10">
                      {dashboard.group.memberCount} members
                    </Badge>
                  </div>
                  <p className="text-sm leading-6 text-white/45">
                    {dashboard.group.description}
                  </p>
                  <Button
                    onClick={() =>
                      copyToClipboard(
                        dashboard.group!.inviteUrl,
                        "Group invite link copied"
                      )
                    }
                    className="h-10 w-full gap-2 rounded-sm border border-white/10 bg-sidebar px-4 text-xs text-white hover:bg-sidebar"
                  >
                    <ExternalLink className="size-3.5" />
                    Copy group invite link
                  </Button>
                </div>
              </>
            ) : null}
          </div>
          </div>
        </GrowthCardShell>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <GrowthCardShell>
          <div className="flex items-center justify-between gap-3 p-5">
            <div>
              <p className="text-sm font-medium text-white">Commission history</p>
              <p className="mt-1 text-xs text-white/40">
                Every paid order tied to your affiliate customers appears here.
              </p>
            </div>
            <Badge className="rounded-full bg-white/5 text-[10px] text-white/65 ring ring-white/10">
              {dashboard.commissionEvents.length} events
            </Badge>
          </div>
          <Separator />
          <div className="space-y-2 p-5">
            {dashboard.commissionEvents.length ? (
              dashboard.commissionEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-white/5 bg-sidebar-accent p-3"
                >
                  <div>
                    <p className="text-xs font-medium text-white">
                      Order {event.polarOrderId}
                    </p>
                    <p className="text-[10px] text-white/35">
                      {event.currency || "USD"} • {formatDate(event.occurredAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">
                      {formatCurrency(event.commissionAmount)}
                    </p>
                    <p className="text-[10px] text-white/35">
                      On {formatCurrency(event.orderAmount)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-sm border border-dashed border-white/10 p-4 text-xs text-white/30">
                No commission events yet.
              </div>
            )}
          </div>
        </GrowthCardShell>

        <GrowthCardShell>
          <div className="p-5">
            <p className="text-sm font-medium text-white">Mentorship group</p>
            <p className="mt-1 text-xs text-white/40">
              Traders who join through your affiliate link and group slug appear here.
            </p>
          </div>
          <Separator />
          <div className="space-y-2 p-5">
            {dashboard.group?.members.length ? (
              dashboard.group.members.map((member) => (
                <div
                  key={member.id}
                  className="rounded-sm border border-white/5 bg-sidebar-accent p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-white">
                        {member.name || member.email}
                      </p>
                      <p className="text-[10px] text-white/35">{member.email}</p>
                    </div>
                    <Badge className="rounded-full bg-white/5 text-[10px] text-white/60 ring ring-white/10">
                      {formatDate(member.joinedAt)}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-sm border border-dashed border-white/10 p-4 text-xs text-white/30">
                No one has joined your mentorship group yet.
              </div>
            )}
          </div>
        </GrowthCardShell>
      </div>
      </GrowthPageBody>
    </GrowthPageShell>
  );
}
