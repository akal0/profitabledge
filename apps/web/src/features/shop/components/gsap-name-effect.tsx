"use client";

import { Fragment, useEffect, useMemo, useRef } from "react";
import { gsap } from "gsap";

import { SCRAMBLE_CHARSET } from "@/features/shop/lib/gsap-text-effects";
import { cn } from "@/lib/utils";

type GsapNameEffectProps = {
  effect: string;
  text: string;
  active?: boolean;
  className?: string;
};

function scrambleText(target: HTMLElement, text: string) {
  const state = { progress: 0 };
  const length = text.length;

  return gsap.to(state, {
    progress: 1,
    duration: 0.9,
    ease: "power2.out",
    onUpdate: () => {
      const settledCount = Math.floor(state.progress * length);
      const scrambled = text
        .split("")
        .map((char, index) => {
          if (char === " ") return "\u00A0";
          if (index < settledCount) return char;
          const randomIndex = Math.floor(Math.random() * SCRAMBLE_CHARSET.length);
          return SCRAMBLE_CHARSET[randomIndex] ?? char;
        })
        .join("");

      target.textContent = scrambled;
    },
    onComplete: () => {
      target.textContent = text;
    },
  });
}

export function GsapNameEffect({ effect, text, active = true, className }: GsapNameEffectProps) {
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const scrambleRef = useRef<HTMLSpanElement | null>(null);
  const characters = useMemo(() => text.split(""), [text]);

  useEffect(() => {
    if (!active) {
      if (scrambleRef.current) {
        scrambleRef.current.textContent = text;
      }
      return;
    }

    const container = containerRef.current;
    const scrambleElement = scrambleRef.current;
    if (!container) {
      return;
    }

    const delayedCalls: gsap.core.Tween[] = [];

    const context = gsap.context(() => {
      if (effect === "name_wave_v2") {
        const chars = container.querySelectorAll<HTMLElement>("[data-char]");
        gsap.fromTo(
          chars,
          { y: 0 },
          {
            y: -6,
            duration: 0.8,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
            stagger: { each: 0.05, from: "start" },
          }
        );
      }

      if (effect === "name_typewriter_v2") {
        const chars = container.querySelectorAll<HTMLElement>("[data-char]");
        gsap.set(chars, { opacity: 0 });
        gsap.to(chars, {
          opacity: 1,
          duration: 0.01,
          stagger: 0.045,
          ease: "none",
        });
      }

      if (effect === "name_scramble" && scrambleElement) {
        const run = () => scrambleText(scrambleElement, text);
        run();
        const loopCall = gsap.delayedCall(5, function loop() {
          run();
          delayedCalls.push(gsap.delayedCall(5, loop));
        });
        delayedCalls.push(loopCall);
      }
    }, container);

    return () => {
      delayedCalls.forEach((call) => call.kill());
      context.revert();
      gsap.killTweensOf(container.querySelectorAll("[data-char]"));
      gsap.killTweensOf(scrambleElement);
      gsap.killTweensOf(container);
    };
  }, [active, characters, effect, text]);

  if (!active) {
    return <span className={className}>{text}</span>;
  }

  if (effect === "name_scramble") {
    return (
      <span ref={containerRef} className={cn("inline-block", className)}>
        <span ref={scrambleRef}>{text}</span>
      </span>
    );
  }

  if (effect === "name_typewriter_v2") {
    return (
      <span ref={containerRef} className={cn("inline-flex items-center", className)}>
        <span>
          {characters.map((char, index) => (
            <span key={`${char}-${index}`} data-char className="inline-block">
              {char === " " ? "\u00A0" : char}
            </span>
          ))}
        </span>
        <span className="name-typewriter-cursor ml-0.5 inline-block h-[1em] w-px bg-current" />
      </span>
    );
  }

  return (
    <span ref={containerRef} className={cn("inline-flex items-end gap-[0.015em]", className)}>
      {characters.map((char, index) => (
        <Fragment key={`${char}-${index}`}>
          <span data-char className="inline-block">
            {char === " " ? "\u00A0" : char}
          </span>
        </Fragment>
      ))}
    </span>
  );
}
