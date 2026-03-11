/**
 * DXTrade REST API Provider (Stub)
 *
 * Session cookie auth: POST /dxsca-web/login → JSESSIONID cookie
 * Used by: FundingPips, Alpha Capital, BrightFunded, FundedNext
 *
 * TODO: Implement once DXTrade API access is configured.
 */
import type {
  TradingProvider,
  ProviderConfig,
  NormalizedTrade,
  NormalizedPosition,
  NormalizedAccountInfo,
} from "./types";

export class DXTradeProvider implements TradingProvider {
  async connect(_config: ProviderConfig): Promise<NormalizedAccountInfo> {
    throw new Error("DXTrade provider is not yet implemented. Coming soon.");
  }

  async disconnect(): Promise<void> {}

  async fetchHistory(
    _config: ProviderConfig,
    _since: Date | null,
    _accountMeta: Record<string, unknown>
  ): Promise<NormalizedTrade[]> {
    throw new Error("DXTrade provider is not yet implemented.");
  }

  async fetchOpenPositions(
    _config: ProviderConfig,
    _accountMeta: Record<string, unknown>
  ): Promise<NormalizedPosition[]> {
    throw new Error("DXTrade provider is not yet implemented.");
  }

  async fetchAccountInfo(
    _config: ProviderConfig,
    _accountMeta: Record<string, unknown>
  ): Promise<NormalizedAccountInfo> {
    throw new Error("DXTrade provider is not yet implemented.");
  }
}
