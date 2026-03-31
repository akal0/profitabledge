export type DesktopTabKind =
  | "dashboard"
  | "reports"
  | "assistant"
  | "trades"
  | "journal"
  | "prop-tracker"
  | "news"
  | "settings"
  | "custom";

export interface DesktopTabState {
  id: string;
  kind: DesktopTabKind;
  title: string;
  path: string;
  lastKnownPath: string | null;
  accountId: string | null;
}

export interface DesktopSavedWorkspace {
  id: string;
  name: string;
  accountId: string | null;
  tabs: DesktopTabState[];
  activeTabId: string;
  createdAt: string;
  updatedAt: string;
}

export interface DesktopFeedItem {
  id: string;
  accountId: string | null;
  type: string;
  title: string;
  body: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  readAt: string | null;
}

export interface DesktopAppSnapshot {
  version: number;
  tabs: DesktopTabState[];
  activeTabId: string;
  closedTabs: DesktopTabState[];
  recentAlertIds: string[];
  recentAlerts: DesktopFeedItem[];
  unreadCount: number;
  lastAlertAt: string | null;
}

export interface DesktopPersistedState {
  version: number;
  current: DesktopAppSnapshot;
  savedWorkspacesByAccount: Record<string, DesktopSavedWorkspace[]>;
}

export interface DesktopSessionBridgeUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

export type DesktopBridgeEvent =
  | {
      source: "profitabledge-web-bridge";
      webviewLabel?: string;
      type: "route-change";
      path: string;
      title?: string;
    }
  | {
      source: "profitabledge-web-bridge";
      webviewLabel?: string;
      type: "session-state";
      authenticated: boolean;
      pending: boolean;
      user: DesktopSessionBridgeUser | null;
    }
  | {
      source: "profitabledge-web-bridge";
      webviewLabel?: string;
      type: "open-external-url";
      url: string;
    };

export type DesktopShellCommand =
  | {
      source: "profitabledge-desktop-shell";
      type: "navigate";
      path: string;
      accountId?: string | null;
      targetWebviewLabel?: string;
    }
  | {
      source: "profitabledge-desktop-shell";
      type: "set-account";
      accountId?: string | null;
      targetWebviewLabel?: string;
    };

export function inferTabKindFromPath(path: string): DesktopTabKind {
  if (path.startsWith("/assistant")) return "assistant";
  if (path.startsWith("/dashboard/reports")) return "reports";
  if (path.startsWith("/dashboard/trades")) return "trades";
  if (path.startsWith("/dashboard/journal")) return "journal";
  if (path.startsWith("/dashboard/prop-tracker")) return "prop-tracker";
  if (path.startsWith("/dashboard/news")) return "news";
  if (path.startsWith("/dashboard/settings")) return "settings";
  if (path.startsWith("/dashboard")) return "dashboard";
  return "custom";
}
