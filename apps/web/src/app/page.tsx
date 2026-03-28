"use client";

import { useState } from "react";
import { AnimatePresence, useScroll, useTransform } from "motion/react";
import { GlassBtnStyles } from "@/components/landing/glass-btn-styles";
import { Preloader } from "@/components/landing/preloader";
import { Hero } from "@/components/landing/hero";
import { SmartSignalsSection } from "@/components/landing/smart-signals-section";
import { BrokersSection } from "@/components/landing/brokers-section";

export default function Home() {
  const [preloaderDone, setPreloaderDone] = useState(false);
  const [showContent, setShowContent] = useState(false);

  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 1200], [1, 0]);

  return (
    <>
      <GlassBtnStyles />
      <main className="relative flex min-h-screen h-[300vh] w-full flex-col bg-black overflow-x-hidden">
        {/* Preload heavy assets during preloader */}
        <link rel="preload" href="/landing/hero-background.svg" as="image" />
        <link rel="preload" href="/landing/dashboard-preview.png" as="image" />
        <link rel="preload" href="/landing/trades-preview.png" as="image" />
        <link rel="preload" href="/landing/reports-preview.png" as="image" />
        <link rel="preload" href="/landing/edges-preview.png" as="image" />
        <link rel="preload" href="/landing/journal-preview.png" as="image" />
        <link rel="preload" href="/landing/goals-preview.png" as="image" />
        <link rel="preload" href="/landing/assistant-preview.png" as="image" />
        <link rel="preload" href="/landing/prop-preview.png" as="image" />

        {/* Preloader */}
        <AnimatePresence onExitComplete={() => setShowContent(true)}>
          {!preloaderDone && (
            <Preloader onDone={() => setPreloaderDone(true)} />
          )}
        </AnimatePresence>

        {/* Main content */}
        <AnimatePresence>
          {showContent && <Hero heroOpacity={heroOpacity} />}
        </AnimatePresence>

        {/* Feature sections */}
        {showContent && <SmartSignalsSection />}
        {showContent && <BrokersSection />}
      </main>
    </>
  );
}
