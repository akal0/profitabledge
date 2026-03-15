"use client";

import type { ReactNode } from "react";

import { ArrowDownRight, ArrowUpRight, CheckCircle2, Lightbulb, Minus, Tag as TagIcon, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  getTradeDirectionTone,
  getTradeIdentifierColorStyle,
  getTradeOutcomeTone,
  getTradeProtocolTone,
  TRADE_IDENTIFIER_PILL_CLASS,
  TRADE_IDENTIFIER_TONES,
} from "@/components/trades/trade-identifier-pill";

import {
  OUTCOME_FILTER_LABELS,
  type OutcomeFilterValue,
} from "./trades-toolbar-types";

export function DirectionPill({
  direction,
}: {
  direction: "long" | "short";
}) {
  return (
    <span
      className={cn(
        TRADE_IDENTIFIER_PILL_CLASS,
        "pointer-events-none gap-1 pr-2",
        getTradeDirectionTone(direction)
      )}
    >
      {direction === "long" ? "Long" : "Short"}
      {direction === "long" ? (
        <ArrowUpRight className="size-3 stroke-3" />
      ) : (
        <ArrowDownRight className="size-3 stroke-3" />
      )}
    </span>
  );
}

export function TagPill({
  label,
  color,
  icon,
  fallbackTone = TRADE_IDENTIFIER_TONES.neutral,
}: {
  label: string;
  color?: string | null;
  icon?: ReactNode;
  fallbackTone?: string;
}) {
  return (
    <span
      style={color ? getTradeIdentifierColorStyle(color) : undefined}
      className={cn(
        TRADE_IDENTIFIER_PILL_CLASS,
        "pointer-events-none max-w-[180px]",
        !color && fallbackTone
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </span>
  );
}

export function KillzonePill({
  label,
  color,
}: {
  label: string;
  color?: string | null;
}) {
  return <TagPill label={label} color={color} icon={<TagIcon className="size-3" />} />;
}

export function ModelTagPill({
  label,
  color,
}: {
  label: string;
  color?: string | null;
}) {
  return (
    <TagPill
      label={label}
      color={color}
      icon={<Lightbulb className="size-3" />}
    />
  );
}

export function ProtocolPill({
  value,
}: {
  value: "aligned" | "against" | "discretionary";
}) {
  const icon =
    value === "aligned" ? (
      <CheckCircle2 className="size-3" />
    ) : value === "against" ? (
      <XCircle className="size-3" />
    ) : (
      <Minus className="size-3" />
    );

  const label =
    value === "aligned"
      ? "Aligned"
      : value === "against"
        ? "Against"
        : "Discretionary";

  return (
    <span
      className={cn(
        TRADE_IDENTIFIER_PILL_CLASS,
        "pointer-events-none",
        getTradeProtocolTone(value)
      )}
    >
      {icon}
      <span>{label}</span>
    </span>
  );
}

export function OutcomePill({
  value,
}: {
  value: OutcomeFilterValue;
}) {
  if (value === "Live") {
    return (
      <span
        className={cn(
          TRADE_IDENTIFIER_PILL_CLASS,
          TRADE_IDENTIFIER_TONES.live,
          "pointer-events-none gap-2"
        )}
      >
        <span className="size-1.5 rounded-sm bg-teal-400 shadow-[0_0_8px_2px_rgba(45,212,191,0.35)]" />
        <span>Live</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        TRADE_IDENTIFIER_PILL_CLASS,
        "pointer-events-none",
        getTradeOutcomeTone(value)
      )}
    >
      {OUTCOME_FILTER_LABELS[value]}
    </span>
  );
}
