export function getConnectionBadgeClassName(kind?: string | null) {
  switch (kind) {
    case "broker_synced":
    case "api_synced":
      return "ring-cyan-500/30 bg-cyan-500/15 text-cyan-300";
    case "mt5_synced":
      return "ring-sky-500/30 bg-sky-500/15 text-sky-300";
    case "mt4_synced":
      return "ring-indigo-500/30 bg-indigo-500/15 text-indigo-300";
    case "ea_synced":
      return "ring-teal-500/30 bg-teal-500/15 text-teal-300";
    case "csv_imported":
      return "ring-amber-500/30 bg-amber-500/15 text-amber-300";
    case "demo":
      return "ring-violet-500/30 bg-violet-500/15 text-violet-300";
    default:
      return "ring-white/10 bg-white/5 text-white/60";
  }
}

export function getOriginBadgeClassName(originType?: string | null) {
  switch (originType) {
    case "broker_sync":
      return "ring-teal-500/30 bg-teal-500/15 text-teal-300";
    case "csv_import":
      return "ring-amber-500/30 bg-amber-500/15 text-amber-300";
    case "manual_entry":
      return "ring-white/10 bg-white/5 text-white/70";
    default:
      return "ring-white/10 bg-white/5 text-white/55";
  }
}

export function getAffiliateBadgeClassName(effectVariant?: string | null) {
  switch (effectVariant) {
    case "emerald_aurora":
      return "ring-emerald-500/30 bg-emerald-500/15 text-emerald-200";
    case "teal_signal":
      return "ring-teal-500/30 bg-teal-500/15 text-teal-200";
    default:
      return "ring-amber-500/30 bg-amber-500/15 text-amber-200";
  }
}

export function getAffiliateBannerOverlayClassName(
  effectVariant?: string | null
) {
  switch (effectVariant) {
    case "emerald_aurora":
      return "bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.42),transparent_38%),radial-gradient(circle_at_top_right,rgba(45,212,191,0.22),transparent_32%)]";
    case "teal_signal":
      return "bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.34),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.18),transparent_34%)]";
    default:
      return "bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.4),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.18),transparent_30%)]";
  }
}

export function getAffiliateHighlightClassName(effectVariant?: string | null) {
  switch (effectVariant) {
    case "emerald_aurora":
      return "border-emerald-500/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.2),rgba(15,23,42,0.6))] text-emerald-100";
    case "teal_signal":
      return "border-cyan-500/20 bg-[linear-gradient(135deg,rgba(45,212,191,0.18),rgba(8,47,73,0.65))] text-cyan-100";
    default:
      return "border-amber-500/20 bg-[linear-gradient(135deg,rgba(251,191,36,0.18),rgba(20,83,45,0.5))] text-amber-50";
  }
}

/* ── PFP effects ── */

export function getAffiliatePfpEffectClassName(pfpEffect?: string | null) {
  switch (pfpEffect) {
    case "gold_glow":
      return "ring-4 ring-amber-400/50 shadow-[0_0_20px_rgba(251,191,36,0.45),0_0_40px_rgba(251,191,36,0.2)]";
    case "emerald_pulse":
      return "ring-4 ring-emerald-400/50 [--pfp-glow:rgba(16,185,129,0.45)] [--pfp-glow-outer:rgba(16,185,129,0.2)] shadow-[0_0_20px_rgba(16,185,129,0.45),0_0_40px_rgba(16,185,129,0.2)] animate-[pfp-pulse_2.5s_ease-in-out_infinite]";
    case "rainbow_ring":
      return "ring-4 ring-transparent [background:conic-gradient(from_0deg,#f97316,#eab308,#22c55e,#06b6d4,#8b5cf6,#ec4899,#f97316)_padding-box] animate-[pfp-rainbow-spin_4s_linear_infinite]";
    case "frost_aura":
      return "ring-4 ring-sky-300/50 shadow-[0_0_24px_rgba(56,189,248,0.5),0_0_48px_rgba(56,189,248,0.2)]";
    case "shadow_pulse":
      return "ring-4 ring-purple-500/40 [--pfp-glow:rgba(168,85,247,0.5)] [--pfp-glow-outer:rgba(88,28,135,0.3)] shadow-[0_0_20px_rgba(168,85,247,0.5),0_0_40px_rgba(88,28,135,0.3)] animate-[pfp-pulse_3s_ease-in-out_infinite]";
    case "electric_spark":
      return "ring-4 ring-cyan-400/50 [--pfp-glow:rgba(34,211,238,0.6)] [--pfp-glow-outer:rgba(56,189,248,0.3)] shadow-[0_0_16px_rgba(34,211,238,0.6),0_0_32px_rgba(56,189,248,0.3)] animate-[pfp-electric_1.5s_ease-in-out_infinite]";
    case "sakura_ring":
      return "ring-4 ring-pink-300/50 [--pfp-glow:rgba(244,114,182,0.45)] [--pfp-glow-outer:rgba(251,113,133,0.2)] shadow-[0_0_18px_rgba(244,114,182,0.45),0_0_36px_rgba(251,113,133,0.2)] animate-[pfp-sakura_3s_ease-in-out_infinite]";
    case "neon_pulse":
      return "ring-4 ring-green-400/60 [--pfp-glow:rgba(74,222,128,0.7)] [--pfp-glow-outer:rgba(34,197,94,0.4)] shadow-[0_0_12px_rgba(74,222,128,0.7),0_0_28px_rgba(34,197,94,0.4),0_0_56px_rgba(22,163,74,0.2)] animate-[pfp-pulse_2s_ease-in-out_infinite]";
    case "hearts":
      return "ring-4 ring-rose-400/50 [--pfp-glow:rgba(251,113,133,0.5)] [--pfp-glow-outer:rgba(244,63,94,0.25)] shadow-[0_0_20px_rgba(251,113,133,0.5),0_0_40px_rgba(244,63,94,0.25)] animate-[pfp-hearts_2s_ease-in-out_infinite]";
    case "custom":
      return "ring-4";
    default:
      return "";
  }
}

const CUSTOM_RING_ANIMATIONS: Record<string, string> = {
  none: "",
  pulse: "animate-[pfp-pulse_2.5s_ease-in-out_infinite]",
  electric: "animate-[pfp-electric_1.5s_ease-in-out_infinite]",
  sakura: "animate-[pfp-sakura_3s_ease-in-out_infinite]",
  heartbeat: "animate-[pfp-hearts_2s_ease-in-out_infinite]",
};

export function getCustomPfpAnimationClassName(
  customRingEffect?: string | null
) {
  return CUSTOM_RING_ANIMATIONS[customRingEffect ?? "none"] ?? "";
}

export const CUSTOM_RING_EFFECT_PRESETS = [
  { value: "none", label: "Static" },
  { value: "pulse", label: "Pulse" },
  { value: "electric", label: "Electric" },
  { value: "sakura", label: "Soft Pulse" },
  { value: "heartbeat", label: "Heartbeat" },
] as const;

export function getAffiliatePfpEffectStyle(
  pfpEffect?: string | null,
  customRing?: { from?: string; to?: string } | null
): React.CSSProperties | undefined {
  if (pfpEffect !== "custom" || !customRing?.from || !customRing?.to)
    return undefined;
  const from = customRing.from;
  const r1 = parseInt(from.slice(1, 3), 16);
  const g1 = parseInt(from.slice(3, 5), 16);
  const b1 = parseInt(from.slice(5, 7), 16);
  return {
    ["--tw-ring-color" as string]: from,
    ["--pfp-glow" as string]: `rgba(${r1},${g1},${b1},0.5)`,
    ["--pfp-glow-outer" as string]: `rgba(${r1},${g1},${b1},0.2)`,
    boxShadow: `var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), 0 0 20px rgba(${r1},${g1},${b1},0.5), 0 0 40px rgba(${r1},${g1},${b1},0.2)`,
  };
}

export function getAffiliatePfpWrapperClassName(pfpEffect?: string | null) {
  if (pfpEffect === "rainbow_ring") {
    return "rounded-full p-[3px] bg-[conic-gradient(from_0deg,#f97316,#eab308,#22c55e,#06b6d4,#8b5cf6,#ec4899,#f97316)] animate-[pfp-rainbow-spin_4s_linear_infinite]";
  }
  if (pfpEffect === "sakura_ring") {
    return "rounded-full p-[3px] bg-[conic-gradient(from_0deg,#f9a8d4,#f472b6,#fb7185,#fda4af,#f9a8d4)] animate-[pfp-rainbow-spin_6s_linear_infinite]";
  }
  return "";
}

/* ── Name colors ── */

export function getAffiliateNameColorStyle(
  nameColor?: string | null,
  customGradient?: { from?: string; to?: string } | null
): React.CSSProperties | undefined {
  if (nameColor === "custom" && customGradient?.from && customGradient?.to) {
    return {
      backgroundImage: `linear-gradient(135deg, ${customGradient.from}, ${customGradient.to})`,
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
    };
  }
  switch (nameColor) {
    case "gold":
      return {
        backgroundImage: "linear-gradient(135deg, #fbbf24, #f59e0b, #d97706)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      };
    case "emerald":
      return {
        backgroundImage: "linear-gradient(135deg, #34d399, #10b981, #059669)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      };
    case "ocean":
      return {
        backgroundImage: "linear-gradient(135deg, #22d3ee, #0ea5e9, #6366f1)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      };
    case "sunset":
      return {
        backgroundImage: "linear-gradient(135deg, #fb923c, #f43f5e, #ec4899)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      };
    case "rose":
      return {
        backgroundImage: "linear-gradient(135deg, #fb7185, #e879f9, #c084fc)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      };
    case "aurora":
      return {
        backgroundImage:
          "linear-gradient(135deg, #34d399, #22d3ee, #818cf8, #c084fc)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      };
    case "ice":
      return {
        backgroundImage:
          "linear-gradient(135deg, #e0f2fe, #7dd3fc, #38bdf8, #0ea5e9)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      };
    case "midnight":
      return {
        backgroundImage:
          "linear-gradient(135deg, #818cf8, #6366f1, #4f46e5, #312e81)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      };
    case "fire":
      return {
        backgroundImage:
          "linear-gradient(135deg, #fbbf24, #f97316, #ef4444, #dc2626)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      };
    case "neon":
      return {
        backgroundImage:
          "linear-gradient(135deg, #4ade80, #22d3ee, #a78bfa, #f472b6)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      };
    default:
      return undefined;
  }
}

/* ── Name fonts ── */

export function getAffiliateNameFontClassName(nameFont?: string | null) {
  switch (nameFont) {
    case "serif":
      return "font-serif";
    case "mono":
      return "font-mono";
    case "display":
      return "font-black tracking-tight uppercase";
    case "handwriting":
      return "italic";
    case "gothic":
      return "font-serif font-black tracking-widest uppercase";
    case "thin":
      return "font-extralight tracking-[0.2em]";
    case "rounded":
      return "font-medium tracking-wide";
    default:
      return "";
  }
}

/* ── Name effects ── */

export function getAffiliateNameEffectClassName(nameEffect?: string | null) {
  switch (nameEffect) {
    case "sparkle":
      return "animate-[name-glow_2.5s_ease-in-out_infinite]";
    case "glow":
      return "animate-[name-glow_2s_ease-in-out_infinite]";
    case "shimmer":
      return "inline-block bg-clip-text text-transparent bg-[length:250%_100%] [background-repeat:no-repeat,padding-box] animate-[name-shimmer_2.5s_linear_infinite]";
    case "gradient_shift":
      return "inline-block bg-clip-text text-transparent bg-[length:300%_100%] animate-[name-gradient-shift_4s_ease_infinite]";
    case "breathe":
      return "animate-[name-breathe_3s_ease-in-out_infinite]";
    default:
      return "";
  }
}

function getShimmerColors(
  nameColor?: string | null,
  customGradient?: { from?: string; to?: string } | null
) {
  if (nameColor === "custom" && customGradient?.from && customGradient?.to) {
    return { base: customGradient.from, highlight: customGradient.to };
  }
  switch (nameColor) {
    case "gold":
      return { base: "#b45309", highlight: "#fbbf24" };
    case "emerald":
      return { base: "#047857", highlight: "#34d399" };
    case "ocean":
      return { base: "#1e40af", highlight: "#22d3ee" };
    case "sunset":
      return { base: "#9f1239", highlight: "#fb923c" };
    case "rose":
      return { base: "#86198f", highlight: "#f9a8d4" };
    case "aurora":
      return { base: "#4338ca", highlight: "#34d399" };
    case "ice":
      return { base: "#0369a1", highlight: "#7dd3fc" };
    case "midnight":
      return { base: "#312e81", highlight: "#818cf8" };
    case "fire":
      return { base: "#991b1b", highlight: "#fbbf24" };
    case "neon":
      return { base: "#065f46", highlight: "#f472b6" };
    default:
      return { base: "rgba(255,255,255,0.45)", highlight: "#ffffff" };
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function getGlowColor(
  nameColor: string | null | undefined,
  alpha: number
): string {
  const colors: Record<string, [number, number, number]> = {
    gold: [251, 191, 36],
    emerald: [16, 185, 129],
    ocean: [14, 165, 233],
    sunset: [244, 63, 94],
    rose: [232, 121, 249],
    aurora: [129, 140, 248],
    ice: [56, 189, 248],
    midnight: [99, 102, 241],
    fire: [239, 68, 68],
    neon: [74, 222, 128],
  };
  const rgb = nameColor ? colors[nameColor] : null;
  if (rgb) return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
  return `rgba(255,255,255,${alpha < 0.5 ? 0.35 : 0.4})`;
}

export function getAffiliateNameEffectStyle(
  nameEffect?: string | null,
  nameColor?: string | null,
  customGradient?: { from?: string; to?: string } | null
): React.CSSProperties | undefined {
  if (nameEffect === "glow") {
    const glowColor =
      nameColor === "custom" && customGradient?.from
        ? hexToRgba(customGradient.from, 0.6)
        : getGlowColor(nameColor, 0.6);
    return {
      textShadow: `0 0 12px ${glowColor}, 0 0 24px ${glowColor}`,
    };
  }
  if (nameEffect === "sparkle") {
    const glowColor =
      nameColor === "custom" && customGradient?.from
        ? hexToRgba(customGradient.from, 0.5)
        : getGlowColor(nameColor, 0.5);
    const sparkleColor =
      nameColor === "custom" && customGradient?.to
        ? hexToRgba(customGradient.to, 0.9)
        : nameColor
        ? getGlowColor(nameColor, 0.9)
        : "rgba(255,255,255,0.9)";
    return {
      textShadow: `0 0 8px ${glowColor}, 0 0 16px ${glowColor}`,
      ["--name-sparkle-color" as string]: sparkleColor,
      ["--name-sparkle-glow" as string]: glowColor,
    };
  }
  if (nameEffect === "shimmer") {
    const { base, highlight } = getShimmerColors(nameColor, customGradient);
    return {
      backgroundImage: `linear-gradient(90deg, transparent calc(50% - 24px), ${highlight}, transparent calc(50% + 24px)), linear-gradient(${base}, ${base})`,
    } as React.CSSProperties;
  }
  if (nameEffect === "gradient_shift") {
    const style = getAffiliateNameColorStyle(nameColor, customGradient);
    if (style?.backgroundImage) {
      return {
        backgroundImage: style.backgroundImage,
        backgroundSize: "300% 100%",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      } as React.CSSProperties;
    }
    return {
      backgroundImage:
        "linear-gradient(90deg, #818cf8, #f472b6, #fbbf24, #818cf8)",
      backgroundSize: "300% 100%",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
    } as React.CSSProperties;
  }
  if (nameEffect === "breathe") {
    const glowColor =
      nameColor === "custom" && customGradient?.from
        ? hexToRgba(customGradient.from, 0.5)
        : getGlowColor(nameColor, 0.5);
    return {
      textShadow: `0 0 10px ${glowColor}, 0 0 20px ${glowColor}`,
    };
  }
  return undefined;
}

/* ── Preset definitions for the UI ── */

export const PFP_EFFECT_PRESETS = [
  { value: "none", label: "None", preview: "bg-white/5" },
  {
    value: "gold_glow",
    label: "Gold Glow",
    preview: "bg-amber-500/20 ring-1 ring-amber-400/40",
  },
  {
    value: "emerald_pulse",
    label: "Emerald Pulse",
    preview: "bg-emerald-500/20 ring-1 ring-emerald-400/40",
  },
  {
    value: "rainbow_ring",
    label: "Rainbow Ring",
    preview:
      "bg-[conic-gradient(from_0deg,#f97316,#eab308,#22c55e,#06b6d4,#8b5cf6,#ec4899,#f97316)]",
  },
  {
    value: "frost_aura",
    label: "Frost Aura",
    preview: "bg-sky-500/20 ring-1 ring-sky-300/40",
  },
  {
    value: "shadow_pulse",
    label: "Shadow Pulse",
    preview: "bg-purple-500/20 ring-1 ring-purple-400/40",
  },
  {
    value: "electric_spark",
    label: "Electric Spark",
    preview: "bg-cyan-500/20 ring-1 ring-cyan-400/40",
  },
  {
    value: "sakura_ring",
    label: "Sakura Ring",
    preview:
      "bg-[conic-gradient(from_0deg,#f9a8d4,#f472b6,#fb7185,#fda4af,#f9a8d4)]",
  },
  {
    value: "neon_pulse",
    label: "Neon Pulse",
    preview: "bg-green-500/20 ring-1 ring-green-400/50",
  },
  {
    value: "hearts",
    label: "Hearts",
    preview: "bg-rose-500/20 ring-1 ring-rose-400/40",
  },
  {
    value: "custom",
    label: "Custom",
    preview:
      "bg-[conic-gradient(from_0deg,#ef4444,#eab308,#22c55e,#3b82f6,#a855f7,#ef4444)]",
  },
] as const;

export const NAME_EFFECT_PRESETS = [
  { value: "none", label: "None" },
  { value: "sparkle", label: "Sparkle" },
  { value: "glow", label: "Glow" },
  { value: "shimmer", label: "Shimmer" },
  { value: "gradient_shift", label: "Gradient Shift" },
  { value: "breathe", label: "Breathe" },
] as const;

export const NAME_FONT_PRESETS = [
  { value: "default", label: "Default", className: "" },
  { value: "serif", label: "Serif", className: "font-serif" },
  { value: "mono", label: "Mono", className: "font-mono" },
  {
    value: "display",
    label: "Display",
    className: "font-black tracking-tight uppercase",
  },
  { value: "handwriting", label: "Script", className: "italic" },
  {
    value: "gothic",
    label: "Gothic",
    className: "font-serif font-black tracking-widest uppercase",
  },
  {
    value: "thin",
    label: "Thin",
    className: "font-extralight tracking-[0.2em]",
  },
  {
    value: "rounded",
    label: "Rounded",
    className: "font-medium tracking-wide",
  },
] as const;

export const NAME_COLOR_PRESETS = [
  { value: "default", label: "Default", swatch: "bg-white" },
  {
    value: "gold",
    label: "Gold",
    swatch: "bg-gradient-to-r from-amber-400 to-amber-600",
  },
  {
    value: "emerald",
    label: "Emerald",
    swatch: "bg-gradient-to-r from-emerald-400 to-emerald-600",
  },
  {
    value: "ocean",
    label: "Ocean",
    swatch: "bg-gradient-to-r from-cyan-400 to-indigo-500",
  },
  {
    value: "sunset",
    label: "Sunset",
    swatch: "bg-gradient-to-r from-orange-400 to-pink-500",
  },
  {
    value: "rose",
    label: "Rose",
    swatch: "bg-gradient-to-r from-pink-400 to-purple-400",
  },
  {
    value: "aurora",
    label: "Aurora",
    swatch: "bg-gradient-to-r from-emerald-400 via-cyan-400 to-purple-400",
  },
  {
    value: "ice",
    label: "Ice",
    swatch: "bg-gradient-to-r from-sky-200 via-sky-400 to-sky-600",
  },
  {
    value: "midnight",
    label: "Midnight",
    swatch: "bg-gradient-to-r from-indigo-400 to-indigo-800",
  },
  {
    value: "fire",
    label: "Fire",
    swatch: "bg-gradient-to-r from-yellow-400 via-orange-500 to-red-600",
  },
  {
    value: "neon",
    label: "Neon",
    swatch: "bg-gradient-to-r from-green-400 via-cyan-400 to-pink-400",
  },
  {
    value: "custom",
    label: "Custom",
    swatch:
      "bg-[conic-gradient(from_0deg,#ef4444,#eab308,#22c55e,#3b82f6,#a855f7,#ef4444)]",
  },
] as const;
