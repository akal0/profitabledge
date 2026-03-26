"use client";

import Link from "next/link";
import {
  BadgePercent,
  CheckCircle2,
  CircleHelp,
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
import { getPropAssignActionButtonClassName } from "@/features/accounts/lib/prop-assign-action-button";
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

function formatRewardType(
  rewardType?: string | null,
  targetPlanKey?: string | null
) {
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

function formatSourceLabel(source?: string | null) {
  if (!source) return "App";
  const normalized = source.replace(/_/g, " ").trim().toLowerCase();
  if (!normalized) return "App";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatCompactReference(value?: string | null) {
  if (!value) return "—";
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}...${value.slice(-4)}`;
}

function getConversionStatusBadgeClassName(status?: string | null) {
  if (status === "paid") {
    return "ring ring-emerald-500/20 bg-emerald-500/12 text-emerald-200";
  }

  if (status === "signed_up") {
    return "ring ring-amber-500/20 bg-amber-500/12 text-amber-200";
  }

  return "ring ring-white/10 bg-white/5 text-white/65";
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
  const nextUnlockLabel =
    remaining === 0 ? "Available now" : `${remaining} more paid conversions`;

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
          <span className="text-[11px] font-medium text-white/85">
            {cadence}
          </span>
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
  const conversions = referral?.conversions ?? [];

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
              className="h-8 rounded-sm ring ring-white/10 bg-sidebar px-3 text-xs text-white hover:bg-sidebar"
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
      cadence: `Every ${
        referral?.progress.edgeCreditThreshold ?? 5
      } paid conversions`,
      detail: `${referral?.progress.edgeCreditAmount ?? 1000} Edge credits`,
      remaining: referral?.progress.nextEdgeCreditIn ?? 5,
      threshold: referral?.progress.edgeCreditThreshold ?? 5,
      icon: Gift,
    },
    {
      key: "free_month",
      title: "Free month",
      cadence: `Every ${
        referral?.progress.freeMonthThreshold ?? 20
      } paid conversions`,
      detail: "Free month on your current paid plan",
      remaining: referral?.progress.nextFreeMonthIn ?? 20,
      threshold: referral?.progress.freeMonthThreshold ?? 20,
      icon: Clock3,
    },
    {
      key: "upgrade_trial",
      title: "Upgrade trial",
      cadence: `Every ${
        referral?.progress.upgradeTrialThreshold ?? 40
      } paid conversions`,
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

  // Mark the first pending milestone as the current target
  let foundCurrentTarget = false;
  for (const milestone of rewardMilestones) {
    if (milestone.state === "pending" && !foundCurrentTarget) {
      (milestone as any).isCurrentTarget = true;
      foundCurrentTarget = true;
    }
  }

  return (
    <main className="space-y-6 p-6 py-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {statCards.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            icon={stat.icon}
          />
        ))}

        <GoalPanel
          icon={BadgePercent}
          title="Apply for affiliate access"
          action={
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="flex size-6 items-center justify-center rounded-full text-white/35 transition-colors hover:text-white/60"
                  aria-label="Affiliate application review criteria"
                >
                  <CircleHelp className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={10} className="max-w-[280px]">
                <p className="text-xs leading-5 text-white/75">
                  We’ll review your promotion plan, audience size, current
                  referral traction, and social presence before approval.
                </p>
              </TooltipContent>
            </Tooltip>
          }
          bodyClassName="flex h-full flex-col"
        >
          <Button
            asChild
            className={getPropAssignActionButtonClassName({
              tone: "teal",
              className: "mt-auto w-full justify-center",
            })}
          >
            <Link href="/apply/affiliate">
              {affiliate?.application
                ? affiliate.application.status === "pending"
                  ? "Review application"
                  : "Update application"
                : "Apply for affiliate access"}
            </Link>
          </Button>
        </GoalPanel>
      </div>

      <GoalPanel
        icon={Gift}
        title="Referral share link"
        bodyClassName="flex flex-col"
      >
        <div className="mt-auto flex flex-col gap-2 lg:flex-row lg:items-end">
          <Input
            readOnly
            value={referral?.profile?.shareUrl ?? ""}
            className="w-full! flex-1 text-xs bg-sidebar-accent! hover:brightness-120!"
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
            className="h-9 cursor-pointer gap-1.5 rounded-sm ring ring-white/5 bg-sidebar-accent px-3 text-xs text-white hover:bg-sidebar-accent hover:brightness-120"
          >
            <Copy className="size-3" />
            Copy link
          </Button>
          <div className="flex items-center gap-2">
            <div className="rounded-sm ring ring-white/5 bg-sidebar-accent px-3 py-2 text-xs font-medium text-white/75">
              {referral?.profile?.code ?? "—"}
            </div>
            <Button
              onClick={() =>
                referral?.profile?.code
                  ? copyToClipboard(
                      referral.profile.code,
                      "Referral code copied"
                    )
                  : toast.error("Referral code is not ready yet")
              }
              className="h-9 cursor-pointer gap-1.5 rounded-sm ring ring-white/5 bg-sidebar-accent px-3 text-xs text-white hover:bg-sidebar-accent hover:brightness-120"
            >
              <Users className="size-3" />
              Copy code
            </Button>
          </div>
        </div>
      </GoalPanel>

      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <Rocket className="mt-0.5 size-4 text-amber-300" />
            <div>
              <p className="text-sm font-medium text-white">Reward ladder</p>
            </div>
          </div>

          <Badge className="rounded-full bg-white/5 text-[10px] text-white/65 ring ring-white/10">
            {paidConversions} paid conversion
            {paidConversions === 1 ? "" : "s"}
          </Badge>
        </div>

        <div className="rounded-md ring ring-white/5 bg-sidebar px-4 py-6">
          <div className="flex w-full items-start">
            {rewardMilestones.map((milestone, index) => {
              const Icon = milestone.icon;
              const isFirst = index === 0;
              const isLast = index === rewardMilestones.length - 1;
              const isAchieved =
                milestone.state === "completed" || milestone.state === "active";
              const isCurrentTarget = !!(milestone as any).isCurrentTarget;

              return (
                <div
                  key={milestone.key}
                  className="flex min-w-0 flex-1 items-start"
                >
                  {/* Leading connector */}
                  {!isFirst && (
                    <div className="flex min-w-[24px] flex-1 items-center px-2 pt-[18px]">
                      <div
                        className={cn(
                          "h-px w-full",
                          rewardMilestones[index - 1].state === "completed" ||
                            rewardMilestones[index - 1].state === "active"
                            ? "bg-amber-400/25"
                            : "bg-white/5"
                        )}
                      />
                    </div>
                  )}

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="flex shrink-0 flex-col items-center rounded-sm outline-none"
                        aria-label={`View ${milestone.title} reward details`}
                      >
                        <div
                          className={cn(
                            "relative flex size-9 items-center justify-center rounded-full border-2 transition-all duration-300",
                            isAchieved &&
                              "border-amber-400 bg-amber-400/10 shadow-[0_0_12px_rgba(251,191,36,0.3)]",
                            isCurrentTarget &&
                              "border-teal-400 bg-teal-400/10 shadow-[0_0_12px_rgba(45,212,191,0.4)]",
                            !isAchieved &&
                              !isCurrentTarget &&
                              "border-white/10 bg-white/5"
                          )}
                        >
                          {isAchieved ? (
                            <CheckCircle2 className="size-4 text-amber-400" />
                          ) : isCurrentTarget ? (
                            <Icon className="size-4 text-teal-400" />
                          ) : (
                            <Lock className="size-3.5 text-white/20" />
                          )}
                        </div>

                        <div className="mt-2.5 flex max-w-[140px] flex-col items-center text-center">
                          <span
                            className={cn(
                              "text-[10px] font-medium leading-tight",
                              isAchieved && "text-amber-400",
                              isCurrentTarget && "text-teal-400",
                              !isAchieved &&
                                !isCurrentTarget &&
                                "text-white/25"
                            )}
                          >
                            {milestone.title}
                          </span>
                          <span
                            className={cn(
                              "mt-0.5 text-[10px] tabular-nums",
                              isAchieved && "text-amber-400/50",
                              isCurrentTarget && "text-teal-400/50",
                              !isAchieved &&
                                !isCurrentTarget &&
                                "text-white/20"
                            )}
                          >
                            {milestone.cadence}
                          </span>
                          <span
                            className={cn(
                              "mt-0.5 text-[9px]",
                              isAchieved && "text-amber-400/60",
                              isCurrentTarget && "text-teal-400/70",
                              !isAchieved &&
                                !isCurrentTarget &&
                                "text-white/15"
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

                  {/* Trailing connector */}
                  {!isLast && (
                    <div className="flex min-w-[24px] flex-1 items-center px-2 pt-[18px]">
                      <div
                        className={cn(
                          "h-px w-full",
                          isAchieved ? "bg-amber-400/25" : "bg-white/5"
                        )}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-sm border border-white/5 bg-sidebar-accent">
              <Gift className="size-4 text-amber-300" />
            </div>
            <div>
              <h2 className="text-sm font-medium text-white">Reward history</h2>
            </div>
          </div>

          <Badge className="rounded-full bg-white/5 text-[10px] text-white/65 ring ring-white/10">
            {referral?.grants.length ?? 0} reward
            {(referral?.grants.length ?? 0) === 1 ? "" : "s"}
          </Badge>
        </div>

        {referral?.grants.length ? (
          <div className="overflow-hidden rounded-lg border border-white/5 bg-sidebar">
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full text-left">
                <thead className="bg-sidebar">
                  <tr className="border-b border-white/5">
                    {[
                      "Reward",
                      "Threshold",
                      "Status",
                      "Granted",
                    ].map((column) => (
                      <th
                        key={column}
                        className="px-4 py-3 text-left text-xs font-medium text-white/55"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-sidebar-accent/60">
                  {referral.grants.map((grant) => (
                    <tr
                      key={grant.id}
                      className="border-b border-white/5 last:border-b-0"
                    >
                      <td className="px-4 py-3 text-left align-top">
                        <p className="text-xs font-medium text-white">
                          {formatRewardType(grant.rewardType, grant.targetPlanKey)}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-left align-top text-xs text-white/75">
                        {grant.conversionCount} paid conversions
                      </td>
                      <td className="px-4 py-3 text-left align-top">
                        <div className="flex items-start">
                          <Badge className="bg-white/5 text-xs leading-none text-white/65 ring ring-white/10">
                            {formatStatusLabel(grant.status)}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-left align-top text-xs text-white/75">
                        {formatDate(grant.grantedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-sm ring ring-dashed ring-white/10 p-4 text-xs text-white/30">
            No referral rewards granted yet.
          </div>
        )}
      </section>

      <section className="space-y-3 pt-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-sm border border-white/5 bg-sidebar-accent">
              <Users className="size-4 text-amber-300" />
            </div>
            <div>
              <h2 className="text-sm font-medium text-white">
                Recent referrals
              </h2>
            </div>
          </div>

          <Badge className="rounded-full bg-white/5 text-[10px] text-white/65 ring ring-white/10">
            {conversions.length} referral{conversions.length === 1 ? "" : "s"}
          </Badge>
        </div>

        {conversions.length ? (
          <div className="overflow-hidden rounded-lg border border-white/5 bg-sidebar">
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full text-left">
                <thead className="bg-sidebar">
                  <tr className="border-b border-white/5">
                    {[
                      "Referral code",
                      "Status",
                      "Source",
                      "Joined",
                      "Paid conversion",
                      "Order reference",
                      "Subscription reference",
                    ].map((column) => (
                      <th
                        key={column}
                        className="px-4 py-3 text-left text-xs font-medium text-white/55"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-sidebar-accent/60">
                  {conversions.map((conversion) => (
                    <tr
                      key={conversion.id}
                      className="border-b border-white/5 last:border-b-0"
                    >
                      <td className="px-4 py-3 text-left align-top">
                        <p className="text-xs font-medium text-white">
                          {conversion.referralCode}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-left align-top">
                        <div className="flex items-start">
                          <Badge
                            className={cn(
                              "text-xs leading-none",
                              getConversionStatusBadgeClassName(
                                conversion.status
                              )
                            )}
                          >
                            {formatStatusLabel(conversion.status)}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-left align-top text-xs text-white/75">
                        {formatSourceLabel(conversion.source)}
                      </td>
                      <td className="px-4 py-3 text-left align-top text-xs text-white/75">
                        {formatDate(conversion.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-left align-top">
                        {conversion.paidAt ? (
                          <p className="text-xs text-white">
                            {formatDate(conversion.paidAt)}
                          </p>
                        ) : (
                          <p className="text-xs text-white/30">
                            Awaiting first paid order
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-left align-top">
                        {conversion.paidOrderId ? (
                          <p
                            className="text-xs text-white"
                            title={conversion.paidOrderId}
                          >
                            {formatCompactReference(conversion.paidOrderId)}
                          </p>
                        ) : (
                          <span className="text-xs text-white/30">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-left align-top">
                        {conversion.paidSubscriptionId ? (
                          <p
                            className="text-xs text-white/55"
                            title={conversion.paidSubscriptionId}
                          >
                            {formatCompactReference(conversion.paidSubscriptionId)}
                          </p>
                        ) : (
                          <span className="text-xs text-white/30">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-sm ring ring-dashed ring-white/10 p-4 text-xs text-white/30">
            No referrals yet. Share your code to start tracking signups.
          </div>
        )}
      </section>
    </main>
  );
}
