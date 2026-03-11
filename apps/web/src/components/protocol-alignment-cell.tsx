"use client";

import * as React from "react";
import { trpcClient, queryClient } from "@/utils/trpc";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  TRADE_IDENTIFIER_PILL_CLASS,
  TRADE_IDENTIFIER_TONES,
} from "@/components/trades/trade-identifier-pill";

interface ProtocolAlignmentCellProps {
  tradeId: string;
  protocolAlignment: "aligned" | "against" | "discretionary" | null | undefined;
}

const ALIGNMENT_STATES = {
  aligned: {
    label: "Aligned",
    icon: CheckCircle2,
    color: `${TRADE_IDENTIFIER_TONES.info} hover:bg-blue-400/15`,
    next: "against" as const,
  },
  against: {
    label: "Against",
    icon: XCircle,
    color: `${TRADE_IDENTIFIER_TONES.amber} hover:bg-amber-400/15`,
    next: "discretionary" as const,
  },
  discretionary: {
    label: "Discretionary",
    icon: Minus,
    color: `${TRADE_IDENTIFIER_TONES.neutral} hover:bg-white/[0.05]`,
    next: null,
  },
  null: {
    label: "Not set",
    icon: Minus,
    color: `${TRADE_IDENTIFIER_TONES.subdued} hover:bg-white/[0.05]`,
    next: "aligned" as const,
  },
} as const;

export function ProtocolAlignmentCell({
  tradeId,
  protocolAlignment,
}: ProtocolAlignmentCellProps) {
  const currentState = protocolAlignment ?? "null";
  const state = ALIGNMENT_STATES[currentState as keyof typeof ALIGNMENT_STATES];
  const Icon = state.icon;

  const updateMutation = useMutation({
    mutationFn: async (alignment: "aligned" | "against" | "discretionary" | null) => {
      const result = await trpcClient.trades.updateProtocolAlignment.mutate({
        tradeId,
        protocolAlignment: alignment,
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      console.error("Protocol alignment update failed:", error);
    },
  });

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Cycle through states: not set → aligned → against → discretionary → not set
    const nextAlignment = state.next;
    updateMutation.mutate(nextAlignment);
  };

  return (
    <div
      onClick={handleClick}
      onPointerDown={(e) => e.stopPropagation()}
      className="cursor-pointer"
    >
      <Badge
        variant="outline"
        className={cn(
          TRADE_IDENTIFIER_PILL_CLASS,
          state.color,
          updateMutation.isPending && "opacity-50 cursor-wait"
        )}
      >
        <Icon size={12} />
        <span className="text-xs">{state.label}</span>
      </Badge>
    </div>
  );
}
