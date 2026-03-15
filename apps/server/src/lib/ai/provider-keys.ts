import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { and, desc, eq } from "drizzle-orm";

import { db } from "../../db";
import { aiProviderKey } from "../../db/schema/ai";
import {
  decryptCredentials,
  encryptCredentials,
} from "../providers/credential-cipher";

export const AI_PROVIDER_KEYS = ["gemini", "openai", "anthropic"] as const;
export type AIProviderKeyName = (typeof AI_PROVIDER_KEYS)[number];

const PROVIDER_DISPLAY_NAMES: Record<AIProviderKeyName, string> = {
  gemini: "Google Gemini",
  openai: "OpenAI",
  anthropic: "Anthropic",
};

const PROVIDER_VALIDATION_MODELS: Record<
  Exclude<AIProviderKeyName, "gemini">,
  string
> = {
  openai: "gpt-5-mini",
  anthropic: "claude-haiku-4-5",
};

export function getAIProviderDisplayName(provider: AIProviderKeyName) {
  return PROVIDER_DISPLAY_NAMES[provider];
}

export function buildAiKeyPrefix(apiKey: string) {
  const trimmed = apiKey.trim();
  if (trimmed.length <= 8) {
    return trimmed;
  }

  return `${trimmed.slice(0, 8)}...`;
}

export async function listUserAIProviderKeys(userId: string) {
  return db
    .select({
      id: aiProviderKey.id,
      provider: aiProviderKey.provider,
      displayName: aiProviderKey.displayName,
      keyPrefix: aiProviderKey.keyPrefix,
      isActive: aiProviderKey.isActive,
      lastValidatedAt: aiProviderKey.lastValidatedAt,
      lastUsedAt: aiProviderKey.lastUsedAt,
      createdAt: aiProviderKey.createdAt,
      updatedAt: aiProviderKey.updatedAt,
    })
    .from(aiProviderKey)
    .where(eq(aiProviderKey.userId, userId))
    .orderBy(desc(aiProviderKey.updatedAt));
}

export async function getDecryptedAIProviderKey(
  userId: string,
  provider: AIProviderKeyName
) {
  const [row] = await db
    .select()
    .from(aiProviderKey)
    .where(
      and(
        eq(aiProviderKey.userId, userId),
        eq(aiProviderKey.provider, provider),
        eq(aiProviderKey.isActive, true)
      )
    )
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    provider,
    apiKey: decryptCredentials(row.encryptedApiKey, row.credentialIv),
  };
}

export async function hasUserAIProviderKey(
  userId: string,
  provider: AIProviderKeyName
) {
  const [row] = await db
    .select({ id: aiProviderKey.id })
    .from(aiProviderKey)
    .where(
      and(
        eq(aiProviderKey.userId, userId),
        eq(aiProviderKey.provider, provider),
        eq(aiProviderKey.isActive, true)
      )
    )
    .limit(1);

  return Boolean(row);
}

export async function touchAIProviderKeyLastUsed(
  userId: string,
  provider: AIProviderKeyName
) {
  await db
    .update(aiProviderKey)
    .set({
      lastUsedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(aiProviderKey.userId, userId),
        eq(aiProviderKey.provider, provider)
      )
    );
}

export async function deleteAIProviderKey(
  userId: string,
  provider: AIProviderKeyName
) {
  await db
    .delete(aiProviderKey)
    .where(
      and(
        eq(aiProviderKey.userId, userId),
        eq(aiProviderKey.provider, provider)
      )
    );
}

export async function validateAIProviderKey(
  provider: AIProviderKeyName,
  apiKey: string
) {
  const normalizedApiKey = apiKey.trim();

  if (provider === "gemini") {
    const client = new GoogleGenerativeAI(normalizedApiKey);
    const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });
    await model.countTokens("Validate this key");
    return;
  }

  const modelId = PROVIDER_VALIDATION_MODELS[provider];

  await generateText({
    model:
      provider === "openai"
        ? createOpenAI({ apiKey: normalizedApiKey })(modelId)
        : createAnthropic({ apiKey: normalizedApiKey })(modelId),
    prompt: "Reply with OK",
    maxOutputTokens: 4,
    temperature: 0,
    maxRetries: 0,
    timeout: 15_000,
  });
}

export async function upsertAIProviderKey(input: {
  userId: string;
  provider: AIProviderKeyName;
  apiKey: string;
}) {
  const normalizedApiKey = input.apiKey.trim();
  const { encrypted, iv } = encryptCredentials(normalizedApiKey);
  const keyPrefix = buildAiKeyPrefix(normalizedApiKey);
  const displayName = getAIProviderDisplayName(input.provider);
  const [existing] = await db
    .select({ id: aiProviderKey.id })
    .from(aiProviderKey)
    .where(
      and(
        eq(aiProviderKey.userId, input.userId),
        eq(aiProviderKey.provider, input.provider)
      )
    )
    .limit(1);

  const values = {
    displayName,
    encryptedApiKey: encrypted,
    credentialIv: iv,
    keyPrefix,
    isActive: true,
    lastValidatedAt: new Date(),
    updatedAt: new Date(),
  };

  if (existing) {
    const [updated] = await db
      .update(aiProviderKey)
      .set(values)
      .where(eq(aiProviderKey.id, existing.id))
      .returning({
        id: aiProviderKey.id,
        provider: aiProviderKey.provider,
        displayName: aiProviderKey.displayName,
        keyPrefix: aiProviderKey.keyPrefix,
        isActive: aiProviderKey.isActive,
        lastValidatedAt: aiProviderKey.lastValidatedAt,
        lastUsedAt: aiProviderKey.lastUsedAt,
        createdAt: aiProviderKey.createdAt,
        updatedAt: aiProviderKey.updatedAt,
      });

    return updated;
  }

  const [inserted] = await db
    .insert(aiProviderKey)
    .values({
      id: crypto.randomUUID(),
      userId: input.userId,
      provider: input.provider,
      displayName,
      encryptedApiKey: encrypted,
      credentialIv: iv,
      keyPrefix,
      isActive: true,
      lastValidatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({
      id: aiProviderKey.id,
      provider: aiProviderKey.provider,
      displayName: aiProviderKey.displayName,
      keyPrefix: aiProviderKey.keyPrefix,
      isActive: aiProviderKey.isActive,
      lastValidatedAt: aiProviderKey.lastValidatedAt,
      lastUsedAt: aiProviderKey.lastUsedAt,
      createdAt: aiProviderKey.createdAt,
      updatedAt: aiProviderKey.updatedAt,
    });

  return inserted;
}
