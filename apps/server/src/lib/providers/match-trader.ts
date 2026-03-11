/**
 * Match-Trader REST API Provider
 *
 * JWT auth: POST /user/login with { login, password } → { token }
 * Each broker has their own Match-Trader server URL stored in meta.serverUrl
 *
 * Used by: FTMO, FundedNext, E8 Markets, Maven Trading
 *
 * No OAuth — user provides login + password + server URL.
 */
import type {
  TradingProvider,
  ProviderConfig,
  NormalizedTrade,
  NormalizedPosition,
  NormalizedAccountInfo,
} from "./types";

interface MatchTraderDeal {
  id: number;
  symbol: string;
  side: "BUY" | "SELL";
  volume: number;
  openPrice: number;
  closePrice: number;
  openTime: string;
  closeTime: string;
  profit: number;
  swap: number;
  commission: number;
  stopLoss?: number;
  takeProfit?: number;
  comment?: string;
}

interface MatchTraderPosition {
  id: number;
  symbol: string;
  side: "BUY" | "SELL";
  volume: number;
  openPrice: number;
  openTime: string;
  currentPrice?: number;
  profit?: number;
  stopLoss?: number;
  takeProfit?: number;
  swap?: number;
}

interface MatchTraderAccountInfo {
  login: string;
  balance: number;
  equity: number;
  currency: string;
  leverage?: number;
  freeMargin?: number;
  margin?: number;
  brokerName?: string;
}

export class MatchTraderProvider implements TradingProvider {
  private async getToken(
    serverUrl: string,
    login: string,
    password: string
  ): Promise<string> {
    const res = await fetch(`${serverUrl}/user/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, password }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Match-Trader login failed: ${res.status} ${body}`
      );
    }

    const data = (await res.json()) as { token: string };
    return data.token;
  }

  async connect(config: ProviderConfig): Promise<NormalizedAccountInfo> {
    return this.fetchAccountInfo(config, config.meta);
  }

  async disconnect(): Promise<void> {}

  async fetchHistory(
    config: ProviderConfig,
    since: Date | null,
    accountMeta: Record<string, unknown>
  ): Promise<NormalizedTrade[]> {
    const serverUrl = (accountMeta.serverUrl || config.meta.serverUrl) as string;
    const { login, password } = config.credentials;
    const token = await this.getToken(serverUrl, login, password);

    const allDeals: MatchTraderDeal[] = [];
    let offset = 0;
    const limit = 500;
    let hasMore = true;

    const params = new URLSearchParams({ limit: String(limit) });
    if (since) {
      params.set("from", since.toISOString());
    }

    while (hasMore) {
      params.set("offset", String(offset));

      const res = await fetch(
        `${serverUrl}/user/history?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        throw new Error(`Match-Trader history fetch failed: ${res.status}`);
      }

      const data = (await res.json()) as { deals: MatchTraderDeal[] };
      const deals = data.deals || [];
      allDeals.push(...deals);

      hasMore = deals.length >= limit;
      offset += limit;
    }

    return allDeals.map((deal) => ({
      ticket: String(deal.id),
      symbol: deal.symbol,
      tradeType: (deal.side === "BUY" ? "long" : "short") as "long" | "short",
      volume: deal.volume,
      openPrice: deal.openPrice,
      closePrice: deal.closePrice,
      openTime: new Date(deal.openTime),
      closeTime: new Date(deal.closeTime),
      profit: deal.profit + deal.commission + deal.swap,
      sl: deal.stopLoss ?? null,
      tp: deal.takeProfit ?? null,
      swap: deal.swap,
      commissions: deal.commission,
      pips: null,
      comment: deal.comment ?? null,
      _raw: deal as unknown as Record<string, unknown>,
    }));
  }

  async fetchOpenPositions(
    config: ProviderConfig,
    accountMeta: Record<string, unknown>
  ): Promise<NormalizedPosition[]> {
    const serverUrl = (accountMeta.serverUrl || config.meta.serverUrl) as string;
    const { login, password } = config.credentials;
    const token = await this.getToken(serverUrl, login, password);

    const res = await fetch(`${serverUrl}/user/positions`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error(`Match-Trader positions fetch failed: ${res.status}`);
    }

    const data = (await res.json()) as { positions: MatchTraderPosition[] };
    return (data.positions || []).map((p) => ({
      ticket: String(p.id),
      symbol: p.symbol,
      tradeType: (p.side === "BUY" ? "long" : "short") as "long" | "short",
      volume: p.volume,
      openPrice: p.openPrice,
      openTime: new Date(p.openTime),
      currentPrice: p.currentPrice ?? null,
      profit: p.profit ?? null,
      sl: p.stopLoss ?? null,
      tp: p.takeProfit ?? null,
      swap: p.swap ?? null,
      _raw: p as unknown as Record<string, unknown>,
    }));
  }

  async fetchAccountInfo(
    config: ProviderConfig,
    accountMeta: Record<string, unknown>
  ): Promise<NormalizedAccountInfo> {
    const serverUrl = (accountMeta.serverUrl || config.meta.serverUrl) as string;
    const { login, password } = config.credentials;
    const token = await this.getToken(serverUrl, login, password);

    const res = await fetch(`${serverUrl}/user/account`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error(`Match-Trader account info fetch failed: ${res.status}`);
    }

    const acct = (await res.json()) as MatchTraderAccountInfo;

    return {
      balance: acct.balance,
      equity: acct.equity,
      currency: acct.currency,
      leverage: acct.leverage ?? null,
      freeMargin: acct.freeMargin ?? null,
      margin: acct.margin ?? null,
      login: acct.login,
      serverName: serverUrl,
      brokerName: acct.brokerName ?? null,
    };
  }
}
