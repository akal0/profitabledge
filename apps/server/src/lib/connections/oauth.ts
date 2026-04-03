import { db } from "../../db";
import { platformConnection } from "../../db/schema/connections";
import { encryptCredentials } from "../providers/credential-cipher";
import { getProvider } from "../providers/registry";
import type {
  ProviderAuthorizedAccount,
  ProviderCredentials,
} from "../providers/types";
import { resolveUniqueConnectionDisplayName } from "./display-name";
import { getServerEnv } from "../env";
import { buildDiscoveredAccountsMeta } from "./discovered-accounts";
import { requireLiveSyncAccess } from "../billing/ea-sync-access";

export type SupportedOAuthConnectionProvider = "ctrader" | "tradovate";

export async function createOAuthConnection(params: {
  userId: string;
  provider: SupportedOAuthConnectionProvider;
  code: string;
  displayName: string;
  meta?: Record<string, unknown> | null | undefined;
}) {
  await requireLiveSyncAccess(params.userId);

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
  return buildDiscoveredAccountsMeta({
    provider: input.provider,
    meta: input.meta,
    discoveredAccounts: input.discoveredAccounts,
    credentials: input.credentials,
  });
}
