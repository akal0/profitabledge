"use client";

import { motion } from "framer-motion";

const AMBIENT_ORBS = [
  {
    w: 550,
    h: 500,
    topOffset: -250,
    leftOffset: 30,
    color: "rgba(99,102,241,0.18)",
    drift: { x: [0, 80, -50, 100, -30, 0], y: [0, -60, 40, -80, 30, 0] },
    dur: 6,
  },
  {
    w: 420,
    h: 450,
    topOffset: -100,
    leftOffset: -120,
    color: "rgba(59,130,246,0.14)",
    drift: { x: [0, -70, 90, -40, 60, 0], y: [0, 50, -70, 60, -40, 0] },
    dur: 8,
  },
  {
    w: 350,
    h: 370,
    topOffset: -180,
    leftOffset: -30,
    color: "rgba(139,92,246,0.16)",
    drift: { x: [0, 55, -75, 45, -60, 0], y: [0, -45, 65, -55, 35, 0] },
    dur: 5,
  },
  {
    w: 280,
    h: 300,
    topOffset: 60,
    leftOffset: 80,
    color: "rgba(124,58,237,0.12)",
    drift: { x: [0, -50, 65, -70, 40, 0], y: [0, 60, -45, 50, -65, 0] },
    dur: 7,
  },
  {
    w: 300,
    h: 280,
    topOffset: -220,
    leftOffset: -80,
    color: "rgba(79,109,205,0.1)",
    drift: { x: [0, 45, -65, 55, -35, 0], y: [0, -55, 45, -35, 60, 0] },
    dur: 9,
  },
];

export function PremiumAssistantAmbientOrbs({
  isTyping,
}: {
  isTyping: boolean;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" style={{ contain: "strict" }}>
      {AMBIENT_ORBS.map((orb, index) => (
        <motion.div
          key={index}
          className="absolute rounded-full"
          style={{
            width: orb.w,
            height: orb.h,
            top: `calc(50% + ${orb.topOffset}px)`,
            left: `calc(50% + ${orb.leftOffset}px)`,
            marginTop: -(orb.h / 2),
            marginLeft: -(orb.w / 2),
            background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
            filter: "blur(60px)",
            willChange: "transform",
          }}
          initial={false}
          animate={isTyping ? { x: orb.drift.x, y: orb.drift.y } : { x: 0, y: 0 }}
          transition={
            isTyping
              ? {
                  duration: orb.dur,
                  ease: "easeInOut",
                  repeat: Infinity,
                  repeatType: "mirror",
                }
              : { duration: 2, ease: "easeOut" }
          }
        />
      ))}
    </div>
  );
}
