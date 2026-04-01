"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  getPlanFeatureLines,
  type BillingPlanCopySource,
} from "@/features/settings/billing/lib/plan-copy";
import CircleCheck from "@/public/icons/circle-check.svg";
import Image from "next/image";
import { useState } from "react";
import { Sparkles } from "lucide-react";

type BillingPlanKey = "student" | "professional" | "institutional";
type BillingInterval = "monthly" | "annual";

type BillingPlan = BillingPlanCopySource & {
  key: BillingPlanKey;
  title: string;
  tagline?: string;
  summary: string;
  priceLabel: string;
  monthlyPriceCents: number;
  annualPriceCents?: number | null;
  annualMonthlyPriceCents?: number | null;
  annualDiscountPercent?: number | null;
  defaultTrialDays?: number;
  pricing?: {
    monthly?: {
      priceCents: number;
      isConfigured: boolean;
    };
    annual?: {
      priceCents: number;
      monthlyEquivalentCents?: number | null;
      discountPercent?: number | null;
      isConfigured: boolean;
    } | null;
  };
  highlight: string | null;
  ctaLabel: string;
  isFree: boolean;
  isConfigured: boolean;
};

type PlansProps = {
  plans: BillingPlan[];
  activePlanKey: BillingPlanKey;
  selectedPlanKey: BillingPlanKey;
  pendingPlanKey: BillingPlanKey | null;
  billingInterval: BillingInterval;
  onBillingIntervalChange: (billingInterval: BillingInterval) => void;
  onSelectPlan: (planKey: BillingPlanKey) => void;
};

const CARD_META: Record<
  BillingPlanKey,
  {
    imageSrc: string;
    badgeClassName: string;
  }
> = {
  student: {
    imageSrc: "/plans/explorer.png",
    badgeClassName: "bg-sidebar text-sidebar",
  },
  professional: {
    imageSrc: "/plans/trader.png",
    badgeClassName: "ring ring-blue-500/20 bg-blue-500/10 text-blue-300",
  },
  institutional: {
    imageSrc: "/plans/institutional.png",
    badgeClassName: "ring ring-emerald-500/20 bg-emerald-500/10 text-white",
  },
};

function splitPriceLabel(priceLabel: string) {
  if (priceLabel.toLowerCase() === "free") {
    return {
      amount: "Free",
      interval: null,
    };
  }

  const [amount, interval] = priceLabel.split(" / ");
  return {
    amount,
    interval: interval ? `/ ${interval}` : null,
  };
}

function getDisplayedPricing(plan: BillingPlan, billingInterval: BillingInterval) {
  if (plan.isFree) {
    return {
      amount: "Free",
      interval: null,
      detail: null,
      savings: null,
    };
  }

  const annualPricing = plan.pricing?.annual;
  if (billingInterval === "annual" && annualPricing?.isConfigured) {
    return {
      amount: `£${(annualPricing.priceCents / 100).toFixed(0)}`,
      interval: "/ year",
      detail:
        annualPricing.monthlyEquivalentCents != null
          ? `£${(annualPricing.monthlyEquivalentCents / 100).toFixed(
              0
            )}/mo billed annually`
          : null,
      savings:
        typeof annualPricing.discountPercent === "number"
          ? `Save ${annualPricing.discountPercent}%`
          : null,
    };
  }

  const fallback = splitPriceLabel(plan.priceLabel);
  return {
    amount: fallback.amount,
    interval: fallback.interval,
    detail: null,
    savings: null,
  };
}

const Plans = ({
  plans,
  activePlanKey,
  selectedPlanKey,
  pendingPlanKey,
  billingInterval,
  onBillingIntervalChange,
  onSelectPlan,
}: PlansProps) => {
  const [hoveredCard, setHoveredCard] = useState<BillingPlanKey | null>(null);

  return (
    <div className="flex flex-col w-full items-center justify-center antialiased">
      <div className="mb-6 flex w-full max-w-md items-center justify-center rounded-full border border-white/10 bg-white/[0.04] p-1">
        {(["monthly", "annual"] as const).map((interval) => (
          <button
            key={interval}
            type="button"
            onClick={() => onBillingIntervalChange(interval)}
            className={cn(
              "flex-1 rounded-full px-4 py-2 text-sm transition-colors",
              billingInterval === interval
                ? "bg-white text-black"
                : "text-white/60 hover:text-white"
            )}
          >
            {interval === "monthly" ? "Monthly" : "Annual"}
          </button>
        ))}
      </div>

      <div className="grid w-full gap-6 group/container xl:grid-cols-3">
        {plans.map((plan) => {
          const meta = CARD_META[plan.key];
          const isActive = activePlanKey === plan.key;
          const isLockedCurrentPlan = isActive && !plan.isFree;
          const isSelected = selectedPlanKey === plan.key;
          const isPending = pendingPlanKey === plan.key;
          const hasSelectedIntervalConfigured = plan.isFree
            ? true
            : billingInterval === "annual"
              ? Boolean(plan.pricing?.annual?.isConfigured)
              : Boolean(plan.pricing?.monthly?.isConfigured);
          const buttonLabel = isPending
            ? "Redirecting..."
            : isLockedCurrentPlan
            ? "Current plan"
            : !hasSelectedIntervalConfigured
            ? `${billingInterval} not configured`
            : plan.isFree
            ? "Stick with this plan"
            : plan.ctaLabel;
          const isButtonDisabled =
            isPending ||
            isLockedCurrentPlan ||
            !hasSelectedIntervalConfigured;
          const isProfessional = plan.key === "professional";
          const isInstitutional = plan.key === "institutional";
          const price = getDisplayedPricing(plan, billingInterval);
          const featureLines = getPlanFeatureLines(plan);
          const canCheckout = !plan.isFree && hasSelectedIntervalConfigured;
          const outerCn = isProfessional
            ? "bg-blue-500/10 ring-blue-500/25"
            : isInstitutional
            ? "bg-emerald-500/10 ring-emerald-500/25"
            : "bg-sidebar ring-white/10";
          const innerCn = isProfessional
            ? "bg-blue-500/5"
            : isInstitutional
            ? "bg-emerald-500/5"
            : "bg-sidebar-accent";
          const titleCn = isProfessional
            ? "text-blue-200"
            : isInstitutional
            ? "text-emerald-200"
            : "text-white";
          const accentTextCn = isProfessional
            ? "text-blue-300"
            : isInstitutional
            ? "text-emerald-300"
            : "text-white";
          const currentBadgeCn = isProfessional
            ? "ring ring-blue-500/20 bg-blue-900/30 text-blue-300"
            : isInstitutional
            ? "ring ring-white/10 bg-white/5 text-white"
            : "ring ring-white/10 bg-white/5 text-white/60";
          const ctaButtonCn = isProfessional
            ? "!ring !ring-blue-400/40 !bg-blue-400/32 !text-blue-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_14px_28px_rgba(37,99,235,0.075)] hover:!bg-blue-500/40 hover:!text-white"
            : isInstitutional
            ? "!ring !ring-emerald-400/40 !bg-emerald-400/32 !text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_14px_28px_rgba(0,0,0,0.075)] hover:!bg-emerald-400/40 hover:!text-white"
            : "!ring !ring-white/8 !bg-white/[0.04] !text-white/75 hover:!bg-white/[0.08] hover:!text-white";
          const currentPlanCn = isProfessional
            ? "ring ring-blue-400/10 bg-blue-500/8 text-blue-100/55"
            : isInstitutional
            ? "ring ring-white/10 bg-white/[0.04] text-white/45"
            : "ring ring-white/5 bg-white/[0.02] text-white/25";
          const freePlanCn =
            "ring ring-white/5 bg-white/[0.02] text-white/25";
          const checkCn = isProfessional
            ? "fill-blue-400"
            : isInstitutional
            ? "fill-emerald-400"
            : "fill-white/40";

          return (
            <div
              key={plan.key}
              className={cn(
                "group flex flex-col overflow-hidden rounded-sm p-1.5 ring-1 shadow-sidebar-button transition-all duration-300 hover:scale-[103%] cursor-pointer",
                outerCn
              )}
              style={{
                opacity: hoveredCard && hoveredCard !== plan.key ? 0.2 : 1,
                filter:
                  hoveredCard && hoveredCard !== plan.key
                    ? "blur(2.5px)"
                    : "none",
              }}
              onMouseEnter={() => setHoveredCard(plan.key)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <div
                className={cn(
                  "flex flex-1 flex-col overflow-hidden rounded-sm transition-all duration-250 group-hover:brightness-110",
                  innerCn
                )}
              >
                <div className="relative h-32 w-full overflow-hidden rounded-t-sm">
                  <Image
                    src={meta.imageSrc}
                    alt={plan.title}
                    fill
                    className="object-cover opacity-75 grayscale transition duration-500 group-hover:grayscale-0 group-hover:opacity-100"
                  />
                </div>
                <Separator className="opacity-25" />

                <div className="flex flex-1 flex-col gap-4 p-5">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={cn(
                          "text-xs font-bold tracking-[-0.04em] text-white/40 sm:text-base",
                          titleCn
                        )}
                      >
                        {plan.title}
                      </p>
                      {isActive ? (
                        <Badge className={cn("text-[11px]", currentBadgeCn)}>
                          Current
                        </Badge>
                      ) : null}
                    </div>

                    <p className="text-xs font-medium tracking-[-0.04em] text-white/50 sm:text-xs">
                      {plan.summary}
                    </p>
                  </div>

                  <Separator className="-mx-5 w-auto opacity-15" />

                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xl font-bold text-white">
                          {price.amount}
                          {price.interval ? (
                            <span className="ml-1 text-sm font-normal text-white/35">
                              {price.interval}
                            </span>
                          ) : null}
                        </p>
                        {price.detail ? (
                          <p className="text-xs text-white/35">{price.detail}</p>
                        ) : null}
                      </div>
                      {plan.highlight ? (
                        <span
                          className={cn(
                            "rounded px-3 py-1 text-[10px] font-semibold",
                          meta.badgeClassName
                        )}
                      >
                        {plan.highlight}
                      </span>
                    ) : null}
                  </div>

                  {price.savings ? (
                    <p className="text-[11px] uppercase tracking-[0.16em] text-teal-300">
                      {price.savings}
                    </p>
                  ) : null}

                  <Separator className="-mx-5 w-auto opacity-15" />

                  <ul className="flex flex-1 flex-col gap-2.5">
                    {featureLines.map((line) => (
                      <li
                        key={`${plan.key}-${line.key}`}
                        className={cn(
                          "flex items-start gap-2 text-[13px] font-medium",
                          line.tone === "positive"
                            ? "text-white"
                            : line.tone === "muted"
                            ? "text-white/28"
                            : "text-white"
                        )}
                      >
                        <CircleCheck
                          className={cn(
                            "mt-px size-4.5 shrink-0",
                            line.tone === "muted" ? "fill-white/18" : checkCn
                          )}
                        />
                        <span>
                          {line.prefix}
                          {line.accent ? (
                            <span
                              className={
                                line.accentTone === "card"
                                  ? accentTextCn
                                  : undefined
                              }
                            >
                              {line.accent}
                            </span>
                          ) : null}
                          {line.suffix}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto pt-1">
                    {isLockedCurrentPlan ? (
                      <div
                        className={cn(
                          "flex h-9 w-full items-center justify-center rounded-sm text-xs",
                          currentPlanCn
                        )}
                      >
                        Current plan
                      </div>
                    ) : !hasSelectedIntervalConfigured ? (
                      <div
                        className={cn(
                          "flex h-9 w-full items-center justify-center rounded-sm text-xs",
                          freePlanCn
                        )}
                      >
                        {buttonLabel}
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        disabled={isButtonDisabled}
                        onClick={() => onSelectPlan(plan.key)}
                        className={cn(
                          "h-9 w-full cursor-pointer rounded-sm text-xs font-medium shadow-sidebar-button transition-all duration-250 active:scale-95",
                          ctaButtonCn,
                          isSelected && plan.isFree && freePlanCn,
                          isSelected && plan.isFree && "hover:!bg-white/[0.02] hover:!text-white/25",
                          isPending && "cursor-wait"
                        )}
                      >
                        {canCheckout ? (
                          <Sparkles className="size-3" />
                        ) : null}
                        {buttonLabel}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Plans;
