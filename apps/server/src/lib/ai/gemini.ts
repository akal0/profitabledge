import {
  GoogleGenerativeAI,
  type GenerateContentRequest,
  type GenerateContentResult,
  type Part,
} from "@google/generative-ai";

import {
  assertPlatformAICreditsAvailable,
  calculateGeminiCostMicros,
  estimateGeminiCostMicros,
  estimatePromptTokens,
  extractEstimatedMaxOutputTokens,
  recordAICreditUsage,
  type AICredentialSource,
} from "../billing/edge-credits";
import { getServerEnv } from "../env";
import {
  getDecryptedAIProviderKey,
  touchAIProviderKeyLastUsed,
} from "./provider-keys";

type MeteredGeminiRequest =
  | string
  | Array<string | Part>
  | GenerateContentRequest;

export type MeteredGeminiInput = {
  userId: string;
  accountId?: string | null;
  featureKey: string;
  model: string;
  request: MeteredGeminiRequest;
  apiKey?: string | null;
  metadata?: Record<string, unknown> | null;
};

function getPlatformGeminiApiKey() {
  const env = getServerEnv();
  return env.GEMINI_API_KEY ?? env.GOOGLE_GENERATIVE_AI_API_KEY ?? null;
}

function isUserKeyAuthError(error: unknown) {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status?: unknown }).status;
    if (status === 401 || status === 403) {
      return true;
    }
  }

  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    /\bapi key\b/.test(message) ||
    /\bunauthori[sz]ed\b/.test(message) ||
    /\bforbidden\b/.test(message)
  );
}

async function resolveCredentialSource(input: {
  userId: string;
  apiKeyOverride?: string | null;
}): Promise<{
  apiKey: string;
  credentialSource: AICredentialSource;
  providerKeyName?: "gemini";
}> {
  if (input.apiKeyOverride && input.apiKeyOverride.trim()) {
    return {
      apiKey: input.apiKeyOverride.trim(),
      credentialSource: "user_key",
    };
  }

  const storedKey = await getDecryptedAIProviderKey(input.userId, "gemini");
  if (storedKey) {
    return {
      apiKey: storedKey.apiKey,
      credentialSource: "user_key",
      providerKeyName: "gemini",
    };
  }

  const platformApiKey = getPlatformGeminiApiKey();
  if (!platformApiKey) {
    throw new Error("AI is unavailable right now. Please try again later.");
  }

  return {
    apiKey: platformApiKey,
    credentialSource: "platform",
  };
}

export function hasPlatformGeminiKey() {
  return Boolean(getPlatformGeminiApiKey());
}

export async function generateMeteredGeminiContent(
  input: MeteredGeminiInput
): Promise<GenerateContentResult> {
  const { apiKey, credentialSource, providerKeyName } =
    await resolveCredentialSource({
      userId: input.userId,
      apiKeyOverride: input.apiKey,
    });

  if (credentialSource === "platform") {
    await assertPlatformAICreditsAvailable(input.userId);
  }

  const estimatedPromptTokens = estimatePromptTokens(input.request);
  const estimatedMaxOutputTokens = extractEstimatedMaxOutputTokens(input.request);
  const estimatedCostMicros = estimateGeminiCostMicros({
    model: input.model,
    promptTokens: estimatedPromptTokens,
    maxOutputTokens: estimatedMaxOutputTokens,
  });

  let result: GenerateContentResult;
  try {
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({ model: input.model });
    result = await model.generateContent(input.request);
  } catch (error) {
    if (credentialSource === "user_key" && isUserKeyAuthError(error)) {
      throw new Error(
        "Your Gemini API key is invalid or expired. Update it in Settings > AI"
      );
    }
    throw error;
  }

  const usageMetadata = result.response.usageMetadata;
  const chargedCostMicros =
    credentialSource === "platform"
      ? Math.max(
          0,
          usageMetadata
            ? calculateGeminiCostMicros({
                model: input.model,
                usageMetadata,
              })
            : estimatedCostMicros
        )
      : 0;

  try {
    await recordAICreditUsage({
      userId: input.userId,
      accountId: input.accountId ?? null,
      credentialSource,
      provider: "google",
      model: input.model,
      featureKey: input.featureKey,
      usageMetadata,
      estimatedPromptTokens,
      estimatedMaxOutputTokens,
      estimatedCostMicros,
      chargedCostMicros,
      metadata: input.metadata ?? null,
    });
  } catch (error) {
    console.error("[AI] Failed to persist metered usage", error);
  }

  if (credentialSource === "user_key" && providerKeyName) {
    void touchAIProviderKeyLastUsed(input.userId, providerKeyName).catch(
      (error) => {
        console.error("[AI] Failed to mark provider key used", error);
      }
    );
  }

  return result;
}
