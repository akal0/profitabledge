export interface CopierDashboardIssue {
  tone: "critical" | "warning" | "info";
  title: string;
  description: string;
}

export interface CopierDashboardAccount {
  id: string;
  name: string;
  broker: string;
  brokerServer: string | null;
  accountNumber: string | null;
  role: "master" | "slave" | "both" | "unassigned";
  groupNames: string[];
  isVerified: boolean;
  isConnected: boolean;
  lastSyncedAt: Date | string | null;
  liveBalance: string | null;
  liveEquity: string | null;
  initialBalance: string | null;
}

export interface CopierDashboardSignal {
  id: string;
  groupId: string;
  groupName: string;
  masterAccountId: string;
  masterAccountName: string;
  slaveAccountId: string;
  slaveAccountName: string;
  signalType: string | null;
  status: string | null;
  masterTicket: string;
  slaveTicket: string | null;
  symbol: string;
  tradeType: string;
  masterVolume: string;
  slaveVolume: string | null;
  openPrice: string | null;
  closePrice: string | null;
  executedPrice: string | null;
  slippagePips: number | null;
  copiedProfit: number | null;
  masterProfit: number | null;
  copyDelta: number | null;
  rejectionReason: string | null;
  errorMessage: string | null;
  createdAt: Date | string;
  executedAt: Date | string | null;
  latencyMs: number | null;
}

export interface CopierDashboardSlave {
  id: string;
  isActive: boolean | null;
  lotMode: string | null;
  fixedLot: string | null;
  lotMultiplier: string | null;
  riskPercent: string | null;
  maxLotSize: string | null;
  maxDailyLoss: string | null;
  maxTradesPerDay: number | null;
  maxDrawdownPercent: string | null;
  slMode: string | null;
  slFixedPips: string | null;
  slMultiplier: string | null;
  tpMode: string | null;
  tpFixedPips: string | null;
  tpMultiplier: string | null;
  symbolWhitelist: string[] | null;
  symbolBlacklist: string[] | null;
  sessionFilter: string[] | null;
  minLotSize: string | null;
  maxSlippagePips: string | null;
  copyPendingOrders: boolean | null;
  copySlTpModifications: boolean | null;
  reverseTrades: boolean | null;
  totalCopiedTrades: number | null;
  totalProfit: string | null;
  lastCopyAt: Date | string | null;
  createdAt: Date | string;
  account: {
    id: string;
    name: string;
    broker: string;
    accountNumber: string | null;
    liveBalance: string | null;
    liveEquity: string | null;
    initialBalance: string | null;
    isVerified: boolean;
    isConnected: boolean;
    lastSyncedAt: Date | string | null;
  };
}

export interface CopierDashboardGroup {
  id: string;
  name: string;
  isActive: boolean | null;
  createdAt: Date | string;
  masterAccount: {
    id: string;
    name: string;
    broker: string;
    brokerServer: string | null;
    accountNumber: string | null;
    liveBalance: string | null;
    liveEquity: string | null;
    initialBalance: string | null;
    isVerified: boolean;
    isConnected: boolean;
    lastSyncedAt: Date | string | null;
  };
  health: {
    status: "healthy" | "watch" | "critical" | "armed" | "paused";
    score: number;
    staleMaster: boolean;
    staleSlaveCount: number;
    avgLatencyMs: number;
    avgSlippage: number;
    maxSlippage: number;
    topFailureReasons: Array<{ reason: string; count: number }>;
    lastSignalAt: Date | string | null;
  };
  stats: {
    slaveCount: number;
    activeSlaveCount: number;
    totalTrades: number;
    totalProfit: number;
    totalSignals: number;
    pendingSignals: number;
    sentSignals: number;
    executedSignals: number;
    failedSignals: number;
    rejectedSignals: number;
    executionRate: number;
    copiedProfit30d: number;
    masterProfit30d: number;
    copyDelta30d: number;
    winRate30d: number;
    avgLatencyMs: number;
    avgSlippage: number;
  };
  slaves: CopierDashboardSlave[];
  recentSignals: CopierDashboardSignal[];
}

export interface CopierDashboardData {
  overview: {
    groupCount: number;
    activeGroupCount: number;
    slaveCount: number;
    activeSlaveCount: number;
    totalSignals: number;
    pendingSignals: number;
    sentSignals: number;
    executedSignals: number;
    failedSignals: number;
    rejectedSignals: number;
    executionRate: number;
    avgLatencyMs: number;
    avgSlippage: number;
    copiedProfit30d: number;
    masterProfit30d: number;
    copyDelta30d: number;
    verifiedAccountCount: number;
    connectedAccountCount: number;
    staleAccountCount: number;
    lastSignalAt: Date | string | null;
  };
  setup: {
    issues: CopierDashboardIssue[];
    accounts: CopierDashboardAccount[];
  };
  recentSignals: CopierDashboardSignal[];
  groups: CopierDashboardGroup[];
}
