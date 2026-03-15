import type { CustomGoalCriteria } from "@/components/goals/custom-goal-builder";
import type { AnalysisBlock, VizSpec } from "@/types/assistant-stream";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  html?: string;
  createdAt: Date;
  visualization?: VizSpec;
  analysisBlocks?: AnalysisBlock[];
}

export const TRADING_SUGGESTIONS = [
  "What's my edge?",
  "Where am I leaking money?",
  "Am I tilted right now?",
  "How is this session going?",
  "What's my most profitable pair this week?",
  "What's my win rate in the New York session?",
  "How's my performance this month?",
  "Which day of the week am I most profitable?",
  "What's my average trade duration?",
  "How much am I leaving on the table?",
  "What should I focus on in my journal?",
  "How close am I to failing my prop challenge?",
];

export function normalizeGoalTargetType(metric: CustomGoalCriteria["metric"]) {
  switch (metric) {
    case "winRate":
      return "winRate" as const;
    case "profit":
      return "profit" as const;
    case "avgRR":
      return "rr" as const;
    case "consistency":
      return "consistency" as const;
    case "tradeCount":
      return "trades" as const;
    case "profitFactor":
      return "rr" as const;
    case "avgProfit":
      return "profit" as const;
    case "avgLoss":
      return "profit" as const;
    default:
      return "profit" as const;
  }
}
