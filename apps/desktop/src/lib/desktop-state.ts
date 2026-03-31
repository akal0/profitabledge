import type {
  DesktopAppSnapshot,
  DesktopFeedItem,
  DesktopPersistedState,
  DesktopSavedWorkspace,
  DesktopTabKind,
  DesktopTabState,
} from "./desktop-types";
import { inferTabKindFromPath } from "./desktop-types";

export const DESKTOP_STATE_VERSION = 4;

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function nowIso() {
  return new Date().toISOString();
}

export function getWorkspaceAccountKey(accountId: string | null) {
  return accountId ?? "__global__";
}

export function createTab(
  path: string,
  overrides: Partial<DesktopTabState> = {}
): DesktopTabState {
  const normalizedPath = overrides.lastKnownPath ?? path;
  const kind = overrides.kind ?? inferTabKindFromPath(normalizedPath);

  return {
    id: overrides.id ?? createId("tab"),
    kind,
    title: overrides.title ?? getDefaultTitle(kind),
    path,
    lastKnownPath: normalizedPath,
    accountId: overrides.accountId ?? null,
  };
}

export function createInitialDesktopState(): DesktopAppSnapshot {
  const dashboardTab = createTab("/dashboard", {
    kind: "dashboard",
    title: "Dashboard",
  });

  return {
    version: DESKTOP_STATE_VERSION,
    tabs: [dashboardTab],
    activeTabId: dashboardTab.id,
    closedTabs: [],
    recentAlertIds: [],
    recentAlerts: [],
    unreadCount: 0,
    lastAlertAt: null,
  };
}

export function createInitialPersistedDesktopState(): DesktopPersistedState {
  return {
    version: DESKTOP_STATE_VERSION,
    current: createInitialDesktopState(),
    savedWorkspacesByAccount: {},
  };
}

export function getActiveTab(snapshot: DesktopAppSnapshot) {
  return snapshot.tabs.find((tab) => tab.id === snapshot.activeTabId) ?? snapshot.tabs[0] ?? null;
}

function normalizeTab(raw: unknown): DesktopTabState | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidate = raw as Partial<DesktopTabState>;
  const path =
    typeof candidate.path === "string"
      ? candidate.path
      : typeof candidate.lastKnownPath === "string"
        ? candidate.lastKnownPath
        : null;

  if (!path) {
    return null;
  }

  return createTab(path, {
    id: candidate.id,
    kind: candidate.kind as DesktopTabKind | undefined,
    title: candidate.title,
    lastKnownPath:
      typeof candidate.lastKnownPath === "string" ? candidate.lastKnownPath : path,
    accountId: candidate.accountId,
  });
}

function normalizeWorkspace(raw: unknown): DesktopSavedWorkspace | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidate = raw as Partial<DesktopSavedWorkspace>;
  const tabs = Array.isArray(candidate.tabs)
    ? candidate.tabs.map((tab) => normalizeTab(tab)).filter(Boolean) as DesktopTabState[]
    : [];

  if (tabs.length === 0) {
    return null;
  }

  const activeTabId = tabs.find((tab) => tab.id === candidate.activeTabId)?.id ?? tabs[0]!.id;

  return {
    id: candidate.id ?? createId("workspace"),
    name: candidate.name?.trim() || "Workspace",
    accountId: candidate.accountId ?? null,
    tabs,
    activeTabId,
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : nowIso(),
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : nowIso(),
  };
}

function normalizeSnapshot(raw: unknown): DesktopAppSnapshot {
  const fallback = createInitialDesktopState();
  if (!raw || typeof raw !== "object") {
    return fallback;
  }

  const candidate = raw as Partial<DesktopAppSnapshot> & {
    currentView?: unknown;
    workspaces?: Array<{
      id?: string;
      activeTabId?: string;
      tabs?: Array<unknown>;
    }>;
    activeWorkspaceId?: string;
  };

  const tabs = Array.isArray(candidate.tabs)
    ? candidate.tabs.map((tab) => normalizeTab(tab)).filter(Boolean) as DesktopTabState[]
    : [];

  const currentViewTab = normalizeTab(candidate.currentView);

  const legacyWorkspaceTab = (() => {
    if (!Array.isArray(candidate.workspaces) || candidate.workspaces.length === 0) {
      return null;
    }

    const activeWorkspace =
      candidate.workspaces.find(
        (workspace) => workspace.id === candidate.activeWorkspaceId
      ) ?? candidate.workspaces[0];
    if (!activeWorkspace || !Array.isArray(activeWorkspace.tabs)) {
      return null;
    }

    const activeTab =
      activeWorkspace.tabs.find((tab) => {
        if (!tab || typeof tab !== "object") {
          return false;
        }

        return (tab as { id?: string }).id === activeWorkspace.activeTabId;
      }) ?? activeWorkspace.tabs[0];

    return normalizeTab(activeTab);
  })();

  const resolvedTabs =
    tabs.length > 0
      ? tabs
      : currentViewTab
        ? [currentViewTab]
        : legacyWorkspaceTab
          ? [legacyWorkspaceTab]
          : fallback.tabs;

  const activeTabId =
    resolvedTabs.find((tab) => tab.id === candidate.activeTabId)?.id ?? resolvedTabs[0]!.id;

  const closedTabs = Array.isArray(candidate.closedTabs)
    ? candidate.closedTabs.map((tab) => normalizeTab(tab)).filter(Boolean) as DesktopTabState[]
    : [];

  const recentAlerts = Array.isArray(candidate.recentAlerts)
    ? (candidate.recentAlerts.filter(Boolean) as DesktopFeedItem[])
    : [];

  const recentAlertIds = Array.isArray(candidate.recentAlertIds)
    ? candidate.recentAlertIds.filter(
        (value): value is string => typeof value === "string" && value.length > 0
      )
    : [];

  return {
    version: DESKTOP_STATE_VERSION,
    tabs: resolvedTabs,
    activeTabId,
    closedTabs,
    recentAlertIds,
    recentAlerts,
    unreadCount:
      typeof candidate.unreadCount === "number" && candidate.unreadCount >= 0
        ? candidate.unreadCount
        : 0,
    lastAlertAt:
      typeof candidate.lastAlertAt === "string" ? candidate.lastAlertAt : null,
  };
}

export function hydrateDesktopState(raw: unknown): DesktopAppSnapshot {
  return hydratePersistedDesktopState(raw).current;
}

export function hydratePersistedDesktopState(raw: unknown): DesktopPersistedState {
  const fallback = createInitialPersistedDesktopState();
  if (!raw || typeof raw !== "object") {
    return fallback;
  }

  const candidate = raw as Partial<DesktopPersistedState> & Record<string, unknown>;
  const current = normalizeSnapshot(candidate.current ?? raw);
  const rawSaved = candidate.savedWorkspacesByAccount;
  const savedWorkspacesByAccount: Record<string, DesktopSavedWorkspace[]> = {};

  if (rawSaved && typeof rawSaved === "object") {
    for (const [key, value] of Object.entries(rawSaved)) {
      if (!Array.isArray(value)) {
        continue;
      }

      const workspaces = value
        .map((workspace) => normalizeWorkspace(workspace))
        .filter(Boolean) as DesktopSavedWorkspace[];

      if (workspaces.length > 0) {
        savedWorkspacesByAccount[key] = workspaces;
      }
    }
  }

  return {
    version: DESKTOP_STATE_VERSION,
    current,
    savedWorkspacesByAccount,
  };
}

export function activateTab(snapshot: DesktopAppSnapshot, tabId: string): DesktopAppSnapshot {
  if (!snapshot.tabs.some((tab) => tab.id === tabId)) {
    return snapshot;
  }

  return {
    ...snapshot,
    activeTabId: tabId,
  };
}

export function openTab(snapshot: DesktopAppSnapshot, tab: DesktopTabState): DesktopAppSnapshot {
  return {
    ...snapshot,
    tabs: [...snapshot.tabs, tab],
    activeTabId: tab.id,
  };
}

export function updateTab(
  snapshot: DesktopAppSnapshot,
  tabId: string,
  patch: Partial<DesktopTabState>
): DesktopAppSnapshot {
  return {
    ...snapshot,
    tabs: snapshot.tabs.map((tab) => {
      if (tab.id !== tabId) {
        return tab;
      }

      const nextPath = patch.lastKnownPath ?? patch.path ?? tab.lastKnownPath ?? tab.path;
      return {
        ...tab,
        ...patch,
        kind: patch.kind ?? inferTabKindFromPath(nextPath),
        path: patch.path ?? tab.path,
        lastKnownPath: nextPath,
      };
    }),
  };
}

export function closeTab(snapshot: DesktopAppSnapshot, tabId: string): DesktopAppSnapshot {
  if (snapshot.tabs.length === 1) {
    return snapshot;
  }

  const closingIndex = snapshot.tabs.findIndex((tab) => tab.id === tabId);
  if (closingIndex === -1) {
    return snapshot;
  }

  const closingTab = snapshot.tabs[closingIndex]!;
  const tabs = snapshot.tabs.filter((tab) => tab.id !== tabId);
  const nextActiveTabId =
    snapshot.activeTabId === tabId
      ? tabs[Math.max(0, closingIndex - 1)]?.id ?? tabs[0]!.id
      : snapshot.activeTabId;

  return {
    ...snapshot,
    tabs,
    activeTabId: nextActiveTabId,
    closedTabs: [closingTab, ...snapshot.closedTabs.filter((tab) => tab.id !== tabId)].slice(0, 20),
  };
}

export function reopenClosedTab(snapshot: DesktopAppSnapshot): DesktopAppSnapshot {
  const [tab, ...remaining] = snapshot.closedTabs;
  if (!tab) {
    return snapshot;
  }

  const reopened = { ...tab, id: createId("tab") };

  return {
    ...snapshot,
    tabs: [...snapshot.tabs, reopened],
    activeTabId: reopened.id,
    closedTabs: remaining,
  };
}

export function integrateDesktopFeed(
  snapshot: DesktopAppSnapshot,
  items: DesktopFeedItem[],
  unreadCount: number
): DesktopAppSnapshot {
  if (items.length === 0) {
    return {
      ...snapshot,
      unreadCount,
    };
  }

  const alertMap = new Map<string, DesktopFeedItem>();
  for (const item of snapshot.recentAlerts) alertMap.set(item.id, item);
  for (const item of items) alertMap.set(item.id, item);

  const mergedAlerts = [...alertMap.values()]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 50);

  const recentAlertIds = Array.from(
    new Set([...items.map((item) => item.id), ...snapshot.recentAlertIds])
  ).slice(0, 200);

  return {
    ...snapshot,
    recentAlertIds,
    recentAlerts: mergedAlerts,
    unreadCount,
    lastAlertAt: mergedAlerts[0]?.createdAt ?? snapshot.lastAlertAt,
  };
}

export function createSavedWorkspace(
  snapshot: DesktopAppSnapshot,
  name: string,
  accountId: string | null
): DesktopSavedWorkspace {
  const timestamp = nowIso();

  return {
    id: createId("workspace"),
    name: name.trim() || "Workspace",
    accountId,
    tabs: snapshot.tabs.map((tab) => ({ ...tab })),
    activeTabId: snapshot.activeTabId,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function restoreWorkspace(
  snapshot: DesktopAppSnapshot,
  workspace: DesktopSavedWorkspace
): DesktopAppSnapshot {
  const tabs = workspace.tabs.length > 0
    ? workspace.tabs.map((tab) => ({ ...tab, id: createId("tab") }))
    : createInitialDesktopState().tabs;
  const activeIndex = workspace.tabs.findIndex((tab) => tab.id === workspace.activeTabId);
  const activeTabId = tabs[Math.max(0, activeIndex)]?.id ?? tabs[0]!.id;

  return {
    ...snapshot,
    tabs,
    activeTabId,
    closedTabs: [],
  };
}

export function upsertSavedWorkspace(
  savedWorkspacesByAccount: Record<string, DesktopSavedWorkspace[]>,
  workspace: DesktopSavedWorkspace
) {
  const key = getWorkspaceAccountKey(workspace.accountId);
  const next = { ...savedWorkspacesByAccount };
  const existing = next[key] ?? [];
  const index = existing.findIndex((candidate) => candidate.id === workspace.id);
  if (index === -1) {
    next[key] = [workspace, ...existing].slice(0, 20);
    return next;
  }

  const updated = [...existing];
  updated[index] = { ...workspace, updatedAt: nowIso() };
  next[key] = updated;
  return next;
}

export function removeSavedWorkspace(
  savedWorkspacesByAccount: Record<string, DesktopSavedWorkspace[]>,
  accountId: string | null,
  workspaceId: string
) {
  const key = getWorkspaceAccountKey(accountId);
  const existing = savedWorkspacesByAccount[key] ?? [];
  return {
    ...savedWorkspacesByAccount,
    [key]: existing.filter((workspace) => workspace.id !== workspaceId),
  };
}

export function getDefaultTitle(kind: DesktopTabKind) {
  switch (kind) {
    case "dashboard":
      return "Dashboard";
    case "reports":
      return "Reports";
    case "assistant":
      return "Assistant";
    case "trades":
      return "Trades";
    case "journal":
      return "Journal";
    case "prop-tracker":
      return "Prop Tracker";
    case "news":
      return "News";
    case "settings":
      return "Settings";
    default:
      return "Profitabledge";
  }
}
