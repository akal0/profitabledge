"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  BadgePercent,
  Copy,
  DollarSign,
  ExternalLink,
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
  const [newTrackingLinkName, setNewTrackingLinkName] = useState("");
  const [newTrackingLinkDestination, setNewTrackingLinkDestination] =
    useState("/sign-up");
  const [newTrackingLinkOfferId, setNewTrackingLinkOfferId] = useState("");

  const dashboard = affiliateDashboardQuery.data?.dashboard as any;
  const isAdmin = affiliateDashboardQuery.data?.isAdmin === true;
  const profile = dashboard?.profile ?? null;
  const defaultOfferCode =
    dashboard?.defaultOffer?.code ??
    profile?.defaultOfferCode ??
    profile?.offerCode ??
    "";
  const defaultTrackingLinkUrl =
    dashboard?.defaultLink?.shareUrl ?? profile?.defaultTrackingLinkUrl ?? "";
  const trackingLinks = dashboard?.links ?? dashboard?.trackingLinks ?? [];

  const saveAffiliateTrackingLink = useMutation({
    ...trpcOptions.billing.saveAffiliateTrackingLink.mutationOptions(),
    onSuccess: () => {
      setNewTrackingLinkName("");
      setNewTrackingLinkDestination("/sign-up");
      setNewTrackingLinkOfferId("");
      void affiliateDashboardQuery.refetch();
      toast.success("Tracked link created");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to create tracked link"
      );
    },
  });

  const trackedClicks =
    typeof dashboard?.stats?.linkClicks === "number"
      ? dashboard.stats.linkClicks
      : trackingLinks.reduce(
          (sum: number, link: any) =>
            sum + (link.touches ?? link.clickCount ?? 0),
          0
        );

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

  const handleCreateTrackedLink = async () => {
    if (!newTrackingLinkName.trim()) {
      toast.error("Tracked link name is required");
      return;
    }
    await saveAffiliateTrackingLink.mutateAsync({
      name: newTrackingLinkName.trim(),
      destinationPath: newTrackingLinkDestination.trim() || "/sign-up",
      affiliateOfferId:
        newTrackingLinkOfferId || dashboard?.defaultOffer?.id || undefined,
      affiliateGroupSlug: dashboard?.group?.slug ?? undefined,
    });
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
            className="h-7 gap-1.5 rounded-sm border border-white/10 bg-sidebar px-3 text-[11px] text-white hover:bg-sidebar-accent"
          >
            <Copy className="size-3" />
            Copy link
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/30">
              Affiliate link
            </p>
            <Input
              readOnly
              value={profile?.shareUrl ?? ""}
              className="h-8 border-white/10 bg-sidebar text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/30">
              Affiliate code
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={profile?.code ?? ""}
                className="h-8 border-white/10 bg-sidebar text-xs"
              />
              <Button
                onClick={() =>
                  copyToClipboard(profile?.code ?? "", "Affiliate code copied")
                }
                disabled={!profile?.code}
                className="h-8 rounded-sm border border-white/10 bg-sidebar px-2 text-xs text-white hover:bg-sidebar-accent"
              >
                <Copy className="size-3" />
              </Button>
            </div>
          </div>

          {defaultOfferCode ? (
            <div className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/30">
                Default offer code
              </p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={defaultOfferCode}
                  className="h-8 border-white/10 bg-sidebar text-xs"
                />
                <Button
                  onClick={() =>
                    copyToClipboard(defaultOfferCode, "Offer code copied")
                  }
                  className="h-8 rounded-sm border border-white/10 bg-sidebar px-2 text-xs text-white hover:bg-sidebar-accent"
                >
                  <BadgePercent className="size-3" />
                </Button>
              </div>
            </div>
          ) : null}

          {defaultTrackingLinkUrl ? (
            <div className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/30">
                Default tracked link
              </p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={defaultTrackingLinkUrl}
                  className="h-8 border-white/10 bg-sidebar text-xs"
                />
                <Button
                  onClick={() =>
                    copyToClipboard(defaultTrackingLinkUrl, "Tracked link copied")
                  }
                  className="h-8 rounded-sm border border-white/10 bg-sidebar px-2 text-xs text-white hover:bg-sidebar-accent"
                >
                  <Link2 className="size-3" />
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        {dashboard.group ? (
          <div className="mt-4 space-y-3 border-t border-white/5 pt-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-white">
                  {dashboard.group.name}
                </p>
                <p className="text-xs text-white/40">`{dashboard.group.slug}`</p>
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
              className="h-8 gap-1.5 rounded-sm border border-white/10 bg-sidebar px-3 text-xs text-white hover:bg-sidebar-accent"
            >
              <ExternalLink className="size-3.5" />
              Copy group invite link
            </Button>
          </div>
        ) : null}

        {profile?.publicProof ? (
          <div className="mt-4 space-y-1.5 border-t border-white/5 pt-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/30">
              Public proof treatment
            </p>
            <div className="rounded-sm border border-white/5 bg-sidebar-accent p-3 text-xs text-white/55">
              <p>
                Badge:{" "}
                <span className="font-medium text-white">
                  {profile.publicProof.badgeLabel || "Affiliate"}
                </span>
              </p>
              <p className="mt-1">
                Effect variant:{" "}
                <span className="font-medium text-white">
                  {profile.publicProof.effectVariant || "gold_signal"}
                </span>
              </p>
            </div>
          </div>
        ) : null}
      </GoalPanel>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <GoalPanel
          icon={DollarSign}
          title="Commission history"
          description="Every paid order tied to your affiliate customers."
          action={
            <Badge className="rounded-full bg-white/5 text-[10px] text-white/65 ring ring-white/10">
              {dashboard.commissionEvents.length} events
            </Badge>
          }
        >
          <div className="space-y-2">
            {dashboard.commissionEvents.length ? (
              dashboard.commissionEvents.map((event: any) => (
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
        </GoalPanel>

        <GoalPanel
          icon={Users}
          title="Mentorship group"
          description="Traders who join through your affiliate link and group slug."
        >
          <div className="space-y-2">
            {dashboard.group?.members.length ? (
              dashboard.group.members.map((member: any) => (
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
        </GoalPanel>
      </div>

      <GoalPanel
        icon={Link2}
        title="Tracked links"
        description="Default share links and campaign links with their current performance."
        action={
          <Badge className="rounded-full bg-white/5 text-[10px] text-white/65 ring ring-white/10">
            {trackingLinks.length} links
          </Badge>
        }
      >
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-white">Create tracked link</p>
            <p className="mt-0.5 text-[11px] text-white/40">
              Generate a campaign link with its own destination and attached offer.
            </p>
            <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_auto]">
              <Input
                value={newTrackingLinkName}
                onChange={(event) => setNewTrackingLinkName(event.target.value)}
                placeholder="Campaign name"
                className="h-9 border-white/10 bg-sidebar text-xs"
              />
              <Input
                value={newTrackingLinkDestination}
                onChange={(event) =>
                  setNewTrackingLinkDestination(event.target.value)
                }
                placeholder="/sign-up"
                className="h-9 border-white/10 bg-sidebar text-xs"
              />
              <select
                value={
                  newTrackingLinkOfferId || dashboard?.defaultOffer?.id || ""
                }
                onChange={(event) =>
                  setNewTrackingLinkOfferId(event.target.value)
                }
                className="h-9 rounded-sm border border-white/10 bg-sidebar px-3 text-xs text-white"
              >
                <option value="">Default offer</option>
                {(dashboard?.offers ?? []).map((offer: any) => (
                  <option key={offer.id} value={offer.id}>
                    {offer.code}
                  </option>
                ))}
              </select>
              <Button
                onClick={handleCreateTrackedLink}
                disabled={saveAffiliateTrackingLink.isPending}
                className="h-9 rounded-sm bg-emerald-600 px-4 text-xs text-white hover:brightness-110"
              >
                {saveAffiliateTrackingLink.isPending
                  ? "Creating..."
                  : "Create link"}
              </Button>
            </div>
          </div>

          <div className="space-y-2 border-t border-white/5 pt-4">
            {trackingLinks.length ? (
              trackingLinks.map((link: any) => (
                <div
                  key={link.id}
                  className="rounded-sm border border-white/5 bg-sidebar-accent p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-medium text-white">
                          {link.name}
                        </p>
                        {link.isDefault ||
                        dashboard?.defaultLink?.id === link.id ? (
                          <Badge className="rounded-full bg-emerald-500/10 text-[10px] text-emerald-300 ring ring-emerald-500/15">
                            Default
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[10px] text-white/35">
                        {link.destinationPath ?? "/sign-up"} •{" "}
                        {link.offerCode ?? defaultOfferCode ?? "No offer"}
                      </p>
                    </div>
                    <Button
                      onClick={() =>
                        copyToClipboard(
                          link.shareUrl ?? link.url ?? "",
                          `${link.name} copied`
                        )
                      }
                      disabled={!link.shareUrl && !link.url}
                      className="h-7 rounded-sm border border-white/10 bg-sidebar px-2 text-[11px] text-white hover:bg-sidebar-accent"
                    >
                      <Copy className="size-3" />
                    </Button>
                  </div>
                  <div className="mt-2 grid gap-2 text-[11px] text-white/40 sm:grid-cols-4">
                    <span>Clicks: {link.touches ?? link.clickCount ?? 0}</span>
                    <span>
                      Signups: {link.signups ?? link.signupCount ?? 0}
                    </span>
                    <span>
                      Paid: {link.paidCustomers ?? link.paidCustomerCount ?? 0}
                    </span>
                    <span>
                      Commission:{" "}
                      {formatCurrency(link.totalCommissionAmount ?? 0)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-sm border border-dashed border-white/10 p-4 text-xs text-white/30">
                No tracked links are attached to this affiliate yet.
              </div>
            )}
          </div>
        </div>
      </GoalPanel>
    </main>
  );
}
