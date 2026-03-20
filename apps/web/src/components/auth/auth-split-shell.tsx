"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { AuthHeroArtwork } from "@/components/auth/auth-hero-artwork";
import { cn } from "@/lib/utils";

export interface AffiliateInfo {
  name: string;
  username: string | null;
  image: string | null;
}

interface AuthSplitShellProps {
  children: ReactNode;
  className?: string;
  heroEyebrow?: string;
  heroTitle?: string;
  heroDescription?: string;
  affiliate?: AffiliateInfo | null;
}

const DEFAULT_HERO_EYEBROW = "Trading review, rebuilt";
const DEFAULT_HERO_TITLE = "See the edge before the same mistake repeats.";
const DEFAULT_HERO_DESCRIPTION =
  "Turn raw fills, journal notes, and prop-account pressure into a review loop that actually sharpens your next session.";

export function AuthSplitShell({
  children,
  className,
  heroEyebrow = DEFAULT_HERO_EYEBROW,
  heroTitle = DEFAULT_HERO_TITLE,
  heroDescription = DEFAULT_HERO_DESCRIPTION,
  affiliate,
}: AuthSplitShellProps) {
  return (
    <div className="relative min-h-screen w-screen max-w-none overflow-hidden bg-[#050505] text-white">
      <div className="pointer-events-none absolute inset-0 lg:hidden">
        <div className="absolute inset-0 bg-[url('/landing/hero-background.svg')] bg-cover bg-center opacity-30" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_32%),rgba(5,5,5,0.88)]" />
      </div>

      <header className="absolute inset-x-0 top-0 z-20 px-6 py-6 sm:px-10 lg:px-14 xl:px-16">
        <Link
          href="/"
          className="inline-flex text-lg font-semibold tracking-[-0.08em] text-white sm:text-xl"
        >
          profitabledge
        </Link>
      </header>

      <div className="grid min-h-screen w-screen max-w-none lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <main className="relative z-10 flex min-h-screen min-w-0 items-center justify-center px-6 pb-12 pt-28 sm:px-10 lg:px-14 xl:px-16">
          <div className={cn("mx-auto w-full max-w-[31rem]", className)}>
            {children}
          </div>
        </main>

        <aside className="relative hidden min-h-screen min-w-0 overflow-hidden lg:block">
          <AuthHeroArtwork />

          {affiliate ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center">
              <div className="flex flex-col items-center gap-5">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-semibold tracking-[-0.08em] text-white">
                    profitabledge
                  </span>
                  <span className="text-sm font-medium text-white/40">
                    &times;
                  </span>
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
                <p className="max-w-md text-center text-sm leading-5.5 text-white/50">
                  You&apos;ve been invited to the sharpest trading journal on
                  the market. <br />
                  Are you ready to find your own profitable edge?
                </p>
              </div>
            </div>
          ) : (
            <div className="relative z-10 flex h-full items-end px-12 pb-12 xl:px-16 xl:pb-16">
              <div className="max-w-3xl space-y-2 drop-shadow-[0_10px_34px_rgba(0,0,0,0.42)]">
                <h2 className="max-full text-4xl font-semibold tracking-[-0.04em] text-white xl:text-[3rem] leading-12">
                  {heroTitle}
                </h2>
                <p className="max-w-md mt-2 text-sm leading-5.5 text-white/58 xl:text-[15px]">
                  {heroDescription}
                </p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
