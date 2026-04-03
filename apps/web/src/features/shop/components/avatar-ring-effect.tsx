"use client";

import { motion, useReducedMotion } from "framer-motion";

import { CanvasFlameArc } from "@/features/shop/components/canvas-flame-arc";
import { CanvasFrostShards } from "@/features/shop/components/canvas-frost-shards";
import { CanvasLightningRing } from "@/features/shop/components/canvas-lightning-ring";
import { CanvasPlasmaRing } from "@/features/shop/components/canvas-plasma-ring";
import { CanvasSolarFlare } from "@/features/shop/components/canvas-solar-flare";
import { CanvasVoidRift } from "@/features/shop/components/canvas-void-rift";
import { cn } from "@/lib/utils";

export const ADVANCED_AVATAR_RING_EFFECTS = [
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
] as const;

const LEGACY_EFFECT_VARIANT_MAP: Record<string, (typeof ADVANCED_AVATAR_RING_EFFECTS)[number]> = {
  fire_ring: "flame_arc",
  ice_crystals: "frost_shards",
  frost_aura: "frost_shards",
  electric_spark: "lightning_ring_v2",
  lightning_ring: "lightning_ring_v2",
  shadow_pulse: "void_rift",
  moon_glow: "solar_flare",
  gold_glow: "solar_flare",
  neon_pulse: "plasma_ring",
  neon_pulse_pink: "plasma_ring",
  neon_pulse_blue: "plasma_ring",
  bull_ring: "plasma_ring",
  bear_ring: "flame_arc",
  diamond_hands: "frost_shards",
};

export function hasAdvancedAvatarRingEffect(effect?: string | null) {
  const resolved = effect ? LEGACY_EFFECT_VARIANT_MAP[effect] ?? effect : effect;
  return Boolean(
    resolved && ADVANCED_AVATAR_RING_EFFECTS.includes(resolved as (typeof ADVANCED_AVATAR_RING_EFFECTS)[number])
  );
}

type AvatarRingEffectProps = {
  effect?: string | null;
  compact?: boolean;
  animate?: boolean;
};

function getGradientForEffect(effect: string) {
  switch (effect) {
    case "gradient_spin_fire":
      return "conic-gradient(from 0deg, #fb923c, #ef4444, #fbbf24, #fb923c)";
    case "gradient_spin_ocean":
      return "conic-gradient(from 0deg, #22d3ee, #0ea5e9, #818cf8, #22d3ee)";
    case "gradient_spin_toxic":
      return "conic-gradient(from 0deg, #bef264, #4ade80, #22d3ee, #bef264)";
    default:
      return "conic-gradient(from 0deg, #22d3ee, #818cf8, #f472b6, #22d3ee)";
  }
}

function polarToCartesian(center: number, radius: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return {
    x: center + radius * Math.cos(rad),
    y: center + radius * Math.sin(rad),
  };
}

function describeArc(center: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(center, radius, endAngle);
  const end = polarToCartesian(center, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

function RingShell({ children }: { children: React.ReactNode }) {
  return <div className="pointer-events-none absolute inset-[-14%]">{children}</div>;
}

export function AvatarRingEffect({ effect, compact = false, animate = true }: AvatarRingEffectProps) {
  const reduceMotion = useReducedMotion();
  const resolvedEffect = effect ? LEGACY_EFFECT_VARIANT_MAP[effect] ?? effect : effect;
  if (!resolvedEffect || !hasAdvancedAvatarRingEffect(resolvedEffect)) {
    return null;
  }

  const strokeWidth = compact ? 3 : 4;
  const viewBox = 100;

  if (resolvedEffect.startsWith("gradient_spin_")) {
    return (
      <RingShell>
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: getGradientForEffect(resolvedEffect),
            WebkitMask:
              "radial-gradient(farthest-side, transparent calc(100% - 9px), black calc(100% - 7px))",
            mask: "radial-gradient(farthest-side, transparent calc(100% - 9px), black calc(100% - 7px))",
            filter: "drop-shadow(0 0 10px rgba(255,255,255,0.12))",
          }}
          animate={!animate || reduceMotion ? undefined : { rotate: 360 }}
          transition={{ duration: 3.6, ease: "linear", repeat: Infinity }}
        />
      </RingShell>
    );
  }

  if (resolvedEffect === "multi_ring") {
    return (
      <RingShell>
        {[0, 1, 2].map((index) => (
          <motion.div
            key={index}
            className="absolute rounded-full border border-cyan-300/70"
            style={{
              inset: `${8 + index * 6}%`,
              boxShadow: "0 0 12px rgba(34,211,238,0.22)",
            }}
            animate={
              reduceMotion || !animate
                ? undefined
                : { scale: [1, 1.08, 1], opacity: [0.26, 0.65, 0.26] }
            }
            transition={{
              duration: 2.2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: index * 0.22,
            }}
          />
        ))}
      </RingShell>
    );
  }

  if (resolvedEffect === "lightning_ring_v2") {
    return (
      <RingShell>
        <CanvasLightningRing
          compact={compact}
          color="#67e8f9"
          secondaryColor="#ffffff"
          className={animate ? undefined : "opacity-0"}
        />
      </RingShell>
    );
  }

  if (resolvedEffect === "flame_arc") {
    return (
      <RingShell>
        <CanvasFlameArc
          compact={compact}
          color="#fb923c"
          secondaryColor="#fbbf24"
          className={animate ? undefined : "opacity-0"}
        />
      </RingShell>
    );
  }

  if (resolvedEffect === "plasma_ring") {
    return (
      <RingShell>
        <CanvasPlasmaRing
          compact={compact}
          color="#a855f7"
          secondaryColor="#e879f9"
          className={animate ? undefined : "opacity-0"}
        />
      </RingShell>
    );
  }

  if (resolvedEffect === "frost_shards") {
    return (
      <RingShell>
        <CanvasFrostShards
          compact={compact}
          color="#7dd3fc"
          secondaryColor="#e0f2fe"
          className={animate ? undefined : "opacity-0"}
        />
      </RingShell>
    );
  }

  if (resolvedEffect === "void_rift") {
    return (
      <RingShell>
        <CanvasVoidRift
          compact={compact}
          color="#7c3aed"
          secondaryColor="#c084fc"
          className={animate ? undefined : "opacity-0"}
        />
      </RingShell>
    );
  }

  if (resolvedEffect === "solar_flare") {
    return (
      <RingShell>
        <CanvasSolarFlare
          compact={compact}
          color="#fbbf24"
          secondaryColor="#fef3c7"
          className={animate ? undefined : "opacity-0"}
        />
      </RingShell>
    );
  }

  return (
    <RingShell>
      <svg viewBox={`0 0 ${viewBox} ${viewBox}`} className="absolute inset-0 h-full w-full">
        {resolvedEffect === "stroke_draw_single" ? (
          <motion.g
            animate={!animate || reduceMotion ? undefined : { rotate: 360 }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "50% 50%" }}
          >
            <path
              d={describeArc(50, 42, -38, 38)}
              fill="none"
              stroke="#22d3ee"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              style={{ filter: "drop-shadow(0 0 8px rgba(34,211,238,0.5))" }}
            />
          </motion.g>
        ) : null}

        {resolvedEffect === "stroke_draw_double" ? (
          <>
            <motion.g
              animate={!animate || reduceMotion ? undefined : { rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              style={{ transformOrigin: "50% 50%" }}
            >
              <path
                d={describeArc(50, 41, -34, 14)}
                fill="none"
                stroke="#818cf8"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                style={{ filter: "drop-shadow(0 0 8px rgba(129,140,248,0.45))" }}
              />
              <path
                d={describeArc(50, 41, 146, 194)}
                fill="none"
                stroke="#818cf8"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                style={{ filter: "drop-shadow(0 0 8px rgba(129,140,248,0.45))" }}
              />
            </motion.g>
            <motion.g
              animate={!animate || reduceMotion ? undefined : { rotate: -360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              style={{ transformOrigin: "50% 50%" }}
            >
              <path
                d={describeArc(50, 34, 56, 96)}
                fill="none"
                stroke="#f472b6"
                strokeWidth={strokeWidth - 1}
                strokeLinecap="round"
                style={{ filter: "drop-shadow(0 0 8px rgba(244,114,182,0.4))" }}
              />
              <path
                d={describeArc(50, 34, 236, 276)}
                fill="none"
                stroke="#f472b6"
                strokeWidth={strokeWidth - 1}
                strokeLinecap="round"
                style={{ filter: "drop-shadow(0 0 8px rgba(244,114,182,0.4))" }}
              />
            </motion.g>
          </>
        ) : null}

        {resolvedEffect === "stroke_draw_dotted" ? (
          <motion.g
            animate={!animate || reduceMotion ? undefined : { rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "50% 50%" }}
          >
            {[0, 120, 240].map((offset) => (
              <path
                key={offset}
                d={describeArc(50, 41, offset - 22, offset + 22)}
                fill="none"
                stroke="#fbbf24"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray="2 6"
                style={{ filter: "drop-shadow(0 0 8px rgba(251,191,36,0.4))" }}
              />
            ))}
          </motion.g>
        ) : null}

        {resolvedEffect === "energy_flow" ? (
          <>
            {[0, 120, 240].map((offset) => (
              <path
                key={`base-${offset}`}
                d={describeArc(50, 41, offset - 24, offset + 24)}
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
            ))}
            <motion.g
              animate={!animate || reduceMotion ? undefined : { rotate: 360 }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
              style={{ transformOrigin: "50% 50%" }}
            >
              {[0, 120, 240].map((offset) => (
                <path
                  key={`flow-${offset}`}
                  d={describeArc(50, 41, offset - 18, offset + 18)}
                  fill="none"
                  stroke="#4ade80"
                  strokeWidth={strokeWidth}
                  strokeDasharray="10 8"
                  strokeLinecap="round"
                  style={{ filter: "drop-shadow(0 0 10px rgba(74,222,128,0.5))" }}
                />
              ))}
            </motion.g>
          </>
        ) : null}
      </svg>
    </RingShell>
  );
}
