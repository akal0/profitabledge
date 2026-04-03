import type { CSSProperties } from "react";

function toRgba(hex: string, alpha: number) {
  const sanitized = hex.replace("#", "");
  const r = parseInt(sanitized.slice(0, 2), 16);
  const g = parseInt(sanitized.slice(2, 4), 16);
  const b = parseInt(sanitized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function hasNameplate(nameplate?: string | null) {
  return Boolean(nameplate && nameplate !== "default");
}

export function getNameplateClassName(nameplate?: string | null) {
  if (!hasNameplate(nameplate)) {
    return "";
  }

  return "rounded-full border px-2.5 py-1 shadow-[0_10px_28px_rgba(15,23,42,0.24)] backdrop-blur-md";
}

export function getNameplateStyle(
  nameplate?: string | null,
  customPalette?: { from?: string; to?: string } | null
): CSSProperties | undefined {
  if (!hasNameplate(nameplate)) {
    return undefined;
  }

  if (
    nameplate === "custom" &&
    customPalette?.from &&
    customPalette?.to &&
    /^#[0-9a-fA-F]{6}$/.test(customPalette.from) &&
    /^#[0-9a-fA-F]{6}$/.test(customPalette.to)
  ) {
    return {
      backgroundImage: `linear-gradient(90deg, ${toRgba(
        customPalette.from,
        0.52
      )} 0%, ${toRgba(customPalette.to, 0.1)} 100%)`,
      borderColor: toRgba(customPalette.from, 0.3),
      boxShadow: `0 10px 28px ${toRgba(customPalette.from, 0.18)}`,
    };
  }

  switch (nameplate) {
    case "gradient_bar":
      return {
        backgroundImage:
          "linear-gradient(90deg, rgba(34,211,238,0.34) 0%, rgba(129,140,248,0.12) 100%)",
        borderColor: "rgba(34,211,238,0.24)",
        boxShadow: "0 10px 28px rgba(34,211,238,0.16)",
      };
    case "glow_plate":
      return {
        backgroundImage:
          "radial-gradient(circle_at_20%_50%, rgba(34,211,238,0.16), transparent 42%), linear-gradient(90deg, rgba(129,140,248,0.28) 0%, rgba(244,114,182,0.12) 100%)",
        borderColor: "rgba(129,140,248,0.28)",
        boxShadow: "0 10px 28px rgba(129,140,248,0.16)",
      };
    case "gold":
      return {
        backgroundImage:
          "linear-gradient(90deg, rgba(251,191,36,0.32) 0%, rgba(245,158,11,0.08) 100%)",
        borderColor: "rgba(251,191,36,0.24)",
      };
    case "emerald":
      return {
        backgroundImage:
          "linear-gradient(90deg, rgba(16,185,129,0.32) 0%, rgba(45,212,191,0.08) 100%)",
        borderColor: "rgba(16,185,129,0.24)",
      };
    case "ocean":
      return {
        backgroundImage:
          "linear-gradient(90deg, rgba(14,165,233,0.32) 0%, rgba(99,102,241,0.08) 100%)",
        borderColor: "rgba(14,165,233,0.24)",
      };
    case "sunset":
      return {
        backgroundImage:
          "linear-gradient(90deg, rgba(251,146,60,0.34) 0%, rgba(244,63,94,0.08) 100%)",
        borderColor: "rgba(251,146,60,0.24)",
      };
    case "fire":
      return {
        backgroundImage:
          "linear-gradient(90deg, rgba(239,68,68,0.34) 0%, rgba(251,191,36,0.08) 100%)",
        borderColor: "rgba(239,68,68,0.24)",
      };
    case "ice":
      return {
        backgroundImage:
          "linear-gradient(90deg, rgba(224,242,254,0.34) 0%, rgba(56,189,248,0.08) 100%)",
        borderColor: "rgba(125,211,252,0.28)",
      };
    case "midnight":
      return {
        backgroundImage:
          "linear-gradient(90deg, rgba(99,102,241,0.28) 0%, rgba(49,46,129,0.12) 100%)",
        borderColor: "rgba(129,140,248,0.24)",
      };
    case "neon":
      return {
        backgroundImage:
          "linear-gradient(90deg, rgba(74,222,128,0.3) 0%, rgba(244,114,182,0.08) 100%)",
        borderColor: "rgba(74,222,128,0.24)",
      };
    case "aurora_mesh":
      return {
        backgroundImage:
          "radial-gradient(circle_at_20%_30%, rgba(52,211,153,0.34), transparent 42%), radial-gradient(circle_at_80%_20%, rgba(129,140,248,0.28), transparent 38%), radial-gradient(circle_at_55%_70%, rgba(34,211,238,0.22), transparent 32%), linear-gradient(135deg, rgba(15,23,42,0.78), rgba(15,23,42,0.28))",
        borderColor: "rgba(129,140,248,0.24)",
      };
    case "cyber_mesh":
      return {
        backgroundImage:
          "repeating-linear-gradient(135deg, rgba(34,211,238,0.14) 0 2px, transparent 2px 18px), linear-gradient(90deg, rgba(15,23,42,0.88), rgba(34,211,238,0.08), rgba(15,23,42,0.88))",
        borderColor: "rgba(34,211,238,0.24)",
      };
    case "circuit_pattern":
      return {
        backgroundImage:
          "repeating-linear-gradient(90deg, rgba(16,185,129,0.14) 0 1px, transparent 1px 18px), repeating-linear-gradient(180deg, rgba(16,185,129,0.1) 0 1px, transparent 1px 12px), linear-gradient(90deg, rgba(6,78,59,0.5), rgba(6,95,70,0.08))",
        borderColor: "rgba(16,185,129,0.24)",
      };
    case "grid_pattern":
      return {
        backgroundImage:
          "radial-gradient(circle, rgba(125,211,252,0.32) 1px, transparent 1.5px), linear-gradient(90deg, rgba(14,165,233,0.14), rgba(15,23,42,0.08))",
        backgroundSize: "10px 10px, auto",
        borderColor: "rgba(14,165,233,0.24)",
      };
    case "waves_pattern":
      return {
        backgroundImage:
          "repeating-radial-gradient(circle_at_0_100%, rgba(56,189,248,0.14) 0 2px, transparent 2px 10px), linear-gradient(90deg, rgba(8,47,73,0.5), rgba(14,165,233,0.08))",
        borderColor: "rgba(56,189,248,0.22)",
      };
    case "bull_plate":
      return {
        backgroundImage:
          "repeating-linear-gradient(135deg, rgba(34,197,94,0.14) 0 2px, transparent 2px 14px), linear-gradient(90deg, rgba(16,185,129,0.34), rgba(45,212,191,0.06))",
        borderColor: "rgba(34,197,94,0.24)",
      };
    case "bear_plate":
      return {
        backgroundImage:
          "repeating-linear-gradient(45deg, rgba(239,68,68,0.14) 0 2px, transparent 2px 14px), linear-gradient(90deg, rgba(239,68,68,0.34), rgba(251,146,60,0.06))",
        borderColor: "rgba(239,68,68,0.24)",
      };
    case "chart_plate":
      return {
        backgroundImage:
          "repeating-linear-gradient(90deg, rgba(245,158,11,0.12) 0 3px, transparent 3px 12px), linear-gradient(180deg, transparent 40%, rgba(245,158,11,0.18) 40% 60%, transparent 60%), linear-gradient(90deg, rgba(120,53,15,0.34), rgba(251,191,36,0.08))",
        borderColor: "rgba(245,158,11,0.24)",
      };
    case "holographic_bar":
      return {
        backgroundImage:
          "linear-gradient(135deg, rgba(103,232,249,0.18), rgba(244,114,182,0.16), rgba(251,191,36,0.14), rgba(129,140,248,0.16), rgba(103,232,249,0.18))",
        backgroundSize: "200% 100%",
        borderColor: "rgba(196,181,253,0.24)",
        animation: "nameplate-holo-shift 4s linear infinite",
      };
    case "neon_sign":
      return {
        backgroundImage:
          "linear-gradient(90deg, rgba(15,23,42,0.6), rgba(15,23,42,0.4))",
        borderColor: "rgba(74,222,128,0.5)",
        boxShadow:
          "0 0 8px rgba(74,222,128,0.3), 0 0 16px rgba(74,222,128,0.15), inset 0 0 8px rgba(74,222,128,0.08)",
      };
    case "pulse_border":
      return {
        backgroundImage:
          "linear-gradient(90deg, rgba(34,211,238,0.2), rgba(15,23,42,0.1))",
        borderColor: "rgba(34,211,238,0.3)",
        boxShadow: "0 0 12px rgba(34,211,238,0.18)",
      };
    case "static_noise":
      return {
        backgroundImage:
          "repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 3px), repeating-linear-gradient(180deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 3px), linear-gradient(90deg, rgba(30,41,59,0.6), rgba(15,23,42,0.3))",
        borderColor: "rgba(203,213,225,0.18)",
      };
    case "plasma_bar":
      return {
        backgroundImage:
          "radial-gradient(circle_at_20%_50%, rgba(168,85,247,0.24), transparent 38%), radial-gradient(circle_at_80%_50%, rgba(232,121,249,0.18), transparent 34%), linear-gradient(90deg, rgba(46,16,101,0.4), rgba(88,28,135,0.08))",
        borderColor: "rgba(168,85,247,0.28)",
        boxShadow: "0 10px 28px rgba(168,85,247,0.14)",
      };
    case "frost_bar":
      return {
        backgroundImage:
          "radial-gradient(circle_at_15%_50%, rgba(224,242,254,0.22), transparent 32%), radial-gradient(circle_at_85%_50%, rgba(125,211,252,0.16), transparent 28%), linear-gradient(90deg, rgba(8,47,73,0.34), rgba(14,116,144,0.06))",
        borderColor: "rgba(125,211,252,0.26)",
        boxShadow: "0 10px 28px rgba(56,189,248,0.12)",
      };
    case "void_bar":
      return {
        backgroundImage:
          "radial-gradient(circle_at_30%_50%, rgba(124,58,237,0.22), transparent 36%), radial-gradient(circle_at_70%_50%, rgba(192,132,252,0.14), transparent 32%), linear-gradient(90deg, rgba(15,3,30,0.5), rgba(46,16,101,0.08))",
        borderColor: "rgba(124,58,237,0.26)",
        boxShadow: "0 10px 28px rgba(124,58,237,0.12)",
      };
    case "solar_bar":
      return {
        backgroundImage:
          "radial-gradient(circle_at_20%_50%, rgba(251,191,36,0.28), transparent 36%), radial-gradient(circle_at_80%_50%, rgba(254,243,199,0.14), transparent 30%), linear-gradient(90deg, rgba(120,53,15,0.38), rgba(251,191,36,0.06))",
        borderColor: "rgba(251,191,36,0.26)",
        boxShadow: "0 10px 28px rgba(251,191,36,0.14)",
      };
    default:
      return undefined;
  }
}
