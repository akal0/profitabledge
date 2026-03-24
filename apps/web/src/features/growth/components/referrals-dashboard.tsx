"use client";

import Link from "next/link";
import {
  BadgePercent,
  CheckCircle2,
  Clock3,
  Copy,
  Gift,
  Lock,
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
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  GoalContentSeparator,
  GoalPanel,
  GoalSurface,
} from "@/components/goals/goal-surface";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

type BillingPlanKey = "student" | "professional" | "institutional";
type RewardMilestoneState = "completed" | "active" | "pending";

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

function getRewardMilestoneState(
  paidConversions: number,
  threshold: number,
  remaining: number
): RewardMilestoneState {
  if (paidConversions < threshold) return "pending";
  return remaining === 0 ? "active" : "completed";
}

function formatRewardMilestoneStatus(
  state: RewardMilestoneState,
  remaining: number,
  earnedCount: number
) {
  if (state === "active") return "Unlocked now";
  if (state === "completed") {
    return earnedCount === 1 ? "Earned once" : `Earned ${earnedCount}x`;
  }
  return `${remaining} to go`;
}

function RewardMilestoneTooltip({
  title,
  detail,
  cadence,
  remaining,
  earnedCount,
  state,
}: {
  title: string;
  detail: string;
  cadence: string;
  remaining: number;
  earnedCount: number;
  state: RewardMilestoneState;
}) {
  const nextUnlockLabel = remaining === 0 ? "Available now" : `${remaining} more referrals`;

  return (
    <div className="min-w-[220px]">
      <div className="px-3 py-3">
        <p className="text-xs font-semibold text-white">{title}</p>
        <p className="mt-1 text-[11px] text-white/45">{detail}</p>
      </div>
      <Separator />
      <div className="space-y-2 px-3 py-3">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[11px] text-white/45">Cadence</span>
          <span className="text-[11px] font-medium text-white/85">{cadence}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[11px] text-white/45">Status</span>
          <span className="text-[11px] font-medium text-white/85">
            {formatRewardMilestoneStatus(state, remaining, earnedCount)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[11px] text-white/45">Earned so far</span>
          <span className="text-[11px] font-medium text-white/85">
            {earnedCount === 0 ? "Not yet" : `${earnedCount}x`}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[11px] text-white/45">Next unlock</span>
          <span className="text-[11px] font-medium text-white/85">
            {nextUnlockLabel}
          </span>
        </div>
      </div>
    </div>
  );
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
  const billingStateQuery = trpc.billing.getState.useQuery(undefined, {
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const referral = billingStateQuery.data?.referral;
  const affiliate = billingStateQuery.data?.affiliate;
  const paidConversions = referral?.progress.paidConversions ?? 0;

  const copyToClipboard = async (value: string, message: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(message);
    } catch {
      toast.error("Unable to copy right now");
    }
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
  const rewardMilestones = [
    {
      key: "edge_credits",
      title: "Edge credits",
      cadence: `Every ${referral?.progress.edgeCreditThreshold ?? 5} paid referrals`,
      detail: `${referral?.progress.edgeCreditAmount ?? 1000} Edge credits`,
      remaining: referral?.progress.nextEdgeCreditIn ?? 5,
      threshold: referral?.progress.edgeCreditThreshold ?? 5,
      icon: Gift,
    },
    {
      key: "free_month",
      title: "Free month",
      cadence: `Every ${referral?.progress.freeMonthThreshold ?? 20} paid referrals`,
      detail: "Free month on your current paid plan",
      remaining: referral?.progress.nextFreeMonthIn ?? 20,
      threshold: referral?.progress.freeMonthThreshold ?? 20,
      icon: Clock3,
    },
    {
      key: "upgrade_trial",
      title: "Upgrade trial",
      cadence: `Every ${referral?.progress.upgradeTrialThreshold ?? 40} paid referrals`,
      detail: "30-day next-plan upgrade when eligible",
      remaining: referral?.progress.nextUpgradeTrialIn ?? 40,
      threshold: referral?.progress.upgradeTrialThreshold ?? 40,
      icon: Rocket,
    },
  ].map((milestone) => {
    const earnedCount = Math.floor(paidConversions / milestone.threshold);
    const state = getRewardMilestoneState(
      paidConversions,
      milestone.threshold,
      milestone.remaining
    );

    return {
      ...milestone,
      earnedCount,
      state,
      statusLabel: formatRewardMilestoneStatus(
        state,
        milestone.remaining,
        earnedCount
      ),
    };
  });

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

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Rocket className="size-4 text-amber-300" />
          <div>
            <p className="text-sm font-medium text-white">Reward ladder</p>
            <p className="text-xs text-white/42">
              Referral rewards follow the same ladder every time a paid conversion closes.
            </p>
          </div>
        </div>

        <div className="rounded-md border border-white/5 bg-sidebar px-4 py-6">
          <div className="overflow-x-auto pb-1">
            <div className="flex min-w-[520px] items-start justify-center px-2">
              {rewardMilestones.map((milestone, index) => {
                const Icon = milestone.icon;

                return (
                  <div
                    key={milestone.key}
                    className="flex min-w-0 flex-1 items-start"
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="flex flex-col items-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                          aria-label={`View ${milestone.title} reward details`}
                        >
                          <div
                            className={cn(
                              "relative flex size-9 items-center justify-center rounded-full border-2 transition-all duration-300",
                              milestone.state === "active" &&
                                "border-blue-400 bg-blue-400/10 shadow-[0_0_12px_rgba(96,165,250,0.4)]",
                              milestone.state === "completed" &&
                                "border-emerald-400 bg-emerald-400/10",
                              milestone.state === "pending" &&
                                "border-white/10 bg-white/5"
                            )}
                          >
                            {milestone.state === "completed" ? (
                              <CheckCircle2 className="size-4 text-emerald-400" />
                            ) : milestone.state === "active" ? (
                              <Icon className="size-4 text-blue-400" />
                            ) : (
                              <Lock className="size-3.5 text-white/20" />
                            )}
                          </div>

                          <div className="mt-2.5 flex max-w-[140px] flex-col items-center text-center">
                            <span
                              className={cn(
                                "text-[10px] font-medium leading-tight",
                                milestone.state === "active" && "text-blue-400",
                                milestone.state === "completed" &&
                                  "text-emerald-400",
                                milestone.state === "pending" && "text-white/25"
                              )}
                            >
                              {milestone.title}
                            </span>
                            <span className="mt-0.5 text-[10px] tabular-nums text-white/30">
                              {milestone.cadence}
                            </span>
                            <span
                              className={cn(
                                "mt-0.5 text-[9px]",
                                milestone.state === "active" &&
                                  "text-blue-400/70",
                                milestone.state === "completed" &&
                                  "text-emerald-400/60",
                                milestone.state === "pending" && "text-white/15"
                              )}
                            >
                              {milestone.statusLabel}
                            </span>
                          </div>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        sideOffset={10}
                        className="px-0 py-0"
                      >
                        <RewardMilestoneTooltip
                          title={milestone.title}
                          detail={milestone.detail}
                          cadence={milestone.cadence}
                          remaining={milestone.remaining}
                          earnedCount={milestone.earnedCount}
                          state={milestone.state}
                        />
                      </TooltipContent>
                    </Tooltip>

                    {index < rewardMilestones.length - 1 ? (
                      <div className="flex min-w-[24px] flex-1 items-center px-2 pt-[18px]">
                        <div
                          className={cn(
                            "h-px w-full",
                            milestone.state === "completed" ||
                              milestone.state === "active"
                              ? "bg-white/15"
                              : "bg-white/5"
                          )}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

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
              tracking, managed offers, and a mentorship group. The application
              now lives on a dedicated review page.
            </p>
            <div className="rounded-sm border border-white/5 bg-sidebar-accent p-3">
              <p className="text-[11px] leading-5 text-white/38">
                We’ll review your promotion plan, audience size, current referral
                traction, and social presence before approval.
              </p>
            </div>
            <Button
              asChild
              className="h-9 rounded-sm border border-white/10 bg-sidebar px-4 text-xs text-white hover:bg-sidebar-accent"
            >
              <Link href="/dashboard/referrals/apply">
                {affiliate?.application
                  ? affiliate.application.status === "pending"
                    ? "Review application"
                    : "Update application"
                  : "Apply for affiliate access"}
              </Link>
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
