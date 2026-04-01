export const STATUS_STYLES: Record<
  string,
  { label: string; className: string }
> = {
  active: {
    label: "Connected",
    className: "bg-teal-900/30 text-teal-400 border-teal-500/30",
  },
  syncing: {
    label: "Syncing",
    className: "bg-teal-900/30 text-teal-400 border-teal-500/30",
  },
  pending: {
    label: "Pending",
    className: "bg-yellow-900/30 text-yellow-400 border-yellow-500/30",
  },
  bootstrapping: {
    label: "Bootstrapping",
    className: "bg-yellow-900/30 text-yellow-400 border-yellow-500/30",
  },
  degraded: {
    label: "Degraded",
    className: "bg-orange-900/30 text-orange-300 border-orange-500/30",
  },
  error: {
    label: "Error",
    className: "bg-rose-900/30 text-rose-400 border-rose-500/30",
  },
  expired: {
    label: "Expired",
    className: "bg-rose-900/30 text-rose-400 border-rose-500/30",
  },
  disconnected: {
    label: "Disconnected",
    className: "bg-white/5 text-white/50 border-white/10",
  },
};

export function isTerminalProvider(provider: string) {
  return provider === "mt5-terminal" || provider === "mt4-terminal";
}

export function isWorkerManagedProvider(provider: string) {
  return isTerminalProvider(provider) || provider === "rithmic";
}

export function formatStatusTimestamp(value: string | Date | null | undefined) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

export function formatUptime(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) return "0s";

  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}
