"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Shield,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  GoalContentSeparator,
  GoalPanel,
  GoalSurface,
} from "@/components/goals/goal-surface";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpcOptions } from "@/utils/trpc";

const AFFILIATE_PAYMENT_METHOD_TYPES = [
  "paypal",
  "wise",
  "bank_transfer",
  "crypto",
  "other",
] as const;

type AffiliatePaymentMethodType =
  (typeof AFFILIATE_PAYMENT_METHOD_TYPES)[number];

const LOCALHOST_PAYOUT_METHOD_PRESETS: Array<{
  id: string;
  title: string;
  description: string;
  value: ReturnType<typeof createAffiliatePaymentMethodForm>;
}> = [
  {
    id: "paypal",
    title: "Test PayPal",
    description: "Sandbox-friendly email payout details",
    value: {
      methodType: "paypal",
      label: "PayPal payout",
      recipientName: "Local Affiliate",
      details: "affiliate-test@paypal.example",
      isDefault: true,
    },
  },
  {
    id: "wise",
    title: "Test Wise",
    description: "Email/handle style transfer details",
    value: {
      methodType: "wise",
      label: "Wise transfer",
      recipientName: "Local Affiliate",
      details: "wise-user-demo@example.com",
      isDefault: true,
    },
  },
  {
    id: "bank",
    title: "Test bank",
    description: "Manual bank transfer instructions",
    value: {
      methodType: "bank_transfer",
      label: "Bank transfer",
      recipientName: "Local Affiliate LLC",
      details:
        "Bank: Demo Bank\nAccount ending: 1234\nRouting: 011000015\nReference: AFFILIATE-LOCAL",
      isDefault: true,
    },
  },
  {
    id: "crypto",
    title: "Test crypto",
    description: "Wallet-address style payout details",
    value: {
      methodType: "crypto",
      label: "USDC wallet",
      recipientName: "Local Affiliate",
      details:
        "Network: Base\nAsset: USDC\nWallet: 0x1111111111111111111111111111111111111111",
      isDefault: true,
    },
  },
];

function createAffiliatePaymentMethodForm() {
  return {
    methodType: "paypal" as AffiliatePaymentMethodType,
    label: "",
    recipientName: "",
    details: "",
    isDefault: false,
  };
}

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
        <p className="text-[10px] uppercase tracking-[0.22em] text-white/35">
          {label}
        </p>
        <GoalContentSeparator className="mb-3.5 mt-3.5" />
        <p className="text-2xl font-semibold tracking-[-0.05em] text-white">
          {value}
        </p>
        <p className="mt-2 text-xs text-white/35">{description}</p>
      </div>
    </GoalSurface>
  );
}

export function AffiliatePaymentMethodsSection() {
  const [paymentMethodForm, setPaymentMethodForm] = useState(
    createAffiliatePaymentMethodForm
  );

  const billingStateQuery = useQuery(
    trpcOptions.billing.getState.queryOptions()
  );
  const isAffiliate = billingStateQuery.data?.affiliate?.isAffiliate === true;
  const affiliatePayoutSettingsQuery = useQuery({
    ...trpcOptions.billing.getAffiliatePayoutSettings.queryOptions(),
    enabled: isAffiliate,
  });

  const saveAffiliatePaymentMethod = useMutation({
    ...trpcOptions.billing.saveAffiliatePaymentMethod.mutationOptions(),
    onSuccess: () => {
      setPaymentMethodForm(createAffiliatePaymentMethodForm());
      void affiliatePayoutSettingsQuery.refetch();
      toast.success("Payment method saved");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to save payment method"
      );
    },
  });
  const deleteAffiliatePaymentMethod = useMutation({
    ...trpcOptions.billing.deleteAffiliatePaymentMethod.mutationOptions(),
    onSuccess: () => {
      void affiliatePayoutSettingsQuery.refetch();
      toast.success("Payment method removed");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to remove payment method"
      );
    },
  });
  const setDefaultAffiliatePaymentMethod = useMutation({
    ...trpcOptions.billing.setDefaultAffiliatePaymentMethod.mutationOptions(),
    onSuccess: () => {
      void affiliatePayoutSettingsQuery.refetch();
      toast.success("Default payment method updated");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to update default payment method"
      );
    },
  });

  const affiliatePayoutSettings = affiliatePayoutSettingsQuery.data;
  const isLocalhostPayoutTestingEnabled = process.env.NODE_ENV !== "production";

  const handleSavePaymentMethod = async () => {
    if (!paymentMethodForm.label.trim()) {
      toast.error("Payment method label is required");
      return;
    }

    if (!paymentMethodForm.details.trim()) {
      toast.error("Payment method details are required");
      return;
    }

    await saveAffiliatePaymentMethod.mutateAsync({
      methodType: paymentMethodForm.methodType,
      label: paymentMethodForm.label.trim(),
      recipientName: paymentMethodForm.recipientName.trim() || undefined,
      details: paymentMethodForm.details.trim(),
      isDefault: paymentMethodForm.isDefault,
    });
  };

  return (
    <div className="grid grid-cols-1 items-start gap-2 px-6 py-5 sm:grid-cols-[180px_1fr] sm:gap-6 sm:px-8">
      <div>
        <Label className="text-sm font-medium text-white/80">
          Payment methods
        </Label>
        <p className="mt-0.5 text-xs text-white/35">
          Add the payout details admins should use when sending your affiliate
          commission
        </p>
      </div>

      <div className="space-y-3">
        {billingStateQuery.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((index) => (
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
              accounts
            </p>
            <Button
              asChild
              className="mt-5 h-9 rounded-sm border border-white/10 bg-sidebar-accent px-4 text-xs text-white hover:bg-sidebar-accent/80"
            >
              <Link href="/dashboard/referrals">Open referrals</Link>
            </Button>
          </GoalPanel>
        ) : affiliatePayoutSettingsQuery.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-sm ring ring-white/5 bg-sidebar"
              />
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryCard
                label="Available"
                value={formatCurrency(affiliatePayoutSettings?.summary.availableAmount)}
                description={
                  <>
                    {affiliatePayoutSettings?.summary.availableEventCount ?? 0} unpaid
                    commission event
                    {(affiliatePayoutSettings?.summary.availableEventCount ?? 0) === 1
                      ? ""
                      : "s"}
                  </>
                }
              />

              <SummaryCard
                label="Paid out"
                value={formatCurrency(affiliatePayoutSettings?.summary.paidAmount)}
                description="Recorded manual payouts sent by admins"
              />

              <SummaryCard
                label="Payouts"
                value={affiliatePayoutSettings?.summary.payoutCount ?? 0}
                description="Historical payout records kept on your affiliate account"
              />
            </div>

            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <GoalPanel
                icon={CreditCard}
                title="Saved payment methods"
                bodyClassName="p-3.5"
              >
                <div className="space-y-2">
                  {affiliatePayoutSettings?.paymentMethods?.length ? (
                    affiliatePayoutSettings.paymentMethods.map((method) => (
                      <GoalSurface key={method.id}>
                        <div className="p-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-xs font-medium text-white">
                                  {method.label}
                                </p>
                                <Badge className="ring ring-white/10 bg-white/5 text-[10px] text-white/65">
                                  {formatPaymentMethodType(method.methodType)}
                                </Badge>
                                {method.isDefault ? (
                                  <Badge className="ring ring-emerald-500/20 bg-emerald-900/30 text-[10px] text-emerald-300">
                                    <CheckCircle2 className="mr-1 size-2.5" />
                                    Default
                                  </Badge>
                                ) : null}
                              </div>

                              {method.recipientName ? (
                                <p className="mt-2 text-[11px] text-white/40">
                                  Recipient: {method.recipientName}
                                </p>
                              ) : null}

                              <p className="mt-2 whitespace-pre-wrap text-[11px] leading-5 text-white/45">
                                {method.details}
                              </p>
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                              {!method.isDefault ? (
                                <Button
                                  onClick={() =>
                                    setDefaultAffiliatePaymentMethod.mutate({
                                      paymentMethodId: method.id,
                                    })
                                  }
                                  disabled={
                                    setDefaultAffiliatePaymentMethod.isPending
                                  }
                                  className="h-8 rounded-sm bg-sidebar-accent px-3 text-[11px] text-white ring ring-white/5 hover:brightness-110"
                                >
                                  Set default
                                </Button>
                              ) : null}
                              <Button
                                onClick={() =>
                                  deleteAffiliatePaymentMethod.mutate({
                                    paymentMethodId: method.id,
                                  })
                                }
                                disabled={deleteAffiliatePaymentMethod.isPending}
                                className="h-8 rounded-sm bg-rose-600/90 px-3 text-[11px] text-white hover:brightness-110"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </GoalSurface>
                    ))
                  ) : (
                    <GoalSurface>
                      <div className="p-4 text-xs text-white/30">
                        No payout method saved yet. Add one so admins know where
                        to send commission
                      </div>
                    </GoalSurface>
                  )}
                </div>
              </GoalPanel>

              <GoalPanel
                icon={Banknote}
                title="Add payment method"
                bodyClassName="p-3.5"
              >
                {isLocalhostPayoutTestingEnabled ? (
                  <div className="mb-4 rounded-sm ring ring-blue-500/15 bg-blue-950/20 p-3">
                    <div className="flex items-center gap-2">
                      <Banknote className="size-3.5 text-blue-300" />
                      <p className="text-[11px] font-medium text-blue-100">
                        Localhost test presets
                      </p>
                    </div>
                    <p className="mt-2 text-[11px] leading-5 text-blue-100/60">
                      These fill the form with production-shaped payout details
                      so you can test locally without introducing a fake
                      localhost-only method type
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {LOCALHOST_PAYOUT_METHOD_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setPaymentMethodForm(preset.value)}
                          className="rounded-sm ring ring-white/8 bg-sidebar px-3 py-2 text-left transition-all duration-200 hover:bg-sidebar-accent"
                        >
                          <p className="text-[11px] font-medium text-white">
                            {preset.title}
                          </p>
                          <p className="mt-1 text-[10px] text-white/40">
                            {preset.description}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-3">
                  <div>
                    <Label className="text-[10px] text-white/40">
                      Method type
                    </Label>
                    <Select
                      value={paymentMethodForm.methodType}
                      onValueChange={(value) =>
                        setPaymentMethodForm((state) => ({
                          ...state,
                          methodType: value as AffiliatePaymentMethodType,
                        }))
                      }
                    >
                      <SelectTrigger className="mt-1.5 w-full ring-white/5 bg-sidebar text-xs">
                        <SelectValue placeholder="Choose a method" />
                      </SelectTrigger>
                      <SelectContent>
                        {AFFILIATE_PAYMENT_METHOD_TYPES.map((methodType) => (
                          <SelectItem key={methodType} value={methodType}>
                            {formatPaymentMethodType(methodType)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-[10px] text-white/40">Label</Label>
                    <Input
                      value={paymentMethodForm.label}
                      onChange={(event) =>
                        setPaymentMethodForm((state) => ({
                          ...state,
                          label: event.target.value,
                        }))
                      }
                      placeholder="Primary PayPal"
                      className="mt-1.5 ring-white/5 bg-sidebar text-xs"
                    />
                  </div>

                  <div>
                    <Label className="text-[10px] text-white/40">
                      Recipient name
                    </Label>
                    <Input
                      value={paymentMethodForm.recipientName}
                      onChange={(event) =>
                        setPaymentMethodForm((state) => ({
                          ...state,
                          recipientName: event.target.value,
                        }))
                      }
                      placeholder="Kal Cryptev"
                      className="mt-1.5 ring-white/5 bg-sidebar text-xs"
                    />
                  </div>

                  <div>
                    <Label className="text-[10px] text-white/40">
                      Payment details
                    </Label>
                    <Textarea
                      value={paymentMethodForm.details}
                      onChange={(event) =>
                        setPaymentMethodForm((state) => ({
                          ...state,
                          details: event.target.value,
                        }))
                      }
                      placeholder="PayPal email, Wise handle, wallet address, or transfer instructions"
                      className="mt-1.5 min-h-28 ring-white/5 bg-sidebar text-xs"
                    />
                  </div>

                  <label className="flex items-center gap-2 rounded-sm ring ring-white/5 bg-sidebar px-3 py-2 text-xs text-white/70">
                    <Checkbox
                      checked={paymentMethodForm.isDefault}
                      onCheckedChange={(checked) =>
                        setPaymentMethodForm((state) => ({
                          ...state,
                          isDefault: checked === true,
                        }))
                      }
                      className="rounded-sm"
                    />
                    Save as default payout method
                  </label>

                  <p className="text-[11px] leading-5 text-white/35">
                    Payouts are still recorded manually by admins. Saving a
                    method here stores the payout instructions that work the
                    same way on localhost and in production
                  </p>
                </div>

                <Button
                  onClick={handleSavePaymentMethod}
                  disabled={saveAffiliatePaymentMethod.isPending}
                  className="mt-4 h-9 rounded-sm bg-emerald-600 px-4 text-xs text-white hover:brightness-110"
                >
                  {saveAffiliatePaymentMethod.isPending
                    ? "Saving..."
                    : "Save payment method"}
                </Button>
              </GoalPanel>
            </div>

            <GoalPanel
              icon={Banknote}
              title="Payout history"
              bodyClassName="p-3.5"
            >
              <div className="space-y-2">
                {affiliatePayoutSettings?.payouts?.length ? (
                  affiliatePayoutSettings.payouts.slice(0, 8).map((payout) => (
                    <GoalSurface key={payout.id}>
                      <div className="p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-medium text-white">
                              {formatCurrency(payout.amount)}
                            </p>
                            <p className="mt-1 text-[10px] text-white/35">
                              {formatDate(payout.paidAt ?? payout.createdAt)} •{" "}
                              {payout.eventCount} commission event
                              {payout.eventCount === 1 ? "" : "s"}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge className="ring ring-white/10 bg-white/5 text-[10px] text-white/65">
                              {payout.paymentMethod
                                ? `${payout.paymentMethod.label} · ${formatPaymentMethodType(
                                    payout.paymentMethod.methodType
                                  )}`
                                : "Method removed"}
                            </Badge>
                          </div>
                        </div>
                        {payout.externalReference ? (
                          <p className="mt-2 text-[11px] text-white/40">
                            Reference: {payout.externalReference}
                          </p>
                        ) : null}
                        {payout.notes ? (
                          <p className="mt-2 whitespace-pre-wrap text-[11px] leading-5 text-white/40">
                            {payout.notes}
                          </p>
                        ) : null}
                      </div>
                    </GoalSurface>
                  ))
                ) : (
                  <GoalSurface>
                    <div className="p-4 text-xs text-white/30">
                      No payouts have been recorded yet
                    </div>
                  </GoalSurface>
                )}
              </div>
            </GoalPanel>
          </>
        )}
      </div>
    </div>
  );
}
