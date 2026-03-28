"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion, MotionValue } from "motion/react";
import { Pause, Play } from "lucide-react";
import { PROFITABLEDGE_FAVICON_PATH } from "@/lib/brand-assets";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "#features", label: "Features" },
  { href: "#changelog", label: "Changelog" },
  { href: "#brokers", label: "Brokers & integrations" },
  { href: "#pricing", label: "Pricing" },
  { href: "#resources", label: "Resources" },
];

const LANDING_PREVIEWS = [
  {
    icon: PROFITABLEDGE_FAVICON_PATH,
    label: "profitabledge - Dashboard",
    path: "/dashboard",
    image: "/landing/dashboard-preview.png",
    alt: "Profitabledge dashboard preview",
  },
  {
    icon: PROFITABLEDGE_FAVICON_PATH,
    label: "profitabledge - Trades",
    path: "/dashboard/trades",
    image: "/landing/trades-preview.png",
    alt: "Profitabledge trades preview",
  },
  {
    icon: PROFITABLEDGE_FAVICON_PATH,
    label: "profitabledge - Reports",
    path: "/dashboard/reports",
    image: "/landing/reports-preview.png",
    alt: "Profitabledge reports preview",
  },
  {
    icon: PROFITABLEDGE_FAVICON_PATH,
    label: "profitabledge - Edges",
    path: "/dashboard/edges",
    image: "/landing/edges-preview.png",
    alt: "Profitabledge edges preview",
  },
  {
    icon: PROFITABLEDGE_FAVICON_PATH,
    label: "profitabledge - Journal",
    path: "/dashboard/journal",
    image: "/landing/journal-preview.png",
    alt: "Profitabledge journal preview",
  },
  {
    icon: PROFITABLEDGE_FAVICON_PATH,
    label: "profitabledge - Goals",
    path: "/dashboard/goals",
    image: "/landing/goals-preview.png",
    alt: "Profitabledge goals preview",
  },

  {
    icon: PROFITABLEDGE_FAVICON_PATH,
    label: "profitabledge - Prop tracker",
    path: "/dashboard/prop-tracker",
    image: "/landing/prop-preview.png",
    alt: "Profitabledge prop tracker preview",
  },
  {
    icon: PROFITABLEDGE_FAVICON_PATH,
    label: "profitabledge - Assistant",
    path: "/dashboard/assistant",
    image: "/landing/assistant-preview.png",
    alt: "Profitabledge assistant preview",
  },
];

const LANDING_PREVIEW_WIDTH = 3423;
const LANDING_PREVIEW_HEIGHT = 1277;

interface HeroProps {
  heroOpacity: MotionValue<number>;
}

export function Hero({ heroOpacity }: HeroProps) {
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isBrowserHovered, setIsBrowserHovered] = useState(false);
  const shouldAutoCycle = isAutoPlaying && !isBrowserHovered;

  const goToPreview = (nextIndex: number) => {
    const previewCount = LANDING_PREVIEWS.length;
    setActivePreviewIndex((nextIndex + previewCount) % previewCount);
  };

  const goToPreviousPreview = () => {
    setActivePreviewIndex((current) => {
      const previewCount = LANDING_PREVIEWS.length;
      return (current - 1 + previewCount) % previewCount;
    });
  };

  const goToNextPreview = () => {
    setActivePreviewIndex((current) => (current + 1) % LANDING_PREVIEWS.length);
  };

  useEffect(() => {
    if (!shouldAutoCycle) {
      return;
    }

    const interval = window.setInterval(() => {
      goToNextPreview();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [activePreviewIndex, shouldAutoCycle]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();

      if (
        target?.isContentEditable ||
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select"
      ) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goToPreviousPreview();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goToNextPreview();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const activePreview = LANDING_PREVIEWS[activePreviewIndex];

  return (
    <motion.section
      style={{ opacity: heroOpacity }}
      className="relative z-10 flex h-screen flex-col items-center justify-center px-6 pb-0 md:h-auto md:items-start md:justify-start md:px-8 md:pt-12 lg:px-12 lg:pt-20 xl:px-16 xl:pt-24 2xl:px-20 2xl:pt-40! 3xl:px-28 3xl:pt-48!"
    >
      {/* Background illustration */}
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat opacity-50"
        style={{
          backgroundImage: "url(/landing/hero-background.svg)",
        }}
      />

      {/* Navbar */}
      <motion.nav
        className="absolute top-0 left-0 right-0 z-20 flex w-full items-center justify-evenly px-6 py-5 md:px-8 md:py-6 lg:px-12 xl:px-16 2xl:px-20 3xl:px-28 will-change-transform"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 5,
          ease: [0.16, 1, 0.3, 1],
          delay: 1.5,
        }}
      >
        <Link
          href="/"
          className="text-xl md:text-2xl font-bold text-white tracking-[-0.07em] w-full"
        >
          profitabledge
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-[13px] text-white/60 transition-colors hover:text-white w-max"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="w-full flex justify-end">
          <Link
            href="/login"
            className="glass-btn relative w-max flex flex-row items-center justify-center gap-1.5 rounded-full bg-[rgba(17,17,17,0.25)] py-2.5 px-3 md:py-3 md:pr-5 md:pl-6 text-xs font-medium text-white backdrop-blur-[15px] transition-all hover:brightness-125 active:scale-99"
          >
            <Image
              src="/landing/fingerprint.svg"
              alt=""
              width={16}
              height={16}
            />
            <span className="hidden md:inline">Build your edge</span>
          </Link>
        </div>
      </motion.nav>

      <div className="flex w-full flex-col gap-6 md:flex-row md:items-end md:justify-between h-[7.5rem] pb-2 mt-12">
        {/* Heading */}
        <motion.div
          className="will-change-transform"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 5,
            ease: [0.16, 1, 0.3, 1],
            delay: 0.25,
          }}
        >
          <h1
            className="text-3xl font-semibold leading-[1.1] tracking-[-0.04em] bg-clip-text text-transparent sm:text-4xl md:text-5xl lg:text-6xl xl:text-6xl! 2xl:text-5xl! 3xl:text-7xl!"
            style={{
              backgroundImage:
                "radial-gradient(ellipse at top left, #fff 0%, rgba(255,255,255,0.75) 59%, rgba(255,255,255,0.20) 100%)",
            }}
          >
            Turn your trading data
            <br />
            into your own profitable edge
          </h1>
        </motion.div>

        {/* Join waitlist button */}
        <motion.div
          className="shrink-0 will-change-transform"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 5,
            ease: [0.16, 1, 0.3, 1],
            delay: 0.25,
          }}
        >
          <Link
            href="/sign-up"
            className="glass-btn relative flex flex-row items-center justify-center gap-1.5 rounded-full bg-[rgba(17,17,17,0.25)] py-3 pr-5 pl-6 text-xs font-semibold text-white backdrop-blur-[15px] transition-all hover:brightness-125 active:scale-99"
          >
            Join waitlist
          </Link>
        </motion.div>
      </div>

      {/* Browser Mockup */}
      <div
        className="mt-6 w-full md:mt-8 lg:mt-10 xl:mt-12 2xl:mt-10 3xl:mt-16 overflow-hidden"
        style={{
          maskImage:
            "radial-gradient(ellipse 95% 75% at 50% 25%, #fff 0%, #fff 60%, rgba(255,255,255,0.4) 75%, rgba(255,255,255,0.1) 85%, rgba(0,0,0,0) 95%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 95% 75% at 50% 25%, #fff 0%, #fff 60%, rgba(255,255,255,0.4) 75%, rgba(255,255,255,0.1) 85%, rgba(0,0,0,0) 95%)",
        }}
      >
        <motion.div
          className="will-change-transform"
          initial={{ y: "100%" }}
          animate={{ y: "0%" }}
          onMouseEnter={() => setIsBrowserHovered(true)}
          onMouseLeave={() => setIsBrowserHovered(false)}
          transition={{
            duration: 4,
            ease: [0.4, 0.8, 0.2, 1],
            delay: 1.5,
          }}
        >
          <div className="w-full">
            <div className="overflow-hidden rounded-t-xl border border-b-0 border-white/[0.08] bg-[#1a1a1e] shadow-2xl shadow-black/50">
              {/* Browser top bar */}
              <div className="flex items-center gap-2 md:gap-3 border-b border-white/[0.06] bg-[#1e1e22] px-3 py-2 md:px-4 md:py-3">
                {/* Traffic lights */}
                <div className="flex items-center gap-1 md:gap-1.5">
                  <div className="size-2.5 md:size-3 rounded-full bg-[#ff5f57]" />
                  <div className="size-2.5 md:size-3 rounded-full bg-[#febc2e]" />
                  <div className="size-2.5 md:size-3 rounded-full bg-[#28c840]" />
                </div>

                {/* Navigation arrows */}
                <div className="ml-2 hidden sm:flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Previous preview"
                    onClick={goToPreviousPreview}
                    className="flex size-7 cursor-pointer items-center justify-center rounded-md text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label="Next preview"
                    onClick={goToNextPreview}
                    className="flex size-7 cursor-pointer items-center justify-center rounded-md text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                </div>

                {/* URL bar */}
                <div className="mx-4 flex flex-1 items-center justify-center">
                  <div className="relative flex h-8 w-full max-w-lg items-center overflow-hidden rounded-lg bg-white/[0.05] px-4">
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-10">
                      <div className="flex min-w-0 items-center justify-center gap-0.5 text-center">
                        <span className="shrink-0 text-xs text-white/65">
                          profitabledge.com
                        </span>
                        <span className="truncate text-xs text-white/35">
                          {activePreview.path}
                        </span>
                      </div>
                    </div>
                    <svg
                      className="ml-auto size-3 shrink-0 text-white/30"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9" />
                    </svg>
                  </div>
                </div>

                {/* Right icons */}
                <div className="hidden sm:flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={
                      isAutoPlaying ? "Pause autoplay" : "Play autoplay"
                    }
                    onClick={() => setIsAutoPlaying((current) => !current)}
                    className="flex h-7 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2.5 text-white/35 transition-colors hover:bg-white/5 hover:text-white/70"
                  >
                    {isAutoPlaying ? (
                      <Pause className="size-3.5" />
                    ) : (
                      <Play className="size-3.5 fill-current" />
                    )}
                    <span className="text-[10px]">
                      {isAutoPlaying ? "Pause" : "Play"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Browser tabs bar */}
              <div className="hidden overflow-x-auto border-b border-white/[0.06] bg-[#161618] md:block">
                <div className="flex min-w-max items-center">
                  {LANDING_PREVIEWS.map((tab, index) => (
                    <button
                      key={tab.label}
                      type="button"
                      onClick={() => setActivePreviewIndex(index)}
                      className={`relative flex w-[260px] shrink-0 cursor-pointer items-center gap-2 border-r border-white/[0.06] px-4 py-2.5 text-left transition-colors ${
                        index === activePreviewIndex
                          ? "bg-[#1e1e22]"
                          : "bg-transparent text-white/40 hover:bg-white/[0.03]"
                      }`}
                    >
                      {tab.icon && (
                        <Image
                          src={tab.icon}
                          alt=""
                          width={14}
                          height={14}
                          className="shrink-0"
                        />
                      )}
                      <span
                        className={`truncate text-[11px] transition-colors ${
                          index === activePreviewIndex
                            ? "text-white/70"
                            : "text-white/40"
                        }`}
                      >
                        {tab.label}
                      </span>
                      {index === activePreviewIndex ? (
                        <>
                          <motion.span
                            layoutId="landing-browser-tab-highlight"
                            className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-white/12"
                          />
                          <span
                            key={`${activePreviewIndex}-${
                              shouldAutoCycle ? "running" : "paused"
                            }`}
                            className="pointer-events-none absolute inset-x-0 bottom-0 h-px origin-left bg-white/60"
                            style={{
                              animation:
                                "landing-tab-progress 5000ms linear forwards",
                              animationPlayState: shouldAutoCycle
                                ? "running"
                                : "paused",
                            }}
                          />
                        </>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>

              {/* Browser preview */}
              <div
                className="relative w-full bg-[#111114]"
                style={{
                  aspectRatio: `${LANDING_PREVIEW_WIDTH} / ${LANDING_PREVIEW_HEIGHT}`,
                }}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={activePreview.image}
                    className="absolute inset-0"
                    initial={{ opacity: 0, scale: 1.02, filter: "blur(12px)" }}
                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, scale: 0.985, filter: "blur(10px)" }}
                    transition={{
                      duration: 0.75,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    <Image
                      src={activePreview.image}
                      alt={activePreview.alt}
                      width={LANDING_PREVIEW_WIDTH}
                      height={LANDING_PREVIEW_HEIGHT}
                      unoptimized
                      quality={100}
                      className="h-full w-full object-cover"
                      priority={activePreviewIndex === 0}
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
      <style jsx global>{`
        @keyframes landing-tab-progress {
          0% {
            transform: scaleX(0);
            opacity: 0.35;
          }

          100% {
            transform: scaleX(1);
            opacity: 0.9;
          }
        }
      `}</style>
    </motion.section>
  );
}
