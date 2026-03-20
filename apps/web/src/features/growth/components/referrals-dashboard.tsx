"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  BadgePercent,
  Clock3,
  Copy,
  Gift,
  Rocket,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import { Textarea } from "@/components/ui/textarea";
import {
  GoalContentSeparator,
  GoalPanel,
  GoalSurface,
} from "@/components/goals/goal-surface";
import { trpc, trpcOptions } from "@/utils/trpc";

type BillingPlanKey = "student" | "professional" | "institutional";

function getPlanTitle(planKey: BillingPlanKey) {
  switch (planKey) {
    case "professional":
      return "Professional";
    case "institutional":
      return "Institutional";
    default:
      return "Student";
  }
}

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

function formatRewardType(rewardType?: string | null, targetPlanKey?: string | null) {
  switch (rewardType) {
    case "edge_credits":
      return "1,000 Edge credits";
    case "free_month":
      return targetPlanKey
        ? `Free month on ${getPlanTitle(targetPlanKey as BillingPlanKey)}`
        : "Free month";
    case "upgrade_trial":
      return targetPlanKey
        ? `30-day ${getPlanTitle(targetPlanKey as BillingPlanKey)} trial`
        : "30-day upgrade trial";
    default:
      return "Referral reward";
  }
}

function formatStatusLabel(status?: string | null) {
  if (!status) return "Pending";
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
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
          <Icon className="h-4 w-4 text-amber-300" />
          <span className="text-xs text-white/50">{label}</span>
        </div>
        <GoalContentSeparator className="mb-3.5 mt-3.5" />
        <div className="text-2xl font-semibold text-white">{value}</div>
      </div>
    </GoalSurface>
  );
}

export function ReferralsDashboard() {
  const [affiliateApplicationMessage, setAffiliateApplicationMessage] = useState("");
  const billingStateQuery = trpc.billing.getState.useQuery();
  const applyForAffiliate = useMutation({
    ...trpcOptions.billing.applyForAffiliate.mutationOptions(),
    onSuccess: () => {
      setAffiliateApplicationMessage("");
      void billingStateQuery.refetch();
      toast.success("Affiliate application submitted");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to submit affiliate application"
      );
    },
  });

  const referral = billingStateQuery.data?.referral;
  const affiliate = billingStateQuery.data?.affiliate;

  const copyToClipboard = async (value: string, message: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(message);
    } catch {
      toast.error("Unable to copy right now");
    }
  };

  const handleAffiliateApplication = async () => {
    await applyForAffiliate.mutateAsync({
      message: affiliateApplicationMessage.trim() || undefined,
    });
  };

  if (billingStateQuery.isLoading) {
    return (
      <RouteLoadingFallback
        route="referrals"
        className="min-h-[calc(100vh-10rem)]"
      />
    );
  }

  if (referral?.isHiddenBecauseAffiliate) {
    return (
      <main className="space-y-6 p-6 py-4">
        <GoalPanel icon={BadgePercent} title="Referral program">
          <div className="space-y-3">
            <p className="text-sm leading-6 text-white/55">
              This account is already an approved affiliate, so the standard
              member referral program is hidden. Use the affiliate dashboard for
              recurring commission tracking and your mentorship group.
            </p>
            <Button
              asChild
              className="h-8 rounded-sm border border-white/10 bg-sidebar px-3 text-xs text-white hover:bg-sidebar"
            >
              <Link href="/dashboard/affiliate">Open affiliate dashboard</Link>
            </Button>
          </div>
        </GoalPanel>
      </main>
    );
  }

  const statCards = [
    {
      label: "Signups",
      value: String(referral?.stats.signups ?? 0),
      icon: UserPlus,
    },
    {
      label: "Paid conversions",
      value: String(referral?.stats.paidConversions ?? 0),
      icon: Users,
    },
    {
      label: "Next edge credits",
      value: `${referral?.progress.nextEdgeCreditIn ?? 5} to go`,
      icon: Gift,
    },
    {
      label: "Next free month",
      value: `${referral?.progress.nextFreeMonthIn ?? 20} to go`,
      icon: Clock3,
    },
  ];

  return (
    <main className="space-y-6 p-6 py-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
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
        icon={Gift}
        title="Referral share link"
        description="Referrals earn product rewards, not revenue share."
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            readOnly
            value={referral?.profile?.shareUrl ?? ""}
            className="flex-1 border-white/10 bg-sidebar text-xs"
          />
          <Button
            onClick={() =>
              referral?.profile?.shareUrl
                ? copyToClipboard(referral.profile.shareUrl, "Referral link copied")
                : toast.error("Referral link is not ready yet")
            }
            className="h-9 cursor-pointer gap-1.5 rounded-sm border border-white/10 bg-sidebar px-3 text-xs text-white hover:bg-sidebar-accent"
          >
            <Copy className="size-3.5" />
            Copy link
          </Button>
          <Button
            onClick={() =>
              referral?.profile?.code
                ? copyToClipboard(referral.profile.code, "Referral code copied")
                : toast.error("Referral code is not ready yet")
            }
            className="h-9 cursor-pointer gap-1.5 rounded-sm border border-white/10 bg-sidebar px-3 text-xs text-white hover:bg-sidebar-accent"
          >
            <Users className="size-3.5" />
            Copy code
          </Button>
        </div>
      </GoalPanel>

      <GoalPanel icon={Rocket} title="Reward ladder">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              title: `Every ${referral?.progress.edgeCreditThreshold ?? 5} paid referrals`,
              detail: `${referral?.progress.edgeCreditAmount ?? 1000} Edge credits`,
              remaining: referral?.progress.nextEdgeCreditIn ?? 5,
            },
            {
              title: `Every ${referral?.progress.freeMonthThreshold ?? 20} paid referrals`,
              detail: "Free month on your current paid plan",
              remaining: referral?.progress.nextFreeMonthIn ?? 20,
            },
            {
              title: `Every ${referral?.progress.upgradeTrialThreshold ?? 40} paid referrals`,
              detail: "30-day next-plan upgrade when eligible",
              remaining: referral?.progress.nextUpgradeTrialIn ?? 40,
            },
          ].map((milestone) => (
            <div
              key={milestone.title}
              className="rounded-sm border border-white/5 bg-sidebar-accent p-3"
            >
              <p className="text-xs font-medium text-white">{milestone.title}</p>
              <p className="mt-1 text-[11px] leading-5 text-white/35">
                {milestone.detail}
              </p>
              <Badge className="mt-3 bg-white/5 text-[10px] text-white/65 ring ring-white/10">
                {milestone.remaining} remaining
              </Badge>
            </div>
          ))}
        </div>
      </GoalPanel>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <GoalPanel icon={Gift} title="Reward history">
          <div className="space-y-2">
            {referral?.grants.length ? (
              referral.grants.map((grant) => (
                <div
                  key={grant.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-white/5 bg-sidebar-accent p-3"
                >
                  <div>
                    <p className="text-xs font-medium text-white">
                      {formatRewardType(grant.rewardType, grant.targetPlanKey)}
                    </p>
                    <p className="text-[10px] text-white/35">
                      Earned at {grant.conversionCount} paid referrals
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge className="bg-white/5 text-[10px] text-white/65 ring ring-white/10">
                      {formatStatusLabel(grant.status)}
                    </Badge>
                    <p className="mt-1 text-[10px] text-white/35">
                      {formatDate(grant.grantedAt)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-sm border border-dashed border-white/10 p-4 text-xs text-white/30">
                No referral rewards granted yet.
              </div>
            )}
          </div>
        </GoalPanel>

        <GoalPanel
          icon={BadgePercent}
          title="Apply for affiliate access"
          action={
            affiliate?.application ? (
              <Badge className="bg-white/5 text-[10px] text-white/65 ring ring-white/10">
                {formatStatusLabel(affiliate.application.status)}
              </Badge>
            ) : undefined
          }
        >
          <div className="space-y-3">
            <p className="text-xs leading-5 text-white/40">
              Approved affiliates get a separate dashboard, recurring commission
              tracking, and a mentorship group.
            </p>
            <Textarea
              value={affiliateApplicationMessage}
              onChange={(event) =>
                setAffiliateApplicationMessage(event.target.value)
              }
              placeholder="Tell us about your audience, trading experience, or why you'd be a strong affiliate partner."
              className="min-h-24 border-white/10 bg-sidebar text-xs"
            />
            <Button
              onClick={handleAffiliateApplication}
              disabled={applyForAffiliate.isPending}
              className="h-9 rounded-sm border border-white/10 bg-sidebar px-4 text-xs text-white hover:bg-sidebar-accent"
            >
              {applyForAffiliate.isPending
                ? "Submitting..."
                : affiliate?.application
                ? "Update application"
                : "Apply for affiliate access"}
            </Button>
          </div>
        </GoalPanel>
      </div>

      <GoalPanel icon={Users} title="Recent referral activity">
        <div className="space-y-2">
          {referral?.conversions.length ? (
            referral.conversions.map((conversion) => (
              <div
                key={conversion.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-white/5 bg-sidebar-accent p-3"
              >
                <div>
                  <p className="text-xs font-medium capitalize text-white">
                    {formatStatusLabel(conversion.status)}
                  </p>
                  <p className="text-[10px] text-white/35">
                    Joined {formatDate(conversion.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-white">
                    {conversion.referralCode}
                  </p>
                  <p className="text-[10px] text-white/35">
                    {conversion.paidAt
                      ? `Paid ${formatDate(conversion.paidAt)}`
                      : "Awaiting first paid order"}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-sm border border-dashed border-white/10 p-4 text-xs text-white/30">
              No referrals yet. Share your code to start tracking signups.
            </div>
          )}
        </div>
      </GoalPanel>
    </main>
  );
}
