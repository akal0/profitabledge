export async function seedDemoBacktestSessions(_input: {
  userId: string;
  now: number;
  basePrices: Record<string, number>;
  pipSizes: Record<string, number>;
  pipValuePerLot: Record<string, number>;
}) {
  return [] as const;
}
