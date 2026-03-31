export function isTauriApp() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

type TauriCoreModule = typeof import("@tauri-apps/api/core");
type TauriWindowModule = typeof import("@tauri-apps/api/window");
type TauriEventModule = typeof import("@tauri-apps/api/event");
type TauriDpiModule = typeof import("@tauri-apps/api/dpi");
type TauriWebviewModule = typeof import("@tauri-apps/api/webview");
type TauriWebviewWindowModule = typeof import("@tauri-apps/api/webviewWindow");
type DeepLinkModule = typeof import("@tauri-apps/plugin-deep-link");
type GlobalShortcutModule = typeof import("@tauri-apps/plugin-global-shortcut");
type NotificationModule = typeof import("@tauri-apps/plugin-notification");
type AutostartModule = typeof import("@tauri-apps/plugin-autostart");
type UpdaterModule = typeof import("@tauri-apps/plugin-updater");
type AppUpdateHandle = Awaited<ReturnType<UpdaterModule["check"]>>;
export type DetachedWindowHandle = import("@tauri-apps/api/webviewWindow").WebviewWindow;
export type ChildWebviewHandle = import("@tauri-apps/api/webview").Webview;

export type LogicalBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const DESKTOP_WEBVIEW_USER_AGENT_MARKER = "ProfitabledgeDesktop/1";

function getDesktopWebviewUserAgent() {
  if (typeof navigator === "undefined") {
    return DESKTOP_WEBVIEW_USER_AGENT_MARKER;
  }

  return navigator.userAgent.includes(DESKTOP_WEBVIEW_USER_AGENT_MARKER)
    ? navigator.userAgent
    : `${navigator.userAgent} ${DESKTOP_WEBVIEW_USER_AGENT_MARKER}`;
}

export async function showAppWindow() {
  if (!isTauriApp()) return;
  const windowModule = (await import("@tauri-apps/api/window")) as TauriWindowModule;
  const currentWindow = windowModule.getCurrentWindow?.();
  await currentWindow?.show();
  await currentWindow?.unminimize();
  await currentWindow?.setFocus();
}

export async function hideAppWindow() {
  if (!isTauriApp()) return;
  const windowModule = (await import("@tauri-apps/api/window")) as TauriWindowModule;
  const currentWindow = windowModule.getCurrentWindow?.();
  await currentWindow?.hide();
}

export async function closeAppWindow() {
  if (!isTauriApp()) {
    if (typeof window !== "undefined") {
      window.close();
    }
    return;
  }

  const windowModule = (await import("@tauri-apps/api/window")) as TauriWindowModule;
  const currentWindow = windowModule.getCurrentWindow?.();
  await currentWindow?.close();
}

export async function registerGlobalPaletteShortcut(
  shortcut: string,
  onTrigger: () => void | Promise<void>
) {
  if (!isTauriApp()) {
    return () => undefined;
  }

  try {
    const shortcuts = (await import(
      "@tauri-apps/plugin-global-shortcut"
    )) as GlobalShortcutModule;
    await shortcuts.unregister(shortcut).catch(() => undefined);
    await shortcuts.register(shortcut, onTrigger);

    return async () => {
      await shortcuts.unregister(shortcut).catch(() => undefined);
    };
  } catch (error) {
    console.warn("[desktop] failed to register global shortcut", error);
    return () => undefined;
  }
}

export async function listenForRustEvent<T>(
  eventName: string,
  handler: (payload: T) => void
) {
  if (!isTauriApp()) {
    return () => undefined;
  }

  const events = (await import("@tauri-apps/api/event")) as TauriEventModule;
  const unlisten = await events.listen<T>(eventName, (event) => handler(event.payload));

  return async () => {
    if (typeof unlisten === "function") {
      await unlisten();
    }
  };
}

export async function emitToTarget<T>(
  target: string,
  eventName: string,
  payload: T
) {
  if (!isTauriApp()) {
    return;
  }

  const events = (await import("@tauri-apps/api/event")) as TauriEventModule;
  await events.emitTo(target, eventName, payload);
}

export async function listenForDeepLinks(
  handler: (url: string) => void
) {
  if (!isTauriApp()) {
    return () => undefined;
  }

  try {
    const deepLink = (await import(
      "@tauri-apps/plugin-deep-link"
    )) as DeepLinkModule;

    const currentUrls = await deepLink.getCurrent().catch(() => null);
    for (const url of currentUrls ?? []) {
      if (typeof url === "string" && url.length > 0) {
        handler(url);
      }
    }

    const unlisten = await deepLink.onOpenUrl((urls) => {
      for (const url of urls ?? []) {
        if (typeof url === "string" && url.length > 0) {
          handler(url);
        }
      }
    });

    return async () => {
      await unlisten();
    };
  } catch (error) {
    console.warn("[desktop] failed to initialize deep links", error);
    return () => undefined;
  }
}

export async function registerDeepLinkScheme(scheme: string) {
  if (!isTauriApp()) {
    return false;
  }

  try {
    const deepLink = (await import(
      "@tauri-apps/plugin-deep-link"
    )) as DeepLinkModule;
    await deepLink.register(scheme);
    return true;
  } catch (error) {
    console.warn(`[desktop] failed to register deep link scheme '${scheme}'`, error);
    return false;
  }
}

export async function sendNativeNotification(options: {
  title: string;
  body: string;
}) {
  if (!isTauriApp()) return;
  try {
    const notifications = (await import(
      "@tauri-apps/plugin-notification"
    )) as NotificationModule;
    const granted = await notifications.isPermissionGranted();
    if (!granted) {
      const permission = await notifications.requestPermission();
      if (permission !== "granted") {
        return;
      }
    }

    await notifications.sendNotification(options);
  } catch (error) {
    console.warn("[desktop] failed to send native notification", error);
  }
}

export async function syncLaunchOnLogin(enabled: boolean) {
  if (!isTauriApp()) return;
  try {
    const autostart = (await import(
      "@tauri-apps/plugin-autostart"
    )) as AutostartModule;
    const current = await autostart.isEnabled();
    if (enabled && !current) {
      await autostart.enable();
    }
    if (!enabled && current) {
      await autostart.disable();
    }
  } catch (error) {
    console.warn("[desktop] failed to sync launch-on-login", error);
  }
}

export async function checkForAppUpdates() {
  if (!isTauriApp()) {
    return {
      available: false,
      version: null as string | null,
      update: null as AppUpdateHandle,
      error: null as string | null,
    };
  }

  try {
    const updater = (await import("@tauri-apps/plugin-updater")) as UpdaterModule;
    const update = await updater.check();
    if (!update) {
      return {
        available: false,
        version: null as string | null,
        update: null as AppUpdateHandle,
        error: null as string | null,
      };
    }

    return {
      available: true,
      version: update.version,
      update,
      error: null as string | null,
    };
  } catch (error) {
    console.warn("[desktop] failed to check for updates", error);
    return {
      available: false,
      version: null as string | null,
      update: null as AppUpdateHandle,
      error: error instanceof Error ? error.message : "Unable to check for updates.",
    };
  }
}

export async function openExternalUrl(url: string) {
  if (typeof window === "undefined") {
    return;
  }

  const fallback = () => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (!isTauriApp()) {
    fallback();
    return;
  }

  try {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } catch (error) {
    console.warn("[desktop] falling back to browser open", error);
    fallback();
  }
}

export async function createDetachedWindow(options: {
  label: string;
  title: string;
  url: string;
}): Promise<DetachedWindowHandle | null> {
  if (!isTauriApp()) {
    window.open(options.url, "_blank", "noopener,noreferrer");
    return null;
  }

  const webviewModule = (await import(
    "@tauri-apps/api/webviewWindow"
  )) as TauriWebviewWindowModule;
  const core = (await import("@tauri-apps/api/core")) as TauriCoreModule;
  await core.invoke("plugin:webview|create_webview_window", {
    options: {
      label: options.label,
      title: options.title,
      url: options.url,
      width: 1480,
      height: 940,
      minWidth: 1160,
      minHeight: 760,
      center: true,
      resizable: true,
      userAgent: getDesktopWebviewUserAgent(),
    },
  });

  return webviewModule.WebviewWindow.getByLabel(options.label);
}

export async function getChildWebview(
  label: string
): Promise<ChildWebviewHandle | null> {
  if (!isTauriApp()) {
    return null;
  }

  const webviewModule = (await import("@tauri-apps/api/webview")) as TauriWebviewModule;
  return webviewModule.Webview.getByLabel(label);
}

export async function createChildWebview(options: {
  label: string;
  url: string;
  bounds: LogicalBounds;
}): Promise<ChildWebviewHandle | null> {
  if (!isTauriApp()) {
    return null;
  }

  const existing = await getChildWebview(options.label);
  if (existing) {
    return existing;
  }

  const windowModule = (await import("@tauri-apps/api/window")) as TauriWindowModule;
  const webviewModule = (await import("@tauri-apps/api/webview")) as TauriWebviewModule;
  const core = (await import("@tauri-apps/api/core")) as TauriCoreModule;
  const currentWindow = windowModule.getCurrentWindow?.();
  if (!currentWindow) {
    return null;
  }

  try {
    await core.invoke("plugin:webview|create_webview", {
      windowLabel: currentWindow.label,
      options: {
        label: options.label,
        url: options.url,
        x: Math.round(options.bounds.x),
        y: Math.round(options.bounds.y),
        width: Math.max(1, Math.round(options.bounds.width)),
        height: Math.max(1, Math.round(options.bounds.height)),
        acceptFirstMouse: true,
        focus: false,
        userAgent: getDesktopWebviewUserAgent(),
        zoomHotkeysEnabled: true,
      },
    });

    return webviewModule.Webview.getByLabel(options.label);
  } catch (error) {
    console.error("[desktop] failed to create child webview", options.label, error);
    throw error;
  }
}

export async function setChildWebviewBounds(
  webview: ChildWebviewHandle,
  bounds: LogicalBounds
) {
  if (!isTauriApp()) {
    return;
  }

  const dpiModule = (await import("@tauri-apps/api/dpi")) as TauriDpiModule;
  await webview.setPosition(
    new dpiModule.LogicalPosition(Math.round(bounds.x), Math.round(bounds.y))
  );
  await webview.setSize(
    new dpiModule.LogicalSize(
      Math.max(1, Math.round(bounds.width)),
      Math.max(1, Math.round(bounds.height))
    )
  );
}

export async function showChildWebview(webview: ChildWebviewHandle) {
  if (!isTauriApp()) {
    return;
  }

  await webview.show();
}

export async function hideChildWebview(webview: ChildWebviewHandle) {
  if (!isTauriApp()) {
    return;
  }

  await webview.hide();
}

export async function closeChildWebview(webview: ChildWebviewHandle) {
  if (!isTauriApp()) {
    return;
  }

  await webview.close();
}

export async function interceptCloseRequest(
  handler: (preventDefault: () => void) => void | Promise<void>
) {
  if (!isTauriApp()) {
    return () => undefined;
  }

  const windowModule = (await import("@tauri-apps/api/window")) as TauriWindowModule;
  const currentWindow = windowModule.getCurrentWindow?.();
  const unlisten = await currentWindow?.onCloseRequested((event) =>
    handler(() => event.preventDefault())
  );

  return async () => {
    if (typeof unlisten === "function") {
      await unlisten();
    }
  };
}
