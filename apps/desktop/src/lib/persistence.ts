import type { DesktopPersistedState } from "./desktop-types";
import { createInitialPersistedDesktopState } from "./desktop-state";

const STORE_KEY = "desktop.snapshot";

export async function readPersistedState(): Promise<DesktopPersistedState | null> {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (raw) {
      return JSON.parse(raw) as DesktopPersistedState;
    }

    return createInitialPersistedDesktopState();
  } catch {
    return null;
  }
}

export async function writePersistedState(snapshot: DesktopPersistedState) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(snapshot));
  } catch {
    // Persistence should never crash the shell.
  }
}
