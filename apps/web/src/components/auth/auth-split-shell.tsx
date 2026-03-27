"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { AuthHeroArtwork } from "@/components/auth/auth-hero-artwork";
import { DottedGlowBackground } from "@/components/ui/dotted-glow-background";
import { cn } from "@/lib/utils";

export interface AffiliateInfo {
  name: string;
  username: string | null;
  image: string | null;
}

export interface AuthHeroSlide {
  title: string;
  description: string;
}

interface AuthSplitShellProps {
  children: ReactNode;
  className?: string;
  heroTitle?: string;
  heroDescription?: string;
  heroSlides?: AuthHeroSlide[];
  affiliate?: AffiliateInfo | null;
  hideAffiliateDescription?: boolean;
  heroArtwork?: ReactNode;
  heroContent?: ReactNode;
  showFormGlow?: boolean;
}

const DEFAULT_HERO_TITLE = "See the edge before the same mistake repeats.";
const DEFAULT_HERO_DESCRIPTION =
  "Turn raw fills, journal notes, and prop-account pressure into a review loop that actually sharpens your next session.";
const HERO_ROTATE_INTERVAL_MS = 6200;
const HERO_COPY_TRANSITION = {
  y: {
    duration: 0.95,
    ease: [0.16, 1, 0.3, 1] as const,
  },
  opacity: {
    duration: 0.78,
    ease: [0.33, 1, 0.68, 1] as const,
  },
};
const HERO_ACCENT_ORB_PULSE_EASE = [0.42, 0, 0.58, 1] as const;

function AuthAffiliateLockup({
  affiliate,
  hideAffiliateDescription = false,
}: {
  affiliate: AffiliateInfo;
  hideAffiliateDescription?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex items-center gap-3">
        <span className="text-lg font-semibold tracking-[-0.08em] text-white">
          profitabledge
        </span>
        <span className="text-sm font-medium text-white/40">&times;</span>
        <div className="flex items-center gap-2">
          {affiliate.image ? (
            <Image
              src={affiliate.image}
              alt={affiliate.name}
              width={28}
              height={28}
              className="rounded-full ring-1 ring-white/15"
            />
          ) : (
            <div className="flex size-7 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white/70 ring-1 ring-white/15">
              {affiliate.name.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-sm font-medium text-white/80">
            {affiliate.username || affiliate.name}
          </span>
        </div>
      </div>
      {hideAffiliateDescription ? null : (
        <p className="max-w-md text-center text-sm leading-5.5 text-white/50">
          You&apos;ve been invited to the sharpest trading journal on the
          market. <br />
          Are you ready to find your own profitable edge?
        </p>
      )}
    </div>
  );
}

function AuthHeroAccentOrbs({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center"
      aria-hidden="true"
    >
      <div className="relative h-full w-full max-w-3xl">
        <motion.div
          className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2"
          animate={
            reducedMotion
              ? { opacity: 0.24, scale: 1, rotate: 0, y: 0 }
              : {
                  opacity: [0.22, 0.32, 0.22],
                  scale: [1, 1.05, 1],
                  rotate: 360,
                  y: [0, -8, 0, 6, 0],
                }
          }
          transition={{
            rotate: {
              duration: 26,
              ease: "linear",
              repeat: Infinity,
            },
            y: {
              duration: 11,
              ease: HERO_ACCENT_ORB_PULSE_EASE,
              repeat: Infinity,
              repeatType: "mirror",
            },
            scale: {
              duration: 13,
              ease: HERO_ACCENT_ORB_PULSE_EASE,
              repeat: Infinity,
              repeatType: "mirror",
            },
            opacity: {
              duration: 13,
              ease: HERO_ACCENT_ORB_PULSE_EASE,
              repeat: Infinity,
              repeatType: "mirror",
            },
          }}
        >
          <div
            className="absolute left-1/2 top-[16%] h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background:
                "radial-gradient(circle at center, rgba(255,255,255,0.27) 0%, rgba(255,255,255,0.19) 20%, rgba(255,255,255,0.11) 38%, rgba(255,255,255,0.045) 56%, rgba(255,255,255,0.014) 70%, rgba(255,255,255,0) 84%)",
              filter: "blur(20px)",
              mixBlendMode: "screen",
            }}
          />

          <div
            className="absolute left-[20%] top-[72%] h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background:
                "radial-gradient(circle at center, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0.17) 22%, rgba(255,255,255,0.1) 40%, rgba(255,255,255,0.04) 58%, rgba(255,255,255,0.012) 72%, rgba(255,255,255,0) 84%)",
              filter: "blur(18px)",
              mixBlendMode: "screen",
            }}
          />

          <div
            className="absolute left-[80%] top-[72%] h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background:
                "radial-gradient(circle at center, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.16) 24%, rgba(255,255,255,0.095) 42%, rgba(255,255,255,0.038) 60%, rgba(255,255,255,0.01) 74%, rgba(255,255,255,0) 86%)",
              filter: "blur(18px)",
              mixBlendMode: "screen",
            }}
          />
        </motion.div>
      </div>
    </div>
  );
}

function AuthHeroCopy({ slides }: { slides: AuthHeroSlide[] }) {
  const reducedMotion = Boolean(useReducedMotion());
  const [activeIndex, setActiveIndex] = useState(0);
  const activeSlide = slides[activeIndex] ?? slides[0];

  useEffect(() => {
    setActiveIndex(0);
  }, [slides]);

  useEffect(() => {
    if (reducedMotion || slides.length < 2) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setActiveIndex((currentIndex) => (currentIndex + 1) % slides.length);
    }, HERO_ROTATE_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [reducedMotion, slides]);

  if (!activeSlide) {
    return null;
  }

  const contentClassName =
    "relative z-10 mx-auto flex max-w-3xl flex-col items-center text-center drop-shadow-[0_10px_34px_rgba(0,0,0,0.42)]";
  const content = (
    <>
      <h2 className="max-w-[34rem] text-4xl font-semibold leading-[1.02] tracking-[-0.04em] text-white lg:max-w-[38rem] lg:text-[2.65rem] lg:leading-[0.98] xl:max-w-4xl xl:text-[3rem]">
        {activeSlide.title}
      </h2>
      <p className="mt-3 max-w-[26rem] text-sm leading-6 text-white/58 lg:mt-4 lg:max-w-[30rem] lg:text-[15px] lg:leading-7 xl:max-w-xl xl:text-base">
        {activeSlide.description}
      </p>
    </>
  );

  if (reducedMotion || slides.length < 2) {
    return (
      <div className="relative w-full py-16">
        <AuthHeroAccentOrbs reducedMotion={reducedMotion} />
        <div className={contentClassName}>{content}</div>
      </div>
    );
  }

  return (
    <div className="relative w-full py-16">
      <AuthHeroAccentOrbs reducedMotion={reducedMotion} />
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={`${activeIndex}-${activeSlide.title}`}
          initial={{ opacity: 0, y: 56 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -56 }}
          transition={HERO_COPY_TRANSITION}
          className={contentClassName}
        >
          {content}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function AuthSplitShell({
  children,
  className,
  heroTitle = DEFAULT_HERO_TITLE,
  heroDescription = DEFAULT_HERO_DESCRIPTION,
  heroSlides,
  affiliate,
  hideAffiliateDescription = false,
  heroArtwork,
  heroContent,
  showFormGlow = false,
}: AuthSplitShellProps) {
  const resolvedHeroSlides = useMemo(
    () =>
      heroSlides?.length
        ? heroSlides
        : [
            {
              title: heroTitle,
              description: heroDescription,
            },
          ],
    [heroDescription, heroSlides, heroTitle]
  );

  return (
    <div className="relative min-h-screen w-screen max-w-none overflow-hidden bg-[#050505] text-white">
      <div className="pointer-events-none absolute inset-0 lg:hidden">
        <div className="absolute inset-0 bg-[url('/landing/hero-background.svg')] bg-cover bg-center opacity-30" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_32%),rgba(5,5,5,0.88)]" />
      </div>

      <header className="absolute inset-x-0 top-0 z-20 px-6 py-6 sm:px-10 lg:px-14 xl:px-16">
        <Link
          href="/"
          className="inline-flex text-lg font-semibold tracking-[-0.08em] text-white sm:text-xl"
        >
          profitabledge
        </Link>
      </header>

      <div className="grid min-h-screen w-screen max-w-none lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <main className="relative z-10 flex min-h-screen min-w-0 items-center justify-center px-6 pb-12 pt-28 sm:px-10 lg:px-14 xl:px-16">
          <div
            className={cn("relative mx-auto w-full max-w-[31rem]", className)}
          >
            {showFormGlow ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 -z-10 overflow-visible"
              >
                <div
                  className="absolute left-1/2 top-1/2 h-[72rem] w-[72rem] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full opacity-95"
                  style={{
                    clipPath: "circle(50% at 50% 50%)",
                    WebkitClipPath: "circle(50% at 50% 50%)",
                    maskImage:
                      "radial-gradient(circle closest-side, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 18%, rgba(0,0,0,0.88) 38%, rgba(0,0,0,0.62) 54%, rgba(0,0,0,0.34) 66%, rgba(0,0,0,0.16) 76%, rgba(0,0,0,0.07) 84%, rgba(0,0,0,0.02) 91%, transparent 100%)",
                    WebkitMaskImage:
                      "radial-gradient(circle closest-side, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 18%, rgba(0,0,0,0.88) 38%, rgba(0,0,0,0.62) 54%, rgba(0,0,0,0.34) 66%, rgba(0,0,0,0.16) 76%, rgba(0,0,0,0.07) 84%, rgba(0,0,0,0.02) 91%, transparent 100%)",
                  }}
                >
                  <DottedGlowBackground
                    gap={11}
                    radius={1.95}
                    opacity={0.48}
                    backgroundOpacity={0}
                    speedMin={0.34}
                    speedMax={1.18}
                    speedScale={0.95}
                    color="rgba(255,255,255,0.13)"
                    darkColor="rgba(255,255,255,0.13)"
                    glowColor="rgba(39,214,201,0.34)"
                    darkGlowColor="rgba(39,214,201,0.34)"
                  />
                </div>
              </div>
            ) : null}

            <div className="relative z-10">{children}</div>
          </div>
        </main>

        <aside className="relative hidden min-h-screen min-w-0 overflow-hidden lg:block">
          {heroArtwork ?? <AuthHeroArtwork />}

          {heroContent ? (
            <div className="relative z-10 flex h-full items-center justify-center px-12 xl:px-16">
              <div className="flex min-h-[24rem] w-full flex-col items-center justify-center gap-10 xl:min-h-[28rem]">
                {affiliate ? (
                  <AuthAffiliateLockup
                    affiliate={affiliate}
                    hideAffiliateDescription={hideAffiliateDescription}
                  />
                ) : null}
                {heroContent}
              </div>
            </div>
          ) : affiliate ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center">
              <AuthAffiliateLockup
                affiliate={affiliate}
                hideAffiliateDescription={hideAffiliateDescription}
              />
            </div>
          ) : (
            <div className="relative z-10 flex h-full items-center justify-center px-12 xl:px-16">
              <div className="flex min-h-[24rem] w-full items-center justify-center xl:min-h-[28rem]">
                <AuthHeroCopy slides={resolvedHeroSlides} />
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
