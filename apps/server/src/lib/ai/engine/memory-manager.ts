/**
 * Memory Manager
 *
 * Long-term conversational memory for the AI assistant.
 * Extracts facts, preferences, and goals from conversations and persists them.
 * Retrieves relevant memories at query time for personalized responses.
 *
 * Features:
 * - Fact extraction from conversations (via LLM)
 * - Memory deduplication
 * - Relevance-based retrieval (category + recency)
 * - User-manageable (view, edit, delete)
 */

import { db } from "../../../db";
import { traderMemory } from "../../../db/schema/coaching";
import { eq, and, desc, sql } from "drizzle-orm";

// ─── Types ──────────────────────────────────────────────────────

export interface MemoryEntry {
  id: string;
  category: "preference" | "goal" | "context" | "instruction";
  content: string;
  source: "extracted" | "user_stated";
  confidence: number;
  lastReferencedAt: Date | null;
  createdAt: Date;
}

export interface MemoryContext {
  preferences: string[];
  goals: string[];
  instructions: string[];
  context: string[];
}

// ─── Save Memory ────────────────────────────────────────────────

export async function saveMemory(
  userId: string,
  category: MemoryEntry["category"],
  content: string,
  source: "extracted" | "user_stated" = "extracted",
  confidence: number = 0.8
): Promise<void> {
  // Check for duplicate or near-duplicate
  const existing = await db
    .select()
    .from(traderMemory)
    .where(
      and(
        eq(traderMemory.userId, userId),
        eq(traderMemory.category, category)
      )
    );

  // Simple deduplication: check if content is substantially similar
  const isDuplicate = existing.some((m) => {
    const existingLower = m.content.toLowerCase();
    const newLower = content.toLowerCase();
    return (
      existingLower === newLower ||
      existingLower.includes(newLower) ||
      newLower.includes(existingLower)
    );
  });

  if (isDuplicate) return;

  await db.insert(traderMemory).values({
    userId,
    category,
    content,
    source,
    confidence: String(confidence),
  });
}

// ─── Retrieve Relevant Memories ─────────────────────────────────

export async function getRelevantMemories(
  userId: string,
  limit: number = 10
): Promise<MemoryContext> {
  const memories = await db
    .select()
    .from(traderMemory)
    .where(eq(traderMemory.userId, userId))
    .orderBy(desc(traderMemory.updatedAt))
    .limit(limit);

  const context: MemoryContext = {
    preferences: [],
    goals: [],
    instructions: [],
    context: [],
  };

  for (const m of memories) {
    switch (m.category) {
      case "preference":
        context.preferences.push(m.content);
        break;
      case "goal":
        context.goals.push(m.content);
        break;
      case "instruction":
        context.instructions.push(m.content);
        break;
      case "context":
        context.context.push(m.content);
        break;
    }
  }

  return context;
}

// ─── Format Memories for System Prompt ──────────────────────────

export async function getMemoryPromptContext(
  userId: string
): Promise<string> {
  const context = await getRelevantMemories(userId);

  const parts: string[] = [];

  if (context.preferences.length > 0) {
    parts.push(
      `USER PREFERENCES:\n${context.preferences.map((p) => `- ${p}`).join("\n")}`
    );
  }

  if (context.goals.length > 0) {
    parts.push(
      `USER GOALS:\n${context.goals.map((g) => `- ${g}`).join("\n")}`
    );
  }

  if (context.instructions.length > 0) {
    parts.push(
      `USER INSTRUCTIONS:\n${context.instructions.map((i) => `- ${i}`).join("\n")}`
    );
  }

  if (context.context.length > 0) {
    parts.push(
      `KNOWN CONTEXT:\n${context.context.map((c) => `- ${c}`).join("\n")}`
    );
  }

  return parts.length > 0
    ? `\n\n--- TRADER MEMORY ---\n${parts.join("\n\n")}\n--- END MEMORY ---\n`
    : "";
}

// ─── Extract Memories from Conversation ─────────────────────────

export function extractMemoryCandidates(
  userMessage: string,
  assistantResponse: string
): Array<{ category: MemoryEntry["category"]; content: string }> {
  const candidates: Array<{
    category: MemoryEntry["category"];
    content: string;
  }> = [];
  const msg = userMessage.toLowerCase();

  // Detect explicit instructions
  const instructionPatterns = [
    /always\s+(.+)/i,
    /never\s+(.+)/i,
    /prefer\s+(.+)/i,
    /i\s+like\s+(.+)/i,
    /show\s+me\s+(.+)\s+in\s+(.+)/i,
    /use\s+(.+)\s+(?:instead|format|style)/i,
  ];

  for (const pattern of instructionPatterns) {
    const match = userMessage.match(pattern);
    if (match) {
      candidates.push({
        category: "instruction",
        content: userMessage.trim(),
      });
      break; // Only one instruction per message
    }
  }

  // Detect goal-related statements
  const goalPatterns = [
    /(?:my goal|i want to|i'm trying to|i need to)\s+(.+)/i,
    /(?:target|aim for|working towards?)\s+(.+)/i,
  ];

  for (const pattern of goalPatterns) {
    const match = userMessage.match(pattern);
    if (match) {
      candidates.push({
        category: "goal",
        content: match[1].trim(),
      });
      break;
    }
  }

  // Detect preferences
  const preferencePatterns = [
    /(?:i prefer|show .+ in|display .+ as|i like .+ better)\s+(.+)/i,
    /(?:don't show|hide|skip)\s+(.+)/i,
  ];

  for (const pattern of preferencePatterns) {
    const match = userMessage.match(pattern);
    if (match) {
      candidates.push({
        category: "preference",
        content: userMessage.trim(),
      });
      break;
    }
  }

  return candidates;
}

// ─── Process Memories After Conversation ────────────────────────

export async function processConversationMemories(
  userId: string,
  userMessage: string,
  assistantResponse: string
): Promise<void> {
  const candidates = extractMemoryCandidates(userMessage, assistantResponse);

  for (const candidate of candidates) {
    await saveMemory(userId, candidate.category, candidate.content, "extracted");
  }
}

// ─── Get All Memories (for user management) ─────────────────────

export async function getAllMemories(
  userId: string
): Promise<MemoryEntry[]> {
  const memories = await db
    .select()
    .from(traderMemory)
    .where(eq(traderMemory.userId, userId))
    .orderBy(desc(traderMemory.createdAt));

  return memories.map((m) => ({
    id: m.id,
    category: m.category as MemoryEntry["category"],
    content: m.content,
    source: m.source as "extracted" | "user_stated",
    confidence: parseFloat(m.confidence || "0.8"),
    lastReferencedAt: m.lastReferencedAt,
    createdAt: m.createdAt,
  }));
}

// ─── Delete Memory ──────────────────────────────────────────────

export async function deleteMemory(
  userId: string,
  memoryId: string
): Promise<void> {
  await db
    .delete(traderMemory)
    .where(
      and(eq(traderMemory.id, memoryId), eq(traderMemory.userId, userId))
    );
}

// ─── Update Memory ──────────────────────────────────────────────

export async function updateMemory(
  userId: string,
  memoryId: string,
  content: string
): Promise<void> {
  await db
    .update(traderMemory)
    .set({ content, updatedAt: new Date() })
    .where(
      and(eq(traderMemory.id, memoryId), eq(traderMemory.userId, userId))
    );
}
