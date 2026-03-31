"use client";

import type { ReactNode } from "react";

import { AuthSplitShell } from "@/components/auth/auth-split-shell";
import { cn } from "@/lib/utils";

type DesktopAuthStateShellProps = {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
};

export function DesktopAuthStateShell({
  title,
  description,
  children,
  className,
}: DesktopAuthStateShellProps) {
  return (
    <AuthSplitShell className={cn("max-w-[30rem]", className)}>
      <div className="space-y-8">
        <div className="space-y-3 text-center">
          <p className="text-3xl font-medium tracking-[-0.05em] text-white sm:text-[2.15rem] sm:leading-[1.02] lg:text-[2.3rem]">
            {title}
          </p>
          <p className="mx-auto max-w-md text-sm leading-6 text-white/56 sm:text-[15px] lg:text-base lg:leading-7">
            {description}
          </p>
        </div>
        {children}
      </div>
    </AuthSplitShell>
  );
}
