export type AIKeyProvider = "gemini" | "openai" | "anthropic";
export type AIUsageViewKey = "profitabledge" | "gemini" | "openai" | "anthropic";

export type AIKeyRow = {
  id: string;
  provider: AIKeyProvider;
  displayName: string;
  keyPrefix: string;
  isActive: boolean;
  lastValidatedAt: string | Date | null;
  lastUsedAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type AIUsagePoint = {
  date: string;
  label: string;
  requests: number;
  totalTokens: number;
  chargedCredits: number;
  spendUsd: number;
};

export type AIUsageViewSummary = {
  totalRequests: number;
  totalTokens: number;
  chargedCredits: number;
  spendUsd: number;
  data: AIUsagePoint[];
};

export type AIUsageResponse = {
  days: number;
  views: Record<AIUsageViewKey, AIUsageViewSummary>;
};
