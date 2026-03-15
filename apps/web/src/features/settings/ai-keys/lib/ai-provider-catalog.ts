export type AIProviderCatalogItem = {
  id: "gemini" | "openai" | "anthropic";
  name: string;
  description: string;
  status: "active";
  runtimeStatus: "live" | "connector_only";
  accentColor: string;
  detail: string;
  keySourceLabel: string;
  keySourceUrl: string;
  keySourceHint: string;
};

export const AI_PROVIDER_CATALOG: AIProviderCatalogItem[] = [
  {
    id: "gemini",
    name: "Google Gemini",
    description:
      "Use your own Gemini API key for the assistant, journal AI, and other Gemini-backed tools.",
    runtimeStatus: "live",
    status: "active",
    accentColor: "#0EA5E9",
    detail: "Used today",
    keySourceLabel: "Google AI Studio",
    keySourceUrl: "https://aistudio.google.com/apikey",
    keySourceHint: "Create a Gemini API key in Google AI Studio",
  },
  {
    id: "openai",
    name: "OpenAI",
    description:
      "Connect and validate your OpenAI key now so it is ready when assistant routing expands beyond Gemini.",
    runtimeStatus: "connector_only",
    status: "active",
    accentColor: "#10B981",
    detail: "Connector ready",
    keySourceLabel: "OpenAI API keys",
    keySourceUrl: "https://platform.openai.com/api-keys",
    keySourceHint: "Create a platform API key from your OpenAI developer account",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description:
      "Connect and validate your Anthropic key now so it is ready when assistant routing expands beyond Gemini.",
    runtimeStatus: "connector_only",
    status: "active",
    accentColor: "#F59E0B",
    detail: "Connector ready",
    keySourceLabel: "Anthropic Console",
    keySourceUrl: "https://console.anthropic.com/settings/keys",
    keySourceHint: "Create a Claude API key in the Anthropic Console",
  },
];

export const ACTIVE_AI_PROVIDER_CATALOG = AI_PROVIDER_CATALOG;

export function getAIProviderCatalogItem(
  providerId: AIProviderCatalogItem["id"]
) {
  return AI_PROVIDER_CATALOG.find((provider) => provider.id === providerId);
}
