const DEFAULT_DESKTOP_AUTH_PATH = "/dashboard";
const DEFAULT_LOGIN_PATH = "/login";

export function sanitizeDesktopAuthPath(path: string | null | undefined) {
  if (!path || !path.startsWith("/")) {
    return DEFAULT_DESKTOP_AUTH_PATH;
  }

  return path;
}

export function buildDesktopDeepLink(path: string) {
  const params = new URLSearchParams({
    path: sanitizeDesktopAuthPath(path),
  });
  return `profitabledge://open?${params.toString()}`;
}

export function buildDesktopLoginDeepLink() {
  return `profitabledge://open?${new URLSearchParams({
    path: DEFAULT_LOGIN_PATH,
  }).toString()}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderDesktopLaunchPage(options: {
  title: string;
  message: string;
  actionUrl?: string | null;
  actionLabel?: string | null;
}) {
  const actionMarkup =
    options.actionUrl && options.actionLabel
      ? `<a class="action" href="${escapeHtml(options.actionUrl)}">${escapeHtml(
          options.actionLabel
        )}</a>`
      : "";
  const autoOpenScript = options.actionUrl
    ? `<script>window.addEventListener("load", () => { window.location.replace(${JSON.stringify(
        options.actionUrl
      )}); });</script>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(options.title)}</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        background:
          radial-gradient(circle at top, rgba(24, 54, 110, 0.35), transparent 42%),
          #0b0d12;
        color: #f5f7fb;
      }
      main {
        width: min(100%, 440px);
        text-align: center;
      }
      h1 {
        margin: 0;
        font-size: 32px;
        line-height: 1.05;
        font-weight: 700;
        letter-spacing: -0.04em;
      }
      p {
        margin: 16px 0 0;
        color: rgba(245, 247, 251, 0.72);
        font-size: 16px;
        line-height: 1.6;
      }
      .action {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-top: 24px;
        min-width: 176px;
        height: 48px;
        padding: 0 20px;
        border-radius: 14px;
        border: 1px solid rgba(255, 255, 255, 0.14);
        background: rgba(255, 255, 255, 0.06);
        color: inherit;
        text-decoration: none;
        font-size: 15px;
        font-weight: 600;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(options.title)}</h1>
      <p>${escapeHtml(options.message)}</p>
      ${actionMarkup}
    </main>
    ${autoOpenScript}
  </body>
</html>`;
}
