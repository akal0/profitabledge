/**
 * cTrader Open API Provider
 *
 * OAuth2 Authorization Code flow:
 *   1. Redirect to https://connect.spotware.com/apps/authorize
 *   2. Callback receives ?code=...
 *   3. Exchange code at https://connect.spotware.com/apps/token
 *   4. Store encrypted access_token + refresh_token
 *
 * REST endpoints via cTrader Open API proxy:
 *   Base: https://api.spotware.com/connect
 *
 * Used by: FTMO, FundedNext, E8 Markets, FundingPips, Alpha Capital, Maven Trading
 *
 * Required env vars:
 *   CTRADER_CLIENT_ID
 *   CTRADER_CLIENT_SECRET
 *   CTRADER_REDIRECT_URI
 */
import type {
  TradingProvider,
  ProviderConfig,
  NormalizedTrade,
  NormalizedPosition,
  NormalizedAccountInfo,
  ProviderCredentials,
} from "./types";

const CTRADER_TOKEN_URL = "https://connect.spotware.com/apps/token";
const CTRADER_API_BASE = "https://api.spotware.com/connect";

// cTrader API response types
interface CTraderDeal {
  dealId: number;
  positionId: number;
  symbolName: string;
  tradeSide: "BUY" | "SELL";
  dealStatus: string;
  filledVolume: number;
  executionPrice: number;
  createTimestamp: number;
  stopLoss?: number;
  takeProfit?: number;
  comment?: string;
  closePositionDetail?: {
    grossProfit: number;
    commission: number;
    swap: number;
  };
}

interface CTraderPosition {
  positionId: number;
  symbolName: string;
  tradeSide: "BUY" | "SELL";
  volume: number;
  entryPrice: number;
  currentPrice?: number;
  netProfit?: number;
  stopLoss?: number;
  takeProfit?: number;
  swap?: number;
  utcLastUpdateTimestamp: number;
}

interface CTraderAccount {
  traderLogin: number;
  balance: number;
  depositCurrency: string;
  leverage?: number;
  freeMargin?: number;
  marginUsed?: number;
  unrealizedGrossProfit: number;
  brokerName?: string;
}

export class CTraderProvider implements TradingProvider {
  async connect(config: ProviderConfig): Promise<NormalizedAccountInfo> {
    return this.fetchAccountInfo(config, config.meta);
  }

  async disconnect(): Promise<void> {
    // Stateless HTTP — nothing to release
  }

  async exchangeCode(
    code: string,
    redirectUri: string
  ): Promise<ProviderCredentials> {
    const res = await fetch(CTRADER_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: process.env.CTRADER_CLIENT_ID!,
        client_secret: process.env.CTRADER_CLIENT_SECRET!,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`cTrader token exchange failed: ${res.status} ${body}`);
    }

    const data = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
  }

  async refreshToken(
    credentials: ProviderCredentials
  ): Promise<ProviderCredentials> {
    const res = await fetch(CTRADER_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: credentials.refreshToken,
        client_id: process.env.CTRADER_CLIENT_ID!,
        client_secret: process.env.CTRADER_CLIENT_SECRET!,
      }),
    });

    if (!res.ok) {
      throw new Error(`cTrader token refresh failed: ${res.status}`);
    }

    const data = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
  }

  async fetchHistory(
    config: ProviderConfig,
    since: Date | null,
    accountMeta: Record<string, unknown>
  ): Promise<NormalizedTrade[]> {
    const { accessToken } = config.credentials;
    const ctraderId = accountMeta.ctraderAccountId as string;

    const allDeals: CTraderDeal[] = [];
    const fromMs = since ? since.getTime() : 0;
    const toMs = Date.now();

    // Paginate through deal history
    let offset = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
      const url =
        `${CTRADER_API_BASE}/tradingaccounts/${ctraderId}/deals` +
        `?from=${fromMs}&to=${toMs}&limit=${limit}&offset=${offset}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        throw new Error(`cTrader deals fetch failed: ${res.status}`);
      }

      const data = (await res.json()) as { deal: CTraderDeal[] };
      const deals = data.deal || [];
      allDeals.push(...deals);

      if (deals.length < limit) {
        hasMore = false;
      } else {
        offset += limit;
      }
    }

    return this.mapDealsToTrades(allDeals);
  }

  async fetchOpenPositions(
    config: ProviderConfig,
    accountMeta: Record<string, unknown>
  ): Promise<NormalizedPosition[]> {
    const { accessToken } = config.credentials;
    const ctraderId = accountMeta.ctraderAccountId as string;

    const res = await fetch(
      `${CTRADER_API_BASE}/tradingaccounts/${ctraderId}/positions`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      throw new Error(`cTrader positions fetch failed: ${res.status}`);
    }

    const data = (await res.json()) as { position: CTraderPosition[] };
    return (data.position || []).map((p) => ({
      ticket: String(p.positionId),
      symbol: p.symbolName,
      tradeType: (p.tradeSide === "BUY" ? "long" : "short") as
        | "long"
        | "short",
      volume: p.volume / 100, // cTrader volume in centilots
      openPrice: p.entryPrice,
      openTime: new Date(p.utcLastUpdateTimestamp),
      currentPrice: p.currentPrice ?? null,
      profit: p.netProfit != null ? p.netProfit / 100 : null,
      sl: p.stopLoss ?? null,
      tp: p.takeProfit ?? null,
      swap: p.swap != null ? p.swap / 100 : null,
      _raw: p as unknown as Record<string, unknown>,
    }));
  }

  async fetchAccountInfo(
    config: ProviderConfig,
    accountMeta: Record<string, unknown>
  ): Promise<NormalizedAccountInfo> {
    const { accessToken } = config.credentials;
    const ctraderId = accountMeta.ctraderAccountId as string;

    const res = await fetch(
      `${CTRADER_API_BASE}/tradingaccounts/${ctraderId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      throw new Error(`cTrader account info fetch failed: ${res.status}`);
    }

    const acct = (await res.json()) as CTraderAccount;

    return {
      balance: acct.balance / 100, // cTrader returns cents
      equity: (acct.balance + acct.unrealizedGrossProfit) / 100,
      currency: acct.depositCurrency,
      leverage: acct.leverage ?? null,
      freeMargin: acct.freeMargin ? acct.freeMargin / 100 : null,
      margin: acct.marginUsed ? acct.marginUsed / 100 : null,
      login: String(acct.traderLogin),
      serverName: acct.brokerName ?? null,
      brokerName: acct.brokerName ?? null,
    };
  }

  /**
   * Group cTrader deals by positionId and reconstruct complete trades.
   * cTrader deals come in pairs (entry fill + close fill).
   */
  private mapDealsToTrades(deals: CTraderDeal[]): NormalizedTrade[] {
    const byPosition = new Map<string, CTraderDeal[]>();

    for (const deal of deals) {
      const posId = String(deal.positionId);
      if (!byPosition.has(posId)) {
        byPosition.set(posId, []);
      }
      byPosition.get(posId)!.push(deal);
    }

    const trades: NormalizedTrade[] = [];

    for (const [posId, posDeals] of byPosition.entries()) {
      const entry = posDeals.find(
        (d) =>
          d.dealStatus === "FULLY_FILLED" &&
          (d.tradeSide === "BUY" || d.tradeSide === "SELL") &&
          !d.closePositionDetail
      );
      const close = posDeals.find((d) => d.closePositionDetail !== undefined);

      if (!entry || !close) continue; // Skip incomplete trades

      const openTime = new Date(entry.createTimestamp);
      const closeTime = new Date(close.createTimestamp);
      const volume = entry.filledVolume / 100; // centilots → lots
      const profit = (close.closePositionDetail!.grossProfit ?? 0) / 100;
      const commission = (close.closePositionDetail!.commission ?? 0) / 100;
      const swap = (close.closePositionDetail!.swap ?? 0) / 100;

      trades.push({
        ticket: posId,
        symbol: entry.symbolName,
        tradeType: entry.tradeSide === "BUY" ? "long" : "short",
        volume,
        openPrice: entry.executionPrice,
        closePrice: close.executionPrice,
        openTime,
        closeTime,
        profit: profit + commission + swap, // Net P&L
        sl: entry.stopLoss ?? null,
        tp: entry.takeProfit ?? null,
        swap,
        commissions: commission,
        pips: null, // cTrader doesn't provide pip values directly
        comment: entry.comment ?? null,
        _raw: { entry, close } as unknown as Record<string, unknown>,
      });
    }

    return trades;
  }
}

/**
 * Generate the cTrader OAuth authorization URL.
 * Called from the connections router.
 */
export function getCTraderAuthUrl(state: string): string {
  const url = new URL("https://connect.spotware.com/apps/authorize");
  url.searchParams.set("client_id", process.env.CTRADER_CLIENT_ID!);
  url.searchParams.set("redirect_uri", process.env.CTRADER_REDIRECT_URI!);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "trading");
  url.searchParams.set("state", state);
  return url.toString();
}
