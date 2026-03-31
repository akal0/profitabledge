"use client";

import { ImagesBadge } from "@/components/ui/images-badge";

import type { JournalListEntry } from "@/components/journal/list/list-types";

function buildFolderPreviewDataUri(
  item: NonNullable<JournalListEntry["folderPreviewItems"]>[number],
  index: number
) {
  const palette = [
    ["#1d4ed8", "#0f172a"],
    ["#0f766e", "#111827"],
    ["#7c3aed", "#1f2937"],
  ] as const;
  const [accent, base] = palette[index % palette.length];
  const label = (item.emoji || item.title.slice(0, 1) || "J")
    .slice(0, 2)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="120" height="84" viewBox="0 0 120 84">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${accent}" />
          <stop offset="100%" stop-color="${base}" />
        </linearGradient>
      </defs>
      <rect width="120" height="84" rx="10" fill="url(#g)" />
      <rect x="8" y="8" width="104" height="68" rx="8" fill="rgba(255,255,255,0.08)" />
      <text x="60" y="50" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="white">${label}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function JournalFolderBadge({
  title,
  previewItems,
  className,
}: {
  title: string;
  previewItems?: JournalListEntry["folderPreviewItems"];
  className?: string;
}) {
  const images = (previewItems ?? []).map((item, index) => {
    return item.coverImageUrl || buildFolderPreviewDataUri(item, index);
  });

  return (
    <ImagesBadge
      text={title}
      images={images}
      className={className}
      textClassName="sr-only"
      folderSize={{ width: 54, height: 38 }}
      teaserImageSize={{ width: 34, height: 24 }}
      hoverImageSize={{ width: 56, height: 40 }}
      hoverTranslateY={-28}
      hoverSpread={16}
      hoverRotation={10}
    />
  );
}
