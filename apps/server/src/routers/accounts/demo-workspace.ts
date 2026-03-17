import { asc, eq, inArray } from "drizzle-orm";

import { db } from "../../db";
import { tradingAccount } from "../../db/schema/trading";

export const DEMO_ACCOUNT_NAME = "Profitabledge Demo";
export const DEMO_ACCOUNT_PREFIX = "PE";
export const DEMO_BROKER = "Demo Broker";
export const DEMO_BROKER_SERVER = "Profitabledge-Demo";

const LEGACY_DEMO_ACCOUNT_NAMES = new Set(["Demo account"]);
const LEGACY_DEMO_BROKERS = new Set(["Profitabledge"]);
const LEGACY_DEMO_BROKER_SERVERS = new Set(["Profitabledge-Demo01"]);
const LEGACY_DEMO_ACCOUNT_PREFIXES = ["DEMO-"];

function isDemoWorkspaceAccountRecord(account: {
  name?: string | null;
  broker?: string | null;
  brokerServer?: string | null;
  accountNumber?: string | null;
}) {
  const accountNumber = String(account.accountNumber ?? "");

  const matchesCurrentDemo =
    account.name === DEMO_ACCOUNT_NAME &&
    account.broker === DEMO_BROKER &&
    account.brokerServer === DEMO_BROKER_SERVER &&
    accountNumber.startsWith(DEMO_ACCOUNT_PREFIX);

  if (matchesCurrentDemo) {
    return true;
  }

  return (
    LEGACY_DEMO_ACCOUNT_NAMES.has(String(account.name ?? "")) &&
    LEGACY_DEMO_BROKERS.has(String(account.broker ?? "")) &&
    LEGACY_DEMO_BROKER_SERVERS.has(String(account.brokerServer ?? "")) &&
    LEGACY_DEMO_ACCOUNT_PREFIXES.some((prefix) =>
      accountNumber.startsWith(prefix)
    )
  );
}

export async function resetDemoWorkspaceForUser(
  userId: string,
  seedSampleAccount: (
    userId: string,
    options?: {
      accountId?: string;
      accountNumber?: string | null;
      resetExistingAccount?: boolean;
    }
  ) => Promise<unknown>
) {
  const accounts = await db
    .select({
      id: tradingAccount.id,
      name: tradingAccount.name,
      broker: tradingAccount.broker,
      brokerServer: tradingAccount.brokerServer,
      accountNumber: tradingAccount.accountNumber,
      createdAt: tradingAccount.createdAt,
    })
    .from(tradingAccount)
    .where(eq(tradingAccount.userId, userId))
    .orderBy(asc(tradingAccount.createdAt));

  const demoAccounts = accounts.filter(isDemoWorkspaceAccountRecord);

  if (demoAccounts.length === 0) {
    return seedSampleAccount(userId);
  }

  const [primaryDemoAccount, ...duplicateDemoAccounts] = demoAccounts;

  if (duplicateDemoAccounts.length > 0) {
    await db
      .delete(tradingAccount)
      .where(
        inArray(
          tradingAccount.id,
          duplicateDemoAccounts.map((account) => account.id)
        )
      );
  }

  const result = (await seedSampleAccount(userId, {
    accountId: primaryDemoAccount.id,
    accountNumber: primaryDemoAccount.accountNumber,
    resetExistingAccount: true,
  })) as Record<string, unknown>;

  return {
    ...result,
    resetCount: duplicateDemoAccounts.length,
  };
}

export async function seedDemoAiHistory(_input: {
  userId: string;
  accountId: string;
  now: number;
  bestSession: string;
  bestSymbol: string;
  bestModel: string;
  weakestSymbol: string;
  weakestSession: string;
  weakestProtocol: string;
}) {
  return { created: 0 } as const;
}
