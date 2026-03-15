"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  BadgePercent,
  Banknote,
  Gift,
  Shield,
  TrendingUp,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  GrowthCardShell,
  GrowthPageBody,
  GrowthPageShell,
} from "@/features/growth/components/growth-page-primitives";
import { trpc } from "@/utils/trpc";

export function GrowthOverview() {
  const billingStateQuery = trpc.billing.getState.useQuery();

  const affiliate = billingStateQuery.data?.affiliate;
  const isAdmin = billingStateQuery.data?.admin?.isAdmin === true;

  if (billingStateQuery.isLoading) {
    return (
      <GrowthPageShell
        title="Growth"
        description="Manage referrals, affiliate access, and the related admin tooling"
      >
        <GrowthPageBody className="space-y-4">
          <div className="h-40 animate-pulse rounded-sm bg-sidebar" />
          <div className="grid gap-3 lg:grid-cols-2">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className="h-48 animate-pulse rounded-sm bg-sidebar"
              />
            ))}
          </div>
        </GrowthPageBody>
      </GrowthPageShell>
    );
  }

  return (
    <GrowthPageShell
      title="Growth"
      description="Manage referrals, affiliate access, and the related admin tooling"
    >
      <GrowthPageBody className="space-y-6">
        <GrowthCardShell className="overflow-hidden">
          <div className="border-b border-white/5 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.14),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-6">
            <Badge className="rounded-full bg-emerald-500/10 text-[10px] text-emerald-200 ring ring-emerald-500/15">
              Growth hub
            </Badge>
            <p className="mt-3 text-lg font-semibold tracking-[-0.04em] text-white">
              Growth routes now live outside Billing
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
              Referrals, affiliate tooling, and admin operations now have their
              own dashboard surfaces, while payout methods stay attached to
              Billing.
            </p>
          </div>

          <div className="grid gap-3 p-6 lg:grid-cols-2">
            <GrowthCardShell>
              <div className="p-5">
                <div className="flex items-center gap-2">
                  <Gift className="size-3.5 text-amber-300" />
                  <p className="text-xs font-medium text-white">Referrals</p>
                </div>
                <p className="mt-3 text-sm leading-6 text-white/45">
                  Share your referral link, track milestone rewards, and apply for
                  affiliate access from the referrals route.
                </p>
                <Button
                  asChild
                  className="mt-5 h-9 rounded-sm border border-white/10 bg-sidebar px-4 text-xs text-white hover:bg-sidebar"
                >
                  <Link href="/dashboard/referrals">Open referrals</Link>
                </Button>
              </div>
            </GrowthCardShell>

            <GrowthCardShell>
              <div className="p-5">
                <div className="flex items-center gap-2">
                  <BadgePercent className="size-3.5 text-emerald-300" />
                  <p className="text-xs font-medium text-white">Affiliate</p>
                </div>
                <p className="mt-3 text-sm leading-6 text-white/45">
                  Approved affiliates track recurring commission, invite activity,
                  and mentorship-group ownership from the affiliate dashboard.
                </p>
                {affiliate?.isAffiliate || isAdmin ? (
                  <Button
                    asChild
                    className="mt-5 h-9 rounded-sm border border-white/10 bg-sidebar px-4 text-xs text-white hover:bg-sidebar"
                  >
                    <Link href="/dashboard/affiliate">Open affiliate dashboard</Link>
                  </Button>
                ) : (
                  <p className="mt-5 text-[11px] text-white/35">
                    Not approved yet. Apply from the referrals page.
                  </p>
                )}
              </div>
            </GrowthCardShell>

            <GrowthCardShell>
              <div className="p-5">
                <div className="flex items-center gap-2">
                  <Banknote className="size-3.5 text-blue-300" />
                  <p className="text-xs font-medium text-white">Payment methods</p>
                </div>
                <p className="mt-3 text-sm leading-6 text-white/45">
                  Affiliate payout methods stay in Billing so commission
                  instructions live next to the subscription and wallet details.
                </p>
                {affiliate?.isAffiliate ? (
                  <Button
                    asChild
                    className="mt-5 h-9 rounded-sm border border-white/10 bg-sidebar px-4 text-xs text-white hover:bg-sidebar"
                  >
                    <Link href="/dashboard/settings/billing/payment-methods">
                      Open billing payment methods
                    </Link>
                  </Button>
                ) : (
                  <p className="mt-5 text-[11px] text-white/35">
                    Payment methods appear in Billing after affiliate approval.
                  </p>
                )}
              </div>
            </GrowthCardShell>

            <GrowthCardShell>
              <div className="p-5">
                <div className="flex items-center gap-2">
                  <Shield className="size-3.5 text-teal-300" />
                  <p className="text-xs font-medium text-white">Growth admin</p>
                </div>
                <p className="mt-3 text-sm leading-6 text-white/45">
                  Admins manage beta codes, affiliate approvals, waitlist review,
                  and manual commission payouts from a dedicated route.
                </p>
                {isAdmin ? (
                  <Button
                    asChild
                    className="mt-5 h-9 rounded-sm border border-white/10 bg-sidebar px-4 text-xs text-white hover:bg-sidebar"
                  >
                    <Link href="/dashboard/growth-admin">Open growth admin</Link>
                  </Button>
                ) : (
                  <p className="mt-5 text-[11px] text-white/35">
                    Growth admin is only available to allowlisted admin accounts.
                  </p>
                )}
              </div>
            </GrowthCardShell>
          </div>
        </GrowthCardShell>

        <div className="grid gap-3 xl:grid-cols-3">
          {[
            {
              icon: TrendingUp,
              label: "Growth hub",
              detail: "Overview route for all growth surfaces and ownership.",
            },
            {
              icon: Users,
              label: "Separate programs",
              detail: "Referrals and affiliates stay split with different rewards.",
            },
            {
              icon: Shield,
              label: "Admin workflows",
              detail: "Operational controls are no longer buried in billing settings.",
            },
          ].map((item) => (
            <GrowthCardShell key={item.label}>
              <div className="p-4">
                <item.icon className="size-4 text-white/65" />
                <p className="mt-4 text-sm font-medium text-white">{item.label}</p>
                <p className="mt-2 text-sm leading-6 text-white/40">
                  {item.detail}
                </p>
              </div>
            </GrowthCardShell>
          ))}
        </div>
      </GrowthPageBody>
    </GrowthPageShell>
  );
}
