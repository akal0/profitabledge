"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  getPlanFeatureLines,
  type BillingPlanCopySource,
} from "@/features/settings/billing/lib/plan-copy";
import { getOnboardingButtonClassName } from "@/features/onboarding/lib/onboarding-button-styles";
import CircleCheck from "@/public/icons/circle-check.svg";
import Image from "next/image";
import { useState } from "react";

type BillingPlanKey = "student" | "professional" | "institutional";

type BillingPlan = BillingPlanCopySource & {
  key: BillingPlanKey;
  title: string;
  summary: string;
  priceLabel: string;
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
  onSelectPlan: (planKey: BillingPlanKey) => void;
};

const CARD_META: Record<
  BillingPlanKey,
  {
    imageSrc: string;
    badgeClassName: string;
    placeholderBadgeClassName: string;
  }
> = {
  student: {
    imageSrc: "/plans/explorer.png",
    badgeClassName: "bg-sidebar text-sidebar",
    placeholderBadgeClassName: "bg-sidebar text-sidebar",
  },
  professional: {
    imageSrc: "/plans/trader.png",
    badgeClassName: "bg-blue-600 text-white shadow-sidebar-button",
    placeholderBadgeClassName: "bg-sidebar text-sidebar",
  },
  institutional: {
    imageSrc: "/plans/institutional.png",
    badgeClassName: "bg-emerald-700/80 text-white shadow-sidebar-button",
    placeholderBadgeClassName: "bg-sidebar text-sidebar",
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

const Plans = ({
  plans,
  activePlanKey,
  selectedPlanKey,
  pendingPlanKey,
  onSelectPlan,
}: PlansProps) => {
  const [hoveredCard, setHoveredCard] = useState<BillingPlanKey | null>(null);

  return (
    <div className="flex flex-col w-full items-center justify-center antialiased">
      <div className="grid w-full gap-6 group/container xl:grid-cols-3">
        {plans.map((plan) => {
          const meta = CARD_META[plan.key];
          const isActive = activePlanKey === plan.key;
          const isLockedCurrentPlan = isActive && !plan.isFree;
          const isSelected = selectedPlanKey === plan.key;
          const isPending = pendingPlanKey === plan.key;
          const buttonLabel = isPending
            ? "Redirecting..."
            : isLockedCurrentPlan
            ? "Current plan"
            : !plan.isConfigured
            ? "Unavailable"
            : plan.isFree
            ? "Stick with this plan"
            : plan.ctaLabel;
          const isButtonDisabled =
            isPending ||
            isLockedCurrentPlan ||
            !plan.isConfigured;
          const isProfessional = plan.key === "professional";
          const isInstitutional = plan.key === "institutional";
          const price = splitPriceLabel(plan.priceLabel);
          const featureLines = getPlanFeatureLines(plan);
          const accentTextCn = isProfessional
            ? "text-blue-300"
            : isInstitutional
            ? "text-emerald-300"
            : "text-white";
          const checkCn = isProfessional
            ? "fill-blue-400"
            : isInstitutional
            ? "fill-emerald-400"
            : "fill-white/40";
          const buttonTone =
            !plan.isConfigured || (isSelected && plan.isFree)
              ? "neutral"
              : isProfessional
              ? "teal"
              : isInstitutional
              ? "gold"
              : "neutral";

          return (
            <div
              key={plan.key}
              className="bg-sidebar ring ring-white/5 shadow-sidebar-button rounded-lg w-full group overflow-hidden transition-all duration-300 hover:scale-[101.5%] cursor-pointer"
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
              <div>
                <div className="relative w-full h-32 p-3 px-6 flex items-end">
                  <Image
                    src={meta.imageSrc}
                    alt={plan.title}
                    fill
                    className="object-cover opacity-75 shadow-secondary-button group-hover:opacity-100 transition duration-500 grayscale group-hover:grayscale-0"
                  />

                  <div className="flex text-xs text-white uppercase font-bold z-10 w-full justify-between items-end select-none">
                    <h1>{plan.title}</h1>
                  </div>
                </div>
                <Separator />
              </div>

              <div className="py-4 flex flex-col gap-4">
                <h1 className="text-xs text-secondary leading-relaxed px-6 select-none min-h-10">
                  {plan.summary}
                </h1>

                <Separator />

                <div className="flex w-full justify-between px-6 select-none items-center gap-3">
                  <h1 className="text-white font-bold text-lg">
                    {price.amount}
                    {price.interval ? (
                      <span className="text-secondary text-sm font-normal ml-1">
                        {price.interval}
                      </span>
                    ) : null}
                  </h1>

                  {plan.highlight ? (
                    <h1
                      className={`px-4 py-1.5 text-[10px] rounded-[6px] font-semibold ${meta.badgeClassName}`}
                    >
                      {plan.highlight}
                    </h1>
                  ) : (
                    <h1
                      className={`px-4 py-1.5 text-[10px] rounded-[6px] font-semibold select-none ${meta.placeholderBadgeClassName}`}
                    >
                      .
                    </h1>
                  )}
                </div>

                <Separator />

                <div className="flex flex-col gap-4">
                  <div className="px-6 py-1.5">
                    <div className="grid gap-3 text-white/50 font-medium select-none">
                      {featureLines.map((line) => (
                        <div
                          key={`${plan.key}-${line.key}`}
                          className={`flex items-start gap-2 text-[13px] ${
                            line.tone === "muted"
                              ? "text-white/28"
                              : "text-white"
                          }`}
                        >
                          <CircleCheck
                            className={`mt-px size-4.5 shrink-0 ${
                              line.tone === "muted" ? "fill-white/18" : checkCn
                            }`}
                          />
                          <p>
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
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="px-6">
                    <Button
                      disabled={isButtonDisabled}
                      onClick={() => onSelectPlan(plan.key)}
                      className={getOnboardingButtonClassName({
                        tone: buttonTone,
                        className: cn(
                          "w-full",
                          isLockedCurrentPlan && "disabled:opacity-60",
                          isSelected && plan.isFree && "disabled:opacity-55"
                        ),
                      })}
                    >
                      {buttonLabel}
                    </Button>
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
