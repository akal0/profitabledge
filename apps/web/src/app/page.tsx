"use client";

import { useState } from "react";
import {
  AnimatePresence,
  LazyMotion,
  domMax,
  useScroll,
  useTransform,
} from "motion/react";
import { GlassBtnStyles } from "@/components/landing/glass-btn-styles";
import { FeaturesCarouselSection } from "@/components/landing/features-carousel-section";
import { Preloader } from "@/components/landing/preloader";
import { Hero } from "@/components/landing/hero";
import {
  PricingFaqSection,
  PricingSection,
} from "@/components/landing/pricing-section";
import { SmartSignalsSection } from "@/components/landing/smart-signals-section";
import { BrokersSection } from "@/components/landing/brokers-section";

export default function Home() {
  const [preloaderDone, setPreloaderDone] = useState(false);
  const [heroTargetMounted, setHeroTargetMounted] = useState(false);

  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 1200], [1, 0]);

  return (
    <>
      <GlassBtnStyles />
      <LazyMotion features={domMax} strict>
        <main className="relative flex min-h-screen h-full w-full flex-col bg-black overflow-x-hidden">
          {/* Preload only the assets needed for the first landing paint. */}
          <link rel="preload" href="/landing/hero-background.svg" as="image" />
          <link
            rel="preload"
            href="/landing/dashboard-preview.png"
            as="image"
          />
          <link rel="preload" href="/landing/trades-preview.png" as="image" />

          <AnimatePresence>
            {!preloaderDone && (
              <Preloader
                onHandoffStart={() => setHeroTargetMounted(true)}
                onDone={() => setPreloaderDone(true)}
              />
            )}
          </AnimatePresence>

          {(heroTargetMounted || preloaderDone) && (
            <Hero
              heroOpacity={heroOpacity}
              isReady={preloaderDone}
              isVisible={heroTargetMounted || preloaderDone}
            />
          )}

          {preloaderDone && (
            <>
              <FeaturesCarouselSection />
              <SmartSignalsSection />
              <BrokersSection />
              <PricingSection />
              <PricingFaqSection />
            </>
          )}
        </main>
      </LazyMotion>
    </>
  );
}
