"use client";

import type React from "react";
import { Image as ImageIcon, Pencil, X } from "lucide-react";
import { generatePatternSeed } from "@/components/journal/list/list-types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function withOpacity(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) {
    return `rgba(59, 130, 246, ${alpha})`;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function EdgeCoverBanner({
  title,
  color = "#3B82F6",
  coverImageUrl,
  coverImagePosition = 50,
  containerRef,
  editable = false,
  onAddCover,
  onEditCover,
  onRemoveCover,
  className,
}: {
  title: string;
  color?: string | null;
  coverImageUrl?: string | null;
  coverImagePosition?: number | null;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  editable?: boolean;
  onAddCover?: () => void;
  onEditCover?: () => void;
  onRemoveCover?: () => void;
  className?: string;
}) {
  const accent = color ?? "#3B82F6";
  const seed = generatePatternSeed(title);
  const rotation = (seed % 40) - 20;
  const patternId = `edge-cover-${seed}`;
  const isInteractive = editable && Boolean(onEditCover || onAddCover);
  const bannerActionLabel = coverImageUrl
    ? "Click to adjust cover"
    : "Click to add cover";
  const handleBannerAction = () => {
    if (!isInteractive) {
      return;
    }

    if (coverImageUrl) {
      onEditCover?.();
      return;
    }

    onAddCover?.();
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "group relative h-44 overflow-hidden rounded-md border border-white/8 bg-sidebar-accent md:h-64",
        isInteractive && "cursor-pointer",
        className
      )}
      onClick={handleBannerAction}
      onKeyDown={(event) => {
        if (!isInteractive) {
          return;
        }

        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleBannerAction();
        }
      }}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
    >
      {coverImageUrl ? (
        <img
          src={coverImageUrl}
          alt={`${title} cover`}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: `center ${coverImagePosition ?? 50}%` }}
        />
      ) : (
        <>
          <div
            className="absolute inset-0"
            style={{
              background: [
                `radial-gradient(circle at ${18 + (seed % 22)}% ${22 + (seed % 20)}%, ${withOpacity(accent, 0.34)}, transparent 34%)`,
                `radial-gradient(circle at ${78 - (seed % 14)}% ${18 + (seed % 16)}%, ${withOpacity(accent, 0.2)}, transparent 28%)`,
                `linear-gradient(${120 + rotation}deg, ${withOpacity(accent, 0.26)}, rgba(10,12,16,0) 58%)`,
                "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))",
              ].join(", "),
            }}
          />

          <svg
            className="absolute inset-0 h-full w-full opacity-[0.09]"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern
                id={patternId}
                x="0"
                y="0"
                width="28"
                height="28"
                patternUnits="userSpaceOnUse"
                patternTransform={`rotate(${rotation})`}
              >
                <path
                  d="M 28 0 L 0 0 0 28"
                  fill="none"
                  stroke={accent}
                  strokeWidth="0.7"
                />
                <circle cx="6" cy="6" r="1.2" fill={accent} />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill={`url(#${patternId})`} />
          </svg>
        </>
      )}

      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-sidebar via-sidebar/55 to-transparent" />

      {editable ? (
        <div className="absolute right-3 top-3 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            size="sm"
            className="border-white/10 bg-sidebar/85 text-white backdrop-blur-sm hover:bg-sidebar-accent"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (coverImageUrl) {
                onEditCover?.();
                return;
              }
              onAddCover?.();
            }}
          >
            {coverImageUrl ? (
              <>
                <Pencil className="mr-2 size-3.5" />
                Edit cover
              </>
            ) : (
              <>
                <ImageIcon className="mr-2 size-3.5" />
                Add cover
              </>
            )}
          </Button>

          {coverImageUrl ? (
            <>
              <Button
                size="sm"
                className="border-white/10 bg-sidebar/85 text-white backdrop-blur-sm hover:bg-sidebar-accent"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onAddCover?.();
                }}
              >
                Change cover
              </Button>
              <Button
                size="icon"
                className="border-white/10 bg-sidebar/85 text-white backdrop-blur-sm hover:bg-sidebar-accent"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onRemoveCover?.();
                }}
              >
                <X className="size-4" />
              </Button>
            </>
          ) : null}
        </div>
      ) : null}

      {isInteractive ? (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-white/40 opacity-0 transition-opacity group-hover:opacity-100">
          {bannerActionLabel}
        </div>
      ) : null}
    </div>
  );
}
