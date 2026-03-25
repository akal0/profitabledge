"use client";

import { toPng } from "html-to-image";
import QRCode from "qrcode";

type StyledElement = HTMLElement | SVGElement;
type VerificationIdentity = {
  username?: string | null;
  name?: string | null;
  imageUrl?: string | null;
};

const PROFITABLEDGE_QR_LOGO_DATA_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
    <rect width="96" height="96" rx="24" fill="#0B0B0D"/>
    <text x="48" y="61" text-anchor="middle" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="42" font-weight="700" letter-spacing="-2" fill="#FFFFFF">pe.</text>
  </svg>`
)}`;

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

function sanitizeWidgetSnapshotNode(root: HTMLElement) {
  const clone = root.cloneNode(true) as HTMLElement;

  clone
    .querySelectorAll<HTMLElement>('[data-widget-share-ignore="true"]')
    .forEach((element) => {
      element.remove();
    });

  clone
    .querySelectorAll<
      HTMLElement
    >("script, iframe, object, embed, link, meta, base")
    .forEach((element) => {
      element.remove();
    });

  [clone, ...Array.from(clone.querySelectorAll<HTMLElement>("*"))].forEach(
    (element) => {
      for (const attribute of Array.from(element.attributes)) {
        const name = attribute.name.toLowerCase();
        if (name.startsWith("on")) {
          element.removeAttribute(attribute.name);
        }
      }
    }
  );

  const originalElements = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
  const clonedElements = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>("*"))];

  clonedElements.forEach((element, index) => {
    const originalElement = originalElements[index];
    if (!originalElement) {
      return;
    }

    if (isOverflowClippingStyle(window.getComputedStyle(originalElement))) {
      element.style.setProperty("overflow", "visible");
      element.style.setProperty("overflow-x", "visible");
      element.style.setProperty("overflow-y", "visible");
    }

    if (
      originalElement === root ||
      originalElement.matches("[data-widget-share-surface]")
    ) {
      element.style.setProperty("display", "block");
      element.style.setProperty("width", "100%");
      element.style.setProperty("min-width", "100%");
      element.style.setProperty("max-width", "none");
    }
  });

  return clone;
}

function createWidgetShareSnapshotMarkup(root: HTMLElement) {
  return sanitizeWidgetSnapshotNode(root).outerHTML;
}

function loadImage(
  src: string,
  options?: {
    crossOrigin?: "anonymous" | "use-credentials";
  }
) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    if (options?.crossOrigin) {
      image.crossOrigin = options.crossOrigin;
    }
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
    const spread = Math.abs(Number.parseFloat(lengths[3] ?? "0"));

    return (
      blur === 0 &&
      spread <= 2 &&
      ((offsetX === 0 && offsetY === 0) ||
        (offsetX <= 2 && offsetY === 0) ||
        (offsetY <= 2 && offsetX === 0))
    );
  });
}

function isOverflowClippingStyle(computedStyle: CSSStyleDeclaration) {
  const values = [
    computedStyle.overflow,
    computedStyle.overflowX,
    computedStyle.overflowY,
  ];

  return values.some(
    (value) =>
      value === "hidden" ||
      value === "clip" ||
      value === "auto" ||
      value === "scroll"
  );
}

function resolveExportPadding(size: { width: number; height: number }) {
  return {
    x: clamp(Math.round(size.width * 0.04), 40, 96),
    y: clamp(Math.round(size.height * 0.08), 32, 88),
  };
}

function resolveVerificationQrSize(
  size: { width: number; height: number },
  verificationUrl?: string | null
) {
  const isLongVerificationUrl = (verificationUrl?.length ?? 0) > 320;
  const widthTarget = size.width * (isLongVerificationUrl ? 0.18 : 0.16);
  const heightTarget = size.height * (isLongVerificationUrl ? 0.30 : 0.28);

  return clamp(
    Math.round(Math.min(widthTarget, heightTarget)),
    isLongVerificationUrl ? 100 : 90,
    isLongVerificationUrl ? 240 : 200
  );
}

function resolveVerificationStampMetrics(
  size: { width: number; height: number },
  verificationUrl?: string | null
) {
  const qrSize = resolveVerificationQrSize(size, verificationUrl);
  const avatarSize = clamp(Math.round(qrSize * 0.62), 28, 40);
  const gap = clamp(Math.round(qrSize * 0.18), 8, 12);
  const paddingY = clamp(Math.round(qrSize * 0.22), 12, 18);
  const labelFontSize = clamp(Math.round(qrSize * 0.26), 12, 15);
  const qrCardSize = qrSize + paddingY * 2;
  const logoBadgeSize = clamp(Math.round(qrSize * 0.16), 14, 18);

  const colHeight = avatarSize + gap + labelFontSize + 4;

  return {
    qrSize,
    qrCardSize,
    avatarSize,
    gap,
    paddingY,
    labelFontSize,
    logoBadgeSize,
    height: Math.max(qrCardSize, colHeight),
  };
}

function resolveVerificationDisplayName(identity?: VerificationIdentity | null) {
  const username = identity?.username?.trim();
  if (username) {
    return username.startsWith("@") ? username : `@${username}`;
  }

  const name = identity?.name?.trim();
  if (name) {
    return name;
  }

  return "Trader";
}

function resolveVerificationInitial(identity?: VerificationIdentity | null) {
  const source =
    identity?.username?.trim() || identity?.name?.trim() || "Trader";
  return source.charAt(0).toUpperCase() || "T";
}

function truncateTextToWidth(
  context: CanvasRenderingContext2D,
  value: string,
  maxWidth: number
) {
  if (context.measureText(value).width <= maxWidth) {
    return value;
  }

  let truncated = value;
  while (truncated.length > 1) {
    truncated = truncated.slice(0, -1);
    const candidate = `${truncated}…`;
    if (context.measureText(candidate).width <= maxWidth) {
      return candidate;
    }
  }

  return "…";
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
  const ringElements = new Set<HTMLElement>();

  if (root.matches("[data-widget-share-surface]")) {
    surfaceElements.add(root);
  }

  root
    .querySelectorAll<HTMLElement>("[data-widget-share-surface]")
    .forEach((element) => {
      surfaceElements.add(element);
    });

  const blurElements = new Set<HTMLElement>();
  const overflowExposureElements = new Set<HTMLElement>([root, ...surfaceElements]);
  const allElements = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];

  allElements.forEach((element) => {
    const computedStyle = window.getComputedStyle(element);
    if (computedStyle.boxShadow !== "none" && isRingStyleShadow(computedStyle.boxShadow)) {
      ringElements.add(element);
    }

    if (
      computedStyle.backdropFilter !== "none" ||
      computedStyle.getPropertyValue("-webkit-backdrop-filter") !== "none" ||
      (computedStyle.boxShadow !== "none" &&
        !isRingStyleShadow(computedStyle.boxShadow))
    ) {
      blurElements.add(element);
    }
  });

  [...surfaceElements, ...ringElements].forEach((element) => {
    let current: HTMLElement | null = element;

    while (current && root.contains(current)) {
      if (isOverflowClippingStyle(window.getComputedStyle(current))) {
        overflowExposureElements.add(current);
      }

      if (current === root) {
        break;
      }

      current = current.parentElement;
    }
  });

  const elements = [
    ...new Set<HTMLElement>([
      ...surfaceElements,
      ...blurElements,
      ...overflowExposureElements,
    ]),
  ];
  const snapshots = snapshotStyle(elements);

  elements.forEach((element) => {
    const computedStyle = window.getComputedStyle(element);
    const shouldKeepRingShadow =
      computedStyle.boxShadow !== "none" &&
      isRingStyleShadow(computedStyle.boxShadow);

    if (surfaceElements.has(element)) {
      element.style.setProperty(
        "background-color",
        sidebarBackground,
        "important"
      );
      element.style.setProperty("background-image", "none", "important");
    }

    if (!shouldKeepRingShadow) {
      element.style.setProperty("box-shadow", "none", "important");
    }
    element.style.setProperty("backdrop-filter", "none", "important");
    element.style.setProperty("-webkit-backdrop-filter", "none", "important");

    if (overflowExposureElements.has(element)) {
      element.style.setProperty("overflow", "visible", "important");
      element.style.setProperty("overflow-x", "visible", "important");
      element.style.setProperty("overflow-y", "visible", "important");
    }
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

async function renderWidgetExportCanvas(input: {
  node: HTMLElement;
  pixelRatio: number;
  verificationUrl?: string | null;
  verificationIdentity?: VerificationIdentity | null;
}) {
  const rect = input.node.getBoundingClientRect();
  const safeWidth = Math.max(1, Math.round(rect.width));
  const safeHeight = Math.max(1, Math.round(rect.height));
  const captureInset = {
    x: clamp(Math.round(safeWidth * 0.018), 18, 28),
    top: clamp(Math.round(safeHeight * 0.014), 10, 16),
    bottom: clamp(Math.round(safeHeight * 0.03), 18, 28),
  };
  const basePadding = resolveExportPadding({
    width: safeWidth,
    height: safeHeight,
  });
  const verificationStamp = input.verificationUrl
    ? resolveVerificationStampMetrics({
        width: safeWidth,
        height: safeHeight,
      }, input.verificationUrl)
    : null;
  const padding = {
    x: basePadding.x,
    top: clamp(Math.round(basePadding.y * 0.22), 8, 16),
    bottom:
      verificationStamp != null
        ? Math.max(clamp(Math.round(basePadding.y * 0.62), 22, 44), verificationStamp.height + 18)
        : clamp(Math.round(basePadding.y * 0.5), 18, 36),
  };
  const sidebarBackground = resolveSidebarBackgroundColor();
  const restoreSurfaces = flattenExportSurfaces(input.node, sidebarBackground);
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
    restoreSurfaces();
  }

  const widgetImage = await loadImage(widgetDataUrl);
  const padXPx = padding.x * input.pixelRatio;
  const padTopPx = padding.top * input.pixelRatio;
  const padBottomPx = padding.bottom * input.pixelRatio;
  const qrSizePx =
    verificationStamp != null ? verificationStamp.qrSize * input.pixelRatio : null;
  const qrCardSizePx =
    verificationStamp != null
      ? verificationStamp.qrCardSize * input.pixelRatio
      : null;
  const canvas = document.createElement("canvas");
  canvas.width = widgetImage.width + padXPx * 2;
  canvas.height = widgetImage.height + padTopPx + padBottomPx;

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
    padTopPx,
    widgetImage.width,
    widgetImage.height
  );

  if (
    input.verificationUrl &&
    verificationStamp != null &&
    qrSizePx != null &&
    qrCardSizePx != null
  ) {
    const logoBadgeSizePx =
      verificationStamp.logoBadgeSize * input.pixelRatio;
    const qrDataUrl = await QRCode.toDataURL(input.verificationUrl, {
      errorCorrectionLevel: "H",
      margin: 3,
      width: Math.max(qrSizePx, 256),
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });
    const qrImage = await loadImage(qrDataUrl);
    const qrLogoImage = await loadImage(PROFITABLEDGE_QR_LOGO_DATA_URL).catch(
      () => null
    );
    const avatarSizePx = verificationStamp.avatarSize * input.pixelRatio;
    const gapPx = verificationStamp.gap * input.pixelRatio;
    const fontSizePx = verificationStamp.labelFontSize * input.pixelRatio;
    const maxLabelWidthPx = clamp(
      Math.round(canvas.width * 0.18),
      96 * input.pixelRatio,
      220 * input.pixelRatio
    );
    const displayName = resolveVerificationDisplayName(input.verificationIdentity);
    const avatarLabelGapPx = gapPx;
    const labelQrGapPx = gapPx;

    context.save();
    context.font = `600 ${fontSizePx}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    context.textBaseline = "middle";
    const truncatedDisplayName = truncateTextToWidth(
      context,
      displayName,
      maxLabelWidthPx
    );
    const labelWidthPx = context.measureText(truncatedDisplayName).width;
    context.restore();

    const colHeightPx = avatarSizePx + avatarLabelGapPx + fontSizePx;
    const stampHeightPx = Math.max(qrCardSizePx, colHeightPx);
    const stampX = padXPx;
    const stampY =
      canvas.height - padBottomPx + Math.round((padBottomPx - stampHeightPx) / 2);
    const qrCardX = stampX;
    const qrCardY = stampY + Math.round((stampHeightPx - qrCardSizePx) / 2);
    const qrInsetPx = Math.round((qrCardSizePx - qrSizePx) / 2);
    const colX = qrCardX + qrCardSizePx + labelQrGapPx;
    const colCenterX = colX + Math.max(avatarSizePx, labelWidthPx) / 2;
    const colTopY = stampY + Math.round((stampHeightPx - colHeightPx) / 2);
    const avatarX = Math.round(colCenterX - avatarSizePx / 2);
    const avatarY = colTopY;
    const labelX = colCenterX;
    const labelY = colTopY + avatarSizePx + avatarLabelGapPx + fontSizePx / 2;

    context.save();
    context.beginPath();
    context.arc(
      avatarX + avatarSizePx / 2,
      avatarY + avatarSizePx / 2,
      avatarSizePx / 2,
      0,
      Math.PI * 2
    );
    context.closePath();
    context.clip();

    const avatarImageUrl = input.verificationIdentity?.imageUrl ?? null;
    let avatarImage: HTMLImageElement | null = null;
    if (avatarImageUrl) {
      avatarImage = await loadImage(avatarImageUrl, {
        crossOrigin: "anonymous",
      }).catch(() => null);
    }

    if (avatarImage) {
      context.drawImage(avatarImage, avatarX, avatarY, avatarSizePx, avatarSizePx);
    } else {
      context.fillStyle = "rgba(255, 255, 255, 0.08)";
      context.fillRect(avatarX, avatarY, avatarSizePx, avatarSizePx);
      context.fillStyle = "#ffffff";
      context.font = `700 ${Math.round(avatarSizePx * 0.42)}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(
        resolveVerificationInitial(input.verificationIdentity),
        avatarX + avatarSizePx / 2,
        avatarY + avatarSizePx / 2
      );
    }
    context.restore();

    context.strokeStyle = "rgba(255, 255, 255, 0.14)";
    context.lineWidth = Math.max(1.5, Math.round(input.pixelRatio));
    context.beginPath();
    context.arc(
      avatarX + avatarSizePx / 2,
      avatarY + avatarSizePx / 2,
      avatarSizePx / 2 - context.lineWidth / 2,
      0,
      Math.PI * 2
    );
    context.stroke();

    context.fillStyle = "rgba(255, 255, 255, 0.88)";
    context.font = `600 ${fontSizePx}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(truncatedDisplayName, labelX, labelY);

    context.fillStyle = "#ffffff";
    drawRoundedRect(
      context,
      qrCardX + qrInsetPx,
      qrCardY + qrInsetPx,
      qrSizePx,
      qrSizePx,
      12 * input.pixelRatio
    );
    context.fill();

    context.save();
    context.imageSmoothingEnabled = false;
    context.drawImage(
      qrImage,
      qrCardX + qrInsetPx,
      qrCardY + qrInsetPx,
      qrSizePx,
      qrSizePx
    );
    context.restore();

    if (qrLogoImage) {
      const logoBadgeX =
        qrCardX + qrInsetPx + Math.round((qrSizePx - logoBadgeSizePx) / 2);
      const logoBadgeY =
        qrCardY + qrInsetPx + Math.round((qrSizePx - logoBadgeSizePx) / 2);
      const logoInsetPx = Math.max(3, Math.round(logoBadgeSizePx * 0.18));

      context.fillStyle = "#FFFFFF";
      drawRoundedRect(
        context,
        logoBadgeX,
        logoBadgeY,
        logoBadgeSizePx,
        logoBadgeSizePx,
        Math.round(logoBadgeSizePx * 0.26)
      );
      context.fill();

      context.drawImage(
        qrLogoImage,
        logoBadgeX + logoInsetPx,
        logoBadgeY + logoInsetPx,
        logoBadgeSizePx - logoInsetPx * 2,
        logoBadgeSizePx - logoInsetPx * 2
      );
    }
  }

  return canvas;
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const boundedRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + boundedRadius, y);
  context.lineTo(x + width - boundedRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + boundedRadius);
  context.lineTo(x + width, y + height - boundedRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - boundedRadius, y + height);
  context.lineTo(x + boundedRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - boundedRadius);
  context.lineTo(x, y + boundedRadius);
  context.quadraticCurveTo(x, y, x + boundedRadius, y);
  context.closePath();
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
  const canvas = await renderWidgetExportCanvas({
    node: input.node,
    pixelRatio: 2,
    verificationUrl: null,
  });
  const webpBlob = await canvasToBlob(canvas, "image/webp", 0.92).catch(
    async () => canvasToBlob(canvas, "image/png")
  );
  const extension = webpBlob.type === "image/webp" ? "webp" : "png";

  return new File([webpBlob], `${slugify(input.title) || "dashboard-widget"}.${extension}`, {
    type: webpBlob.type,
  });
}

export async function createWidgetShareSnapshotFile(input: {
  node: HTMLElement;
  title: string;
}) {
  const markup = createWidgetShareSnapshotMarkup(input.node);
  const blob = new Blob([markup], {
    type: "text/html;charset=utf-8",
  });

  return new File(
    [blob],
    `${slugify(input.title) || "dashboard-widget"}.html`,
    {
      type: "text/html",
    }
  );
}

export async function exportWidgetAsPng(input: {
  node: HTMLElement;
  title: string;
  verificationUrl?: string | null;
  verificationIdentity?: VerificationIdentity | null;
}) {
  const canvas = await renderWidgetExportCanvas({
    node: input.node,
    pixelRatio: 3,
    verificationUrl: input.verificationUrl ?? null,
    verificationIdentity: input.verificationIdentity ?? null,
  });

  const finalDataUrl = canvas.toDataURL("image/png");
  downloadDataUrl(
    finalDataUrl,
    `${slugify(input.title) || "dashboard-widget"}.png`
  );
}
