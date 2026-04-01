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
  pickDate,
  pickNumber,
  pickString,
} from "./provider-utils";
import {
  reconstructRoundTripsFromFills,
  type ExecutionFillSeed,
} from "./round-trip-reconstructor";

export const TOPSTEPX_PROVIDER_INFO = {
  name: "TopstepX",
  description:
    "ProjectX / TopstepX futures sync using API-key authentication and account discovery.",
  authType: "api_key",
  fields: ["username", "apiKey"],
  status: "active",
  capabilities: {
    connect: {
      supported: true,
      readiness: "implemented",
      note: "TopstepX API-key authentication and account validation are supported.",
    },
    disconnect: {
      supported: true,
      readiness: "implemented",
      note: "TopstepX is stateless between sync runs.",
    },
    fetchHistory: {
      supported: true,
      readiness: "implemented",
      note: "TopstepX trade history reconstructs round trips from ProjectX execution fills.",
    },
    fetchOpenPositions: {
      supported: true,
      readiness: "implemented",
      note: "TopstepX open-position polling is supported.",
    },
    fetchAccountInfo: {
      supported: true,
      readiness: "implemented",
      note: "TopstepX account snapshots are supported.",
    },
    exchangeCode: {
      supported: false,
      readiness: "planned",
      note: "TopstepX uses API-key authentication instead of OAuth.",
    },
    refreshToken: {
      supported: false,
      readiness: "planned",
      note: "TopstepX issues short-lived session tokens by re-authenticating with the API key.",
    },
  },
} as const;

type TopstepXTradeRecord = Record<string, unknown>;
type TopstepXContractMap = Map<string, Record<string, unknown>>;

function resolveTopstepXUsername(credentials: ProviderCredentials): string | null {
  return credentials.username ?? credentials.userName ?? credentials.login ?? null;
}

function resolveTopstepXAccountId(meta: Record<string, unknown>): string | null {
  return pickString(meta, ["topstepxAccountId"]) ?? null;
}

function mapTopstepXTradeSide(value: unknown): "buy" | "sell" | null {
  if (typeof value === "number") {
    if (value === 0) return "buy";
    if (value === 1) return "sell";
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (["buy", "bid", "long", "0"].includes(normalized)) {
    return "buy";
  }
  if (["sell", "ask", "short", "1"].includes(normalized)) {
    return "sell";
  }
  return null;
}

function buildTopstepXFill(
  trade: TopstepXTradeRecord,
  contractMap: TopstepXContractMap
): ExecutionFillSeed | null {
  const contractId = pickString(trade, ["contractId", "symbolId"]);
  const contract = contractId ? contractMap.get(contractId) ?? null : null;
  const symbol =
    (contract
      ? pickString(contract, ["name", "description", "id"])
      : null) ?? contractId;
  const side = mapTopstepXTradeSide(
    pickString(trade, ["side", "direction", "action"]) ??
      pickNumber(trade, ["side"])
  );
  const volume = Math.abs(pickNumber(trade, ["size", "quantity", "volume"]) ?? 0);
  const price = pickNumber(trade, ["price", "averagePrice", "fillPrice"]);
  const time = pickDate(trade, ["creationTimestamp", "time", "timestamp"]);

  if (!symbol || !side || volume <= 0 || price == null || !time) {
    return null;
  }

  return {
    id:
      pickString(trade, ["id", "tradeId", "orderId"]) ??
      `${symbol}-${time.toISOString()}-${price}`,
    groupKey: contractId ?? `symbol:${symbol}`,
    symbol,
    side,
    volume,
    price,
    time,
    profit: pickNumber(trade, ["profitAndLoss", "profit", "pnl"]),
    commission: coalesce(
      pickNumber(trade, ["fees", "commission"]),
      pickNumber(trade, ["fee"])
    ),
    swap: null,
    comment: null,
    raw: {
      trade,
      contract,
    },
  };
}

export class TopstepXProvider implements TradingProvider {
  async connect(config: ProviderConfig): Promise<NormalizedAccountInfo> {
    return this.fetchAccountInfo(config, config.meta);
  }

  async disconnect(): Promise<void> {
    return;
  }

  async listAuthorizedAccounts(
    credentials: ProviderCredentials
  ): Promise<ProviderAuthorizedAccount[]> {
    const token = await this.authenticate(credentials);
    const accounts = await this.fetchAccounts(token);

    return accounts.map((account) => {
      const providerAccountId =
        pickString(account, ["id"]) ?? String(pickNumber(account, ["id"]) ?? "");

      return {
        providerAccountId,
        accountNumber:
          pickString(account, ["name", "accountNumber", "accountCode"]) ??
          providerAccountId,
        label:
          pickString(account, ["name", "accountNumber", "accountCode"]) ??
          providerAccountId,
        brokerName: "TopstepX",
        currency: pickString(account, ["currency", "currencyCode"]),
        environment: "unknown",
        metadata: account,
      } satisfies ProviderAuthorizedAccount;
    });
  }

  async fetchHistory(
    config: ProviderConfig,
    since: Date | null,
    accountMeta: Record<string, unknown>
  ): Promise<NormalizedTrade[]> {
    const token = await this.authenticate(config.credentials);
    const accounts = await this.fetchAccounts(token);
    const accountId =
      resolveTopstepXAccountId(accountMeta) ??
      (pickString(accounts[0] ?? {}, ["id"]) ??
        String(pickNumber(accounts[0] ?? {}, ["id"]) ?? ""));

    if (!accountId) {
      return [];
    }

    const startTimestamp = since
      ? new Date(since.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const endTimestamp = new Date().toISOString();

    const tradesResponse = await this.fetchJson(token, "Trade/search", {
      accountId: Number(accountId),
      startTimestamp,
      endTimestamp,
    });
    const tradeRows = extractRecordList(tradesResponse, ["trades", "data", "items"]);

    const contractMap = await this.loadContracts(
      token,
      tradeRows
        .map((trade) => pickString(trade, ["contractId", "symbolId"]))
        .filter((value): value is string => Boolean(value))
    );

    return reconstructRoundTripsFromFills(
      tradeRows
        .filter((trade) => !trade.voided)
        .map((trade) => buildTopstepXFill(trade, contractMap))
        .filter((fill): fill is ExecutionFillSeed => Boolean(fill))
    ).filter((trade) => !since || trade.closeTime > since);
  }

  async fetchOpenPositions(
    config: ProviderConfig,
    accountMeta: Record<string, unknown>
  ): Promise<NormalizedPosition[]> {
    const token = await this.authenticate(config.credentials);
    const accounts = await this.fetchAccounts(token);
    const accountId =
      resolveTopstepXAccountId(accountMeta) ??
      (pickString(accounts[0] ?? {}, ["id"]) ??
        String(pickNumber(accounts[0] ?? {}, ["id"]) ?? ""));

    if (!accountId) {
      return [];
    }

    const positionsResponse = await this.fetchJson(token, "Position/searchOpen", {
      accountId: Number(accountId),
    });
    const positionRows = extractRecordList(positionsResponse, [
      "positions",
      "data",
      "items",
    ]);
    const contractMap = await this.loadContracts(
      token,
      positionRows
        .map((position) => pickString(position, ["contractId", "symbolId"]))
        .filter((value): value is string => Boolean(value))
    );

    return positionRows.reduce<NormalizedPosition[]>((rows, position) => {
        const contractId = pickString(position, ["contractId", "symbolId"]);
        const contract = contractId ? contractMap.get(contractId) ?? null : null;
        const symbol =
          (contract
            ? pickString(contract, ["name", "description", "id"])
            : null) ?? contractId;
        const size = pickNumber(position, ["size", "quantity", "volume"]) ?? 0;
        const openTime = pickDate(position, ["creationTimestamp", "time"]);
        const openPrice = coalesce(
          pickNumber(position, ["averagePrice", "openPrice"]),
          pickNumber(position, ["entryPrice"])
        );

        if (!symbol || size === 0 || !openTime || openPrice == null) {
          return rows;
        }

        const normalizedPosition: NormalizedPosition = {
          ticket:
            pickString(position, ["id", "positionId"]) ??
            `${symbol}-${openTime.toISOString()}`,
          symbol,
          tradeType: size > 0 ? "long" : "short",
          volume: Math.abs(size),
          openPrice,
          openTime,
          currentPrice: null,
          profit: pickNumber(position, ["profit", "unrealizedPnl", "pnl"]),
          sl: null,
          tp: null,
          swap: null,
          _raw: {
            position,
            contract,
          },
        };

        rows.push(normalizedPosition);
        return rows;
      }, []);
  }

  async fetchAccountInfo(
    config: ProviderConfig,
    accountMeta: Record<string, unknown>
  ): Promise<NormalizedAccountInfo> {
    const token = await this.authenticate(config.credentials);
    const accounts = await this.fetchAccounts(token);

    const selectedAccountId =
      resolveTopstepXAccountId(accountMeta) ??
      (pickString(accounts[0] ?? {}, ["id"]) ??
        String(pickNumber(accounts[0] ?? {}, ["id"]) ?? ""));
    const selectedAccount =
      accounts.find((account) => {
        return (
          pickString(account, ["id"]) === selectedAccountId ||
          String(pickNumber(account, ["id"]) ?? "") === selectedAccountId
        );
      }) ??
      accounts[0] ??
      null;

    const balance = Number(
      coalesce(
        selectedAccount ? pickNumber(selectedAccount, ["balance", "cashBalance"]) : null,
        selectedAccount ? pickNumber(selectedAccount, ["netLiquidation", "equity"]) : null,
        0
      ) ?? 0
    );
    const equity = Number(
      coalesce(
        selectedAccount ? pickNumber(selectedAccount, ["equity", "netLiquidation"]) : null,
        balance
      ) ?? 0
    );

    return {
      balance,
      equity,
      currency:
        (selectedAccount
          ? pickString(selectedAccount, ["currency", "currencyCode"])
          : null) ?? "USD",
      leverage: selectedAccount ? pickNumber(selectedAccount, ["leverage"]) : null,
      freeMargin: selectedAccount
        ? pickNumber(selectedAccount, ["freeMargin", "availableFunds"])
        : null,
      margin: selectedAccount
        ? pickNumber(selectedAccount, ["margin", "usedMargin", "initialMargin"])
        : null,
      login:
        (selectedAccount
          ? pickString(selectedAccount, ["name", "accountNumber", "id"])
          : null) ?? selectedAccountId,
      serverName: getTopstepXApiBaseUrl(),
      brokerName: "TopstepX",
    };
  }

  private async authenticate(credentials: ProviderCredentials): Promise<string> {
    const username = resolveTopstepXUsername(credentials);
    const apiKey = credentials.apiKey;

    if (!username || !apiKey) {
      throw new Error("TopstepX username and apiKey are required");
    }

    const response = await fetch(`${getTopstepXApiBaseUrl()}/api/Auth/loginKey`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        userName: username,
        apiKey,
      }),
    });

    const data = (await response.json().catch(() => null)) as
      | Record<string, unknown>
      | null;
    if (!response.ok || !pickString(data ?? {}, ["token"])) {
      throw new Error(
        extractErrorMessage(
          data,
          `TopstepX authentication failed: ${response.status}`
        )
      );
    }

    return pickString(data ?? {}, ["token"])!;
  }

  private async fetchAccounts(token: string): Promise<Record<string, unknown>[]> {
    const response = await this.fetchJson(token, "Account/search", {
      onlyActiveAccounts: true,
    });
    return extractRecordList(response, ["accounts", "data", "items"]);
  }

  private async loadContracts(
    token: string,
    contractIds: string[]
  ): Promise<TopstepXContractMap> {
    const contractMap: TopstepXContractMap = new Map();

    await Promise.all(
      [...new Set(contractIds)].map(async (contractId) => {
        try {
          const response = await this.fetchJson(token, "Contract/searchById", {
            contractId,
            live: false,
          });
          const contract =
            (response && typeof response === "object" && !Array.isArray(response)
              ? (response as Record<string, unknown>).contract
              : null) ?? null;
          if (contract && typeof contract === "object" && !Array.isArray(contract)) {
            contractMap.set(contractId, contract as Record<string, unknown>);
          }
        } catch {
          contractMap.set(contractId, { id: contractId, name: contractId });
        }
      })
    );

    return contractMap;
  }

  private async fetchJson(
    token: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<unknown> {
    const response = await fetch(`${getTopstepXApiBaseUrl()}/api/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body ?? {}),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        extractErrorMessage(data, `TopstepX ${path} failed: ${response.status}`)
      );
    }

    return data;
  }
}

export function getTopstepXApiBaseUrl() {
  const env = getServerEnv() as ReturnType<typeof getServerEnv> & {
    TOPSTEPX_API_BASE_URL?: string;
  };

  return env.TOPSTEPX_API_BASE_URL?.replace(/\/$/, "") || "https://api.topstepx.com";
}
