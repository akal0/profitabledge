import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { colors, springs } from "../design-tokens";

export const Scene9Closing: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Orb A - bottom left (slow drift)
  const orbAOpacity = interpolate(frame, [0, 20], [0, 0.6], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const orbAX = interpolate(frame, [0, 150], [-8, -2], {
    extrapolateRight: "clamp",
  });

  // Orb B - top right
  const orbBOpacity = interpolate(frame, [0, 20], [0, 0.6], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const orbBX = interpolate(frame, [0, 150], [8, 2], {
    extrapolateRight: "clamp",
  });

  // Brand
  const brandSpring = spring({
    frame: frame - 10,
    fps,
    config: springs.elementReveal,
  });
  const brandY = interpolate(brandSpring, [0, 1], [24, 0]);
  const brandOpacity = interpolate(brandSpring, [0, 1], [0, 1]);

  // Heading
  const headingSpring = spring({
    frame: frame - 25,
    fps,
    config: springs.elementReveal,
  });
  const headingY = interpolate(headingSpring, [0, 1], [24, 0]);
  const headingOpacity = interpolate(headingSpring, [0, 1], [0, 1]);

  // Subtitle
  const subtitleOpacity = interpolate(frame, [40, 55], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // CTA button
  const ctaSpring = spring({
    frame: frame - 55,
    fps,
    config: springs.elementReveal,
  });
  const ctaScale = interpolate(ctaSpring, [0, 1], [0.9, 1]);
  const ctaOpacity = interpolate(ctaSpring, [0, 1], [0, 1]);

  // CTA glow pulse
  const glowIntensity = interpolate(
    Math.sin(frame * 0.08) * 0.5 + 0.5,
    [0, 1],
    [0.15, 0.4]
  );

  // URL
  const urlOpacity = interpolate(frame, [70, 85], [0, 1], {
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
        fontFamily: "Geist, Inter, sans-serif",
      }}
    >
      {/* Film grain */}
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0.06,
          pointerEvents: "none",
          zIndex: 10,
        }}
      >
        <filter id="closingGrain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65"
            numOctaves="3"
            seed={frame % 5}
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#closingGrain)" />
      </svg>

      {/* Orb A */}
      <div
        style={{
          position: "absolute",
          left: `${orbAX}%`,
          bottom: "-15%",
          width: "55%",
          height: "55%",
          background:
            "radial-gradient(ellipse at 32% 68%, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.1) 35%, rgba(255,255,255,0.001) 70%)",
          mixBlendMode: "screen",
          opacity: orbAOpacity,
          filter: "blur(50px)",
        }}
      />

      {/* Orb B */}
      <div
        style={{
          position: "absolute",
          right: `${-orbBX}%`,
          top: "-15%",
          width: "55%",
          height: "55%",
          background:
            "radial-gradient(ellipse at 68% 32%, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.1) 35%, rgba(255,255,255,0.001) 70%)",
          mixBlendMode: "screen",
          opacity: orbBOpacity,
          filter: "blur(50px)",
        }}
      />

      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(5,5,5,0.55) 100%)",
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
          gap: 20,
          maxWidth: 500,
          textAlign: "center",
        }}
      >
        {/* Brand */}
        <div
          style={{
            fontSize: 28,
            fontWeight: 600,
            color: "white",
            letterSpacing: "-0.08em",
            opacity: brandOpacity,
            transform: `translateY(${brandY}px)`,
          }}
        >
          profitabledge
        </div>

        {/* Heading */}
        <div
          style={{
            fontSize: 32,
            fontWeight: 600,
            color: "white",
            letterSpacing: "-0.04em",
            lineHeight: 1.2,
            opacity: headingOpacity,
            transform: `translateY(${headingY}px)`,
          }}
        >
          Your profitable edge starts today.
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 14,
            color: "rgba(255,255,255,0.58)",
            lineHeight: 1.6,
            maxWidth: 420,
            opacity: subtitleOpacity,
          }}
        >
          AI-powered trading journal, analytics, and edge detection for serious
          traders.
        </div>

        {/* CTA Button */}
        <div
          style={{
            opacity: ctaOpacity,
            transform: `scale(${ctaScale})`,
          }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              padding: "12px 36px",
              borderRadius: 10,
              background: colors.teal,
              color: "#000",
              boxShadow: `0 0 40px rgba(20,184,166,${glowIntensity}), 0 0 80px rgba(20,184,166,${glowIntensity * 0.5})`,
              letterSpacing: "-0.01em",
            }}
          >
            Start free
          </div>
        </div>

        {/* URL */}
        <div
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.4)",
            opacity: urlOpacity,
            letterSpacing: "0.01em",
          }}
        >
          profitabledge.com
        </div>
      </div>
    </div>
  );
};
