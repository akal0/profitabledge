/**
 * TradeLocker REST API Provider
 *
 * JWT auth: POST /auth/jwt/token with { email, password, server } → { accessToken, refreshToken }
 * Base URL: https://public-api.tradelocker.com
 *
 * Used by: FTMO, E8 Markets, Alpha Capital, DNA Funded, BrightFunded
 */
import type {
  TradingProvider,
  ProviderConfig,
  NormalizedTrade,
  NormalizedPosition,
  NormalizedAccountInfo,
  ProviderCredentials,
} from "./types";

const TRADELOCKER_API_BASE = "https://public-api.tradelocker.com";

interface TradeLockerOrder {
  id: number;
  accountId: number;
  instrumentId: number;
  symbolName: string;
  side: "buy" | "sell";
  qty: number;
  filledQty: number;
  avgFillPrice: number;
  openPrice: number;
  closePrice: number;
  openTime: string;
  closeTime: string;
  realizedPnl: number;
  swap: number;
  commission: number;
  stopLoss?: number;
  takeProfit?: number;
}

interface TradeLockerPosition {
  id: number;
  instrumentId: number;
  symbolName: string;
  side: "buy" | "sell";
  qty: number;
  avgPrice: number;
  openTime: string;
  currentPrice?: number;
  unrealizedPnl?: number;
  swap?: number;
  stopLoss?: number;
  takeProfit?: number;
}

interface TradeLockerAccountInfo {
  id: number;
  accNum: string;
  balance: number;
  equity: number;
  currency: string;
  leverage?: number;
  freeMargin?: number;
  usedMargin?: number;
}

export class TradeLockerProvider implements TradingProvider {
  private async authenticate(
    email: string,
    password: string,
    server: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const res = await fetch(`${TRADELOCKER_API_BASE}/auth/jwt/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, server }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`TradeLocker auth failed: ${res.status} ${body}`);
    }

    return (await res.json()) as {
      accessToken: string;
      refreshToken: string;
    };
  }

  async connect(config: ProviderConfig): Promise<NormalizedAccountInfo> {
    return this.fetchAccountInfo(config, config.meta);
  }

  async disconnect(): Promise<void> {}

  async refreshToken(
    credentials: ProviderCredentials
  ): Promise<ProviderCredentials> {
    const res = await fetch(`${TRADELOCKER_API_BASE}/auth/jwt/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: credentials.refreshToken }),
    });

    if (!res.ok) {
      throw new Error(`TradeLocker token refresh failed: ${res.status}`);
    }

    const data = (await res.json()) as {
      accessToken: string;
      refreshToken: string;
    };

    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      email: credentials.email,
      password: credentials.password,
      server: credentials.server,
    };
  }

  async fetchHistory(
    config: ProviderConfig,
    since: Date | null,
    accountMeta: Record<string, unknown>
  ): Promise<NormalizedTrade[]> {
    const { email, password, server } = config.credentials;
    const { accessToken } = await this.authenticate(email, password, server);
    const accountId = accountMeta.tradelockerAccountId as string;

    const params = new URLSearchParams({ limit: "1000" });
    if (since) {
      params.set("from", since.toISOString());
    }

    const allOrders: TradeLockerOrder[] = [];
    let hasMore = true;
    let offset = 0;

    while (hasMore) {
      params.set("offset", String(offset));

      const res = await fetch(
        `${TRADELOCKER_API_BASE}/trade/accounts/${accountId}/ordersHistory?${params}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!res.ok) {
        throw new Error(`TradeLocker history fetch failed: ${res.status}`);
      }

      const data = (await res.json()) as { d: { orders: TradeLockerOrder[] } };
      const orders = data.d?.orders || [];
      allOrders.push(...orders);

      hasMore = orders.length >= 1000;
      offset += 1000;
    }

    return allOrders
      .filter((o) => o.closeTime) // Only closed trades
      .map((o) => ({
        ticket: String(o.id),
        symbol: o.symbolName,
        tradeType: (o.side === "buy" ? "long" : "short") as "long" | "short",
        volume: o.filledQty,
        openPrice: o.openPrice,
        closePrice: o.closePrice,
        openTime: new Date(o.openTime),
        closeTime: new Date(o.closeTime),
        profit: o.realizedPnl + o.commission + o.swap,
        sl: o.stopLoss ?? null,
        tp: o.takeProfit ?? null,
        swap: o.swap,
        commissions: o.commission,
        pips: null,
        comment: null,
        _raw: o as unknown as Record<string, unknown>,
      }));
  }

  async fetchOpenPositions(
    config: ProviderConfig,
    accountMeta: Record<string, unknown>
  ): Promise<NormalizedPosition[]> {
    const { email, password, server } = config.credentials;
    const { accessToken } = await this.authenticate(email, password, server);
    const accountId = accountMeta.tradelockerAccountId as string;

    const res = await fetch(
      `${TRADELOCKER_API_BASE}/trade/accounts/${accountId}/positions`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      throw new Error(`TradeLocker positions fetch failed: ${res.status}`);
    }

    const data = (await res.json()) as {
      d: { positions: TradeLockerPosition[] };
    };

    return (data.d?.positions || []).map((p) => ({
      ticket: String(p.id),
      symbol: p.symbolName,
      tradeType: (p.side === "buy" ? "long" : "short") as "long" | "short",
      volume: p.qty,
      openPrice: p.avgPrice,
      openTime: new Date(p.openTime),
      currentPrice: p.currentPrice ?? null,
      profit: p.unrealizedPnl ?? null,
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
    const { email, password, server } = config.credentials;
    const { accessToken } = await this.authenticate(email, password, server);
    const accountId = accountMeta.tradelockerAccountId as string;

    const res = await fetch(
      `${TRADELOCKER_API_BASE}/trade/accounts/${accountId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      throw new Error(`TradeLocker account info fetch failed: ${res.status}`);
    }

    const data = (await res.json()) as { d: TradeLockerAccountInfo };
    const acct = data.d;

    return {
      balance: acct.balance,
      equity: acct.equity,
      currency: acct.currency,
      leverage: acct.leverage ?? null,
      freeMargin: acct.freeMargin ?? null,
      margin: acct.usedMargin ?? null,
      login: acct.accNum,
      serverName: server,
      brokerName: null,
    };
  }
}
