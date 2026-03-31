"use client";

import Image from "next/image";
import { useState } from "react";
import * as m from "motion/react-m";
import { PROFITABLEDGE_FAVICON_PATH } from "@/lib/brand-assets";
import { useTypewriter, TYPING_SEQUENCES } from "./use-typewriter";

interface PreloaderProps {
  onDone: () => void;
  onHandoffStart?: () => void;
}

const PRELOADER_HANDOFF_FADE_MS = 180;
const PRELOADER_TABS = [
  "profitabledge - Dashboard",
  "profitabledge - Trades",
  "profitabledge - Reports",
  "profitabledge - Edges",
  "profitabledge - Journal",
  "profitabledge - Goals",
  "profitabledge - Prop tracker",
  "profitabledge - Assistant",
];
const PRELOADER_PREVIEW_WIDTH = 3423;
const PRELOADER_PREVIEW_HEIGHT = 1277;

export function Preloader({ onDone, onHandoffStart }: PreloaderProps) {
  const [isHandingOff, setIsHandingOff] = useState(false);
  const { displayText, sequenceIndex, skip } = useTypewriter(() => {
    onHandoffStart?.();
    setIsHandingOff(true);
    window.setTimeout(() => onDone(), PRELOADER_HANDOFF_FADE_MS);
  });

  return (
    <m.div
      className="fixed inset-0 z-50 overflow-hidden"
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
    >
      {/* Black background overlay */}
      <div className="absolute inset-0 bg-black" />

      <div className="relative flex h-screen flex-col items-center justify-center px-6 pb-0 md:items-start md:justify-start md:px-8 md:pt-12 lg:px-12 lg:pt-20 xl:px-16 xl:pt-24 2xl:px-20 2xl:pt-40! 3xl:px-28 3xl:pt-48!">
        <div className="pointer-events-none flex h-[7.5rem] w-full flex-col gap-6 pb-2 opacity-0 md:mt-12 md:flex-row md:items-end md:justify-between" />

        <div className="mt-6 w-full overflow-hidden md:mt-8 lg:mt-10 xl:mt-12 2xl:mt-10 3xl:mt-16">
          <m.div
            className="relative z-10 w-full overflow-hidden rounded-t-xl border border-b-0 border-white/[0.08] bg-[#1a1a1e] shadow-2xl shadow-black/50"
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              duration: 0.5,
              ease: "easeOut",
            }}
          >
            {/* Browser top bar */}
            <div className="flex items-center gap-2 border-b border-white/[0.06] bg-[#1e1e22] px-3 py-2 md:gap-3 md:px-4 md:py-3">
              <div className="flex shrink-0 items-center gap-1 md:gap-1.5">
                <div className="size-2.5 rounded-full bg-[#ff5f57] md:size-3" />
                <div className="size-2.5 rounded-full bg-[#febc2e] md:size-3" />
                <div className="size-2.5 rounded-full bg-[#28c840] md:size-3" />
              </div>

              <div className="ml-2 hidden shrink-0 items-center gap-1 sm:flex">
                <div className="size-7 rounded-md border border-white/[0.03] bg-white/[0.02] opacity-35" />
                <div className="size-7 rounded-md border border-white/[0.03] bg-white/[0.02] opacity-35" />
              </div>

              <div className="mx-4 flex min-w-0 flex-1 items-center justify-center">
                <div className="relative flex h-8 w-full min-w-0 max-w-lg items-center overflow-hidden rounded-lg bg-white/[0.05] px-4">
                  <m.div
                    className="absolute inset-0"
                    animate={{ opacity: isHandingOff ? 0 : 1 }}
                    transition={{ duration: 0.14, ease: "easeOut" }}
                  >
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-10">
                      <div className="flex min-w-0 items-center justify-center gap-0.5 text-center">
                        <span className="truncate text-xs text-white/58">
                          {displayText}
                        </span>
                        <m.span
                          className="inline-block h-[14px] w-[1.5px] shrink-0 bg-white/60"
                          animate={{ opacity: [1, 0] }}
                          transition={{
                            duration: 0.6,
                            repeat: Infinity,
                            repeatType: "reverse",
                          }}
                        />
                      </div>
                    </div>
                    <svg
                      className="absolute top-1/2 right-4 size-3 shrink-0 -translate-y-1/2 text-white/30"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9" />
                    </svg>
                  </m.div>
                </div>
              </div>

              <div className="hidden shrink-0 items-center justify-end sm:flex">
                <m.div
                  className="flex h-7 min-w-[68px] items-center justify-end gap-1.5"
                  animate={{ opacity: isHandingOff ? 0 : 1 }}
                  transition={{ duration: 0.14, ease: "easeOut" }}
                >
                  {TYPING_SEQUENCES.map((_, i) => (
                    <div
                      key={i}
                      className="relative size-1.5 rounded-full transition-all duration-500"
                      style={{
                        backgroundColor:
                          i <= sequenceIndex
                            ? "rgba(255,255,255,0.82)"
                            : "rgba(255,255,255,0.22)",
                        boxShadow:
                          i === sequenceIndex
                            ? "0 0 8px 2px rgba(255,255,255,0.5), 0 0 18px 5px rgba(255,255,255,0.22)"
                            : i < sequenceIndex
                              ? "0 0 5px 1px rgba(255,255,255,0.22)"
                              : "none",
                      }}
                    />
                  ))}
                </m.div>
              </div>
            </div>

            <div className="hidden overflow-x-auto border-b border-white/[0.06] bg-[#161618] md:block">
              <div className="flex min-w-max items-center">
                {PRELOADER_TABS.map((tab, index) => (
                  <div
                    key={tab}
                    className={`relative flex w-[260px] shrink-0 items-center gap-2 border-r border-white/[0.06] px-4 py-2.5 text-left ${
                      index === 0 ? "bg-[#1e1e22]" : "bg-transparent"
                    }`}
                  >
                    <Image
                      src={PROFITABLEDGE_FAVICON_PATH}
                      alt=""
                      width={14}
                      height={14}
                      className="shrink-0 opacity-80"
                    />
                    <span
                      className={`truncate text-[11px] ${
                        index === 0 ? "text-white/70" : "text-white/35"
                      }`}
                    >
                      {tab}
                    </span>
                    {index === 0 ? (
                      <>
                        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-white/12" />
                        <m.span
                          className="pointer-events-none absolute inset-x-0 bottom-0 h-px origin-left bg-white/70"
                          initial={{ scaleX: 0, opacity: 0.35 }}
                          animate={{ scaleX: 1, opacity: 0.9 }}
                          transition={{
                            duration: 2.8,
                            ease: "linear",
                            repeat: Infinity,
                          }}
                        />
                      </>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div
              className="relative w-full bg-[#111114]"
              style={{
                aspectRatio: `${PRELOADER_PREVIEW_WIDTH} / ${PRELOADER_PREVIEW_HEIGHT}`,
              }}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.04),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0)_22%)]" />
            </div>
          </m.div>
        </div>
      </div>

      {/* Skip button */}
      <button
        onClick={() => {
          skip();
          onHandoffStart?.();
          setIsHandingOff(true);
          window.setTimeout(() => onDone(), PRELOADER_HANDOFF_FADE_MS);
        }}
        className="glass-btn absolute bottom-8 right-8 rounded-full bg-[rgba(17,17,17,0.25)] px-5 py-2.5 text-xs font-medium text-white backdrop-blur-[15px] transition-all hover:brightness-125 active:scale-99 cursor-pointer"
      >
        Skip
      </button>
    </m.div>
  );
}
