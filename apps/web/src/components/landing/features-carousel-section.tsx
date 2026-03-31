"use client";

import Image from "next/image";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useInView } from "motion/react";
import * as m from "motion/react-m";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "./use-mobile";

const SECTION_KICKER_STYLE = {
  backgroundImage:
    "radial-gradient(110% 150% at 50% 0%, #00ff7a 0%, #e9f3eb 94%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
  color: "transparent",
} as const;

const SECTION_TITLE_STYLE = {
  backgroundImage:
    "linear-gradient(180deg, #fff 0%, rgba(255,255,255,0.7) 100%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
  color: "transparent",
} as const;

const FEATURE_SLIDES = [
  {
    title: "Your trading week, summed up in style",
    description:
      "It’s like having a coach, a data nerd, and a cheerleader all in one place. See what worked, what didn’t, and where you can improve, all in a dashboard that actually makes you want to journal.",
    mediaType: "video" as const,
    src: "/landing/features-carousel/customize.mp4",
    alt: "Profitabledge dashboard weekly summary preview",
  },
  {
    title: "Minimal navigation, maximum focus",
    description:
      "Navigate faster, journal smarter. Everything’s designed to keep you in the flow — no distractions, just trading insights and the shortcuts that get you there faster.",
    mediaType: "video" as const,
    src: "/landing/features-carousel/assistant.mp4",
    alt: "Profitabledge assistant and navigation preview",
  },
  {
    title: "Reports that show what actually matters",
    description:
      "Break down performance, execution, risk, and setup quality with views that make trends obvious. No spreadsheet mess, no hunting for patterns, just answers.",
    mediaType: "image" as const,
    src: "/landing/reports-preview.png",
    alt: "Profitabledge reports preview",
  },
  {
    title: "A trade journal that keeps up with you",
    description:
      "Capture context, review execution, and keep your trade history attached to the lessons that matter. The result is a journal you’ll actually come back to.",
    mediaType: "image" as const,
    src: "/landing/journal-preview.png",
    alt: "Profitabledge journal preview",
  },
] as const;

const DESKTOP_SHIFT_PERCENT = 81.5;
const FEATURE_PREVIEW_WIDTH = 3440;
const FEATURE_PREVIEW_HEIGHT = 1440;
const IMAGE_SLIDE_DURATION_MS = 15000;

const FeatureSlide = memo(function FeatureSlide({
  slide,
  isActive,
  isMobile,
  shouldAutoplay,
  onAdvance,
  onProgressChange,
  onSelect,
}: {
  slide: (typeof FEATURE_SLIDES)[number];
  isActive: boolean;
  isMobile: boolean;
  shouldAutoplay: boolean;
  onAdvance: () => void;
  onProgressChange: (value: number) => void;
  onSelect: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || slide.mediaType !== "video") {
      return;
    }

    if (shouldAutoplay && isActive) {
      void video.play().catch(() => undefined);
      return;
    }

    video.pause();
    video.currentTime = 0;
    onProgressChange(0);
  }, [isActive, onProgressChange, shouldAutoplay, slide.mediaType]);

  return (
    <m.article
      className={cn(
        "w-full shrink-0 basis-full transition-all duration-500 md:w-[80%] md:basis-[80%]",
        isActive ? "opacity-100" : isMobile ? "opacity-0" : "opacity-28"
      )}
    >
      <div className="relative overflow-hidden rounded-[28px] ring ring-white/[0.08] bg-[#111111] p-2 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.04),transparent_30%),radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.03),transparent_26%)]" />
        <div className="relative overflow-hidden rounded-[22px] ring ring-white/[0.05] bg-[#0c0c0f]">
          <div className="pointer-events-none absolute inset-0 z-20">
            <Image
              src="/assets/noise.png"
              alt=""
              fill
              className="object-cover opacity-50 mix-blend-soft-light"
              unoptimized
            />
          </div>

          <button
            type="button"
            onClick={onSelect}
            aria-label={`View ${slide.title} feature slide`}
            className="relative z-0 block w-full cursor-pointer overflow-hidden text-left"
            style={{
              aspectRatio: `${FEATURE_PREVIEW_WIDTH} / ${FEATURE_PREVIEW_HEIGHT}`,
            }}
          >
            {slide.mediaType === "video" ? (
              <video
                ref={videoRef}
                src={slide.src}
                muted
                playsInline
                preload={isActive ? "auto" : "metadata"}
                onLoadedMetadata={(event) => {
                  const duration = event.currentTarget.duration;
                  onProgressChange(
                    duration > 0
                      ? event.currentTarget.currentTime / duration
                      : 0
                  );
                }}
                onTimeUpdate={(event) => {
                  const duration = event.currentTarget.duration;
                  onProgressChange(
                    duration > 0
                      ? event.currentTarget.currentTime / duration
                      : 0
                  );
                }}
                onEnded={() => {
                  onProgressChange(1);
                  onAdvance();
                }}
                className="h-full w-full object-cover object-center"
              />
            ) : (
              <Image
                src={slide.src}
                alt={slide.alt}
                fill
                className="object-contain object-center"
                unoptimized
                quality={100}
              />
            )}

            <div className="pointer-events-none absolute inset-0 z-10">
              <Image
                src="/assets/noise.png"
                alt=""
                fill
                className="object-cover opacity-65 mix-blend-soft-light"
                unoptimized
              />
            </div>
          </button>
        </div>
      </div>

      <div className="mt-6 max-w-3xl pr-4">
        <h3
          className="text-3xl font-semibold leading-[1.08] tracking-[-0.035em] text-white sm:text-2xl"
          style={SECTION_TITLE_STYLE}
        >
          {slide.title}
        </h3>
        <p className="mt-2 max-w-2xl text-base leading-6 text-white/40 sm:text-sm">
          {slide.description}
        </p>
      </div>
    </m.article>
  );
},
(previous, next) =>
  previous.slide === next.slide &&
  previous.isActive === next.isActive &&
  previous.isMobile === next.isMobile &&
  previous.shouldAutoplay === next.shouldAutoplay
);

export function FeaturesCarouselSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [current, setCurrent] = useState(0);
  const [progress, setProgress] = useState(0);
  const isMobile = useIsMobile();
  const isInView = useInView(sectionRef, {
    amount: 0.35,
  });
  const total = FEATURE_SLIDES.length;
  const currentSlide = FEATURE_SLIDES[current];

  const next = () => setCurrent((prev) => Math.min(prev + 1, total - 1));
  const prev = () => setCurrent((prev) => Math.max(prev - 1, 0));
  const advance = useCallback(() => {
    setCurrent((prev) => (prev + 1) % total);
  }, [total]);

  useEffect(() => {
    setProgress(0);
  }, [current]);

  useEffect(() => {
    if (!isInView || total <= 1 || currentSlide.mediaType === "video") {
      return;
    }

    let frameId = 0;
    const startedAt = performance.now();

    const updateProgress = (now: number) => {
      const nextProgress = Math.min(
        (now - startedAt) / IMAGE_SLIDE_DURATION_MS,
        1
      );
      setProgress(nextProgress);

      if (nextProgress >= 1) {
        advance();
        return;
      }

      frameId = window.requestAnimationFrame(updateProgress);
    };

    frameId = window.requestAnimationFrame(updateProgress);

    return () => window.cancelAnimationFrame(frameId);
  }, [advance, currentSlide.mediaType, isInView, total]);

  return (
    <section
      ref={sectionRef}
      id="features"
      className="relative w-full overflow-hidden px-6 py-20 md:px-8 lg:px-12 xl:px-16 2xl:px-20 3xl:px-28"
      style={{
        contentVisibility: "auto",
        containIntrinsicSize: "1px 1200px",
      }}
    >
      <div className="mb-6 flex flex-col md:mb-6">
        <div className="max-w-5xl">
          <p
            className="mb-2 inline-block text-sm font-medium text-transparent"
            style={SECTION_KICKER_STYLE}
          >
            Features
          </p>
          <h2
            className="max-w-3xl text-3xl font-semibold leading-[1.22] tracking-[-0.04em] sm:text-xl md:text-2xl"
            style={SECTION_TITLE_STYLE}
          >
            profitabledge turns complex trading data into simple insights with a
            built-in intelligence partner. Spot weaknesses, double down on
            strengths, and journal effortlessly with a clean, intuitive
            interface.
          </h2>
        </div>

        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <p
            className="max-w-5xl text-3xl font-semibold leading-[1.18] tracking-[-0.035em] text-white sm:text-2xl md:text-2xl"
            style={SECTION_TITLE_STYLE}
          >
            Everyone deserves to be profitable — now you’ve got the tool to make
            it happen.
          </p>

          <div className="flex items-center gap-3 md:shrink-0">
            <button
              type="button"
              onClick={prev}
              disabled={current === 0}
              className={cn(
                "glass-btn relative flex size-16 cursor-pointer items-center justify-center rounded-full bg-[rgba(17,17,17,0.25)] text-white backdrop-blur-[15px] transition-all hover:brightness-125 active:scale-99",
                current === 0 &&
                  "cursor-not-allowed opacity-45 hover:brightness-100 active:scale-100"
              )}
            >
              <ChevronLeft className="size-5" />
            </button>

            <button
              type="button"
              onClick={next}
              disabled={current === total - 1}
              className={cn(
                "glass-btn relative flex size-16 cursor-pointer items-center justify-center rounded-full bg-[rgba(17,17,17,0.25)] text-white backdrop-blur-[15px] transition-all hover:brightness-125 active:scale-99",
                current === total - 1 &&
                  "cursor-not-allowed opacity-45 hover:brightness-100 active:scale-100"
              )}
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="relative">
        <m.div
          className="flex gap-6 md:gap-8"
          animate={{
            x: `-${current * (isMobile ? 100 : DESKTOP_SHIFT_PERCENT)}%`,
          }}
          transition={{
            duration: 0.8,
            ease: [0.65, 0, 0.35, 1],
          }}
        >
          {FEATURE_SLIDES.map((slide, index) => (
            <FeatureSlide
              key={slide.title}
              slide={slide}
              isActive={index === current}
              isMobile={isMobile}
              shouldAutoplay={isInView}
              onAdvance={advance}
              onProgressChange={setProgress}
              onSelect={() => setCurrent(index)}
            />
          ))}
        </m.div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {FEATURE_SLIDES.map((slide, index) => (
            <button
              key={slide.title}
              type="button"
              aria-label={`Go to slide ${index + 1}`}
              onClick={() => setCurrent(index)}
              className={cn(
                "relative h-1.5 w-10 cursor-pointer overflow-hidden rounded-full transition-all duration-300",
                index === current ? "bg-white/16" : "bg-white/12 hover:bg-white/18"
              )}
            >
              <span className="absolute inset-0 bg-white/12" />
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-white/85 transition-[width] duration-200 ease-out"
                style={{
                  width:
                    index === current
                      ? `${Math.max(0, Math.min(progress, 1)) * 100}%`
                      : "0%",
                }}
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
