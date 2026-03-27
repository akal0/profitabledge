"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  BadgePercent,
  Banknote,
  Gift,
  Shield,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import {
  GoalContentSeparator,
  GoalPanel,
  GoalSurface,
} from "@/components/goals/goal-surface";
import { Button } from "@/components/ui/button";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import {
  GrowthEmptyState,
  GrowthStatCard,
} from "@/features/growth/components/growth-goals-primitives";
import { trpc } from "@/utils/trpc";

type GrowthRouteCard = {
  title: string;
  description: string;
  href: string;
  cta: string;
  icon: LucideIcon;
  available: boolean;
  unavailableMessage?: string;
};

export function GrowthOverview() {
  const billingStateQuery = trpc.billing.getState.useQuery();

  const affiliate = billingStateQuery.data?.affiliate;
  const isAdmin = billingStateQuery.data?.admin?.isAdmin === true;

  if (billingStateQuery.isLoading) {
    return (
      <RouteLoadingFallback
        route="growth"
        className="min-h-[calc(100vh-10rem)]"
      />
    );
  }

  const statCards = [
    {
      icon: Gift,
      label: "Referral program",
      value: "Live",
      color: "text-amber-300",
    },
    {
      icon: BadgePercent,
      label: "Affiliate access",
      value: affiliate?.isAffiliate ? "Approved" : "Pending",
      color: affiliate?.isAffiliate ? "text-emerald-300" : "text-white/55",
    },
    {
      icon: TrendingUp,
      label: "Attribution window",
      value: "180 days",
      color: "text-blue-300",
    },
    {
      icon: isAdmin ? Shield : Banknote,
      label: isAdmin ? "Admin tools" : "Payout rail",
      value: isAdmin ? "Enabled" : affiliate?.isAffiliate ? "Billing" : "Locked",
      color: isAdmin ? "text-teal-300" : "text-violet-300",
    },
  ] as const;

  const routeCards: GrowthRouteCard[] = [
    {
      title: "Referrals",
      description:
        "Share your invite link, monitor milestone rewards, and apply for affiliate access from the referrals route.",
      href: "/dashboard/referrals",
      cta: "Open referrals",
      icon: Gift,
      available: true,
    },
    {
      title: "Affiliate dashboard",
      description:
        "Approved affiliates track recurring commission, managed offers, tracked links, and performance surfaces here.",
      href: "/dashboard/affiliate",
      cta: "Open affiliate dashboard",
      icon: BadgePercent,
      available: affiliate?.isAffiliate || isAdmin,
      unavailableMessage: "Affiliate approval is required before this route unlocks.",
    },
    {
      title: "Billing payout methods",
      description:
        "Payout destinations stay under Billing so affiliate settlement lives next to the subscription and wallet flows.",
      href: "/dashboard/settings/billing/payment-methods",
      cta: "Open payment methods",
      icon: Banknote,
      available: affiliate?.isAffiliate === true,
      unavailableMessage: "Billing payout setup appears after affiliate approval.",
    },
    {
      title: "Growth admin",
      description:
        "Admins review affiliates, beta access, waitlist demand, and provider-aware payout settlement from one route.",
      href: "/dashboard/growth-admin",
      cta: "Open growth admin",
      icon: Shield,
      available: isAdmin,
      unavailableMessage: "This route is restricted to staff accounts.",
    },
  ];

  return (
    <main className="space-y-6 p-6 py-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card, index) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * (index + 1) }}
          >
            <GrowthStatCard
              icon={card.icon}
              label={card.label}
              value={card.value}
              color={card.color}
            />
          </motion.div>
        ))}
      </div>

      <GoalSurface>
        <div className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-xs text-white/30">
                Growth workspace
              </p>
              <p className="mt-3 text-2xl font-semibold text-white">
                Growth now follows the same operating surface as goals
              </p>
              <p className="mt-2 text-sm leading-6 text-white/45">
                Referrals, affiliate access, payout setup, and admin operations
                are split into focused routes, but they now live inside the same
                card system, spacing, and hierarchy as the goals dashboard.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                asChild
                className="h-9 rounded-sm border-none ring ring-white/10 bg-sidebar px-4 text-xs text-white hover:bg-sidebar hover:brightness-120"
              >
                <Link href="/dashboard/referrals">Open referrals</Link>
              </Button>
              {affiliate?.isAffiliate || isAdmin ? (
                <Button
                  asChild
                  className="h-9 rounded-sm border-none ring ring-white/10 bg-sidebar px-4 text-xs text-white hover:bg-sidebar hover:brightness-120"
                >
                  <Link href="/dashboard/affiliate">Open affiliate</Link>
                </Button>
              ) : null}
            </div>
          </div>

          <GoalContentSeparator className="my-5" />

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-sm border border-white/5 bg-sidebar/70 p-3">
              <p className="text-[10px] text-white/25">
                Routing
              </p>
              <p className="mt-2 text-sm text-white/65">
                Referrals and affiliate ownership stay split, while payouts remain
                attached to Billing.
              </p>
            </div>
            <div className="rounded-sm border border-white/5 bg-sidebar/70 p-3">
              <p className="text-[10px] text-white/25">
                Attribution
              </p>
              <p className="mt-2 text-sm text-white/65">
                First touch is durable across long purchase cycles, not just the
                initial session.
              </p>
            </div>
            <div className="rounded-sm border border-white/5 bg-sidebar/70 p-3">
              <p className="text-[10px] text-white/25">
                Operations
              </p>
              <p className="mt-2 text-sm text-white/65">
                Admin review, payout approval, and affiliate offers live in a
                dedicated route instead of being buried under billing settings.
              </p>
            </div>
          </div>
        </div>
      </GoalSurface>

      <div className="grid gap-6 xl:grid-cols-2">
        {routeCards
          .filter((card) => card.available || card.title !== "Growth admin")
          .map((card) => (
            <GoalPanel
              key={card.title}
              icon={card.icon}
              title={card.title}
              description={card.description}
              bodyClassName="space-y-4"
            >
              {card.available ? (
                <div className="flex items-center justify-between gap-3 rounded-sm border border-white/5 bg-sidebar/70 p-3">
                  <div>
                    <p className="text-[10px] text-white/25">
                      Route status
                    </p>
                    <p className="mt-2 text-sm text-white/65">Available now</p>
                  </div>
                  <Button
                    asChild
                    className="h-8 rounded-sm border-none ring ring-white/10 bg-sidebar px-3 text-[11px] text-white hover:bg-sidebar hover:brightness-120"
                  >
                    <Link href={card.href}>{card.cta}</Link>
                  </Button>
                </div>
              ) : (
                <GrowthEmptyState
                  message={card.unavailableMessage ?? "This route is not available yet."}
                />
              )}
            </GoalPanel>
          ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            icon: Sparkles,
            title: "Faster read",
            detail:
              "Growth summaries now scan like goals: top metrics first, then the actual operating surfaces.",
          },
          {
            icon: TrendingUp,
            title: "Clearer ownership",
            detail:
              "Each route has a single responsibility, so the dashboard stops mixing overview, billing, and admin actions.",
          },
          {
            icon: Shield,
            title: "Admin isolation",
            detail:
              "Operational controls remain visible for admins without bloating the standard user route.",
          },
        ].map((item) => (
          <GoalSurface key={item.title}>
            <div className="p-4">
              <item.icon className="h-4 w-4 text-white/60" />
              <p className="mt-4 text-sm font-medium text-white">{item.title}</p>
              <p className="mt-2 text-sm leading-6 text-white/40">
                {item.detail}
              </p>
            </div>
          </GoalSurface>
        ))}
      </div>
    </main>
  );
}
