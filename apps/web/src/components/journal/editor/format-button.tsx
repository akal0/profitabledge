"use client";

import type React from "react";
import { cn } from "@/lib/utils";

interface FormatButtonProps {
  onClick: () => void;
  isActive: boolean;
  title: string;
  children: React.ReactNode;
}

export function FormatButton({
  onClick,
  isActive,
  title,
  children,
}: FormatButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "rounded p-1.5 transition-colors",
        isActive
          ? "bg-white/10 text-white"
          : "text-white/60 hover:bg-white/5 hover:text-white"
      )}
    >
      {children}
    </button>
  );
}
