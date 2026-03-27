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

function resolveExportPadding(size: { width: number; height: number }) {
  return {
    x: clamp(Math.round(size.width * 0.04), 40, 96),
    y: clamp(Math.round(size.height * 0.08), 28, 72),
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

async function renderWidgetExportCanvas(input: {
  node: HTMLElement;
  pixelRatio: number;
}) {
  const rect = input.node.getBoundingClientRect();
  const safeWidth = Math.max(1, Math.round(rect.width));
  const safeHeight = Math.max(1, Math.round(rect.height));
  const captureInset = {
    x: clamp(Math.round(safeWidth * 0.018), 18, 28),
    top: clamp(Math.round(safeHeight * 0.014), 10, 16),
    bottom: clamp(Math.round(safeHeight * 0.03), 18, 28),
  };
  const outerPadding = resolveExportPadding({
    width: safeWidth,
    height: safeHeight,
  });
  const sidebarBackground = resolveSidebarBackgroundColor();
  const restoreSvgStyles = inlineSvgPresentationStyles(input.node);

  let widgetDataUrl: string;
  try {
    widgetDataUrl = await toPng(input.node, {
      cacheBust: true,
      pixelRatio: input.pixelRatio,
      width: safeWidth + captureInset.x * 2,
      height: safeHeight + captureInset.top + captureInset.bottom,
      canvasWidth: safeWidth + captureInset.x * 2,
      canvasHeight: safeHeight + captureInset.top + captureInset.bottom,
      style: {
        backgroundColor: "transparent",
        padding: `${captureInset.top}px ${captureInset.x}px ${captureInset.bottom}px`,
        boxSizing: "border-box",
        overflow: "visible",
      },
      filter: (node) =>
        !(
          node instanceof HTMLElement && node.dataset.widgetShareIgnore === "true"
        ),
    });
  } finally {
    restoreSvgStyles();
  }

  const widgetImage = await loadImage(widgetDataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = widgetImage.width;
  canvas.height = widgetImage.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to create export canvas");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(widgetImage, 0, 0, widgetImage.width, widgetImage.height);

  return {
    canvas,
    sidebarBackground,
    outerPadding,
  };
}

async function renderSingleWidgetExportCanvas(input: {
  node: HTMLElement;
  pixelRatio: number;
}) {
  const capture = await renderWidgetExportCanvas(input);
  const padXPx = capture.outerPadding.x * input.pixelRatio;
  const padYPx = capture.outerPadding.y * input.pixelRatio;
  const canvas = document.createElement("canvas");
  canvas.width = capture.canvas.width + padXPx * 2;
  canvas.height = capture.canvas.height + padYPx * 2;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to create export canvas");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = capture.sidebarBackground;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    capture.canvas,
    padXPx,
    padYPx,
    capture.canvas.width,
    capture.canvas.height
  );

  return canvas;
}

async function renderCompositeWidgetExportCanvas(input: {
  nodes: HTMLElement[];
  pixelRatio: number;
}) {
  const captures = await Promise.all(
    input.nodes.map((node) =>
      renderWidgetExportCanvas({
        node,
        pixelRatio: input.pixelRatio,
      })
    )
  );

  if (captures.length === 0) {
    throw new Error("No export targets provided");
  }

  const maxInnerWidth = Math.max(...captures.map((capture) => capture.canvas.width));
  const totalInnerHeight = captures.reduce(
    (sum, capture) => sum + capture.canvas.height,
    0
  );
  // Each captured section already includes its own top/bottom breathing room,
  // so adding another synthetic gap here makes the combined export look much
  // looser than the live dashboard layout.
  const gapPx = 0;
  const totalGapHeight = gapPx * Math.max(0, captures.length - 1);
  const referencePadding = resolveExportPadding({
    width: Math.round(maxInnerWidth / input.pixelRatio),
    height: Math.round((totalInnerHeight + totalGapHeight) / input.pixelRatio),
  });
  const padXPx = referencePadding.x * input.pixelRatio;
  const padYPx = referencePadding.y * input.pixelRatio;
  const canvas = document.createElement("canvas");
  canvas.width = maxInnerWidth + padXPx * 2;
  canvas.height = totalInnerHeight + totalGapHeight + padYPx * 2;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to create export canvas");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = captures[0]!.sidebarBackground;
  context.fillRect(0, 0, canvas.width, canvas.height);

  let offsetY = padYPx;
  captures.forEach((capture, index) => {
    const offsetX = padXPx + Math.round((maxInnerWidth - capture.canvas.width) / 2);
    context.drawImage(
      capture.canvas,
      offsetX,
      offsetY,
      capture.canvas.width,
      capture.canvas.height
    );
    offsetY += capture.canvas.height;
    if (index < captures.length - 1) {
      offsetY += gapPx;
    }
  });

  return canvas;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number
) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("Failed to generate widget image"));
      },
      type,
      quality
    );
  });
}

export async function createWidgetShareImageFile(input: {
  node: HTMLElement;
  title: string;
}) {
  const canvas = await renderSingleWidgetExportCanvas({
    node: input.node,
    pixelRatio: 2,
  });
  const webpBlob = await canvasToBlob(canvas, "image/webp", 0.92).catch(
    async () => canvasToBlob(canvas, "image/png")
  );
  const extension = webpBlob.type === "image/webp" ? "webp" : "png";

  return new File(
    [webpBlob],
    `${slugify(input.title) || "dashboard-widget"}.${extension}`,
    {
      type: webpBlob.type,
    }
  );
}

export async function exportWidgetAsPng(input: {
  node: HTMLElement;
  title: string;
}) {
  const canvas = await renderSingleWidgetExportCanvas({
    node: input.node,
    pixelRatio: 3,
  });

  const finalDataUrl = canvas.toDataURL("image/png");
  downloadDataUrl(
    finalDataUrl,
    `${slugify(input.title) || "dashboard-widget"}.png`
  );
}

export async function exportWidgetsAsCombinedPng(input: {
  nodes: HTMLElement[];
  title: string;
}) {
  const exportNodes = input.nodes.filter(Boolean);
  if (exportNodes.length === 0) {
    throw new Error("No export targets provided");
  }

  const canvas =
    exportNodes.length === 1
      ? await renderSingleWidgetExportCanvas({
          node: exportNodes[0]!,
          pixelRatio: 3,
        })
      : await renderCompositeWidgetExportCanvas({
          nodes: exportNodes,
          pixelRatio: 3,
        });

  const finalDataUrl = canvas.toDataURL("image/png");
  downloadDataUrl(
    finalDataUrl,
    `${slugify(input.title) || "dashboard-widget"}.png`
  );
}
