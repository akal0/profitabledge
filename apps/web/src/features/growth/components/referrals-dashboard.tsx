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
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  GrowthCardShell,
  GrowthPageBody,
  GrowthPageShell,
  GrowthSectionLabel,
} from "@/features/growth/components/growth-page-primitives";
import { trpcOptions } from "@/utils/trpc";

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

export function ReferralsDashboard() {
  const [affiliateApplicationMessage, setAffiliateApplicationMessage] =
    useState("");
  const billingStateQuery = useQuery({
    ...trpcOptions.billing.getState.queryOptions(),
  });
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
      <GrowthPageShell
        title="Referrals"
        description="Share your referral link, track milestone rewards, and apply for affiliate access"
      >
        <GrowthPageBody className="space-y-4">
          <div className="h-40 animate-pulse rounded-sm bg-sidebar" />
          <div className="grid gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
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

  return (
    <GrowthPageShell
      title="Referrals"
      description="Share your referral link, track milestone rewards, and apply for affiliate access"
    >
      <GrowthPageBody>
        <GrowthCardShell className="overflow-hidden">
          <div className="border-b border-white/5 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.12),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-6">
            <Badge className="rounded-full bg-amber-500/10 text-[10px] text-amber-200 ring ring-amber-500/15">
              Member referrals
            </Badge>
            <p className="mt-3 text-lg font-semibold tracking-[-0.04em] text-white">
              Product rewards for member-driven growth
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
              Every member can share a referral link and earn product rewards.
              Approved affiliates move onto the separate affiliate route with
              commission tracking and mentorship-group ownership.
            </p>
          </div>

          {referral?.isHiddenBecauseAffiliate ? (
            <div className="p-6">
              <div className="flex items-center gap-2">
                <BadgePercent className="size-3.5 text-emerald-300" />
                <p className="text-xs font-medium text-white">
                  Referral program replaced by affiliate access
                </p>
              </div>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/45">
                This account is already an approved affiliate, so the standard
                member referral program is hidden. Use the affiliate dashboard for
                recurring commission tracking and your mentorship group.
              </p>
              <Button
                asChild
                className="mt-4 h-9 rounded-sm border border-white/10 bg-sidebar px-4 text-xs text-white hover:bg-sidebar"
              >
                <Link href="/dashboard/affiliate">Open affiliate dashboard</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-6 p-6">
              <GrowthCardShell>
              <div className="p-4 pb-0">
                <div className="flex items-center gap-2">
                  <Gift className="size-3.5 text-amber-300" />
                  <p className="text-xs font-medium text-white">
                    Referral share link
                  </p>
                </div>
              </div>
              <Separator className="mt-3" />
              <div className="space-y-3 p-4 pt-3">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    readOnly
                    value={referral?.profile?.shareUrl ?? ""}
                    className="flex-1 ring-white/5 bg-sidebar text-xs"
                  />
                  <Button
                    onClick={() =>
                      referral?.profile?.shareUrl
                        ? copyToClipboard(
                            referral.profile.shareUrl,
                            "Referral link copied"
                          )
                        : toast.error("Referral link is not ready yet")
                    }
                    className="h-9 cursor-pointer gap-1.5 rounded-sm ring ring-white/5 bg-sidebar px-3 text-xs text-white transition-all duration-250 active:scale-95 hover:bg-sidebar"
                  >
                    <Copy className="size-3.5" />
                    Copy link
                  </Button>
                  <Button
                    onClick={() =>
                      referral?.profile?.code
                        ? copyToClipboard(
                            referral.profile.code,
                            "Referral code copied"
                          )
                        : toast.error("Referral code is not ready yet")
                    }
                    className="h-9 cursor-pointer gap-1.5 rounded-sm ring ring-white/5 bg-sidebar px-3 text-xs text-white transition-all duration-250 active:scale-95 hover:bg-sidebar"
                  >
                    <Users className="size-3.5" />
                    Copy code
                  </Button>
                </div>
                <p className="text-[11px] text-white/35">
                  Referrals earn product rewards, not revenue share.
                </p>
              </div>
              </GrowthCardShell>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
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
              ].map((stat) => (
                <GrowthCardShell key={stat.label}>
                  <div className="p-4 pb-0">
                    <stat.icon className="size-3.5 text-emerald-300" />
                    <GrowthSectionLabel>{stat.label}</GrowthSectionLabel>
                  </div>
                  <Separator className="mt-3" />
                  <div className="p-4 pt-3">
                    <p className="text-xl font-semibold text-white">
                      {stat.value}
                    </p>
                  </div>
                </GrowthCardShell>
              ))}
            </div>

            <GrowthCardShell>
              <div className="p-4 pb-0">
                <div className="flex items-center gap-2">
                  <Rocket className="size-3.5 text-blue-300" />
                  <p className="text-xs font-medium text-white">
                    Reward ladder
                  </p>
                </div>
              </div>
              <Separator className="mt-3" />
              <div className="grid gap-3 p-4 pt-3 sm:grid-cols-3">
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
                    className="rounded-sm ring ring-white/5 bg-sidebar p-3"
                  >
                    <p className="text-xs font-medium text-white">
                      {milestone.title}
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-white/35">
                      {milestone.detail}
                    </p>
                    <Badge className="mt-3 ring ring-white/10 bg-white/5 text-[10px] text-white/65">
                      {milestone.remaining} remaining
                    </Badge>
                  </div>
                ))}
              </div>
            </GrowthCardShell>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
              <GrowthCardShell>
                <div className="p-4 pb-0">
                  <div className="flex items-center gap-2">
                    <Gift className="size-3.5 text-amber-300" />
                    <p className="text-xs font-medium text-white">
                      Reward history
                    </p>
                  </div>
                </div>
                <Separator className="mt-3" />
                <div className="space-y-2 p-4 pt-3">
                  {referral?.grants.length ? (
                    referral.grants.map((grant) => (
                      <div
                        key={grant.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-sm ring ring-white/5 bg-sidebar p-3"
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
                          <Badge className="ring ring-white/10 bg-white/5 text-[10px] text-white/65">
                            {formatStatusLabel(grant.status)}
                          </Badge>
                          <p className="mt-1 text-[10px] text-white/35">
                            {formatDate(grant.grantedAt)}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-sm ring ring-dashed ring-white/10 p-4 text-xs text-white/30">
                      No referral rewards granted yet.
                    </div>
                  )}
                </div>
              </GrowthCardShell>

              <GrowthCardShell>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-white">
                        Apply to become an affiliate
                      </p>
                      <p className="mt-1 text-xs leading-5 text-white/35">
                        Approved affiliates get a separate dashboard, recurring
                        commission tracking, and a mentorship group.
                      </p>
                    </div>
                    {affiliate?.application ? (
                      <Badge className="ring ring-white/10 bg-white/5 text-[10px] text-white/65">
                        {formatStatusLabel(affiliate.application.status)}
                      </Badge>
                    ) : null}
                  </div>
                  <Textarea
                    value={affiliateApplicationMessage}
                    onChange={(event) =>
                      setAffiliateApplicationMessage(event.target.value)
                    }
                    placeholder="Tell us about your audience, trading experience, or why you'd be a strong affiliate partner."
                    className="mt-4 min-h-28 ring-white/5 bg-sidebar text-xs"
                  />
                  <Button
                    onClick={handleAffiliateApplication}
                    disabled={applyForAffiliate.isPending}
                    className="mt-4 h-9 rounded-sm bg-sidebar px-4 text-xs text-white ring ring-white/5 hover:bg-sidebar-accent"
                  >
                    {applyForAffiliate.isPending
                      ? "Submitting..."
                      : affiliate?.application
                      ? "Update application"
                      : "Apply for affiliate access"}
                  </Button>
                </div>
              </GrowthCardShell>
            </div>

            <GrowthCardShell>
              <div className="p-4 pb-0">
                <div className="flex items-center gap-2">
                  <Users className="size-3.5 text-blue-300" />
                  <p className="text-xs font-medium text-white">
                    Recent referral activity
                  </p>
                </div>
              </div>
              <Separator className="mt-3" />
              <div className="space-y-2 p-4 pt-3">
                {referral?.conversions.length ? (
                  referral.conversions.map((conversion) => (
                    <div
                      key={conversion.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-sm ring ring-white/5 bg-sidebar p-3"
                    >
                      <div>
                        <p className="text-xs font-medium text-white capitalize">
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
                  <div className="rounded-sm ring ring-dashed ring-white/10 p-4 text-xs text-white/30">
                    No referrals yet. Share your code to start tracking signups.
                  </div>
                )}
              </div>
            </GrowthCardShell>
            </div>
          )}
        </GrowthCardShell>
      </GrowthPageBody>
    </GrowthPageShell>
  );
}
