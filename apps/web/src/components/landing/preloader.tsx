"use client";

import { motion } from "motion/react";
import { useTypewriter, TYPING_SEQUENCES } from "./use-typewriter";

interface PreloaderProps {
  onDone: () => void;
}

export function Preloader({ onDone }: PreloaderProps) {
  const { displayText, sequenceIndex, skip } = useTypewriter(() => {
    setTimeout(() => onDone(), 200);
  });

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black"
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
    >
      <motion.div
        className="flex h-12 w-full max-w-xl items-center rounded-2xl border border-white/[0.08] bg-[#1a1a1e] px-5 mx-8 shadow-2xl shadow-black/50"
        initial={{ opacity: 0, y: 10, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        {/* Search icon */}
        <svg
          className="mr-3 size-4 shrink-0 text-white/30"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <span className="text-sm text-white/60">{displayText}</span>
        <motion.span
          className="ml-[1px] inline-block h-[18px] w-[2px] bg-white/60"
          animate={{ opacity: [1, 0] }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            repeatType: "reverse",
          }}
        />
        {/* Sequence dots */}
        <div className="ml-auto flex items-center gap-1.5">
          {TYPING_SEQUENCES.map((_, i) => (
            <div
              key={i}
              className={`size-1.5 rounded-full transition-colors duration-300 ${
                i <= sequenceIndex ? "bg-white/40" : "bg-white/10"
              }`}
            />
          ))}
        </div>
      </motion.div>

      {/* Skip button */}
      <button
        onClick={() => {
          skip();
          onDone();
        }}
        className="glass-btn absolute bottom-8 right-8 rounded-full bg-[rgba(17,17,17,0.25)] px-5 py-2.5 text-xs font-medium text-white backdrop-blur-[15px] transition-all hover:brightness-125 active:scale-99 cursor-pointer"
      >
        Skip
      </button>
    </motion.div>
  );
}
