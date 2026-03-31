import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Ref,
} from "react";
import {
  Download,
  ExternalLink,
  FolderUp,
  LayoutTemplate,
  MonitorUp,
  Plus,
  Save,
  X,
} from "lucide-react";
import {
  buildNotificationPresentation,
} from "@profitabledge/platform/notification-presentation";
import {
  activateTab,
  closeTab,
  createTab,
  createInitialDesktopState,
  createSavedWorkspace,
  getActiveTab,
  getDefaultTitle,
  getWorkspaceAccountKey,
  hydrateDesktopState,
  hydratePersistedDesktopState,
  integrateDesktopFeed,
  openTab,
  removeSavedWorkspace,
  reopenClosedTab,
  restoreWorkspace,
  upsertSavedWorkspace,
  updateTab,
} from "./lib/desktop-state";
import { parseDesktopDeepLink } from "./lib/deep-links";
import type {
  DesktopAppSnapshot,
  DesktopBridgeEvent,
  DesktopFeedItem,
  DesktopSavedWorkspace,
  DesktopSessionBridgeUser,
  DesktopShellCommand,
  DesktopTabState,
} from "./lib/desktop-types";
import { inferTabKindFromPath } from "./lib/desktop-types";
import { env } from "./lib/env";
import { readPersistedState, writePersistedState } from "./lib/persistence";
import {
  checkForAppUpdates,
  closeChildWebview,
  closeAppWindow,
  createChildWebview,
  createDetachedWindow,
  emitToTarget,
  getChildWebview,
  hideAppWindow,
  hideChildWebview,
  interceptCloseRequest,
  isTauriApp,
  listenForDeepLinks,
  listenForRustEvent,
  openExternalUrl,
  registerGlobalPaletteShortcut,
  registerDeepLinkScheme,
  sendNativeNotification,
  setChildWebviewBounds,
  showAppWindow,
  showChildWebview,
  syncLaunchOnLogin,
  type ChildWebviewHandle,
  type DetachedWindowHandle,
  type LogicalBounds,
} from "./lib/tauri";
import { trpcProxyClient } from "./lib/trpc";

const DESKTOP_BRIDGE_EVENT = "desktop://web-bridge";
const DESKTOP_NAVIGATE_EVENT = "desktop://navigate";
const DESKTOP_SET_ACCOUNT_EVENT = "desktop://set-account";
const DESKTOP_TRAY_EVENT = "desktop://tray-command";
const DESKTOP_LOCAL_AUTH_EVENT = "desktop://local-auth";
const DESKTOP_BRIDGE_SOURCE = "profitabledge-web-bridge";
const SHELL_SOURCE = "profitabledge-desktop-shell";

type SessionState = {
  authenticated: boolean;
  pending: boolean;
  user: DesktopSessionBridgeUser | null;
};

type DesktopPreferences = {
  enabled: boolean;
  closeToTray: boolean;
  launchOnLogin: boolean;
};

type UpdateStatus = "idle" | "checking" | "available" | "unavailable" | "error";

function buildWebUrl(path: string) {
  return `${env.webUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function isDesktopAuthFlowPath(path: string) {
  return (
    path.startsWith("/desktop/auth/start") ||
    path.startsWith("/desktop/auth/begin") ||
    path.startsWith("/desktop/auth/complete") ||
    path.startsWith("/desktop/auth/error") ||
    path.startsWith("/desktop/auth/callback")
  );
}

function isPublicAuthPath(path: string) {
  return path.startsWith("/login") || path.startsWith("/sign-up");
}

function sanitizeDesktopWebPath(path: string | null | undefined, authenticated: boolean) {
  const candidate = path?.startsWith("/") ? path : null;

  if (!candidate || candidate === "/") {
    return authenticated ? "/dashboard" : "/login";
  }

  if (isPublicAuthPath(candidate)) {
    return candidate;
  }

  if (isDesktopAuthFlowPath(candidate)) {
    return candidate;
  }

  if (candidate.startsWith("/assistant")) {
    return authenticated ? candidate : "/login";
  }

  if (candidate.startsWith("/dashboard")) {
    return authenticated ? candidate : "/login";
  }

  return authenticated ? "/dashboard" : "/login";
}

function cleanTitle(title: string | undefined, fallback: string) {
  if (!title) {
    return fallback;
  }

  return title
    .replace(/^pe - /i, "")
    .replace(/ — profitabledge.*$/i, "")
    .trim();
}

function toErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  if (error && typeof error === "object") {
    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== "{}") {
        return serialized;
      }
    } catch {
      // Ignore serialization issues.
    }
  }

  return fallback;
}

function getWebviewLabel(tabId: string) {
  return `tab_${tabId}`;
}

function isDesktopPrefs(value: unknown): value is DesktopPreferences {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<DesktopPreferences>;
  return (
    typeof candidate.enabled === "boolean" &&
    typeof candidate.closeToTray === "boolean" &&
    typeof candidate.launchOnLogin === "boolean"
  );
}

function asMetadataRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function isMacLikePlatform() {
  if (typeof navigator === "undefined") {
    return false;
  }

  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
      ?.platform ||
    navigator.platform ||
    navigator.userAgent;

  return /mac/i.test(platform);
}

function BrowserFallback({
  path,
  iframeRef,
  onLoad,
}: {
  path: string;
  iframeRef?: Ref<HTMLIFrameElement>;
  onLoad?: () => void;
}) {
  return (
    <iframe
      ref={iframeRef}
      className="desktop-browser-fallback"
      src={buildWebUrl(path)}
      title="Profitabledge"
      onLoad={onLoad}
    />
  );
}

function App() {
  const [desktopState, setDesktopState] = useState<DesktopAppSnapshot>(
    createInitialDesktopState
  );
  const [savedWorkspacesByAccount, setSavedWorkspacesByAccount] = useState<
    Record<string, DesktopSavedWorkspace[]>
  >({});
  const desktopStateRef = useRef(desktopState);
  const [isStateReady, setIsStateReady] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState>({
    authenticated: false,
    pending: true,
    user: null,
  });
  const sessionStateRef = useRef(sessionState);
  const [desktopPrefs, setDesktopPrefs] = useState<DesktopPreferences>({
    enabled: true,
    closeToTray: true,
    launchOnLogin: false,
  });
  const [webviewMountError, setWebviewMountError] = useState<string | null>(null);
  const [contentBounds, setContentBounds] = useState<LogicalBounds | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const embeddedFrameRef = useRef<HTMLIFrameElement | null>(null);
  const childWebviewsRef = useRef<Record<string, ChildWebviewHandle>>({});
  const detachedWindowsRef = useRef<Record<string, DetachedWindowHandle>>({});
  const pendingUpdateRef = useRef<Awaited<ReturnType<typeof checkForAppUpdates>>["update"]>(null);
  const notifiedAlertIdsRef = useRef<Set<string>>(new Set());
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const [isUpdatePanelOpen, setIsUpdatePanelOpen] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
  const [availableUpdateVersion, setAvailableUpdateVersion] = useState<string | null>(null);
  const [updateMessage, setUpdateMessage] = useState<string>("Checking for updates...");
  const isDesktopRuntime = isTauriApp();
  const isMacDesktopRuntime = isDesktopRuntime && isMacLikePlatform();
  const useEmbeddedIframeHost = !isDesktopRuntime;
  const enableNativeStartupHooks = isDesktopRuntime && !isMacDesktopRuntime;
  const enableDeepLinkHooks = isDesktopRuntime;
  const embeddedFrameOrigin = useMemo(() => {
    try {
      return new URL(buildWebUrl("/")).origin;
    } catch {
      return "*";
    }
  }, []);

  useEffect(() => {
    desktopStateRef.current = desktopState;
  }, [desktopState]);

  useEffect(() => {
    sessionStateRef.current = sessionState;
  }, [sessionState]);

  useEffect(() => {
    if (!isStateReady || sessionState.pending || sessionState.authenticated) {
      return;
    }

    setDesktopState((previous) => {
      const alreadyOnLoginOnly =
        previous.tabs.length === 1 &&
        sanitizeDesktopWebPath(
          previous.tabs[0]?.lastKnownPath || previous.tabs[0]?.path || "/login",
          false
        ) === "/login";

      if (alreadyOnLoginOnly) {
        return previous;
      }

      const loginTab = createTab("/login", {
        id: previous.tabs[0]?.id,
        title: "Log in",
        lastKnownPath: "/login",
        accountId: null,
      });

      for (const [label, webview] of Object.entries(childWebviewsRef.current)) {
        if (label !== getWebviewLabel(loginTab.id)) {
          void closeChildWebview(webview).catch(() => undefined);
          delete childWebviewsRef.current[label];
        }
      }

      return {
        ...previous,
        tabs: [loginTab],
        activeTabId: loginTab.id,
        closedTabs: [],
      };
    });
  }, [isStateReady, sessionState.authenticated, sessionState.pending]);

  const activeTab: DesktopTabState | null = useMemo(
    () => getActiveTab(desktopState),
    [desktopState]
  );
  const isAuthenticated = sessionState.authenticated;
  const activePath = activeTab?.lastKnownPath || activeTab?.path || "/dashboard";
  const activeWebPath = sanitizeDesktopWebPath(activePath, isAuthenticated);

  function postDesktopCommandToEmbeddedFrame(command: DesktopShellCommand) {
    const target = embeddedFrameRef.current?.contentWindow;
    if (!target) {
      return false;
    }

    target.postMessage(command, embeddedFrameOrigin);
    return true;
  }

  function handleDesktopBridgeEvent(event: DesktopBridgeEvent) {
    if (event.source !== DESKTOP_BRIDGE_SOURCE) {
      return;
    }

    if (event.type === "open-external-url") {
      if (typeof event.url === "string" && event.url.length > 0) {
        void openExternalUrl(event.url).catch(() => undefined);
      }
      return;
    }

    if (event.type === "session-state") {
      const current = sessionStateRef.current;
      if (current.authenticated && !event.authenticated && event.pending) {
        return;
      }

      setSessionState({
        authenticated: event.authenticated,
        pending: event.pending,
        user: event.user,
      });
      return;
    }

    if (event.type !== "route-change") {
      return;
    }

    const normalizedPath = sanitizeDesktopWebPath(
      event.path,
      sessionStateRef.current.authenticated
    );

    const targetTab = event.webviewLabel
      ? desktopStateRef.current.tabs.find(
          (tab) => getWebviewLabel(tab.id) === event.webviewLabel
        )
      : useEmbeddedIframeHost
        ? getActiveTab(desktopStateRef.current)
        : null;

    if (!targetTab) {
      return;
    }

    if (normalizedPath !== event.path) {
      const command: DesktopShellCommand = {
        source: SHELL_SOURCE,
        type: "navigate",
        path: normalizedPath,
        accountId: targetTab.accountId,
        targetWebviewLabel: getWebviewLabel(targetTab.id),
      };

      if (useEmbeddedIframeHost) {
        postDesktopCommandToEmbeddedFrame(command);
      } else {
        void emitToTarget(getWebviewLabel(targetTab.id), DESKTOP_NAVIGATE_EVENT, command).catch(
          () => undefined
        );
      }
    }

    setDesktopState((previous) =>
      updateTab(previous, targetTab.id, {
        kind: inferTabKindFromPath(normalizedPath),
        lastKnownPath: normalizedPath,
        path: normalizedPath,
        title: cleanTitle(event.title, targetTab.title),
      })
    );
  }

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const restored = hydratePersistedDesktopState(await readPersistedState());
      if (cancelled) {
        return;
      }

      notifiedAlertIdsRef.current = new Set(restored.current.recentAlertIds);
      setDesktopState(restored.current);
      setSavedWorkspacesByAccount(restored.savedWorkspacesByAccount);
      setIsStateReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isStateReady) {
      return;
    }

    void writePersistedState({
      version: desktopState.version,
      current: desktopState,
      savedWorkspacesByAccount,
    });
  }, [desktopState, isStateReady, savedWorkspacesByAccount]);

  useEffect(() => {
    const host = contentRef.current;
    if (!host) {
      return;
    }

    const updateBounds = () => {
      const rect = host.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      setContentBounds({
        x: Math.max(rect.left, 0),
        y: Math.max(rect.top, 0),
        width: Math.max(rect.width, viewportWidth - rect.left),
        height: Math.max(rect.height, viewportHeight - rect.top),
      });
    };

    updateBounds();

    const observer = new ResizeObserver(updateBounds);
    observer.observe(host);
    window.addEventListener("resize", updateBounds);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateBounds);
    };
  }, [isAuthenticated, isStateReady]);

  useEffect(() => {
    if (!enableDeepLinkHooks) {
      return;
    }

    let unlisten: (() => void | Promise<void>) | null = null;
    void interceptCloseRequest((preventDefault) => {
      if (!desktopPrefs.closeToTray) {
        return;
      }

      preventDefault();
      void hideAppWindow();
    }).then((cleanup) => {
      unlisten = cleanup;
    });

    return () => {
      void unlisten?.();
    };
  }, [desktopPrefs.closeToTray, enableNativeStartupHooks]);

  useEffect(() => {
    if (!enableDeepLinkHooks) {
      return;
    }

    void syncLaunchOnLogin(desktopPrefs.launchOnLogin);
  }, [desktopPrefs.launchOnLogin, enableNativeStartupHooks]);

  useEffect(() => {
    if (!isDesktopRuntime || !import.meta.env.DEV) {
      return;
    }

    void registerDeepLinkScheme("profitabledge-dev");
  }, [isDesktopRuntime]);

  useEffect(() => {
    if (!enableNativeStartupHooks) {
      return;
    }

    let cleanup: (() => void | Promise<void>) | null = null;
    void listenForDeepLinks((rawUrl) => {
      const parsed = parseDesktopDeepLink(rawUrl);
      if (!parsed) {
        return;
      }

      const normalizedPath = sanitizeDesktopWebPath(
        parsed.path,
        sessionStateRef.current.authenticated
      );

      void showAppWindow();
      if (!sessionStateRef.current.authenticated) {
        const pendingTab = getActiveTab(desktopStateRef.current);
        const command: DesktopShellCommand = {
          source: SHELL_SOURCE,
          type: "navigate",
          path: normalizedPath,
          accountId: parsed.accountId,
          targetWebviewLabel: pendingTab ? getWebviewLabel(pendingTab.id) : undefined,
        };

        if (useEmbeddedIframeHost) {
          postDesktopCommandToEmbeddedFrame(command);
        } else {
          if (!pendingTab) {
            return;
          }

          void emitToTarget(getWebviewLabel(pendingTab.id), DESKTOP_NAVIGATE_EVENT, command).catch(
            () => undefined
          );
        }

        setDesktopState((previous) =>
          updateTab(previous, previous.activeTabId, {
            kind: inferTabKindFromPath(normalizedPath),
            path: normalizedPath,
            lastKnownPath: normalizedPath,
            accountId: parsed.accountId ?? getActiveTab(previous)?.accountId ?? null,
          })
        );
        return;
      }

      navigateActiveTab(normalizedPath, { accountId: parsed.accountId });
    }).then((unlisten) => {
      cleanup = unlisten;
    });

    return () => {
      void cleanup?.();
    };
  }, [enableDeepLinkHooks, useEmbeddedIframeHost]);

  useEffect(() => {
    if (!isDesktopRuntime || useEmbeddedIframeHost) {
      return;
    }

    let cleanup: (() => void | Promise<void>) | null = null;
    void listenForRustEvent<DesktopBridgeEvent>(
      DESKTOP_BRIDGE_EVENT,
      handleDesktopBridgeEvent
    ).then((unlisten) => {
      cleanup = unlisten;
    });

    return () => {
      void cleanup?.();
    };
  }, [isDesktopRuntime, useEmbeddedIframeHost]);

  useEffect(() => {
    if (!isDesktopRuntime || !import.meta.env.DEV) {
      return;
    }

    let cleanup: (() => void | Promise<void>) | null = null;
    void listenForRustEvent<string>(DESKTOP_LOCAL_AUTH_EVENT, (rawUrl) => {
      const parsed = parseDesktopDeepLink(rawUrl);
      if (!parsed) {
        return;
      }

      const normalizedPath = sanitizeDesktopWebPath(
        parsed.path,
        sessionStateRef.current.authenticated
      );

      void showAppWindow();
      if (!sessionStateRef.current.authenticated) {
        const pendingTab = getActiveTab(desktopStateRef.current);
        const command: DesktopShellCommand = {
          source: SHELL_SOURCE,
          type: "navigate",
          path: normalizedPath,
          accountId: parsed.accountId,
          targetWebviewLabel: pendingTab ? getWebviewLabel(pendingTab.id) : undefined,
        };

        if (useEmbeddedIframeHost) {
          postDesktopCommandToEmbeddedFrame(command);
        } else if (pendingTab) {
          void emitToTarget(getWebviewLabel(pendingTab.id), DESKTOP_NAVIGATE_EVENT, command).catch(
            () => undefined
          );
        }

        setDesktopState((previous) =>
          updateTab(previous, previous.activeTabId, {
            kind: inferTabKindFromPath(normalizedPath),
            path: normalizedPath,
            lastKnownPath: normalizedPath,
            accountId: parsed.accountId ?? getActiveTab(previous)?.accountId ?? null,
          })
        );
        return;
      }

      navigateActiveTab(normalizedPath, { accountId: parsed.accountId });
    }).then((unlisten) => {
      cleanup = unlisten;
    });

    return () => {
      void cleanup?.();
    };
  }, [isDesktopRuntime, useEmbeddedIframeHost]);

  useEffect(() => {
    if (!isDesktopRuntime) {
      return;
    }

    void handleCheckForUpdates({ silent: true });

    const onCheckForUpdates = () => {
      void handleCheckForUpdates();
    };

    window.addEventListener("desktop:check-for-updates", onCheckForUpdates);
    return () => {
      window.removeEventListener("desktop:check-for-updates", onCheckForUpdates);
    };
  }, [isDesktopRuntime]);

  useEffect(() => {
    if (!isDesktopRuntime) {
      return;
    }

    let cleanup: (() => void | Promise<void>) | null = null;
    void listenForRustEvent<string>(DESKTOP_TRAY_EVENT, (command) => {
      if (command === "show") {
        void showAppWindow();
        return;
      }
      if (command === "new-tab") {
        openNewTab("/dashboard", {
          title: "Dashboard",
          accountId: activeTab?.accountId ?? null,
          activateExisting: false,
        });
        return;
      }
      if (command === "notifications") {
        void showAppWindow();
        return;
      }
      if (command === "assistant") {
        openNewTab("/assistant", { title: "Assistant", activateExisting: true });
        void showAppWindow();
        return;
      }
      if (command === "import") {
        openNewTab("/dashboard/accounts?desktopAction=import-account", {
          title: "Accounts",
          accountId: activeTab?.accountId ?? null,
          activateExisting: true,
        });
        void showAppWindow();
      }
    }).then((unlisten) => {
      cleanup = unlisten;
    });

    return () => {
      void cleanup?.();
    };
  }, [activeTab?.accountId, isDesktopRuntime]);

  useEffect(() => {
    if (!useEmbeddedIframeHost) {
      return;
    }

    const onMessage = (event: MessageEvent<DesktopBridgeEvent>) => {
      const targetWindow = embeddedFrameRef.current?.contentWindow;
      if (!targetWindow || event.source !== targetWindow) {
        return;
      }

      handleDesktopBridgeEvent(event.data);
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, [useEmbeddedIframeHost]);

  useEffect(() => {
    if (useEmbeddedIframeHost || sessionState.authenticated) {
      return;
    }

    const existingWebviews = Object.values(childWebviewsRef.current);
    if (existingWebviews.length === 0) {
      return;
    }

    for (const webview of existingWebviews) {
      void closeChildWebview(webview).catch(() => undefined);
    }
    childWebviewsRef.current = {};
  }, [sessionState.authenticated, useEmbeddedIframeHost]);

  useEffect(() => {
    if (!sessionState.authenticated) {
      return;
    }

    let cancelled = false;
    void trpcProxyClient.notifications.getPreferences
      .query()
      .then((preferences) => {
        if (cancelled || !isDesktopPrefs(preferences.desktop)) {
          return;
        }

        setDesktopPrefs(preferences.desktop);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [sessionState.authenticated]);

  useEffect(() => {
    if (!sessionState.authenticated) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const current = desktopStateRef.current;
        const result = await trpcProxyClient.notifications.desktopFeed.query({
          after: current.lastAlertAt || undefined,
          limit: 12,
        });

        if (cancelled) {
          return;
        }

        const nextItems: DesktopFeedItem[] = result.items.map((item) => ({
          ...item,
          body: item.body ?? null,
          metadata: asMetadataRecord(item.metadata),
        }));

        setDesktopState((previous) =>
          integrateDesktopFeed(previous, nextItems, result.unreadCount)
        );

        for (const item of nextItems) {
          if (notifiedAlertIdsRef.current.has(item.id)) {
            continue;
          }

          notifiedAlertIdsRef.current.add(item.id);
          const presentation = buildNotificationPresentation({
            type: item.type,
            title: item.title,
            body: item.body,
            metadata: item.metadata,
          });
          await sendNativeNotification({
            title: presentation.pushTitle,
            body: presentation.pushBody,
          });
        }
      } catch {
        // Ignore background polling failures. Auth can still be in flight.
      } finally {
        if (!cancelled) {
          timer = setTimeout(poll, env.notificationPollMs);
        }
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [sessionState.authenticated]);

  async function ensureChildWebview(tab: DesktopTabState) {
    if (!contentBounds || contentBounds.width < 1 || contentBounds.height < 1) {
      return null;
    }

    const label = getWebviewLabel(tab.id);
    const targetPath = sanitizeDesktopWebPath(
      tab.lastKnownPath || tab.path,
      sessionStateRef.current.authenticated
    );
    let webview: ChildWebviewHandle | null = childWebviewsRef.current[label] || null;
    try {
      if (!webview) {
        webview =
          (await getChildWebview(label)) ||
          (await createChildWebview({
            label,
            url: buildWebUrl(targetPath),
            bounds: contentBounds,
          }));

        if (webview) {
          childWebviewsRef.current[label] = webview;
        }
      }
    } catch (error) {
      setWebviewMountError(
        toErrorMessage(error, "Unable to open the embedded Profitabledge view.")
      );
      return null;
    }

    if (!webview) {
      setWebviewMountError("Unable to open the embedded Profitabledge view.");
      return null;
    }

    await setChildWebviewBounds(webview, contentBounds);
    setWebviewMountError(null);
    return webview;
  }

  useEffect(() => {
    if (useEmbeddedIframeHost || !contentBounds || !isStateReady) {
      return;
    }

    let cancelled = false;

    const syncWebviews = async () => {
      const tabs = desktopStateRef.current.tabs;
      const active = getActiveTab(desktopStateRef.current);

      if (!active) {
        return;
      }

      const visibleLabels = new Set(tabs.map((tab) => getWebviewLabel(tab.id)));

      for (const [label, webview] of Object.entries(childWebviewsRef.current)) {
        if (visibleLabels.has(label)) {
          continue;
        }

        await closeChildWebview(webview).catch(() => undefined);
        delete childWebviewsRef.current[label];
      }

      for (const tab of tabs) {
        await ensureChildWebview(tab);
      }

      const activeWebview = childWebviewsRef.current[getWebviewLabel(active.id)] || null;
      if (!activeWebview || cancelled) {
        return;
      }

      for (const [label, webview] of Object.entries(childWebviewsRef.current)) {
        await setChildWebviewBounds(webview, contentBounds).catch(() => undefined);

        if (label === getWebviewLabel(active.id)) {
          await showChildWebview(webview).catch(() => undefined);

          if (active.accountId) {
            const command: DesktopShellCommand = {
              source: SHELL_SOURCE,
              type: "set-account",
              accountId: active.accountId,
              targetWebviewLabel: label,
            };
            await emitToTarget(label, DESKTOP_SET_ACCOUNT_EVENT, command).catch(
              () => undefined
            );
          }
        } else {
          await hideChildWebview(webview).catch(() => undefined);
        }
      }
    };

    void syncWebviews();

    return () => {
      cancelled = true;
    };
  }, [desktopState.tabs, desktopState.activeTabId, contentBounds, isStateReady, useEmbeddedIframeHost]);

  useEffect(() => {
    return () => {
      if (useEmbeddedIframeHost) {
        return;
      }

      for (const webview of Object.values(childWebviewsRef.current)) {
        void closeChildWebview(webview).catch(() => undefined);
      }
      for (const windowHandle of Object.values(detachedWindowsRef.current)) {
        void windowHandle?.close().catch(() => undefined);
      }
    };
  }, [useEmbeddedIframeHost]);

  useEffect(() => {
    if (!useEmbeddedIframeHost || !isAuthenticated || !activeTab) {
      return;
    }

    postDesktopCommandToEmbeddedFrame({
      source: SHELL_SOURCE,
      type: "set-account",
      accountId: activeTab.accountId,
      targetWebviewLabel: getWebviewLabel(activeTab.id),
    });
  }, [activeTab?.accountId, activeTab?.id, isAuthenticated, useEmbeddedIframeHost]);

  useEffect(() => {
    if (!isAuthenticated || !activeTab) {
      return;
    }

    const tabPath = activeTab.lastKnownPath || activeTab.path;
    if (!isPublicAuthPath(tabPath)) {
      return;
    }

    const command: DesktopShellCommand = {
      source: SHELL_SOURCE,
      type: "navigate",
      path: "/dashboard",
      accountId: activeTab.accountId,
      targetWebviewLabel: getWebviewLabel(activeTab.id),
    };

    if (useEmbeddedIframeHost) {
      postDesktopCommandToEmbeddedFrame(command);
    } else {
      void emitToTarget(getWebviewLabel(activeTab.id), DESKTOP_NAVIGATE_EVENT, command).catch(
        () => undefined
      );
    }

    setDesktopState((previous) =>
      updateTab(previous, activeTab.id, {
        kind: "dashboard",
        title: "Dashboard",
        path: "/dashboard",
        lastKnownPath: "/dashboard",
        accountId: activeTab.accountId,
      })
    );
  }, [activeTab, isAuthenticated, useEmbeddedIframeHost]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isPrimaryModifier = isMacLikePlatform() ? event.metaKey : event.ctrlKey;
      if (!isPrimaryModifier || event.altKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isEditable =
        target?.isContentEditable ||
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select";

      if (isEditable) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "t" && !event.shiftKey) {
        event.preventDefault();
        openNewTab("/dashboard", {
          title: "Dashboard",
          accountId: activeTab?.accountId ?? null,
          activateExisting: false,
        });
        return;
      }

      if (key === "t" && event.shiftKey) {
        event.preventDefault();
        handleReopenClosedTab();
        return;
      }

      if (key === "w") {
        if (!isAuthenticated || !activeTab || desktopStateRef.current.tabs.length <= 1) {
          return;
        }

        event.preventDefault();
        handleCloseTab(activeTab.id);
        return;
      }

      if (key === "q") {
        event.preventDefault();
        void closeAppWindow();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeTab, isAuthenticated]);

  function navigateActiveTab(
    path: string,
    options: {
      title?: string;
      accountId?: string | null;
    } = {}
  ) {
    const normalizedPath = sanitizeDesktopWebPath(path, sessionStateRef.current.authenticated);
    setDesktopState((previous) =>
      updateTab(previous, previous.activeTabId, {
        kind: inferTabKindFromPath(normalizedPath),
        title: options.title || getActiveTab(previous)?.title || "Profitabledge",
        path: normalizedPath,
        lastKnownPath: normalizedPath,
        accountId: options.accountId ?? null,
      })
    );
  }

  function openNewTab(
    path: string,
    options: { title?: string; accountId?: string | null; activateExisting?: boolean } = {}
  ) {
    const normalizedPath = sanitizeDesktopWebPath(path, sessionStateRef.current.authenticated);
    const kind = inferTabKindFromPath(normalizedPath);
    setDesktopState((previous) => {
      const matchingTab =
        options.activateExisting === false
          ? null
          : previous.tabs.find(
              (tab) =>
                (tab.lastKnownPath || tab.path) === normalizedPath &&
                tab.accountId === (options.accountId ?? null)
            );

      if (matchingTab) {
        return activateTab(previous, matchingTab.id);
      }

      const tab = createTab(normalizedPath, {
        kind,
        title: options.title || getDefaultTitle(kind),
        lastKnownPath: normalizedPath,
        accountId: options.accountId ?? null,
      });

      return openTab(previous, tab);
    });
  }

  function handleReopenClosedTab() {
    setDesktopState((previous) => reopenClosedTab(previous));
  }

  async function handleDetachTab(tab: DesktopTabState) {
    const label = `detached_${tab.id}`;
    const existing = detachedWindowsRef.current[label];
    if (existing) {
      await existing.show().catch(() => undefined);
      await existing.setFocus().catch(() => undefined);
      return;
    }

    const handle = await createDetachedWindow({
      label,
      title: tab.title,
      url: buildWebUrl(tab.lastKnownPath || tab.path),
    });
    if (!handle) {
      return;
    }

    detachedWindowsRef.current[label] = handle;
    void handle.once("tauri://destroyed", () => {
      delete detachedWindowsRef.current[label];
    });
  }

  function handleSaveWorkspace() {
    const accountId = activeTab?.accountId ?? null;
    const suggestedName = accountId ? `Workspace ${accountId.slice(-4)}` : "Workspace";
    const name = typeof window !== "undefined" ? window.prompt("Workspace name", suggestedName) : suggestedName;
    if (!name?.trim()) {
      return;
    }

    const workspace = createSavedWorkspace(desktopStateRef.current, name.trim(), accountId);
    setSavedWorkspacesByAccount((previous) => upsertSavedWorkspace(previous, workspace));
    setIsWorkspaceMenuOpen(false);
  }

  function handleOpenWorkspace(workspace: DesktopSavedWorkspace) {
    const currentLabels = new Set(desktopStateRef.current.tabs.map((tab) => getWebviewLabel(tab.id)));
    for (const [label, webview] of Object.entries(childWebviewsRef.current)) {
      if (currentLabels.has(label)) {
        void closeChildWebview(webview).catch(() => undefined);
        delete childWebviewsRef.current[label];
      }
    }
    setDesktopState((previous) => restoreWorkspace(previous, workspace));
    setIsWorkspaceMenuOpen(false);
  }

  function handleDeleteWorkspace(workspace: DesktopSavedWorkspace) {
    setSavedWorkspacesByAccount((previous) =>
      removeSavedWorkspace(previous, workspace.accountId, workspace.id)
    );
  }

  async function handleCheckForUpdates(options: { silent?: boolean } = {}) {
    if (updateStatus === "checking") {
      return;
    }

    setUpdateStatus("checking");
    setUpdateMessage("Checking for updates...");

    const result = await checkForAppUpdates();
    pendingUpdateRef.current = result.update;

    if (result.available) {
      setUpdateStatus("available");
      setAvailableUpdateVersion(result.version);
      setUpdateMessage(
        result.version
          ? `Version ${result.version} is ready to install.`
          : "An update is ready to install."
      );
      return;
    }

    setAvailableUpdateVersion(null);
    if (result.error) {
      setUpdateStatus("error");
      setUpdateMessage(result.error);
      return;
    }

    setUpdateStatus("unavailable");
    setUpdateMessage(options.silent ? "You're up to date." : "You're up to date.");
  }

  async function handleInstallUpdate() {
    const update = pendingUpdateRef.current;
    if (!update) {
      return;
    }

    setUpdateStatus("checking");
    setUpdateMessage("Installing update...");

    try {
      await update.downloadAndInstall();
      pendingUpdateRef.current = null;
      setAvailableUpdateVersion(null);
      setUpdateStatus("unavailable");
      setUpdateMessage("Update installed. Restart Profitabledge to finish.");
    } catch (error) {
      setUpdateStatus("error");
      setUpdateMessage(toErrorMessage(error, "Unable to install update."));
    }
  }

  function handleCloseTab(tabId: string) {
    if (tabId === activeTab?.id && useEmbeddedIframeHost) {
      embeddedFrameRef.current = null;
    }

    const webview = childWebviewsRef.current[getWebviewLabel(tabId)];
    if (webview) {
      void closeChildWebview(webview).catch(() => undefined);
      delete childWebviewsRef.current[getWebviewLabel(tabId)];
    }
    const detached = detachedWindowsRef.current[`detached_${tabId}`];
    if (detached) {
      void detached.close().catch(() => undefined);
      delete detachedWindowsRef.current[`detached_${tabId}`];
    }

    setDesktopState((previous) => closeTab(previous, tabId));
  }

  if (!isStateReady) {
    return (
      <div className="desktop-root">
        <div className="desktop-window-frame desktop-window-frame--loading">
          <div className="desktop-loading-state">
            <div className="desktop-loading-badge">pe</div>
            <div>
              <h1>Profitabledge</h1>
              <p>Restoring your workspace.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleEmbeddedFrameLoad = () => {
    if (!useEmbeddedIframeHost || !isAuthenticated || !activeTab) {
      return;
    }

    postDesktopCommandToEmbeddedFrame({
      source: SHELL_SOURCE,
      type: "set-account",
      accountId: activeTab.accountId,
      targetWebviewLabel: getWebviewLabel(activeTab.id),
    });
  };

  return (
    <div className="desktop-root">
      <div className="desktop-window-frame">
        {isAuthenticated ? (
          <div className="desktop-browser-stage">
            <div className="desktop-toolbar">
              <div className="desktop-toolbar-leading">
                <div
                  className={`desktop-mac-controls-spacer${
                    isMacDesktopRuntime ? " is-visible" : ""
                  }`}
                  aria-hidden="true"
                />

                <div className="desktop-tabs-strip">
                  {desktopState.tabs.map((tab) => (
                    <button
                      key={tab.id}
                      className={`desktop-toolbar-tab${desktopState.tabs.length === 1 ? " is-single" : ""}${tab.id === activeTab?.id ? " is-active" : ""}`}
                      onClick={() => setDesktopState((previous) => activateTab(previous, tab.id))}
                    >
                      <span>{tab.title}</span>
                      {desktopState.tabs.length > 1 ? (
                        <span
                          className="desktop-toolbar-tab-close"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleCloseTab(tab.id);
                          }}
                        >
                          <X size={12} />
                        </span>
                      ) : null}
                    </button>
                  ))}

                  <div className="desktop-add-tab">
                    <button
                      className="desktop-add-tab-trigger"
                      title="Open a new tab"
                      onClick={() =>
                        openNewTab("/dashboard", {
                          title: "Dashboard",
                          accountId: activeTab?.accountId ?? null,
                          activateExisting: false,
                        })
                      }
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                <div className="desktop-toolbar-drag-region" data-tauri-drag-region />

                <div className="desktop-toolbar-actions">
                  <button
                    className="desktop-toolbar-action"
                    title="Import account"
                    onClick={() => openNewTab("/dashboard/accounts?desktopAction=import-account", {
                      title: "Accounts",
                      accountId: activeTab?.accountId ?? null,
                      activateExisting: true,
                    })}
                  >
                    <FolderUp size={14} />
                  </button>
                  <button
                    className="desktop-toolbar-action"
                    title="Workspaces"
                    onClick={() => {
                      setIsWorkspaceMenuOpen((open) => !open);
                      setIsUpdatePanelOpen(false);
                    }}
                  >
                    <LayoutTemplate size={14} />
                  </button>
                  <button
                    className="desktop-toolbar-action"
                    title="Check for updates"
                    onClick={() => {
                      setIsUpdatePanelOpen(true);
                      setIsWorkspaceMenuOpen(false);
                      void handleCheckForUpdates();
                    }}
                  >
                    <Download size={14} />
                    {updateStatus === "available" ? (
                      <span className="desktop-toolbar-dot desktop-toolbar-dot--danger" />
                    ) : null}
                  </button>
                  {activeTab ? (
                    <button
                      className="desktop-toolbar-action"
                      title="Detach tab"
                      onClick={() => void handleDetachTab(activeTab)}
                    >
                      <MonitorUp size={14} />
                    </button>
                  ) : null}
                </div>
              </div>

              {isWorkspaceMenuOpen ? (
                <div className="desktop-toolbar-panel-slot">
                  <div className="desktop-overlay-panel desktop-workspace-panel">
                <div className="desktop-overlay-header">
                  <strong>Saved workspaces</strong>
                  <button className="desktop-inline-action" onClick={handleSaveWorkspace}>
                    <Save size={13} />
                    <span>Save current</span>
                  </button>
                </div>
                <div className="desktop-overlay-list">
                  {(() => {
                    const accountKey = getWorkspaceAccountKey(activeTab?.accountId ?? null);
                    const workspaces = savedWorkspacesByAccount[accountKey] ?? [];
                    if (workspaces.length === 0) {
                      return <p className="desktop-overlay-empty">No saved workspaces for this account.</p>;
                    }

                    return workspaces.map((workspace) => (
                      <div key={workspace.id} className="desktop-workspace-item">
                        <button onClick={() => handleOpenWorkspace(workspace)}>
                          <strong>{workspace.name}</strong>
                          <span>{workspace.tabs.length} tabs</span>
                        </button>
                        <button
                          className="desktop-inline-icon"
                          title="Delete workspace"
                          onClick={() => handleDeleteWorkspace(workspace)}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ));
                  })()}
                </div>
                  </div>
                </div>
              ) : null}

              {isUpdatePanelOpen ? (
                <div className="desktop-toolbar-panel-slot">
                  <div className="desktop-overlay-panel desktop-update-panel">
                <div className="desktop-overlay-header">
                  <div className="desktop-notification-header-copy">
                    <strong>App updates</strong>
                    <span>Keep your desktop app current</span>
                  </div>
                  <button
                    className="desktop-inline-icon"
                    title="Close updates panel"
                    onClick={() => setIsUpdatePanelOpen(false)}
                  >
                    <X size={12} />
                  </button>
                </div>
                <div className="desktop-update-body">
                  <div className={`desktop-update-status is-${updateStatus}`}>
                    <div>
                      <strong>
                        {updateStatus === "available"
                          ? "Update available"
                          : updateStatus === "checking"
                            ? "Checking now"
                            : updateStatus === "error"
                              ? "Update check failed"
                              : "No updates available"}
                      </strong>
                      <span>{updateMessage}</span>
                    </div>
                    {availableUpdateVersion ? <em>{availableUpdateVersion}</em> : null}
                  </div>
                  <div className="desktop-update-actions">
                    <button
                      className="desktop-inline-action"
                      onClick={() => void handleCheckForUpdates()}
                    >
                      <Download size={13} />
                      <span>Check again</span>
                    </button>
                    {updateStatus === "available" ? (
                      <button className="desktop-inline-action" onClick={() => void handleInstallUpdate()}>
                        <Download size={13} />
                        <span>Install</span>
                      </button>
                    ) : null}
                  </div>
                </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="desktop-content-host" ref={contentRef}>
              {webviewMountError ? (
                <div className="desktop-webview-placeholder">
                  <strong>Profitabledge couldn&apos;t open this view.</strong>
                  <span>{webviewMountError}</span>
                </div>
              ) : null}
              {useEmbeddedIframeHost ? (
                <BrowserFallback
                  path={activeWebPath}
                  iframeRef={embeddedFrameRef}
                  onLoad={handleEmbeddedFrameLoad}
                />
              ) : null}
            </div>
          </div>
        ) : (
          <div className="desktop-auth-stage">
            <div className="desktop-auth-host" ref={contentRef}>
              {webviewMountError ? (
                <div className="desktop-webview-placeholder">
                  <strong>Profitabledge couldn&apos;t open the sign-in view.</strong>
                  <span>{webviewMountError}</span>
                </div>
              ) : null}
              {useEmbeddedIframeHost ? (
                <BrowserFallback
                  path={activeWebPath}
                  iframeRef={embeddedFrameRef}
                  onLoad={handleEmbeddedFrameLoad}
                />
              ) : null}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

export default App;
