"use client";

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
          const ctaButtonCn = isProfessional
            ? "!ring !ring-blue-600/90 !bg-blue-600/72 !text-blue-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_14px_28px_rgba(37,99,235,0.075)] hover:!bg-blue-500/80 hover:!text-white"
            : isInstitutional
            ? "!ring !ring-emerald-600/90 !bg-emerald-600/72 !text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_14px_28px_rgba(0,0,0,0.075)] hover:!bg-emerald-500/80 hover:!text-white"
            : "!ring !ring-white/10 !bg-white/[0.04] !text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:!bg-white/[0.08] hover:!text-white";
          const currentPlanCn = isProfessional
            ? "ring ring-blue-400/10 bg-blue-500/8 text-blue-100/55"
            : isInstitutional
            ? "ring ring-white/10 bg-white/[0.04] text-white/45"
            : "ring ring-white/5 bg-white/[0.02] text-white/25";
          const inactivePlanCn =
            "ring ring-white/5 bg-white/[0.02] text-white/25";
          const selectedFreePlanCn =
            "ring ring-white/10 bg-white/[0.04] text-white/55";

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
                      className={cn(
                        "h-max w-full cursor-pointer rounded-sm text-xs font-medium transition-all duration-250 active:scale-95 disabled:cursor-not-allowed disabled:opacity-100",
                        isButtonDisabled
                          ? isActive
                            ? currentPlanCn
                            : isSelected && plan.isFree
                            ? selectedFreePlanCn
                            : inactivePlanCn
                          : ctaButtonCn
                      )}
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
