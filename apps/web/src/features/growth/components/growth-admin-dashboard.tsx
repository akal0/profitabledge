"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  BadgePercent,
  CheckCircle2,
  Copy,
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
  const [betaForm, setBetaForm] = useState({
    label: "",
    description: "",
    code: "",
    maxRedemptions: "",
  });
  const [offerDrafts, setOfferDrafts] = useState<
    Record<
      string,
      {
        code: string;
        discountPercent: string;
        commissionPercent: string;
      }
    >
  >({});
  const [selectedAffiliateUserId, setSelectedAffiliateUserId] = useState("");
  const [isAffiliateSettingsDialogOpen, setAffiliateSettingsDialogOpen] =
    useState(false);
  const billingV2 = getBillingV2Options();

  const billingStateQuery = trpc.billing.getState.useQuery();
  const betaCodesQuery = useQuery({
    ...trpcOptions.billing.listPrivateBetaCodes.queryOptions(),
    enabled: billingStateQuery.data?.admin?.isAdmin === true,
  });
  const affiliateApplicationsQuery = useQuery({
    ...trpcOptions.billing.listAffiliateApplications.queryOptions(),
    enabled: billingStateQuery.data?.admin?.isAdmin === true,
  });
  const affiliatePayoutQueueQuery = useQuery({
    ...trpcOptions.billing.listAffiliatePayoutQueue.queryOptions(),
    enabled: billingStateQuery.data?.admin?.isAdmin === true,
  });
  const createPrivateBetaCode = useMutation(
    trpcOptions.billing.createPrivateBetaCode.mutationOptions()
  );
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
  const saveAffiliateOffer = useMutation({
    ...(billingV2.saveAffiliateOffer?.mutationOptions?.() ?? {
      mutationFn: async () => {
        throw new Error("Affiliate offers are not available yet");
      },
    }),
    onSuccess: () => {
      void affiliatePayoutQueueQuery.refetch();
      toast.success("Affiliate offer saved");
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to save affiliate offer"
      );
    },
  });
  const saveAffiliateCommissionSplit = useMutation({
    ...(billingV2.saveAffiliateCommissionSplit?.mutationOptions?.() ?? {
      mutationFn: async () => {
        throw new Error("Affiliate commission splits are not available yet");
      },
    }),
    onSuccess: () => {
      void affiliatePayoutQueueQuery.refetch();
      toast.success("Affiliate commission split saved");
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to save affiliate commission split"
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

  const copyToClipboard = async (value: string, message: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(message);
    } catch {
      toast.error("Unable to copy right now");
    }
  };

  const handleCreateBetaCode = async () => {
    if (!betaForm.label.trim()) {
      toast.error("Label is required");
      return;
    }

    const parsed = betaForm.maxRedemptions.trim()
      ? Number(betaForm.maxRedemptions)
      : null;
    if (parsed !== null && (!Number.isFinite(parsed) || parsed <= 0)) {
      toast.error("Max redemptions must be a positive number");
      return;
    }

    try {
      await createPrivateBetaCode.mutateAsync({
        label: betaForm.label.trim(),
        description: betaForm.description.trim() || undefined,
        code: betaForm.code.trim() || undefined,
        maxRedemptions: parsed ? Math.floor(parsed) : null,
      });
      setBetaForm({ label: "", description: "", code: "", maxRedemptions: "" });
      toast.success("Beta code created");
      void betaCodesQuery.refetch();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to create beta code"
      );
    }
  };

  const getOfferDraft = (entry: any) =>
    offerDrafts[entry.affiliate.id] ?? {
      code: entry.defaultOffer?.code ?? `${entry.affiliate.code}10`,
      discountPercent: formatPercentInput(
        entry.defaultOffer?.discountBasisPoints ?? 1000
      ),
      commissionPercent: formatPercentInput(entry.affiliate.commissionBps ?? 2000),
    };

  const updateOfferDraft = (
    affiliateUserId: string,
    patch: Partial<{
      code: string;
      discountPercent: string;
      commissionPercent: string;
    }>
  ) => {
    setOfferDrafts((current) => ({
      ...current,
      [affiliateUserId]: {
        ...(current[affiliateUserId] ?? {
          code: "",
          discountPercent: "10",
          commissionPercent: "20",
        }),
        ...patch,
      },
    }));
  };

  const handleSaveAffiliateSettings = async (entry: any) => {
    const draft = getOfferDraft(entry);
    const discountBasisPoints = parsePercentToBasisPoints(draft.discountPercent, {
      min: 1,
      max: 100,
    });
    const commissionBps = parsePercentToBasisPoints(draft.commissionPercent, {
      min: 0,
      max: 100,
    });

    if (!draft.code.trim()) {
      toast.error("Offer code is required");
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

    await saveAffiliateOffer.mutateAsync({
      affiliateUserId: entry.affiliate.id,
      affiliateOfferId: entry.defaultOffer?.id ?? undefined,
      code: draft.code.trim().toUpperCase(),
      label: `${entry.affiliate.name || entry.affiliate.code} Affiliate Offer`,
      discountBasisPoints,
      isDefault: true,
    } as any);

    await saveAffiliateCommissionSplit.mutateAsync({
      affiliateUserId: entry.affiliate.id,
      commissionBps,
    } as any);

    setAffiliateSettingsDialogOpen(false);
  };

  const betaCodes = betaCodesQuery.data ?? [];
  const affiliateApplications = affiliateApplicationsQuery.data ?? [];
  const payoutQueue = (affiliatePayoutQueueQuery.data ?? []) as any[];
  const pendingApplications = affiliateApplications.filter(
    (entry) => entry.application.status === "pending"
  ).length;
  const activeBetaCodes = betaCodes.filter((code) => code.isActive).length;
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
  const selectedOfferDraft = selectedAffiliateEntry
    ? getOfferDraft(selectedAffiliateEntry)
    : null;
  const isSavingSelectedAffiliateSettings = Boolean(
    selectedAffiliateEntry &&
      (saveAffiliateOffer.isPending || saveAffiliateCommissionSplit.isPending) &&
      (((saveAffiliateOffer.variables as any)?.affiliateUserId ===
        selectedAffiliateEntry.affiliate.id) ||
        ((saveAffiliateCommissionSplit.variables as any)?.affiliateUserId ===
          selectedAffiliateEntry.affiliate.id))
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
              This route is only available to allowlisted admin accounts.
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
          icon={Shield}
          label="Active beta codes"
          value={activeBetaCodes}
          color="text-teal-300"
        />
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
      </div>

      <GoalSurface>
        <div className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <Badge className="rounded-full bg-teal-500/10 text-[10px] text-teal-200 ring ring-teal-500/15">
                Admin only
              </Badge>
              <p className="mt-3 text-2xl font-semibold text-white">
                Operational controls for growth access and affiliate settlement
              </p>
              <p className="mt-2 text-sm leading-6 text-white/45">
                Beta access, affiliate approvals, and payout actions now
                follow the same dashboard rhythm as goals: key metrics first,
                then the actual operating panels.
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
                Beta rollout
              </p>
              <p className="mt-2 text-sm text-white/65">
                Issue controlled access codes and keep redemption inventory visible.
              </p>
            </div>
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
          </div>
        </div>
      </GoalSurface>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <GoalPanel
          icon={Shield}
          title="Create beta code"
          description="Issue a new private beta code for a rollout cohort, campaign, or manual invite set."
          bodyClassName="space-y-4"
        >
          <div className="grid gap-3">
            <div>
              <Label className="text-[10px] text-white/40">Label</Label>
              <Input
                value={betaForm.label}
                onChange={(event) =>
                  setBetaForm((state) => ({
                    ...state,
                    label: event.target.value,
                  }))
                }
                placeholder="March rollout cohort"
                className="mt-1.5 bg-sidebar text-xs ring-white/5"
              />
            </div>
            <div>
              <Label className="text-[10px] text-white/40">Description</Label>
              <Input
                value={betaForm.description}
                onChange={(event) =>
                  setBetaForm((state) => ({
                    ...state,
                    description: event.target.value,
                  }))
                }
                placeholder="Optional internal note"
                className="mt-1.5 bg-sidebar text-xs ring-white/5"
              />
            </div>
            <div>
              <Label className="text-[10px] text-white/40">Custom code</Label>
              <Input
                value={betaForm.code}
                onChange={(event) =>
                  setBetaForm((state) => ({
                    ...state,
                    code: event.target.value.toUpperCase(),
                  }))
                }
                placeholder="Optional"
                className="mt-1.5 bg-sidebar text-xs ring-white/5"
              />
            </div>
            <div>
              <Label className="text-[10px] text-white/40">
                Max redemptions
              </Label>
              <Input
                value={betaForm.maxRedemptions}
                onChange={(event) =>
                  setBetaForm((state) => ({
                    ...state,
                    maxRedemptions: event.target.value,
                  }))
                }
                placeholder="Unlimited"
                className="mt-1.5 bg-sidebar text-xs ring-white/5"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleCreateBetaCode}
              disabled={createPrivateBetaCode.isPending}
              className="h-9 rounded-sm bg-teal-600 px-4 text-xs text-white hover:brightness-110"
            >
              {createPrivateBetaCode.isPending ? "Creating..." : "Create beta code"}
            </Button>
          </div>
        </GoalPanel>

        <section className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex size-9 items-center justify-center rounded-sm border border-white/5 bg-sidebar-accent">
                <Shield className="size-4 text-teal-300" />
              </div>
              <div>
                <h2 className="text-sm font-medium text-white">
                  Issued beta codes
                </h2>
                <p className="mt-1 text-sm leading-6 text-white/45">
                  Track active inventory, remaining redemptions, and copyable code payloads.
                </p>
              </div>
            </div>

            <Badge className="rounded-full bg-white/5 text-[10px] text-white/65 ring ring-white/10">
              {betaCodes.length} codes
            </Badge>
          </div>

          {betaCodes.length ? (
            <div className="overflow-hidden rounded-lg border border-white/5 bg-sidebar">
              <div className="overflow-x-auto">
                <table className="min-w-[980px] w-full text-left">
                  <thead className="bg-sidebar">
                    <tr className="border-b border-white/5">
                      {[
                        "Label",
                        "Description",
                        "Code",
                        "Redemptions",
                        "Expires",
                        "Status",
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
                    {betaCodes.map((code) => {
                      const remaining =
                        code.maxRedemptions === null
                          ? "Unlimited"
                          : `${code.redeemedCount}/${code.maxRedemptions}`;

                      return (
                        <tr
                          key={code.id}
                          className="border-b border-white/5 last:border-b-0"
                        >
                          <td className="px-4 py-3 text-sm text-white">
                            {code.label}
                          </td>
                          <td className="px-4 py-3 text-sm text-white/75">
                            {code.description || "No description"}
                          </td>
                          <td className="px-4 py-3 text-sm text-white/75">
                            {code.code}
                          </td>
                          <td className="px-4 py-3 text-sm text-white/75">
                            {remaining}
                          </td>
                          <td className="px-4 py-3 text-sm text-white/75">
                            {formatDate(code.expiresAt)}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              className={
                                code.isActive
                                  ? "bg-teal-900/30 text-[10px] text-teal-300 ring ring-teal-500/20"
                                  : "bg-rose-900/30 text-[10px] text-rose-300 ring ring-rose-500/20"
                              }
                            >
                              {code.isActive ? "Active" : "Disabled"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              onClick={() =>
                                copyToClipboard(code.code, "Beta code copied")
                              }
                              className="h-8 gap-1 rounded-sm bg-sidebar px-3 text-[11px] text-white ring ring-white/5 hover:brightness-110"
                            >
                              <Copy className="size-3" />
                              Copy
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <GrowthEmptyState message="No beta codes created yet." />
          )}
        </section>
      </div>

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
                    <div className="p-4">
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

                      <div className="mt-4 grid gap-3 text-[11px] text-white/40 md:grid-cols-4">
                        <div>
                          <p className="text-[10px] text-white/25">Default offer</p>
                          <p className="mt-1 text-white/60">
                            {selectedAffiliateEntry.defaultOffer?.code ?? "No default offer"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-white/25">Discount</p>
                          <p className="mt-1 text-white/60">
                            {formatPercentValue(
                              selectedAffiliateEntry.defaultOffer?.discountBasisPoints ?? 0
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-white/25">Payout split</p>
                          <p className="mt-1 text-white/60">
                            {formatPercentValue(
                              selectedAffiliateEntry.affiliate.commissionBps
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-white/25">Default link</p>
                          <p className="mt-1 truncate text-white/60">
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
                            Edit affiliate settings
                          </DialogTitle>
                          <DialogDescription className="text-white/45">
                            Update the default offer code, discount percent, and payout split for{" "}
                            {selectedAffiliateEntry.affiliate.name ||
                              selectedAffiliateEntry.affiliate.email}
                            .
                          </DialogDescription>
                        </DialogHeader>

                        {selectedOfferDraft ? (
                          <div className="mt-5 space-y-4">
                            <div className="space-y-1.5">
                              <Label className="text-[11px] text-white/35">
                                Default offer code
                              </Label>
                              <Input
                                value={selectedOfferDraft.code}
                                onChange={(event) =>
                                  updateOfferDraft(selectedAffiliateEntry.affiliate.id, {
                                    code: event.target.value,
                                  })
                                }
                                placeholder="Offer code"
                                className="h-10 bg-sidebar-accent text-xs ring-white/10"
                              />
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="space-y-1.5">
                                <Label className="text-[11px] text-white/35">
                                  Discount percent
                                </Label>
                                <Input
                                  value={selectedOfferDraft.discountPercent}
                                  onChange={(event) =>
                                    updateOfferDraft(selectedAffiliateEntry.affiliate.id, {
                                      discountPercent: event.target.value,
                                    })
                                  }
                                  placeholder="10"
                                  className="h-10 bg-sidebar-accent text-xs ring-white/10"
                                />
                                <p className="text-[10px] text-white/35">
                                  Enter a normal percentage, for example `10` for 10% off.
                                </p>
                              </div>

                              <div className="space-y-1.5">
                                <Label className="text-[11px] text-white/35">
                                  Payout split percent
                                </Label>
                                <Input
                                  value={selectedOfferDraft.commissionPercent}
                                  onChange={(event) =>
                                    updateOfferDraft(selectedAffiliateEntry.affiliate.id, {
                                      commissionPercent: event.target.value,
                                    })
                                  }
                                  placeholder="20"
                                  className="h-10 bg-sidebar-accent text-xs ring-white/10"
                                />
                                <p className="text-[10px] text-white/35">
                                  Enter a normal percentage, for example `20` for a 20% split.
                                </p>
                              </div>
                            </div>

                            <div className="rounded-sm border border-white/5 bg-sidebar-accent/60 p-3 text-[11px] text-white/45">
                              <p>Affiliate link</p>
                              <p className="mt-1 truncate text-white/70">
                                {selectedAffiliateEntry.defaultLink?.shareUrl ?? "No default link"}
                              </p>
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
                                      onClick={() =>
                                        approveAffiliateWithdrawal.mutate({
                                          withdrawalRequestId: request.id,
                                        } as any)
                                      }
                                      disabled={approveAffiliateWithdrawal.isPending}
                                      className="h-8 rounded-sm bg-emerald-600 px-3 text-[11px] text-white hover:brightness-110"
                                    >
                                      <CheckCircle2 className="mr-1 size-3.5" />
                                      {isApproving ? "Approving..." : "Approve"}
                                    </Button>
                                    <Button
                                      onClick={() =>
                                        rejectAffiliateWithdrawal.mutate({
                                          withdrawalRequestId: request.id,
                                        } as any)
                                      }
                                      disabled={rejectAffiliateWithdrawal.isPending}
                                      className="h-8 rounded-sm bg-rose-600/90 px-3 text-[11px] text-white hover:brightness-110"
                                    >
                                      <XCircle className="mr-1 size-3.5" />
                                      {isRejecting ? "Rejecting..." : "Reject"}
                                    </Button>
                                  </>
                                ) : null}

                                {request.status === "approved" &&
                                request.destinationType === "stripe_connect" ? (
                                  <Button
                                    onClick={() =>
                                      sendAffiliateStripeWithdrawal.mutate({
                                        withdrawalRequestId: request.id,
                                      } as any)
                                    }
                                    disabled={sendAffiliateStripeWithdrawal.isPending}
                                    className="h-8 rounded-sm bg-emerald-600 px-3 text-[11px] text-white hover:brightness-110"
                                  >
                                    {isSendingStripe ? "Sending..." : "Send Stripe payout"}
                                  </Button>
                                ) : null}

                                {request.status === "approved" &&
                                request.destinationType === "manual" ? (
                                  <Button
                                    onClick={() =>
                                      markAffiliateManualWithdrawalPaid.mutate({
                                        withdrawalRequestId: request.id,
                                      } as any)
                                    }
                                    disabled={markAffiliateManualWithdrawalPaid.isPending}
                                    className="h-8 rounded-sm bg-emerald-600 px-3 text-[11px] text-white hover:brightness-110"
                                  >
                                    {isMarkingManual
                                      ? "Marking..."
                                      : "Mark manual payout paid"}
                                  </Button>
                                ) : null}

                                {request.status !== "pending" &&
                                !(request.status === "approved" &&
                                  (request.destinationType === "stripe_connect" ||
                                    request.destinationType === "manual")) ? (
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

        {affiliateApplications.length ? (
          <div className="overflow-hidden rounded-lg border border-white/5 bg-sidebar">
            <div className="overflow-x-auto">
              <table className="min-w-[1020px] w-full text-left">
                <thead className="bg-sidebar">
                  <tr className="border-b border-white/5">
                    {[
                      "Username",
                      "Email",
                      "Description",
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
                          {entry.application.message || "No application note"}
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
                                onClick={() =>
                                  approveAffiliate.mutate({
                                    applicationId: entry.application.id,
                                  })
                                }
                                disabled={approveAffiliate.isPending}
                                className="h-8 rounded-sm bg-emerald-600 px-3 text-[11px] text-white hover:brightness-110"
                              >
                                {isApproving ? "Approving..." : "Approve"}
                              </Button>
                              <Button
                                onClick={() =>
                                  rejectAffiliate.mutate({
                                    applicationId: entry.application.id,
                                  })
                                }
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
