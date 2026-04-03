"use client";

import Link from "next/link";
import { ArrowRight, Lock, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { getBillingPlanTitle, type BillingPlanKey } from "@/features/settings/billing/lib/plan-labels";

const FEATURE_COPY: Record<
  string,
  {
    title: string;
    description: string;
    bullets: string[];
  }
> = {
  "ai-assistant": {
    title: "Unlock AI coaching",
    description:
      "Use the assistant for trade reviews, journaling prompts, and fast post-session debriefs.",
    bullets: [
      "Ask account-aware trading questions",
      "Turn raw trades into concrete coaching",
      "Use monthly Edge credits instead of your own tools",
    ],
  },
  "prop-tracker": {
    title: "Track your prop challenge",
    description:
      "See drawdown, profit targets, survival odds, and rule pressure in one place.",
    bullets: [
      "Monitor phase progress in real time",
      "Catch daily and max loss pressure early",
      "Upgrade for a workflow built for funded traders",
    ],
  },
  "advanced-reports": {
    title: "Open the full reports workspace",
    description:
      "Unlock richer reporting, deeper filtering, and a cleaner weekly review workflow.",
    bullets: [
      "Review strategy, session, and execution patterns",
      "Export polished reports for coaching or accountability",
      "Compare performance over time without spreadsheet work",
    ],
  },
  "live-sync": {
    title: "Unlock EA sync",
    description:
      "Use the MT5 EA bridge for terminal-side sync, live account updates, and the extra execution detail the standard API path misses.",
    bullets: [
      "Generate MetaTrader keys for the EA bridge",
      "Sync live positions and account health from MT5",
      "Capture richer intratrade metrics for review",
    ],
  },
  "ea-sync": {
    title: "Unlock EA sync",
    description:
      "Use the MT5 EA bridge for terminal-side sync, live account updates, and the extra execution detail the standard API path misses.",
    bullets: [
      "Generate MetaTrader keys for the EA bridge",
      "Sync live positions and account health from MT5",
      "Capture richer intratrade metrics for review",
    ],
  },
};

type UpgradeModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: string;
  requiredPlanKey: BillingPlanKey;
};

export function UpgradeModal({
  open,
  onOpenChange,
  feature,
  requiredPlanKey,
}: UpgradeModalProps) {
  const copy =
    FEATURE_COPY[feature] ?? {
      title: "Upgrade to keep going",
      description:
        "This workflow is available on a higher plan so free accounts can stay generous without hiding the basics.",
      bullets: [
        "Keep your current data and workspace",
        "Unlock the feature instantly after checkout",
        "Switch plans any time from billing settings",
      ],
    };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-[#0b0b0e] text-white shadow-2xl sm:max-w-lg">
        <DialogHeader className="space-y-3">
          <Badge className="w-fit rounded-sm bg-white/8 px-2.5 py-1 text-[11px] text-white/72 ring ring-white/10">
            Requires {getBillingPlanTitle(requiredPlanKey)}
          </Badge>
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold tracking-[-0.04em] text-white">
            <Lock className="size-4 text-white/65" />
            {copy.title}
          </DialogTitle>
          <DialogDescription className="text-sm text-white/45">
            {copy.description}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl bg-white/[0.03] p-4 ring ring-white/8">
          <div className="space-y-3">
            {copy.bullets.map((bullet) => (
              <div key={bullet} className="flex items-start gap-3 text-sm text-white/78">
                <Sparkles className="mt-0.5 size-3.5 shrink-0 text-teal-300" />
                <span>{bullet}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-10 rounded-sm border border-white/10 bg-transparent text-white/65 hover:bg-white/5 hover:text-white"
          >
            Remind me later
          </Button>
          <Button asChild className="h-10 rounded-sm bg-white text-black hover:bg-white/90">
            <Link href={`/dashboard/settings/billing?sourceFeature=${feature}`}>
              See plans
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
