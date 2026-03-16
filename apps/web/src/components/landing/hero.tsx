"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, MotionValue } from "motion/react";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "#features", label: "Features" },
  { href: "#changelog", label: "Changelog" },
  { href: "#brokers", label: "Brokers & integrations" },
  { href: "#pricing", label: "Pricing" },
  { href: "#resources", label: "Resources" },
];

const BROWSER_TABS = [
  {
    icon: "/landing/tab-pe.svg",
    label: "profitabledge: Turn your trading data into your profitable edge.",
    active: true,
  },
  {
    icon: "/landing/tab-tv.svg",
    label: "TradingView — Track All Markets",
    active: false,
  },
  {
    icon: "/landing/tab-ftmo.svg",
    label: "FTMO | The Modern Prop Trading",
    active: false,
  },
  {
    icon: "/landing/tab-notion.svg",
    label: "The AI workspace that works",
    active: false,
  },
];

interface HeroProps {
  heroOpacity: MotionValue<number>;
}

export function Hero({ heroOpacity }: HeroProps) {
  return (
    <motion.section
      style={{ opacity: heroOpacity }}
      className="relative z-10 flex h-screen flex-col items-center justify-center px-6 pb-0 md:h-auto md:items-start md:justify-start md:px-8 md:pt-12 lg:px-12 lg:pt-20 xl:px-16 xl:pt-24 2xl:px-20 2xl:pt-40! 3xl:px-28 3xl:pt-48!"
    >
      {/* Background illustration */}
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
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
          duration: 0.6,
          ease: [0.16, 1, 0.3, 1],
          delay: 0,
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
            <span className="hidden md:inline">Discover your edge</span>
          </Link>
        </div>
      </motion.nav>

      <div className="flex w-full flex-col gap-6 md:flex-row md:items-end md:justify-between">
        {/* Heading */}
        <motion.div
          className="will-change-transform"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.7,
            ease: [0.16, 1, 0.3, 1],
            delay: 0.15,
          }}
        >
          <h1
            className="text-3xl font-semibold leading-[1.05] tracking-[-0.04em] bg-clip-text text-transparent sm:text-4xl md:text-5xl lg:text-6xl xl:text-6xl! 2xl:text-5xl! 3xl:text-7xl!"
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
            duration: 0.6,
            ease: [0.16, 1, 0.3, 1],
            delay: 0.3,
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
          transition={{
            duration: 2.2,
            ease: [0.12, 0.8, 0.2, 1],
            delay: 0.4,
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
                  <button className="flex size-7 items-center justify-center rounded-md text-white/40 hover:bg-white/5">
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
                  <button className="flex size-7 items-center justify-center rounded-md text-white/40 hover:bg-white/5">
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
                  <div className="flex h-8 w-full max-w-md items-center justify-center rounded-lg bg-white/[0.05] px-4">
                    <span className="text-xs text-white/50">
                      profitabledge.com
                    </span>
                    <svg
                      className="ml-2 size-3 text-white/30"
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
                  <button className="flex size-7 items-center justify-center rounded-md text-white/30 hover:bg-white/5">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                      <polyline points="16,6 12,2 8,6" />
                      <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                  </button>
                  <button className="flex size-7 items-center justify-center rounded-md text-white/30 hover:bg-white/5">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>
                  <button className="flex size-7 items-center justify-center rounded-md text-white/30 hover:bg-white/5">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Browser tabs bar */}
              <div className="hidden md:flex items-center border-b border-white/[0.06] bg-[#161618]">
                {BROWSER_TABS.map((tab) => (
                  <div
                    key={tab.label}
                    className={`flex max-w-[260px] flex-1 items-center gap-2 border-r border-white/[0.06] px-4 py-2.5 ${
                      tab.active
                        ? "bg-[#1e1e22]"
                        : "bg-transparent text-white/40"
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
                    <span className="truncate text-[11px] text-white/60">
                      {tab.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Dashboard screenshot */}
              <div className="relative aspect-[3564/1884] w-full bg-[#111114]">
                <Image
                  src="/landing/dashboard-preview.png"
                  alt="ProfitabEdge Dashboard"
                  fill
                  className="object-fill"
                  priority
                />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}
