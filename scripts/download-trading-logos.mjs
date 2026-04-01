import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const catalogPath = path.join(
  repoRoot,
  "packages/contracts/src/trading-catalog.json"
);

const publicRoot = path.join(repoRoot, "apps/web/public");
const docsRoot = path.join(repoRoot, "docs");

const brokerDir = path.join(publicRoot, "brokers");
const propDir = path.join(publicRoot, "prop-logos");
const platformDir = path.join(publicRoot, "platforms");

const sourceCopyMap = {
  ctrader: path.join(publicRoot, "brokers/ctrader.svg"),
  mt5: path.join(publicRoot, "brokers/mt5.png"),
  ninjatrader: path.join(publicRoot, "brokers/ninjatrader.svg"),
  tradovate: path.join(publicRoot, "brokers/tradovate.png"),
};

const OVERRIDE_LOGO_URLS = {
  avatrade: "https://www.avatrade.com/favicon.ico",
  "backpack-exchange": "https://www.google.com/s2/favicons?domain=backpack.exchange&sz=128",
  binance: "https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/binance.svg",
  btcc: "https://www.google.com/s2/favicons?domain=btcc.com&sz=128",
  btse: "https://www.google.com/s2/favicons?domain=btse.com&sz=128",
  bybit: "https://www.bybit.com/favicon.ico",
  "charles-schwab": "https://www.google.com/s2/favicons?domain=schwab.com&sz=128",
  "city-index": "https://www.google.com/s2/favicons?domain=cityindex.com&sz=128",
  deribit: "https://assets.deribit.com/favicon/prod/favicon-32x32.png",
  dydx: "https://dydx.trade/favicon.svg",
  etrade:
    "https://cdn2.etrade.net/1/26022716140.0/aempros/content/dam/etrade/retail/en_US/images/global/logos/etrade-from-morgan-stanley-logo-dark-theme.svg",
  easymarkets: "https://www.google.com/s2/favicons?domain=easymarkets.com&sz=128",
  "forex-com": "https://www.google.com/s2/favicons?domain=forex.com&sz=128",
  "fp-markets": "https://www.google.com/s2/favicons?domain=fpmarkets.com&sz=128",
  fxpro: "https://www.fxpro.com/favicon.ico",
  hfm: "https://www.google.com/s2/favicons?domain=hfm.com&sz=128",
  hycm: "https://www.google.com/s2/favicons?domain=hycm.com&sz=128",
  "ic-markets": "https://www.icmarkets.com/ICM_Favicon.ico",
  ironbeam: "https://www.google.com/s2/favicons?domain=ironbeam.com&sz=128",
  "kucoin-futures": "https://www.kucoin.com/logo.png",
  "lightspeed-futures": "https://lightspeed.com/favicon.ico",
  ninjatrader: "https://ninjatrader.com/favicon.ico",
  "plus500-futures": "https://www.google.com/s2/favicons?domain=plus500.com&sz=128",
  skilling: "https://www.google.com/s2/favicons?domain=skilling.com&sz=128",
  stonex: "https://www.stonex.com/favicon.ico",
  vantage: "https://www.google.com/s2/favicons?domain=vantagemarkets.com&sz=128",
  xm: "https://cloud.xm-cdn.com/static/xm/common/logos/revamp/XM-logo.jpg",
  "alpha-capital-group": "https://www.google.com/s2/favicons?domain=alphacapitalgroup.uk&sz=128",
  "apex-trader-funding":
    "https://www.google.com/s2/favicons?sz=64&domain_url=apextraderfunding.com",
  "audacity-capital": "https://audacity.capital/favicon.svg",
  "elite-trader-funding":
    "https://www.google.com/s2/favicons?sz=64&domain_url=elitetraderfunding.com",
  "finotive-funding": "https://finotivefunding.com/landing/favicons/favicon-96x96.png",
  "funded-futures-network": "https://fundedfuturesnetwork.com/assets/favicon.ico",
  "funded-trading-plus": "https://www.fundedtradingplus.com/favicon.ico",
  fundednext: "https://dirslur24ie1a.cloudfront.net/fundednext/short_logo.png",
  "fundednext-futures":
    "https://dirslur24ie1a.cloudfront.net/fundednext/FundedNext_Futures_Logo_White.svg",
  "hold-brothers": "https://www.google.com/s2/favicons?sz=64&domain_url=holdbrothers.com",
  "kershner-trading-group": "https://kershnertrading.com/public/images/favicon.png",
  "leeloo-trading": "https://leelootrading.com/content/websites/shared/images/leeloo-logo-v2.svg",
  "maverick-trading":
    "https://mavericktrading.com/wp-content/uploads/2018/12/Maverick-Trading_Main-Logo-Favicon.png",
  "my-forex-funds": "https://www.google.com/s2/favicons?domain=myforexfunds.com&sz=128",
  "oneup-trader":
    "https://www.oneuptrader.com/wp-content/uploads/2022/10/oneup-header.svg",
  rebelsfunding: "https://rebelsfunding.com/favicon-32x32.png",
  the5ers: "https://the5ers.com/favicon.png?v=2",
  tickticktrader: "https://www.google.com/s2/favicons?sz=64&domain_url=tickticktrader.com",
  "funded-engineer":
    "https://web.archive.org/web/20230407091944im_/https://fundedengineer.com/wp-content/uploads/2023/01/Fundedengineer-removebg-preview.png",
  surgetrader:
    "https://web.archive.org/web/20230905155202im_/https://surgetrader.com/wp-content/uploads/2023/04/header-logo-yellow-tag-optimized.png",
  "true-forex-funds":
    "https://trueforexfunds.com/wp-content/themes/tff/img/favicons/favicon.svg",
};

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizeHost(input) {
  try {
    return new URL(input).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ProfitabledgeCatalogBot/1.0",
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/png,image/svg+xml,*/*;q=0.8",
        ...options.headers,
      },
      ...options,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function extractAttr(fragment, attr) {
  const match = fragment.match(
    new RegExp(`${attr}=["']([^"']+)["']`, "i")
  );
  return match?.[1] ?? null;
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#47;/g, "/");
}

function decodeNextImageUrl(value, baseUrl) {
  try {
    const parsed = new URL(value, baseUrl);
    const nested = parsed.searchParams.get("url");
    if (!nested) return parsed.toString();
    return new URL(nested, baseUrl).toString();
  } catch {
    return value;
  }
}

function addCandidate(candidates, value, baseUrl) {
  if (!value) return;

  const decodedValue = decodeHtmlEntities(value);
  const normalizedValue = decodedValue.includes("/_next/image?")
    ? decodeNextImageUrl(decodedValue, baseUrl)
    : decodedValue;

  try {
    candidates.add(new URL(normalizedValue, baseUrl).toString());
  } catch {}
}

function extractCandidates(html, baseUrl, entity) {
  const candidates = new Set();
  const aliasTokens = [entity.displayName, ...(entity.aliases || [])]
    .map((value) => String(value || "").toLowerCase())
    .filter(Boolean);

  for (const match of html.matchAll(/<link[^>]+>/gi)) {
    const tag = match[0];
    const rel = extractAttr(tag, "rel")?.toLowerCase() ?? "";
    const href = extractAttr(tag, "href");
    if (!href) continue;
    if (
      rel.includes("icon") ||
      rel.includes("apple-touch-icon") ||
      rel.includes("mask-icon")
    ) {
      addCandidate(candidates, href, baseUrl);
    }
  }

  for (const match of html.matchAll(/<meta[^>]+>/gi)) {
    const tag = match[0];
    const property = extractAttr(tag, "property")?.toLowerCase() ?? "";
    const name = extractAttr(tag, "name")?.toLowerCase() ?? "";
    const content = extractAttr(tag, "content");
    if (!content) continue;
    if (property === "og:image" || name === "twitter:image") {
      addCandidate(candidates, content, baseUrl);
    }
  }

  for (const match of html.matchAll(/<(img|source)[^>]+>/gi)) {
    const tag = match[0];
    const src =
      extractAttr(tag, "src") ||
      extractAttr(tag, "data-src") ||
      extractAttr(tag, "srcset")?.split(",")[0]?.trim().split(" ")[0] ||
      extractAttr(tag, "data-srcset")?.split(",")[0]?.trim().split(" ")[0] ||
      "";
    const alt = extractAttr(tag, "alt")?.toLowerCase() ?? "";
    const loweredSrc = src.toLowerCase();

    const looksLikeBrandAsset =
      /(logo|brand|icon|wordmark|header|short_logo|symbol|mark)/i.test(src) ||
      aliasTokens.some(
        (token) => token && (alt.includes(token) || loweredSrc.includes(token.replace(/\s+/g, "")))
      );

    if (looksLikeBrandAsset) {
      addCandidate(candidates, src, baseUrl);
    }
  }

  try {
    const origin = new URL(baseUrl).origin;
    [
      "/favicon.svg",
      "/favicon.png",
      "/favicon.ico",
      "/apple-touch-icon.png",
      "/apple-touch-icon-precomposed.png",
      "/logo.svg",
      "/logo.png",
      "/assets/logo.svg",
      "/assets/logo.png",
      "/images/logo.svg",
      "/images/logo.png",
    ].forEach((suffix) => candidates.add(`${origin}${suffix}`));
  } catch {}

  return Array.from(candidates);
}

function staticCandidatesFromWebsite(website) {
  const candidates = new Set();

  try {
    const origin = new URL(website).origin;
    [
      "/favicon.svg",
      "/favicon.png",
      "/favicon-32x32.png",
      "/favicon-64x64.png",
      "/favicon.ico",
      "/apple-touch-icon.png",
      "/apple-touch-icon-precomposed.png",
      "/logo.svg",
      "/logo.png",
      "/logo.webp",
      "/assets/logo.svg",
      "/assets/logo.png",
      "/images/logo.svg",
      "/images/logo.png",
    ].forEach((suffix) => candidates.add(`${origin}${suffix}`));
  } catch {}

  return Array.from(candidates);
}

function scoreCandidate(url, website) {
  const lowered = url.toLowerCase();
  let score = 0;

  if (lowered.endsWith(".svg") || lowered.includes(".svg?")) score += 100;
  if (lowered.endsWith(".png") || lowered.includes(".png?")) score += 80;
  if (lowered.endsWith(".webp") || lowered.includes(".webp?")) score += 50;
  if (lowered.endsWith(".jpg") || lowered.includes(".jpg?") || lowered.endsWith(".jpeg")) score += 20;
  if (lowered.endsWith(".ico") || lowered.includes(".ico?")) score += 10;
  if (lowered.includes("apple-touch-icon")) score += 20;
  if (lowered.includes("mask-icon")) score += 15;
  if (lowered.includes("logo")) score += 25;
  if (lowered.includes("favicon")) score += 5;

  const websiteHost = normalizeHost(website);
  const candidateHost = normalizeHost(url);
  if (websiteHost && candidateHost === websiteHost) score += 20;
  if (candidateHost.startsWith("logo.clearbit.com")) score -= 10;

  return score;
}

function extensionFromUrl(url, contentType) {
  const lowered = url.toLowerCase();
  if (contentType?.includes("svg")) return "svg";
  if (contentType?.includes("png")) return "png";
  if (contentType?.includes("webp")) return "webp";
  if (contentType?.includes("jpeg") || contentType?.includes("jpg")) return "jpg";
  if (contentType?.includes("icon") || contentType?.includes("x-icon")) return "ico";
  if (lowered.endsWith(".svg") || lowered.includes(".svg?")) return "svg";
  if (lowered.endsWith(".png") || lowered.includes(".png?")) return "png";
  if (lowered.endsWith(".webp") || lowered.includes(".webp?")) return "webp";
  if (lowered.endsWith(".jpg") || lowered.endsWith(".jpeg") || lowered.includes(".jpg?") || lowered.includes(".jpeg?")) return "jpg";
  if (lowered.endsWith(".ico") || lowered.includes(".ico?")) return "ico";
  return "bin";
}

function detectBufferFormat(buffer) {
  const header = buffer.subarray(0, 64);
  const headerText = header.toString("utf8").trimStart().toLowerCase();

  if (header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "png";
  }

  if (header.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    return "jpg";
  }

  if (header.subarray(0, 4).toString("ascii") === "RIFF" && header.subarray(8, 12).toString("ascii") === "WEBP") {
    return "webp";
  }

  if (header.subarray(4, 12).toString("ascii").includes("ftyp") && buffer.includes(Buffer.from("avif"))) {
    return "avif";
  }

  if (header.subarray(0, 4).equals(Buffer.from([0x00, 0x00, 0x01, 0x00]))) {
    return "ico";
  }

  if (headerText.startsWith("<!doctype html") || headerText.startsWith("<html")) {
    return "html";
  }

  if (headerText.startsWith("<?xml") || headerText.startsWith("<svg")) {
    return buffer.toString("utf8").includes("<svg") ? "svg" : "xml";
  }

  return extensionFromUrl("", "");
}

async function isValidExistingPng(filePath) {
  try {
    const buffer = await fs.readFile(filePath);
    return detectBufferFormat(buffer) === "png";
  } catch {
    return false;
  }
}

function runSips(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const child = spawn("sips", ["-s", "format", "png", inputPath, "--out", outputPath]);
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr || `sips failed with code ${code}`));
    });
  });
}

async function writeTempFile(buffer, extension) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pe-logo-"));
  const filePath = path.join(tempDir, `source.${extension}`);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

async function convertToPng(buffer, extension, targetPath) {
  const sourcePath = await writeTempFile(buffer, extension);
  await runSips(sourcePath, targetPath);
}

async function writeBufferAsPng(buffer, sourceFormat, targetPath) {
  if (sourceFormat === "png") {
    await fs.writeFile(targetPath, buffer);
    return;
  }

  if (sourceFormat === "jpg" || sourceFormat === "webp" || sourceFormat === "avif") {
    await sharp(buffer).png().toFile(targetPath);
    return;
  }

  if (sourceFormat === "svg") {
    await convertToPng(buffer, "svg", targetPath);
    return;
  }

  throw new Error(`Unsupported image format: ${sourceFormat}`);
}

function createFallbackSvg(entity) {
  const label = entity.displayName
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "PE";

  const hueSeed = Array.from(entity.id).reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0
  );
  const hue = hueSeed % 360;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="hsl(${hue} 70% 58%)" />
      <stop offset="100%" stop-color="hsl(${(hue + 45) % 360} 72% 46%)" />
    </linearGradient>
  </defs>
  <rect width="256" height="256" rx="72" fill="url(#g)" />
  <text x="128" y="146" text-anchor="middle" font-size="82" font-family="Arial, sans-serif" font-weight="700" fill="#ffffff">${label}</text>
</svg>`;
}

async function generateFallbackPng(entity, targetPath) {
  const svg = createFallbackSvg(entity);
  await convertToPng(Buffer.from(svg), "svg", targetPath);
}

async function copyKnownPlatformAsset(platformId, targetPath) {
  const source = sourceCopyMap[platformId];
  if (!source) return false;
  if (!(await fileExists(source))) return false;

  const ext = path.extname(source).replace(".", "").toLowerCase();
  const buffer = await fs.readFile(source);

  if (ext === "png") {
    await fs.writeFile(targetPath, buffer);
    return true;
  }

  await convertToPng(buffer, ext || "svg", targetPath);
  return true;
}

async function getLogoCandidates(entity) {
  const candidateUrls = new Set();
  const preferredLogoUrl = OVERRIDE_LOGO_URLS[entity.id] ?? null;

  if (preferredLogoUrl) {
    candidateUrls.add(preferredLogoUrl);
  }

  if (entity.website) {
    candidateUrls.add(
      `https://www.google.com/s2/favicons?domain=${normalizeHost(entity.website)}&sz=128`
    );
    for (const candidate of staticCandidatesFromWebsite(entity.website)) {
      candidateUrls.add(candidate);
    }
  }

  if (entity.website) {
    try {
      const page = await fetchWithTimeout(entity.website, {}, 18000);
      if (page.ok) {
        const html = await page.text();
        for (const candidate of extractCandidates(html, page.url, entity)) {
          candidateUrls.add(candidate);
        }
      }
    } catch {}
  }

  return Array.from(candidateUrls).sort(
    (left, right) =>
      (right === preferredLogoUrl ? 10_000 : 0) +
        scoreCandidate(right, entity.website || "") -
      ((left === preferredLogoUrl ? 10_000 : 0) +
        scoreCandidate(left, entity.website || ""))
  );
}

async function saveEntityLogo(entity, folder) {
  const targetDir =
    folder === "brokers" ? brokerDir : folder === "prop-logos" ? propDir : platformDir;
  const targetPath = path.join(targetDir, `${entity.id}.png`);

  if (await fileExists(targetPath)) {
    if (!(await isValidExistingPng(targetPath))) {
      await fs.unlink(targetPath);
    } else {
      return {
        id: entity.id,
        displayName: entity.displayName,
        type: entity.type,
        website: entity.website,
        logoPath: targetPath,
        logoStatus: "ready",
        logoFormat: "PNG",
        sourceUrl: "existing",
        notes: null,
      };
    }
  }

  if (await fileExists(targetPath)) {
    return {
      id: entity.id,
      displayName: entity.displayName,
      type: entity.type,
      website: entity.website,
      logoPath: targetPath,
      logoStatus: "ready",
      logoFormat: "PNG",
      sourceUrl: "existing",
      notes: null,
    };
  }

  if (entity.type === "platform") {
    const copied = await copyKnownPlatformAsset(entity.id, targetPath);
    if (copied) {
      return {
        id: entity.id,
        displayName: entity.displayName,
        type: entity.type,
        website: entity.website,
        logoPath: targetPath,
        logoStatus: "ready",
        logoFormat: "PNG",
        sourceUrl: "local-source",
        notes: null,
      };
    }
  }

  const candidates = await getLogoCandidates(entity);
  const visited = new Set();

  for (const candidate of candidates) {
    if (!candidate || visited.has(candidate)) continue;
    visited.add(candidate);

    try {
      const response = await fetchWithTimeout(candidate, {}, 12000);
      if (!response.ok) continue;

      const contentType = response.headers.get("content-type") || "";
      if (
        !contentType.startsWith("image/") &&
        !candidate.toLowerCase().includes("favicon") &&
        !candidate.toLowerCase().includes("logo")
      ) {
        continue;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const extension = extensionFromUrl(candidate, contentType);
      if (buffer.length === 0) continue;
      const detectedFormat = detectBufferFormat(buffer);

      if (detectedFormat === "html" || detectedFormat === "xml") {
        continue;
      }

      await writeBufferAsPng(buffer, detectedFormat || extension, targetPath);

      return {
        id: entity.id,
        displayName: entity.displayName,
        type: entity.type,
        website: entity.website,
        logoPath: targetPath,
        logoStatus: "ready",
        logoFormat: "PNG",
        sourceUrl: candidate,
        notes:
          detectedFormat === "svg"
            ? "Converted from SVG"
            : detectedFormat && detectedFormat !== "png"
              ? `Converted from ${detectedFormat.toUpperCase()}`
              : null,
      };
    } catch {}
  }

  await generateFallbackPng(entity, targetPath);

  return {
    id: entity.id,
    displayName: entity.displayName,
    type: entity.type,
    website: entity.website,
    logoPath: targetPath,
    logoStatus: "fallback",
    logoFormat: "PNG",
    sourceUrl: null,
    notes: "Generated monogram placeholder",
  };
}

function csvEscape(value) {
  const stringValue = Array.isArray(value) ? value.join(",") : String(value ?? "");
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

async function writeCsv(filePath, headers, rows) {
  const content = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n");

  await fs.writeFile(filePath, `${content}\n`);
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
      await sleep(150);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}

async function main() {
  await Promise.all([
    ensureDir(brokerDir),
    ensureDir(propDir),
    ensureDir(platformDir),
    ensureDir(docsRoot),
  ]);

  const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8"));
  const allEntities = [
    ...catalog.brokers,
    ...catalog.propFirms,
    ...catalog.platforms.filter((platform) => platform.id !== "other"),
  ];

  const audits = await mapWithConcurrency(allEntities, 8, async (entity) => {
    const folder =
      entity.type === "broker"
        ? "brokers"
        : entity.type === "prop-firm"
          ? "prop-logos"
          : "platforms";

    return saveEntityLogo(entity, folder);
  });

  const masterRows = [
    ...catalog.propFirms.map((entry) => ({
      id: entry.id,
      displayName: entry.displayName,
      type: entry.type,
      category: entry.category,
      status: entry.status,
      website: entry.website,
      platforms: entry.supportedPlatforms,
      serverPatterns: entry.brokerDetectionPatterns,
      logoPath: entry.logo,
      regulators: [],
      headquarters: "",
    })),
    ...catalog.brokers.map((entry) => ({
      id: entry.id,
      displayName: entry.displayName,
      type: entry.type,
      category: entry.category,
      status: entry.status,
      website: entry.website,
      platforms: entry.platforms,
      serverPatterns: entry.serverPatterns,
      logoPath: entry.logo,
      regulators: entry.regulators,
      headquarters: entry.headquarters,
    })),
  ].map((entry, idx) => {
    const audit = audits.find((item) => item.id === entry.id && item.type === entry.type);
    return {
      index: idx + 1,
      id: entry.id,
      displayName: entry.displayName,
      type: entry.type,
      category: entry.category,
      status: entry.status,
      website: entry.website,
      platforms: entry.platforms.join(","),
      serverPatterns: entry.serverPatterns.join(","),
      logoFound: audit?.logoStatus === "ready" ? "yes" : audit?.logoStatus === "fallback" ? "fallback" : "no",
      logoFormat: audit?.logoFormat ?? "",
      regulators: entry.regulators.join(","),
      headquarters: entry.headquarters,
      logoPath: entry.logoPath,
    };
  });

  await writeCsv(
    path.join(docsRoot, "trading-firms-master.csv"),
    [
      "index",
      "id",
      "displayName",
      "type",
      "category",
      "status",
      "website",
      "platforms",
      "serverPatterns",
      "logoFound",
      "logoFormat",
      "regulators",
      "headquarters",
      "logoPath",
    ],
    masterRows
  );

  await writeCsv(
    path.join(docsRoot, "trading-firms-logo-audit.csv"),
    [
      "id",
      "displayName",
      "type",
      "website",
      "logoPath",
      "logoStatus",
      "logoFormat",
      "sourceUrl",
      "notes",
    ],
    audits
  );

  const summary = {
    generatedAt: new Date().toISOString(),
    brokerCount: catalog.brokers.length,
    propFirmCount: catalog.propFirms.length,
    futuresEntities:
      catalog.brokers.filter((broker) => broker.category === "futures").length +
      catalog.propFirms.filter((firm) => firm.category === "futures").length,
    logoReadyCount: audits.filter((item) => item.logoStatus === "ready").length,
    logoFallbackCount: audits.filter((item) => item.logoStatus === "fallback").length,
    logoMissingCount: audits.filter((item) => item.logoStatus === "missing").length,
    detectionPatternCount:
      catalog.brokers.reduce((sum, broker) => sum + broker.serverPatterns.length, 0) +
      catalog.propFirms.reduce(
        (sum, firm) => sum + firm.brokerDetectionPatterns.length,
        0
      ),
  };

  await fs.writeFile(
    path.join(docsRoot, "trading-firms-summary.json"),
    JSON.stringify(summary, null, 2) + "\n"
  );

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
