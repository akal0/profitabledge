"use client";

import { cn } from "@/lib/utils";

export function AuthHeroArtwork({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full overflow-hidden bg-[#050505] bg-[url('/landing/hero-background.svg')] bg-cover bg-center bg-no-repeat",
        className
      )}
      aria-hidden="true"
    />
  );
}
