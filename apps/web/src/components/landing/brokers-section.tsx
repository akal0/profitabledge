"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";

const LANDING_ACCENT_TEXT_STYLE = {
  backgroundImage:
    "linear-gradient(90deg, #00c2ff 0%, #ffffff 49%, #ffffff 57%, #fef427 100%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
  color: "transparent",
} as const;

type Broker = {
  name: string;
  icon: string;
};

const BROKERS: Broker[] = [
  { name: "Tradovate", icon: "/brokers/tradovate.png" },
  { name: "cTrader", icon: "/brokers/ctrader.svg" },
  { name: "Robinhood", icon: "/brokers/robinhood.svg" },
  { name: "NinjaTrader", icon: "/brokers/ninjatrader.svg" },
  { name: "MetaTrader 5", icon: "/brokers/mt5.png" },
  { name: "FTMO", icon: "/brokers/FTMO.png" },
  { name: "Profitabledge", icon: "/brokers/pe.svg" },
  { name: "cTrader 2", icon: "/brokers/ctrader.svg" },
];

const CENTER_RING_RADII = [130, 195, 260]; // inner, mid, outer
const SAT_RING_RADII = [90, 140, 190]; // smaller satellite rings
const ICON_SIZE = 48;
const CENTER_ORBIT_SPEED = 16; // degrees/second
const SATELLITE_ORBIT_SPEED = 12; // degrees/second
const ORBIT_ANGLE_STEP = 4;

const SYSTEM_OFFSETS = [
  { dx: -400, dy: 0 }, // left
  { dx: 0, dy: 0 }, // center
  { dx: 400, dy: 0 }, // right
];

function getRingRadii(sysIdx: number): number[] {
  return sysIdx === 1 ? CENTER_RING_RADII : SAT_RING_RADII;
}

function getOrbitAngularSpeed(sysIdx: number): number {
  return sysIdx === 1 ? CENTER_ORBIT_SPEED : SATELLITE_ORBIT_SPEED;
}

// Satellite ring progression: outer → mid → inner → mid → outer
const SAT_RING_SEQ = [2, 1, 0, 1, 2];
const DEG_PER_SAT_STEP = 120;

// Initial placement: spread across center rings to avoid overlap
// 3 outer (can transfer), 3 mid, 2 inner
const BROKER_INIT = [
  { ringIndex: 2, angle: 20 },
  { ringIndex: 2, angle: 140 },
  { ringIndex: 2, angle: 260 },
  { ringIndex: 1, angle: 70 },
  { ringIndex: 1, angle: 190 },
  { ringIndex: 1, angle: 310 },
  { ringIndex: 0, angle: 110 },
  { ringIndex: 0, angle: 290 },
];

// Ghost brokers: faded/blurred duplicates across all systems
type GhostDef = {
  sysIdx: number;
  ringIdx: number;
  angle: number;
  speed: number;
  brokerIdx: number;
  opacity: number;
  blur: number;
  size: number;
};

const GHOST_DEFS: GhostDef[] = [
  // Left satellite
  {
    sysIdx: 0,
    ringIdx: 2,
    angle: 30,
    speed: 11,
    brokerIdx: 0,
    opacity: 0.35,
    blur: 1.5,
    size: ICON_SIZE,
  },
  {
    sysIdx: 0,
    ringIdx: 2,
    angle: 190,
    speed: 13,
    brokerIdx: 4,
    opacity: 0.3,
    blur: 1.5,
    size: ICON_SIZE,
  },
  {
    sysIdx: 0,
    ringIdx: 1,
    angle: 120,
    speed: 15,
    brokerIdx: 2,
    opacity: 0.25,
    blur: 2,
    size: ICON_SIZE,
  },
  {
    sysIdx: 0,
    ringIdx: 0,
    angle: 270,
    speed: 18,
    brokerIdx: 6,
    opacity: 0.2,
    blur: 2,
    size: ICON_SIZE,
  },
  // Right satellite
  {
    sysIdx: 2,
    ringIdx: 2,
    angle: 70,
    speed: 12,
    brokerIdx: 1,
    opacity: 0.35,
    blur: 1.5,
    size: ICON_SIZE,
  },
  {
    sysIdx: 2,
    ringIdx: 2,
    angle: 240,
    speed: 10,
    brokerIdx: 5,
    opacity: 0.3,
    blur: 1.5,
    size: ICON_SIZE,
  },
  {
    sysIdx: 2,
    ringIdx: 1,
    angle: 170,
    speed: 14,
    brokerIdx: 3,
    opacity: 0.25,
    blur: 2,
    size: ICON_SIZE,
  },
  {
    sysIdx: 2,
    ringIdx: 0,
    angle: 320,
    speed: 17,
    brokerIdx: 7,
    opacity: 0.2,
    blur: 2,
    size: ICON_SIZE,
  },
  // Center extras (between real brokers)
  {
    sysIdx: 1,
    ringIdx: 2,
    angle: 80,
    speed: 14,
    brokerIdx: 3,
    opacity: 0.15,
    blur: 2,
    size: ICON_SIZE,
  },
  {
    sysIdx: 1,
    ringIdx: 2,
    angle: 200,
    speed: 15,
    brokerIdx: 5,
    opacity: 0.15,
    blur: 2,
    size: ICON_SIZE,
  },
  {
    sysIdx: 1,
    ringIdx: 1,
    angle: 130,
    speed: 13,
    brokerIdx: 7,
    opacity: 0.12,
    blur: 2,
    size: ICON_SIZE,
  },
  {
    sysIdx: 1,
    ringIdx: 0,
    angle: 200,
    speed: 17,
    brokerIdx: 1,
    opacity: 0.12,
    blur: 2,
    size: ICON_SIZE,
  },
];

type BrokerState = {
  systemIndex: number;
  ringIndex: number;
  angle: number;
  transitioning: boolean;
  transitionProgress: number;
  transitionSpeed: number;
  fromX: number;
  fromY: number;
  toSystemIndex: number;
  toRingIndex: number;
  toAngle: number;
  onSatellite: boolean;
  satStep: number;
  angleOnRing: number;
  cooldown: number;
};

type GhostState = {
  sysIdx: number;
  ringIdx: number;
  angle: number;
  speed: number;
  brokerIdx: number;
  opacity: number;
  blur: number;
  size: number;
};

function normalizeAngle(angle: number) {
  const normalized = angle % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function getAngularDistance(a: number, b: number) {
  const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return diff > 180 ? 360 - diff : diff;
}

function getMinOrbitSpacing(sysIdx: number, ringIdx: number) {
  const radius = getRingRadii(sysIdx)[ringIdx];
  return Math.max(24, ((ICON_SIZE * 1.9) / radius) * (180 / Math.PI));
}

function findAvailableOrbitAngle({
  desiredAngle,
  targetSystemIndex,
  targetRingIndex,
  currentBrokerIndex,
  states,
  ghosts,
}: {
  desiredAngle: number;
  targetSystemIndex: number;
  targetRingIndex: number;
  currentBrokerIndex: number;
  states: BrokerState[];
  ghosts: GhostState[];
}) {
  const occupiedAngles: number[] = [];

  for (let i = 0; i < states.length; i++) {
    if (i === currentBrokerIndex) continue;
    const state = states[i];
    const matchesTarget = state.transitioning
      ? state.toSystemIndex === targetSystemIndex &&
        state.toRingIndex === targetRingIndex
      : state.systemIndex === targetSystemIndex &&
        state.ringIndex === targetRingIndex;

    if (!matchesTarget) continue;
    occupiedAngles.push(
      normalizeAngle(state.transitioning ? state.toAngle : state.angle)
    );
  }

  for (const ghost of ghosts) {
    if (
      ghost.sysIdx === targetSystemIndex &&
      ghost.ringIdx === targetRingIndex
    ) {
      occupiedAngles.push(normalizeAngle(ghost.angle));
    }
  }

  const minSpacing = getMinOrbitSpacing(targetSystemIndex, targetRingIndex);
  const isAngleSafe = (angle: number) =>
    occupiedAngles.every(
      (occupiedAngle) => getAngularDistance(angle, occupiedAngle) >= minSpacing
    );

  const normalizedDesiredAngle = normalizeAngle(desiredAngle);
  if (isAngleSafe(normalizedDesiredAngle)) {
    return normalizedDesiredAngle;
  }

  for (let offset = ORBIT_ANGLE_STEP; offset <= 180; offset += ORBIT_ANGLE_STEP) {
    const forward = normalizeAngle(normalizedDesiredAngle + offset);
    if (isAngleSafe(forward)) {
      return forward;
    }

    const backward = normalizeAngle(normalizedDesiredAngle - offset);
    if (isAngleSafe(backward)) {
      return backward;
    }
  }

  return null;
}

function getAbsPos(
  cx: number,
  cy: number,
  sysIdx: number,
  ringIdx: number,
  angleDeg: number
) {
  const sys = SYSTEM_OFFSETS[sysIdx];
  const rad = (angleDeg * Math.PI) / 180;
  const radii = getRingRadii(sysIdx);
  const r = radii[ringIdx];
  return {
    x: cx + sys.dx + Math.cos(rad) * r,
    y: cy + sys.dy + Math.sin(rad) * r,
  };
}

function easeInOut(p: number): number {
  return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
}

function OrbitalVisualization() {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef(0);
  const lastFrameRef = useRef(0);

  const statesRef = useRef<BrokerState[]>(
    BROKERS.map((_, i) => ({
      systemIndex: 1,
      ringIndex: BROKER_INIT[i].ringIndex,
      angle: BROKER_INIT[i].angle,
      transitioning: false,
      transitionProgress: 0,
      transitionSpeed: 1.5,
      fromX: 0,
      fromY: 0,
      toSystemIndex: 1,
      toRingIndex: 2,
      toAngle: 0,
      onSatellite: false,
      satStep: 0,
      angleOnRing: 0,
      cooldown: 4 + i * 2,
    }))
  );

  const ghostsRef = useRef<GhostState[]>(GHOST_DEFS.map((d) => ({ ...d })));

  const [positions, setPositions] = useState<{ x: number; y: number }[]>([]);
  const [ghostPositions, setGhostPositions] = useState<
    {
      x: number;
      y: number;
      brokerIdx: number;
      opacity: number;
      blur: number;
      size: number;
      sysIdx: number;
    }[]
  >([]);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  const animate = useCallback((now: number) => {
    const container = containerRef.current;
    if (!container) {
      animRef.current = requestAnimationFrame(animate);
      return;
    }

    const dt = Math.min((now - lastFrameRef.current) / 1000, 0.05);
    lastFrameRef.current = now;

    const rect = container.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const states = statesRef.current;
    const ghosts = ghostsRef.current;
    const newPos: { x: number; y: number }[] = [];

    for (let i = 0; i < BROKERS.length; i++) {
      const s = states[i];
      s.cooldown = Math.max(0, s.cooldown - dt);

      if (s.transitioning) {
        s.transitionProgress += dt * s.transitionSpeed;
        if (s.transitionProgress >= 1) {
          s.transitioning = false;
          s.systemIndex = s.toSystemIndex;
          s.ringIndex = s.toRingIndex;
          s.angle = normalizeAngle(s.toAngle);
          s.angleOnRing = 0;
          s.cooldown = 1;
        }

        const t = easeInOut(Math.min(s.transitionProgress, 1));
        const targetOrbitSpeed = getOrbitAngularSpeed(s.toSystemIndex);
        const extraAngle =
          targetOrbitSpeed * (s.transitionProgress / s.transitionSpeed);
        const toP = getAbsPos(
          cx,
          cy,
          s.toSystemIndex,
          s.toRingIndex,
          s.toAngle + extraAngle
        );
        newPos.push({
          x: s.fromX + (toP.x - s.fromX) * t,
          y: s.fromY + (toP.y - s.fromY) * t,
        });
      } else {
        const orbitSpeed = getOrbitAngularSpeed(s.systemIndex);
        const angleDelta = orbitSpeed * dt;
        s.angle = normalizeAngle(s.angle + angleDelta);
        s.angleOnRing += angleDelta;
        const pos = getAbsPos(cx, cy, s.systemIndex, s.ringIndex, s.angle);

        if (s.cooldown <= 0) {
          // Only outer ring brokers on center can transfer
          if (s.systemIndex === 1 && s.ringIndex === 2 && !s.onSatellite) {
            // Max 2 on satellites at once
            const onSats = states.filter((st) => st.onSatellite).length;
            if (onSats < 2) {
              let targetSys = -1;
              if (s.angle > 170 && s.angle < 190) targetSys = 0;
              else if (s.angle > 350 || s.angle < 10) targetSys = 2;

              if (targetSys >= 0) {
                const tCx = cx + SYSTEM_OFFSETS[targetSys].dx;
                const tCy = cy + SYSTEM_OFFSETS[targetSys].dy;
                const entryAngle =
                  normalizeAngle(
                    (Math.atan2(pos.y - tCy, pos.x - tCx) * 180) / Math.PI
                  );
                const safeAngle = findAvailableOrbitAngle({
                  desiredAngle: entryAngle,
                  targetSystemIndex: targetSys,
                  targetRingIndex: 2,
                  currentBrokerIndex: i,
                  states,
                  ghosts,
                });

                if (safeAngle === null) {
                  newPos.push(pos);
                  continue;
                }

                s.transitioning = true;
                s.transitionProgress = 0;
                s.transitionSpeed = 1.5;
                s.fromX = pos.x;
                s.fromY = pos.y;
                s.toSystemIndex = targetSys;
                s.toRingIndex = 2;
                s.toAngle = safeAngle;
                s.onSatellite = true;
                s.satStep = 0;
                s.angleOnRing = 0;
              }
            }
          } else if (s.onSatellite) {
            if (
              s.satStep < SAT_RING_SEQ.length - 1 &&
              s.angleOnRing >= DEG_PER_SAT_STEP
            ) {
              s.satStep++;
              const nextRing = SAT_RING_SEQ[s.satStep];
              const safeAngle = findAvailableOrbitAngle({
                desiredAngle: s.angle,
                targetSystemIndex: s.systemIndex,
                targetRingIndex: nextRing,
                currentBrokerIndex: i,
                states,
                ghosts,
              });

              if (safeAngle === null) {
                s.satStep--;
                newPos.push(pos);
                continue;
              }

              s.transitioning = true;
              s.transitionProgress = 0;
              s.transitionSpeed = 0.8;
              s.fromX = pos.x;
              s.fromY = pos.y;
              s.toSystemIndex = s.systemIndex;
              s.toRingIndex = nextRing;
              s.toAngle = safeAngle;
            } else if (
              s.satStep >= SAT_RING_SEQ.length - 1 &&
              s.ringIndex === 2
            ) {
              const returnAngle = s.systemIndex === 0 ? 0 : 180;
              let diff = Math.abs(s.angle - returnAngle);
              if (diff > 180) diff = 360 - diff;

              if (diff < 20) {
                const cCx = cx + SYSTEM_OFFSETS[1].dx;
                const cCy = cy + SYSTEM_OFFSETS[1].dy;
                const entryAngle =
                  normalizeAngle(
                    (Math.atan2(pos.y - cCy, pos.x - cCx) * 180) / Math.PI
                  );
                const safeAngle = findAvailableOrbitAngle({
                  desiredAngle: entryAngle,
                  targetSystemIndex: 1,
                  targetRingIndex: 2,
                  currentBrokerIndex: i,
                  states,
                  ghosts,
                });

                if (safeAngle === null) {
                  newPos.push(pos);
                  continue;
                }

                s.transitioning = true;
                s.transitionProgress = 0;
                s.transitionSpeed = 1.5;
                s.fromX = pos.x;
                s.fromY = pos.y;
                s.toSystemIndex = 1;
                s.toRingIndex = 2;
                s.toAngle = safeAngle;
                s.onSatellite = false;
                s.satStep = 0;
                s.angleOnRing = 0;
                s.cooldown = 8 + Math.random() * 4;
              }
            }
          }
        }

        newPos.push(pos);
      }
    }

    // Ghost brokers — simple continuous orbiting
    const newGhostPos: typeof ghostPositions = [];
    for (const g of ghosts) {
      g.speed = getOrbitAngularSpeed(g.sysIdx);
      g.angle = normalizeAngle(g.angle + g.speed * dt);
      const pos = getAbsPos(cx, cy, g.sysIdx, g.ringIdx, g.angle);
      newGhostPos.push({
        x: pos.x,
        y: pos.y,
        brokerIdx: g.brokerIdx,
        opacity: g.opacity,
        blur: g.blur,
        size: g.size,
        sysIdx: g.sysIdx,
      });
    }

    setPositions(newPos);
    setGhostPositions(newGhostPos);
    setContainerSize({ w: rect.width, h: rect.height });
    animRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    lastFrameRef.current = performance.now();
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [animate]);

  const cx = containerSize.w / 2;
  const cy = containerSize.h / 2;
  const outerR = CENTER_RING_RADII[2];

  return (
    <div ref={containerRef} className="relative h-full w-full">
      {/* 1. Satellite system rings + glows (rendered first, behind everything) */}
      {SYSTEM_OFFSETS.map((sys, si) => {
        if (si === 1) return null; // center rendered separately
        const radii = getRingRadii(si);
        return (
          <div key={si}>
            <div
              className="absolute rounded-full blur-3xl"
              style={{
                width: 140,
                height: 140,
                left: cx + sys.dx - 70,
                top: cy + sys.dy - 70,
                opacity: 0.15,
                background:
                  si === 0
                    ? "radial-gradient(circle, rgba(200,100,50,0.4) 0%, transparent 70%)"
                    : "radial-gradient(circle, rgba(50,100,200,0.4) 0%, transparent 70%)",
              }}
            />
            {radii.map((r, ri) => (
              <div
                key={ri}
                className="absolute rounded-full border border-white/[0.06]"
                style={{
                  width: r * 2,
                  height: r * 2,
                  left: cx + sys.dx - r,
                  top: cy + sys.dy - r,
                }}
              />
            ))}
          </div>
        );
      })}

      {/* 2. Center outer mask — hides satellite edges + brokers inside center area */}
      <div
        className="absolute rounded-full"
        style={{
          width: outerR * 2,
          height: outerR * 2,
          left: cx - outerR,
          top: cy - outerR,
          zIndex: 10,
          background:
            "radial-gradient(circle, #000 0%, #000 88%, rgba(0,0,0,0.85) 95%, transparent 100%)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      />

      {/* 3. Center system rings + glow (on top of mask) */}
      <div
        className="absolute rounded-full blur-3xl"
        style={{
          width: 200,
          height: 200,
          left: cx - 100,
          top: cy - 100,
          zIndex: 11,
          opacity: 0.3,
          background:
            "radial-gradient(circle, rgba(0,194,255,0.3) 0%, rgba(254,244,39,0.08) 50%, transparent 70%)",
        }}
      />
      {CENTER_RING_RADII.map((r, ri) => (
        <div
          key={`center-ring-${ri}`}
          className="absolute rounded-full border border-white/[0.06]"
          style={{
            width: r * 2,
            height: r * 2,
            left: cx - r,
            top: cy - r,
            zIndex: 11,
          }}
        />
      ))}

      {/* 4. Ghost brokers — same design as real, just blurred */}
      {ghostPositions.map((gp, i) => (
        <div
          key={`ghost-${i}`}
          className="absolute flex items-center justify-center rounded-full bg-[#1a1a1e]/10 backdrop-blur-2xl ring-1 ring-white/10 shadow-lg shadow-black/50"
          style={{
            width: gp.size,
            height: gp.size,
            left: gp.x - gp.size / 2,
            top: gp.y - gp.size / 2,
            opacity: gp.opacity,
            filter: `blur(${gp.blur}px)`,
            zIndex: gp.sysIdx === 1 ? 12 : 1,
          }}
        >
          <Image
            src={BROKERS[gp.brokerIdx].icon}
            alt=""
            width={28}
            height={28}
            className="rounded-full object-contain"
            unoptimized
          />
        </div>
      ))}

      {/* 5. Center sphere */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left: cx, top: cy, zIndex: 15 }}
      >
        <div
          className="absolute -inset-12 rounded-full opacity-40 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(0,194,255,0.25) 0%, rgba(254,244,39,0.08) 40%, transparent 70%)",
          }}
        />
        <div
          className="group relative flex size-[160px] cursor-pointer items-center justify-center overflow-hidden rounded-full border border-white/[0.08] transition-[filter,transform,box-shadow] duration-300 ease-out hover:brightness-110 "
          style={{
            background:
              "radial-gradient(circle at 40% 35%, rgba(0,194,255,0.15) 0%, rgba(45,212,191,0.08) 30%, rgba(17,17,17,0.9) 70%)",
          }}
        >
          <Image
            src="/assets/lights.svg"
            alt=""
            fill
            className="pointer-events-none scale-[1.55] object-cover opacity-95 transition-[opacity,transform,filter] duration-300 ease-out group-hover:scale-[1.62] group-hover:opacity-100 group-hover:brightness-105"
            unoptimized
          />
          <Image
            src="/assets/noise.png"
            alt=""
            fill
            className="pointer-events-none object-cover opacity-35 mix-blend-soft-light transition-opacity duration-300 ease-out group-hover:opacity-35"
            unoptimized
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_35%,rgba(0,194,255,0.12),rgba(45,212,191,0.06)_30%,rgba(17,17,17,0.24)_70%,rgba(17,17,17,0.48)_100%)] transition-opacity duration-300 ease-out group-hover:opacity-80" />
          <span className="relative z-[1] text-xs font-semibold text-white/70 transition-colors duration-300 ease-out group-hover:text-white/80">
            View all brokers
          </span>
        </div>
      </div>

      {/* 6. Real broker icons */}
      {positions.map((pos, i) => {
        const s = statesRef.current[i];
        // If transitioning, use destination to determine layer
        const inFront = s
          ? s.transitioning
            ? s.toSystemIndex === 1
            : s.systemIndex === 1
          : true;
        return (
          <div
            key={i}
            className="absolute flex items-center justify-center rounded-full bg-[#1a1a1e]/10 backdrop-blur-2xl ring-1 ring-white/10 shadow-lg shadow-black/50"
            style={{
              width: ICON_SIZE,
              height: ICON_SIZE,
              left: pos.x - ICON_SIZE / 2,
              top: pos.y - ICON_SIZE / 2,
              willChange: "transform",
              zIndex: inFront ? 13 : 1,
            }}
          >
            <Image
              src={BROKERS[i].icon}
              alt={BROKERS[i].name}
              width={28}
              height={28}
              className="rounded-full object-contain"
              unoptimized
            />
          </div>
        );
      })}
    </div>
  );
}

export function BrokersSection() {
  return (
    <section className="relative w-full px-6 py-24 md:px-8 lg:px-12 xl:px-16 2xl:px-20 3xl:px-28">
      {/* Header */}
      <div className="mb-16 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div>
          <p
            className="mb-4 inline-block text-sm font-medium text-transparent"
            style={LANDING_ACCENT_TEXT_STYLE}
          >
            Brokers & integrations
          </p>
          <h2
            className="max-w-lg text-3xl font-semibold leading-[1.15] tracking-[-0.03em] sm:text-4xl md:text-5xl"
            style={{
              backgroundImage:
                "linear-gradient(180deg, #fff 0%, rgba(255,255,255,0.7) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Connect your broker,
            <br />
            and let the data flow.
          </h2>
        </div>

        <p className="max-w-md text-sm leading-relaxed text-white/40 md:pt-8">
          We&apos;ve taken the grunt work out of journaling. Just sync your
          account once, and your trades show up like magic — ready to review,
          analyze, and learn from. No mess, no hassle, just smooth, automated
          tracking.
        </p>
      </div>

      {/* Orbital visualization */}
      <div className="relative overflow-hidden" style={{ height: 650 }}>
        <OrbitalVisualization />

        {/* Edge fades */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-black to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-black to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black to-transparent" />
      </div>
    </section>
  );
}
