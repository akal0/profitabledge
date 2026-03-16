"use client";

import { useState } from "react";
import { AnimatePresence, useScroll, useTransform } from "motion/react";
import { GlassBtnStyles } from "@/components/landing/glass-btn-styles";
import { Preloader } from "@/components/landing/preloader";
import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";

export default function Home() {
  const [preloaderDone, setPreloaderDone] = useState(false);
  const [showContent, setShowContent] = useState(false);

  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 1200], [1, 0]);

  return (
    <>
      <GlassBtnStyles />
      <main className="relative flex min-h-screen h-[300vh] w-full flex-col bg-black overflow-x-hidden">
        {/* Background illustration */}
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{
            backgroundImage: "url(/landing/hero-background.svg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        />

        {/* Preload heavy assets during preloader */}
        <link rel="preload" href="/landing/hero-background.svg" as="image" />
        <link rel="preload" href="/landing/dashboard-preview.png" as="image" />

        {/* Preloader */}
        <AnimatePresence onExitComplete={() => setShowContent(true)}>
          {!preloaderDone && (
            <Preloader onDone={() => setPreloaderDone(true)} />
          )}
        </AnimatePresence>

        {/* Main content */}
        <AnimatePresence>
          {showContent && (
            <>
              <Navbar />
              <Hero heroOpacity={heroOpacity} />
            </>
          )}
        </AnimatePresence>
      </main>
    </>
  );
}
