import {
  AlertTriangle,
  PauseCircle,
  Plug,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";

export type ConnectionRow = {
  accountId: string | null;
  provider: string;
  status: string;
  isPaused: boolean;
};

export type ConnectionBadge = {
  icon: LucideIcon;
  iconClassName: string;
  longLabel: string;
  shortLabel: string;
};

export function normalizeConnectionStatus(status: string): string {
  switch (status) {
    case "active":
    case "success":
    case "running":
    case "idle":
      return "active";
    case "pending":
    case "bootstrapping":
    case "syncing":
      return "pending";
    case "error":
    case "degraded":
      return "error";
    default:
      return status;
  }
}

export function getConnectionBadge(
  connection: ConnectionRow | null
): ConnectionBadge | null {
  if (!connection) return null;

  const normalizedStatus = normalizeConnectionStatus(connection.status);

  const providerLabel =
    connection.provider === "mt5-terminal"
      ? "MT5"
      : connection.provider === "mt4-terminal"
      ? "MT4"
      : "Auto-sync";

  if (connection.isPaused) {
    return {
      icon: PauseCircle,
      iconClassName: "text-white/50",
      longLabel: `${providerLabel} sync paused`,
      shortLabel: "Paused",
    };
  }

  if (normalizedStatus === "active") {
    return {
      icon: Plug,
      iconClassName: "text-sky-400",
      longLabel: `${providerLabel} connected`,
      shortLabel: providerLabel,
    };
  }

  if (normalizedStatus === "pending") {
    return {
      icon: RefreshCw,
      iconClassName: "text-amber-400",
      longLabel: `${providerLabel} syncing`,
      shortLabel: "Syncing",
    };
  }

  return {
    icon: AlertTriangle,
    iconClassName: "text-orange-400",
    longLabel: `${providerLabel} connection issue`,
    shortLabel: "Issue",
  };
}

export function pickPreferredAccountConnection(
  connections: ConnectionRow[],
  accountId?: string
): ConnectionRow | null {
  if (!accountId) return null;

  const rankConnection = (connection: ConnectionRow) => {
    if (connection.isPaused) return 1;
    if (connection.status === "active") return 4;
    if (connection.status === "pending") return 3;
    if (connection.status === "error") return 0;
    return 2;
  };

  return (
    connections
      .filter((connection) => connection.accountId === accountId)
      .sort((a, b) => rankConnection(b) - rankConnection(a))[0] ?? null
  );
}
