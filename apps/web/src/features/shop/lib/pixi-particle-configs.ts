export type AvatarOverlayEffectKey =
  | "orbiting_sparkles"
  | "orbiting_embers"
  | "orbiting_snowflakes"
  | "orbiting_petals"
  | "sparkle_dust_gold"
  | "sparkle_dust_diamond"
  | "sparkle_dust_emerald"
  | "smoke_rising"
  | "displacement_water"
  | "pixelate_pulse"
  | "crt_overlay"
  | "godray_overlay"
  | "glitch_avatar"
  | "vhs_overlay"
  | "firefly_swarm"
  | "rain_streaks"
  | "heartbeat_monitor"
  | "radar_sweep"
  | "binary_cascade";

type AvatarOverlayConfig = {
  motion:
    | "orbit"
    | "surface-sparkle"
    | "smoke"
    | "water"
    | "pixelate"
    | "crt"
    | "godray"
    | "glitch"
    | "vhs"
    | "firefly"
    | "rain"
    | "heartbeat"
    | "radar"
    | "binary";
  particleCount: number;
  colors: number[];
  sizeRange: [number, number];
  speedRange: [number, number];
  radiusRange?: [number, number];
  opacity: number;
  drift?: number;
};

export const AVATAR_OVERLAY_CONFIGS: Record<AvatarOverlayEffectKey, AvatarOverlayConfig> = {
  orbiting_sparkles: {
    motion: "orbit",
    particleCount: 24,
    colors: [0xffffff, 0xfef3c7, 0x93c5fd],
    sizeRange: [1.4, 3.2],
    speedRange: [0.4, 0.9],
    radiusRange: [0.36, 0.48],
    opacity: 0.9,
  },
  orbiting_embers: {
    motion: "orbit",
    particleCount: 28,
    colors: [0xfb923c, 0xf97316, 0xef4444],
    sizeRange: [1.6, 3.8],
    speedRange: [0.5, 1.1],
    radiusRange: [0.36, 0.5],
    opacity: 0.88,
  },
  orbiting_snowflakes: {
    motion: "orbit",
    particleCount: 20,
    colors: [0xffffff, 0xe0f2fe, 0x7dd3fc],
    sizeRange: [1.5, 3.4],
    speedRange: [0.28, 0.6],
    radiusRange: [0.34, 0.48],
    opacity: 0.85,
  },
  orbiting_petals: {
    motion: "orbit",
    particleCount: 18,
    colors: [0xfbcfe8, 0xf9a8d4, 0xfb7185],
    sizeRange: [2.8, 5.4],
    speedRange: [0.2, 0.45],
    radiusRange: [0.34, 0.46],
    opacity: 0.8,
  },
  sparkle_dust_gold: {
    motion: "surface-sparkle",
    particleCount: 22,
    colors: [0xfbbf24, 0xfef3c7, 0xffffff],
    sizeRange: [1.2, 3],
    speedRange: [0.4, 0.9],
    opacity: 0.92,
  },
  sparkle_dust_diamond: {
    motion: "surface-sparkle",
    particleCount: 22,
    colors: [0xe0f2fe, 0xc4b5fd, 0xffffff],
    sizeRange: [1.2, 3],
    speedRange: [0.4, 0.9],
    opacity: 0.92,
  },
  sparkle_dust_emerald: {
    motion: "surface-sparkle",
    particleCount: 22,
    colors: [0x34d399, 0x6ee7b7, 0xffffff],
    sizeRange: [1.2, 3],
    speedRange: [0.4, 0.9],
    opacity: 0.9,
  },
  smoke_rising: {
    motion: "smoke",
    particleCount: 18,
    colors: [0xffffff, 0xe2e8f0, 0xcbd5e1],
    sizeRange: [6, 14],
    speedRange: [0.18, 0.42],
    opacity: 0.18,
    drift: 0.08,
  },
  displacement_water: {
    motion: "water",
    particleCount: 0,
    colors: [0x7dd3fc, 0x22d3ee, 0xe0f2fe],
    sizeRange: [0, 0],
    speedRange: [0, 0],
    opacity: 0.22,
  },
  pixelate_pulse: {
    motion: "pixelate",
    particleCount: 0,
    colors: [0x22d3ee, 0x818cf8, 0xf472b6],
    sizeRange: [0, 0],
    speedRange: [0, 0],
    opacity: 0.18,
  },
  crt_overlay: {
    motion: "crt",
    particleCount: 0,
    colors: [0x67e8f9],
    sizeRange: [0, 0],
    speedRange: [0, 0],
    opacity: 0.24,
  },
  godray_overlay: {
    motion: "godray",
    particleCount: 0,
    colors: [0xe0f2fe, 0x67e8f9],
    sizeRange: [0, 0],
    speedRange: [0, 0],
    opacity: 0.22,
  },
  glitch_avatar: {
    motion: "glitch",
    particleCount: 0,
    colors: [0x22d3ee, 0xf472b6, 0xffffff],
    sizeRange: [0, 0],
    speedRange: [0, 0],
    opacity: 0.32,
  },
  vhs_overlay: {
    motion: "vhs",
    particleCount: 0,
    colors: [0xffffff, 0xcbd5e1],
    sizeRange: [0, 0],
    speedRange: [0, 0],
    opacity: 0.18,
  },
  firefly_swarm: {
    motion: "firefly",
    particleCount: 16,
    colors: [0xa3e635, 0xfde047, 0x4ade80],
    sizeRange: [1.4, 3],
    speedRange: [0.15, 0.4],
    radiusRange: [0.2, 0.44],
    opacity: 0.88,
  },
  rain_streaks: {
    motion: "rain",
    particleCount: 28,
    colors: [0x93c5fd, 0x7dd3fc, 0xbfdbfe],
    sizeRange: [0.8, 1.6],
    speedRange: [0.8, 1.6],
    opacity: 0.5,
  },
  heartbeat_monitor: {
    motion: "heartbeat",
    particleCount: 0,
    colors: [0x4ade80, 0x22c55e],
    sizeRange: [0, 0],
    speedRange: [0, 0],
    opacity: 0.65,
  },
  radar_sweep: {
    motion: "radar",
    particleCount: 0,
    colors: [0x22d3ee, 0x0ea5e9],
    sizeRange: [0, 0],
    speedRange: [0, 0],
    opacity: 0.32,
  },
  binary_cascade: {
    motion: "binary",
    particleCount: 0,
    colors: [0x4ade80, 0x22c55e, 0xbbf7d0],
    sizeRange: [0, 0],
    speedRange: [0, 0],
    opacity: 0.45,
  },
};
