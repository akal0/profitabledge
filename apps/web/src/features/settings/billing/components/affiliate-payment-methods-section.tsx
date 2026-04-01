"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Banknote,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Shield,
  Trash2,
  Unplug,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import {
  GoalContentSeparator,
  GoalPanel,
  GoalSurface,
} from "@/components/goals/goal-surface";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpcOptions } from "@/utils/trpc";
import { getBillingV2Options } from "@/features/growth/lib/billing-v2";

function formatCurrency(cents?: number | null) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format((cents ?? 0) / 100);
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

function formatPaymentMethodType(methodType?: string | null) {
  if (!methodType) return "Other";
  return methodType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatStatusLabel(status?: string | null) {
  if (!status) return "Pending";
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatCurrencyCode(value?: string | null) {
  return (value || "USD").toUpperCase();
}

function formatDestinationType(destinationType?: string | null) {
  if (!destinationType) return "Manual";
  return destinationType === "stripe_connect"
    ? "Stripe Connect"
    : destinationType
        .replace(/_/g, " ")
        .replace(/\b\w/g, (match) => match.toUpperCase());
}

function SummaryCard({
  label,
  value,
  description,
}: {
  label: string;
  value: React.ReactNode;
  description: React.ReactNode;
}) {
  return (
    <GoalSurface>
      <div className="p-3.5">
        <p className="text-[10px] text-white/35">{label}</p>
        <GoalContentSeparator className="mb-3.5 mt-3.5" />
        <p className="text-2xl font-semibold text-white">{value}</p>
        <p className="mt-2 text-xs text-white/35">{description}</p>
      </div>
    </GoalSurface>
  );
}

export function AffiliatePaymentMethodsSection() {
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [withdrawalDestination, setWithdrawalDestination] = useState<
    "stripe_connect" | "manual"
  >("stripe_connect");
  const [selectedManualPaymentMethodId, setSelectedManualPaymentMethodId] =
    useState("");
  const [manualMethodType, setManualMethodType] = useState("paypal");
  const [manualMethodLabel, setManualMethodLabel] = useState("");
  const [manualRecipientName, setManualRecipientName] = useState("");
  const [manualMethodDetails, setManualMethodDetails] = useState("");
  const billingV2 = getBillingV2Options();

  const billingStateQuery = useQuery(
    trpcOptions.billing.getState.queryOptions()
  );
  const isAffiliate = billingStateQuery.data?.affiliate?.isAffiliate === true;
  const affiliatePayoutSettingsQuery = useQuery({
    ...trpcOptions.billing.getAffiliatePayoutSettings.queryOptions(),
    enabled: isAffiliate,
  });

  const createAffiliateStripeConnectSession = useMutation({
    ...(billingV2.createAffiliateStripeConnectSession?.mutationOptions?.() ?? {
      mutationFn: async () => {
        throw new Error("Stripe Connect is not available yet");
      },
    }),
  });
  const refreshAffiliateStripeConnectAccount = useMutation({
    ...(billingV2.refreshAffiliateStripeConnectAccount?.mutationOptions?.() ?? {
      mutationFn: async () => {
        throw new Error("Stripe Connect is not available yet");
      },
    }),
    onSuccess: () => {
      void affiliatePayoutSettingsQuery.refetch();
      toast.success("Stripe account refreshed");
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to refresh Stripe account"
      );
    },
  });
  const disconnectAffiliateStripeConnect = useMutation({
    ...(billingV2.disconnectAffiliateStripeConnect?.mutationOptions?.() ?? {
      mutationFn: async () => {
        throw new Error("Stripe Connect is not available yet");
      },
    }),
    onSuccess: () => {
      void affiliatePayoutSettingsQuery.refetch();
      toast.success("Stripe account disconnected");
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to disconnect Stripe account"
      );
    },
  });
  const saveAffiliatePaymentMethod = useMutation({
    ...(billingV2.saveAffiliatePaymentMethod?.mutationOptions?.() ?? {
      mutationFn: async () => {
        throw new Error("Manual payout methods are not available yet");
      },
    }),
    onSuccess: () => {
      setManualMethodLabel("");
      setManualRecipientName("");
      setManualMethodDetails("");
      void affiliatePayoutSettingsQuery.refetch();
      toast.success("Manual payout method saved");
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to save payout method"
      );
    },
  });
  const setDefaultAffiliatePaymentMethod = useMutation({
    ...(billingV2.setDefaultAffiliatePaymentMethod?.mutationOptions?.() ?? {
      mutationFn: async () => {
        throw new Error("Manual payout methods are not available yet");
      },
    }),
    onSuccess: () => {
      void affiliatePayoutSettingsQuery.refetch();
      toast.success("Default payout method updated");
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update default payout method"
      );
    },
  });
  const deleteAffiliatePaymentMethod = useMutation({
    ...(billingV2.deleteAffiliatePaymentMethod?.mutationOptions?.() ?? {
      mutationFn: async () => {
        throw new Error("Manual payout methods are not available yet");
      },
    }),
    onSuccess: () => {
      void affiliatePayoutSettingsQuery.refetch();
      toast.success("Payout method removed");
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to remove payout method"
      );
    },
  });
  const requestAffiliateWithdrawal = useMutation({
    ...(billingV2.requestAffiliateWithdrawal?.mutationOptions?.() ?? {
      mutationFn: async () => {
        throw new Error("Withdrawals are not available yet");
      },
    }),
    onSuccess: () => {
      setWithdrawalAmount("");
      void affiliatePayoutSettingsQuery.refetch();
      toast.success("Withdrawal request submitted");
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to request withdrawal"
      );
    },
  });
  const cancelAffiliateWithdrawal = useMutation({
    ...(billingV2.cancelAffiliateWithdrawal?.mutationOptions?.() ?? {
      mutationFn: async () => {
        throw new Error("Withdrawals are not available yet");
      },
    }),
    onSuccess: () => {
      void affiliatePayoutSettingsQuery.refetch();
      toast.success("Withdrawal request cancelled");
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to cancel withdrawal"
      );
    },
  });

  const affiliatePayoutSettings = affiliatePayoutSettingsQuery.data as any;
  const stripeConnect = affiliatePayoutSettings?.stripeConnect ?? null;
  const stripeAccountId =
    stripeConnect?.accountId ?? stripeConnect?.providerAccountId ?? null;
  const stripeStatusLabel =
    stripeConnect?.statusLabel ??
    (stripeAccountId
      ? formatStatusLabel(stripeConnect?.onboardingStatus ?? "connected")
      : "Not connected");
  const shouldContinueStripeOnboarding = Boolean(
    stripeAccountId && stripeConnect && !stripeConnect.detailsSubmitted
  );
  const stripeAccountLabel =
    stripeConnect?.accountLabel ?? "Stripe Express payout account";
  const withdrawalRequests = affiliatePayoutSettings?.withdrawalRequests ?? [];
  const manualPaymentMethods = affiliatePayoutSettings?.manualPaymentMethods ?? [];
  const defaultManualPaymentMethodId =
    manualPaymentMethods.find((method: any) => method.isDefault)?.id ??
    manualPaymentMethods[0]?.id ??
    "";

  useEffect(() => {
    const selectedMethodStillExists = manualPaymentMethods.some(
      (method: any) => method.id === selectedManualPaymentMethodId
    );

    if (
      (!selectedManualPaymentMethodId || !selectedMethodStillExists) &&
      defaultManualPaymentMethodId
    ) {
      setSelectedManualPaymentMethodId(defaultManualPaymentMethodId);
    }

    if (
      withdrawalDestination === "stripe_connect" &&
      !stripeConnect?.payoutsEnabled &&
      defaultManualPaymentMethodId
    ) {
      setWithdrawalDestination("manual");
    }
  }, [
    defaultManualPaymentMethodId,
    manualPaymentMethods,
    selectedManualPaymentMethodId,
    stripeConnect?.payoutsEnabled,
    withdrawalDestination,
  ]);

  const handleStripeConnect = async (mode: "onboarding" | "dashboard") => {
    try {
      const result: any = await createAffiliateStripeConnectSession.mutateAsync(
        {
          mode,
          returnPath: "/dashboard/settings/billing/payment-methods",
        } as any
      );

      if (result?.url) {
        window.location.assign(result.url);
        return;
      }

      toast.error("Stripe did not return a connect URL");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to open Stripe Connect"
      );
    }
  };

  const handleRequestWithdrawal = async () => {
    const amount = Number(withdrawalAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid withdrawal amount");
      return;
    }

    if (
      withdrawalDestination === "manual" &&
      !selectedManualPaymentMethodId
    ) {
      toast.error("Choose a manual payout method first");
      return;
    }

    await requestAffiliateWithdrawal.mutateAsync({
      amountUsd: Math.round(amount * 100),
      destinationType: withdrawalDestination,
      paymentMethodId:
        withdrawalDestination === "manual"
          ? selectedManualPaymentMethodId
          : undefined,
    } as any);
  };

  const handleSaveManualMethod = async () => {
    if (!manualMethodLabel.trim()) {
      toast.error("Add a label for this payout method");
      return;
    }

    if (!manualMethodDetails.trim()) {
      toast.error("Add the payment details to save this method");
      return;
    }

    await saveAffiliatePaymentMethod.mutateAsync({
      methodType: manualMethodType,
      label: manualMethodLabel.trim(),
      recipientName: manualRecipientName.trim() || undefined,
      details: manualMethodDetails.trim(),
      isDefault: manualPaymentMethods.length === 0,
    } as any);
  };

  return (
    <div className="flex flex-col px-6 py-5 sm:gap-6 sm:px-8">
      <div className="space-y-3">
        {billingStateQuery.isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {[0, 1, 2, 3, 4].map((index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-sm ring ring-white/5 bg-sidebar"
              />
            ))}
          </div>
        ) : !isAffiliate ? (
          <GoalPanel
            icon={Shield}
            title="Affiliate access required"
            bodyClassName="p-5"
          >
            <p className="mt-3 text-sm leading-6 text-white/45">
              Payment methods unlock after your affiliate application is
              approved, so payout instructions only appear on active affiliate
              accounts.
            </p>
            <Button
              asChild
              className="mt-5 h-9 rounded-sm ring ring-white/10 bg-sidebar-accent px-4 text-xs text-white hover:bg-sidebar-accent/80"
            >
              <Link href="/dashboard/referrals">Open referrals</Link>
            </Button>
          </GoalPanel>
        ) : affiliatePayoutSettingsQuery.isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {[0, 1, 2, 3, 4].map((index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-sm ring ring-white/5 bg-sidebar"
              />
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <SummaryCard
                label="Total earned"
                value={formatCurrency(
                  affiliatePayoutSettings?.summary.totalEarnedAmount
                )}
                description="All-time affiliate commission across available, pending, and paid out balance"
              />

              <SummaryCard
                label="Available"
                value={formatCurrency(
                  affiliatePayoutSettings?.summary.availableAmount
                )}
                description={
                  <>
                    {affiliatePayoutSettings?.summary.availableEventCount ?? 0}{" "}
                    unpaid commission event
                    {(affiliatePayoutSettings?.summary.availableEventCount ??
                      0) === 1
                      ? ""
                      : "s"}
                  </>
                }
              />

              <SummaryCard
                label="Pending"
                value={formatCurrency(
                  affiliatePayoutSettings?.summary.pendingAmount
                )}
                description="Reserved in withdrawal requests that are awaiting review or settlement"
              />

              <SummaryCard
                label="Paid out"
                value={formatCurrency(
                  affiliatePayoutSettings?.summary.paidAmount
                )}
                description="Settled withdrawals recorded on your affiliate account"
              />

              <SummaryCard
                label="Payouts"
                value={affiliatePayoutSettings?.summary.payoutCount ?? 0}
                description={`${withdrawalRequests.filter(
                  (item: any) => item.status === "pending" || item.status === "approved" || item.status === "processing"
                ).length} open request${withdrawalRequests.filter(
                  (item: any) => item.status === "pending" || item.status === "approved" || item.status === "processing"
                ).length === 1 ? "" : "s"}`}
              />
            </div>

            <div className="flex flex-col gap-3">
              <GoalPanel
                icon={Wallet}
                title="Stripe Connect"
                bodyClassName="p-3.5"
              >
                <div className="space-y-3">
                  <GoalSurface>
                    <div className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-white">
                              {stripeAccountLabel}
                            </p>
                            <Badge className="ring ring-white/10 bg-white/5 text-[10px] text-white/65">
                              {stripeStatusLabel}
                            </Badge>
                            {stripeConnect?.payoutsEnabled ? (
                              <Badge className="ring ring-emerald-500/20 bg-emerald-900/30 text-[10px] text-emerald-300">
                                <CheckCircle2 className="mr-1 size-2.5" />
                                Payouts enabled
                              </Badge>
                            ) : null}
                          </div>

                          <p className="mt-2 text-xs leading-6 text-white/45">
                            Connect Stripe Express if you want affiliate
                            withdrawals to land directly in Stripe.
                          </p>

                          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-white/35">
                            <span>
                              Account ID: {stripeAccountId ?? "Not connected"}
                            </span>
                            <span>
                              Charges:{" "}
                              {stripeConnect?.chargesEnabled
                                ? "Enabled"
                                : "Pending"}
                            </span>
                            <span>
                              Synced: {formatDate(stripeConnect?.lastSyncedAt)}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            onClick={() =>
                              handleStripeConnect(
                                stripeAccountId &&
                                  !shouldContinueStripeOnboarding
                                  ? "dashboard"
                                  : "onboarding"
                              )
                            }
                            disabled={
                              createAffiliateStripeConnectSession.isPending
                            }
                            className="h-8 rounded-sm border border-white/10 bg-sidebar px-3 text-[11px] text-white hover:bg-sidebar-accent"
                          >
                            <ExternalLink className="size-3.5" />
                            {createAffiliateStripeConnectSession.isPending
                              ? "Opening..."
                              : shouldContinueStripeOnboarding
                              ? "Continue onboarding"
                              : stripeAccountId
                              ? "Manage Stripe"
                              : "Connect Stripe"}
                          </Button>

                          {stripeAccountId ? (
                            <>
                              <Button
                                onClick={() =>
                                  refreshAffiliateStripeConnectAccount.mutate()
                                }
                                disabled={
                                  refreshAffiliateStripeConnectAccount.isPending
                                }
                                className="h-8 rounded-sm border border-white/10 bg-sidebar px-3 text-[11px] text-white hover:bg-sidebar-accent"
                              >
                                <RefreshCw
                                  className={`size-3.5 ${
                                    refreshAffiliateStripeConnectAccount.isPending
                                      ? "animate-spin"
                                      : ""
                                  }`}
                                />
                                Refresh
                              </Button>

                              <Button
                                onClick={() =>
                                  disconnectAffiliateStripeConnect.mutate()
                                }
                                disabled={
                                  disconnectAffiliateStripeConnect.isPending
                                }
                                className="h-8 rounded-sm bg-rose-600/90 px-3 text-[11px] text-white hover:brightness-110"
                              >
                                <Unplug className="size-3.5" />
                                Disconnect
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </GoalSurface>

                  <GoalSurface>
                    <div className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium text-white">
                            Manual payout methods
                          </p>
                          <p className="mt-1 text-[11px] leading-5 text-white/40">
                            Add PayPal, Wise, bank transfer, or other destinations.
                            Payment details are encrypted at rest and only a masked
                            preview is shown back to you.
                          </p>
                        </div>
                        <Badge className="ring ring-white/10 bg-white/5 text-[10px] text-white/65">
                          {manualPaymentMethods.length} method
                          {manualPaymentMethods.length === 1 ? "" : "s"}
                        </Badge>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label className="text-[11px] text-white/35">
                            Method type
                          </Label>
                          <Select
                            value={manualMethodType}
                            onValueChange={setManualMethodType}
                          >
                            <SelectTrigger className="h-10 bg-sidebar text-xs ring-white/5">
                              <SelectValue placeholder="Choose method type" />
                            </SelectTrigger>
                            <SelectContent>
                              {[
                                ["paypal", "PayPal"],
                                ["wise", "Wise"],
                                ["bank_transfer", "Bank transfer"],
                                ["crypto", "Crypto"],
                                ["other", "Other"],
                              ].map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-[11px] text-white/35">
                            Label
                          </Label>
                          <Input
                            value={manualMethodLabel}
                            onChange={(event) =>
                              setManualMethodLabel(event.target.value)
                            }
                            placeholder="Primary PayPal"
                            className="h-10 bg-sidebar text-xs ring-white/5"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-[11px] text-white/35">
                            Recipient name
                          </Label>
                          <Input
                            value={manualRecipientName}
                            onChange={(event) =>
                              setManualRecipientName(event.target.value)
                            }
                            placeholder="Jane Trader"
                            className="h-10 bg-sidebar text-xs ring-white/5"
                          />
                        </div>

                        <div className="space-y-1.5 md:col-span-2">
                          <Label className="text-[11px] text-white/35">
                            Payment details
                          </Label>
                          <Input
                            value={manualMethodDetails}
                            onChange={(event) =>
                              setManualMethodDetails(event.target.value)
                            }
                            placeholder="paypal@example.com / bank details / wallet address"
                            className="h-10 bg-sidebar text-xs ring-white/5"
                          />
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[11px] text-white/35">
                          Withdrawals are typically reviewed within 3-5 business days.
                        </p>
                        <Button
                          onClick={handleSaveManualMethod}
                          disabled={saveAffiliatePaymentMethod.isPending}
                          className="h-9 rounded-sm border border-white/10 bg-sidebar px-3 text-[11px] text-white hover:bg-sidebar-accent"
                        >
                          {saveAffiliatePaymentMethod.isPending
                            ? "Saving..."
                            : "Save manual method"}
                        </Button>
                      </div>

                      <div className="mt-4 space-y-2">
                        {manualPaymentMethods.length ? (
                          manualPaymentMethods.map((method: any) => {
                            const isDeleting =
                              deleteAffiliatePaymentMethod.isPending &&
                              (deleteAffiliatePaymentMethod.variables as any)
                                ?.paymentMethodId === method.id;
                            const isUpdatingDefault =
                              setDefaultAffiliatePaymentMethod.isPending &&
                              (setDefaultAffiliatePaymentMethod.variables as any)
                                ?.paymentMethodId === method.id;

                            return (
                              <div
                                key={method.id}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-white/5 bg-sidebar-accent/70 p-3"
                              >
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-medium text-white">
                                      {method.label}
                                    </p>
                                    {method.isDefault ? (
                                      <Badge className="ring ring-emerald-500/20 bg-emerald-900/30 text-[10px] text-emerald-300">
                                        Default
                                      </Badge>
                                    ) : null}
                                  </div>
                                  <p className="mt-1 text-[11px] leading-5 text-white/40">
                                    {formatPaymentMethodType(method.methodType)}
                                    {method.recipientName
                                      ? ` · ${method.recipientName}`
                                      : ""}
                                    {method.detailsPreview
                                      ? ` · ${method.detailsPreview}`
                                      : ""}
                                  </p>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  {!method.isDefault ? (
                                    <Button
                                      onClick={() =>
                                        setDefaultAffiliatePaymentMethod.mutate({
                                          paymentMethodId: method.id,
                                        } as any)
                                      }
                                      disabled={setDefaultAffiliatePaymentMethod.isPending}
                                      className="h-8 rounded-sm border border-white/10 bg-sidebar px-3 text-[11px] text-white hover:bg-sidebar-accent"
                                    >
                                      {isUpdatingDefault
                                        ? "Updating..."
                                        : "Set default"}
                                    </Button>
                                  ) : null}
                                  <Button
                                    onClick={() =>
                                      deleteAffiliatePaymentMethod.mutate({
                                        paymentMethodId: method.id,
                                      } as any)
                                    }
                                    disabled={deleteAffiliatePaymentMethod.isPending}
                                    className="h-8 rounded-sm border border-white/10 bg-rose-600/90 px-3 text-[11px] text-white hover:brightness-110"
                                  >
                                    <Trash2 className="mr-1 size-3.5" />
                                    {isDeleting ? "Removing..." : "Delete"}
                                  </Button>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="rounded-sm border border-dashed border-white/10 p-4 text-xs text-white/30">
                            No manual payout methods saved yet.
                          </div>
                        )}
                      </div>
                    </div>
                  </GoalSurface>

                  <GoalSurface>
                    <div className="p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium text-white">
                            Request withdrawal
                          </p>
                          <p className="mt-1 text-[11px] leading-5 text-white/40">
                            Submit a withdrawal request in Billing. Choose Stripe
                            Connect or a saved manual payout method.
                          </p>
                        </div>
                        <Badge className="ring ring-white/10 bg-white/5 text-[10px] text-white/65">
                          {formatCurrency(
                            affiliatePayoutSettings?.summary.availableAmount ??
                              0
                          )}{" "}
                          available
                        </Badge>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                        <Select
                          value={withdrawalDestination}
                          onValueChange={(value) =>
                            setWithdrawalDestination(
                              value as "stripe_connect" | "manual"
                            )
                          }
                        >
                          <SelectTrigger className="h-10 bg-sidebar text-xs ring-white/5">
                            <SelectValue placeholder="Choose destination" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="stripe_connect">
                              Stripe Connect
                            </SelectItem>
                            <SelectItem value="manual">
                              Manual payout method
                            </SelectItem>
                          </SelectContent>
                        </Select>

                        {withdrawalDestination === "manual" ? (
                          <Select
                            value={selectedManualPaymentMethodId}
                            onValueChange={setSelectedManualPaymentMethodId}
                          >
                            <SelectTrigger className="h-10 bg-sidebar text-xs ring-white/5">
                              <SelectValue placeholder="Choose payout method" />
                            </SelectTrigger>
                            <SelectContent>
                              {manualPaymentMethods.map((method: any) => (
                                <SelectItem key={method.id} value={method.id}>
                                  {method.label}
                                  {method.isDefault ? " (default)" : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="flex h-10 items-center rounded-sm border border-white/10 bg-sidebar px-3 text-xs text-white/65">
                            {stripeConnect?.payoutsEnabled
                              ? "Stripe Connect ready"
                              : "Finish Stripe onboarding first"}
                          </div>
                        )}

                        <Input
                          value={withdrawalAmount}
                          onChange={(event) =>
                            setWithdrawalAmount(event.target.value)
                          }
                          placeholder="Amount in USD"
                          className="ring-white/5 bg-sidebar text-xs"
                        />

                        <Button
                          onClick={handleRequestWithdrawal}
                          disabled={requestAffiliateWithdrawal.isPending}
                          className="h-10 rounded-sm bg-emerald-600 px-4 text-xs text-white hover:brightness-110"
                        >
                          {requestAffiliateWithdrawal.isPending
                            ? "Submitting..."
                            : "Request withdrawal"}
                        </Button>
                      </div>
                    </div>
                  </GoalSurface>
                </div>
              </GoalPanel>
            </div>

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
                      Track each request and cancel it before review if needed.
                    </p>
                  </div>
                </div>

                <Badge className="rounded-full bg-white/5 text-[10px] text-white/65 ring ring-white/10">
                  {withdrawalRequests.length} requests
                </Badge>
              </div>

              {withdrawalRequests.length ? (
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
                        {withdrawalRequests.map((request: any) => {
                          const isCancelling =
                            cancelAffiliateWithdrawal.isPending &&
                            (cancelAffiliateWithdrawal.variables as any)
                              ?.withdrawalRequestId === request.id;

                          return (
                            <tr
                              key={request.id}
                              className="border-b border-white/5 last:border-b-0"
                            >
                              <td className="px-4 py-3 text-sm text-white">
                                {formatCurrency(
                                  request.amountUsd ?? request.amount ?? 0
                                )}
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
                                    : "Manual payout method")}
                              </td>
                              <td className="px-4 py-3">
                                <div className="space-y-1">
                                  <Badge className="ring ring-white/10 bg-white/5 text-[10px] text-white/65">
                                    {formatStatusLabel(request.status)}
                                  </Badge>
                                  {request.requiresManualReconciliation ? (
                                    <p className="text-[10px] leading-4 text-amber-200/80">
                                      Payment sent. Waiting for internal reconciliation.
                                    </p>
                                  ) : null}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-white/75">
                                {formatDate(
                                  request.requestedAt ?? request.createdAt
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {request.status === "pending" ? (
                                  <Button
                                    onClick={() =>
                                      cancelAffiliateWithdrawal.mutate({
                                        withdrawalRequestId: request.id,
                                      } as any)
                                    }
                                    disabled={
                                      cancelAffiliateWithdrawal.isPending
                                    }
                                    className="h-8 rounded-sm border border-white/10 bg-sidebar px-3 text-[11px] text-white hover:bg-sidebar-accent"
                                  >
                                    {isCancelling ? "Cancelling..." : "Cancel"}
                                  </Button>
                                ) : (
                                  <span className="text-xs text-white/30">
                                    —
                                  </span>
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
                  No withdrawal requests submitted yet.
                </div>
              )}
            </section>

            <section className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 items-center justify-center rounded-sm border border-white/5 bg-sidebar-accent">
                    <Banknote className="size-4 text-emerald-300" />
                  </div>
                  <div>
                    <h2 className="text-sm font-medium text-white">
                      Payout history
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-white/45">
                      Every settled payout recorded on your affiliate account.
                    </p>
                  </div>
                </div>

                <Badge className="rounded-full bg-white/5 text-[10px] text-white/65 ring ring-white/10">
                  {affiliatePayoutSettings?.payouts?.length ?? 0} payouts
                </Badge>
              </div>

              {affiliatePayoutSettings?.payouts?.length ? (
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
                        {affiliatePayoutSettings.payouts.map((payout: any) => (
                          <tr
                            key={payout.id}
                            className="border-b border-white/5 last:border-b-0"
                          >
                            <td className="px-4 py-3 text-sm text-white">
                              {formatCurrency(
                                payout.amountUsd ?? payout.amount
                              )}
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
                                  ? `${
                                      payout.paymentMethod.label
                                    } · ${formatPaymentMethodType(
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
                  No payouts have been recorded yet.
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
