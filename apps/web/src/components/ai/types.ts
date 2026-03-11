export interface EntityReference {
  type: "account" | "view" | "symbol" | "session" | "model";
  id: string;
  name: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  html?: string;
  entities?: EntityReference[];
  createdAt: Date;
  report?: {
    title?: string;
    description?: string;
    trades?: any[];
    summary?: {
      totalTrades?: number;
      winRate?: number;
      totalProfit?: number;
      avgProfit?: number;
    };
  };
}

export interface SuggestionItem {
  id: string;
  name: string;
  type:
    | "account"
    | "view"
    | "symbol"
    | "session"
    | "model"
    | "field"
    | "action"
    | "ai"
    | "query";
  description?: string;
  category?: string;
}
