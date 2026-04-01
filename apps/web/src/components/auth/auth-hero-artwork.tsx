"use client";

import { cn } from "@/lib/utils";

export function AuthHeroArtwork({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full overflow-hidden bg-[#050505]",
        className
      )}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[url('/landing/hero-background.svg')] bg-cover bg-center bg-no-repeat opacity-20" />
      <div className="absolute inset-y-0 left-0 w-[42%] bg-[radial-gradient(115%_130%_at_-18%_50%,#050505_0,#050505_38%,rgba(5,5,5,0.96)_50%,rgba(5,5,5,0.72)_62%,rgba(5,5,5,0.34)_76%,transparent_100%)]" />
    </div>
  );
}
