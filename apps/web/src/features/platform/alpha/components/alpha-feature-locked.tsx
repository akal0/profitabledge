"use client";

import Link from "next/link";
import { AlertTriangle, LifeBuoy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getPublicAlphaFeatureDisabledMessage } from "@/lib/alpha-flags";
import type { AlphaFeatureKey } from "@profitabledge/platform";

interface AlphaFeatureLockedProps {
  feature: AlphaFeatureKey;
  title: string;
  className?: string;
  supportHref?: string;
}

export function AlphaFeatureLocked({
  feature,
  title,
  className,
  supportHref = "/dashboard/settings/support",
}: AlphaFeatureLockedProps) {
  return (
    <div
      className={cn(
        "flex min-h-[22rem] items-center justify-center rounded-2xl border border-white/10 bg-sidebar/70 px-6 py-8",
        className
      )}
    >
      <div className="mx-auto max-w-xl text-center">
        <Badge className="mb-4 border-amber-400/30 bg-amber-400/10 text-amber-200">
          Alpha guardrail
        </Badge>
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-amber-400/10 text-amber-300">
          <AlertTriangle className="size-5" />
        </div>
        <h1 className="text-2xl font-semibold text-white">{title}</h1>
        <p className="mt-3 text-sm text-white/60">
          {getPublicAlphaFeatureDisabledMessage(feature)}
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button asChild variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
          <Button asChild className="bg-white text-black hover:bg-white/90">
            <Link href={supportHref}>
              <LifeBuoy className="size-4" />
              Support
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
