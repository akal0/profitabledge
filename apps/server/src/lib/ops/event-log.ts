export async function ensureActivationMilestone(_input: {
  userId: string;
  key: string;
  source?: string;
  metadata?: Record<string, unknown>;
}) {
  return { recorded: true } as const;
}

export async function recordAppEvent(_input: {
  userId: string;
  category: string;
  name: string;
  metadata?: Record<string, unknown>;
}) {
  return { recorded: true } as const;
}
