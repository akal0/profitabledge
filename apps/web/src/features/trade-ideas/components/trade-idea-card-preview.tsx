"use client";

import { useEffect, useRef, useState } from "react";

import { GoalContentSeparator, GoalSurface } from "@/components/goals/goal-surface";
import { TradeIdeaOgCard } from "@/features/trade-ideas/lib/trade-idea-og-card";
import type { TradeIdeaPresentation } from "@/features/trade-ideas/lib/trade-idea-utils";

export function TradeIdeaCardPreview({ idea }: { idea: TradeIdeaPresentation }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [previewWidth, setPreviewWidth] = useState(720);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const updateWidth = () => {
      const nextWidth = Math.max(320, Math.floor(element.clientWidth));
      setPreviewWidth(nextWidth);
    };

    updateWidth();

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return (
    <GoalSurface className="overflow-hidden">
      <div className="p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-white">Link preview</p>
            <p className="mt-1 text-xs text-white/40">
              This is the card people will see when your link unfurls.
            </p>
          </div>
        </div>
        <GoalContentSeparator className="mb-3.5 mt-3.5" />
        <div className="rounded-sm border border-white/8 bg-black/20 p-3">
          <div ref={containerRef} className="w-full">
            <TradeIdeaOgCard
              idea={idea}
              width={previewWidth}
              height={Math.round(previewWidth * 0.525)}
            />
          </div>
        </div>
      </div>
    </GoalSurface>
  );
}
