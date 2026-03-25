export type ConnectionProviderDefinition = {
  id: string;
  name: string;
  category: string;
  description: string;
  authType: "credentials" | "oauth";
  fields: string[];
  status: "active" | "coming_soon";
  firms: string[];
  color: string;
  betaNote?: string;
};

export type ConnectionRegionOption = {
  value: string;
  label: string;
  hint: string | null;
};

export type ConnectionRow = {
  id: string;
  accountId: string | null;
  provider: string;
  displayName: string;
  status: string;
  lastSyncSuccessAt: string | Date | null;
  lastSyncedTradeCount: number | null;
  lastError: string | null;
  syncIntervalMinutes: number | null;
  isPaused: boolean;
};

export type TerminalWorkerConnection = {
  connectionId: string;
  displayName: string;
  provider: string;
  sessionKey: string | null;
  lastHeartbeatAt: string | null;
  lastSyncedAt: string | null;
  sessionMeta: Record<string, unknown>;
  completeness: {
    openPositionsMissingEntryDeals: number;
    closeOrdersWithoutExitDeals: number;
    lastFullReconcileAt: string | null;
    lastDealTime: string | null;
    lastOrderTime: string | null;
    historyGapDetected: boolean;
  };
};

export type TerminalWorkerRow = {
  slot: number;
  workerId: string;
  hostId: string;
  hostLabel: string;
  hostEnvironment: string | null;
  hostProvider: string | null;
  hostRegion: string | null;
  pid: number | null;
  alive: boolean;
  healthy: boolean;
  startedAt: string | null;
  restartCount: number;
  lastExitCode: number | null;
  lastExitAt: string | null;
  lastStartError: string | null;
  nextRestartAt: string | null;
  statusFresh: boolean;
  phase: string | null;
  state: string | null;
  updatedAt: string | null;
  lastError: string | null;
  activeConnections: TerminalWorkerConnection[];
};

export type TerminalSessionRow = {
  connectionId: string;
  displayName: string;
  provider: string;
  workerId: string;
  slot: number | null;
  alive: boolean;
  sessionKey: string | null;
  lastHeartbeatAt: string | null;
  lastSyncedAt: string | null;
  sessionMeta: Record<string, unknown>;
  completeness: {
    openPositionsMissingEntryDeals: number;
    closeOrdersWithoutExitDeals: number;
    lastFullReconcileAt: string | null;
    lastDealTime: string | null;
    lastOrderTime: string | null;
    historyGapDetected: boolean;
  };
};

export type PendingTerminalConnection = {
  connectionId: string;
  displayName: string;
  provider: string;
  status: string;
  isPaused: boolean;
  lastError: string | null;
  completeness: {
    openPositionsMissingEntryDeals: number;
    closeOrdersWithoutExitDeals: number;
    lastFullReconcileAt: string | null;
    lastDealTime: string | null;
    lastOrderTime: string | null;
    historyGapDetected: boolean;
  } | null;
};

export type TerminalHostRow = {
  workerHostId: string;
  label: string;
  machineName: string;
  environment: string | null;
  provider: string | null;
  region: string | null;
  regionGroup: string | null;
  countryCode: string | null;
  timezone: string | null;
  status: string;
  ok: boolean;
  mode: string;
  desiredChildren: number;
  runningChildren: number;
  healthyChildren: number;
  updatedAt: string | null;
};

export type TerminalSupervisorStatus = {
  available: boolean;
  error: string | null;
  summary: {
    ok: boolean;
    status: string;
    mode: string;
    hostCount: number;
    desiredChildren: number;
    runningChildren: number;
    healthyChildren: number;
    startedAt: string | null;
    updatedAt: string | null;
    uptimeSeconds: number;
    adminHost: string | null;
    adminPort: number | null;
    historyGapConnections: number;
    closeOrdersWithoutExitDeals: number;
    openPositionsMissingEntryDeals: number;
  } | null;
  hosts: TerminalHostRow[];
  workers: TerminalWorkerRow[];
  sessions: TerminalSessionRow[];
  pendingConnections: PendingTerminalConnection[];
};

export type AccountRow = {
  id: string;
  name: string;
  broker: string | null;
};

export type SyncNowInput = {
  connectionId: string;
};

export type SyncNowOutput = {
  status: "success" | "partial" | "error" | "skipped";
  tradesInserted: number;
  errorMessage: string | null;
};

export type DeleteConnectionInput = {
  connectionId: string;
};

export type UpdateSettingsInput = {
  connectionId: string;
  syncIntervalMinutes?: number;
  isPaused?: boolean;
  displayName?: string;
};

export type CreateCredentialInput = {
  provider: string;
  displayName: string;
  credentials: Record<string, string>;
  meta: Record<string, unknown>;
};

export type CreateCredentialOutput = {
  connectionId: string;
  accountInfo: unknown | null;
  mode?: "terminal-farm";
};

export type LinkAccountInput = {
  connectionId: string;
  accountId: string;
};
