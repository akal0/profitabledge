"use client";

import { TradeIdeaOgCard } from "@/features/trade-ideas/lib/trade-idea-og-card";
import type { TradeIdeaPresentation } from "@/features/trade-ideas/lib/trade-idea-utils";

export function TradeIdeaCardPreview({ idea }: { idea: TradeIdeaPresentation }) {
  return (
    <div className="overflow-x-auto rounded-[24px] border border-white/10 bg-[#07090e] p-3">
      <div className="min-w-max">
        <TradeIdeaOgCard idea={idea} width={720} height={378} />
      </div>
    </div>
  );
}
