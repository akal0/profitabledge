import { normalizeOriginUrl } from "@profitabledge/platform/origin-utils";

const productionServerUrl = "https://www.api.profitabledge.com";
const productionWebUrl = "https://beta.profitabledge.com";

function inferWebUrl(serverUrl: string) {
  if (serverUrl.includes(":3000")) {
    return serverUrl.replace(":3000", ":3001");
  }

  return serverUrl;
}

function parseNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const defaultServerUrl = import.meta.env.PROD
  ? productionServerUrl
  : "http://localhost:3000";
const defaultWebUrl = import.meta.env.PROD
  ? productionWebUrl
  : inferWebUrl(defaultServerUrl);

const serverUrl =
  normalizeOriginUrl(import.meta.env.VITE_SERVER_URL) || defaultServerUrl;
const webUrl =
  normalizeOriginUrl(import.meta.env.VITE_WEB_URL) || defaultWebUrl;

export const env = {
  serverUrl,
  webUrl,
  notificationPollMs: parseNumber(
    import.meta.env.VITE_NOTIFICATION_POLL_MS,
    30_000
  ),
  globalShortcut:
    import.meta.env.VITE_GLOBAL_SHORTCUT || "CommandOrControl+Shift+K",
};
