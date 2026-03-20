"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

// 256×256 grayscale noise tile — rendered once, tiled cheaply
const NOISE_BG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='256' height='256' filter='url(%23n)'/%3E%3C/svg%3E\")";

export function AuthHeroArtwork({ className }: { className?: string }) {
  const reduced = useReducedMotion();

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full overflow-hidden bg-[#050505]",
        className
      )}
      aria-hidden="true"
    >
      {/* Background SVG — what the orbs will reveal */}
      <div className="absolute inset-0 bg-[url('/landing/hero-background.svg')] bg-cover [background-position:86%_4%] bg-no-repeat" />

      {/* Grain baked into the SVG layer — revealed alongside the image */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: NOISE_BG,
          backgroundSize: "200px 200px",
          opacity: 0.1,
          mixBlendMode: "overlay",
        }}
      />

      {/*
       * Multiply mask group.
       * mix-blend-mode:multiply composites this group against the SVG layer below:
       *   white (1,1,1) × SVG_pixel = SVG_pixel  →  image revealed
       *   black (0,0,0) × SVG_pixel = 0          →  image hidden
       * So orbs are white gradients on a black fill — they punch windows in the darkness.
       */}
      <div className="absolute inset-0 overflow-hidden" style={{ mixBlendMode: "multiply" }}>
        {/* Pure black floor — nothing shows outside orb areas */}
        <div className="absolute inset-0 bg-black" />

        {/* Orb A — mirror of Orb B, originates bottom-left */}
        <motion.div
          className="absolute"
          style={{
            width: "60%",
            height: "60%",
            left: "-10%",
            bottom: "-10%",
            willChange: "transform",
            background:
              "radial-gradient(ellipse at 32% 68%, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.48) 18%, rgba(255,255,255,0.22) 36%, rgba(255,255,255,0.06) 55%, rgba(255,255,255,0.010) 72%, rgba(255,255,255,0) 90%)",
          }}
          animate={
            reduced
              ? {}
              : { x: ["0%", "14%", "-5%", "0%"], y: ["0%", "-18%", "5%", "0%"] }
          }
          transition={{
            duration: 11,
            ease: "easeInOut",
            repeat: Infinity,
            repeatType: "mirror",
          }}
        />

        {/* Orb B — reveal spot, originates top-right */}
        <motion.div
          className="absolute"
          style={{
            width: "60%",
            height: "60%",
            right: "-10%",
            top: "-10%",
            willChange: "transform",
            background:
              "radial-gradient(ellipse at 68% 32%, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.48) 18%, rgba(255,255,255,0.22) 36%, rgba(255,255,255,0.06) 55%, rgba(255,255,255,0.010) 72%, rgba(255,255,255,0) 90%)",
          }}
          animate={
            reduced
              ? {}
              : { x: ["0%", "-14%", "5%", "0%"], y: ["0%", "18%", "-5%", "0%"] }
          }
          transition={{
            duration: 11,
            ease: "easeInOut",
            repeat: Infinity,
            repeatType: "mirror",
          }}
        />
      </div>

      {/* Ambient SVG layer — 5% always visible, sits above multiply so it's never killed */}
      <div className="absolute inset-0 bg-[url('/landing/hero-background.svg')] bg-cover [background-position:86%_4%] bg-no-repeat opacity-[0.01]" />

      {/* Fine grain across the whole composition — visible on dark areas too */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: NOISE_BG,
          backgroundSize: "200px 200px",
          opacity: 0.09,
          mixBlendMode: "screen",
        }}
      />

      {/* Subtle corner vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(5,5,5,0.55)_100%)]" />
    </div>
  );
}
