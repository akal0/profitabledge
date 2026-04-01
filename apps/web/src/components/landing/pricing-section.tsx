"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { Check, Minus, PlusIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { trpcOptions } from "@/utils/trpc";
import CircleCheck from "@/public/icons/circle-check.svg";
import { BILLING_PLAN_CARD_META } from "@/features/settings/billing/lib/plan-card-meta";
import { getPlanFeatureLines } from "@/features/settings/billing/lib/plan-copy";

type BillingInterval = "monthly" | "annual";
type BillingPlanKey = "student" | "professional" | "institutional";

type PricingPlan = {
  key: BillingPlanKey;
  title: string;
  tagline?: string;
  summary: string;
  priceLabel: string;
  highlight?: string | null;
  ctaLabel: string;
  features: string[];
  accountAllowanceLabel: string;
  includedAiCredits: number;
  includedLiveSyncSlots: number;
  includesPropTracker: boolean;
  isFree: boolean;
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
  limits?: {
    importedTradesPerMonth?: number | "unlimited";
    journalStorageMb?: number | "unlimited";
  };
  includesAdvancedAnalytics?: boolean;
  includesExports?: boolean;
};

const SECTION_KICKER_STYLE = {
  backgroundImage:
    "radial-gradient(110% 150% at 50% 0%, #00ff7a 0%, #e9f3eb 94%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
  color: "transparent",
} as const;

const SECTION_TITLE_STYLE = {
  backgroundImage:
    "linear-gradient(180deg, #fff 0%, rgba(255,255,255,0.7) 100%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
  color: "transparent",
} as const;

const FAQS = [
  {
    question: "What exactly can I track inside Profitabledge?",
    answer:
      "You can track trades, accounts, journals, psychology notes, prop-firm progress, performance analytics, and AI-generated review workflows in one place.",
  },
  {
    question: "Do I need to enter every trade manually?",
    answer:
      "No. You can import via CSV, and paid plans unlock live sync for supported platforms so your review workflow stays current without spreadsheet cleanup.",
  },
  {
    question: "Who is this built for?",
    answer:
      "Profitabledge is built for retail traders, prop-firm challengers, and serious developing traders who want structure, not just a place to dump trades.",
  },
  {
    question: "Can I use Profitabledge for prop-firm challenges?",
    answer:
      "Yes. The platform includes prop tracking, rule monitoring, phase progress, and challenge-focused analytics so you can review performance against the rules that matter.",
  },
  {
    question: "What do the AI features actually help with?",
    answer:
      "AI helps summarize journals, surface patterns, answer questions about your trades, and speed up post-session review so you get to the lesson faster.",
  },
  {
    question: "Can I use my own AI key?",
    answer:
      "Yes. Hosted Edge credits are included by plan, and bring-your-own-key remains available for advanced users who want their own cost controls.",
  },
  {
    question: "What happens if I downgrade or cancel?",
    answer:
      "Your data stays in place. Trades, journals, and history are preserved, while premium-only workflows move to a read-only or reduced-access state depending on your plan.",
  },
  {
    question: "Can coaches, groups, or prop firms use this with traders?",
    answer:
      "Yes. Profitabledge can support partner pricing, mentorship groups, and prop-firm workflows where teams need shared reporting, onboarding, or bundled access.",
  },
] as const;

const COMPARISON_ROWS = [
  {
    label: "Accounts",
    getValue: (plan: PricingPlan) => plan.accountAllowanceLabel,
  },
  {
    label: "Live sync slots",
    getValue: (plan: PricingPlan) => plan.includedLiveSyncSlots,
  },
  {
    label: "Edge credits / month",
    getValue: (plan: PricingPlan) => plan.includedAiCredits,
  },
  {
    label: "Prop tracker",
    getValue: (plan: PricingPlan) => plan.includesPropTracker,
  },
  {
    label: "Advanced analytics",
    getValue: (plan: PricingPlan) => plan.includesAdvancedAnalytics,
  },
  {
    label: "Exports",
    getValue: (plan: PricingPlan) => plan.includesExports,
  },
  {
    label: "Imported trades / month",
    getValue: (plan: PricingPlan) => plan.limits?.importedTradesPerMonth,
  },
  {
    label: "Journal storage",
    getValue: (plan: PricingPlan) => {
      const value = plan.limits?.journalStorageMb;
      if (value === "unlimited") return "Unlimited";
      if (typeof value !== "number") return "-";
      return value >= 1000 ? `${Math.round(value / 1000)} GB` : `${value} MB`;
    },
  },
] as const;

function segmentedButtonClassName(active: boolean) {
  return cn(
    "cursor-pointer flex h-max w-max items-center justify-center gap-2 rounded-md px-3 py-2 text-xs transition-all duration-250 active:scale-95",
    active
      ? "bg-[#222225] text-white hover:bg-[#222225] hover:!brightness-120 ring ring-white/5"
      : "bg-[#222225]/25 text-white/25 hover:bg-[#222225] hover:!brightness-105 hover:text-white ring-0"
  );
}

function formatPricing(plan: PricingPlan, interval: BillingInterval) {
  if (plan.isFree) {
    return {
      amount: "Free",
      detail: " / No credit card required",
      savings: null,
    };
  }

  const annualPricing =
    interval === "annual" && plan.pricing?.annual?.isConfigured
      ? plan.pricing.annual
      : null;
  const monthlyPricing = plan.pricing?.monthly ?? null;
  const amount =
    annualPricing?.monthlyEquivalentCents ?? monthlyPricing?.priceCents ?? 0;

  return {
    amount: `£${(amount / 100).toFixed(0)}`,
    detail: annualPricing ? "/ mo billed annually" : "/ mo",
    savings: annualPricing?.discountPercent
      ? `Save ${annualPricing.discountPercent}%`
      : null,
  };
}

function renderComparisonValue(value: unknown) {
  if (typeof value === "boolean") {
    return value ? (
      <Check className="mx-auto size-4 text-teal-300" />
    ) : (
      <Minus className="mx-auto size-4 text-white/28" />
    );
  }

  if (value === "unlimited") {
    return "Unlimited";
  }

  if (typeof value === "number") {
    return new Intl.NumberFormat("en-US").format(value);
  }

  return String(value ?? "-");
}

function buildSignupHref(
  planKey: string,
  billingInterval: BillingInterval,
  isFree: boolean
) {
  if (isFree) {
    return "/sign-up";
  }

  const returnTo = encodeURIComponent(
    `/onboarding?plan=${planKey}&interval=${billingInterval}`
  );
  return `/sign-up?returnTo=${returnTo}`;
}

function ComparisonCard({ plans }: { plans: PricingPlan[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111111]">
      <div className="px-6 py-5 md:px-8">
        <h3 className="text-lg font-semibold tracking-[-0.04em] text-white">
          Full comparison
        </h3>
        <p className="mt-1 text-sm text-white/40">
          Core journaling stays free. Live sync, reporting, and advanced
          analytics drive the upgrades.
        </p>
      </div>
      <Separator className="opacity-15" />
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm text-white/70">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-[0.16em] text-white/35">
              <th className="px-6 py-4 md:px-8">Feature</th>
              {plans.map((plan) => (
                <th key={plan.key} className="px-6 py-4 text-center md:px-8">
                  {plan.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map((row) => (
              <tr
                key={row.label}
                className="border-b border-white/6 last:border-b-0"
              >
                <td className="px-6 py-4 text-white/58 md:px-8">{row.label}</td>
                {plans.map((plan) => (
                  <td
                    key={`${plan.key}-${row.label}`}
                    className="px-6 py-4 text-center text-white/78 md:px-8"
                  >
                    {renderComparisonValue(row.getValue(plan))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FaqCard() {
  const [openIndexes, setOpenIndexes] = useState<boolean[]>([]);

  const toggle = (index: number) => {
    setOpenIndexes((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  return (
    <div>
      <div className="px-1 pb-5">
        <h3 className="text-lg font-semibold tracking-[-0.04em] text-white">
          FAQ
        </h3>
        <p className="mt-1 text-sm text-white/40">
          Clear answers for plan changes, billing, AI, and partner pricing.
        </p>
      </div>
      <div className="flex flex-col gap-y-2">
        {FAQS.map((item, index) => {
          const opened = openIndexes[index];

          return (
            <m.div
              key={item.question}
              layout
              onClick={() => toggle(index)}
              className={cn(
                "cursor-pointer rounded-sm px-4 py-4 transition-colors duration-300 ring ring-white/5 md:px-5 md:py-5",
                opened
                  ? "bg-sidebar-accent text-white"
                  : "bg-sidebar text-white/40"
              )}
            >
              <div className="flex items-start gap-3 md:gap-4">
                <div className="shrink-0 py-1">
                  <PlusIcon
                    className={cn(
                      "size-4 transition-transform duration-500",
                      opened ? "rotate-45 text-white" : "rotate-0 text-white/35"
                    )}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-sm font-medium transition-colors duration-200 md:text-[15px]",
                      opened ? "text-white" : "text-white/40"
                    )}
                  >
                    {item.question}
                  </p>

                  <AnimatePresence initial={false}>
                    {opened ? (
                      <m.div
                        key="content"
                        layout="position"
                        initial={{ opacity: 0, y: 24, maxHeight: 0 }}
                        animate={{ opacity: 1, y: 0, maxHeight: 240 }}
                        exit={{ opacity: 0, y: 24, maxHeight: 0 }}
                        transition={{
                          duration: 0.55,
                          ease: [0.4, 0, 0.2, 1],
                        }}
                        style={{ overflow: "hidden" }}
                        className="w-full"
                      >
                        <p className="mt-3 text-xs leading-relaxed text-white/55 md:text-sm">
                          {item.answer}
                        </p>
                      </m.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </div>
            </m.div>
          );
        })}
      </div>
    </div>
  );
}

export function PricingFaqSection() {
  return (
    <section
      id="pricing-faq"
      className="relative w-full px-6 py-24 md:px-8 lg:px-12 xl:px-16 2xl:px-20 3xl:px-28"
    >
      <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p
            className="mb-4 inline-block text-sm font-medium text-transparent"
            style={SECTION_KICKER_STYLE}
          >
            Platform questions, answered clearly
          </p>
          <h2
            className="text-3xl font-semibold leading-[1.15] tracking-[-0.03em] sm:text-4xl md:text-4xl"
            style={SECTION_TITLE_STYLE}
          >
            The answers most traders want before they commit.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/40 sm:text-base">
            Start with the common questions around tracking, AI, prop-firm use,
            onboarding, cancellations, and how the platform fits into a real
            trading workflow.
          </p>
        </div>
      </div>

      <FaqCard />
    </section>
  );
}

export function PricingSection() {
  const { data } = useQuery(trpcOptions.billing.getPublicConfig.queryOptions());
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>("annual");
  const [hoveredCard, setHoveredCard] = useState<BillingPlanKey | null>(null);

  useEffect(() => {
    const nextInterval = String(data?.defaultBillingInterval ?? "");
    if (nextInterval === "monthly" || nextInterval === "annual") {
      setBillingInterval(nextInterval);
    }
  }, [data?.defaultBillingInterval]);

  const plans = useMemo(
    () => (data?.plans ?? []) as PricingPlan[],
    [data?.plans]
  );

  return (
    <section
      id="pricing"
      className="relative w-full px-6 py-24 md:px-8 lg:px-12 xl:px-16 2xl:px-20 3xl:px-28"
      style={{
        contentVisibility: "auto",
        containIntrinsicSize: "1px 1500px",
      }}
    >
      <div className="mb-8 flex flex-col gap-5 xl:flex-col xl:items-start xl:justify-between w-full">
        <div className="flex flex-col w-full">
          <p
            className="mb-2 inline-block text-sm font-medium text-transparent"
            style={SECTION_KICKER_STYLE}
          >
            Pricing that compounds with your routine
          </p>
          <div className="w-full flex justify-between items-end">
            <h2
              className=" text-3xl font-semibold leading-[1.15] tracking-[-0.03em] sm:text-4xl md:text-4xl"
              style={SECTION_TITLE_STYLE}
            >
              Start free. Upgrade when the review workflow earns it.
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-white/60 sm:text-sm font-medium">
              Profitabledge keeps journaling, core review, and one-account
              tracking free. Paid plans kick in when you want live sync,
              prop-firm tooling, exports, and AI-powered coaching.
            </p>
          </div>
        </div>

        <div className="flex h-max w-max items-center gap-1 rounded-md bg-white p-[3px] ring ring-white/5 dark:bg-muted/15">
          {(["monthly", "annual"] as const).map((interval) => (
            <Button
              key={interval}
              type="button"
              className={segmentedButtonClassName(billingInterval === interval)}
              onClick={() => setBillingInterval(interval)}
            >
              {interval === "monthly" ? "Monthly" : "Annual"}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid w-full gap-6 group/container xl:grid-cols-3">
        {plans.map((plan) => {
          const meta = BILLING_PLAN_CARD_META[plan.key];
          const isProfessional = plan.key === "professional";
          const isInstitutional = plan.key === "institutional";
          const pricing = formatPricing(plan, billingInterval);
          const featureLines = getPlanFeatureLines(plan);
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
          const ctaButtonCn = isProfessional
            ? "!ring !ring-blue-400/40 !bg-blue-400/32 !text-blue-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_14px_28px_rgba(37,99,235,0.075)] hover:!bg-blue-500/40 hover:!text-white"
            : isInstitutional
            ? "!ring !ring-emerald-400/40 !bg-emerald-400/32 !text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_14px_28px_rgba(0,0,0,0.075)] hover:!bg-emerald-400/40 hover:!text-white"
            : "!ring !ring-white/8 !bg-white/[0.04] !text-white/75 hover:!bg-white/[0.08] hover:!text-white";
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
                      <div className="flex items-center gap-2">
                        {plan.highlight ? (
                          <Badge
                            className={cn("text-[11px]", meta.badgeClassName)}
                          >
                            {plan.highlight}
                          </Badge>
                        ) : null}
                      </div>
                    </div>

                    <p className="text-xs font-medium tracking-[-0.04em] text-white/50 sm:text-xs">
                      {plan.summary}
                    </p>
                  </div>

                  <Separator className="-mx-5 w-auto opacity-20" />

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <p className="text-xl font-bold text-white sm:text-2xl">
                        {pricing.amount}
                        <span className="ml-1 text-sm font-medium text-white/35">
                          {pricing.detail}
                        </span>
                      </p>

                      {pricing.savings ? (
                        <Badge
                          className={cn("text-[11px]", meta.badgeClassName)}
                        >
                          {pricing.savings}
                        </Badge>
                      ) : null}
                    </div>

                    {plan.tagline ? (
                      <p className="font-medium text-right text-[11px] leading-5 text-white/35">
                        {plan.tagline}
                      </p>
                    ) : null}
                  </div>

                  <Separator className="-mx-5 w-auto opacity-20" />

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
                    <Button
                      asChild
                      variant="ghost"
                      className={cn(
                        "h-9 w-full cursor-pointer rounded-sm text-xs font-medium shadow-sidebar-button transition-all duration-250 active:scale-95",
                        ctaButtonCn
                      )}
                    >
                      <Link
                        href={buildSignupHref(
                          plan.key,
                          billingInterval,
                          plan.isFree
                        )}
                      >
                        {plan.isFree ? "Start free" : plan.ctaLabel}
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8">
        <ComparisonCard plans={plans} />
      </div>
    </section>
  );
}
