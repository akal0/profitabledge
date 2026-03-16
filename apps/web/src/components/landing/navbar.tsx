"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "#features", label: "Features" },
  { href: "#changelog", label: "Changelog" },
  { href: "#brokers", label: "Brokers & integrations" },
  { href: "#pricing", label: "Pricing" },
  { href: "#resources", label: "Resources" },
];

export function Navbar() {
  return (
    <motion.nav
      className="relative z-20 flex w-full items-center justify-evenly px-6 py-5 md:px-8 md:py-6 lg:px-12 xl:px-16 2xl:px-20 3xl:px-28 will-change-transform"
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
  );
}
