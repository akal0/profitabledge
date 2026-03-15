"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import CircleCheck from "@/public/icons/circle-check.svg";
import Image from "next/image";
import { useState } from "react";

type BillingPlanKey = "student" | "professional" | "institutional";

type BillingPlan = {
  key: BillingPlanKey;
  title: string;
  summary: string;
  priceLabel: string;
  highlight: string | null;
  ctaLabel: string;
  features: string[];
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
    buttonClassName: string;
    badgeClassName: string;
    placeholderBadgeClassName: string;
  }
> = {
  student: {
    imageSrc: "/plans/explorer.png",
    buttonClassName:
      "bg-sidebar-accent hover:bg-violet-600 text-white hover:!brightness-105",
    badgeClassName: "bg-sidebar text-sidebar",
    placeholderBadgeClassName: "bg-sidebar text-sidebar",
  },
  professional: {
    imageSrc: "/plans/trader.png",
    buttonClassName:
      "bg-blue-600 hover:bg-blue-600 text-white hover:!brightness-105",
    badgeClassName: "bg-blue-600 text-white shadow-sidebar-button",
    placeholderBadgeClassName: "bg-sidebar text-sidebar",
  },
  institutional: {
    imageSrc: "/plans/institutional.png",
    buttonClassName:
      "bg-sidebar-accent hover:bg-green-600 text-white hover:!brightness-105",
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
      <div className="flex w-full gap-6 max-h-128 group/container">
        {plans.map((plan) => {
          const meta = CARD_META[plan.key];
          const isActive = activePlanKey === plan.key;
          const isSelected = selectedPlanKey === plan.key;
          const isPending = pendingPlanKey === plan.key;
          const buttonLabel = isPending
            ? "Redirecting..."
            : isActive
            ? "Current plan"
            : !plan.isConfigured
            ? "Unavailable"
            : isSelected && plan.isFree
            ? "Selected"
            : plan.ctaLabel;
          const isButtonDisabled =
            isPending ||
            isActive ||
            !plan.isConfigured ||
            (isSelected && plan.isFree);
          const price = splitPriceLabel(plan.priceLabel);

          return (
            <div
              key={plan.key}
              className="bg-sidebar border-[0.5px] border-white/5 shadow-sidebar-button rounded-lg w-full group h-full overflow-hidden transition-all duration-300 hover:scale-[103%]"
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

              <div className="py-4 flex flex-col gap-4 h-max">
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
                    <div className="flex flex-col gap-3 text-white/50 font-medium select-none">
                      {plan.features.map((feature) => (
                        <div
                          key={`${plan.key}-${feature}`}
                          className="flex items-center gap-2 text-[13px]"
                        >
                          <CircleCheck className="fill-white size-4.5 shrink-0" />
                          <p>{feature}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="px-6">
                    <Button
                      disabled={isButtonDisabled}
                      onClick={() => onSelectPlan(plan.key)}
                      className={`shadow-sidebar-button rounded-[6px] gap-2.5 h-max transition-all active:scale-95 cursor-pointer w-full text-xs duration-250 flex py-2 items-center justify-center disabled:cursor-not-allowed disabled:opacity-60 ${meta.buttonClassName}`}
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
