import WebSocket from "ws";

import type {
  NormalizedAccountInfo,
  NormalizedPosition,
  NormalizedTrade,
  ProviderAuthorizedAccount,
  ProviderConfig,
  ProviderCredentials,
  TradingProvider,
} from "./types";
import {
  coalesce,
  extractErrorMessage,
  extractRecordList,
  getSetCookieValues,
  normalizeUrl,
  parseCookieHeader,
  pickDate,
  pickNumber,
  pickString,
  serializeCookies,
} from "./provider-utils";
import {
  reconstructRoundTripsFromFills,
  type ExecutionFillSeed,
} from "./round-trip-reconstructor";

export const DXTRADE_PROVIDER_INFO = {
  name: "DXTrade",
  description:
    "Session-based DXTrade sync with history, positions, account metrics, and account discovery.",
  authType: "credentials",
  fields: ["serverUrl", "login", "password"],
  status: "active",
  capabilities: {
    connect: {
      supported: true,
      readiness: "implemented",
      note: "DXTrade session authentication and account validation are supported.",
    },
    disconnect: {
      supported: true,
      readiness: "implemented",
      note: "DXTrade sessions are short-lived per sync run.",
    },
    fetchHistory: {
      supported: true,
      readiness: "implemented",
      note: "DXTrade history pulls use REST reports with flexible fallbacks per deployment.",
    },
    fetchOpenPositions: {
      supported: true,
      readiness: "implemented",
      note: "DXTrade open positions use REST when available and WebSocket snapshots otherwise.",
    },
    fetchAccountInfo: {
      supported: true,
      readiness: "implemented",
      note: "DXTrade account metrics use WebSocket snapshots with REST fallbacks.",
    },
    exchangeCode: {
      supported: false,
      readiness: "planned",
      note: "DXTrade does not use OAuth.",
    },
    refreshToken: {
      supported: false,
      readiness: "planned",
      note: "DXTrade re-authenticates with the stored credentials when needed.",
    },
  },
} as const;

type DxTradeSession = {
  baseUrl: string;
  cookies: Record<string, string>;
  csrf: string;
  accountId: string | null;
  atmosphereId: string | null;
};

type DxTradeSocketPayload = {
  accountId?: string | null;
  type?: string;
  body?: unknown;
};

const DXTRADE_WS_TYPES = {
  accounts: "ACCOUNTS",
  accountMetrics: "ACCOUNT_METRICS",
  positions: "POSITIONS",
  positionMetrics: "POSITION_METRICS",
} as const;

function buildAtmosphereQuery(atmosphereId?: string | null): string {
  const trackingId = atmosphereId ?? "0";
  return (
    `?X-Atmosphere-tracking-id=${trackingId}&X-Atmosphere-Framework=2.3.2-javascript` +
    `&X-Atmosphere-Transport=websocket&X-Atmosphere-TrackMessageSize=true` +
    `&Content-Type=text/x-gwt-rpc;%20charset=UTF-8&X-atmo-protocol=true` +
    `&sessionState=dx-new&guest-mode=false`
  );
}

function normalizeDxTradeBaseUrl(serverUrl: string): string {
  return normalizeUrl(serverUrl)
    .replace(/\/(dxsca-web|api)(\/.*)?$/i, "")
    .replace(/\/$/, "");
}

function parseDxTradeSide(value: unknown): "buy" | "sell" | null {
  if (typeof value === "number") {
    if (value > 0) return "buy";
    if (value < 0) return "sell";
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (["buy", "long", "bid", "b"].includes(normalized)) {
    return "buy";
  }
  if (["sell", "short", "ask", "s"].includes(normalized)) {
    return "sell";
  }
  return null;
}

function parseDxTradeSocketPayload(data: WebSocket.RawData): DxTradeSocketPayload | null {
  const raw = data.toString();
  const separatorIndex = raw.indexOf("|");
  if (separatorIndex === -1) {
    return null;
  }

  try {
    return JSON.parse(raw.slice(separatorIndex + 1)) as DxTradeSocketPayload;
  } catch {
    return null;
  }
}

function parseDxTradeAtmosphereId(data: WebSocket.RawData): string | null {
  const raw = data.toString();
  const parts = raw.split("|");
  if (parts.length >= 2 && /^[0-9a-f-]{36}$/i.test(parts[1] ?? "")) {
    return parts[1] ?? null;
  }
  return null;
}

function mapDirectDxTradeTrade(row: Record<string, unknown>): NormalizedTrade | null {
  const symbol = pickString(row, ["symbol", "instrument", "contract", "product"]);
  const openTime = pickDate(row, [
    "openTime",
    "entryTime",
    "creationTimestamp",
    "openedAt",
  ]);
  const closeTime = pickDate(row, [
    "closeTime",
    "exitTime",
    "updateTimestamp",
    "closedAt",
  ]);
  const openPrice = coalesce(
    pickNumber(row, ["openPrice", "entryPrice", "averageOpenPrice"]),
    pickNumber(row, ["price"])
  );
  const closePrice = coalesce(
    pickNumber(row, ["closePrice", "exitPrice", "averageClosePrice"]),
    pickNumber(row, ["averagePrice"])
  );
  const volume = Math.abs(
    pickNumber(row, ["quantity", "filledQuantity", "size", "volume"]) ?? 0
  );
  const tradeSide = parseDxTradeSide(
    pickString(row, ["side", "direction", "action", "tradeType"])
  );

  if (!symbol || !openTime || !closeTime || openPrice == null || closePrice == null || volume <= 0 || !tradeSide) {
    return null;
  }

  return {
    ticket:
      pickString(row, ["positionCode", "positionId", "orderCode", "orderId"]) ??
      `${symbol}-${closeTime.toISOString()}`,
    symbol,
    tradeType: tradeSide === "buy" ? "long" : "short",
    volume,
    openPrice,
    closePrice,
    openTime,
    closeTime,
    profit:
      coalesce(
        pickNumber(row, [
          "profit",
          "pnl",
          "pl",
          "netProfit",
          "profitAndLoss",
        ]),
        0
      ) ?? 0,
    sl: pickNumber(row, ["stopLoss", "sl"]),
    tp: pickNumber(row, ["takeProfit", "tp"]),
    swap: pickNumber(row, ["swap", "financing"]),
    commissions: coalesce(
      pickNumber(row, ["commission", "commissions"]),
      pickNumber(row, ["fee", "fees"])
    ),
    pips: null,
    comment: pickString(row, ["comment", "note"]),
    _raw: row,
  };
}

function mapDxTradeExecutionFill(row: Record<string, unknown>): ExecutionFillSeed | null {
  const symbol = pickString(row, ["symbol", "instrument", "contract", "product"]);
  const side = parseDxTradeSide(
    pickString(row, ["side", "direction", "action", "tradeType"])
  );
  const volume = Math.abs(
    pickNumber(row, ["filledQuantity", "quantity", "size", "volume"]) ?? 0
  );
  const price = coalesce(
    pickNumber(row, ["averagePrice", "price", "fillPrice"]),
    pickNumber(row, ["openPrice", "closePrice"])
  );
  const time = pickDate(row, [
    "time",
    "creationTimestamp",
    "updateTimestamp",
    "filledTime",
  ]);

  if (!symbol || !side || volume <= 0 || price == null || !time) {
    return null;
  }

  const groupKey =
    pickString(row, ["positionCode", "positionId", "uid"]) ?? `symbol:${symbol}`;

  return {
    id:
      pickString(row, ["tradeId", "fillId", "orderCode", "orderId"]) ??
      `${groupKey}:${time.toISOString()}:${price}`,
    groupKey,
    symbol,
    side,
    volume,
    price,
    time,
    profit: pickNumber(row, ["profit", "pnl", "pl", "profitAndLoss"]),
    commission: coalesce(
      pickNumber(row, ["commission", "commissions"]),
      pickNumber(row, ["fee", "fees"])
    ),
    swap: pickNumber(row, ["swap", "financing"]),
    comment: pickString(row, ["comment", "note"]),
    raw: row,
  };
}

function dedupeNormalizedTrades(trades: NormalizedTrade[]): NormalizedTrade[] {
  const byTicket = new Map<string, NormalizedTrade>();
  for (const trade of trades) {
    if (!byTicket.has(trade.ticket)) {
      byTicket.set(trade.ticket, trade);
    }
  }

  return [...byTicket.values()].sort(
    (left, right) => left.closeTime.getTime() - right.closeTime.getTime()
  );
}

export class DXTradeProvider implements TradingProvider {
  async connect(config: ProviderConfig): Promise<NormalizedAccountInfo> {
    return this.fetchAccountInfo(config, config.meta);
  }

  async disconnect(): Promise<void> {
    return;
  }

  async listAuthorizedAccounts(
    credentials: ProviderCredentials
  ): Promise<ProviderAuthorizedAccount[]> {
    const session = await this.createSession(credentials, {});

    const restAccounts = await this.fetchRestAccountList(session).catch(() => []);
    const accountRecords =
      restAccounts.length > 0
        ? restAccounts
        : await this.waitForRecordList(session, DXTRADE_WS_TYPES.accounts).catch(
            () => []
          );

    if (accountRecords.length === 0 && session.accountId) {
      return [
        {
          providerAccountId: session.accountId,
          accountNumber: session.accountId,
          label: session.accountId,
          brokerName: new URL(session.baseUrl).hostname,
          currency: null,
          environment: "unknown",
        },
      ];
    }

    return accountRecords.reduce<ProviderAuthorizedAccount[]>((rows, account) => {
        const providerAccountId =
          pickString(account, ["id", "accountId", "accountCode"]) ?? null;
        if (!providerAccountId) {
          return rows;
        }

        rows.push({
          providerAccountId,
          accountNumber:
            pickString(account, ["accountCode", "accountNumber", "userLogin"]) ??
            providerAccountId,
          label:
            pickString(account, ["name", "accountCode", "accountNumber"]) ??
            providerAccountId,
          brokerName:
            pickString(account, ["brokerName", "broker"]) ??
            new URL(session.baseUrl).hostname,
          currency: pickString(account, ["currency", "currencyCode"]),
          environment: "unknown",
          metadata: account,
        });
        return rows;
      }, []);
  }

  async fetchHistory(
    config: ProviderConfig,
    since: Date | null,
    accountMeta: Record<string, unknown>
  ): Promise<NormalizedTrade[]> {
    const session = await this.createSession(config.credentials, accountMeta);
    const from = since
      ? new Date(since.getTime() - 30 * 24 * 60 * 60 * 1000).getTime()
      : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).getTime();
    const to = Date.now();

    const [tradeJournalRows, tradeHistoryRows] = await Promise.all([
      this.fetchTradeJournal(session, from, to).catch(() => []),
      this.fetchTradeHistory(session, from, to).catch(() => []),
    ]);

    const directTrades = dedupeNormalizedTrades(
      [...tradeJournalRows, ...tradeHistoryRows]
        .map(mapDirectDxTradeTrade)
        .filter((trade): trade is NormalizedTrade => Boolean(trade))
        .filter((trade) => !since || trade.closeTime > since)
    );
    if (directTrades.length > 0) {
      return directTrades;
    }

    return reconstructRoundTripsFromFills(
      [...tradeJournalRows, ...tradeHistoryRows]
        .map(mapDxTradeExecutionFill)
        .filter((fill): fill is ExecutionFillSeed => Boolean(fill))
    ).filter((trade) => !since || trade.closeTime > since);
  }

  async fetchOpenPositions(
    config: ProviderConfig,
    accountMeta: Record<string, unknown>
  ): Promise<NormalizedPosition[]> {
    const session = await this.createSession(config.credentials, accountMeta);

    const restPositions = await this.fetchRestPositions(session).catch(() => []);
    if (restPositions.length > 0) {
      return restPositions.reduce<NormalizedPosition[]>((rows, position) => {
        const normalized = this.mapRestPosition(position);
        if (normalized) {
          rows.push(normalized);
        }
        return rows;
      }, []);
    }

    const [positions, positionMetrics] = await Promise.all([
      this.waitForRecordList(session, DXTRADE_WS_TYPES.positions),
      this.waitForRecordList(session, DXTRADE_WS_TYPES.positionMetrics),
    ]);
    const metricsByUid = new Map(
      positionMetrics.map((metric) => [pickString(metric, ["uid"]), metric])
    );

    return positions.reduce<NormalizedPosition[]>((rows, position) => {
        const uid = pickString(position, ["uid"]);
        const metric = uid ? metricsByUid.get(uid) ?? null : null;
        const quantity = pickNumber(position, ["quantity"]) ?? 0;
        if (quantity === 0) {
          return rows;
        }

        const symbol =
          pickString(position, ["symbol", "instrument", "contract"]) ??
          pickString(
            (position.positionKey as Record<string, unknown>) ?? {},
            ["positionCode"]
          );
        const openTime = pickDate(position, ["time", "modifiedTime"]);
        const openPrice = coalesce(
          metric ? pickNumber(metric, ["averagePrice"]) : null,
          pickNumber(position, ["averagePrice", "costBasis"])
        );

        if (!symbol || !openTime || openPrice == null) {
          return rows;
        }

        const currentPrice =
          metric && quantity !== 0
            ? (pickNumber(metric, ["marketValue"]) ?? 0) / quantity
            : null;

        rows.push({
          ticket:
            pickString(
              (position.positionKey as Record<string, unknown>) ?? {},
              ["positionCode"]
            ) ?? uid ?? `${symbol}-${openTime.toISOString()}`,
          symbol,
          tradeType: quantity > 0 ? "long" : "short",
          volume: Math.abs(quantity),
          openPrice,
          openTime,
          currentPrice,
          profit: metric ? pickNumber(metric, ["plOpen"]) : null,
          sl: pickNumber(position, ["stopLoss"]),
          tp: pickNumber(position, ["takeProfit"]),
          swap: metric ? pickNumber(metric, ["totalFinancing"]) : null,
          _raw: {
            position,
            metric,
          },
        });
        return rows;
      }, []);
  }

  async fetchAccountInfo(
    config: ProviderConfig,
    accountMeta: Record<string, unknown>
  ): Promise<NormalizedAccountInfo> {
    const session = await this.createSession(config.credentials, accountMeta);

    const restAccount = await this.fetchRestAccountInfo(session).catch(() => null);
    const metrics = await this.waitForRecord(session, DXTRADE_WS_TYPES.accountMetrics);
    const accounts = await this.waitForRecordList(session, DXTRADE_WS_TYPES.accounts).catch(
      () => []
    );
    const selectedAccount =
      accounts.find((account) => {
        return (
          pickString(account, ["id", "accountId", "accountCode"]) ===
          session.accountId
        );
      }) ??
      restAccount ??
      null;

    const balance =
      coalesce(
        pickNumber(metrics ?? {}, ["cashBalance", "availableBalance"]),
        selectedAccount ? pickNumber(selectedAccount, ["balance", "cashBalance"]) : null,
        0
      ) ?? 0;
    const equity =
      coalesce(
        pickNumber(metrics ?? {}, ["equity"]),
        selectedAccount ? pickNumber(selectedAccount, ["equity"]) : null,
        balance
      ) ?? 0;

    return {
      balance,
      equity,
      currency:
        (selectedAccount
          ? pickString(selectedAccount, ["currency", "currencyCode"])
          : null) ?? "USD",
      leverage: selectedAccount ? pickNumber(selectedAccount, ["leverage"]) : null,
      freeMargin: pickNumber(metrics ?? {}, ["availableFunds", "availableBalance"]),
      margin: coalesce(
        pickNumber(metrics ?? {}, ["initialMargin", "margin"]),
        selectedAccount ? pickNumber(selectedAccount, ["margin", "usedMargin"]) : null
      ),
      login:
        (selectedAccount
          ? pickString(selectedAccount, ["accountCode", "userLogin", "name"])
          : null) ?? session.accountId,
      serverName: session.baseUrl,
      brokerName:
        (selectedAccount
          ? pickString(selectedAccount, ["brokerName", "broker"])
          : null) ?? new URL(session.baseUrl).hostname,
    };
  }

  private async createSession(
    credentials: ProviderCredentials,
    accountMeta: Record<string, unknown>
  ): Promise<DxTradeSession> {
    const baseUrl = normalizeDxTradeBaseUrl(credentials.serverUrl ?? "");
    const login = credentials.login;
    const password = credentials.password;

    if (!baseUrl || !login || !password) {
      throw new Error("DXTrade serverUrl, login, and password are required");
    }

    let cookies = await this.preflight(baseUrl);
    cookies = await this.login(baseUrl, login, password, cookies);
    const csrfResult = await this.fetchCsrf(baseUrl, cookies);
    cookies = csrfResult.cookies;

    const handshake = await this.performHandshake(baseUrl, cookies);
    const session: DxTradeSession = {
      baseUrl,
      cookies,
      csrf: csrfResult.csrf,
      accountId: handshake.accountId,
      atmosphereId: handshake.atmosphereId,
    };

    const selectedAccountId =
      pickString(accountMeta, ["dxtradeAccountId"]) ?? session.accountId;
    if (selectedAccountId && selectedAccountId !== session.accountId) {
      await this.switchAccount(session, selectedAccountId);
      const switchedHandshake = await this.performHandshake(baseUrl, session.cookies, {
        atmosphereId: session.atmosphereId,
      });
      session.accountId = switchedHandshake.accountId ?? selectedAccountId;
      session.atmosphereId = switchedHandshake.atmosphereId;
    }

    return session;
  }

  private async preflight(baseUrl: string): Promise<Record<string, string>> {
    try {
      const response = await fetch(baseUrl, {
        headers: this.baseHeaders(baseUrl),
      });
      return parseCookieHeader(getSetCookieValues(response.headers));
    } catch {
      return {};
    }
  }

  private async login(
    baseUrl: string,
    login: string,
    password: string,
    existingCookies: Record<string, string>
  ): Promise<Record<string, string>> {
    const domains = this.buildDomainCandidates(baseUrl);
    const loginAttempts = [
      {
        path: "/api/auth/login",
        body: (domain: string) => ({
          username: login,
          password,
          vendor: domain,
          domain,
        }),
      },
      {
        path: "/dxsca-web/login",
        body: (domain: string) => ({
          username: login,
          password,
          domain,
        }),
      },
    ];

    let lastError: Error | null = null;

    for (const attempt of loginAttempts) {
      for (const domain of domains) {
        try {
          const response = await fetch(`${baseUrl}${attempt.path}`, {
            method: "POST",
            headers: {
              ...this.baseHeaders(baseUrl),
              Origin: baseUrl,
              Referer: `${baseUrl}/`,
              Cookie: serializeCookies(existingCookies),
            },
            body: JSON.stringify(attempt.body(domain)),
          });

          if (!response.ok) {
            const responseBody = await response.text().catch(() => "");
            throw new Error(
              extractErrorMessage(
                responseBody,
                `DXTrade login failed: ${response.status}`
              )
            );
          }

          return {
            ...existingCookies,
            ...parseCookieHeader(getSetCookieValues(response.headers)),
          };
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
        }
      }
    }

    throw lastError ?? new Error("DXTrade login failed");
  }

  private async fetchCsrf(
    baseUrl: string,
    cookies: Record<string, string>
  ): Promise<{ csrf: string; cookies: Record<string, string> }> {
    const response = await fetch(baseUrl, {
      headers: {
        Cookie: serializeCookies(cookies),
        Referer: baseUrl,
      },
    });
    const nextCookies = {
      ...cookies,
      ...parseCookieHeader(getSetCookieValues(response.headers)),
    };
    const body = await response.text().catch(() => "");
    const match = body.match(/name="csrf" content="([^"]+)"/i);
    if (!match?.[1]) {
      throw new Error("DXTrade CSRF token not found");
    }

    return {
      csrf: match[1],
      cookies: nextCookies,
    };
  }

  private async performHandshake(
    baseUrl: string,
    cookies: Record<string, string>,
    options: { atmosphereId?: string | null } = {}
  ): Promise<{ atmosphereId: string | null; accountId: string | null }> {
    return await new Promise((resolve, reject) => {
      const wsUrl = this.buildWebSocketUrl(baseUrl, options.atmosphereId);
      const socket = new WebSocket(wsUrl, {
        headers: {
          Cookie: serializeCookies(cookies),
        },
      });
      let atmosphereId = options.atmosphereId ?? null;

      const timer = setTimeout(() => {
        socket.close();
        reject(new Error("DXTrade WebSocket handshake timed out"));
      }, 30_000);

      socket.on("message", (data) => {
        atmosphereId ??= parseDxTradeAtmosphereId(data);
        const payload = parseDxTradeSocketPayload(data);
        if (payload?.accountId) {
          clearTimeout(timer);
          socket.close();
          resolve({
            atmosphereId,
            accountId: payload.accountId ?? null,
          });
        }
      });

      socket.on("error", (error) => {
        clearTimeout(timer);
        socket.close();
        reject(error);
      });
    });
  }

  private async switchAccount(
    session: DxTradeSession,
    accountId: string
  ): Promise<void> {
    const response = await fetch(
      `${session.baseUrl}/api/accounts/switch?accountId=${encodeURIComponent(accountId)}`,
      {
        method: "POST",
        headers: this.authHeaders(session),
      }
    );

    if (!response.ok) {
      const data = await response.text().catch(() => "");
      throw new Error(
        extractErrorMessage(
          data,
          `DXTrade account switch failed: ${response.status}`
        )
      );
    }

    session.cookies = {
      ...session.cookies,
      ...parseCookieHeader(getSetCookieValues(response.headers)),
    };
    session.accountId = accountId;
  }

  private async waitForRecord(
    session: DxTradeSession,
    messageType: string
  ): Promise<Record<string, unknown> | null> {
    const payload = await this.waitForSocketMessages(session, [messageType]);
    const raw = payload[messageType];
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const record = raw as Record<string, unknown>;
      if (record.allMetrics && typeof record.allMetrics === "object") {
        return record.allMetrics as Record<string, unknown>;
      }
      return record;
    }

    const list = extractRecordList(raw, ["body"]);
    return list[0] ?? null;
  }

  private async waitForRecordList(
    session: DxTradeSession,
    messageType: string
  ): Promise<Record<string, unknown>[]> {
    const payload = await this.waitForSocketMessages(session, [messageType]);
    return extractRecordList(payload[messageType], ["body"]);
  }

  private async waitForSocketMessages(
    session: DxTradeSession,
    types: string[]
  ): Promise<Record<string, unknown>> {
    return await new Promise((resolve, reject) => {
      const pending = new Set(types);
      const results: Record<string, unknown> = {};
      const socket = new WebSocket(
        this.buildWebSocketUrl(session.baseUrl, session.atmosphereId),
        {
          headers: {
            Cookie: serializeCookies(session.cookies),
          },
        }
      );

      const timer = setTimeout(() => {
        socket.close();
        reject(
          new Error(
            `DXTrade WebSocket snapshot timed out waiting for ${types.join(", ")}`
          )
        );
      }, 30_000);

      socket.on("message", (data) => {
        const payload = parseDxTradeSocketPayload(data);
        if (!payload?.type || !pending.has(payload.type)) {
          return;
        }

        results[payload.type] = payload.body ?? null;
        pending.delete(payload.type);

        if (pending.size === 0) {
          clearTimeout(timer);
          socket.close();
          resolve(results);
        }
      });

      socket.on("error", (error) => {
        clearTimeout(timer);
        socket.close();
        reject(error);
      });
    });
  }

  private async fetchTradeHistory(
    session: DxTradeSession,
    from: number,
    to: number
  ): Promise<Record<string, unknown>[]> {
    const data = await this.fetchJsonFromCandidates(session, [
      {
        method: "POST",
        path: `/api/history?from=${from}&to=${to}`,
      },
      session.accountId
        ? {
            method: "GET",
            path: `/dxsca-web/accounts/${session.accountId}/trades?from=${from}&to=${to}`,
          }
        : null,
    ]);
    return extractRecordList(data, ["d", "data", "items"]);
  }

  private async fetchTradeJournal(
    session: DxTradeSession,
    from: number,
    to: number
  ): Promise<Record<string, unknown>[]> {
    const data = await this.fetchJsonFromCandidates(session, [
      {
        method: "GET",
        path: `/api/tradejournal?from=${from}&to=${to}`,
      },
      session.accountId
        ? {
            method: "GET",
            path: `/dxsca-web/accounts/${session.accountId}/trade-journal?from=${from}&to=${to}`,
          }
        : null,
    ]);
    return extractRecordList(data, ["d", "data", "items"]);
  }

  private async fetchRestAccountList(
    session: DxTradeSession
  ): Promise<Record<string, unknown>[]> {
    const data = await this.fetchJsonFromCandidates(session, [
      { method: "GET", path: "/api/accounts" },
      { method: "GET", path: "/dxsca-web/accounts" },
    ]);
    return extractRecordList(data, ["d", "data", "items", "accounts"]);
  }

  private async fetchRestAccountInfo(
    session: DxTradeSession
  ): Promise<Record<string, unknown> | null> {
    if (!session.accountId) {
      return null;
    }

    const data = await this.fetchJsonFromCandidates(session, [
      { method: "GET", path: `/dxsca-web/accounts/${session.accountId}` },
      { method: "GET", path: `/api/accounts/${session.accountId}` },
    ]);
    const records = extractRecordList(data, ["d", "data", "items"]);
    if (records.length > 0) {
      return records[0] ?? null;
    }

    return data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;
  }

  private async fetchRestPositions(
    session: DxTradeSession
  ): Promise<Record<string, unknown>[]> {
    if (!session.accountId) {
      return [];
    }

    const data = await this.fetchJsonFromCandidates(session, [
      { method: "GET", path: `/dxsca-web/accounts/${session.accountId}/positions` },
      { method: "GET", path: `/api/accounts/${session.accountId}/positions` },
    ]);
    return extractRecordList(data, ["d", "data", "items", "positions"]);
  }

  private async fetchJsonFromCandidates(
    session: DxTradeSession,
    candidates: Array<{ method: "GET" | "POST"; path: string } | null>
  ): Promise<unknown> {
    let lastError: Error | null = null;

    for (const candidate of candidates) {
      if (!candidate) {
        continue;
      }

      try {
        return await this.fetchJson(session, candidate.method, candidate.path);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    throw lastError ?? new Error("DXTrade request failed");
  }

  private async fetchJson(
    session: DxTradeSession,
    method: "GET" | "POST",
    path: string
  ): Promise<unknown> {
    const response = await fetch(`${session.baseUrl}${path}`, {
      method,
      headers: this.authHeaders(session),
    });

    const data = await response.json().catch(() => null);
    session.cookies = {
      ...session.cookies,
      ...parseCookieHeader(getSetCookieValues(response.headers)),
    };

    if (!response.ok) {
      throw new Error(
        extractErrorMessage(data, `DXTrade request failed: ${response.status}`)
      );
    }

    return data;
  }

  private buildWebSocketUrl(baseUrl: string, atmosphereId?: string | null) {
    const host = new URL(baseUrl).host;
    return `wss://${host}/client/connector${buildAtmosphereQuery(atmosphereId)}`;
  }

  private buildDomainCandidates(baseUrl: string): string[] {
    const host = new URL(baseUrl).hostname;
    const root = host.split(".")[0] ?? host;
    return [...new Set([host, root, host.toUpperCase(), root.toUpperCase()])];
  }

  private baseHeaders(baseUrl: string) {
    return {
      "Content-Type": "application/json; charset=UTF-8",
      Accept: "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Gecko/20100101 Firefox/147.0",
      Origin: baseUrl,
      Referer: `${baseUrl}/`,
    };
  }

  private authHeaders(session: DxTradeSession) {
    return {
      ...this.baseHeaders(session.baseUrl),
      "X-CSRF-Token": session.csrf,
      "X-Requested-With": "XMLHttpRequest",
      Cookie: serializeCookies(session.cookies),
    };
  }

  private mapRestPosition(
    position: Record<string, unknown>
  ): NormalizedPosition | null {
    const volume = Math.abs(
      pickNumber(position, ["quantity", "size", "volume"]) ?? 0
    );
    const openPrice = coalesce(
      pickNumber(position, ["averagePrice", "openPrice"]),
      pickNumber(position, ["entryPrice"])
    );
    const openTime = pickDate(position, ["time", "creationTimestamp", "openTime"]);
    const symbol = pickString(position, ["symbol", "instrument", "contract"]);
    const tradeType = parseDxTradeSide(
      pickString(position, ["side", "direction", "action"])
    );

    if (!symbol || !openTime || openPrice == null || volume <= 0) {
      return null;
    }

    return {
      ticket:
        pickString(position, ["positionCode", "positionId", "uid"]) ??
        `${symbol}-${openTime.toISOString()}`,
      symbol,
      tradeType:
        tradeType === "buy" ||
        ((tradeType == null &&
          (pickNumber(position, ["quantity", "size", "volume"]) ?? 0) >= 0))
          ? "long"
          : "short",
      volume,
      openPrice,
      openTime,
      currentPrice: pickNumber(position, ["currentPrice", "markPrice", "marketPrice"]),
      profit: coalesce(
        pickNumber(position, ["profit", "pnl", "plOpen"]),
        pickNumber(position, ["unrealizedPnl"])
      ),
      sl: pickNumber(position, ["stopLoss"]),
      tp: pickNumber(position, ["takeProfit"]),
      swap: pickNumber(position, ["swap", "financing"]),
      _raw: position,
    };
  }
}
