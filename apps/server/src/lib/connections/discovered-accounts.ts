import { sanitizeConnectionMeta } from "./sanitize-meta";
import type {
  NormalizedAccountInfo,
  ProviderAuthorizedAccount,
  ProviderCredentials,
} from "../providers/types";

const PROVIDER_ACCOUNT_META_KEYS: Record<string, string> = {
  ctrader: "ctraderAccountId",
  tradovate: "tradovateAccountId",
  dxtrade: "dxtradeAccountId",
  topstepx: "topstepxAccountId",
  rithmic: "rithmicAccountId",
};

export function getProviderAccountMetaKey(provider: string): string | null {
  return PROVIDER_ACCOUNT_META_KEYS[provider] ?? null;
}

export function buildDiscoveredAccountsMeta(input: {
  provider: string;
  meta?: Record<string, unknown> | null | undefined;
  discoveredAccounts: ProviderAuthorizedAccount[];
  credentials?: ProviderCredentials | null;
  accountInfo?: NormalizedAccountInfo | null;
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
  const providerAccountKey = getProviderAccountMetaKey(input.provider);

  if (singleAccount && providerAccountKey) {
    nextMeta[providerAccountKey] = singleAccount.providerAccountId;
    nextMeta.selectedProviderAccount = {
      providerAccountId: singleAccount.providerAccountId,
      accountNumber: singleAccount.accountNumber,
      label: singleAccount.label,
      environment: singleAccount.environment,
    };
  }

  nextMeta.brokerName =
    (singleAccount?.brokerName ?? input.accountInfo?.brokerName ?? null) ||
    nextMeta.brokerName ||
    null;
  nextMeta.currency =
    (singleAccount?.currency ?? input.accountInfo?.currency ?? null) ||
    nextMeta.currency ||
    null;

  if (input.provider === "tradovate" && input.credentials?.userId) {
    nextMeta.tradovateUserId = input.credentials.userId;
  }

  return nextMeta;
}
