import { z } from "zod";

export const PROFILE_PFP_EFFECTS = [
  "none",
  "gold_glow",
  "emerald_pulse",
  "frost_aura",
  "neon_pulse",
  "neon_pulse_pink",
  "neon_pulse_blue",
  "electric_spark",
  "fire_ring",
  "ice_crystals",
  "shadow_pulse",
  "lightning_ring",
  "sakura_ring",
  "cherry_bloom",
  "pink_petals",
  "glitch_frame",
  "hud_ring",
  "matrix_glow",
  "digital_pulse",
  "rainbow_ring",
  "aurora_ring",
  "stardust",
  "enchanted",
  "hearts",
  "rose_petals",
  "love_glow",
  "bull_ring",
  "bear_ring",
  "diamond_hands",
  "moon_glow",
  "gradient_spin_fire",
  "gradient_spin_ocean",
  "gradient_spin_toxic",
  "stroke_draw_single",
  "stroke_draw_double",
  "stroke_draw_dotted",
  "energy_flow",
  "multi_ring",
  "lightning_ring_v2",
  "flame_arc",
  "plasma_ring",
  "frost_shards",
  "void_rift",
  "solar_flare",
  "custom",
] as const;

export const PROFILE_AVATAR_DECORATIONS = [
  "none",
  "orbiting_sparkles",
  "orbiting_embers",
  "orbiting_snowflakes",
  "orbiting_petals",
  "sparkle_dust_gold",
  "sparkle_dust_diamond",
  "sparkle_dust_emerald",
  "smoke_rising",
  "holographic_overlay",
  "displacement_water",
  "pixelate_pulse",
  "crt_overlay",
  "godray_overlay",
  "glitch_avatar",
  "vhs_overlay",
  "firefly_swarm",
  "rain_streaks",
  "heartbeat_monitor",
  "radar_sweep",
  "binary_cascade",
] as const;

export const PROFILE_BANNER_EFFECTS = [
  "none",
  "falling_stars",
  "fire_embers",
  "snow",
  "sakura_petals",
  "glitch",
  "matrix_rain",
  "aurora_borealis",
  "lightning",
  "confetti",
  "sparkle_dust",
  "bull_run",
  "bear_market",
  "diamond_rain",
  "liquid_gradient",
  "starfield",
  "holographic_card",
  "pulse_wave",
  "candlestick_rain",
  "firefly_field",
  "rain_storm",
  "ticker_tape",
] as const;

export const PROFILE_NAMEPLATES = [
  "default",
  "gradient_bar",
  "glow_plate",
  "gold",
  "emerald",
  "ocean",
  "sunset",
  "fire",
  "ice",
  "midnight",
  "neon",
  "aurora_mesh",
  "cyber_mesh",
  "circuit_pattern",
  "grid_pattern",
  "waves_pattern",
  "bull_plate",
  "bear_plate",
  "chart_plate",
  "holographic_bar",
  "neon_sign",
  "pulse_border",
  "static_noise",
  "plasma_bar",
  "frost_bar",
  "void_bar",
  "solar_bar",
  "custom",
] as const;

export const PROFILE_NAME_EFFECTS = [
  "none",
  "sparkle",
  "glow",
  "shimmer",
  "gradient_shift",
  "breathe",
  "typewriter",
  "wave",
  "glitch_text",
  "underline_draw",
  "name_scramble",
  "name_wave_v2",
  "name_neon_flicker",
  "name_glitch_v2",
  "name_typewriter_v2",
  "name_gradient_flow",
  "name_electric_crackle",
  "name_flame_rise",
  "name_frost_crawl",
  "name_void_pulse",
  "name_plasma_shift",
] as const;

export const PROFILE_NAME_FONTS = [
  "default",
  "serif",
  "mono",
  "display",
  "handwriting",
  "gothic",
  "thin",
  "rounded",
] as const;

export const PROFILE_NAME_COLORS = [
  "default",
  "gold",
  "emerald",
  "ocean",
  "sunset",
  "rose",
  "aurora",
  "ice",
  "midnight",
  "fire",
  "neon",
  "custom",
] as const;

export const PROFILE_THEMES = [
  "default",
  "midnight",
  "forest",
  "ocean",
  "sunset",
  "rose_garden",
  "arctic",
  "volcanic",
  "cyberpunk",
  "sakura",
  "gold_standard",
  "neon_nights",
  "bull_market",
  "bear_market",
  "diamond",
  "custom",
] as const;

export const PROFILE_RING_ANIMATIONS = [
  "none",
  "pulse",
  "electric",
  "soft_pulse",
  "sakura",
  "heartbeat",
] as const;

export type StoredProfileEffects = {
  pfpEffect?: (typeof PROFILE_PFP_EFFECTS)[number];
  avatarDecoration?: (typeof PROFILE_AVATAR_DECORATIONS)[number];
  bannerEffect?: (typeof PROFILE_BANNER_EFFECTS)[number];
  nameplate?: (typeof PROFILE_NAMEPLATES)[number];
  nameEffect?: (typeof PROFILE_NAME_EFFECTS)[number];
  nameFont?: (typeof PROFILE_NAME_FONTS)[number];
  nameColor?: (typeof PROFILE_NAME_COLORS)[number];
  theme?: (typeof PROFILE_THEMES)[number];
  customGradientFrom?: string;
  customGradientTo?: string;
  customRingFrom?: string;
  customRingTo?: string;
  customRingEffect?: (typeof PROFILE_RING_ANIMATIONS)[number];
  customNameplateFrom?: string;
  customNameplateTo?: string;
  customThemeFrom?: string;
  customThemeTo?: string;
  themeAccent?: string;
};

export const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const updateProfileEffectsInputSchema = z.object({
  pfpEffect: z.enum(PROFILE_PFP_EFFECTS).optional(),
  avatarDecoration: z.enum(PROFILE_AVATAR_DECORATIONS).optional(),
  bannerEffect: z.enum(PROFILE_BANNER_EFFECTS).optional(),
  nameplate: z.enum(PROFILE_NAMEPLATES).optional(),
  nameEffect: z.enum(PROFILE_NAME_EFFECTS).optional(),
  nameFont: z.enum(PROFILE_NAME_FONTS).optional(),
  nameColor: z.enum(PROFILE_NAME_COLORS).optional(),
  theme: z.enum(PROFILE_THEMES).optional(),
  customGradientFrom: hexColorSchema.optional(),
  customGradientTo: hexColorSchema.optional(),
  customRingFrom: hexColorSchema.optional(),
  customRingTo: hexColorSchema.optional(),
  customRingEffect: z.enum(PROFILE_RING_ANIMATIONS).optional(),
  customNameplateFrom: hexColorSchema.optional(),
  customNameplateTo: hexColorSchema.optional(),
  customThemeFrom: hexColorSchema.optional(),
  customThemeTo: hexColorSchema.optional(),
  themeAccent: hexColorSchema.optional(),
});
