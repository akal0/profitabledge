import {
  CUSTOM_RING_EFFECT_PRESETS,
  NAME_COLOR_PRESETS,
  NAME_EFFECT_PRESETS,
  NAME_FONT_PRESETS,
  PFP_EFFECT_PRESETS,
} from "@/features/public-proof/lib/public-proof-badges";
import { DEFAULT_PROFILE_BANNER_BACKGROUND_IMAGE } from "@/lib/default-profile-banner";

export type ProfileEffectsState = {
  pfpEffect: string;
  avatarDecoration: string;
  bannerEffect: string;
  nameplate: string;
  nameEffect: string;
  nameFont: string;
  nameColor: string;
  theme: string;
  customGradientFrom: string;
  customGradientTo: string;
  customRingFrom: string;
  customRingTo: string;
  customRingEffect: string;
  customNameplateFrom: string;
  customNameplateTo: string;
  customThemeFrom: string;
  customThemeTo: string;
  themeAccent: string;
};

export type ShopPreviewUser = {
  name?: string | null;
  displayName?: string | null;
  username?: string | null;
  image?: string | null;
  bannerUrl?: string | null;
  bannerPosition?: string | null;
};

type PreviewThemeDefinition = {
  label: string;
  accent: string;
  banner: string;
  accentFamily: string;
  mood: string;
  suggestedPfpEffect: string;
};

type AvatarCatalogItem = {
  key: string;
  label: string;
  preview: string;
  collection: string;
  colorFamily: string;
  animationStyle: string;
  accent: string;
  previewBanner: string;
  tags: string[];
};

export type EffectCategory =
  | "avatar-ring"
  | "avatar-decoration"
  | "banner"
  | "theme"
  | "nameplate"
  | "name-color"
  | "name-font"
  | "name-effect";

export type EffectTier = "free" | "basic" | "premium" | "legendary";

export type EffectRenderer = "css" | "canvas" | "pixi" | "gsap" | "svg";

type AvatarDecorationCatalogItem = {
  key: string;
  label: string;
  description: string;
  collection: string;
  tier: EffectTier;
  renderer: EffectRenderer;
  accent: string;
  previewGradient: string;
  tags: string[];
};

type BannerEffectCatalogItem = {
  key: string;
  label: string;
  collection: string;
  colorFamily: string;
  motionStyle: string;
  accent: string;
  description: string;
  tags: string[];
};

type NameplateCatalogItem = {
  key: string;
  label: string;
  collection: string;
  colorFamily: string;
  styleFamily: string;
  accent: string;
  tags: string[];
};

type ThemeCatalogItem = PreviewThemeDefinition & {
  key: string;
  tags: string[];
};

type NameColorPreviewTone = {
  accent: string;
  banner: string;
};

export const DEFAULT_PROFILE_EFFECTS: ProfileEffectsState = {
  pfpEffect: "none",
  avatarDecoration: "none",
  bannerEffect: "none",
  nameplate: "default",
  nameEffect: "none",
  nameFont: "default",
  nameColor: "default",
  theme: "default",
  customGradientFrom: "#818cf8",
  customGradientTo: "#f472b6",
  customRingFrom: "#14b8a6",
  customRingTo: "#38bdf8",
  customRingEffect: "none",
  customNameplateFrom: "#0f766e",
  customNameplateTo: "#06b6d4",
  customThemeFrom: "#0f172a",
  customThemeTo: "#134e4a",
  themeAccent: "#14b8a6",
};

const AVATAR_EFFECT_DETAILS: Record<
  string,
  Omit<AvatarCatalogItem, "key" | "label" | "preview">
> = {
  none: {
    collection: "Essentials",
    colorFamily: "Neutral",
    animationStyle: "Static",
    accent: "#94a3b8",
    previewBanner: DEFAULT_PROFILE_BANNER_BACKGROUND_IMAGE,
    tags: ["clean", "minimal", "base"],
  },
  gold_glow: {
    collection: "Essentials",
    colorFamily: "Gold",
    animationStyle: "Glow",
    accent: "#fbbf24",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(251,191,36,0.38)_0%,transparent_26%),radial-gradient(circle_at_72%_18%,rgba(245,158,11,0.28)_0%,transparent_24%),linear-gradient(135deg,rgba(120,53,15,0.94)_0%,rgba(15,23,42,0.96)_100%)",
    tags: ["gold", "clean", "premium"],
  },
  emerald_pulse: {
    collection: "Essentials",
    colorFamily: "Emerald",
    animationStyle: "Pulse",
    accent: "#10b981",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(16,185,129,0.36)_0%,transparent_26%),radial-gradient(circle_at_74%_16%,rgba(45,212,191,0.2)_0%,transparent_22%),linear-gradient(135deg,rgba(6,78,59,0.96)_0%,rgba(15,23,42,0.96)_100%)",
    tags: ["green", "clean", "pulse"],
  },
  frost_aura: {
    collection: "Essentials",
    colorFamily: "Ice",
    animationStyle: "Aura",
    accent: "#38bdf8",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(125,211,252,0.36)_0%,transparent_26%),radial-gradient(circle_at_74%_16%,rgba(56,189,248,0.24)_0%,transparent_22%),linear-gradient(135deg,rgba(12,74,110,0.96)_0%,rgba(15,23,42,0.98)_100%)",
    tags: ["blue", "ice", "clean"],
  },
  neon_pulse: {
    collection: "Neon",
    colorFamily: "Green",
    animationStyle: "Pulse",
    accent: "#4ade80",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(74,222,128,0.38)_0%,transparent_24%),radial-gradient(circle_at_78%_16%,rgba(34,197,94,0.2)_0%,transparent_20%),linear-gradient(135deg,rgba(20,83,45,0.96)_0%,rgba(15,23,42,0.98)_100%)",
    tags: ["neon", "green", "club"],
  },
  neon_pulse_pink: {
    collection: "Neon",
    colorFamily: "Pink",
    animationStyle: "Pulse",
    accent: "#e879f9",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(232,121,249,0.32)_0%,transparent_24%),radial-gradient(circle_at_78%_16%,rgba(236,72,153,0.2)_0%,transparent_20%),linear-gradient(135deg,rgba(112,26,117,0.94)_0%,rgba(15,23,42,0.98)_100%)",
    tags: ["neon", "pink", "glow"],
  },
  neon_pulse_blue: {
    collection: "Neon",
    colorFamily: "Blue",
    animationStyle: "Pulse",
    accent: "#38bdf8",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(56,189,248,0.32)_0%,transparent_24%),radial-gradient(circle_at_78%_16%,rgba(59,130,246,0.22)_0%,transparent_20%),linear-gradient(135deg,rgba(12,74,110,0.94)_0%,rgba(15,23,42,0.98)_100%)",
    tags: ["neon", "blue", "pulse"],
  },
  electric_spark: {
    collection: "Neon",
    colorFamily: "Cyan",
    animationStyle: "Electric",
    accent: "#22d3ee",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(34,211,238,0.34)_0%,transparent_24%),radial-gradient(circle_at_76%_16%,rgba(59,130,246,0.24)_0%,transparent_22%),linear-gradient(135deg,rgba(8,47,73,0.96)_0%,rgba(15,23,42,0.98)_100%)",
    tags: ["electric", "cyan", "spark"],
  },
  fire_ring: {
    collection: "Elements",
    colorFamily: "Fire",
    animationStyle: "Flicker",
    accent: "#f97316",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(251,146,60,0.36)_0%,transparent_24%),radial-gradient(circle_at_74%_16%,rgba(239,68,68,0.22)_0%,transparent_22%),linear-gradient(135deg,rgba(127,29,29,0.94)_0%,rgba(15,23,42,0.98)_100%)",
    tags: ["fire", "orange", "elemental"],
  },
  ice_crystals: {
    collection: "Elements",
    colorFamily: "Ice",
    animationStyle: "Pulse",
    accent: "#bae6fd",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(224,242,254,0.38)_0%,transparent_24%),radial-gradient(circle_at_76%_16%,rgba(56,189,248,0.2)_0%,transparent_20%),linear-gradient(135deg,rgba(8,47,73,0.94)_0%,rgba(14,116,144,0.72)_100%)",
    tags: ["ice", "elemental", "frozen"],
  },
  shadow_pulse: {
    collection: "Elements",
    colorFamily: "Midnight",
    animationStyle: "Pulse",
    accent: "#a855f7",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(168,85,247,0.34)_0%,transparent_25%),radial-gradient(circle_at_76%_18%,rgba(79,70,229,0.22)_0%,transparent_23%),linear-gradient(135deg,rgba(46,16,101,0.96)_0%,rgba(15,23,42,0.98)_100%)",
    tags: ["shadow", "purple", "elemental"],
  },
  lightning_ring: {
    collection: "Elements",
    colorFamily: "Indigo",
    animationStyle: "Electric",
    accent: "#818cf8",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(129,140,248,0.34)_0%,transparent_24%),radial-gradient(circle_at_76%_16%,rgba(34,211,238,0.22)_0%,transparent_20%),linear-gradient(135deg,rgba(30,41,59,0.96)_0%,rgba(49,46,129,0.82)_100%)",
    tags: ["lightning", "storm", "elemental"],
  },
  sakura_ring: {
    collection: "Sakura",
    colorFamily: "Pink",
    animationStyle: "Bloom",
    accent: "#fb7185",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(251,113,133,0.38)_0%,transparent_26%),radial-gradient(circle_at_76%_16%,rgba(244,114,182,0.24)_0%,transparent_22%),linear-gradient(135deg,rgba(131,24,67,0.94)_0%,rgba(15,23,42,0.98)_100%)",
    tags: ["sakura", "pink", "petals"],
  },
  cherry_bloom: {
    collection: "Sakura",
    colorFamily: "Rose",
    animationStyle: "Bloom",
    accent: "#fb7185",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(251,113,133,0.4)_0%,transparent_24%),radial-gradient(circle_at_76%_16%,rgba(244,114,182,0.24)_0%,transparent_20%),linear-gradient(135deg,rgba(136,19,55,0.96)_0%,rgba(88,28,135,0.72)_100%)",
    tags: ["cherry", "pink", "bloom"],
  },
  pink_petals: {
    collection: "Sakura",
    colorFamily: "Pink",
    animationStyle: "Soft Pulse",
    accent: "#f9a8d4",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(249,168,212,0.34)_0%,transparent_24%),radial-gradient(circle_at_76%_16%,rgba(251,113,133,0.2)_0%,transparent_18%),linear-gradient(135deg,rgba(131,24,67,0.84)_0%,rgba(15,23,42,0.98)_100%)",
    tags: ["petals", "pink", "soft"],
  },
  glitch_frame: {
    collection: "Cyber",
    colorFamily: "Teal",
    animationStyle: "Glitch",
    accent: "#22d3ee",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(34,211,238,0.3)_0%,transparent_22%),radial-gradient(circle_at_76%_16%,rgba(16,185,129,0.18)_0%,transparent_20%),linear-gradient(135deg,rgba(15,23,42,0.98)_0%,rgba(8,47,73,0.92)_100%)",
    tags: ["cyber", "glitch", "tech"],
  },
  hud_ring: {
    collection: "Cyber",
    colorFamily: "Cyan",
    animationStyle: "Orbit",
    accent: "#22d3ee",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(34,211,238,0.28)_0%,transparent_22%),radial-gradient(circle_at_76%_16%,rgba(14,165,233,0.22)_0%,transparent_20%),linear-gradient(135deg,rgba(8,47,73,0.94)_0%,rgba(15,23,42,0.98)_100%)",
    tags: ["hud", "cyber", "system"],
  },
  matrix_glow: {
    collection: "Cyber",
    colorFamily: "Green",
    animationStyle: "Pulse",
    accent: "#4ade80",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(74,222,128,0.24)_0%,transparent_22%),radial-gradient(circle_at_76%_16%,rgba(16,185,129,0.16)_0%,transparent_20%),linear-gradient(135deg,rgba(5,46,22,0.94)_0%,rgba(15,23,42,0.98)_100%)",
    tags: ["matrix", "cyber", "code"],
  },
  digital_pulse: {
    collection: "Cyber",
    colorFamily: "Blue",
    animationStyle: "Pulse",
    accent: "#38bdf8",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(56,189,248,0.24)_0%,transparent_22%),radial-gradient(circle_at_76%_16%,rgba(129,140,248,0.2)_0%,transparent_20%),linear-gradient(135deg,rgba(15,23,42,0.98)_0%,rgba(30,41,59,0.92)_100%)",
    tags: ["digital", "cyber", "pulse"],
  },
  rainbow_ring: {
    collection: "Fantasy",
    colorFamily: "Rainbow",
    animationStyle: "Orbit",
    accent: "#ec4899",
    previewBanner:
      "radial-gradient(circle_at_15%_20%,rgba(251,146,60,0.35)_0%,transparent_22%),radial-gradient(circle_at_50%_18%,rgba(34,211,238,0.28)_0%,transparent_24%),radial-gradient(circle_at_82%_18%,rgba(236,72,153,0.28)_0%,transparent_24%),linear-gradient(135deg,rgba(17,24,39,0.94)_0%,rgba(79,70,229,0.7)_48%,rgba(190,24,93,0.72)_100%)",
    tags: ["magic", "rainbow", "fantasy"],
  },
  aurora_ring: {
    collection: "Fantasy",
    colorFamily: "Aurora",
    animationStyle: "Orbit",
    accent: "#818cf8",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(52,211,153,0.3)_0%,transparent_24%),radial-gradient(circle_at_78%_16%,rgba(129,140,248,0.24)_0%,transparent_22%),linear-gradient(135deg,rgba(8,47,73,0.94)_0%,rgba(79,70,229,0.72)_100%)",
    tags: ["aurora", "fantasy", "sky"],
  },
  stardust: {
    collection: "Fantasy",
    colorFamily: "Violet",
    animationStyle: "Twinkle",
    accent: "#c4b5fd",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(196,181,253,0.24)_0%,transparent_22%),radial-gradient(circle_at_76%_16%,rgba(125,211,252,0.18)_0%,transparent_20%),linear-gradient(135deg,rgba(30,41,59,0.96)_0%,rgba(49,46,129,0.82)_100%)",
    tags: ["stars", "magic", "twinkle"],
  },
  enchanted: {
    collection: "Fantasy",
    colorFamily: "Amber",
    animationStyle: "Glow",
    accent: "#fbbf24",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(252,211,77,0.28)_0%,transparent_22%),radial-gradient(circle_at_76%_16%,rgba(244,114,182,0.16)_0%,transparent_20%),linear-gradient(135deg,rgba(92,42,15,0.9)_0%,rgba(88,28,135,0.72)_100%)",
    tags: ["enchanted", "gold", "fantasy"],
  },
  hearts: {
    collection: "Hearts",
    colorFamily: "Rose",
    animationStyle: "Heartbeat",
    accent: "#fb7185",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(251,113,133,0.38)_0%,transparent_24%),radial-gradient(circle_at_78%_16%,rgba(244,63,94,0.24)_0%,transparent_22%),linear-gradient(135deg,rgba(136,19,55,0.96)_0%,rgba(15,23,42,0.98)_100%)",
    tags: ["hearts", "rose", "romance"],
  },
  rose_petals: {
    collection: "Hearts",
    colorFamily: "Rose",
    animationStyle: "Heartbeat",
    accent: "#fb7185",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(251,113,133,0.34)_0%,transparent_24%),radial-gradient(circle_at_78%_16%,rgba(190,24,93,0.22)_0%,transparent_20%),linear-gradient(135deg,rgba(136,19,55,0.96)_0%,rgba(88,28,135,0.72)_100%)",
    tags: ["rose", "petals", "romance"],
  },
  love_glow: {
    collection: "Hearts",
    colorFamily: "Pink",
    animationStyle: "Glow",
    accent: "#f472b6",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(244,114,182,0.34)_0%,transparent_22%),radial-gradient(circle_at_78%_16%,rgba(192,132,252,0.2)_0%,transparent_18%),linear-gradient(135deg,rgba(131,24,67,0.96)_0%,rgba(88,28,135,0.72)_100%)",
    tags: ["love", "pink", "soft"],
  },
  bull_ring: {
    collection: "Trader",
    colorFamily: "Green",
    animationStyle: "Pulse",
    accent: "#22c55e",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(34,197,94,0.32)_0%,transparent_24%),radial-gradient(circle_at_76%_16%,rgba(16,185,129,0.2)_0%,transparent_20%),linear-gradient(135deg,rgba(6,78,59,0.96)_0%,rgba(15,23,42,0.98)_100%)",
    tags: ["bull", "market", "trade"],
  },
  bear_ring: {
    collection: "Trader",
    colorFamily: "Red",
    animationStyle: "Pulse",
    accent: "#ef4444",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(248,113,113,0.32)_0%,transparent_24%),radial-gradient(circle_at_76%_16%,rgba(251,146,60,0.18)_0%,transparent_18%),linear-gradient(135deg,rgba(127,29,29,0.96)_0%,rgba(15,23,42,0.98)_100%)",
    tags: ["bear", "market", "trade"],
  },
  diamond_hands: {
    collection: "Trader",
    colorFamily: "Prismatic",
    animationStyle: "Shimmer",
    accent: "#e0f2fe",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(224,242,254,0.28)_0%,transparent_22%),radial-gradient(circle_at_76%_16%,rgba(129,140,248,0.2)_0%,transparent_18%),linear-gradient(135deg,rgba(15,23,42,0.98)_0%,rgba(30,41,59,0.84)_100%)",
    tags: ["diamond", "hands", "trade"],
  },
  moon_glow: {
    collection: "Trader",
    colorFamily: "Gold",
    animationStyle: "Glow",
    accent: "#fde68a",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(253,230,138,0.28)_0%,transparent_22%),radial-gradient(circle_at_76%_16%,rgba(129,140,248,0.14)_0%,transparent_18%),linear-gradient(135deg,rgba(30,41,59,0.98)_0%,rgba(49,46,129,0.78)_100%)",
    tags: ["moon", "trade", "night"],
  },
  gradient_spin_fire: {
    collection: "Advanced",
    colorFamily: "Fire",
    animationStyle: "Spin",
    accent: "#fb923c",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(251,146,60,0.32)_0%,transparent_24%),radial-gradient(circle_at_74%_16%,rgba(239,68,68,0.2)_0%,transparent_20%),linear-gradient(135deg,rgba(127,29,29,0.96)_0%,rgba(15,23,42,0.98)_100%)",
    tags: ["gradient", "spin", "fire"],
  },
  gradient_spin_ocean: {
    collection: "Advanced",
    colorFamily: "Ocean",
    animationStyle: "Spin",
    accent: "#22d3ee",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(34,211,238,0.3)_0%,transparent_24%),radial-gradient(circle_at_78%_16%,rgba(99,102,241,0.18)_0%,transparent_20%),linear-gradient(135deg,rgba(8,47,73,0.96)_0%,rgba(30,64,175,0.88)_100%)",
    tags: ["gradient", "spin", "ocean"],
  },
  gradient_spin_toxic: {
    collection: "Advanced",
    colorFamily: "Toxic",
    animationStyle: "Spin",
    accent: "#bef264",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(190,242,100,0.26)_0%,transparent_24%),radial-gradient(circle_at_78%_16%,rgba(34,211,238,0.16)_0%,transparent_20%),linear-gradient(135deg,rgba(20,83,45,0.96)_0%,rgba(15,23,42,0.98)_100%)",
    tags: ["gradient", "spin", "toxic"],
  },
  stroke_draw_single: {
    collection: "Advanced",
    colorFamily: "Indigo",
    animationStyle: "Stroke",
    accent: "#818cf8",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(129,140,248,0.28)_0%,transparent_24%),linear-gradient(135deg,rgba(49,46,129,0.96)_0%,rgba(15,23,42,0.98)_100%)",
    tags: ["stroke", "draw", "arc"],
  },
  stroke_draw_double: {
    collection: "Advanced",
    colorFamily: "Magenta",
    animationStyle: "Stroke",
    accent: "#f472b6",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(244,114,182,0.28)_0%,transparent_24%),linear-gradient(135deg,rgba(131,24,67,0.9)_0%,rgba(15,23,42,0.98)_100%)",
    tags: ["stroke", "double", "arc"],
  },
  stroke_draw_dotted: {
    collection: "Advanced",
    colorFamily: "Amber",
    animationStyle: "Dots",
    accent: "#fbbf24",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(251,191,36,0.26)_0%,transparent_24%),linear-gradient(135deg,rgba(120,53,15,0.94)_0%,rgba(15,23,42,0.98)_100%)",
    tags: ["stroke", "dotted", "flow"],
  },
  energy_flow: {
    collection: "Advanced",
    colorFamily: "Green",
    animationStyle: "Flow",
    accent: "#4ade80",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(74,222,128,0.24)_0%,transparent_22%),linear-gradient(135deg,rgba(6,78,59,0.94)_0%,rgba(15,23,42,0.98)_100%)",
    tags: ["energy", "flow", "ring"],
  },
  multi_ring: {
    collection: "Advanced",
    colorFamily: "Cyan",
    animationStyle: "Pulse",
    accent: "#22d3ee",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(34,211,238,0.24)_0%,transparent_22%),linear-gradient(135deg,rgba(8,47,73,0.94)_0%,rgba(15,23,42,0.98)_100%)",
    tags: ["multi", "ring", "pulse"],
  },
  lightning_ring_v2: {
    collection: "Advanced",
    colorFamily: "Storm",
    animationStyle: "Electric",
    accent: "#93c5fd",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(147,197,253,0.3)_0%,transparent_24%),linear-gradient(135deg,rgba(30,41,59,0.96)_0%,rgba(49,46,129,0.84)_100%)",
    tags: ["lightning", "arc", "storm"],
  },
  flame_arc: {
    collection: "Advanced",
    colorFamily: "Fire",
    animationStyle: "Electric",
    accent: "#fb923c",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(251,146,60,0.34)_0%,transparent_24%),radial-gradient(circle_at_76%_16%,rgba(239,68,68,0.2)_0%,transparent_20%),linear-gradient(135deg,rgba(127,29,29,0.96)_0%,rgba(15,23,42,0.98)_100%)",
    tags: ["flame", "arc", "fire"],
  },
  plasma_ring: {
    collection: "Advanced",
    colorFamily: "Violet",
    animationStyle: "Morph",
    accent: "#a855f7",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(168,85,247,0.34)_0%,transparent_24%),radial-gradient(circle_at_76%_16%,rgba(232,121,249,0.2)_0%,transparent_20%),linear-gradient(135deg,rgba(46,16,101,0.96)_0%,rgba(15,23,42,0.98)_100%)",
    tags: ["plasma", "morph", "energy"],
  },
  frost_shards: {
    collection: "Advanced",
    colorFamily: "Ice",
    animationStyle: "Crystallize",
    accent: "#7dd3fc",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(125,211,252,0.34)_0%,transparent_24%),radial-gradient(circle_at_76%_16%,rgba(224,242,254,0.22)_0%,transparent_20%),linear-gradient(135deg,rgba(8,47,73,0.96)_0%,rgba(14,116,144,0.72)_100%)",
    tags: ["frost", "ice", "crystal"],
  },
  void_rift: {
    collection: "Advanced",
    colorFamily: "Violet",
    animationStyle: "Fracture",
    accent: "#7c3aed",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(124,58,237,0.34)_0%,transparent_24%),radial-gradient(circle_at_76%_16%,rgba(192,132,252,0.18)_0%,transparent_20%),linear-gradient(135deg,rgba(15,3,30,0.98)_0%,rgba(46,16,101,0.84)_100%)",
    tags: ["void", "rift", "dark"],
  },
  solar_flare: {
    collection: "Advanced",
    colorFamily: "Gold",
    animationStyle: "Erupt",
    accent: "#fbbf24",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(251,191,36,0.38)_0%,transparent_24%),radial-gradient(circle_at_76%_16%,rgba(254,243,199,0.18)_0%,transparent_20%),linear-gradient(135deg,rgba(120,53,15,0.96)_0%,rgba(15,23,42,0.96)_100%)",
    tags: ["solar", "flare", "corona"],
  },
  custom: {
    collection: "Custom",
    colorFamily: "Custom",
    animationStyle: "Custom",
    accent: "#14b8a6",
    previewBanner:
      "radial-gradient(circle_at_18%_22%,rgba(45,212,191,0.24)_0%,transparent_22%),radial-gradient(circle_at_76%_16%,rgba(56,189,248,0.2)_0%,transparent_18%),linear-gradient(135deg,rgba(15,23,42,0.98)_0%,rgba(8,47,73,0.86)_100%)",
    tags: ["custom", "gradient", "builder"],
  },
};

export const AVATAR_EFFECT_CATALOG: AvatarCatalogItem[] = PFP_EFFECT_PRESETS.map(
  (preset) => ({
    key: preset.value,
    label: preset.label,
    preview: preset.preview,
    ...AVATAR_EFFECT_DETAILS[preset.value],
  })
);

export const AVATAR_DECORATION_CATALOG: AvatarDecorationCatalogItem[] = [
  {
    key: "none",
    label: "None",
    description: "Keep your avatar clean and let the ring do the work.",
    collection: "Free",
    tier: "free",
    renderer: "css",
    accent: "#94a3b8",
    previewGradient: "linear-gradient(135deg, rgba(148,163,184,0.15), rgba(15,23,42,0.1))",
    tags: ["none", "clean", "minimal"],
  },
  {
    key: "orbiting_sparkles",
    label: "Orbiting Sparkles",
    description: "Tiny bright stars orbit the profile like a premium halo.",
    collection: "Premium",
    tier: "premium",
    renderer: "pixi",
    accent: "#f8fafc",
    previewGradient: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.28), rgba(125,211,252,0.08) 60%, transparent 70%)",
    tags: ["sparkles", "orbit", "stars"],
  },
  {
    key: "orbiting_embers",
    label: "Orbiting Embers",
    description: "Warm particles revolve with a furnace glow.",
    collection: "Premium",
    tier: "premium",
    renderer: "pixi",
    accent: "#fb923c",
    previewGradient: "radial-gradient(circle at 50% 50%, rgba(251,146,60,0.28), rgba(239,68,68,0.08) 60%, transparent 70%)",
    tags: ["embers", "fire", "orbit"],
  },
  {
    key: "orbiting_snowflakes",
    label: "Orbiting Snowflakes",
    description: "Cool drifting flakes circle the avatar with a winter shimmer.",
    collection: "Premium",
    tier: "premium",
    renderer: "pixi",
    accent: "#e0f2fe",
    previewGradient: "radial-gradient(circle at 50% 50%, rgba(224,242,254,0.3), rgba(56,189,248,0.08) 60%, transparent 70%)",
    tags: ["snow", "ice", "flakes"],
  },
  {
    key: "orbiting_petals",
    label: "Orbiting Petals",
    description: "Soft sakura petals sweep around the profile edge.",
    collection: "Premium",
    tier: "premium",
    renderer: "pixi",
    accent: "#f9a8d4",
    previewGradient: "radial-gradient(circle at 50% 50%, rgba(249,168,212,0.28), rgba(251,113,133,0.08) 60%, transparent 70%)",
    tags: ["petals", "sakura", "orbit"],
  },
  {
    key: "sparkle_dust_gold",
    label: "Gold Dust",
    description: "Gold sparkle dust appears and fades across the avatar surface.",
    collection: "Legendary",
    tier: "legendary",
    renderer: "pixi",
    accent: "#fbbf24",
    previewGradient: "radial-gradient(circle at 50% 50%, rgba(251,191,36,0.32), rgba(120,53,15,0.08) 60%, transparent 70%)",
    tags: ["gold", "sparkle", "dust"],
  },
  {
    key: "sparkle_dust_diamond",
    label: "Diamond Dust",
    description: "Prismatic glitter flashes across the avatar with crisp highlights.",
    collection: "Legendary",
    tier: "legendary",
    renderer: "pixi",
    accent: "#e0f2fe",
    previewGradient: "radial-gradient(circle at 50% 50%, rgba(224,242,254,0.32), rgba(129,140,248,0.08) 60%, transparent 70%)",
    tags: ["diamond", "sparkle", "prism"],
  },
  {
    key: "sparkle_dust_emerald",
    label: "Emerald Dust",
    description: "Green sparkles pulse gently across the avatar surface.",
    collection: "Legendary",
    tier: "legendary",
    renderer: "pixi",
    accent: "#34d399",
    previewGradient: "radial-gradient(circle at 50% 50%, rgba(52,211,153,0.32), rgba(6,95,70,0.08) 60%, transparent 70%)",
    tags: ["emerald", "sparkle", "dust"],
  },
  {
    key: "smoke_rising",
    label: "Smoke Rising",
    description: "Ethereal mist rises from the bottom edge of the profile photo.",
    collection: "Legendary",
    tier: "legendary",
    renderer: "pixi",
    accent: "#e2e8f0",
    previewGradient: "radial-gradient(circle at 50% 85%, rgba(226,232,240,0.25), rgba(15,23,42,0.1) 62%, transparent 72%)",
    tags: ["smoke", "mist", "ethereal"],
  },
  {
    key: "holographic_overlay",
    label: "Holographic Sweep",
    description: "A holographic rainbow sheen sweeps over the avatar surface.",
    collection: "Legendary",
    tier: "legendary",
    renderer: "css",
    accent: "#67e8f9",
    previewGradient: "linear-gradient(115deg, rgba(255,255,255,0.08), rgba(103,232,249,0.2), rgba(244,114,182,0.18), rgba(251,191,36,0.16), rgba(255,255,255,0.08))",
    tags: ["holographic", "rainbow", "foil"],
  },
  {
    key: "displacement_water",
    label: "Water Displacement",
    description: "Soft liquid ripples sweep over the avatar like refracted water.",
    collection: "Premium",
    tier: "premium",
    renderer: "canvas",
    accent: "#7dd3fc",
    previewGradient: "radial-gradient(circle at 30% 25%, rgba(125,211,252,0.18), transparent 35%), radial-gradient(circle at 70% 65%, rgba(34,211,238,0.18), transparent 36%), linear-gradient(135deg, rgba(14,165,233,0.1), rgba(15,23,42,0.04))",
    tags: ["water", "ripple", "glass"],
  },
  {
    key: "pixelate_pulse",
    label: "Pixel Pulse",
    description: "A digital pixel grid pulses over the avatar with retro tech energy.",
    collection: "Premium",
    tier: "premium",
    renderer: "canvas",
    accent: "#818cf8",
    previewGradient: "linear-gradient(135deg, rgba(129,140,248,0.14), rgba(34,211,238,0.1)), repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 8px), repeating-linear-gradient(180deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 8px)",
    tags: ["pixel", "pulse", "digital"],
  },
  {
    key: "crt_overlay",
    label: "CRT Overlay",
    description: "Scan lines and phosphor glow turn the avatar into a retro monitor.",
    collection: "Legendary",
    tier: "legendary",
    renderer: "canvas",
    accent: "#67e8f9",
    previewGradient: "linear-gradient(180deg, rgba(103,232,249,0.08), rgba(15,23,42,0.08)), repeating-linear-gradient(180deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 6px)",
    tags: ["crt", "retro", "scanline"],
  },
  {
    key: "godray_overlay",
    label: "Godrays",
    description: "Light beams sweep diagonally through the avatar surface.",
    collection: "Premium",
    tier: "premium",
    renderer: "canvas",
    accent: "#e0f2fe",
    previewGradient: "linear-gradient(120deg, rgba(224,242,254,0.04), rgba(224,242,254,0.22), rgba(34,211,238,0.06))",
    tags: ["godray", "light", "beam"],
  },
  {
    key: "glitch_avatar",
    label: "Glitch Avatar",
    description: "RGB slices jump across the avatar in short corruption bursts.",
    collection: "Legendary",
    tier: "legendary",
    renderer: "canvas",
    accent: "#22d3ee",
    previewGradient: "linear-gradient(135deg, rgba(34,211,238,0.14), rgba(244,114,182,0.12), rgba(15,23,42,0.06))",
    tags: ["glitch", "rgb", "corruption"],
  },
  {
    key: "vhs_overlay",
    label: "VHS Tape",
    description: "Noise, tracking lines, and analog interference add old-film character.",
    collection: "Premium",
    tier: "premium",
    renderer: "canvas",
    accent: "#cbd5e1",
    previewGradient: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(15,23,42,0.1)), repeating-linear-gradient(180deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 5px)",
    tags: ["vhs", "analog", "noise"],
  },
  {
    key: "firefly_swarm",
    label: "Firefly Swarm",
    description: "Organic bioluminescent particles wander and pulse around the avatar.",
    collection: "Premium",
    tier: "premium",
    renderer: "canvas",
    accent: "#a3e635",
    previewGradient: "radial-gradient(circle at 30% 40%, rgba(163,230,53,0.22), transparent 45%), radial-gradient(circle at 70% 60%, rgba(253,224,71,0.16), transparent 40%), linear-gradient(135deg, rgba(20,83,45,0.12), rgba(15,23,42,0.06))",
    tags: ["firefly", "organic", "glow"],
  },
  {
    key: "rain_streaks",
    label: "Rain Streaks",
    description: "Diagonal rain streams across the avatar with a moody atmosphere.",
    collection: "Premium",
    tier: "premium",
    renderer: "canvas",
    accent: "#93c5fd",
    previewGradient: "linear-gradient(165deg, rgba(147,197,253,0.12), rgba(125,211,252,0.08), rgba(15,23,42,0.06))",
    tags: ["rain", "moody", "weather"],
  },
  {
    key: "heartbeat_monitor",
    label: "Heartbeat Monitor",
    description: "An ECG waveform pulses across the avatar like a vital signs display.",
    collection: "Legendary",
    tier: "legendary",
    renderer: "canvas",
    accent: "#4ade80",
    previewGradient: "linear-gradient(90deg, rgba(15,23,42,0.08), rgba(74,222,128,0.16), rgba(15,23,42,0.08))",
    tags: ["heartbeat", "ecg", "monitor"],
  },
  {
    key: "radar_sweep",
    label: "Radar Sweep",
    description: "A scanning radar wedge rotates over the avatar with blip markers.",
    collection: "Legendary",
    tier: "legendary",
    renderer: "canvas",
    accent: "#22d3ee",
    previewGradient: "radial-gradient(circle at 50% 50%, rgba(34,211,238,0.18), rgba(14,165,233,0.06) 60%, transparent 72%)",
    tags: ["radar", "scan", "tech"],
  },
  {
    key: "binary_cascade",
    label: "Binary Cascade",
    description: "Columns of binary digits cascade across the avatar surface.",
    collection: "Legendary",
    tier: "legendary",
    renderer: "canvas",
    accent: "#4ade80",
    previewGradient: "linear-gradient(180deg, rgba(74,222,128,0.1), rgba(15,23,42,0.06)), repeating-linear-gradient(90deg, rgba(74,222,128,0.06) 0 1px, transparent 1px 8px)",
    tags: ["binary", "code", "matrix"],
  },
];

export const BANNER_EFFECT_CATALOG: BannerEffectCatalogItem[] = [
  {
    key: "none",
    label: "None",
    collection: "Essentials",
    colorFamily: "Neutral",
    motionStyle: "Static",
    accent: "#94a3b8",
    description: "Keep the banner clean and focus on the card theme.",
    tags: ["clean", "minimal"],
  },
  {
    key: "falling_stars",
    label: "Falling Stars",
    collection: "Celestial",
    colorFamily: "Sky",
    motionStyle: "Drift",
    accent: "#93c5fd",
    description: "Bright dots sweep across the card like a late-night session.",
    tags: ["stars", "space", "blue"],
  },
  {
    key: "fire_embers",
    label: "Fire Embers",
    collection: "Elements",
    colorFamily: "Fire",
    motionStyle: "Rise",
    accent: "#fb923c",
    description: "Warm embers rise through the banner with a furnace glow.",
    tags: ["fire", "orange", "embers"],
  },
  {
    key: "snow",
    label: "Snow",
    collection: "Seasonal",
    colorFamily: "Ice",
    motionStyle: "Drift",
    accent: "#e0f2fe",
    description: "Slow white flakes soften the profile with a calm winter mood.",
    tags: ["snow", "ice", "winter"],
  },
  {
    key: "sakura_petals",
    label: "Sakura Petals",
    collection: "Seasonal",
    colorFamily: "Pink",
    motionStyle: "Sway",
    accent: "#f9a8d4",
    description: "Petals float across the banner with a soft side-to-side sway.",
    tags: ["sakura", "petals", "pink"],
  },
  {
    key: "glitch",
    label: "Glitch",
    collection: "Cyber",
    colorFamily: "Teal",
    motionStyle: "Flicker",
    accent: "#22d3ee",
    description: "RGB splits and scan lines make the banner feel like a hacked terminal.",
    tags: ["glitch", "cyber", "rgb"],
  },
  {
    key: "matrix_rain",
    label: "Matrix Rain",
    collection: "Cyber",
    colorFamily: "Green",
    motionStyle: "Columns",
    accent: "#4ade80",
    description: "Glyph columns fall through the banner with a digital tape feel.",
    tags: ["matrix", "rain", "green"],
  },
  {
    key: "aurora_borealis",
    label: "Aurora Borealis",
    collection: "Celestial",
    colorFamily: "Aurora",
    motionStyle: "Wave",
    accent: "#818cf8",
    description: "Soft light bands roll across the banner like a moving sky ribbon.",
    tags: ["aurora", "wave", "northern"],
  },
  {
    key: "lightning",
    label: "Lightning",
    collection: "Elements",
    colorFamily: "Indigo",
    motionStyle: "Flash",
    accent: "#818cf8",
    description: "Fast flashes and forked streaks spike the banner with storm energy.",
    tags: ["storm", "lightning", "flash"],
  },
  {
    key: "confetti",
    label: "Confetti",
    collection: "Celebration",
    colorFamily: "Rainbow",
    motionStyle: "Fall",
    accent: "#f472b6",
    description: "Bright rectangles tumble down like a milestone just got crushed.",
    tags: ["confetti", "celebration", "multicolor"],
  },
  {
    key: "sparkle_dust",
    label: "Sparkle Dust",
    collection: "Celestial",
    colorFamily: "Silver",
    motionStyle: "Twinkle",
    accent: "#e2e8f0",
    description: "A refined layer of subtle sparkles flickers across the header.",
    tags: ["sparkle", "dust", "subtle"],
  },
  {
    key: "bull_run",
    label: "Bull Run",
    collection: "Trader",
    colorFamily: "Green",
    motionStyle: "Rise",
    accent: "#22c55e",
    description: "Ascending green particles turn the profile into a markup tape.",
    tags: ["bull", "market", "trade"],
  },
  {
    key: "bear_market",
    label: "Bear Market",
    collection: "Trader",
    colorFamily: "Red",
    motionStyle: "Fall",
    accent: "#ef4444",
    description: "Red particles drift down through the banner with heavy momentum.",
    tags: ["bear", "market", "trade"],
  },
  {
    key: "diamond_rain",
    label: "Diamond Rain",
    collection: "Trader",
    colorFamily: "Prismatic",
    motionStyle: "Fall",
    accent: "#e0f2fe",
    description: "Crisp prismatic diamonds fall through the banner with a luxe finish.",
    tags: ["diamond", "prism", "trade"],
  },
  {
    key: "liquid_gradient",
    label: "Liquid Gradient",
    collection: "Atmosphere",
    colorFamily: "Aurora",
    motionStyle: "Blob",
    accent: "#22d3ee",
    description: "Blurred color blobs flow through the banner like liquid light.",
    tags: ["liquid", "gradient", "blob"],
  },
  {
    key: "starfield",
    label: "Starfield",
    collection: "Atmosphere",
    colorFamily: "Sky",
    motionStyle: "Parallax",
    accent: "#bfdbfe",
    description: "Layered drifting stars create a cinematic deep-space background.",
    tags: ["starfield", "stars", "space"],
  },
  {
    key: "holographic_card",
    label: "Holographic Card",
    collection: "Signature",
    colorFamily: "Prismatic",
    motionStyle: "Sweep",
    accent: "#c4b5fd",
    description: "Prismatic light sweeps over the card with a premium foil finish.",
    tags: ["holographic", "foil", "prismatic"],
  },
  {
    key: "pulse_wave",
    label: "Pulse Wave",
    collection: "Atmosphere",
    colorFamily: "Cyan",
    motionStyle: "Expand",
    accent: "#22d3ee",
    description: "Concentric rings expand outward from the center like a sonar ping.",
    tags: ["pulse", "wave", "sonar"],
  },
  {
    key: "candlestick_rain",
    label: "Candlestick Rain",
    collection: "Trader",
    colorFamily: "Multi",
    motionStyle: "Fall",
    accent: "#fbbf24",
    description: "Green and red candlesticks tumble through the banner like a market tape.",
    tags: ["candlestick", "chart", "trade"],
  },
  {
    key: "firefly_field",
    label: "Firefly Field",
    collection: "Atmosphere",
    colorFamily: "Warm",
    motionStyle: "Wander",
    accent: "#a3e635",
    description: "Warm organic lights drift and pulse through the banner like summer fireflies.",
    tags: ["firefly", "organic", "warm"],
  },
  {
    key: "rain_storm",
    label: "Rainstorm",
    collection: "Elements",
    colorFamily: "Sky",
    motionStyle: "Streak",
    accent: "#93c5fd",
    description: "Diagonal rain streaks add moody atmosphere with occasional lightning flashes.",
    tags: ["rain", "storm", "weather"],
  },
  {
    key: "ticker_tape",
    label: "Ticker Tape",
    collection: "Trader",
    colorFamily: "Amber",
    motionStyle: "Scroll",
    accent: "#fbbf24",
    description: "A scrolling stock ticker crawls across the banner with price changes.",
    tags: ["ticker", "stock", "scroll"],
  },
];

export const NAMEPLATE_CATALOG: NameplateCatalogItem[] = [
  {
    key: "default",
    label: "Default",
    collection: "Essentials",
    colorFamily: "Neutral",
    styleFamily: "Clear",
    accent: "#94a3b8",
    tags: ["default", "transparent"],
  },
  {
    key: "gradient_bar",
    label: "Gradient Bar",
    collection: "Essentials",
    colorFamily: "Teal",
    styleFamily: "Glow",
    accent: "#22d3ee",
    tags: ["bar", "gradient", "glow"],
  },
  {
    key: "glow_plate",
    label: "Glow Plate",
    collection: "Essentials",
    colorFamily: "Aurora",
    styleFamily: "Glow",
    accent: "#818cf8",
    tags: ["glow", "plate", "soft"],
  },
  {
    key: "gold",
    label: "Gradient - Gold",
    collection: "Gradients",
    colorFamily: "Gold",
    styleFamily: "Gradient",
    accent: "#fbbf24",
    tags: ["gold", "gradient"],
  },
  {
    key: "emerald",
    label: "Gradient - Emerald",
    collection: "Gradients",
    colorFamily: "Green",
    styleFamily: "Gradient",
    accent: "#10b981",
    tags: ["emerald", "gradient"],
  },
  {
    key: "ocean",
    label: "Gradient - Ocean",
    collection: "Gradients",
    colorFamily: "Blue",
    styleFamily: "Gradient",
    accent: "#0ea5e9",
    tags: ["ocean", "gradient"],
  },
  {
    key: "sunset",
    label: "Gradient - Sunset",
    collection: "Gradients",
    colorFamily: "Warm",
    styleFamily: "Gradient",
    accent: "#fb923c",
    tags: ["sunset", "gradient"],
  },
  {
    key: "fire",
    label: "Gradient - Fire",
    collection: "Gradients",
    colorFamily: "Fire",
    styleFamily: "Gradient",
    accent: "#ef4444",
    tags: ["fire", "gradient"],
  },
  {
    key: "ice",
    label: "Gradient - Ice",
    collection: "Gradients",
    colorFamily: "Ice",
    styleFamily: "Gradient",
    accent: "#7dd3fc",
    tags: ["ice", "gradient"],
  },
  {
    key: "midnight",
    label: "Gradient - Midnight",
    collection: "Gradients",
    colorFamily: "Indigo",
    styleFamily: "Gradient",
    accent: "#6366f1",
    tags: ["midnight", "gradient"],
  },
  {
    key: "neon",
    label: "Gradient - Neon",
    collection: "Gradients",
    colorFamily: "Neon",
    styleFamily: "Gradient",
    accent: "#4ade80",
    tags: ["neon", "gradient"],
  },
  {
    key: "aurora_mesh",
    label: "Mesh - Aurora",
    collection: "Mesh",
    colorFamily: "Aurora",
    styleFamily: "Mesh",
    accent: "#818cf8",
    tags: ["mesh", "aurora"],
  },
  {
    key: "cyber_mesh",
    label: "Mesh - Cyber",
    collection: "Mesh",
    colorFamily: "Teal",
    styleFamily: "Mesh",
    accent: "#22d3ee",
    tags: ["mesh", "cyber"],
  },
  {
    key: "circuit_pattern",
    label: "Pattern - Circuit",
    collection: "Patterns",
    colorFamily: "Green",
    styleFamily: "Pattern",
    accent: "#10b981",
    tags: ["circuit", "pattern"],
  },
  {
    key: "grid_pattern",
    label: "Pattern - Grid",
    collection: "Patterns",
    colorFamily: "Blue",
    styleFamily: "Pattern",
    accent: "#38bdf8",
    tags: ["grid", "pattern"],
  },
  {
    key: "waves_pattern",
    label: "Pattern - Waves",
    collection: "Patterns",
    colorFamily: "Ocean",
    styleFamily: "Pattern",
    accent: "#0ea5e9",
    tags: ["waves", "pattern"],
  },
  {
    key: "bull_plate",
    label: "Trader - Bull",
    collection: "Trader",
    colorFamily: "Green",
    styleFamily: "Trader",
    accent: "#22c55e",
    tags: ["bull", "trade", "market"],
  },
  {
    key: "bear_plate",
    label: "Trader - Bear",
    collection: "Trader",
    colorFamily: "Red",
    styleFamily: "Trader",
    accent: "#ef4444",
    tags: ["bear", "trade", "market"],
  },
  {
    key: "chart_plate",
    label: "Trader - Chart",
    collection: "Trader",
    colorFamily: "Amber",
    styleFamily: "Trader",
    accent: "#f59e0b",
    tags: ["chart", "trade", "candles"],
  },
  {
    key: "holographic_bar",
    label: "Holographic Bar",
    collection: "Signature",
    colorFamily: "Prismatic",
    styleFamily: "Animated",
    accent: "#c4b5fd",
    tags: ["holographic", "prismatic", "animated"],
  },
  {
    key: "neon_sign",
    label: "Neon Sign",
    collection: "Neon",
    colorFamily: "Neon",
    styleFamily: "Glow",
    accent: "#4ade80",
    tags: ["neon", "glow", "sign"],
  },
  {
    key: "pulse_border",
    label: "Pulse Border",
    collection: "Cyber",
    colorFamily: "Cyan",
    styleFamily: "Animated",
    accent: "#22d3ee",
    tags: ["pulse", "border", "cyber"],
  },
  {
    key: "static_noise",
    label: "Static Noise",
    collection: "Cyber",
    colorFamily: "Neutral",
    styleFamily: "Pattern",
    accent: "#cbd5e1",
    tags: ["static", "noise", "retro"],
  },
  {
    key: "plasma_bar",
    label: "Plasma Bar",
    collection: "Elements",
    colorFamily: "Violet",
    styleFamily: "Glow",
    accent: "#a855f7",
    tags: ["plasma", "violet", "glow"],
  },
  {
    key: "frost_bar",
    label: "Frost Bar",
    collection: "Elements",
    colorFamily: "Ice",
    styleFamily: "Glow",
    accent: "#7dd3fc",
    tags: ["frost", "ice", "cold"],
  },
  {
    key: "void_bar",
    label: "Void Bar",
    collection: "Elements",
    colorFamily: "Violet",
    styleFamily: "Gradient",
    accent: "#7c3aed",
    tags: ["void", "dark", "rift"],
  },
  {
    key: "solar_bar",
    label: "Solar Bar",
    collection: "Elements",
    colorFamily: "Gold",
    styleFamily: "Glow",
    accent: "#fbbf24",
    tags: ["solar", "gold", "flare"],
  },
  {
    key: "custom",
    label: "Custom",
    collection: "Custom",
    colorFamily: "Custom",
    styleFamily: "Gradient",
    accent: "#14b8a6",
    tags: ["custom", "gradient", "builder"],
  },
];

export const THEME_CATALOG: ThemeCatalogItem[] = [
  {
    key: "default",
    label: "Default",
    accent: "#14b8a6",
    banner: DEFAULT_PROFILE_BANNER_BACKGROUND_IMAGE,
    accentFamily: "Teal",
    mood: "Core",
    suggestedPfpEffect: "none",
    tags: ["default", "core", "teal"],
  },
  {
    key: "midnight",
    label: "Midnight",
    accent: "#6366f1",
    banner: "linear-gradient(135deg,rgba(15,23,42,0.98)_0%,rgba(49,46,129,0.92)_100%)",
    accentFamily: "Indigo",
    mood: "Moody",
    suggestedPfpEffect: "shadow_pulse",
    tags: ["midnight", "indigo", "moody"],
  },
  {
    key: "forest",
    label: "Forest",
    accent: "#10b981",
    banner: "linear-gradient(135deg,rgba(5,46,22,0.98)_0%,rgba(6,78,59,0.92)_100%)",
    accentFamily: "Emerald",
    mood: "Grounded",
    suggestedPfpEffect: "emerald_pulse",
    tags: ["forest", "green", "grounded"],
  },
  {
    key: "ocean",
    label: "Ocean",
    accent: "#38bdf8",
    banner: "linear-gradient(135deg,rgba(8,47,73,0.98)_0%,rgba(30,64,175,0.88)_100%)",
    accentFamily: "Sky",
    mood: "Cool",
    suggestedPfpEffect: "frost_aura",
    tags: ["ocean", "blue", "cool"],
  },
  {
    key: "sunset",
    label: "Sunset",
    accent: "#fb923c",
    banner: "linear-gradient(135deg,rgba(251,146,60,0.82)_0%,rgba(168,85,247,0.58)_100%)",
    accentFamily: "Orange",
    mood: "Bold",
    suggestedPfpEffect: "fire_ring",
    tags: ["sunset", "warm", "bold"],
  },
  {
    key: "rose_garden",
    label: "Rose Garden",
    accent: "#f472b6",
    banner: "linear-gradient(135deg,rgba(244,114,182,0.82)_0%,rgba(139,92,246,0.58)_100%)",
    accentFamily: "Pink",
    mood: "Soft",
    suggestedPfpEffect: "sakura_ring",
    tags: ["rose", "garden", "soft"],
  },
  {
    key: "arctic",
    label: "Arctic",
    accent: "#bae6fd",
    banner: "linear-gradient(135deg,rgba(186,230,253,0.92)_0%,rgba(15,23,42,0.82)_100%)",
    accentFamily: "Ice",
    mood: "Crisp",
    suggestedPfpEffect: "frost_aura",
    tags: ["arctic", "ice", "clean"],
  },
  {
    key: "volcanic",
    label: "Volcanic",
    accent: "#ef4444",
    banner: "linear-gradient(135deg,rgba(127,29,29,0.98)_0%,rgba(15,23,42,0.98)_100%)",
    accentFamily: "Red",
    mood: "Intense",
    suggestedPfpEffect: "fire_ring",
    tags: ["volcanic", "red", "intense"],
  },
  {
    key: "cyberpunk",
    label: "Cyberpunk",
    accent: "#22d3ee",
    banner: "linear-gradient(135deg,rgba(15,23,42,0.98)_0%,rgba(6,78,59,0.58)_35%,rgba(6,182,212,0.3)_100%)",
    accentFamily: "Cyan",
    mood: "Future",
    suggestedPfpEffect: "electric_spark",
    tags: ["cyberpunk", "cyan", "future"],
  },
  {
    key: "sakura",
    label: "Sakura",
    accent: "#fb7185",
    banner: "linear-gradient(135deg,rgba(251,113,133,0.72)_0%,rgba(15,23,42,0.9)_100%)",
    accentFamily: "Pink",
    mood: "Soft",
    suggestedPfpEffect: "sakura_ring",
    tags: ["sakura", "pink", "soft"],
  },
  {
    key: "gold_standard",
    label: "Gold Standard",
    accent: "#fbbf24",
    banner: "linear-gradient(135deg,rgba(120,53,15,0.98)_0%,rgba(15,23,42,0.96)_100%)",
    accentFamily: "Gold",
    mood: "Premium",
    suggestedPfpEffect: "gold_glow",
    tags: ["gold", "premium", "wealth"],
  },
  {
    key: "neon_nights",
    label: "Neon Nights",
    accent: "#4ade80",
    banner: "linear-gradient(135deg,rgba(15,23,42,0.98)_0%,rgba(6,95,70,0.8)_48%,rgba(15,23,42,0.98)_100%)",
    accentFamily: "Neon",
    mood: "Vibrant",
    suggestedPfpEffect: "neon_pulse",
    tags: ["neon", "night", "vibrant"],
  },
  {
    key: "bull_market",
    label: "Bull Market",
    accent: "#22c55e",
    banner: "linear-gradient(135deg,rgba(5,46,22,0.98)_0%,rgba(16,185,129,0.7)_100%)",
    accentFamily: "Green",
    mood: "Momentum",
    suggestedPfpEffect: "bull_ring",
    tags: ["bull", "market", "green"],
  },
  {
    key: "bear_market",
    label: "Bear Market",
    accent: "#ef4444",
    banner: "linear-gradient(135deg,rgba(127,29,29,0.98)_0%,rgba(15,23,42,0.92)_100%)",
    accentFamily: "Red",
    mood: "Pressure",
    suggestedPfpEffect: "bear_ring",
    tags: ["bear", "market", "red"],
  },
  {
    key: "diamond",
    label: "Diamond",
    accent: "#e0f2fe",
    banner: "linear-gradient(135deg,rgba(15,23,42,0.98)_0%,rgba(129,140,248,0.44)_50%,rgba(224,242,254,0.16)_100%)",
    accentFamily: "Prismatic",
    mood: "Luxe",
    suggestedPfpEffect: "diamond_hands",
    tags: ["diamond", "prism", "luxe"],
  },
  {
    key: "custom",
    label: "Custom",
    accent: DEFAULT_PROFILE_EFFECTS.themeAccent,
    banner:
      "linear-gradient(135deg,rgba(15,23,42,0.98)_0%,rgba(19,78,74,0.72)_100%)",
    accentFamily: "Custom",
    mood: "Bespoke",
    suggestedPfpEffect: "custom",
    tags: ["custom", "gradient", "bespoke"],
  },
];

const NAME_COLOR_PREVIEW_TONES: Record<string, NameColorPreviewTone> = {
  default: {
    accent: "#94a3b8",
    banner: DEFAULT_PROFILE_BANNER_BACKGROUND_IMAGE,
  },
  gold: {
    accent: "#fbbf24",
    banner:
      "radial-gradient(circle_at_18%_22%,rgba(251,191,36,0.36)_0%,transparent_24%),linear-gradient(135deg,rgba(120,53,15,0.96)_0%,rgba(15,23,42,0.98)_100%)",
  },
  emerald: {
    accent: "#10b981",
    banner:
      "radial-gradient(circle_at_18%_22%,rgba(16,185,129,0.34)_0%,transparent_24%),linear-gradient(135deg,rgba(6,78,59,0.96)_0%,rgba(15,23,42,0.98)_100%)",
  },
  ocean: {
    accent: "#0ea5e9",
    banner:
      "radial-gradient(circle_at_18%_22%,rgba(34,211,238,0.34)_0%,transparent_24%),linear-gradient(135deg,rgba(30,64,175,0.94)_0%,rgba(15,23,42,0.98)_100%)",
  },
  sunset: {
    accent: "#fb923c",
    banner:
      "radial-gradient(circle_at_18%_22%,rgba(251,146,60,0.36)_0%,transparent_24%),linear-gradient(135deg,rgba(190,24,93,0.78)_0%,rgba(15,23,42,0.98)_100%)",
  },
  rose: {
    accent: "#f472b6",
    banner:
      "radial-gradient(circle_at_18%_22%,rgba(244,114,182,0.36)_0%,transparent_24%),linear-gradient(135deg,rgba(157,23,77,0.86)_0%,rgba(88,28,135,0.76)_52%,rgba(15,23,42,0.98)_100%)",
  },
  aurora: {
    accent: "#818cf8",
    banner:
      "radial-gradient(circle_at_18%_22%,rgba(52,211,153,0.3)_0%,transparent_24%),radial-gradient(circle_at_78%_16%,rgba(129,140,248,0.24)_0%,transparent_22%),linear-gradient(135deg,rgba(8,47,73,0.94)_0%,rgba(79,70,229,0.72)_100%)",
  },
  ice: {
    accent: "#7dd3fc",
    banner:
      "radial-gradient(circle_at_18%_22%,rgba(224,242,254,0.34)_0%,transparent_24%),linear-gradient(135deg,rgba(8,47,73,0.94)_0%,rgba(14,116,144,0.72)_100%)",
  },
  midnight: {
    accent: "#6366f1",
    banner:
      "radial-gradient(circle_at_18%_22%,rgba(129,140,248,0.32)_0%,transparent_24%),linear-gradient(135deg,rgba(49,46,129,0.96)_0%,rgba(15,23,42,0.98)_100%)",
  },
  fire: {
    accent: "#ef4444",
    banner:
      "radial-gradient(circle_at_18%_22%,rgba(251,191,36,0.36)_0%,transparent_22%),radial-gradient(circle_at_76%_16%,rgba(239,68,68,0.24)_0%,transparent_20%),linear-gradient(135deg,rgba(153,27,27,0.96)_0%,rgba(15,23,42,0.98)_100%)",
  },
  neon: {
    accent: "#4ade80",
    banner:
      "radial-gradient(circle_at_18%_22%,rgba(74,222,128,0.34)_0%,transparent_22%),radial-gradient(circle_at_76%_16%,rgba(244,114,182,0.2)_0%,transparent_20%),linear-gradient(135deg,rgba(6,95,70,0.96)_0%,rgba(15,23,42,0.98)_100%)",
  },
};

const avatarEffectSet = new Set(AVATAR_EFFECT_CATALOG.map((item) => item.key));
const avatarDecorationSet = new Set(
  AVATAR_DECORATION_CATALOG.map((item) => item.key)
);
const bannerEffectSet = new Set(BANNER_EFFECT_CATALOG.map((item) => item.key));
const nameplateSet = new Set(NAMEPLATE_CATALOG.map((item) => item.key));
const themeSet = new Set(THEME_CATALOG.map((item) => item.key));
const nameEffectSet = new Set(NAME_EFFECT_PRESETS.map((item) => item.value));
const nameFontSet = new Set(NAME_FONT_PRESETS.map((item) => item.value));
const nameColorSet = new Set(NAME_COLOR_PRESETS.map((item) => item.value));
const ringEffectSet = new Set([
  ...CUSTOM_RING_EFFECT_PRESETS.map((item) => item.value),
  "sakura",
]);

const avatarLabelMap: Map<string, string> = new Map(
  AVATAR_EFFECT_CATALOG.map((item) => [item.key, item.label])
);
const avatarDecorationLabelMap: Map<string, string> = new Map(
  AVATAR_DECORATION_CATALOG.map((item) => [item.key, item.label])
);
const bannerLabelMap: Map<string, string> = new Map(
  BANNER_EFFECT_CATALOG.map((item) => [item.key, item.label])
);
const nameplateLabelMap: Map<string, string> = new Map(
  NAMEPLATE_CATALOG.map((item) => [item.key, item.label])
);
const themeLabelMap: Map<string, string> = new Map(
  THEME_CATALOG.map((item) => [item.key, item.label])
);
const nameColorLabelMap: Map<string, string> = new Map(
  NAME_COLOR_PRESETS.map((item) => [item.value, item.label])
);
const nameFontLabelMap: Map<string, string> = new Map(
  NAME_FONT_PRESETS.map((item) => [item.value, item.label])
);
const nameEffectLabelMap: Map<string, string> = new Map(
  NAME_EFFECT_PRESETS.map((item) => [item.value, item.label])
);

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function toRgba(hex: string, alpha: number) {
  const sanitized = hex.replace("#", "");
  if (sanitized.length !== 6) {
    return `rgba(255,255,255,${alpha})`;
  }

  const r = parseInt(sanitized.slice(0, 2), 16);
  const g = parseInt(sanitized.slice(2, 4), 16);
  const b = parseInt(sanitized.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function buildCustomBanner(from: string, to: string) {
  return [
    `radial-gradient(circle at 18% 22%, ${toRgba(to, 0.34)} 0%, transparent 24%)`,
    `radial-gradient(circle at 76% 16%, ${toRgba(from, 0.22)} 0%, transparent 20%)`,
    `linear-gradient(135deg, ${toRgba(from, 0.92)} 0%, ${toRgba(to, 0.78)} 100%)`,
  ].join(", ");
}

function normalizeOption(
  value: unknown,
  allowed: Set<string>,
  fallback: string,
  aliases?: Record<string, string>
) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = aliases?.[value] ?? value;
  return allowed.has(normalized) ? normalized : fallback;
}

export function normalizeProfileEffects(
  input?: Record<string, unknown> | null
): ProfileEffectsState {
  return {
    pfpEffect: normalizeOption(
      input?.pfpEffect,
      avatarEffectSet,
      DEFAULT_PROFILE_EFFECTS.pfpEffect
    ),
    avatarDecoration: normalizeOption(
      input?.avatarDecoration,
      avatarDecorationSet,
      DEFAULT_PROFILE_EFFECTS.avatarDecoration
    ),
    bannerEffect: normalizeOption(
      input?.bannerEffect,
      bannerEffectSet,
      DEFAULT_PROFILE_EFFECTS.bannerEffect
    ),
    nameplate: normalizeOption(
      input?.nameplate,
      nameplateSet,
      DEFAULT_PROFILE_EFFECTS.nameplate
    ),
    nameEffect: normalizeOption(
      input?.nameEffect,
      nameEffectSet,
      DEFAULT_PROFILE_EFFECTS.nameEffect
    ),
    nameFont: normalizeOption(
      input?.nameFont,
      nameFontSet,
      DEFAULT_PROFILE_EFFECTS.nameFont
    ),
    nameColor: normalizeOption(
      input?.nameColor,
      nameColorSet,
      DEFAULT_PROFILE_EFFECTS.nameColor
    ),
    theme: normalizeOption(input?.theme, themeSet, DEFAULT_PROFILE_EFFECTS.theme),
    customGradientFrom: isHexColor(input?.customGradientFrom)
      ? input.customGradientFrom
      : DEFAULT_PROFILE_EFFECTS.customGradientFrom,
    customGradientTo: isHexColor(input?.customGradientTo)
      ? input.customGradientTo
      : DEFAULT_PROFILE_EFFECTS.customGradientTo,
    customRingFrom: isHexColor(input?.customRingFrom)
      ? input.customRingFrom
      : DEFAULT_PROFILE_EFFECTS.customRingFrom,
    customRingTo: isHexColor(input?.customRingTo)
      ? input.customRingTo
      : DEFAULT_PROFILE_EFFECTS.customRingTo,
    customRingEffect: normalizeOption(
      input?.customRingEffect,
      ringEffectSet,
      DEFAULT_PROFILE_EFFECTS.customRingEffect,
      { sakura: "soft_pulse" }
    ),
    customNameplateFrom: isHexColor(input?.customNameplateFrom)
      ? input.customNameplateFrom
      : DEFAULT_PROFILE_EFFECTS.customNameplateFrom,
    customNameplateTo: isHexColor(input?.customNameplateTo)
      ? input.customNameplateTo
      : DEFAULT_PROFILE_EFFECTS.customNameplateTo,
    customThemeFrom: isHexColor(input?.customThemeFrom)
      ? input.customThemeFrom
      : DEFAULT_PROFILE_EFFECTS.customThemeFrom,
    customThemeTo: isHexColor(input?.customThemeTo)
      ? input.customThemeTo
      : DEFAULT_PROFILE_EFFECTS.customThemeTo,
    themeAccent: isHexColor(input?.themeAccent)
      ? input.themeAccent
      : DEFAULT_PROFILE_EFFECTS.themeAccent,
  };
}

export function areProfileEffectsEqual(
  left: ProfileEffectsState,
  right: ProfileEffectsState
) {
  return (
    left.pfpEffect === right.pfpEffect &&
    left.avatarDecoration === right.avatarDecoration &&
    left.bannerEffect === right.bannerEffect &&
    left.nameplate === right.nameplate &&
    left.nameEffect === right.nameEffect &&
    left.nameFont === right.nameFont &&
    left.nameColor === right.nameColor &&
    left.theme === right.theme &&
    left.customGradientFrom === right.customGradientFrom &&
    left.customGradientTo === right.customGradientTo &&
    left.customRingFrom === right.customRingFrom &&
    left.customRingTo === right.customRingTo &&
    left.customRingEffect === right.customRingEffect &&
    left.customNameplateFrom === right.customNameplateFrom &&
    left.customNameplateTo === right.customNameplateTo &&
    left.customThemeFrom === right.customThemeFrom &&
    left.customThemeTo === right.customThemeTo &&
    left.themeAccent === right.themeAccent
  );
}

export function toProfileEffectsInput(profileEffects: ProfileEffectsState) {
  return {
    pfpEffect: profileEffects.pfpEffect,
    avatarDecoration: profileEffects.avatarDecoration,
    bannerEffect: profileEffects.bannerEffect,
    nameplate: profileEffects.nameplate,
    nameEffect: profileEffects.nameEffect,
    nameFont: profileEffects.nameFont,
    nameColor: profileEffects.nameColor,
    theme: profileEffects.theme,
    customGradientFrom: profileEffects.customGradientFrom,
    customGradientTo: profileEffects.customGradientTo,
    customRingFrom: profileEffects.customRingFrom,
    customRingTo: profileEffects.customRingTo,
    customRingEffect: profileEffects.customRingEffect,
    customNameplateFrom: profileEffects.customNameplateFrom,
    customNameplateTo: profileEffects.customNameplateTo,
    customThemeFrom: profileEffects.customThemeFrom,
    customThemeTo: profileEffects.customThemeTo,
    themeAccent: profileEffects.themeAccent,
  };
}

export function resolveProfilePreviewTheme(
  profileEffects: ProfileEffectsState
): PreviewThemeDefinition {
  if (
    profileEffects.theme === "custom" &&
    isHexColor(profileEffects.customThemeFrom) &&
    isHexColor(profileEffects.customThemeTo)
  ) {
    return {
      label: "Custom",
      accent: isHexColor(profileEffects.themeAccent)
        ? profileEffects.themeAccent
        : profileEffects.customThemeFrom,
      banner: buildCustomBanner(
        profileEffects.customThemeFrom,
        profileEffects.customThemeTo
      ),
      accentFamily: "Custom",
      mood: "Bespoke",
      suggestedPfpEffect: profileEffects.pfpEffect,
    };
  }

  const themeMatch = THEME_CATALOG.find((item) => item.key === profileEffects.theme);
  if (themeMatch && profileEffects.theme !== "custom") {
    return themeMatch;
  }

  if (
    profileEffects.pfpEffect === "custom" &&
    isHexColor(profileEffects.customRingFrom) &&
    isHexColor(profileEffects.customRingTo)
  ) {
    return {
      label: "Custom Ring",
      accent: profileEffects.customRingFrom,
      banner: buildCustomBanner(
        profileEffects.customRingFrom,
        profileEffects.customRingTo
      ),
      accentFamily: "Custom",
      mood: "Bespoke",
      suggestedPfpEffect: "custom",
    };
  }

  const avatarMatch = AVATAR_EFFECT_CATALOG.find(
    (item) => item.key === profileEffects.pfpEffect
  );
  if (avatarMatch && avatarMatch.key !== "none") {
    return {
      label: avatarMatch.label,
      accent: avatarMatch.accent,
      banner: avatarMatch.previewBanner,
      accentFamily: avatarMatch.colorFamily,
      mood: avatarMatch.collection,
      suggestedPfpEffect: avatarMatch.key,
    };
  }

  if (
    profileEffects.nameColor === "custom" &&
    isHexColor(profileEffects.customGradientFrom) &&
    isHexColor(profileEffects.customGradientTo)
  ) {
    return {
      label: "Custom Name",
      accent: profileEffects.customGradientFrom,
      banner: buildCustomBanner(
        profileEffects.customGradientFrom,
        profileEffects.customGradientTo
      ),
      accentFamily: "Custom",
      mood: "Expressive",
      suggestedPfpEffect: profileEffects.pfpEffect,
    };
  }

  const colorTone = NAME_COLOR_PREVIEW_TONES[profileEffects.nameColor];
  if (colorTone) {
    return {
      label: getNameColorLabel(profileEffects.nameColor),
      accent: colorTone.accent,
      banner: colorTone.banner,
      accentFamily: getNameColorLabel(profileEffects.nameColor),
      mood: "Name Style",
      suggestedPfpEffect: profileEffects.pfpEffect,
    };
  }

  return THEME_CATALOG[0]!;
}

export function getAvatarEffectLabel(value?: string | null) {
  return avatarLabelMap.get(value ?? "") ?? "None";
}

export function getAvatarDecorationLabel(value?: string | null) {
  return avatarDecorationLabelMap.get(value ?? "") ?? "None";
}

export function getBannerEffectLabel(value?: string | null) {
  return bannerLabelMap.get(value ?? "") ?? "None";
}

export function getNameplateLabel(value?: string | null) {
  return nameplateLabelMap.get(value ?? "") ?? "Default";
}

export function getThemeLabel(value?: string | null) {
  return themeLabelMap.get(value ?? "") ?? "Default";
}

export function getNameColorLabel(value?: string | null) {
  return nameColorLabelMap.get(value ?? "") ?? "Default";
}

export function getNameFontLabel(value?: string | null) {
  return nameFontLabelMap.get(value ?? "") ?? "Default";
}

export function getNameEffectLabel(value?: string | null) {
  return nameEffectLabelMap.get(value ?? "") ?? "None";
}

const ADVANCED_AVATAR_EFFECT_KEYS = new Set([
  "gradient_spin_fire",
  "gradient_spin_ocean",
  "gradient_spin_toxic",
  "stroke_draw_single",
  "stroke_draw_double",
  "stroke_draw_dotted",
  "energy_flow",
  "multi_ring",
  "lightning_ring_v2",
]);

const LEGENDARY_BANNER_EFFECT_KEYS = new Set([
  "lightning",
  "diamond_rain",
  "holographic_card",
]);

const PREMIUM_BANNER_EFFECT_KEYS = new Set([
  "aurora_borealis",
  "matrix_rain",
  "confetti",
  "sparkle_dust",
  "liquid_gradient",
  "starfield",
  "bull_run",
  "bear_market",
]);

const PREMIUM_NAMEPLATE_KEYS = new Set([
  "aurora_mesh",
  "cyber_mesh",
  "circuit_pattern",
  "grid_pattern",
  "waves_pattern",
  "glow_plate",
]);

const LEGENDARY_NAMEPLATE_KEYS = new Set(["bull_plate", "bear_plate", "chart_plate", "custom"]);

const PREMIUM_THEME_KEYS = new Set([
  "cyberpunk",
  "sakura",
  "midnight",
  "volcanic",
  "arctic",
  "diamond",
]);

const LEGENDARY_THEME_KEYS = new Set(["bull_market", "bear_market", "gold_standard", "custom"]);

const PREMIUM_NAME_EFFECT_KEYS = new Set([
  "shimmer",
  "gradient_shift",
  "wave",
  "name_wave_v2",
  "name_gradient_flow",
]);

const LEGENDARY_NAME_EFFECT_KEYS = new Set([
  "glitch_text",
  "name_glitch_v2",
  "name_scramble",
  "name_neon_flicker",
  "name_typewriter_v2",
]);

export function getAvatarEffectTier(value?: string | null): EffectTier {
  if (!value || value === "none") return "free";
  if (value === "custom" || value === "lightning_ring_v2") return "legendary";
  if (ADVANCED_AVATAR_EFFECT_KEYS.has(value)) return "premium";
  return "basic";
}

export function getBannerEffectTier(value?: string | null): EffectTier {
  if (!value || value === "none") return "free";
  if (LEGENDARY_BANNER_EFFECT_KEYS.has(value)) return "legendary";
  if (PREMIUM_BANNER_EFFECT_KEYS.has(value)) return "premium";
  return "basic";
}

export function getNameplateTier(value?: string | null): EffectTier {
  if (!value || value === "default") return "free";
  if (LEGENDARY_NAMEPLATE_KEYS.has(value)) return "legendary";
  if (PREMIUM_NAMEPLATE_KEYS.has(value)) return "premium";
  return "basic";
}

export function getThemeTier(value?: string | null): EffectTier {
  if (!value || value === "default") return "free";
  if (LEGENDARY_THEME_KEYS.has(value)) return "legendary";
  if (PREMIUM_THEME_KEYS.has(value)) return "premium";
  return "basic";
}

export function getNameEffectTier(value?: string | null): EffectTier {
  if (!value || value === "none") return "free";
  if (LEGENDARY_NAME_EFFECT_KEYS.has(value)) return "legendary";
  if (PREMIUM_NAME_EFFECT_KEYS.has(value)) return "premium";
  return "basic";
}

export function getNameColorTier(value?: string | null): EffectTier {
  if (!value || value === "default") return "free";
  if (value === "custom") return "legendary";
  return ["aurora", "midnight", "neon", "fire"].includes(value) ? "premium" : "basic";
}

export function getNameFontTier(value?: string | null): EffectTier {
  if (!value || value === "default") return "free";
  return ["display", "gothic", "rounded"].includes(value) ? "premium" : "basic";
}

export function getThemeDefinition(key?: string | null) {
  return THEME_CATALOG.find((item) => item.key === key) ?? THEME_CATALOG[0]!;
}

export const NAME_STYLE_SECTIONS = [
  {
    key: "color",
    label: "Name Color",
    description: "Set a gradient or signature palette for your display name.",
    items: NAME_COLOR_PRESETS,
  },
  {
    key: "font",
    label: "Name Font",
    description: "Choose the display family that carries your profile everywhere.",
    items: NAME_FONT_PRESETS,
  },
  {
    key: "effect",
    label: "Name Effect",
    description: "Layer motion and polish on top of your display name treatment.",
    items: NAME_EFFECT_PRESETS,
  },
] as const;
