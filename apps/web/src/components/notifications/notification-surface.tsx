"use client";

import { useId } from "react";
import Image from "next/image";
import type {
  NotificationPresentation,
  NotificationPresentationBrandKey,
  NotificationPresentationTone,
} from "@profitabledge/platform";
import { ChevronRight, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { getNotificationBrandAsset } from "@/components/notifications/notification-branding";

const toneAccentStyles: Record<
  NotificationPresentationTone,
  {
    ringStart: string;
    ringMid: string;
    bleedGlow: string;
    bleedSoft: string;
  }
> = {
  teal: {
    ringStart: "rgba(94, 234, 212, 0.18)",
    ringMid: "rgba(94, 234, 212, 0.08)",
    bleedGlow: "rgba(45, 212, 191, 0.11)",
    bleedSoft: "rgba(45, 212, 191, 0.035)",
  },
  emerald: {
    ringStart: "rgba(110, 231, 183, 0.18)",
    ringMid: "rgba(110, 231, 183, 0.08)",
    bleedGlow: "rgba(52, 211, 153, 0.11)",
    bleedSoft: "rgba(52, 211, 153, 0.035)",
  },
  amber: {
    ringStart: "rgba(253, 230, 138, 0.18)",
    ringMid: "rgba(253, 230, 138, 0.08)",
    bleedGlow: "rgba(251, 191, 36, 0.11)",
    bleedSoft: "rgba(251, 191, 36, 0.035)",
  },
  rose: {
    ringStart: "rgba(253, 164, 175, 0.18)",
    ringMid: "rgba(253, 164, 175, 0.08)",
    bleedGlow: "rgba(244, 63, 94, 0.11)",
    bleedSoft: "rgba(244, 63, 94, 0.035)",
  },
  blue: {
    ringStart: "rgba(125, 211, 252, 0.18)",
    ringMid: "rgba(125, 211, 252, 0.08)",
    bleedGlow: "rgba(56, 189, 248, 0.11)",
    bleedSoft: "rgba(56, 189, 248, 0.035)",
  },
  violet: {
    ringStart: "rgba(196, 181, 253, 0.18)",
    ringMid: "rgba(196, 181, 253, 0.08)",
    bleedGlow: "rgba(168, 85, 247, 0.11)",
    bleedSoft: "rgba(168, 85, 247, 0.035)",
  },
  neutral: {
    ringStart: "rgba(255, 255, 255, 0.16)",
    ringMid: "rgba(255, 255, 255, 0.08)",
    bleedGlow: "rgba(255, 255, 255, 0.08)",
    bleedSoft: "rgba(255, 255, 255, 0.025)",
  },
};

const brokerAccentToneByBrandKey: Partial<
  Record<NotificationPresentationBrandKey, NotificationPresentationTone>
> = {
  tradovate: "blue",
  ftmo: "neutral",
  mt5: "teal",
  ctrader: "rose",
};

const ACCENT_WIDTH_PERCENT = 50;
const ACCENT_WIDTH = `${ACCENT_WIDTH_PERCENT}%`;

export type NotificationSurfaceAction =
  | {
      kind: "dismiss";
      onClick?: () => void;
      label?: string;
    }
  | {
      kind: "navigate";
      onClick: () => void;
      label?: string;
    }
  | {
      kind: "progress";
      label?: string;
    };

export function NotificationSurface({
  presentation,
  unread = false,
  className,
  onClose,
  action,
}: {
  presentation: NotificationPresentation;
  timestamp?: string | null;
  unread?: boolean;
  className?: string;
  onClose?: () => void;
  action?: NotificationSurfaceAction;
}) {
  const brandAsset = getNotificationBrandAsset(presentation.brandKey);
  const description = presentation.message ?? presentation.title;
  const accentTone =
    presentation.icon === "account" || presentation.icon === "sync"
      ? brokerAccentToneByBrandKey[presentation.brandKey] ?? presentation.tone
      : presentation.tone;
  const accent = toneAccentStyles[accentTone];
  const noiseFilterId = useId().replace(/:/g, "");
  const resolvedAction =
    action ?? (onClose ? { kind: "dismiss", onClick: onClose } : null);
  const ringGradient = `linear-gradient(90deg, ${accent.ringStart} 0%, ${accent.ringMid} 18%, ${accent.ringMid} 30%, rgba(255,255,255,0.12) ${ACCENT_WIDTH_PERCENT}%, rgba(255,255,255,0.11) 72%, rgba(255,255,255,0.10) 100%)`;
  const bleedGradient = `radial-gradient(circle at 0% 50%, ${accent.bleedGlow} 0%, ${accent.bleedSoft} 34%, transparent 92%), linear-gradient(90deg, ${accent.bleedGlow} 0%, ${accent.bleedSoft} 22%, ${accent.bleedSoft} 48%, transparent 100%)`;

  return (
    <div
      className={cn(
        "relative flex w-max max-w-[calc(100vw-24px)] items-center rounded-full bg-sidebar backdrop-blur-2xl",
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-full p-px"
        style={{ backgroundImage: ringGradient }}
      >
        <div className="size-full rounded-full bg-sidebar/1" />
      </div>
      <div
        className={cn(
          "relative flex h-10 min-w-0 items-center overflow-hidden rounded-[20px] bg-sidebar-accent pl-4 pr-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-[18px]"
        )}
      >
        <div
          className="pointer-events-none absolute inset-0 rounded-[20px] p-px"
          style={{ backgroundImage: ringGradient }}
        >
          <div className="size-full rounded-[20px] bg-sidebar-accent" />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0))]" />
        <div
          className="pointer-events-none absolute inset-y-0 left-0"
          style={{ width: ACCENT_WIDTH, backgroundImage: bleedGradient }}
        />
        <svg
          className="pointer-events-none absolute inset-y-0 left-0 h-full opacity-[0.12] mix-blend-soft-light"
          style={{ width: ACCENT_WIDTH }}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <filter id={noiseFilterId}>
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.85"
                numOctaves="2"
                seed="7"
                stitchTiles="stitch"
              />
              <feColorMatrix type="saturate" values="0" />
              <feComponentTransfer>
                <feFuncA
                  type="table"
                  tableValues="0 0.04 0.08 0.13 0.08 0.04 0"
                />
              </feComponentTransfer>
            </filter>
          </defs>
          <rect
            width="100"
            height="100"
            fill="white"
            filter={`url(#${noiseFilterId})`}
          />
        </svg>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-r from-transparent via-[#111111]/18 to-[#111111]/62" />
        <div className="relative z-[1] mr-3 flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-[4px]">
          <Image
            src={brandAsset.src}
            alt={brandAsset.alt}
            width={16}
            height={16}
            className="size-4 object-cover"
          />
        </div>
        <div className="pointer-events-none relative z-[1] min-w-0 pr-1 text-[11px] leading-none whitespace-nowrap text-white/82">
          {description}
        </div>
        {resolvedAction?.kind === "progress" ? (
          <div
            aria-label={resolvedAction.label ?? "Notification is in progress"}
            className="relative z-[1] ml-2 flex size-5 shrink-0 items-center justify-center"
            role="status"
          >
            <div className="absolute inset-0 rounded-full ring-1 ring-white/14" />
            <div className="absolute inset-[3px] rounded-full border-[1.5px] border-white/0 border-r-teal-300/95 border-t-teal-300/95 animate-spin" />
          </div>
        ) : resolvedAction ? (
          <button
            type="button"
            aria-label={
              resolvedAction.label ??
              (resolvedAction.kind === "navigate"
                ? "Open notification"
                : "Dismiss notification")
            }
            onClick={resolvedAction.onClick}
            className="relative z-[1] ml-2 flex size-5 shrink-0 items-center justify-center rounded-full bg-white/[0.025] text-white/76 ring-1 ring-white/8 transition-colors hover:bg-white/[0.07] cursor-pointer"
          >
            {resolvedAction.kind === "navigate" ? (
              <ChevronRight className="size-[11px]" strokeWidth={2} />
            ) : (
              <X className="size-[11px]" strokeWidth={1.8} />
            )}
          </button>
        ) : null}
      </div>
    </div>
  );
}
