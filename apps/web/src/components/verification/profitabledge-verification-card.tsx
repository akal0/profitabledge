"use client";

import Link from "next/link";
import QRCode from "react-qr-code";
import { ExternalLink, ShieldCheck } from "lucide-react";

import {
  GoalContentSeparator,
  GoalSurface,
} from "@/components/goals/goal-surface";
import { cn } from "@/lib/utils";

function resolvePublicBaseUrl() {
  const envUrl = process.env.NEXT_PUBLIC_WEB_URL?.trim();
  if (envUrl) {
    return envUrl.replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    return window.location.origin.replace(/\/$/, "");
  }

  return "";
}

export function resolveAbsolutePublicUrl(path: string) {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  const baseUrl = resolvePublicBaseUrl();
  return baseUrl ? `${baseUrl}${path}` : path;
}

function formatIssuedAt(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function ProfitabledgeVerificationCard({
  verification,
  title = "Issued by Profitabledge",
  description,
  className,
  compact = false,
}: {
  verification: {
    path: string;
    code: string;
    issuedAt: string;
  };
  title?: string;
  description: string;
  className?: string;
  compact?: boolean;
}) {
  const absoluteUrl = resolveAbsolutePublicUrl(verification.path);

  return (
    <GoalSurface
      className={cn("h-full w-full", className)}
      innerClassName="overflow-hidden"
    >
      <div className={cn("p-4", compact ? "space-y-3" : "space-y-4")}>
        <div
          className={cn(
            "flex gap-4",
            compact ? "items-start" : "flex-col sm:flex-row sm:items-start"
          )}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-teal-300/85">
              <ShieldCheck className="h-3.5 w-3.5" />
              Profitabledge verification
            </div>
            <p className="mt-3 text-base font-semibold tracking-tight text-white">
              {title}
            </p>
            <p className="mt-1 text-xs leading-5 text-white/48">
              {description}
            </p>
          </div>

          <div className="shrink-0 rounded-md bg-white p-2 ring-1 ring-black/10">
            <QRCode
              value={absoluteUrl}
              size={compact ? 88 : 112}
              bgColor="#ffffff"
              fgColor="#0a0e14"
            />
          </div>
        </div>

        <GoalContentSeparator />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/34">
              Verification code
            </p>
            <p className="mt-1 font-mono text-xs text-white/72">
              {verification.code}
            </p>
            <p className="mt-1 text-[11px] text-white/40">
              Issued {formatIssuedAt(verification.issuedAt)}
            </p>
          </div>

          <Link
            href={verification.path}
            className="inline-flex h-9 items-center gap-2 rounded-sm border border-white/8 bg-white/5 px-3 text-xs font-medium text-white/78 transition-colors hover:border-teal-400/35 hover:bg-teal-500/10 hover:text-teal-200"
          >
            Open verify page
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </GoalSurface>
  );
}
