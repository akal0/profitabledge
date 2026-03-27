import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { colors, springs } from "../design-tokens";

export const Scene1BrandReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Orb A - bottom left
  const orbAOpacity = interpolate(frame, [15, 45], [0, 0.7], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const orbAX = interpolate(frame, [0, 120], [-10, -2], {
    extrapolateRight: "clamp",
  });
  const orbAY = interpolate(frame, [0, 120], [10, 3], {
    extrapolateRight: "clamp",
  });

  // Orb B - top right
  const orbBOpacity = interpolate(frame, [15, 45], [0, 0.7], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const orbBX = interpolate(frame, [0, 120], [10, 2], {
    extrapolateRight: "clamp",
  });
  const orbBY = interpolate(frame, [0, 120], [-10, -3], {
    extrapolateRight: "clamp",
  });

  // Brand text
  const brandSpring = spring({
    frame: frame - 30,
    fps,
    config: springs.elementReveal,
  });
  const brandY = interpolate(brandSpring, [0, 1], [24, 0]);
  const brandOpacity = interpolate(brandSpring, [0, 1], [0, 1]);

  // Tagline
  const taglineOpacity = interpolate(frame, [50, 80], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const taglineY = interpolate(frame, [50, 80], [12, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // Cross-dissolve out
  const sceneOpacity = interpolate(frame, [95, 120], [1, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#050505",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        opacity: sceneOpacity,
        fontFamily: "Geist, Inter, sans-serif",
      }}
    >
      {/* Film grain noise overlay */}
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0.08,
          pointerEvents: "none",
          zIndex: 10,
        }}
      >
        <filter id="grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65"
            numOctaves="3"
            seed={frame % 5}
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>

      {/* Orb A - bottom left */}
      <div
        style={{
          position: "absolute",
          left: `${orbAX}%`,
          bottom: `${-orbAY}%`,
          width: "60%",
          height: "60%",
          background:
            "radial-gradient(ellipse at 32% 68%, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.15) 35%, rgba(255,255,255,0.001) 70%)",
          mixBlendMode: "screen",
          opacity: orbAOpacity,
          filter: "blur(40px)",
        }}
      />

      {/* Orb B - top right */}
      <div
        style={{
          position: "absolute",
          right: `${-orbBX}%`,
          top: `${orbBY}%`,
          width: "60%",
          height: "60%",
          background:
            "radial-gradient(ellipse at 68% 32%, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.15) 35%, rgba(255,255,255,0.001) 70%)",
          mixBlendMode: "screen",
          opacity: orbBOpacity,
          filter: "blur(40px)",
        }}
      />

      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(5,5,5,0.55) 100%)",
          pointerEvents: "none",
          zIndex: 5,
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 8,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            fontSize: 42,
            fontWeight: 600,
            color: "white",
            letterSpacing: "-0.08em",
            opacity: brandOpacity,
            transform: `translateY(${brandY}px)`,
          }}
        >
          profitabledge
        </div>
        <div
          style={{
            fontSize: 14,
            color: "rgba(255,255,255,0.58)",
            opacity: taglineOpacity,
            transform: `translateY(${taglineY}px)`,
            maxWidth: 400,
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          Turn your trading data into your profitable edge.
        </div>
      </div>
    </div>
  );
};
