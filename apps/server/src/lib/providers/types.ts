/**
 * Common interfaces for the multi-provider trade sync system.
 * Every trading platform provider implements TradingProvider.
 */

export interface NormalizedTrade {
  ticket: string;
  symbol: string;
  tradeType: "long" | "short";
  volume: number;
  openPrice: number;
  closePrice: number;
  openTime: Date;
  closeTime: Date;
  profit: number;
  sl: number | null;
  tp: number | null;
  swap: number | null;
  commissions: number | null;
  pips: number | null;
  comment: string | null;
  /** Raw platform payload for debugging */
  _raw: Record<string, unknown>;
}

export interface NormalizedPosition {
  ticket: string;
  symbol: string;
  tradeType: "long" | "short";
  volume: number;
  openPrice: number;
  openTime: Date;
  currentPrice: number | null;
  profit: number | null;
  sl: number | null;
  tp: number | null;
  swap: number | null;
  _raw: Record<string, unknown>;
}

export interface NormalizedAccountInfo {
  balance: number;
  equity: number;
  currency: string;
  leverage: number | null;
  freeMargin: number | null;
  margin: number | null;
  login: string | null;
  serverName: string | null;
  brokerName: string | null;
}

export type ProviderCredentials = Record<string, string>;

export interface ProviderAuthorizedAccount {
  providerAccountId: string;
  accountNumber: string | null;
  label: string | null;
  brokerName: string | null;
  currency: string | null;
  environment: "live" | "demo" | "unknown";
  metadata?: Record<string, unknown>;
}

export type ProviderMethodName =
  | "connect"
  | "disconnect"
  | "fetchHistory"
  | "fetchOpenPositions"
  | "fetchAccountInfo"
  | "exchangeCode"
  | "refreshToken";

export type ProviderCapabilityReadiness =
  | "implemented"
  | "scaffolded"
  | "planned";

export interface ProviderCapabilityDetail {
  supported: boolean;
  readiness: ProviderCapabilityReadiness;
  note: string;
}

export type ProviderCapabilityMap = Partial<
  Record<ProviderMethodName, ProviderCapabilityDetail>
>;

export interface ProviderScaffoldMetadata {
  name: string;
  description: string;
  authType: "oauth" | "credentials";
  fields: string[];
  status: "active" | "coming_soon";
  capabilities: ProviderCapabilityMap;
}

export interface ProviderConfig {
  credentials: ProviderCredentials;
  meta: Record<string, unknown>;
}

export interface TradingProvider {
  /** Verify credentials and return account info. Throws on invalid creds. */
  connect(config: ProviderConfig): Promise<NormalizedAccountInfo>;

  /** Release any held resources. */
  disconnect(): Promise<void>;

  /** Fetch closed trade history since `since` (null = all available). */
  fetchHistory(
    config: ProviderConfig,
    since: Date | null,
    accountMeta: Record<string, unknown>
  ): Promise<NormalizedTrade[]>;

  /** Fetch currently open positions. */
  fetchOpenPositions(
    config: ProviderConfig,
    accountMeta: Record<string, unknown>
  ): Promise<NormalizedPosition[]>;

  /** Fetch current account balance/equity. */
  fetchAccountInfo(
    config: ProviderConfig,
    accountMeta: Record<string, unknown>
  ): Promise<NormalizedAccountInfo>;

  /** OAuth: exchange authorization code for tokens. */
  exchangeCode?(
    code: string,
    redirectUri: string
  ): Promise<ProviderCredentials>;

  /** OAuth: refresh an expired access token. */
  refreshToken?(
    credentials: ProviderCredentials
  ): Promise<ProviderCredentials>;

  /** OAuth providers can enumerate broker accounts available to the token. */
  listAuthorizedAccounts?(
    credentials: ProviderCredentials
  ): Promise<ProviderAuthorizedAccount[]>;
}
