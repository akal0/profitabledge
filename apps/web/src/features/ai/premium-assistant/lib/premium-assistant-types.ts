import type { CustomGoalCriteria } from "@/components/goals/custom-goal-builder";
import type {
  AnalysisBlock,
  ConversationContext,
  RenderedWidget,
  AssistantToolCall,
  VizSpec,
} from "@/types/assistant-stream";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  html?: string;
  createdAt: Date;
  visualization?: VizSpec;
  analysisBlocks?: AnalysisBlock[];
  widgets?: RenderedWidget[];
  toolCalls?: AssistantToolCall[];
  context?: ConversationContext | null;
}

export const TRADING_SUGGESTIONS = [
  "Which combinations of setup, session, symbol, and direction perform best?",
  "What patterns separate my best trades from my worst trades?",
  "Where do I lose the most money across columns and intersections?",
  "Which mistakes or habits are hurting performance the most?",
  "What is my edge?",
  "What is actually driving my profitability?",
  "Which conditions improve or weaken my edge?",
  "Which trade attributes correlate most with strong expectancy?",
  "Which edge works best for me?",
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
