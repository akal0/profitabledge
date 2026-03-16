"use client";

import { toPng } from "html-to-image";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function exportWidgetAsPng(input: {
  node: HTMLElement;
  title: string;
}) {
  const finalDataUrl = await toPng(input.node, {
    cacheBust: true,
    pixelRatio: 3,
    filter: (node) =>
      !(
        node instanceof HTMLElement && node.dataset.widgetShareIgnore === "true"
      ),
  });

  downloadDataUrl(
    finalDataUrl,
    `${slugify(input.title) || "dashboard-widget"}.png`
  );
}
