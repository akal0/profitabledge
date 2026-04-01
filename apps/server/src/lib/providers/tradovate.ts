import type {
  NormalizedAccountInfo,
  NormalizedPosition,
  NormalizedTrade,
  ProviderAuthorizedAccount,
  ProviderConfig,
  ProviderCredentials,
  TradingProvider,
} from "./types";
import { getServerEnv } from "../env";
import {
  coalesce,
  extractErrorMessage,
  extractRecordList,
  pickBoolean,
  pickDate,
  pickNumber,
  pickString,
} from "./provider-utils";
import {
  reconstructRoundTripsFromFills,
  type ExecutionFillSeed,
} from "./round-trip-reconstructor";

export const TRADOVATE_PROVIDER_INFO = {
  name: "Tradovate",
  description:
    "Futures platform with OAuth, account discovery, trade history, and position sync.",
  authType: "oauth",
  fields: [],
  status: "active",
  capabilities: {
    connect: {
      supported: true,
      readiness: "implemented",
      note: "Tradovate account verification is supported through the REST API.",
    },
    disconnect: {
      supported: true,
      readiness: "implemented",
      note: "Tradovate is stateless between sync runs.",
    },
    fetchHistory: {
      supported: true,
      readiness: "implemented",
      note: "Tradovate closed-trade sync reconstructs round trips from execution fills.",
    },
    fetchOpenPositions: {
      supported: true,
      readiness: "implemented",
      note: "Tradovate open-position polling is supported.",
    },
    fetchAccountInfo: {
      supported: true,
      readiness: "implemented",
      note: "Tradovate balance, equity, and margin snapshots are supported.",
    },
    exchangeCode: {
      supported: true,
      readiness: "implemented",
      note: "Tradovate supports OAuth authorization-code exchange.",
    },
    refreshToken: {
      supported: true,
      readiness: "implemented",
      note: "Tradovate refresh-token rotation is supported.",
    },
  },
} as const;

type TradovateTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  userId?: number | string;
  error?: string;
  error_description?: string;
};

type TradovateMeResponse = {
  userId?: number | string;
  fullName?: string | null;
  name?: string | null;
  email?: string | null;
};

function buildTradovateUrl(path: string, params?: URLSearchParams) {
  const baseUrl = getTradovateApiBaseUrl().replace(/\/+$/, "");
  const url = new URL(`${baseUrl}/${path.replace(/^\/+/, "")}`);
  if (params) {
    url.search = params.toString();
  }
  return url;
}

function parseTradovateTradeSide(
  record: Record<string, unknown>
): "buy" | "sell" | null {
  const explicit = pickString(record, [
    "side",
    "action",
    "fillType",
    "direction",
    "tradeType",
  ])?.toLowerCase();

  if (explicit) {
    if (["buy", "bid", "long", "b"].some((value) => explicit.includes(value))) {
      return "buy";
    }

    if (
      ["sell", "ask", "short", "s"].some((value) => explicit.includes(value))
    ) {
      return "sell";
    }
  }

  const numericSide = pickNumber(record, ["side"]);
  if (numericSide === 0) {
    return "buy";
  }
  if (numericSide === 1) {
    return "sell";
  }

  const signedQuantity = pickNumber(record, ["qty", "quantity", "size", "volume"]);
  if (signedQuantity != null) {
    if (signedQuantity > 0) return "buy";
    if (signedQuantity < 0) return "sell";
  }

  return null;
}

function normalizeExecutionFill(
  fill: Record<string, unknown>,
  orderMap: Map<string, Record<string, unknown>>
): ExecutionFillSeed | null {
  const orderId = coalesce(
    pickString(fill, ["orderId", "orderID"]),
    String(pickNumber(fill, ["orderId", "orderID"]) ?? "") || null
  );
  const order = orderId ? orderMap.get(orderId) : null;
  const side = parseTradovateTradeSide(fill) ?? (order ? parseTradovateTradeSide(order) : null);
  const volume = Math.abs(
    pickNumber(fill, ["qty", "quantity", "size", "volume", "filledQty"]) ?? 0
  );
  const price = pickNumber(fill, ["price", "fillPrice", "avgPrice", "averagePrice"]);
  const time = pickDate(fill, [
    "timestamp",
    "tradeDate",
    "createdTimestamp",
    "time",
    "executionTime",
  ]);
  const symbol =
    pickString(fill, ["symbol", "contractName", "instrument", "product", "name"]) ??
    (order
      ? pickString(order, ["symbol", "contractName", "instrument", "product", "name"])
      : null);

  if (!side || !symbol || volume <= 0 || price == null || !time) {
    return null;
  }

  const positionId =
    pickString(fill, ["positionId", "positionID"]) ??
    (pickNumber(fill, ["positionId", "positionID"]) != null
      ? String(pickNumber(fill, ["positionId", "positionID"]))
      : null);

  return {
    id:
      pickString(fill, ["id", "fillId", "fillID"]) ??
      `tradovate-fill-${symbol}-${time.toISOString()}-${orderId ?? "order"}`,
    groupKey: positionId ? `position:${positionId}` : `symbol:${symbol}`,
    symbol,
    side,
    volume,
    price,
    time,
    profit: pickNumber(fill, [
      "profit",
      "pnl",
      "realizedPnl",
      "netProfit",
      "profitLoss",
    ]),
    commission: coalesce(
      pickNumber(fill, ["commission", "commissions"]),
      pickNumber(fill, ["fee", "fees", "executionFee"])
    ),
    swap: pickNumber(fill, ["swap"]),
    comment:
      pickString(fill, ["text", "comment"]) ??
      (order ? pickString(order, ["text", "comment"]) : null),
    raw: {
      fill,
      order,
    },
  };
}

function mapTradovatePosition(
  position: Record<string, unknown>
): NormalizedPosition | null {
  const rawSize = coalesce(
    pickNumber(position, ["netPos", "qty", "quantity", "size"]),
    pickNumber(position, ["netPosition"])
  );

  if (rawSize == null || rawSize === 0) {
    return null;
  }

  const symbol = pickString(position, [
    "symbol",
    "contractName",
    "instrument",
    "product",
    "name",
  ]);
  const openTime = pickDate(position, [
    "openTimestamp",
    "createdTimestamp",
    "entryTimestamp",
    "time",
  ]);
  const openPrice = coalesce(
    pickNumber(position, ["averagePrice", "avgPrice"]),
    pickNumber(position, ["openPrice", "entryPrice"])
  );

  if (!symbol || !openTime || openPrice == null) {
    return null;
  }

  return {
    ticket:
      pickString(position, ["id", "positionId", "positionID"]) ??
      `${symbol}-${openTime.toISOString()}`,
    symbol,
    tradeType: rawSize > 0 ? "long" : "short",
    volume: Math.abs(rawSize),
    openPrice,
    openTime,
    currentPrice: coalesce(
      pickNumber(position, ["currentPrice", "lastPrice", "marketPrice"]),
      pickNumber(position, ["markPrice"])
    ),
    profit: coalesce(
      pickNumber(position, ["unrealizedPnl", "profit", "pnl"]),
      pickNumber(position, ["netProfit"])
    ),
    sl: pickNumber(position, ["stopLoss", "stopPrice"]),
    tp: pickNumber(position, ["takeProfit", "targetPrice"]),
    swap: pickNumber(position, ["swap"]),
    _raw: position,
  };
}

function mapTradovateClosedPositionTrade(
  position: Record<string, unknown>
): NormalizedTrade | null {
  const closeTime = pickDate(position, [
    "closeTimestamp",
    "closedTimestamp",
    "exitTimestamp",
  ]);
  const ticket =
    pickString(position, ["id", "positionId", "positionID"]) ??
    `tradovate-position-${closeTime?.toISOString() ?? "unknown"}`;
  const symbol = pickString(position, [
    "symbol",
    "contractName",
    "instrument",
    "product",
    "name",
  ]);
  const openTime = pickDate(position, [
    "openTimestamp",
    "createdTimestamp",
    "entryTimestamp",
  ]);
  const openPrice = coalesce(
    pickNumber(position, ["averagePrice", "avgPrice"]),
    pickNumber(position, ["openPrice", "entryPrice"])
  );
  const closePrice = coalesce(
    pickNumber(position, ["closePrice", "exitPrice"]),
    pickNumber(position, ["averageExitPrice", "avgExitPrice"])
  );
  const volume = Math.abs(
    pickNumber(position, ["closedQty", "qty", "quantity", "size"]) ?? 0
  );

  if (!closeTime || !symbol || !openTime || openPrice == null || closePrice == null || volume <= 0) {
    return null;
  }

  const tradeType =
    parseTradovateTradeSide(position) === "sell" ||
    (pickNumber(position, ["netPos", "qty", "size"]) ?? 0) < 0
      ? "short"
      : "long";

  return {
    ticket,
    symbol,
    tradeType,
    volume,
    openPrice,
    closePrice,
    openTime,
    closeTime,
    profit: Number(
      coalesce(
        pickNumber(position, ["realizedPnl", "profit", "pnl"]),
        pickNumber(position, ["netProfit"]),
        0
      ) ?? 0
    ),
    sl: pickNumber(position, ["stopLoss", "stopPrice"]),
    tp: pickNumber(position, ["takeProfit", "targetPrice"]),
    swap: pickNumber(position, ["swap"]),
    commissions: coalesce(
      pickNumber(position, ["commission", "commissions"]),
      pickNumber(position, ["fee", "fees"])
    ),
    pips: null,
    comment: pickString(position, ["text", "comment"]),
    _raw: position,
  };
}

function resolveTradovateAccountId(meta: Record<string, unknown>): string | null {
  return (
    pickString(meta, ["tradovateAccountId"]) ??
    pickString(meta, ["providerAccountId"]) ??
    null
  );
}

function dedupeTrades(trades: NormalizedTrade[]): NormalizedTrade[] {
  const seen = new Map<string, NormalizedTrade>();

  for (const trade of trades) {
    if (!seen.has(trade.ticket)) {
      seen.set(trade.ticket, trade);
    }
  }

  return [...seen.values()].sort(
    (left, right) => left.closeTime.getTime() - right.closeTime.getTime()
  );
}

export class TradovateProvider implements TradingProvider {
  async exchangeCode(
    code: string,
    redirectUri: string
  ): Promise<ProviderCredentials> {
    const env = getServerEnv();
    const response = await fetch(buildTradovateUrl("auth/oauthtoken"), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: env.TRADOVATE_CLIENT_ID!,
        client_secret: env.TRADOVATE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        code,
      }),
    });

    const data = (await response.json().catch(() => null)) as
      | TradovateTokenResponse
      | null;

    if (!response.ok || !data?.access_token) {
      throw new Error(
        extractErrorMessage(
          data,
          `Tradovate token exchange failed: ${response.status}`
        )
      );
    }

    return {
      accessToken: data.access_token,
      ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
      ...(typeof data.expires_in === "number"
        ? {
            expiresAt: new Date(
              Date.now() + data.expires_in * 1000
            ).toISOString(),
          }
        : {}),
      ...(data.userId != null ? { userId: String(data.userId) } : {}),
    };
  }

  async refreshToken(
    credentials: ProviderCredentials
  ): Promise<ProviderCredentials> {
    const env = getServerEnv();
    if (!credentials.refreshToken) {
      throw new Error("Tradovate refresh token is missing");
    }

    const response = await fetch(buildTradovateUrl("auth/oauthtoken"), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: env.TRADOVATE_CLIENT_ID!,
        client_secret: env.TRADOVATE_CLIENT_SECRET!,
        refresh_token: credentials.refreshToken,
      }),
    });

    const data = (await response.json().catch(() => null)) as
      | TradovateTokenResponse
      | null;

    if (!response.ok || !data?.access_token) {
      throw new Error(
        extractErrorMessage(
          data,
          `Tradovate token refresh failed: ${response.status}`
        )
      );
    }

    return {
      ...credentials,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? credentials.refreshToken,
      ...(typeof data.expires_in === "number"
        ? {
            expiresAt: new Date(
              Date.now() + data.expires_in * 1000
            ).toISOString(),
          }
        : {}),
      ...(data.userId != null ? { userId: String(data.userId) } : {}),
    };
  }

  async listAuthorizedAccounts(
    credentials: ProviderCredentials
  ): Promise<ProviderAuthorizedAccount[]> {
    const accessToken = credentials.accessToken;
    if (!accessToken) {
      throw new Error("Tradovate access token is missing");
    }

    const [me, accounts] = await Promise.all([
      this.fetchMe(accessToken),
      this.fetchAccounts(accessToken),
    ]);

    return accounts
      .filter((account) => pickString(account, ["id"]) || pickNumber(account, ["id"]) != null)
      .map((account) => {
        const providerAccountId =
          pickString(account, ["id"]) ?? String(pickNumber(account, ["id"])!);
        const label =
          pickString(account, ["nickname", "name"]) ??
          `Tradovate ${providerAccountId}`;

        return {
          providerAccountId,
          accountNumber: pickString(account, ["name", "nickname"]),
          label,
          brokerName: "Tradovate",
          currency: pickString(account, ["currency"]),
          environment: "unknown",
          metadata: {
            accountType: pickString(account, ["accountType", "accountTypeName"]),
            active: pickBoolean(account, ["active"]),
            clearingHouseId: pickString(account, ["clearingHouseId"]),
            userId:
              pickString(me, ["userId"]) ??
              String(pickNumber(me, ["userId"]) ?? credentials.userId ?? ""),
            fullName: pickString(me, ["fullName", "name"]),
          },
        } satisfies ProviderAuthorizedAccount;
      });
  }

  async connect(config: ProviderConfig): Promise<NormalizedAccountInfo> {
    return this.fetchAccountInfo(config, config.meta);
  }

  async disconnect(): Promise<void> {
    return;
  }

  async fetchHistory(
    config: ProviderConfig,
    since: Date | null,
    accountMeta: Record<string, unknown>
  ): Promise<NormalizedTrade[]> {
    const accessToken = config.credentials.accessToken;
    if (!accessToken) {
      throw new Error("Tradovate access token is missing");
    }

    const accountId = resolveTradovateAccountId(accountMeta);
    if (!accountId) {
      throw new Error("Tradovate account is not selected for this connection");
    }

    const [fills, orders, positions] = await Promise.all([
      this.fetchEntityList("fill/list", accessToken, { accountId }),
      this.fetchEntityList("order/list", accessToken, { accountId }),
      this.fetchEntityList("position/list", accessToken, { accountId }),
    ]);

    const orderMap = new Map<string, Record<string, unknown>>();
    for (const order of orders) {
      const orderId =
        pickString(order, ["id", "orderId", "orderID"]) ??
        (pickNumber(order, ["id", "orderId", "orderID"]) != null
          ? String(pickNumber(order, ["id", "orderId", "orderID"]))
          : null);
      if (orderId) {
        orderMap.set(orderId, order);
      }
    }

    const reconstructedTrades = reconstructRoundTripsFromFills(
      fills
        .map((fill) => normalizeExecutionFill(fill, orderMap))
        .filter((fill): fill is ExecutionFillSeed => Boolean(fill))
    );

    const filteredReconstructedTrades = reconstructedTrades.filter(
      (trade) => !since || trade.closeTime > since
    );
    if (filteredReconstructedTrades.length > 0) {
      return filteredReconstructedTrades;
    }

    return dedupeTrades(
      positions
        .map(mapTradovateClosedPositionTrade)
        .filter((trade): trade is NormalizedTrade => Boolean(trade))
        .filter((trade) => !since || trade.closeTime > since)
    );
  }

  async fetchOpenPositions(
    config: ProviderConfig,
    accountMeta: Record<string, unknown>
  ): Promise<NormalizedPosition[]> {
    const accessToken = config.credentials.accessToken;
    if (!accessToken) {
      throw new Error("Tradovate access token is missing");
    }

    const accountId = resolveTradovateAccountId(accountMeta);
    if (!accountId) {
      return [];
    }

    const positions = await this.fetchEntityList("position/list", accessToken, {
      accountId,
    });

    return positions
      .map(mapTradovatePosition)
      .filter((position): position is NormalizedPosition => Boolean(position));
  }

  async fetchAccountInfo(
    config: ProviderConfig,
    accountMeta: Record<string, unknown>
  ): Promise<NormalizedAccountInfo> {
    const accessToken = config.credentials.accessToken;
    if (!accessToken) {
      throw new Error("Tradovate access token is missing");
    }

    const accountId = resolveTradovateAccountId(accountMeta);
    if (!accountId) {
      const accounts = await this.fetchAccounts(accessToken);
      const firstAccount = accounts[0] ?? null;

      return {
        balance: pickNumber(firstAccount ?? {}, ["balance"]) ?? 0,
        equity:
          pickNumber(firstAccount ?? {}, ["equity"]) ??
          pickNumber(firstAccount ?? {}, ["balance"]) ??
          0,
        currency: pickString(firstAccount ?? {}, ["currency"]) ?? "USD",
        leverage: pickNumber(firstAccount ?? {}, ["leverage"]),
        freeMargin: pickNumber(firstAccount ?? {}, ["freeMargin", "availableFunds"]),
        margin: pickNumber(firstAccount ?? {}, ["margin", "usedMargin"]),
        login: pickString(firstAccount ?? {}, ["name", "id"]),
        serverName: getTradovateApiBaseUrl(),
        brokerName: "Tradovate",
      };
    }

    const [accountItem, cashBalances] = await Promise.all([
      this.fetchEntity("account/item", accessToken, { id: accountId }),
      this.fetchEntityList("cashBalance/list", accessToken, { accountId }),
    ]);

    const latestCashBalance = cashBalances.at(-1) ?? null;

    const balance = Number(
      coalesce(
        accountItem ? pickNumber(accountItem, ["balance", "cashBalance", "cash"]) : null,
        latestCashBalance
          ? pickNumber(latestCashBalance, ["balance", "cashBalance", "netCash"])
          : null,
        0
      ) ?? 0
    );
    const equity = Number(
      coalesce(
        accountItem ? pickNumber(accountItem, ["equity", "netLiq", "liquidationValue"]) : null,
        latestCashBalance
          ? pickNumber(latestCashBalance, ["equity", "netLiq", "liquidationValue"])
          : null,
        balance
      ) ?? 0
    );

    return {
      balance,
      equity,
      currency:
        coalesce(
          accountItem ? pickString(accountItem, ["currency", "currencyCode"]) : null,
          latestCashBalance
            ? pickString(latestCashBalance, ["currency", "currencyCode"])
            : null,
          accountMeta.currency != null ? String(accountMeta.currency) : null,
          "USD"
        ) ?? "USD",
      leverage: accountItem ? pickNumber(accountItem, ["leverage"]) : null,
      freeMargin: coalesce(
        accountItem ? pickNumber(accountItem, ["freeMargin", "availableFunds"]) : null,
        latestCashBalance
          ? pickNumber(latestCashBalance, ["availableFunds", "freeMargin"])
          : null
      ),
      margin: coalesce(
        accountItem ? pickNumber(accountItem, ["margin", "usedMargin"]) : null,
        latestCashBalance
          ? pickNumber(latestCashBalance, ["margin", "usedMargin", "initialMargin"])
          : null
      ),
      login:
        (accountItem ? pickString(accountItem, ["name", "id"]) : null) ?? accountId,
      serverName: getTradovateApiBaseUrl(),
      brokerName: "Tradovate",
    };
  }

  private async fetchMe(accessToken: string): Promise<Record<string, unknown>> {
    return (await this.fetchJson("auth/me", accessToken)) as Record<string, unknown>;
  }

  private async fetchAccounts(
    accessToken: string
  ): Promise<Record<string, unknown>[]> {
    return this.fetchEntityList("account/list", accessToken);
  }

  private async fetchEntity(
    path: string,
    accessToken: string,
    params?: Record<string, string>
  ): Promise<Record<string, unknown> | null> {
    const data = await this.fetchJson(path, accessToken, params);
    const records = extractRecordList(data);
    if (records.length > 0) {
      return records[0] ?? null;
    }

    return data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;
  }

  private async fetchEntityList(
    path: string,
    accessToken: string,
    params?: Record<string, string>
  ): Promise<Record<string, unknown>[]> {
    const data = await this.fetchJson(path, accessToken, params);
    return extractRecordList(data, ["d"]);
  }

  private async fetchJson(
    path: string,
    accessToken: string,
    params?: Record<string, string>
  ): Promise<unknown> {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value) {
        searchParams.set(key, value);
      }
    }

    const response = await fetch(buildTradovateUrl(path, searchParams), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        extractErrorMessage(data, `Tradovate ${path} failed: ${response.status}`)
      );
    }

    return data;
  }
}

export function getTradovateAuthUrl(state: string): string {
  const env = getServerEnv();
  const url = new URL(
    env.TRADOVATE_OAUTH_URL || "https://trader.tradovate.com/oauth"
  );
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", env.TRADOVATE_CLIENT_ID!);
  url.searchParams.set("redirect_uri", env.TRADOVATE_REDIRECT_URI!);
  url.searchParams.set("state", state);
  return url.toString();
}

export function getTradovateApiBaseUrl() {
  const env = getServerEnv();
  return (
    env.TRADOVATE_API_BASE_URL?.replace(/\/$/, "") ||
    "https://live.tradovateapi.com"
  );
}
