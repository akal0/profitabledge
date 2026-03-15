export async function seedDemoGoalsAndAlerts(_input: {
  userId: string;
  accountId: string;
  now: number;
  tradeDayKeys: string[];
  fallbackGoalDay: string;
  totalProfit: number;
  journalRate: number;
  ruleCompliance: number;
  checklistCompletionRate: number;
  breakAfterLoss: number;
  winRate: number;
  averageRR: number;
}) {
  return { created: 0 } as const;
}
