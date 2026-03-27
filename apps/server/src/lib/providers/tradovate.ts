/**
 * Tradovate OAuth + account discovery provider foundation.
 *
 * This file intentionally starts with the connection/auth surfaces first:
 * - OAuth authorization URL
 * - code exchange
 * - account discovery
 *
 * Full REST/WebSocket trade sync remains a follow-up slice.
 */
import type {
  NormalizedAccountInfo,
  ProviderAuthorizedAccount,
  ProviderConfig,
  ProviderCredentials,
} from "./types";
import {
  createProviderScaffoldMetadata,
  ScaffoldedTradingProvider,
  unsupportedProviderMethod,
} from "./scaffold";
import { getServerEnv } from "../env";

export const TRADOVATE_PROVIDER_INFO = createProviderScaffoldMetadata({
  name: "Tradovate",
  description: "Futures platform. Used by Apex Trader Funding, Topstep (legacy).",
  authType: "oauth",
  fields: [],
  status: "coming_soon",
  capabilityNotes: {
    connect:
      "Tradovate account verification still needs the REST history/account endpoints wired in.",
    fetchHistory:
      "Tradovate trade-history sync still needs authenticated REST/WebSocket wiring.",
    fetchOpenPositions:
      "Tradovate position sync still needs authenticated REST/WebSocket wiring.",
    fetchAccountInfo:
      "Tradovate account snapshots still need authenticated REST/WebSocket wiring.",
    exchangeCode: "Tradovate OAuth exchange is wired for connection bootstrap.",
    refreshToken:
      "Tradovate token refresh is not wired in yet; reconnect if the token expires.",
  },
});

type TradovateTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  userId?: number | string;
  name?: string;
  hasMarketData?: boolean;
  error?: string;
  error_description?: string;
};

type TradovateMeResponse = {
  userId?: number | string;
  fullName?: string | null;
  name?: string | null;
  email?: string | null;
};

type TradovateAccountEntity = {
  id?: number | string | null;
  name?: string | null;
  nickname?: string | null;
  accountTypeName?: string | null;
  active?: boolean | null;
};

export class TradovateProvider extends ScaffoldedTradingProvider {
  constructor() {
    super("Tradovate", TRADOVATE_PROVIDER_INFO.capabilities);
  }

  async exchangeCode(
    code: string,
    redirectUri: string
  ): Promise<ProviderCredentials> {
    const env = getServerEnv();
    const response = await fetch(`${getTradovateApiBaseUrl()}/auth/oauthtoken`, {
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
      const message =
        data?.error_description ||
        data?.error ||
        `Tradovate token exchange failed: ${response.status}`;
      throw new Error(message);
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
      .filter((account) => account.id != null)
      .map((account) => {
        const providerAccountId = String(account.id);
        const accountNumber =
          account.name?.trim() || account.nickname?.trim() || null;
        const brokerName = "Tradovate";

        return {
          providerAccountId,
          accountNumber,
          label:
            account.nickname?.trim() ||
            account.name?.trim() ||
            `Tradovate ${providerAccountId}`,
          brokerName,
          currency: null,
          environment: "unknown",
          metadata: {
            accountTypeName: account.accountTypeName ?? null,
            active: account.active ?? null,
            userId:
              me.userId != null ? String(me.userId) : credentials.userId ?? null,
            fullName: me.fullName ?? me.name ?? null,
          },
        } satisfies ProviderAuthorizedAccount;
      });
  }

  async connect(_config: ProviderConfig): Promise<NormalizedAccountInfo> {
    return unsupportedProviderMethod(
      "Tradovate",
      "connect",
      this.capabilities.connect?.note
    );
  }

  private async fetchMe(accessToken: string): Promise<TradovateMeResponse> {
    const response = await fetch(`${getTradovateApiBaseUrl()}/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Tradovate /auth/me failed: ${response.status}`);
    }

    return (await response.json()) as TradovateMeResponse;
  }

  private async fetchAccounts(
    accessToken: string
  ): Promise<TradovateAccountEntity[]> {
    const response = await fetch(`${getTradovateApiBaseUrl()}/account/list`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Tradovate account discovery failed: ${response.status}`);
    }

    const data = (await response.json()) as
      | TradovateAccountEntity[]
      | { items?: TradovateAccountEntity[]; accounts?: TradovateAccountEntity[] };

    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data.items)) {
      return data.items;
    }

    if (Array.isArray(data.accounts)) {
      return data.accounts;
    }

    return [];
  }
}

export function getTradovateAuthUrl(state: string): string {
  const env = getServerEnv();
  const url = new URL(env.TRADOVATE_OAUTH_URL || "https://trader.tradovate.com/oauth");
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
