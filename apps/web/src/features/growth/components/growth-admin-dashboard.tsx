"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  BadgePercent,
  CheckCircle2,
  Shield,
  Wallet,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GoalContentSeparator,
  GoalPanel,
  GoalSurface,
} from "@/components/goals/goal-surface";
import {
  GrowthEmptyState,
  GrowthStatCard,
} from "@/features/growth/components/growth-goals-primitives";
import { getBillingV2Options } from "@/features/growth/lib/billing-v2";
import { trpc, trpcOptions } from "@/utils/trpc";

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

function formatCurrencyCode(value?: string | null) {
  return (value || "USD").toUpperCase();
}

function formatStatusLabel(status?: string | null) {
  if (!status) return "Pending";
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatPaymentMethodType(methodType?: string | null) {
  if (!methodType) return "Other";
  return methodType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatDestinationType(destinationType?: string | null) {
  if (!destinationType) return "Manual";
  return destinationType === "stripe_connect"
    ? "Stripe Connect"
    : destinationType.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatPercentValue(value?: number | null) {
  const percentage = (value ?? 0) / 100;
  if (Number.isInteger(percentage)) {
    return `${percentage.toFixed(0)}%`;
  }

  return `${percentage.toFixed(2).replace(/\.?0+$/, "")}%`;
}

function formatPercentInput(value?: number | null) {
  const percentage = (value ?? 0) / 100;
  if (Number.isInteger(percentage)) {
    return percentage.toFixed(0);
  }

  return percentage.toFixed(2).replace(/\.?0+$/, "");
}

function formatCompactNumber(value?: number | null) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value ?? 0);
}

function requestOptionalNote(promptLabel: string) {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.prompt(promptLabel, "");
  if (value === null) {
    return null;
  }

  return value.trim() || undefined;
}

function parsePercentToBasisPoints(
  value: string,
  { min = 0, max = 100 }: { min?: number; max?: number } = {}
) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return null;
  }

  return Math.round(parsed * 100);
}

export function GrowthAdminDashboard() {
  const [tierDrafts, setTierDrafts] = useState<
    Record<
      string,
      {
        tierMode: "automatic" | "manual";
        tierKey: string;
        code: string;
        label: string;
        discountPercent: string;
        commissionPercent: string;
        badgeLabel: string;
        effectVariant: string;
        benefitFlags: Record<string, boolean>;
      }
    >
  >({});
  const [selectedAffiliateUserId, setSelectedAffiliateUserId] = useState("");
  const [grantAffiliateIdentifier, setGrantAffiliateIdentifier] = useState("");
  const [isAffiliateSettingsDialogOpen, setAffiliateSettingsDialogOpen] =
    useState(false);
  const billingV2 = getBillingV2Options();

  const billingStateQuery = trpc.billing.getState.useQuery();
  const affiliateApplicationsQuery = useQuery({
    ...trpcOptions.billing.listAffiliateApplications.queryOptions(),
    enabled: billingStateQuery.data?.admin?.isAdmin === true,
  });
  const affiliatePayoutQueueQuery = useQuery({
    ...trpcOptions.billing.listAffiliatePayoutQueue.queryOptions(),
    enabled: billingStateQuery.data?.admin?.isAdmin === true,
  });
  const approveAffiliate = useMutation({
    ...trpcOptions.billing.approveAffiliate.mutationOptions(),
    onSuccess: () => {
      void affiliateApplicationsQuery.refetch();
      void billingStateQuery.refetch();
      toast.success("Affiliate approved");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to approve affiliate"
      );
    },
  });
  const rejectAffiliate = useMutation({
    ...trpcOptions.billing.rejectAffiliate.mutationOptions(),
    onSuccess: () => {
      void affiliateApplicationsQuery.refetch();
      toast.success("Affiliate application rejected");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to reject affiliate"
      );
    },
  });
  const grantAffiliate = useMutation({
    ...trpcOptions.billing.grantAffiliate.mutationOptions(),
    onSuccess: (result) => {
      setGrantAffiliateIdentifier("");
      void affiliateApplicationsQuery.refetch();
      void affiliatePayoutQueueQuery.refetch();
      void billingStateQuery.refetch();
      toast.success(
        `Affiliate access granted to ${result.user.name || result.user.email}.`
      );
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to grant affiliate access"
      );
    },
  });
  const saveAffiliateTierSettings = useMutation({
    ...(billingV2.saveAffiliateTierSettings?.mutationOptions?.() ?? {
      mutationFn: async () => {
        throw new Error("Affiliate tier settings are not available yet");
      },
    }),
    onSuccess: () => {
      void affiliatePayoutQueueQuery.refetch();
      void billingStateQuery.refetch();
      toast.success("Affiliate tier settings saved");
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to save affiliate tier settings"
      );
    },
  });
  const approveAffiliateWithdrawal = useMutation({
    ...(billingV2.approveAffiliateWithdrawal?.mutationOptions?.() ?? {
      mutationFn: async () => {
        throw new Error("Withdrawal approvals are not available yet");
      },
    }),
    onSuccess: () => {
      void affiliatePayoutQueueQuery.refetch();
      toast.success("Withdrawal approved");
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to approve withdrawal"
      );
    },
  });
  const sendAffiliateStripeWithdrawal = useMutation({
    ...(billingV2.sendAffiliateStripeWithdrawal?.mutationOptions?.() ?? {
      mutationFn: async () => {
        throw new Error("Stripe withdrawals are not available yet");
      },
    }),
    onSuccess: () => {
      void affiliatePayoutQueueQuery.refetch();
      toast.success("Stripe withdrawal sent");
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to send Stripe withdrawal"
      );
    },
  });
  const markAffiliateManualWithdrawalPaid = useMutation({
    ...(billingV2.markAffiliateManualWithdrawalPaid?.mutationOptions?.() ?? {
      mutationFn: async () => {
        throw new Error("Manual withdrawal settlement is not available yet");
      },
    }),
    onSuccess: () => {
      void affiliatePayoutQueueQuery.refetch();
      toast.success("Manual withdrawal marked paid");
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to mark manual withdrawal paid"
      );
    },
  });
  const rejectAffiliateWithdrawal = useMutation({
    ...(billingV2.rejectAffiliateWithdrawal?.mutationOptions?.() ?? {
      mutationFn: async () => {
        throw new Error("Withdrawal rejection is not available yet");
      },
    }),
    onSuccess: () => {
      void affiliatePayoutQueueQuery.refetch();
      toast.success("Withdrawal rejected");
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to reject withdrawal"
      );
    },
  });

  const getTierDraft = (entry: any) =>
    tierDrafts[entry.affiliate.id] ?? {
      tierMode: entry.tier?.mode ?? "automatic",
      tierKey: entry.tier?.key ?? "partner",
      code: entry.defaultOffer?.code ?? `${entry.affiliate.code}10`,
      label: entry.defaultOffer?.label ?? `${entry.affiliate.code} Affiliate Offer`,
      discountPercent: formatPercentInput(
        entry.tier?.effectiveDiscountBasisPoints ??
          entry.defaultOffer?.discountBasisPoints ??
          1000
      ),
      commissionPercent: formatPercentInput(
        entry.tier?.effectiveCommissionBps ?? entry.affiliate.commissionBps ?? 2000
      ),
      badgeLabel: entry.tier?.publicProof?.badgeLabel ?? "Affiliate",
      effectVariant: entry.tier?.publicProof?.effectVariant ?? "gold-emerald",
      benefitFlags:
        entry.tier?.benefitFlags ??
        Object.fromEntries(
          (entry.tier?.benefits ?? []).map((benefit: any) => [benefit.key, Boolean(benefit.enabled)])
        ),
    };

  const updateTierDraft = (
    affiliateUserId: string,
    patch: Partial<{
      tierMode: "automatic" | "manual";
      tierKey: string;
      code: string;
      label: string;
      discountPercent: string;
      commissionPercent: string;
      badgeLabel: string;
      effectVariant: string;
      benefitFlags: Record<string, boolean>;
    }>
  ) => {
    setTierDrafts((current) => ({
      ...current,
      [affiliateUserId]: {
        ...(current[affiliateUserId] ?? {
          tierMode: "automatic",
          tierKey: "partner",
          code: "",
          label: "",
          discountPercent: "10",
          commissionPercent: "20",
          badgeLabel: "Affiliate",
          effectVariant: "gold-emerald",
          benefitFlags: {},
        }),
        ...patch,
      },
    }));
  };

  const handleSaveAffiliateSettings = async (entry: any) => {
    const draft = getTierDraft(entry);
    const discountBasisPoints =
      draft.tierMode === "manual"
        ? parsePercentToBasisPoints(draft.discountPercent, {
            min: 1,
            max: 100,
          })
        : parsePercentToBasisPoints(draft.discountPercent, {
            min: 1,
            max: 100,
          });
    const commissionBps =
      draft.tierMode === "manual"
        ? parsePercentToBasisPoints(draft.commissionPercent, {
            min: 0,
            max: 100,
          })
        : parsePercentToBasisPoints(draft.commissionPercent, {
            min: 0,
            max: 100,
          });

    if (!draft.code.trim()) {
      toast.error("Offer code is required");
      return;
    }

    if (!draft.label.trim()) {
      toast.error("Offer label is required");
      return;
    }

    if (discountBasisPoints === null) {
      toast.error("Discount percent must be between 1 and 100");
      return;
    }

    if (commissionBps === null) {
      toast.error("Payout split percent must be between 0 and 100");
      return;
    }

    await saveAffiliateTierSettings.mutateAsync({
      affiliateUserId: entry.affiliate.id,
      tierMode: draft.tierMode,
      tierKey:
        draft.tierMode === "manual"
          ? (draft.tierKey as any)
          : entry.tier?.key ?? "partner",
      offerCode: draft.code.trim().toUpperCase(),
      offerLabel: draft.label.trim(),
      discountPercent: discountBasisPoints / 100,
      payoutSplitPercent: commissionBps / 100,
      badgeLabel: draft.badgeLabel.trim(),
      effectVariant: draft.effectVariant,
      benefits: Object.fromEntries(
        Object.entries(draft.benefitFlags).map(([key, value]) => [key, Boolean(value)])
      ),
    } as any);

    setAffiliateSettingsDialogOpen(false);
  };

  const affiliateApplications = affiliateApplicationsQuery.data ?? [];
  const payoutQueue = (affiliatePayoutQueueQuery.data ?? []) as any[];
  const pendingApplications = affiliateApplications.filter(
    (entry) => entry.application.status === "pending"
  ).length;
  const openWithdrawalCount = payoutQueue.reduce(
    (count, entry) =>
      count +
      ((entry.withdrawalRequests ?? []) as any[]).filter(
        (request) =>
          request.status === "pending" || request.status === "approved"
      ).length,
    0
  );
  const readyPayoutAmount = payoutQueue.reduce(
    (sum, entry) => sum + (entry.summary?.availableAmount ?? 0),
    0
  );
  const selectedAffiliateEntry =
    payoutQueue.find((entry) => entry.affiliate.id === selectedAffiliateUserId) ??
    payoutQueue[0] ??
    null;
  const selectedWithdrawalRequests = (
    selectedAffiliateEntry?.withdrawalRequests ?? []
  ) as any[];
  const selectedPayouts = (selectedAffiliateEntry?.payouts ??
    selectedAffiliateEntry?.recentPayouts ??
    []) as any[];
  const selectedTierDraft = selectedAffiliateEntry
    ? getTierDraft(selectedAffiliateEntry)
    : null;
  const isSavingSelectedAffiliateSettings = Boolean(
    selectedAffiliateEntry &&
      saveAffiliateTierSettings.isPending &&
      (saveAffiliateTierSettings.variables as any)?.affiliateUserId ===
        selectedAffiliateEntry.affiliate.id
  );

  useEffect(() => {
    if (!payoutQueue.length) {
      if (selectedAffiliateUserId) {
        setSelectedAffiliateUserId("");
      }
      return;
    }

    const hasSelectedAffiliate = payoutQueue.some(
      (entry) => entry.affiliate.id === selectedAffiliateUserId
    );

    if (!selectedAffiliateUserId || !hasSelectedAffiliate) {
      setSelectedAffiliateUserId(payoutQueue[0].affiliate.id);
    }
  }, [payoutQueue, selectedAffiliateUserId]);

  if (billingStateQuery.isLoading) {
    return <RouteLoadingFallback route="growthAdmin" className="min-h-[calc(100vh-10rem)]" />;
  }

  if (billingStateQuery.data?.admin?.isAdmin !== true) {
    return (
      <main className="p-6 py-4">
        <GoalSurface className="max-w-2xl">
          <div className="p-6">
            <p className="text-sm font-medium text-white">Admin access required</p>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">
              This route is only available to staff accounts.
            </p>
          </div>
        </GoalSurface>
      </main>
    );
  }

  return (
    <main className="space-y-6 p-6 py-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <GrowthStatCard
          icon={BadgePercent}
          label="Pending applications"
          value={pendingApplications}
          color="text-blue-300"
        />
        <GrowthStatCard
          icon={Wallet}
          label="Open withdrawals"
          value={openWithdrawalCount}
          color="text-emerald-300"
        />
        <GrowthStatCard
          icon={Shield}
          label="Ready to settle"
          value={formatCurrency(readyPayoutAmount)}
          color="text-teal-300"
        />
      </div>

      <GoalSurface>
        <div className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <Badge className="rounded-full bg-teal-500/10 text-[10px] text-teal-200 ring ring-teal-500/15">
                Admin only
              </Badge>
              <p className="mt-3 text-2xl font-semibold text-white">
                Operational controls for affiliate review and payout settlement
              </p>
              <p className="mt-2 text-sm leading-6 text-white/45">
                Affiliate approvals, offer configuration, and payout actions
                follow the same dashboard rhythm as goals: key metrics first,
                then the operating panels.
              </p>
            </div>

            <div className="rounded-sm border border-white/5 bg-sidebar/70 px-4 py-3 text-right">
              <p className="text-[10px] text-white/25">
                Ready to settle
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {formatCurrency(readyPayoutAmount)}
              </p>
            </div>
          </div>

          <GoalContentSeparator className="my-5" />

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-sm border border-white/5 bg-sidebar/70 p-3">
              <p className="text-[10px] text-white/25">
                Affiliate review
              </p>
              <p className="mt-2 text-sm text-white/65">
                Approvals, offer configuration, and payout split changes stay tied
                to the same affiliate record.
              </p>
            </div>
            <div className="rounded-sm border border-white/5 bg-sidebar/70 p-3">
              <p className="text-[10px] text-white/25">
                Settlement flow
              </p>
              <p className="mt-2 text-sm text-white/65">
                Open withdrawal requests, affiliate offer updates, and payout
                split changes stay on one operational surface.
              </p>
            </div>
            <div className="rounded-sm border border-white/5 bg-sidebar/70 p-3">
              <p className="text-[10px] text-white/25">
                Commission controls
              </p>
              <p className="mt-2 text-sm text-white/65">
                Tune offer discount, payout split, and public proof effects from
                the same admin workflow.
              </p>
            </div>
          </div>
        </div>
      </GoalSurface>

      <div className="grid gap-6">
        <GoalPanel
          icon={Wallet}
          title="Affiliate withdrawals and payouts"
          description="Approve withdrawal requests, update default offers, and configure payout splits from one admin surface."
          bodyClassName="space-y-3"
        >
          {payoutQueue.length ? (
            <>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="grid gap-3 md:grid-cols-[minmax(0,320px)_auto]">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-white/35">Affiliate</Label>
                    <Select
                      value={selectedAffiliateUserId}
                      onValueChange={setSelectedAffiliateUserId}
                    >
                      <SelectTrigger className="h-10 w-full bg-sidebar text-xs ring-white/5">
                        <SelectValue placeholder="Select affiliate" />
                      </SelectTrigger>
                      <SelectContent>
                        {payoutQueue.map((entry) => (
                          <SelectItem key={entry.affiliate.id} value={entry.affiliate.id}>
                            {entry.affiliate.name || entry.affiliate.email} · {entry.affiliate.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    onClick={() => setAffiliateSettingsDialogOpen(true)}
                    disabled={!selectedAffiliateEntry}
                    className="h-10 rounded-sm bg-sidebar px-4 text-xs text-white ring ring-white/10 hover:bg-sidebar-accent"
                  >
                    Edit affiliate settings
                  </Button>
                </div>

                {selectedAffiliateEntry ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-emerald-900/30 text-[10px] text-emerald-300 ring ring-emerald-500/20">
                      {formatCurrency(selectedAffiliateEntry.summary.availableAmount)} ready
                    </Badge>
                    <Badge className="bg-white/5 text-[10px] text-white/65 ring ring-white/10">
                      {selectedAffiliateEntry.summary.availableEventCount} unpaid event
                      {selectedAffiliateEntry.summary.availableEventCount === 1 ? "" : "s"}
                    </Badge>
                    <Badge className="bg-amber-900/30 text-[10px] text-amber-200 ring ring-amber-500/20">
                      {selectedWithdrawalRequests.filter(
                        (request) =>
                          request.status === "pending" || request.status === "approved"
                      ).length}{" "}
                      open request
                      {selectedWithdrawalRequests.filter(
                        (request) =>
                          request.status === "pending" || request.status === "approved"
                      ).length === 1
                        ? ""
                        : "s"}
                    </Badge>
                  </div>
                ) : null}
              </div>

              {selectedAffiliateEntry ? (
                <>
                  <GoalSurface>
                    <div className="space-y-4 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-white">
                            {selectedAffiliateEntry.affiliate.name ||
                              selectedAffiliateEntry.affiliate.email}
                          </p>
                          <p className="mt-1 text-[11px] text-white/35">
                            {selectedAffiliateEntry.affiliate.email} · Code{" "}
                            {selectedAffiliateEntry.affiliate.code}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-[10px] text-white/25">Last payout</p>
                          <p className="mt-1 text-sm text-white/60">
                            {selectedPayouts[0]
                              ? `${formatCurrency(selectedPayouts[0].amountUsd ?? selectedPayouts[0].amount)} on ${formatDate(
                                  selectedPayouts[0].paidAt ??
                                    selectedPayouts[0].createdAt
                                )}`
                              : "No payout recorded yet"}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div>
                          <p className="text-[10px] text-white/25">Tier</p>
                          <p className="mt-1 text-sm font-medium text-white">
                            {selectedAffiliateEntry.tier?.label ?? "Partner"}
                          </p>
                          <p className="mt-1 text-[11px] text-white/40">
                            {selectedAffiliateEntry.tier?.modeLabel ?? "Automatic"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-white/25">Revenue</p>
                          <p className="mt-1 text-sm font-medium text-white">
                            {formatCurrency(
                              selectedAffiliateEntry.tier?.referredRevenueAmount ?? 0
                            )}
                          </p>
                          <p className="mt-1 text-[11px] text-white/40">
                            Referred commissionable revenue
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-white/25">Premium access</p>
                          <p className="mt-1 text-sm font-medium text-white">
                            {selectedAffiliateEntry.premiumAccess?.isActive
                              ? formatStatusLabel(
                                  selectedAffiliateEntry.premiumAccess.planKey
                                )
                              : "Inactive"}
                          </p>
                          <p className="mt-1 text-[11px] text-white/40">
                            {selectedAffiliateEntry.premiumAccess?.isActive
                              ? "Entitlement override active"
                              : "No affiliate override"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-white/25">Progress</p>
                          <p className="mt-1 text-sm font-medium text-white">
                            {selectedAffiliateEntry.tier?.progress?.statusMessage ??
                              "Elite is manually assigned"}
                          </p>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
                            <div
                              className="h-full rounded-full bg-emerald-400"
                              style={{
                                width: `${
                                  selectedAffiliateEntry.tier?.progress?.progressPercent ??
                                  100
                                }%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="rounded-sm border border-white/5 bg-sidebar-accent/70 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-[10px] text-white/25">Tier summary</p>
                            <p className="mt-1 text-sm font-medium text-white">
                              {selectedAffiliateEntry.tier?.summary ?? "Affiliate status"}
                            </p>
                          </div>
                          <Badge className="bg-white/5 text-[10px] text-white/65 ring ring-white/10">
                            {selectedAffiliateEntry.tier?.benefits?.length ?? 0} benefits
                          </Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge className="bg-emerald-900/30 text-[10px] text-emerald-300 ring ring-emerald-500/20">
                            {selectedAffiliateEntry.tier?.modeLabel ?? "Automatic"}
                          </Badge>
                          <Badge className="bg-white/5 text-[10px] text-white/65 ring ring-white/10">
                            {selectedAffiliateEntry.tier?.statusMessage ??
                              "Tier settings ready"}
                          </Badge>
                          {selectedAffiliateEntry.tier?.canCustomizeProof ? (
                            <Badge className="bg-teal-900/30 text-[10px] text-teal-300 ring ring-teal-500/20">
                              Proof customization enabled
                            </Badge>
                          ) : (
                            <Badge className="bg-white/5 text-[10px] text-white/45 ring ring-white/10">
                              Proof uses tier defaults
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-4">
                        <div className="rounded-sm border border-white/5 bg-sidebar-accent/70 p-3">
                          <p className="text-[10px] text-white/25">Default offer</p>
                          <p className="mt-1 text-sm text-white/75">
                            {selectedAffiliateEntry.defaultOffer?.code ?? "No default offer"}
                          </p>
                        </div>
                        <div className="rounded-sm border border-white/5 bg-sidebar-accent/70 p-3">
                          <p className="text-[10px] text-white/25">Discount</p>
                          <p className="mt-1 text-sm text-white/75">
                            {formatPercentValue(
                              selectedAffiliateEntry.tier
                                ?.effectiveDiscountBasisPoints ??
                                selectedAffiliateEntry.defaultOffer?.discountBasisPoints ??
                                0
                            )}
                          </p>
                        </div>
                        <div className="rounded-sm border border-white/5 bg-sidebar-accent/70 p-3">
                          <p className="text-[10px] text-white/25">Payout split</p>
                          <p className="mt-1 text-sm text-white/75">
                            {formatPercentValue(
                              selectedAffiliateEntry.tier?.effectiveCommissionBps ??
                                selectedAffiliateEntry.affiliate.commissionBps
                            )}
                          </p>
                        </div>
                        <div className="rounded-sm border border-white/5 bg-sidebar-accent/70 p-3">
                          <p className="text-[10px] text-white/25">Default link</p>
                          <p className="mt-1 truncate text-sm text-white/75">
                            {selectedAffiliateEntry.defaultLink?.shareUrl ?? "No default link"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </GoalSurface>

                  <Dialog
                    open={isAffiliateSettingsDialogOpen}
                    onOpenChange={setAffiliateSettingsDialogOpen}
                  >
                    <DialogContent className="max-w-xl border-white/10 bg-sidebar p-0 text-white">
                      <div className="p-5">
                        <DialogHeader>
                          <DialogTitle className="text-white">
                            Edit affiliate tier
                          </DialogTitle>
                          <DialogDescription className="text-white/45">
                            Update program mode, offer settings, proof styling, and benefits for{" "}
                            {selectedAffiliateEntry.affiliate.name ||
                              selectedAffiliateEntry.affiliate.email}
                            .
                          </DialogDescription>
                        </DialogHeader>

                        {selectedTierDraft ? (
                          <div className="mt-5 space-y-5">
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="space-y-1.5">
                                <Label className="text-[11px] text-white/35">
                                  Program mode
                                </Label>
                                <Select
                                  value={selectedTierDraft.tierMode}
                                  onValueChange={(value) =>
                                    updateTierDraft(selectedAffiliateEntry.affiliate.id, {
                                      tierMode: value as "automatic" | "manual",
                                      tierKey:
                                        value === "manual"
                                          ? selectedTierDraft.tierKey ||
                                            selectedAffiliateEntry.tier?.key ||
                                            "partner"
                                          : selectedAffiliateEntry.tier?.key ?? "partner",
                                      code: value === "automatic"
                                        ? selectedAffiliateEntry.defaultOffer?.code ??
                                          selectedTierDraft.code
                                        : selectedTierDraft.code,
                                      label: value === "automatic"
                                        ? selectedAffiliateEntry.defaultOffer?.label ??
                                          selectedTierDraft.label
                                        : selectedTierDraft.label,
                                      discountPercent:
                                        value === "automatic"
                                          ? formatPercentInput(
                                              selectedAffiliateEntry.tier
                                                ?.effectiveDiscountBasisPoints ??
                                                selectedAffiliateEntry.defaultOffer
                                                  ?.discountBasisPoints ??
                                                1000
                                            )
                                          : selectedTierDraft.discountPercent,
                                      commissionPercent:
                                        value === "automatic"
                                          ? formatPercentInput(
                                              selectedAffiliateEntry.tier
                                                ?.effectiveCommissionBps ??
                                                selectedAffiliateEntry.affiliate
                                                  .commissionBps ??
                                                2000
                                            )
                                          : selectedTierDraft.commissionPercent,
                                      badgeLabel:
                                        value === "automatic"
                                          ? selectedAffiliateEntry.tier?.publicProof
                                              ?.badgeLabel ?? "Affiliate"
                                          : selectedTierDraft.badgeLabel,
                                      effectVariant:
                                        value === "automatic"
                                          ? selectedAffiliateEntry.tier?.publicProof
                                              ?.effectVariant ?? "gold-emerald"
                                          : selectedTierDraft.effectVariant,
                                      benefitFlags:
                                        value === "automatic"
                                          ? selectedAffiliateEntry.tier
                                              ?.benefitFlags ?? {}
                                          : selectedTierDraft.benefitFlags,
                                    })
                                  }
                                >
                                  <SelectTrigger className="h-10 bg-sidebar-accent text-xs ring-white/10">
                                    <SelectValue placeholder="Select mode" />
                                  </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="automatic">
                                        Automatic
                                      </SelectItem>
                                      <SelectItem value="manual">
                                        Manual override
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                              </div>

                              <div className="space-y-1.5">
                                <Label className="text-[11px] text-white/35">
                                  Manual tier
                                </Label>
                                <Select
                                  value={selectedTierDraft.tierKey}
                                  onValueChange={(value) =>
                                    updateTierDraft(selectedAffiliateEntry.affiliate.id, {
                                      tierKey: value,
                                    })
                                  }
                                  disabled={selectedTierDraft.tierMode !== "manual"}
                                >
                                  <SelectTrigger className="h-10 bg-sidebar-accent text-xs ring-white/10 disabled:cursor-not-allowed disabled:opacity-50">
                                    <SelectValue placeholder="Select tier" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {[
                                      ["partner", "Partner"],
                                      ["pro", "Pro"],
                                      ["elite", "Elite"],
                                    ].map(([value, label]) => (
                                      <SelectItem key={value} value={value}>
                                        {label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="rounded-sm border border-white/5 bg-sidebar-accent/60 p-3">
                                <p className="text-[10px] text-white/25">Current tier</p>
                                <p className="mt-1 text-sm font-medium text-white">
                                  {selectedAffiliateEntry.tier?.label ?? "Partner"}
                                </p>
                                <p className="mt-1 text-[11px] text-white/45">
                                  {selectedAffiliateEntry.tier?.summary ??
                                    "Affiliate status"}
                                </p>
                                <p className="mt-2 text-[10px] text-white/25">
                                  Revenue
                                </p>
                                <p className="mt-1 text-sm text-white/75">
                                  {formatCurrency(
                                    selectedAffiliateEntry.tier?.referredRevenueAmount ?? 0
                                  )}
                                </p>
                              </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="space-y-1.5">
                                <Label className="text-[11px] text-white/35">
                                  Offer code
                                </Label>
                                <Input
                                  value={selectedTierDraft.code}
                                  onChange={(event) =>
                                    updateTierDraft(selectedAffiliateEntry.affiliate.id, {
                                      code: event.target.value.toUpperCase(),
                                    })
                                  }
                                  placeholder="Offer code"
                                  className="h-10 bg-sidebar-accent text-xs ring-white/10"
                                />
                              </div>

                              <div className="space-y-1.5">
                                <Label className="text-[11px] text-white/35">
                                  Offer label
                                </Label>
                                <Input
                                  value={selectedTierDraft.label}
                                  onChange={(event) =>
                                    updateTierDraft(selectedAffiliateEntry.affiliate.id, {
                                      label: event.target.value,
                                    })
                                  }
                                  placeholder="Affiliate offer label"
                                  className="h-10 bg-sidebar-accent text-xs ring-white/10"
                                />
                              </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="space-y-1.5">
                                <Label className="text-[11px] text-white/35">
                                  Discount percent
                                </Label>
                                <Input
                                  value={selectedTierDraft.discountPercent}
                                  onChange={(event) =>
                                    updateTierDraft(selectedAffiliateEntry.affiliate.id, {
                                      discountPercent: event.target.value,
                                    })
                                  }
                                  placeholder="10"
                                  disabled={selectedTierDraft.tierMode === "automatic"}
                                  className="h-10 bg-sidebar-accent text-xs ring-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                                />
                                <p className="text-[10px] text-white/35">
                                  {selectedTierDraft.tierMode === "automatic"
                                    ? "Automatic tiers use the default discount for that tier."
                                    : "Enter a normal percentage, for example `15` for 15% off."}
                                </p>
                              </div>

                              <div className="space-y-1.5">
                                <Label className="text-[11px] text-white/35">
                                  Payout split percent
                                </Label>
                                <Input
                                  value={selectedTierDraft.commissionPercent}
                                  onChange={(event) =>
                                    updateTierDraft(selectedAffiliateEntry.affiliate.id, {
                                      commissionPercent: event.target.value,
                                    })
                                  }
                                  placeholder="20"
                                  disabled={selectedTierDraft.tierMode === "automatic"}
                                  className="h-10 bg-sidebar-accent text-xs ring-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                                />
                                <p className="text-[10px] text-white/35">
                                  {selectedTierDraft.tierMode === "automatic"
                                    ? "Automatic tiers use the default payout split for that tier."
                                    : "Enter a normal percentage, for example `25` for a 25% split."}
                                </p>
                              </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="space-y-1.5">
                                <Label className="text-[11px] text-white/35">
                                  Badge label
                                </Label>
                                <Input
                                  value={selectedTierDraft.badgeLabel}
                                  onChange={(event) =>
                                    updateTierDraft(selectedAffiliateEntry.affiliate.id, {
                                      badgeLabel: event.target.value,
                                    })
                                  }
                                  placeholder="Affiliate"
                                  disabled={selectedTierDraft.tierMode === "automatic"}
                                  className="h-10 bg-sidebar-accent text-xs ring-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                                />
                              </div>

                              <div className="space-y-1.5">
                                <Label className="text-[11px] text-white/35">
                                  Proof effect variant
                                </Label>
                                <Select
                                  value={selectedTierDraft.effectVariant}
                                  onValueChange={(value) =>
                                    updateTierDraft(selectedAffiliateEntry.affiliate.id, {
                                      effectVariant: value,
                                    })
                                  }
                                  disabled={selectedTierDraft.tierMode === "automatic"}
                                >
                                  <SelectTrigger className="h-10 bg-sidebar-accent text-xs ring-white/10 disabled:cursor-not-allowed disabled:opacity-50">
                                    <SelectValue placeholder="Select effect" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {[
                                      "gold-emerald",
                                      "emerald_aurora",
                                      "teal_signal",
                                    ].map((variant) => (
                                      <SelectItem key={variant} value={variant}>
                                        {variant.replace(/_/g, " ")}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-[11px] text-white/35">
                                    Benefit toggles
                                  </p>
                                    <p className="mt-1 text-[10px] text-white/25">
                                      {selectedTierDraft.tierMode === "automatic"
                                        ? "Automatic tiers keep the default benefit set."
                                        : "Enable or disable tier-specific perks for this manually managed affiliate."}
                                    </p>
                                </div>
                                <Badge className="rounded-full bg-white/5 text-[10px] text-white/65 ring ring-white/10">
                                  {selectedAffiliateEntry.tier?.benefits?.length ?? 0} perks
                                </Badge>
                              </div>

                              <div className="grid gap-3 md:grid-cols-2">
                                {(selectedAffiliateEntry.tier?.benefits ?? []).map(
                                  (benefit: any) => (
                                    <div
                                      key={benefit.key}
                                      className="rounded-sm border border-white/5 bg-sidebar-accent/60 p-3"
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <p className="text-sm text-white">
                                            {benefit.label}
                                          </p>
                                          <p className="mt-1 text-[11px] leading-5 text-white/35">
                                            {benefit.description}
                                          </p>
                                        </div>
                                        <Switch
                                          checked={
                                            selectedTierDraft.benefitFlags?.[benefit.key] ??
                                            benefit.enabled
                                          }
                                          disabled={
                                            selectedTierDraft.tierMode === "automatic"
                                          }
                                          onCheckedChange={(checked) =>
                                            updateTierDraft(selectedAffiliateEntry.affiliate.id, {
                                              benefitFlags: {
                                                ...(selectedTierDraft.benefitFlags ?? {}),
                                                [benefit.key]: checked,
                                              },
                                            })
                                          }
                                        />
                                      </div>
                                      <p className="mt-3 text-[10px] text-white/25">
                                        {benefit.ctaLabel}
                                      </p>
                                    </div>
                                  )
                                )}
                              </div>
                            </div>
                          </div>
                        ) : null}

                        <DialogFooter className="mt-5">
                          <Button
                            type="button"
                            onClick={() => setAffiliateSettingsDialogOpen(false)}
                            className="h-10 rounded-sm bg-sidebar px-4 text-xs text-white ring ring-white/10 hover:bg-sidebar-accent"
                          >
                            Close
                          </Button>
                          <Button
                            type="button"
                            onClick={() => handleSaveAffiliateSettings(selectedAffiliateEntry)}
                            disabled={isSavingSelectedAffiliateSettings}
                            className="h-10 rounded-sm bg-emerald-600 px-4 text-xs text-white hover:brightness-110"
                          >
                            {isSavingSelectedAffiliateSettings
                              ? "Saving..."
                              : "Save settings"}
                          </Button>
                        </DialogFooter>
                      </div>
                    </DialogContent>
                  </Dialog>
                </>
              ) : null}
            </>
          ) : (
            <GrowthEmptyState message="No approved affiliates have payout data yet." />
          )}
        </GoalPanel>
      </div>

      {selectedAffiliateEntry ? (
        <>
          <section className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex size-9 items-center justify-center rounded-sm border border-white/5 bg-sidebar-accent">
                  <Wallet className="size-4 text-emerald-300" />
                </div>
                <div>
                  <h2 className="text-sm font-medium text-white">
                    Withdrawal requests
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-white/45">
                    Review and settle pending requests for the selected affiliate.
                  </p>
                </div>
              </div>

              <Badge className="rounded-full bg-white/5 text-[10px] text-white/65 ring ring-white/10">
                {selectedWithdrawalRequests.length} requests
              </Badge>
            </div>

            {selectedWithdrawalRequests.length ? (
              <div className="overflow-hidden rounded-lg border border-white/5 bg-sidebar">
                <div className="overflow-x-auto">
                  <table className="min-w-[1160px] w-full text-left">
                    <thead className="bg-sidebar">
                      <tr className="border-b border-white/5">
                        {[
                          "Amount",
                          "Currency",
                          "Destination",
                          "Method",
                          "Status",
                          "Requested",
                          "Action",
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
                      {selectedWithdrawalRequests.map((request) => {
                        const isApproving =
                          approveAffiliateWithdrawal.isPending &&
                          (approveAffiliateWithdrawal.variables as any)
                            ?.withdrawalRequestId === request.id;
                        const isRejecting =
                          rejectAffiliateWithdrawal.isPending &&
                          (rejectAffiliateWithdrawal.variables as any)
                            ?.withdrawalRequestId === request.id;
                        const isSendingStripe =
                          sendAffiliateStripeWithdrawal.isPending &&
                          (sendAffiliateStripeWithdrawal.variables as any)
                            ?.withdrawalRequestId === request.id;
                        const isMarkingManual =
                          markAffiliateManualWithdrawalPaid.isPending &&
                          (markAffiliateManualWithdrawalPaid.variables as any)
                            ?.withdrawalRequestId === request.id;

                        return (
                          <tr
                            key={request.id}
                            className="border-b border-white/5 last:border-b-0"
                          >
                            <td className="px-4 py-3 text-sm text-white">
                              {formatCurrency(request.amountUsd ?? request.amount)}
                            </td>
                            <td className="px-4 py-3 text-sm text-white/75">
                              {formatCurrencyCode(request.currency)}
                            </td>
                            <td className="px-4 py-3 text-sm text-white/75">
                              {formatDestinationType(request.destinationType)}
                            </td>
                            <td className="px-4 py-3 text-sm text-white/75">
                              {request.destinationLabel ??
                                (request.destinationType === "stripe_connect"
                                  ? "Stripe Connect"
                                  : "Method removed")}
                              {request.paymentMethod?.detailsPreview ? (
                                <p className="mt-1 text-[10px] text-white/35">
                                  {request.paymentMethod.detailsPreview}
                                </p>
                              ) : null}
                            </td>
                            <td className="px-4 py-3">
                              <Badge className="ring ring-white/10 bg-white/5 text-[10px] text-white/65">
                                {formatStatusLabel(request.status)}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-sm text-white/75">
                              {formatDate(request.createdAt)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-2">
                                {request.status === "pending" ? (
                                  <>
                                    <Button
                                      onClick={() => {
                                        const notes = requestOptionalNote(
                                          "Add optional approval notes for this withdrawal"
                                        );
                                        if (notes === null) {
                                          return;
                                        }

                                        approveAffiliateWithdrawal.mutate({
                                          withdrawalRequestId: request.id,
                                          notes,
                                        } as any);
                                      }}
                                      disabled={approveAffiliateWithdrawal.isPending}
                                      className="h-8 rounded-sm bg-emerald-600 px-3 text-[11px] text-white hover:brightness-110"
                                    >
                                      <CheckCircle2 className="mr-1 size-3.5" />
                                      {isApproving ? "Approving..." : "Approve"}
                                    </Button>
                                    <Button
                                      onClick={() => {
                                        const notes = requestOptionalNote(
                                          "Add optional rejection notes for this withdrawal"
                                        );
                                        if (notes === null) {
                                          return;
                                        }

                                        rejectAffiliateWithdrawal.mutate({
                                          withdrawalRequestId: request.id,
                                          notes,
                                        } as any);
                                      }}
                                      disabled={rejectAffiliateWithdrawal.isPending}
                                      className="h-8 rounded-sm bg-rose-600/90 px-3 text-[11px] text-white hover:brightness-110"
                                    >
                                      <XCircle className="mr-1 size-3.5" />
                                      {isRejecting ? "Rejecting..." : "Reject"}
                                    </Button>
                                  </>
                                ) : null}

                                {(request.status === "approved" ||
                                  (request.status === "processing" &&
                                    request.requiresManualReconciliation)) &&
                                request.destinationType === "stripe_connect" ? (
                                  <Button
                                    onClick={() => {
                                      const notes = requestOptionalNote(
                                        request.status === "processing"
                                          ? "Add optional notes before finalizing this Stripe payout"
                                          : "Add optional notes before sending this Stripe payout"
                                      );
                                      if (notes === null) {
                                        return;
                                      }

                                      sendAffiliateStripeWithdrawal.mutate({
                                        withdrawalRequestId: request.id,
                                        notes,
                                      } as any);
                                    }}
                                    disabled={sendAffiliateStripeWithdrawal.isPending}
                                    className="h-8 rounded-sm bg-emerald-600 px-3 text-[11px] text-white hover:brightness-110"
                                  >
                                    {isSendingStripe
                                      ? request.status === "processing"
                                        ? "Finalizing..."
                                        : "Sending..."
                                      : request.status === "processing"
                                      ? "Finalize Stripe payout"
                                      : "Send Stripe payout"}
                                  </Button>
                                ) : null}

                                {request.status === "approved" &&
                                request.destinationType === "manual" ? (
                                  <Button
                                    onClick={() => {
                                      const externalReference = requestOptionalNote(
                                        "Add an optional external reference for this manual payout"
                                      );
                                      if (externalReference === null) {
                                        return;
                                      }

                                      markAffiliateManualWithdrawalPaid.mutate({
                                        withdrawalRequestId: request.id,
                                        externalReference,
                                      } as any);
                                    }}
                                    disabled={markAffiliateManualWithdrawalPaid.isPending}
                                    className="h-8 rounded-sm bg-emerald-600 px-3 text-[11px] text-white hover:brightness-110"
                                  >
                                    {isMarkingManual
                                      ? "Marking..."
                                      : "Mark manual payout paid"}
                                  </Button>
                                ) : null}

                                {request.status !== "pending" &&
                                !((request.status === "approved" &&
                                  (request.destinationType === "stripe_connect" ||
                                    request.destinationType === "manual")) ||
                                  (request.status === "processing" &&
                                    request.destinationType === "stripe_connect" &&
                                    request.requiresManualReconciliation)) ? (
                                  <span className="text-xs text-white/30">—</span>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="rounded-sm border border-dashed border-white/10 p-4 text-xs text-white/30">
                No withdrawal requests for this affiliate yet.
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex size-9 items-center justify-center rounded-sm border border-white/5 bg-sidebar-accent">
                  <Wallet className="size-4 text-emerald-300" />
                </div>
                <div>
                  <h2 className="text-sm font-medium text-white">
                    Payout history
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-white/45">
                    Every settled payout for the selected affiliate.
                  </p>
                </div>
              </div>

              <Badge className="rounded-full bg-white/5 text-[10px] text-white/65 ring ring-white/10">
                {selectedPayouts.length} payouts
              </Badge>
            </div>

            {selectedPayouts.length ? (
              <div className="overflow-hidden rounded-lg border border-white/5 bg-sidebar">
                <div className="overflow-x-auto">
                  <table className="min-w-[1220px] w-full text-left">
                    <thead className="bg-sidebar">
                      <tr className="border-b border-white/5">
                        {[
                          "Amount",
                          "Currency",
                          "Destination",
                          "Method",
                          "Provider",
                          "Date",
                          "Reference",
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
                      {selectedPayouts.map((payout) => (
                        <tr
                          key={payout.id}
                          className="border-b border-white/5 last:border-b-0"
                        >
                          <td className="px-4 py-3 text-sm text-white">
                            {formatCurrency(payout.amountUsd ?? payout.amount)}
                          </td>
                          <td className="px-4 py-3 text-sm text-white/75">
                            {formatCurrencyCode(payout.currency)}
                          </td>
                          <td className="px-4 py-3 text-sm text-white/75">
                            {formatDestinationType(payout.destinationType)}
                          </td>
                          <td className="px-4 py-3 text-sm text-white/75">
                            {payout.destinationLabel ??
                              (payout.paymentMethod
                                ? `${payout.paymentMethod.label} · ${formatPaymentMethodType(
                                    payout.paymentMethod.methodType
                                  )}`
                                : payout.provider === "stripe_connect"
                                  ? "Stripe Connect"
                                  : "Method removed")}
                            {payout.paymentMethod?.detailsPreview ? (
                              <p className="mt-1 text-[10px] text-white/35">
                                {payout.paymentMethod.detailsPreview}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-sm text-white/75">
                            {payout.provider
                              ? formatStatusLabel(payout.provider)
                              : "Manual"}
                          </td>
                          <td className="px-4 py-3 text-sm text-white/75">
                            {formatDate(payout.paidAt ?? payout.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-sm text-white/75">
                            {payout.externalReference || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="rounded-sm border border-dashed border-white/10 p-4 text-xs text-white/30">
                No payouts have been recorded for this affiliate yet.
              </div>
            )}
          </section>
        </>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex size-9 items-center justify-center rounded-sm border border-white/5 bg-sidebar-accent">
              <BadgePercent className="size-4 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-sm font-medium text-white">
                Affiliate applications
              </h2>
              <p className="mt-1 text-sm leading-6 text-white/45">
                Review incoming affiliate requests and approve or reject them.
              </p>
            </div>
          </div>

          <Badge className="rounded-full bg-white/5 text-[10px] text-white/65 ring ring-white/10">
            {affiliateApplications.length} applications
          </Badge>
        </div>

        <div className="rounded-lg border border-white/5 bg-sidebar p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium text-white">Grant affiliate access</p>
              <p className="mt-1 text-sm text-white/45">
                Approve someone directly by email or username without an application.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
              <div className="w-full sm:min-w-[320px] lg:w-[360px]">
                <Label className="text-[11px] text-white/35">Email or username</Label>
                <Input
                  value={grantAffiliateIdentifier}
                  onChange={(event) => setGrantAffiliateIdentifier(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && grantAffiliateIdentifier.trim()) {
                      event.preventDefault();
                      grantAffiliate.mutate({
                        identifier: grantAffiliateIdentifier.trim(),
                      });
                    }
                  }}
                  placeholder="name@example.com or @username"
                  className="mt-1 h-10 bg-sidebar-accent text-xs ring-white/10"
                />
              </div>

              <Button
                onClick={() =>
                  grantAffiliate.mutate({
                    identifier: grantAffiliateIdentifier.trim(),
                  })
                }
                disabled={grantAffiliate.isPending || !grantAffiliateIdentifier.trim()}
                className="h-10 rounded-sm bg-emerald-600 px-4 text-xs text-white hover:brightness-110"
              >
                {grantAffiliate.isPending ? "Granting..." : "Grant access"}
              </Button>
            </div>
          </div>
        </div>

        {affiliateApplications.length ? (
          <div className="overflow-hidden rounded-lg border border-white/5 bg-sidebar">
            <div className="overflow-x-auto">
              <table className="min-w-[1020px] w-full text-left">
                <thead className="bg-sidebar">
                  <tr className="border-b border-white/5">
                    {[
                      "Username",
                      "Email",
                      "Application",
                      "Status",
                      "Actions",
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
                  {affiliateApplications.map((entry) => {
                    const isApproving =
                      approveAffiliate.isPending &&
                      (approveAffiliate.variables as any)?.applicationId ===
                        entry.application.id;
                    const isRejecting =
                      rejectAffiliate.isPending &&
                      (rejectAffiliate.variables as any)?.applicationId ===
                        entry.application.id;
                    const username =
                      entry.user.username ??
                      (entry.user.email ? entry.user.email.split("@")[0] : "—");
                    const applicationDetails =
                      entry.application.details &&
                      typeof entry.application.details === "object"
                        ? entry.application.details
                        : null;
                    const socialLinks = [
                      applicationDetails?.twitter ?? entry.user.twitter,
                      applicationDetails?.discord ?? entry.user.discord,
                      applicationDetails?.website ?? entry.user.website,
                    ].filter(Boolean);

                    return (
                      <tr
                        key={entry.application.id}
                        className="border-b border-white/5 last:border-b-0"
                      >
                        <td className="px-4 py-3 text-sm text-white">
                          {username ? `@${username}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-white/75">
                          {entry.user.email}
                        </td>
                        <td className="px-4 py-3 text-sm text-white/75">
                          <div className="space-y-2">
                            <p className="text-sm leading-6 text-white/75">
                              {applicationDetails?.whyApply ||
                                entry.application.message ||
                                "No application note"}
                            </p>
                            {applicationDetails?.promotionPlan ? (
                              <p className="text-xs leading-5 text-white/45">
                                Promotion plan: {applicationDetails.promotionPlan}
                              </p>
                            ) : null}
                            <div className="flex flex-wrap gap-2 text-[11px] text-white/38">
                              <span className="rounded-sm border border-white/8 bg-white/[0.03] px-2 py-1">
                                Program signups: {entry.referralStats?.signups ?? 0}
                              </span>
                              <span className="rounded-sm border border-white/8 bg-white/[0.03] px-2 py-1">
                                Paid referrals: {entry.referralStats?.paidConversions ?? 0}
                              </span>
                              <span className="rounded-sm border border-white/8 bg-white/[0.03] px-2 py-1">
                                Est. monthly referrals:{" "}
                                {applicationDetails?.estimatedMonthlyReferrals ?? 0}
                              </span>
                              {(applicationDetails?.audienceSize ?? null) !== null ? (
                                <span className="rounded-sm border border-white/8 bg-white/[0.03] px-2 py-1">
                                  Audience:{" "}
                                  {formatCompactNumber(applicationDetails?.audienceSize)}
                                </span>
                              ) : null}
                            </div>
                            {socialLinks.length ? (
                              <p className="text-xs leading-5 text-white/42">
                                Socials: {socialLinks.join(" · ")}
                              </p>
                            ) : null}
                            {applicationDetails?.otherSocials ? (
                              <p className="text-xs leading-5 text-white/42">
                                Other socials: {applicationDetails.otherSocials}
                              </p>
                            ) : null}
                            {applicationDetails?.location ?? entry.user.location ? (
                              <p className="text-xs leading-5 text-white/34">
                                Location:{" "}
                                {applicationDetails?.location ?? entry.user.location}
                              </p>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className="bg-white/5 text-[10px] text-white/65 ring ring-white/10">
                            {formatStatusLabel(entry.application.status)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {entry.application.status === "pending" ? (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                onClick={() => {
                                  const adminNotes = requestOptionalNote(
                                    "Add optional private admin notes for this approval"
                                  );
                                  if (adminNotes === null) {
                                    return;
                                  }

                                  approveAffiliate.mutate({
                                    applicationId: entry.application.id,
                                    adminNotes,
                                  });
                                }}
                                disabled={approveAffiliate.isPending}
                                className="h-8 rounded-sm bg-emerald-600 px-3 text-[11px] text-white hover:brightness-110"
                              >
                                {isApproving ? "Approving..." : "Approve"}
                              </Button>
                              <Button
                                onClick={() => {
                                  const adminNotes = requestOptionalNote(
                                    "Add optional private admin notes for this rejection"
                                  );
                                  if (adminNotes === null) {
                                    return;
                                  }

                                  rejectAffiliate.mutate({
                                    applicationId: entry.application.id,
                                    adminNotes,
                                  });
                                }}
                                disabled={rejectAffiliate.isPending}
                                className="h-8 rounded-sm bg-rose-600 px-3 text-[11px] text-white hover:brightness-110"
                              >
                                {isRejecting ? "Rejecting..." : "Reject"}
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-white/30">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-sm border border-dashed border-white/10 p-4 text-xs text-white/30">
            No affiliate applications yet.
          </div>
        )}
      </section>
    </main>
  );
}
