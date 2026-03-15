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

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load widget image"));
    image.src = src;
  });
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function resolveThemeBackgroundColor(
  className: string,
  fallbackColor: string
) {
  const probe = document.createElement("div");
  probe.className = className;
  probe.style.position = "absolute";
  probe.style.pointerEvents = "none";
  probe.style.opacity = "0";
  probe.style.inset = "-9999px";
  document.body.appendChild(probe);

  const resolvedColor = window.getComputedStyle(probe).backgroundColor;
  document.body.removeChild(probe);

  return resolvedColor || fallbackColor;
}

function flattenWidgetForExport(root: HTMLElement, sidebarBackground: string) {
  const surfaceElements = new Set<HTMLElement>([root]);

  root
    .querySelectorAll<HTMLElement>("[data-widget-share-surface]")
    .forEach((element) => {
      surfaceElements.add(element);
    });

  const blurElements = new Set<HTMLElement>();
  root.querySelectorAll<HTMLElement>("*").forEach((element) => {
    const computedStyle = window.getComputedStyle(element);
    if (
      computedStyle.backdropFilter !== "none" ||
      computedStyle.getPropertyValue("-webkit-backdrop-filter") !== "none"
    ) {
      blurElements.add(element);
    }
  });

  const elements = new Set<HTMLElement>([...surfaceElements, ...blurElements]);
  const snapshots = Array.from(elements).map((element) => {
    const cssText = element.style.cssText;
    if (surfaceElements.has(element)) {
      element.style.setProperty(
        "background-color",
        sidebarBackground,
        "important"
      );
      element.style.setProperty("background-image", "none", "important");
    }
    element.style.setProperty("backdrop-filter", "none", "important");
    element.style.setProperty("-webkit-backdrop-filter", "none", "important");
    element.style.setProperty("box-shadow", "none", "important");
    return { element, cssText };
  });

  return () => {
    snapshots.forEach(({ element, cssText }) => {
      element.style.cssText = cssText;
    });
  };
}

export async function exportWidgetAsPng(input: {
  node: HTMLElement;
  title: string;
}) {
  const rect = input.node.getBoundingClientRect();
  const safeWidth = Math.max(1, Math.round(rect.width));
  const safeHeight = Math.max(1, Math.round(rect.height));
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const padding = Math.max(
    24,
    Math.round(Math.min(safeWidth, safeHeight) * 0.08)
  );
  const sidebarBackground = resolveThemeBackgroundColor(
    "bg-sidebar",
    "rgb(31, 31, 34)"
  );
  const restoreWidgetStyles = flattenWidgetForExport(
    input.node,
    sidebarBackground
  );

  let widgetDataUrl: string;
  try {
    widgetDataUrl = await toPng(input.node, {
      cacheBust: true,
      pixelRatio,
      backgroundColor: sidebarBackground,
      style: {
        backgroundColor: sidebarBackground,
        backdropFilter: "none",
        boxShadow: "none",
      },
      filter: (node) =>
        !(
          node instanceof HTMLElement && node.dataset.widgetShareIgnore === "true"
        ),
    });
  } finally {
    restoreWidgetStyles();
  }

  const widgetImage = await loadImage(widgetDataUrl);
  const padPx = padding * pixelRatio;
  const canvas = document.createElement("canvas");
  canvas.width = widgetImage.width + padPx * 2;
  canvas.height = widgetImage.height + padPx * 2;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to create widget canvas");
  }

  context.fillStyle = sidebarBackground;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    widgetImage,
    padPx,
    padPx,
    widgetImage.width,
    widgetImage.height
  );

  const finalDataUrl = canvas.toDataURL("image/png");
  downloadDataUrl(
    finalDataUrl,
    `${slugify(input.title) || "dashboard-widget"}.png`
  );
}
