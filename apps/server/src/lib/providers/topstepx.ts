/**
 * TopstepX / ProjectX REST API Provider (Stub)
 *
 * REST + JWT auth: POST /api/Auth/loginKey → token
 * Used by: Topstep exclusively
 *
 * TODO: Implement once TopstepX API access is configured.
 */
import type {
  TradingProvider,
  ProviderConfig,
  NormalizedTrade,
  NormalizedPosition,
  NormalizedAccountInfo,
} from "./types";

export class TopstepXProvider implements TradingProvider {
  async connect(_config: ProviderConfig): Promise<NormalizedAccountInfo> {
    throw new Error("TopstepX provider is not yet implemented. Coming soon.");
  }

  async disconnect(): Promise<void> {}

  async fetchHistory(
    _config: ProviderConfig,
    _since: Date | null,
    _accountMeta: Record<string, unknown>
  ): Promise<NormalizedTrade[]> {
    throw new Error("TopstepX provider is not yet implemented.");
  }

  async fetchOpenPositions(
    _config: ProviderConfig,
    _accountMeta: Record<string, unknown>
  ): Promise<NormalizedPosition[]> {
    throw new Error("TopstepX provider is not yet implemented.");
  }

  async fetchAccountInfo(
    _config: ProviderConfig,
    _accountMeta: Record<string, unknown>
  ): Promise<NormalizedAccountInfo> {
    throw new Error("TopstepX provider is not yet implemented.");
  }
}
