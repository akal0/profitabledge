"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useDesktopSessionBootstrap, writeDesktopSessionBootstrap } from "@/lib/desktop-session-bootstrap";
import { useAccountStore } from "@/stores/account";

const DESKTOP_BRIDGE_SOURCE = "profitabledge-web-bridge";
const DESKTOP_SHELL_SOURCE = "profitabledge-desktop-shell";
const DESKTOP_TAURI_BRIDGE_EVENT = "desktop://web-bridge";
const DESKTOP_TAURI_NAVIGATE_EVENT = "desktop://navigate";
const DESKTOP_TAURI_SET_ACCOUNT_EVENT = "desktop://set-account";
const DESKTOP_OPEN_EXTERNAL_EVENT = "profitabledge:open-external-url";
const DESKTOP_BRIDGE_READY_FLAG = "__PE_DESKTOP_BRIDGE_READY";

type DesktopShellMessage =
  | {
      source: typeof DESKTOP_SHELL_SOURCE;
      type: "navigate";
      path: string;
      accountId?: string | null;
      targetWebviewLabel?: string;
    }
  | {
      source: typeof DESKTOP_SHELL_SOURCE;
      type: "set-account";
      accountId?: string | null;
      targetWebviewLabel?: string;
    };

function isTauriDesktop() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function postToDesktop(message: Record<string, unknown>) {
  if (typeof window === "undefined") {
    return;
  }

  if (isTauriDesktop()) {
    const webviewModule = await import("@tauri-apps/api/webview");
    const webview = webviewModule.getCurrentWebview();
    const payload = {
      source: DESKTOP_BRIDGE_SOURCE,
      webviewLabel: webview.label,
      ...message,
    };

    try {
      const eventModule = await import("@tauri-apps/api/event");
      await eventModule.emit(DESKTOP_TAURI_BRIDGE_EVENT, payload);
      return;
    } catch (error) {
      try {
        await webview.emitTo("main", DESKTOP_TAURI_BRIDGE_EVENT, payload);
        return;
      } catch (fallbackError) {
        console.warn(
          "[desktop-web] failed to post message to desktop shell",
          error,
          fallbackError
        );
        return;
      }
    }
  }

  if (window.parent === window) {
    return;
  }

  window.parent.postMessage(
    {
      source: DESKTOP_BRIDGE_SOURCE,
      ...message,
    },
    "*"
  );
}

type OpenExternalUrlRequest = {
  url?: string | null;
};

export function DesktopBridge() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const desktopBootstrap = useDesktopSessionBootstrap();
  const setSelectedAccountId = useAccountStore((state) => state.setSelectedAccountId);

  const effectiveAuthenticated =
    Boolean(session?.user?.id) || (desktopBootstrap.authenticated && !desktopBootstrap.pending);
  const effectivePending = effectiveAuthenticated ? false : isPending;
  const effectiveUser = session?.user
    ? {
        id: session.user.id,
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        image: session.user.image ?? null,
      }
    : desktopBootstrap.authenticated
      ? desktopBootstrap.user
      : null;

  const fullPath = useMemo(() => {
    const params = searchParams?.toString();
    if (!pathname) {
      return params ? `/?${params}` : "/";
    }
    return params ? `${pathname}?${params}` : pathname;
  }, [pathname, searchParams]);

  useEffect(() => {
    void postToDesktop({
      type: "route-change",
      path: fullPath,
      title: document.title,
    });
  }, [fullPath]);

  useEffect(() => {
    writeDesktopSessionBootstrap({
      authenticated: effectiveAuthenticated,
      pending: effectivePending,
      user: effectiveUser,
    });

    void postToDesktop({
      type: "session-state",
      authenticated: effectiveAuthenticated,
      pending: effectivePending,
      user: effectiveUser,
    });
  }, [effectiveAuthenticated, effectivePending, effectiveUser]);

  useEffect(() => {
    (
      window as Window & {
        [DESKTOP_BRIDGE_READY_FLAG]?: boolean;
      }
    )[DESKTOP_BRIDGE_READY_FLAG] = true;

    return () => {
      (
        window as Window & {
          [DESKTOP_BRIDGE_READY_FLAG]?: boolean;
        }
      )[DESKTOP_BRIDGE_READY_FLAG] = false;
    };
  }, []);

  useEffect(() => {
    const onOpenExternal = (event: Event) => {
      const detail = (event as CustomEvent<OpenExternalUrlRequest>).detail;
      const url = detail?.url?.trim();
      if (!url) {
        return;
      }

      void postToDesktop({
        type: "open-external-url",
        url,
      });
    };

    window.addEventListener(
      DESKTOP_OPEN_EXTERNAL_EVENT,
      onOpenExternal as EventListener
    );
    return () => {
      window.removeEventListener(
        DESKTOP_OPEN_EXTERNAL_EVENT,
        onOpenExternal as EventListener
      );
    };
  }, []);

  useEffect(() => {
    if (isTauriDesktop()) {
      let disposed = false;
      let cleanup = () => undefined;

      void (async () => {
        try {
          const eventModule = await import("@tauri-apps/api/event");
          const webviewModule = await import("@tauri-apps/api/webview");
          const currentWebviewLabel = webviewModule.getCurrentWebview().label;
          const unlistenNavigate = await eventModule.listen<DesktopShellMessage>(
            DESKTOP_TAURI_NAVIGATE_EVENT,
            (event) => {
              const message = event.payload;
              if (
                !message ||
                message.source !== DESKTOP_SHELL_SOURCE ||
                message.type !== "navigate" ||
                (message.targetWebviewLabel &&
                  message.targetWebviewLabel !== currentWebviewLabel)
              ) {
                return;
              }

              if (message.accountId) {
                setSelectedAccountId(message.accountId);
              }
              router.push(message.path);
            }
          );

          const unlistenSetAccount = await eventModule.listen<DesktopShellMessage>(
            DESKTOP_TAURI_SET_ACCOUNT_EVENT,
            (event) => {
              const message = event.payload;
              if (
                !message ||
                message.source !== DESKTOP_SHELL_SOURCE ||
                (message.targetWebviewLabel &&
                  message.targetWebviewLabel !== currentWebviewLabel)
              ) {
                return;
              }

              if (message.type === "set-account") {
                setSelectedAccountId(message.accountId ?? undefined);
              }
            }
          );

          cleanup = () => {
            void unlistenNavigate();
            void unlistenSetAccount();
          };

          if (disposed) {
            cleanup();
          }
        } catch (error) {
          console.warn("[desktop-web] failed to initialize Tauri event bridge", error);
        }
      })();

      return () => {
        disposed = true;
        cleanup();
      };
    }

    const onMessage = (event: MessageEvent<DesktopShellMessage>) => {
      const message = event.data;
      if (!message || message.source !== DESKTOP_SHELL_SOURCE) {
        return;
      }

      if (message.type === "set-account") {
        setSelectedAccountId(message.accountId ?? undefined);
        return;
      }

      if (message.type === "navigate" && typeof message.path === "string") {
        if (message.accountId) {
          setSelectedAccountId(message.accountId);
        }
        router.push(message.path);
      }
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, [router, setSelectedAccountId]);

  return null;
}
