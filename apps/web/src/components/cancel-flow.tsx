"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { PauseCircle, RotateCcw, Wallet, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { trpcClient, trpcOptions } from "@/utils/trpc";
import type { BillingPlanKey } from "@/features/settings/billing/lib/plan-labels";

type CancellationReason =
  | "too_expensive"
  | "not_using_enough"
  | "stopped_trading"
  | "missing_features"
  | "switched_competitor"
  | "too_complex"
  | "other";

type PaidPlanKey = Extract<BillingPlanKey, "professional" | "institutional">;

type CancelFlowProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activePlanKey: PaidPlanKey;
  annualMonthlyPriceCents?: number | null;
  annualDiscountPercent?: number | null;
};

const REASONS: Array<{ key: CancellationReason; label: string; helper: string }> = [
  {
    key: "too_expensive",
    label: "Too expensive",
    helper: "I like it, but the current price is hard to justify right now.",
  },
  {
    key: "not_using_enough",
    label: "Not using it enough",
    helper: "I have not built it into my routine yet.",
  },
  {
    key: "stopped_trading",
    label: "I stopped trading",
    helper: "I want to keep my data without paying while I am inactive.",
  },
  {
    key: "missing_features",
    label: "Missing features",
    helper: "Something important to my workflow still is not here.",
  },
  {
    key: "switched_competitor",
    label: "Switched competitor",
    helper: "I found another product that fits better.",
  },
  {
    key: "too_complex",
    label: "Too complex",
    helper: "I need a simpler review workflow.",
  },
  {
    key: "other",
    label: "Other",
    helper: "Something else is driving the cancellation.",
  },
];

export function CancelFlow({
  open,
  onOpenChange,
  activePlanKey,
  annualMonthlyPriceCents,
  annualDiscountPercent,
}: CancelFlowProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [reason, setReason] = useState<CancellationReason>("too_expensive");
  const [detail, setDetail] = useState("");
  const [pauseMonths, setPauseMonths] = useState<1 | 2 | 3>(2);

  const createCheckout = useMutation<any, unknown, any>({
    mutationFn: (input) => (trpcClient.billing as any).createCheckout.mutate(input),
  });
  const createPortalSession = useMutation(
    trpcOptions.billing.createCustomerPortalSession.mutationOptions()
  );
  const saveCancellationFeedback = useMutation<any, unknown, any>({
    mutationFn: (input) =>
      (trpcClient.billing as any).saveCancellationFeedback.mutate(input),
  });
  const pauseSubscription = useMutation<any, unknown, any>({
    mutationFn: (input) =>
      (trpcClient.billing as any).pauseSubscription.mutate(input),
  });

  const annualOfferLabel = useMemo(() => {
    if (!annualMonthlyPriceCents) {
      return null;
    }

    return `£${(annualMonthlyPriceCents / 100).toFixed(0)}/mo billed annually`;
  }, [annualMonthlyPriceCents]);

  const reset = () => {
    setStep(1);
    setReason("too_expensive");
    setDetail("");
    setPauseMonths(2);
  };

  const handleAnnualOffer = async () => {
    try {
      await saveCancellationFeedback.mutateAsync({
        reason,
        detail: detail.trim() || undefined,
        acceptedOffer: "annual_switch",
        keepUsingProduct: true,
      });
      const result = await createCheckout.mutateAsync({
        planKey: activePlanKey,
        billingInterval: "annual",
        returnPath: "/dashboard/settings/billing",
      });
      window.location.assign(result.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to switch plans");
    }
  };

  const handlePause = async () => {
    try {
      const result = await pauseSubscription.mutateAsync({
        months: pauseMonths,
        reason,
        detail: detail.trim() || undefined,
      });
      toast.success(
        `Subscription paused until ${new Date(result.resumesAt).toLocaleDateString()}`
      );
      onOpenChange(false);
      reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to pause billing");
    }
  };

  const handleConfirmCancel = async () => {
    try {
      await saveCancellationFeedback.mutateAsync({
        reason,
        detail: detail.trim() || undefined,
        acceptedOffer: "cancel_anyway",
        keepUsingProduct: false,
      });
      const result = await createPortalSession.mutateAsync({
        returnPath: "/dashboard/settings/billing",
        flow: "cancel",
      });
      window.location.assign(result.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to open cancel flow");
    }
  };

  const loading =
    createCheckout.isPending ||
    createPortalSession.isPending ||
    saveCancellationFeedback.isPending ||
    pauseSubscription.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          reset();
        }
      }}
    >
      <DialogContent className="border-white/10 bg-sidebar text-white shadow-2xl sm:max-w-2xl">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-xl font-semibold tracking-[-0.04em] text-white">
            Keep your data, lose less value
          </DialogTitle>
          <DialogDescription className="text-sm text-white/45">
            Before you cancel, pick what is getting in the way. We will show the fastest path that keeps your journal intact.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="flex items-center gap-2 text-xs text-white/35">
            {[1, 2, 3].map((value) => (
              <div
                key={value}
                className={cn(
                  "rounded-full px-2.5 py-1 ring ring-white/10",
                  step === value ? "bg-white/10 text-white" : "bg-white/5"
                )}
              >
                Step {value}
              </div>
            ))}
          </div>

          {step === 1 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {REASONS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setReason(item.key)}
                  className={cn(
                    "rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition-colors",
                    reason === item.key
                      ? "border-white/30 bg-white/[0.06]"
                      : "hover:bg-white/[0.05]"
                  )}
                >
                  <p className="text-sm font-medium text-white">{item.label}</p>
                  <p className="mt-1 text-xs leading-5 text-white/40">{item.helper}</p>
                </button>
              ))}

              <div className="md:col-span-2">
                <Input
                  value={detail}
                  onChange={(event) => setDetail(event.target.value)}
                  placeholder="Optional detail"
                  className="h-11 border-white/10 bg-sidebar-accent text-sm text-white placeholder:text-white/28"
                />
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {annualOfferLabel ? (
                <button
                  type="button"
                  onClick={handleAnnualOffer}
                  disabled={loading}
                  className="rounded-2xl border border-teal-400/20 bg-teal-500/10 p-4 text-left transition-colors hover:bg-teal-500/14 disabled:cursor-default disabled:opacity-70"
                >
                  <div className="flex items-center gap-2 text-white">
                    <Wallet className="size-4 text-teal-300" />
                    <span className="text-sm font-medium">Switch to annual</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-white/55">
                    Save {annualDiscountPercent ?? 20}% and keep everything you already use.
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">{annualOfferLabel}</p>
                </button>
              ) : null}

              <button
                type="button"
                onClick={handlePause}
                disabled={loading}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition-colors hover:bg-white/[0.05] disabled:cursor-default disabled:opacity-70"
              >
                <div className="flex items-center gap-2 text-white">
                  <PauseCircle className="size-4 text-blue-300" />
                  <span className="text-sm font-medium">Pause instead</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-white/45">
                  Keep your data and stop billing while you step away.
                </p>
                <div className="mt-3 flex gap-2">
                  {[1, 2, 3].map((value) => (
                    <span
                      key={value}
                      onClick={(event) => {
                        event.stopPropagation();
                        setPauseMonths(value as 1 | 2 | 3);
                      }}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs ring ring-white/10",
                        pauseMonths === value ? "bg-white/12 text-white" : "bg-white/5 text-white/50"
                      )}
                    >
                      {value} mo
                    </span>
                  ))}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStep(3)}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition-colors hover:bg-white/[0.05] md:col-span-2"
              >
                <div className="flex items-center gap-2 text-white">
                  <XCircle className="size-4 text-white/65" />
                  <span className="text-sm font-medium">Still want to cancel</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-white/45">
                  Your plan stays active until the current billing period ends, and your data remains preserved on the free tier.
                </p>
              </button>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-2 text-white">
                <RotateCcw className="size-4 text-white/70" />
                <p className="text-sm font-medium">Final confirmation</p>
              </div>
              <p className="mt-3 text-sm leading-6 text-white/45">
                Extra accounts and premium reports become read-only on the free plan. Your trades, journal entries, and historical data stay in place so you can reactivate any time.
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => (step === 1 ? onOpenChange(false) : setStep((step - 1) as 1 | 2 | 3))}
            className="h-10 rounded-sm border border-white/10 bg-transparent text-white/65 hover:bg-white/5 hover:text-white"
          >
            {step === 1 ? "Close" : "Back"}
          </Button>

          {step === 1 ? (
            <Button
              type="button"
              onClick={() => setStep(2)}
              className="h-10 rounded-sm bg-white text-black hover:bg-white/90"
            >
              Continue
            </Button>
          ) : null}

          {step === 3 ? (
            <Button
              type="button"
              onClick={handleConfirmCancel}
              disabled={loading}
              className="h-10 rounded-sm bg-white text-black hover:bg-white/90"
            >
              {loading ? "Opening Stripe..." : "Continue to cancellation"}
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
