"use client";

import { memo, useRef } from "react";
import Image from "next/image";
import { useInView, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";

const LANDING_ACCENT_TEXT_STYLE = {
  backgroundImage:
    "radial-gradient(110% 150% at 50% 0%, #ff6b6b 0%, #e9f3eb 94%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
  color: "transparent",
} as const;

type Broker = {
  name: string;
  icon: string;
};

type BrokerLightStyle = {
  lightFilter: string;
  overlay: string;
  ring: string;
  iconClassName?: string;
  iconScale?: number;
  iconSrc?: string;
  lightOpacity?: number;
};

const BROKERS: Broker[] = [
  { name: "Tradovate", icon: "/brokers/tradovate.png" },
  { name: "cTrader", icon: "/brokers/ctrader.svg" },
  { name: "Robinhood", icon: "/brokers/robinhood.svg" },
  { name: "NinjaTrader", icon: "/brokers/ninjatrader.svg" },
  { name: "MetaTrader 5", icon: "/brokers/mt5.png" },
  { name: "FTMO", icon: "/brokers/FTMO.png" },
  { name: "Profitabledge", icon: "/icon.svg" },
  { name: "cTrader 2", icon: "/brokers/ctrader.svg" },
];

const CENTER_RING_RADII = [130, 195, 260]; // inner, mid, outer
const SAT_RING_RADII = [90, 140, 190]; // smaller satellite rings
const ICON_SIZE = 48;
const CENTER_ORBIT_SPEED = 16; // degrees/second

const SYSTEM_OFFSETS = [
  { dx: -400, dy: 0 }, // left
  { dx: 0, dy: 0 }, // center
  { dx: 400, dy: 0 }, // right
];

const DEFAULT_BROKER_LIGHT_STYLE: BrokerLightStyle = {
  lightFilter: "hue-rotate(122deg) saturate(1.16) brightness(1.08)",
  overlay:
    "radial-gradient(circle at 35% 35%, rgba(56,189,248,0.24) 0%, rgba(34,211,238,0.15) 34%, rgba(8,16,22,0.74) 78%)",
  ring: "rgba(56,189,248,0.18)",
};

const BROKER_LIGHT_STYLES: Record<string, BrokerLightStyle> = {
  Tradovate: {
    lightFilter: "hue-rotate(14deg) saturate(1.28) brightness(1.08)",
    overlay:
      "radial-gradient(circle at 36% 34%, rgba(125,211,252,0.3) 0%, rgba(59,130,246,0.18) 38%, rgba(7,14,25,0.74) 80%)",
    ring: "rgba(125,211,252,0.22)",
    iconClassName: "brightness-0 invert",
  },
  cTrader: {
    lightFilter: "hue-rotate(-42deg) saturate(1.28) brightness(1.04)",
    overlay:
      "radial-gradient(circle at 35% 35%, rgba(255,126,126,0.28) 0%, rgba(239,68,68,0.18) 36%, rgba(24,8,8,0.74) 80%)",
    ring: "rgba(255,126,126,0.22)",
  },
  "cTrader 2": {
    lightFilter: "hue-rotate(-42deg) saturate(1.28) brightness(1.04)",
    overlay:
      "radial-gradient(circle at 35% 35%, rgba(255,126,126,0.28) 0%, rgba(239,68,68,0.18) 36%, rgba(24,8,8,0.74) 80%)",
    ring: "rgba(255,126,126,0.22)",
  },
  Robinhood: {
    lightFilter: "hue-rotate(80deg) saturate(1.18) brightness(1.04)",
    overlay:
      "radial-gradient(circle at 35% 35%, rgba(93,255,140,0.24) 0%, rgba(52,211,153,0.14) 34%, rgba(9,20,13,0.74) 78%)",
    ring: "rgba(93,255,140,0.18)",
    iconScale: 0.96,
  },
  NinjaTrader: {
    lightFilter: "hue-rotate(-80deg) saturate(3) brightness(1.0) sepia(0.3)",
    overlay:
      "radial-gradient(circle at 35% 35%, rgba(244,71,12,0.35) 0%, rgba(200,55,8,0.24) 34%, rgba(24,12,4,0.75) 78%)",
    ring: "rgba(244,71,12,0.26)",
    iconScale: 0.9,
    lightOpacity: 0.55,
  },
  "MetaTrader 5": {
    lightFilter: "none",
    overlay:
      "radial-gradient(circle at 35% 35%, rgba(0,194,255,0.2) 0%, rgba(45,212,191,0.12) 38%, rgba(8,16,22,0.68) 80%)",
    ring: "rgba(255,255,255,0.12)",
  },
  FTMO: {
    lightFilter: "grayscale(0.72) saturate(0.58) brightness(0.98)",
    overlay:
      "radial-gradient(circle at 35% 35%, rgba(228,228,231,0.18) 0%, rgba(113,113,122,0.12) 36%, rgba(12,12,16,0.82) 80%)",
    ring: "rgba(212,212,216,0.16)",
    iconScale: 0.92,
  },
  Profitabledge: {
    lightFilter: "hue-rotate(108deg) saturate(0.8) brightness(0.72)",
    overlay:
      "radial-gradient(circle at 35% 35%, rgba(34,211,238,0.16) 0%, rgba(8,47,73,0.18) 34%, rgba(5,10,18,0.88) 82%)",
    ring: "rgba(56,189,248,0.14)",
    iconScale: 0.88,
    iconSrc: "/icon.svg",
  },
};

const BROKER_ARC_RGB: Record<string, string> = {
  Tradovate: "125,211,252",
  cTrader: "255,90,90",
  "cTrader 2": "255,90,90",
  Robinhood: "93,255,140",
  NinjaTrader: "244,120,40",
  "MetaTrader 5": "180,200,255",
  FTMO: "161,161,170",
  Profitabledge: "34,211,238",
};

const CIRCLE_REVEAL_VARIANTS = {
  hidden: { opacity: 0, scale: 0.92, filter: "blur(18px)" },
  visible: {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      duration: 2.2,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
};

const BrokerOrbitalIcon = memo(function BrokerOrbitalIcon({
  broker,
  ghost = false,
}: {
  broker: Broker;
  ghost?: boolean;
}) {
  const light = BROKER_LIGHT_STYLES[broker.name] ?? DEFAULT_BROKER_LIGHT_STYLE;
  const surfaceStyle = {
    backgroundColor: "rgba(26,26,30,0.18)",
    backgroundImage: `${light.overlay}, url('/assets/lights.svg'), url('/assets/noise.png')`,
    backgroundPosition: "center, center, center",
    backgroundRepeat: "no-repeat, no-repeat, repeat",
    backgroundSize: "cover, 168% 168%, 140px 140px",
    backgroundBlendMode: "normal, screen, soft-light",
    boxShadow: `inset 0 0 0 1px ${light.ring}`,
    opacity: ghost ? 0.66 : light.lightOpacity ?? 1,
  } as const;

  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 rounded-full"
        style={surfaceStyle}
      />
      <Image
        src={light.iconSrc ?? broker.icon}
        alt={broker.name}
        width={28}
        height={28}
        className={`relative z-[4] rounded-full object-contain ${
          light.iconClassName ?? ""
        }`}
        style={{
          transform: `scale(${light.iconScale ?? 1})`,
        }}
        unoptimized
      />
    </>
  );
});

function getRingRadii(sysIdx: number): number[] {
  return sysIdx === 1 ? CENTER_RING_RADII : SAT_RING_RADII;
}

// Independent ghost brokers — satellites only (no center ghosts)
const STATIC_GHOSTS = [
  { sysIdx: 0, ringIdx: 2, angle: 30, speed: 11, brokerIdx: 0 }, // Tradovate
  { sysIdx: 0, ringIdx: 1, angle: 160, speed: 14, brokerIdx: 1 }, // cTrader
  { sysIdx: 0, ringIdx: 0, angle: 270, speed: 17, brokerIdx: 2 }, // Robinhood
  { sysIdx: 2, ringIdx: 2, angle: 70, speed: 12, brokerIdx: 3 }, // NinjaTrader
  { sysIdx: 2, ringIdx: 1, angle: 200, speed: 15, brokerIdx: 4 }, // MetaTrader 5
  { sysIdx: 2, ringIdx: 0, angle: 320, speed: 18, brokerIdx: 5 }, // FTMO
];

// Initial placement: staggered across center rings to avoid visual overlap
// 3 outer (120deg apart), 3 mid (120deg apart, offset 60deg), 2 inner (180deg apart)
const BROKER_INIT = [
  { ringIndex: 2, angle: 0 },
  { ringIndex: 2, angle: 120 },
  { ringIndex: 2, angle: 240 },
  { ringIndex: 1, angle: 60 },
  { ringIndex: 1, angle: 180 },
  { ringIndex: 1, angle: 300 },
  { ringIndex: 0, angle: 90 },
  { ringIndex: 0, angle: 270 },
];

function getOrbitDuration(speed: number) {
  return 360 / speed;
}

function getOrbitArcPath(radius: number) {
  const center = radius;
  const arcSpan = 40;
  const gapDeg = ((ICON_SIZE * 0.72) / radius) * (180 / Math.PI);
  const toPoint = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return {
      x: center + radius * Math.cos(rad),
      y: center + radius * Math.sin(rad),
    };
  };

  const firstStart = toPoint(-arcSpan);
  const firstEnd = toPoint(-gapDeg);
  const secondStart = toPoint(gapDeg);
  const secondEnd = toPoint(arcSpan);

  return `M ${firstStart.x} ${firstStart.y} A ${radius} ${radius} 0 0 1 ${firstEnd.x} ${firstEnd.y} M ${secondStart.x} ${secondStart.y} A ${radius} ${radius} 0 0 1 ${secondEnd.x} ${secondEnd.y}`;
}

function getOrbitArcGradientEndpoints(radius: number) {
  const center = radius;
  const arcSpan = 40;
  const toPoint = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return {
      x: center + radius * Math.cos(rad),
      y: center + radius * Math.sin(rad),
    };
  };

  const start = toPoint(-arcSpan);
  const end = toPoint(arcSpan);

  return { start, end };
}

function getSystemCenterStyle(sysIdx: number) {
  const { dx, dy } = SYSTEM_OFFSETS[sysIdx];
  return {
    left: `calc(50% + ${dx}px)`,
    top: `calc(50% + ${dy}px)`,
  };
}

const OrbitingBroker = memo(function OrbitingBroker({
  broker,
  systemIndex,
  ringIndex,
  startAngle,
  speed,
  ghost = false,
  zIndex = 13,
  isActive = true,
  reduceMotion = false,
}: {
  broker: Broker;
  systemIndex: number;
  ringIndex: number;
  startAngle: number;
  speed: number;
  ghost?: boolean;
  zIndex?: number;
  isActive?: boolean;
  reduceMotion?: boolean;
}) {
  const radius = getRingRadii(systemIndex)[ringIndex];
  const duration = getOrbitDuration(speed);
  const negativeDelay = -((startAngle / 360) * duration);
  const arcRgb = BROKER_ARC_RGB[broker.name] ?? BROKER_ARC_RGB.Profitabledge;
  const ringBoxSize = radius * 2;
  const orbitPath = getOrbitArcPath(radius);
  const arcGradient = getOrbitArcGradientEndpoints(radius);
  const orbitId = `${broker.name}-${systemIndex}-${ringIndex}-${
    ghost ? "ghost" : "real"
  }`
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-");

  const orbitStyle = reduceMotion
    ? { transform: `rotate(${startAngle}deg)` }
    : {
        animation: `orbit-spin ${duration}s linear infinite`,
        animationDelay: `${negativeDelay}s`,
        animationPlayState: isActive
          ? ("running" as const)
          : ("paused" as const),
      };

  const counterStyle = reduceMotion
    ? undefined
    : {
        animation: `orbit-spin ${duration}s linear infinite reverse`,
        animationDelay: `${negativeDelay}s`,
        animationPlayState: isActive
          ? ("running" as const)
          : ("paused" as const),
      };

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        ...getSystemCenterStyle(systemIndex),
        zIndex,
      }}
    >
      <div
        className="absolute"
        style={{
          width: ringBoxSize,
          height: ringBoxSize,
          left: -radius,
          top: -radius,
        }}
      >
        <div
          className="absolute inset-0 will-change-transform"
          style={orbitStyle}
        >
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            style={{ filter: ghost ? "blur(4px)" : undefined }}
            viewBox={`0 0 ${ringBoxSize} ${ringBoxSize}`}
          >
            <defs>
              <linearGradient
                id={`${orbitId}-arc-gradient`}
                gradientUnits="userSpaceOnUse"
                x1={String(arcGradient.start.x)}
                y1={String(arcGradient.start.y)}
                x2={String(arcGradient.end.x)}
                y2={String(arcGradient.end.y)}
              >
                <stop
                  offset="0%"
                  stopColor={`rgb(${arcRgb})`}
                  stopOpacity="0"
                />
                <stop
                  offset="25%"
                  stopColor={`rgb(${arcRgb})`}
                  stopOpacity={ghost ? "0.28" : "0.45"}
                />
                <stop
                  offset="50%"
                  stopColor={`rgb(${arcRgb})`}
                  stopOpacity={ghost ? "0.45" : "0.7"}
                />
                <stop
                  offset="75%"
                  stopColor={`rgb(${arcRgb})`}
                  stopOpacity={ghost ? "0.28" : "0.45"}
                />
                <stop
                  offset="100%"
                  stopColor={`rgb(${arcRgb})`}
                  stopOpacity="0"
                />
              </linearGradient>
              <filter id={`${orbitId}-arc-glow`}>
                <feGaussianBlur
                  stdDeviation={ghost ? "4" : "3"}
                  result="blur"
                />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <path
              d={orbitPath}
              fill="none"
              stroke={`url(#${orbitId}-arc-gradient)`}
              strokeWidth={ghost ? 2.4 : 2.6}
              strokeLinecap="round"
              filter={`url(#${orbitId}-arc-glow)`}
              opacity={ghost ? 0.9 : 0.95}
            />
          </svg>
          <div
            className="absolute"
            style={{
              left: ringBoxSize - ICON_SIZE / 2,
              top: radius - ICON_SIZE / 2,
            }}
          >
            <div className="will-change-transform" style={counterStyle}>
              <div
                className={`flex items-center justify-center overflow-hidden rounded-full bg-[#1a1a1e]/10 ring-1 ring-white/10 shadow-lg shadow-black/50 ${
                  ghost ? "pointer-events-none" : "pointer-events-auto"
                }`}
                style={{
                  width: ICON_SIZE,
                  height: ICON_SIZE,
                  opacity: ghost ? 0.34 : 1,
                }}
              >
                <BrokerOrbitalIcon broker={broker} ghost={ghost} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

function OrbitalVisualization() {
  const reduceMotion = useReducedMotion() ?? false;
  const rootRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(rootRef, { amount: 0.1 });
  const outerR = CENTER_RING_RADII[2];

  const getRevealProps = (delay: number) =>
    reduceMotion
      ? {
          initial: false as const,
          whileInView: undefined,
          viewport: undefined,
          transition: undefined,
          variants: undefined,
        }
      : {
          initial: "hidden" as const,
          whileInView: "visible" as const,
          viewport: { once: true, amount: 0.35 },
          variants: CIRCLE_REVEAL_VARIANTS,
          transition: {
            ...CIRCLE_REVEAL_VARIANTS.visible.transition,
            delay,
          },
        };

  return (
    <div
      ref={rootRef}
      className="relative h-full w-full overflow-hidden"
      style={{
        contain: "layout paint",
        overflow: "clip",
        overscrollBehavior: "none",
        touchAction: "pan-y",
      }}
    >
      {/* 1. Satellite system rings + glows (rendered first, behind everything) */}
      {SYSTEM_OFFSETS.map((sys, si) => {
        if (si === 1) return null; // center rendered separately
        const radii = getRingRadii(si);
        return (
          <m.div
            key={si}
            className="absolute inset-0"
            {...getRevealProps(si === 0 ? 0.08 : 0.32)}
          >
            <div
              className="absolute rounded-full blur-3xl"
              style={{
                width: 140,
                height: 140,
                left: `calc(50% + ${sys.dx - 70}px)`,
                top: `calc(50% + ${sys.dy - 70}px)`,
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
                  left: `calc(50% + ${sys.dx - r}px)`,
                  top: `calc(50% + ${sys.dy - r}px)`,
                }}
              />
            ))}
          </m.div>
        );
      })}

      {/* 2. Center outer mask — hides satellite edges inside center area */}
      <m.div className="absolute inset-0" {...getRevealProps(0.56)}>
        <div
          className="absolute rounded-full"
          style={{
            width: outerR * 2,
            height: outerR * 2,
            left: `calc(50% - ${outerR}px)`,
            top: `calc(50% - ${outerR}px)`,
            zIndex: 10,
            background:
              "radial-gradient(circle, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.5) 70%, rgba(0,0,0,0.3) 90%, transparent 100%)",
          }}
        />

        {/* 3. Center system rings + glow (on top of mask) */}
        <div
          className="absolute rounded-full blur-3xl"
          style={{
            width: 200,
            height: 200,
            left: "calc(50% - 100px)",
            top: "calc(50% - 100px)",
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
              left: `calc(50% - ${r}px)`,
              top: `calc(50% - ${r}px)`,
              zIndex: 11,
            }}
          />
        ))}
      </m.div>

      {/* 4. Static ghost brokers — satellite orbits only */}
      {STATIC_GHOSTS.map((g, i) => (
        <OrbitingBroker
          key={`static-ghost-${i}`}
          broker={BROKERS[g.brokerIdx]}
          systemIndex={g.sysIdx}
          ringIndex={g.ringIdx}
          startAngle={g.angle}
          speed={g.speed}
          ghost
          zIndex={1}
          isActive={isInView}
          reduceMotion={!!reduceMotion}
        />
      ))}

      {/* 5. Center sphere */}
      <m.div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left: "50%", top: "50%", zIndex: 15 }}
        {...getRevealProps(0.68)}
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
          <div className="absolute inset-0 z-[2] bg-[radial-gradient(circle_at_40%_35%,rgba(0,194,255,0.12),rgba(45,212,191,0.06)_30%,rgba(17,17,17,0.24)_70%,rgba(17,17,17,0.48)_100%)] transition-opacity duration-300 ease-out group-hover:opacity-80" />
          <span className="relative z-[4] text-xs font-semibold text-white/70 transition-colors duration-300 ease-out group-hover:text-white/80">
            View all brokers
          </span>
        </div>
      </m.div>

      {/* 6. Real broker icons — orbit on center system only */}
      <m.div className="absolute inset-0" {...getRevealProps(0.72)}>
        {BROKERS.map((broker, i) => (
          <OrbitingBroker
            key={broker.name}
            broker={broker}
            systemIndex={1}
            ringIndex={BROKER_INIT[i].ringIndex}
            startAngle={BROKER_INIT[i].angle}
            speed={CENTER_ORBIT_SPEED}
            zIndex={13}
            isActive={isInView}
            reduceMotion={!!reduceMotion}
          />
        ))}
      </m.div>
      <style jsx>{`
        @keyframes orbit-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

export function BrokersSection() {
  return (
    <section
      className="relative w-full px-6 py-24 md:px-8 lg:px-12 xl:px-16 2xl:px-20 3xl:px-28"
      style={{
        contentVisibility: "auto",
        containIntrinsicSize: "1px 1000px",
      }}
    >
      {/* Header */}
      <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p
            className="mb-4 inline-block text-sm font-medium text-transparent"
            style={LANDING_ACCENT_TEXT_STYLE}
          >
            Brokers & integrations
          </p>
          <h2
            className="max-w-full text-3xl font-semibold leading-[1.15] tracking-[-0.03em] sm:text-4xl md:text-4xl"
            style={{
              backgroundImage:
                "linear-gradient(180deg, #fff 0%, rgba(255,255,255,0.7) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Connect your broker, and let the data flow.
          </h2>
        </div>

        <p className="max-w-md text-sm leading-relaxed text-white/50">
          We&apos;ve taken the grunt work out of journaling. Just sync your
          account once, and your trades show up like magic — ready to review,
          analyze, and learn from. No mess, no hassle, just smooth, automated
          tracking.
        </p>
      </div>

      {/* Orbital visualization */}
      <div
        className="relative overflow-hidden overscroll-none"
        style={{
          height: 650,
          contain: "layout paint",
          overflow: "clip",
          overscrollBehavior: "none",
          touchAction: "pan-y",
        }}
      >
        <OrbitalVisualization />

        {/* Edge fades */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-black to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-black to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black to-transparent" />
      </div>
    </section>
  );
}
