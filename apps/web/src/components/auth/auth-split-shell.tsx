"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { AuthHeroArtwork } from "@/components/auth/auth-hero-artwork";
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
}

const DEFAULT_HERO_TITLE = "See the edge before the same mistake repeats.";
const DEFAULT_HERO_DESCRIPTION =
  "Turn raw fills, journal notes, and prop-account pressure into a review loop that actually sharpens your next session.";
const HERO_ROTATE_INTERVAL_MS = 6200;
const DESKTOP_USER_AGENT_MARKER = "ProfitabledgeDesktop/1";
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
const noopDesktopContextSubscribe = () => () => undefined;

function readDesktopEmbeddedAuthContext() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.parent !== window ||
    "__TAURI_INTERNALS__" in window ||
    navigator.userAgent.includes(DESKTOP_USER_AGENT_MARKER)
  );
}

function useDesktopEmbeddedAuthContext() {
  return useSyncExternalStore(
    noopDesktopContextSubscribe,
    readDesktopEmbeddedAuthContext,
    () => false
  );
}

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
      <h2 className="max-w-[34rem] text-4xl font-semibold leading-[1.02] tracking-[-0.05em] text-white lg:max-w-[38rem] lg:text-[2.65rem] lg:leading-[1] xl:max-w-7xl xl:text-[1.6rem]">
        {activeSlide.title}
      </h2>
      <p className="mt-2 max-w-[24rem] text-sm leading-6 text-white/58 lg:mt-2 lg:max-w-[30rem] lg:text-[15px]  xl:max-w-lg xl:text-base">
        {activeSlide.description}
      </p>
    </>
  );

  if (reducedMotion || slides.length < 2) {
    return (
      <div className="relative w-full py-16">
        <div className={contentClassName}>{content} </div>
      </div>
    );
  }

  return (
    <div className="relative w-full py-16">
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
}: AuthSplitShellProps) {
  const isDesktopEmbeddedAuthContext = useDesktopEmbeddedAuthContext();
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

  const formStage = (
    <div className={cn("relative mx-auto w-full max-w-[31rem]", className)}>
      <div className="relative z-10">{children}</div>
    </div>
  );

  if (isDesktopEmbeddedAuthContext) {
    return (
      <div className="relative isolate flex h-[100dvh] min-h-[100dvh] w-full overflow-hidden bg-[#050505] text-white">
        <div className="pointer-events-none absolute inset-0 bg-[url('/landing/hero-background.svg')] bg-cover bg-center bg-no-repeat opacity-85" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_32%),linear-gradient(180deg,rgba(0,0,0,0.28),rgba(0,0,0,0.6))]" />

        <main className="relative z-10 flex h-full min-h-[100dvh] w-full items-center justify-center px-6 sm:px-10 lg:px-12">
          <div className="flex h-full min-h-[100dvh] w-full max-w-[35rem] flex-col items-center justify-center gap-8">
            {affiliate ? (
              <AuthAffiliateLockup
                affiliate={affiliate}
                hideAffiliateDescription={hideAffiliateDescription}
              />
            ) : heroContent ? (
              <div>{heroContent}</div>
            ) : null}

            {formStage}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-screen max-w-none overflow-hidden bg-[#050505] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[url('/landing/hero-background.svg')] bg-cover bg-center bg-no-repeat lg:hidden" />

      <header className="absolute inset-x-0 top-0 z-20 px-6 py-6 sm:px-10 lg:px-14 xl:px-16">
        <Link
          href="/"
          className="inline-flex text-lg font-semibold tracking-[-0.08em] text-white sm:text-xl"
        >
          profitabledge
        </Link>
      </header>

      <div className="grid min-h-screen w-screen max-w-none lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <main className="relative z-10 flex min-h-screen min-w-0 items-center justify-center px-6 pb-12 pt-28 sm:px-10 lg:px-14 xl:px-16 ">
          {formStage}
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
