"use client";

import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";
import {
  getAffiliateNameColorStyle,
  getAffiliateNameEffectClassName,
  getAffiliateNameEffectStyle,
  getAffiliateNameFontClassName,
} from "@/features/public-proof/lib/public-proof-badges";

const SPARKLE_PARTICLES: Array<{
  size: number;
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  delay: string;
  duration: string;
}> = [
  { left: "-0.18rem", top: "0.02rem", size: 5, delay: "0s", duration: "2.8s" },
  { left: "18%", top: "-0.22rem", size: 4, delay: "0.45s", duration: "2.5s" },
  { right: "16%", top: "-0.16rem", size: 5, delay: "0.9s", duration: "2.9s" },
  { right: "-0.2rem", top: "0.04rem", size: 5, delay: "1.3s", duration: "2.6s" },
  { left: "20%", bottom: "-0.16rem", size: 4, delay: "1.75s", duration: "2.7s" },
  { right: "18%", bottom: "-0.14rem", size: 5, delay: "2.2s", duration: "3s" },
];

type AffiliateNameEffectTextProps = {
  children: ReactNode;
  nameFont?: string | null;
  nameEffect?: string | null;
  nameColor?: string | null;
  customGradient?: { from?: string; to?: string } | null;
  className?: string;
  wrapperClassName?: string;
  fontClassTransform?: (className: string) => string;
};

export function AffiliateNameEffectText({
  children,
  nameFont,
  nameEffect,
  nameColor,
  customGradient,
  className,
  wrapperClassName,
  fontClassTransform,
}: AffiliateNameEffectTextProps) {
  const rawFontClassName = getAffiliateNameFontClassName(nameFont);
  const fontClassName = fontClassTransform
    ? fontClassTransform(rawFontClassName)
    : rawFontClassName;
  const isSparkle = nameEffect === "sparkle";
  const textStyle = {
    ...getAffiliateNameColorStyle(nameColor, customGradient),
    ...getAffiliateNameEffectStyle(nameEffect, nameColor, customGradient),
  };

  return (
    <span
      className={cn(
        "inline-flex items-center align-baseline",
        isSparkle && "relative isolate overflow-visible",
        wrapperClassName
      )}
    >
      {isSparkle ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-1 -inset-y-1"
        >
          {SPARKLE_PARTICLES.map((particle, index) => (
            <span
              key={`${particle.delay}-${index}`}
              className="name-sparkle-particle absolute"
              style={
                {
                  top: particle.top,
                  right: particle.right,
                  bottom: particle.bottom,
                  left: particle.left,
                  width: `${particle.size}px`,
                  height: `${particle.size}px`,
                  animationDelay: particle.delay,
                  animationDuration: particle.duration,
                } as CSSProperties
              }
            />
          ))}
        </span>
      ) : null}
      <span
        className={cn(
          "font-semibold",
          isSparkle && "relative z-10",
          fontClassName,
          getAffiliateNameEffectClassName(nameEffect),
          className
        )}
        style={textStyle}
      >
        {children}
      </span>
    </span>
  );
}
