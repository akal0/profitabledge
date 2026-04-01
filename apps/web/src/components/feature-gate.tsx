"use client";

import { useMemo, useState } from "react";
import { Lock, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UpgradeModal } from "@/components/upgrade-modal";
import { trpcOptions } from "@/utils/trpc";
import { cn } from "@/lib/utils";
import { getBillingPlanTitle, type BillingPlanKey } from "@/features/settings/billing/lib/plan-labels";

const PLAN_TIER: Record<BillingPlanKey, number> = {
  student: 0,
  professional: 1,
  institutional: 2,
};

const FEATURE_REQUIREMENTS: Record<string, BillingPlanKey> = {
  "ai-assistant": "professional",
  "prop-tracker": "professional",
  "advanced-reports": "professional",
};

export function useFeatureGate(feature: string, requiredPlanKey?: BillingPlanKey) {
  const { data: billingState } = useQuery(trpcOptions.billing.getState.queryOptions());
  const currentPlan = (billingState?.billing?.activePlanKey ?? "student") as BillingPlanKey;
  const resolvedRequiredPlan = requiredPlanKey ?? FEATURE_REQUIREMENTS[feature] ?? "professional";

  return {
    currentPlan,
    requiredPlan: resolvedRequiredPlan,
    hasAccess: PLAN_TIER[currentPlan] >= PLAN_TIER[resolvedRequiredPlan],
  };
}

type FeatureGateProps = {
  feature: string;
  requiredPlanKey?: BillingPlanKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
};

export function FeatureGate({
  feature,
  requiredPlanKey,
  children,
  fallback,
  className,
}: FeatureGateProps) {
  const [open, setOpen] = useState(false);
  const { currentPlan, requiredPlan, hasAccess } = useFeatureGate(
    feature,
    requiredPlanKey
  );

  const teaserCopy = useMemo(() => {
    switch (feature) {
      case "ai-assistant":
        return "Ask questions about your trades, journal, and execution with plan-based Edge credits.";
      case "prop-tracker":
        return "Monitor challenge rules, drawdown pressure, and pass probability from one dashboard.";
      case "advanced-reports":
        return "Unlock richer reporting, polished exports, and deeper filtering for weekly review.";
      default:
        return "Upgrade when you need more depth, automation, or advanced analysis.";
    }
  }, [feature]);

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <>
      <div
        className={cn(
          "mx-auto flex min-h-[420px] w-full max-w-4xl items-center justify-center px-6 py-12",
          className
        )}
      >
        <div className="w-full max-w-2xl overflow-hidden rounded-[28px] bg-[#0b0b0e] ring ring-white/10 shadow-[0_24px_64px_rgba(0,0,0,0.35)]">
          <div className="relative overflow-hidden px-6 py-8 sm:px-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.22),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.18),transparent_24%)]" />
            <div className="relative">
              <Badge className="rounded-sm bg-white/8 px-2.5 py-1 text-[11px] text-white/72 ring ring-white/10">
                Current plan: {getBillingPlanTitle(currentPlan)}
              </Badge>
              <div className="mt-4 flex items-start gap-3">
                <div className="rounded-sm bg-white/8 p-2 ring ring-white/10">
                  <Lock className="size-4 text-white/70" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold tracking-[-0.05em] text-white">
                    This feature opens on {getBillingPlanTitle(requiredPlan)}
                  </h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">
                    {teaserCopy}
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl bg-white/[0.03] p-4 ring ring-white/8">
                <div className="flex items-start gap-3 text-sm text-white/78">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-teal-300" />
                  <span>
                    Keep your current data. Upgrade only when you want the faster workflow,
                    deeper analysis, or live automation.
                  </span>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  onClick={() => setOpen(true)}
                  className="h-10 rounded-sm bg-white text-black hover:bg-white/90"
                >
                  See upgrade options
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => window.location.assign("/dashboard/settings/billing")}
                  className="h-10 rounded-sm border border-white/10 bg-transparent text-white/70 hover:bg-white/5 hover:text-white"
                >
                  Open billing
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <UpgradeModal
        open={open}
        onOpenChange={setOpen}
        feature={feature}
        requiredPlanKey={requiredPlan}
      />
    </>
  );
}
