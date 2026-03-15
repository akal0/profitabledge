export const DEMO_ACCOUNT_NAME = "Profitabledge Demo";
export const DEMO_ACCOUNT_PREFIX = "PE";
export const DEMO_BROKER = "Demo Broker";
export const DEMO_BROKER_SERVER = "Profitabledge-Demo";

export async function resetDemoWorkspaceForUser(
  userId: string,
  seedSampleAccount: (userId: string) => Promise<unknown>
) {
  return seedSampleAccount(userId);
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
