/**
 * Tradovate REST API Provider (Stub)
 *
 * OAuth2 + WebSocket for live data
 * Used by: Apex Trader Funding, Topstep (legacy), SpeedUp Trader
 *
 * TODO: Implement once Tradovate partner API access is configured.
 */
import type {
  TradingProvider,
  ProviderConfig,
  NormalizedTrade,
  NormalizedPosition,
  NormalizedAccountInfo,
} from "./types";

export class TradovateProvider implements TradingProvider {
  async connect(_config: ProviderConfig): Promise<NormalizedAccountInfo> {
    throw new Error("Tradovate provider is not yet implemented. Coming soon.");
  }

  async disconnect(): Promise<void> {}

  async fetchHistory(
    _config: ProviderConfig,
    _since: Date | null,
    _accountMeta: Record<string, unknown>
  ): Promise<NormalizedTrade[]> {
    throw new Error("Tradovate provider is not yet implemented.");
  }

  async fetchOpenPositions(
    _config: ProviderConfig,
    _accountMeta: Record<string, unknown>
  ): Promise<NormalizedPosition[]> {
    throw new Error("Tradovate provider is not yet implemented.");
  }

  async fetchAccountInfo(
    _config: ProviderConfig,
    _accountMeta: Record<string, unknown>
  ): Promise<NormalizedAccountInfo> {
    throw new Error("Tradovate provider is not yet implemented.");
  }
}
