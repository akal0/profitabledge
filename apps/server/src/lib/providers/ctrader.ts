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
  ProviderAuthorizedAccount,
} from "./types";
import WebSocket from "ws";
import { getServerEnv } from "../env";

const CTRADER_TOKEN_URL = "https://connect.spotware.com/apps/token";
const CTRADER_API_BASE = "https://api.spotware.com/connect";
const CTRADER_JSON_PORT = 5036;
const CTRADER_OPEN_API_TIMEOUT_MS = 12_000;

const CTRADER_PAYLOAD_TYPE = {
  APPLICATION_AUTH_REQ: 2100,
  APPLICATION_AUTH_RES: 2101,
  ERROR_RES: 2142,
  GET_ACCOUNTS_BY_ACCESS_TOKEN_REQ: 2149,
  GET_ACCOUNTS_BY_ACCESS_TOKEN_RES: 2150,
} as const;

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

interface CTraderAuthorizedAccountEntity {
  ctidTraderAccountId: string | number;
  traderLogin?: string | number | null;
  brokerTitleShort?: string | null;
  isLive?: boolean | null;
}

type CTraderJsonMessage = {
  clientMsgId?: string;
  payloadType?: number;
  payload?: Record<string, unknown>;
  errorCode?: string | number;
  description?: string;
};

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
    const env = getServerEnv();
    const res = await fetch(CTRADER_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: env.CTRADER_CLIENT_ID!,
        client_secret: env.CTRADER_CLIENT_SECRET!,
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
    const env = getServerEnv();
    const res = await fetch(CTRADER_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: credentials.refreshToken,
        client_id: env.CTRADER_CLIENT_ID!,
        client_secret: env.CTRADER_CLIENT_SECRET!,
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

  async listAuthorizedAccounts(
    credentials: ProviderCredentials
  ): Promise<ProviderAuthorizedAccount[]> {
    const accessToken = credentials.accessToken;
    if (!accessToken) {
      throw new Error("cTrader access token is missing");
    }

    const [liveAccounts, demoAccounts] = await Promise.allSettled([
      this.fetchAuthorizedAccountsFromOpenApi(accessToken, "live"),
      this.fetchAuthorizedAccountsFromOpenApi(accessToken, "demo"),
    ]);

    const accounts = [
      ...(liveAccounts.status === "fulfilled" ? liveAccounts.value : []),
      ...(demoAccounts.status === "fulfilled" ? demoAccounts.value : []),
    ];

    if (accounts.length > 0) {
      return dedupeAuthorizedAccounts(accounts);
    }

    const liveMessage =
      liveAccounts.status === "rejected"
        ? normalizeErrorMessage(liveAccounts.reason)
        : null;
    const demoMessage =
      demoAccounts.status === "rejected"
        ? normalizeErrorMessage(demoAccounts.reason)
        : null;

    throw new Error(
      [liveMessage, demoMessage]
        .filter(Boolean)
        .join(" / ") || "Unable to discover cTrader accounts for this token."
    );
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

  private async fetchAuthorizedAccountsFromOpenApi(
    accessToken: string,
    environment: "live" | "demo"
  ): Promise<ProviderAuthorizedAccount[]> {
    const env = getServerEnv();
    const endpoint = `wss://${environment}.ctraderapi.com:${CTRADER_JSON_PORT}`;

    const accounts = await new Promise<CTraderAuthorizedAccountEntity[]>(
      (resolve, reject) => {
        const ws = new WebSocket(endpoint);
        const timeout = setTimeout(() => {
          ws.terminate();
          reject(
            new Error(`Timed out while discovering ${environment} cTrader accounts`)
          );
        }, CTRADER_OPEN_API_TIMEOUT_MS);

        const cleanup = () => clearTimeout(timeout);

        ws.on("open", () => {
          ws.send(
            JSON.stringify({
                clientMsgId: `app-auth-${environment}-${crypto.randomUUID()}`,
                payloadType: CTRADER_PAYLOAD_TYPE.APPLICATION_AUTH_REQ,
                payload: {
                  clientId: env.CTRADER_CLIENT_ID!,
                  clientSecret: env.CTRADER_CLIENT_SECRET!,
                },
              })
            );
        });

        ws.on("message", (data) => {
          let parsed: CTraderJsonMessage | null = null;
          try {
            parsed = JSON.parse(String(data)) as CTraderJsonMessage;
          } catch (error) {
            cleanup();
            ws.close();
            reject(error);
            return;
          }

          if (!parsed) {
            return;
          }

          if (
            parsed.payloadType === CTRADER_PAYLOAD_TYPE.APPLICATION_AUTH_RES
          ) {
            ws.send(
              JSON.stringify({
                clientMsgId: `acct-list-${environment}-${crypto.randomUUID()}`,
                payloadType:
                  CTRADER_PAYLOAD_TYPE.GET_ACCOUNTS_BY_ACCESS_TOKEN_REQ,
                payload: {
                  accessToken,
                },
              })
            );
            return;
          }

          if (
            parsed.payloadType ===
            CTRADER_PAYLOAD_TYPE.GET_ACCOUNTS_BY_ACCESS_TOKEN_RES
          ) {
            cleanup();
            ws.close();
            resolve(
              ((parsed.payload?.ctidTraderAccount as unknown[]) ?? []) as
                | CTraderAuthorizedAccountEntity[]
                | []
            );
            return;
          }

          if (parsed.payloadType === CTRADER_PAYLOAD_TYPE.ERROR_RES) {
            cleanup();
            ws.close();
            reject(
              new Error(
                String(
                  parsed.payload?.description ??
                    parsed.description ??
                    "cTrader Open API returned an error."
                )
              )
            );
          }
        });

        ws.on("error", (error) => {
          cleanup();
          reject(error);
        });

        ws.on("close", () => {
          cleanup();
        });
      }
    );

    return accounts.map((account) => {
      const providerAccountId = String(account.ctidTraderAccountId);
      const accountNumber =
        account.traderLogin != null ? String(account.traderLogin) : null;
      const brokerName = account.brokerTitleShort ?? null;

      return {
        providerAccountId,
        accountNumber,
        label:
          [brokerName, accountNumber].filter(Boolean).join(" ") ||
          `cTrader ${providerAccountId}`,
        brokerName,
        currency: null,
        environment,
        metadata: {
          isLive: environment === "live",
        },
      } satisfies ProviderAuthorizedAccount;
    });
  }
}

/**
 * Generate the cTrader OAuth authorization URL.
 * Called from the connections router.
 */
export function getCTraderAuthUrl(state: string): string {
  const env = getServerEnv();
  if (!env.CTRADER_CLIENT_ID || !env.CTRADER_REDIRECT_URI) {
    throw new Error(
      "cTrader OAuth is not configured. CTRADER_CLIENT_ID and CTRADER_REDIRECT_URI are required."
    );
  }
  const url = new URL("https://connect.spotware.com/apps/authorize");
  url.searchParams.set("client_id", env.CTRADER_CLIENT_ID);
  url.searchParams.set("redirect_uri", env.CTRADER_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "trading");
  url.searchParams.set("state", state);
  return url.toString();
}

function dedupeAuthorizedAccounts(
  accounts: ProviderAuthorizedAccount[]
): ProviderAuthorizedAccount[] {
  const seen = new Set<string>();
  const deduped: ProviderAuthorizedAccount[] = [];

  for (const account of accounts) {
    const key = [
      account.environment,
      account.providerAccountId,
      account.accountNumber ?? "",
    ].join(":");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(account);
  }

  return deduped;
}

function normalizeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
