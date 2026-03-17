"use client";

import { toPng } from "html-to-image";

type StyledElement = HTMLElement | SVGElement;

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
    image.onerror = () => reject(new Error("Failed to load export image"));
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function splitShadowLayers(shadow: string) {
  const layers: string[] = [];
  let current = "";
  let depth = 0;

  for (const character of shadow) {
    if (character === "(") depth += 1;
    if (character === ")") depth = Math.max(0, depth - 1);

    if (character === "," && depth === 0) {
      if (current.trim()) {
        layers.push(current.trim());
      }
      current = "";
      continue;
    }

    current += character;
  }

  if (current.trim()) {
    layers.push(current.trim());
  }

  return layers;
}

function isRingStyleShadow(shadow: string) {
  if (!shadow || shadow === "none") return false;

  return splitShadowLayers(shadow).every((layer) => {
    const lengths = layer.match(/-?\d*\.?\d+px/g) ?? [];
    if (lengths.length < 2) return false;

    const offsetX = Math.abs(Number.parseFloat(lengths[0] ?? "0"));
    const offsetY = Math.abs(Number.parseFloat(lengths[1] ?? "0"));
    const blur = Math.abs(Number.parseFloat(lengths[2] ?? "0"));

    return offsetX === 0 && offsetY === 0 && blur === 0;
  });
}

function resolveExportPadding(size: { width: number; height: number }) {
  return {
    x: clamp(Math.round(size.width * 0.04), 40, 96),
    y: clamp(Math.round(size.height * 0.08), 32, 88),
  };
}

function snapshotStyle(elements: StyledElement[]) {
  return elements.map((element) => ({
    element,
    styleAttribute: element.getAttribute("style"),
  }));
}

function restoreStyle(
  snapshots: Array<{ element: StyledElement; styleAttribute: string | null }>
) {
  snapshots.forEach(({ element, styleAttribute }) => {
    if (styleAttribute == null) {
      element.removeAttribute("style");
    } else {
      element.setAttribute("style", styleAttribute);
    }
  });
}

function flattenExportSurfaces(root: HTMLElement, sidebarBackground: string) {
  const surfaceElements = new Set<HTMLElement>();

  if (root.matches("[data-widget-share-surface]")) {
    surfaceElements.add(root);
  }

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
      computedStyle.getPropertyValue("-webkit-backdrop-filter") !== "none" ||
      (computedStyle.boxShadow !== "none" &&
        !isRingStyleShadow(computedStyle.boxShadow))
    ) {
      blurElements.add(element);
    }
  });

  const elements = [...new Set<HTMLElement>([...surfaceElements, ...blurElements])];
  const snapshots = snapshotStyle(elements);

  elements.forEach((element) => {
    if (surfaceElements.has(element)) {
      element.style.setProperty(
        "background-color",
        sidebarBackground,
        "important"
      );
      element.style.setProperty("background-image", "none", "important");
    }

    element.style.setProperty("box-shadow", "none", "important");
    element.style.setProperty("backdrop-filter", "none", "important");
    element.style.setProperty("-webkit-backdrop-filter", "none", "important");
  });

  return () => restoreStyle(snapshots);
}

function inlineSvgPresentationStyles(root: HTMLElement) {
  const svgElements = Array.from(
    root.querySelectorAll<SVGElement>("svg, svg *")
  );
  const snapshots = snapshotStyle(svgElements);

  const svgStyleProperties = [
    "fill",
    "fill-opacity",
    "stroke",
    "stroke-opacity",
    "stroke-width",
    "stroke-dasharray",
    "opacity",
    "color",
    "stop-color",
    "stop-opacity",
  ];

  svgElements.forEach((element) => {
    const computedStyle = window.getComputedStyle(element);

    svgStyleProperties.forEach((property) => {
      const value = computedStyle.getPropertyValue(property).trim();
      if (!value) return;
      element.style.setProperty(property, value);
    });
  });

  return () => restoreStyle(snapshots);
}

export async function exportWidgetAsPng(input: {
  node: HTMLElement;
  title: string;
}) {
  const rect = input.node.getBoundingClientRect();
  const safeWidth = Math.max(1, Math.round(rect.width));
  const safeHeight = Math.max(1, Math.round(rect.height));
  const pixelRatio = 3;
  const padding = resolveExportPadding({
    width: safeWidth,
    height: safeHeight,
  });
  const sidebarBackground = resolveSidebarBackgroundColor();
  const restoreSurfaces = flattenExportSurfaces(input.node, sidebarBackground);
  const restoreSvgStyles = inlineSvgPresentationStyles(input.node);

  let widgetDataUrl: string;
  try {
    widgetDataUrl = await toPng(input.node, {
      cacheBust: true,
      pixelRatio,
      style: {
        backgroundColor: "transparent",
      },
      filter: (node) =>
        !(
          node instanceof HTMLElement && node.dataset.widgetShareIgnore === "true"
        ),
    });
  } finally {
    restoreSvgStyles();
    restoreSurfaces();
  }

  const widgetImage = await loadImage(widgetDataUrl);
  const padXPx = padding.x * pixelRatio;
  const padYPx = padding.y * pixelRatio;
  const canvas = document.createElement("canvas");
  canvas.width = widgetImage.width + padXPx * 2;
  canvas.height = widgetImage.height + padYPx * 2;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to create export canvas");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = sidebarBackground;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    widgetImage,
    padXPx,
    padYPx,
    widgetImage.width,
    widgetImage.height
  );

  const finalDataUrl = canvas.toDataURL("image/png");
  downloadDataUrl(
    finalDataUrl,
    `${slugify(input.title) || "dashboard-widget"}.png`
  );
}
