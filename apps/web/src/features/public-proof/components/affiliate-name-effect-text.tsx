"use client";

import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";
import {
  getAffiliateNameColorStyle,
  getAffiliateNameEffectClassName,
  getAffiliateNameEffectStyle,
  getAffiliateNameFontClassName,
} from "@/features/public-proof/lib/public-proof-badges";
import { GsapNameEffect } from "@/features/shop/components/gsap-name-effect";
import { isGsapTextEffect } from "@/features/shop/lib/gsap-text-effects";
import {
  getNameplateClassName,
  getNameplateStyle,
  hasNameplate,
} from "@/features/shop/lib/nameplate-styles";

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
  nameplate?: string | null;
  customGradient?: { from?: string; to?: string } | null;
  customNameplate?: { from?: string; to?: string } | null;
  animateEffect?: boolean;
  className?: string;
  wrapperClassName?: string;
  fontClassTransform?: (className: string) => string;
};

function getTextValue(children: ReactNode) {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }

  return null;
}

export function AffiliateNameEffectText({
  children,
  nameFont,
  nameEffect,
  nameColor,
  nameplate,
  customGradient,
  customNameplate,
  animateEffect = true,
  className,
  wrapperClassName,
  fontClassTransform,
}: AffiliateNameEffectTextProps) {
  const rawFontClassName = getAffiliateNameFontClassName(nameFont);
  const fontClassName = fontClassTransform
    ? fontClassTransform(rawFontClassName)
    : rawFontClassName;
  const isSparkle = animateEffect && nameEffect === "sparkle";
  const textValue = getTextValue(children);
  const withNameplate = hasNameplate(nameplate);
  const textStyle = {
    ...getAffiliateNameColorStyle(nameColor, customGradient),
    ...getAffiliateNameEffectStyle(nameEffect, nameColor, customGradient),
  };
  const renderedChildren =
    textValue && isGsapTextEffect(nameEffect)
      ? <GsapNameEffect effect={nameEffect ?? "none"} text={textValue} active={animateEffect} />
      : animateEffect && nameEffect === "wave" && textValue
      ? textValue.split("").map((character, index) => (
          <span
            key={`${character}-${index}`}
            className="name-wave-char inline-block"
            style={{ animationDelay: `${index * 0.08}s` }}
          >
            {character === " " ? "\u00A0" : character}
          </span>
        ))
      : animateEffect && (nameEffect === "glitch_text" || nameEffect === "name_glitch_v2") && textValue
      ? (
          <span className="relative inline-block">
            <span className="relative z-10">{textValue}</span>
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute inset-0",
                nameEffect === "name_glitch_v2"
                  ? "name-glitch-v2-layer"
                  : "name-glitch-layer"
              )}
              style={{ color: "var(--name-glitch-primary, #22d3ee)" }}
            >
              {textValue}
            </span>
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute inset-0 [animation-delay:0.14s]",
                nameEffect === "name_glitch_v2"
                  ? "name-glitch-v2-layer"
                  : "name-glitch-layer"
              )}
              style={{ color: "var(--name-glitch-secondary, #f472b6)" }}
            >
              {textValue}
            </span>
          </span>
        )
      : children;

  const textNode = (
    <span
      className={cn(
        "font-semibold",
        isSparkle && "relative z-10",
        fontClassName,
        animateEffect ? getAffiliateNameEffectClassName(nameEffect) : undefined,
        className
      )}
      style={textStyle}
    >
      {renderedChildren}
    </span>
  );

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
      {withNameplate ? (
        <span
          className={cn(
            "inline-flex items-center justify-center",
            getNameplateClassName(nameplate)
          )}
          style={getNameplateStyle(nameplate, customNameplate)}
        >
          {textNode}
        </span>
      ) : (
        textNode
      )}
    </span>
  );
}
