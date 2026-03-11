import type { CSSProperties } from "react";
import Color from "color";

export const TRADE_IDENTIFIER_PILL_CLASS =
  "inline-flex min-h-7 w-max max-w-full items-center gap-1.5 rounded-sm border px-2.5 py-1 text-[11px] font-medium leading-none tracking-wide whitespace-nowrap shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors";

export const TRADE_IDENTIFIER_BUTTON_CLASS =
  "h-7 rounded-sm border border-white/8 bg-white/[0.03] px-2.5 text-[11px] font-medium text-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-white/[0.06] hover:text-white";

export const TRADE_ACTION_BUTTON_CLASS =
  "h-8 rounded-sm border border-white/8 bg-white/[0.03] px-3 text-xs font-medium text-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-white/[0.06] hover:text-white disabled:opacity-50 disabled:hover:bg-white/[0.03]";

export const TRADE_ACTION_BUTTON_PRIMARY_CLASS =
  "h-8 rounded-sm border border-white/10 bg-white/[0.08] px-3 text-xs font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:bg-white/[0.12] disabled:opacity-50 disabled:hover:bg-white/[0.08]";

export const TRADE_ACTION_ICON_BUTTON_CLASS =
  "rounded-sm border border-white/10 bg-black/45 text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:bg-black/60 hover:text-white disabled:opacity-50";

export const TRADE_SURFACE_CARD_CLASS =
  "rounded-sm border border-white/8 bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";

export const TRADE_IDENTIFIER_TONES = {
  subdued: "border-white/8 bg-white/[0.025] text-white/45",
  neutral: "border-white/10 bg-white/[0.035] text-white/65",
  positive: "border-teal-400/20 bg-teal-400/12 text-teal-200",
  negative: "border-rose-400/20 bg-rose-400/12 text-rose-200",
  warning: "border-yellow-400/20 bg-yellow-400/12 text-yellow-200",
  amber: "border-amber-400/20 bg-amber-400/12 text-amber-200",
  info: "border-blue-400/20 bg-blue-400/12 text-blue-200",
  live: "border-cyan-400/20 bg-cyan-400/12 text-cyan-200",
  violet: "border-violet-400/20 bg-violet-400/12 text-violet-200",
} as const;

export function getTradeIdentifierColorStyle(color: string): CSSProperties {
  const swatch = Color(color);
  const surface = Color("#12151b");
  const tintStrength = swatch.isLight() ? 0.24 : 0.2;
  const background = surface.mix(swatch, tintStrength);
  const border = surface.mix(swatch, Math.min(tintStrength + 0.12, 0.4));
  const lightText = Color("#f8fafc");
  const darkText = Color("#111827");
  const textColor =
    background.contrast(lightText) >= background.contrast(darkText)
      ? lightText
      : darkText;

  return {
    backgroundColor: background.hex(),
    borderColor: border.hex(),
    color: textColor.hex(),
  };
}

export function getTradeDirectionTone(direction: string | null | undefined) {
  return direction === "long"
    ? TRADE_IDENTIFIER_TONES.positive
    : TRADE_IDENTIFIER_TONES.negative;
}

export function getTradeOutcomeTone(outcome: string | null | undefined) {
  switch (outcome) {
    case "Win":
      return TRADE_IDENTIFIER_TONES.positive;
    case "Loss":
      return TRADE_IDENTIFIER_TONES.negative;
    case "PW":
      return TRADE_IDENTIFIER_TONES.warning;
    case "BE":
      return TRADE_IDENTIFIER_TONES.neutral;
    default:
      return TRADE_IDENTIFIER_TONES.subdued;
  }
}

export function getTradeProtocolTone(alignment: string | null | undefined) {
  switch (alignment) {
    case "aligned":
      return TRADE_IDENTIFIER_TONES.info;
    case "against":
      return TRADE_IDENTIFIER_TONES.negative;
    case "discretionary":
      return TRADE_IDENTIFIER_TONES.neutral;
    default:
      return TRADE_IDENTIFIER_TONES.subdued;
  }
}
