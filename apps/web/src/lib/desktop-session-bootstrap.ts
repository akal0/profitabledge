"use client";

import { useEffect, useLayoutEffect, useState } from "react";

const DESKTOP_SESSION_BOOTSTRAP_KEY = "pe.desktop.session-bootstrap";
const DESKTOP_SESSION_BOOTSTRAP_EVENT = "pe:desktop-session-bootstrap";

type DesktopBootstrapUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
};

type DesktopSessionBootstrap = {
  authenticated: boolean;
  pending: boolean;
  user: DesktopBootstrapUser | null;
  updatedAt: number;
};

const DEFAULT_BOOTSTRAP: DesktopSessionBootstrap = {
  authenticated: false,
  pending: false,
  user: null,
  updatedAt: 0,
};

let cachedBootstrapRaw: string | null = null;
let cachedBootstrapValue: DesktopSessionBootstrap = DEFAULT_BOOTSTRAP;
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

function isTauriDesktop() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function getDefaultBootstrap(): DesktopSessionBootstrap {
  return DEFAULT_BOOTSTRAP;
}

function readBootstrap(): DesktopSessionBootstrap {
  if (!isTauriDesktop()) {
    return getDefaultBootstrap();
  }

  try {
    const raw = window.localStorage.getItem(DESKTOP_SESSION_BOOTSTRAP_KEY);
    if (!raw) {
      cachedBootstrapRaw = null;
      cachedBootstrapValue = DEFAULT_BOOTSTRAP;
      return getDefaultBootstrap();
    }

     if (raw === cachedBootstrapRaw) {
      return cachedBootstrapValue;
    }

    const parsed = JSON.parse(raw) as Partial<DesktopSessionBootstrap>;
    const normalized = {
      authenticated: Boolean(parsed.authenticated),
      pending: Boolean(parsed.pending),
      user: parsed.user ?? null,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0,
    };
    cachedBootstrapRaw = raw;
    cachedBootstrapValue = normalized;
    return normalized;
  } catch {
    return getDefaultBootstrap();
  }
}

function emitBootstrapChange() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(DESKTOP_SESSION_BOOTSTRAP_EVENT));
}

function isSameBootstrap(
  left: Omit<DesktopSessionBootstrap, "updatedAt">,
  right: Omit<DesktopSessionBootstrap, "updatedAt">
) {
  return (
    left.authenticated === right.authenticated &&
    left.pending === right.pending &&
    left.user?.id === right.user?.id &&
    left.user?.name === right.user?.name &&
    left.user?.email === right.user?.email &&
    left.user?.image === right.user?.image
  );
}

export function writeDesktopSessionBootstrap(
  next: Omit<DesktopSessionBootstrap, "updatedAt">
) {
  if (!isTauriDesktop()) {
    return;
  }

  const current = readBootstrap();
  const payload: DesktopSessionBootstrap = {
    authenticated: next.authenticated,
    pending: next.pending,
    user: next.user,
    updatedAt: Date.now(),
  };

  if (next.pending && current.authenticated && !next.authenticated) {
    return;
  }

  if (
    isSameBootstrap(next, {
      authenticated: current.authenticated,
      pending: current.pending,
      user: current.user,
    })
  ) {
    return;
  }

  try {
    const raw = JSON.stringify(payload);
    window.localStorage.setItem(DESKTOP_SESSION_BOOTSTRAP_KEY, raw);
    cachedBootstrapRaw = raw;
    cachedBootstrapValue = payload;
    emitBootstrapChange();
  } catch {
    // Ignore storage failures in embedded desktop contexts.
  }
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key === DESKTOP_SESSION_BOOTSTRAP_KEY) {
      callback();
    }
  };

  window.addEventListener(DESKTOP_SESSION_BOOTSTRAP_EVENT, callback);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(DESKTOP_SESSION_BOOTSTRAP_EVENT, callback);
    window.removeEventListener("storage", onStorage);
  };
}

export function useDesktopSessionBootstrap() {
  const [bootstrap, setBootstrap] = useState<DesktopSessionBootstrap>(DEFAULT_BOOTSTRAP);

  useIsomorphicLayoutEffect(() => {
    setBootstrap(readBootstrap());

    return subscribe(() => {
      setBootstrap(readBootstrap());
    });
  }, []);

  return bootstrap;
}

export function isDesktopSessionBootstrappedAuthenticated() {
  const bootstrap = readBootstrap();
  return bootstrap.authenticated && !bootstrap.pending;
}
