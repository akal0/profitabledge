"use client";

import { toPng } from "html-to-image";

function isTransparentColor(color: string) {
  return (
    !color ||
    color === "transparent" ||
    color === "rgba(0, 0, 0, 0)" ||
    color === "hsla(0, 0%, 0%, 0)"
  );
}

function resolveSidebarBackgroundColor() {
  const probe = document.createElement("div");
  probe.className = "bg-sidebar";
  probe.style.position = "fixed";
  probe.style.pointerEvents = "none";
  probe.style.opacity = "0";
  probe.style.inset = "0";
  document.body.appendChild(probe);

  const color = window.getComputedStyle(probe).backgroundColor;
  document.body.removeChild(probe);

  return isTransparentColor(color) ? "rgb(24, 24, 27)" : color;
}

function resolveExportBackgroundColor(node: HTMLElement) {
  const nodeColor = window.getComputedStyle(node).backgroundColor;
  if (!isTransparentColor(nodeColor)) {
    return nodeColor;
  }

  const frame = node.closest<HTMLElement>('[data-widget-share-surface="frame"]');
  if (frame) {
    const frameColor = window.getComputedStyle(frame).backgroundColor;
    if (!isTransparentColor(frameColor)) {
      return frameColor;
    }
  }

  return resolveSidebarBackgroundColor();
}

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
    backgroundColor: resolveExportBackgroundColor(input.node),
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
