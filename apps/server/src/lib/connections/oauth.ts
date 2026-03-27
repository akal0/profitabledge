import { db } from "../../db";
import { platformConnection } from "../../db/schema/connections";
import { sanitizeConnectionMeta } from "./sanitize-meta";
import { encryptCredentials } from "../providers/credential-cipher";
import { getProvider } from "../providers/registry";
import type {
  ProviderAuthorizedAccount,
  ProviderCredentials,
} from "../providers/types";
import { resolveUniqueConnectionDisplayName } from "./display-name";
import { getServerEnv } from "../env";

export type SupportedOAuthConnectionProvider = "ctrader" | "tradovate";

export async function createOAuthConnection(params: {
  userId: string;
  provider: SupportedOAuthConnectionProvider;
  code: string;
  displayName: string;
  meta?: Record<string, unknown> | null | undefined;
}) {
  const provider = await getProvider(params.provider);

  if (!provider.exchangeCode) {
    throw new Error(`Provider ${params.provider} does not support OAuth`);
  }

  const redirectUri = resolveOAuthRedirectUri(params.provider);
  const credentials = await provider.exchangeCode(params.code, redirectUri);
  const discoveredAccounts = provider.listAuthorizedAccounts
    ? await provider
        .listAuthorizedAccounts(credentials)
        .catch(() => [] as ProviderAuthorizedAccount[])
    : [];

  const { encrypted, iv } = encryptCredentials(JSON.stringify(credentials));
  const expiresAt = credentials.expiresAt
    ? new Date(credentials.expiresAt)
    : null;
  const displayName = await resolveUniqueConnectionDisplayName({
    userId: params.userId,
    provider: params.provider,
    displayName: params.displayName,
  });
  const safeMeta = buildOAuthConnectionMeta({
    provider: params.provider,
    meta: params.meta,
    discoveredAccounts,
    credentials,
  });

  const [connection] = await db
    .insert(platformConnection)
    .values({
      userId: params.userId,
      provider: params.provider,
      displayName,
      meta: safeMeta,
      encryptedCredentials: encrypted,
      credentialIv: iv,
      tokenExpiresAt: expiresAt,
      status: "active",
    })
    .returning();

  return {
    connection,
    discoveredAccounts,
  };
}

export function resolveOAuthRedirectUri(
  provider: SupportedOAuthConnectionProvider
) {
  const env = getServerEnv();
  switch (provider) {
    case "ctrader":
      return env.CTRADER_REDIRECT_URI!;
    case "tradovate":
      return env.TRADOVATE_REDIRECT_URI!;
  }
}

function buildOAuthConnectionMeta(input: {
  provider: SupportedOAuthConnectionProvider;
  meta?: Record<string, unknown> | null | undefined;
  discoveredAccounts: ProviderAuthorizedAccount[];
  credentials: ProviderCredentials;
}) {
  const baseMeta = sanitizeConnectionMeta(input.meta);
  const discoveredAccounts = input.discoveredAccounts.map((account) => ({
    providerAccountId: account.providerAccountId,
    accountNumber: account.accountNumber,
    label: account.label,
    brokerName: account.brokerName,
    currency: account.currency,
    environment: account.environment,
    metadata: account.metadata ?? null,
  }));

  const nextMeta: Record<string, unknown> = {
    ...baseMeta,
    ...(discoveredAccounts.length > 0 ? { discoveredAccounts } : {}),
  };

  const singleAccount =
    discoveredAccounts.length === 1 ? discoveredAccounts[0] : null;

  if (singleAccount && input.provider === "ctrader") {
    nextMeta.ctraderAccountId = singleAccount.providerAccountId;
    nextMeta.brokerName = singleAccount.brokerName;
    nextMeta.currency = singleAccount.currency;
  }

  if (singleAccount && input.provider === "tradovate") {
    nextMeta.tradovateAccountId = singleAccount.providerAccountId;
    nextMeta.brokerName = singleAccount.brokerName;
    nextMeta.currency = singleAccount.currency;
  }

  if (input.provider === "tradovate" && input.credentials.userId) {
    nextMeta.tradovateUserId = input.credentials.userId;
  }

  return nextMeta;
}
