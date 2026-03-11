/**
 * Journal AI Analysis Service
 * 
 * Provides AI-powered analysis for journal entries including:
 * - Auto-generated summaries
 * - Pattern detection
 * - Sentiment analysis
 * - Topic extraction
 * - Key insight extraction
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "../db";
import { journalEntry, type JournalBlock, type JournalAIInsight } from "../db/schema/journal";
import { and, eq, inArray } from "drizzle-orm";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const JOURNAL_MODEL = "gemini-2.5-flash";
const FALLBACK_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "had",
  "has",
  "have",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "my",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "this",
  "to",
  "was",
  "were",
  "with",
  "you",
]);

export interface JournalAnalysisResult {
  summary: string;
  keyInsights: string[];
  patterns: JournalAIInsight[];
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  topics: string[];
}

function normalizeText(text: string): string {
  return text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function extractPlainText(blocks: JournalBlock[] | null | undefined): string {
  if (!Array.isArray(blocks)) {
    return "";
  }

  let text = '';
  
  function extractBlock(block: JournalBlock) {
    if (block.content) {
      const cleanText = normalizeText(block.content);
      text += cleanText + ' ';
    }
    if (block.children) {
      block.children.forEach(extractBlock);
    }
  }
  
  blocks.forEach(extractBlock);
  return normalizeText(text);
}

function parseNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function extractEntryAnalysisText(entry: typeof journalEntry.$inferSelect): string {
  const psychologySummary = entry.psychology
    ? [
        `Mood ${entry.psychology.mood}/10`,
        `Confidence ${entry.psychology.confidence}/10`,
        `Energy ${entry.psychology.energy}/10`,
        `Focus ${entry.psychology.focus}/10`,
        `Fear ${entry.psychology.fear}/10`,
        `Greed ${entry.psychology.greed}/10`,
        `State ${entry.psychology.emotionalState}`,
        entry.psychology.notes || "",
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  const parts = [
    normalizeText(entry.title || ""),
    extractPlainText(entry.content as JournalBlock[] | null),
    normalizeText(entry.plainTextContent || ""),
    normalizeText(entry.plannedNotes || ""),
    normalizeText(entry.postTradeAnalysis || ""),
    normalizeText(entry.lessonsLearned || ""),
    Array.isArray(entry.tags) && entry.tags.length > 0
      ? `Tags: ${entry.tags.join(", ")}`
      : "",
    entry.entryType ? `Entry type: ${entry.entryType}` : "",
    entry.tradePhase ? `Trade phase: ${entry.tradePhase}` : "",
    entry.actualOutcome ? `Outcome: ${entry.actualOutcome}` : "",
    entry.actualPnl !== null && entry.actualPnl !== undefined
      ? `PnL: ${entry.actualPnl}`
      : "",
    entry.actualPips !== null && entry.actualPips !== undefined
      ? `Pips: ${entry.actualPips}`
      : "",
    entry.plannedRiskReward !== null && entry.plannedRiskReward !== undefined
      ? `Planned risk reward: ${entry.plannedRiskReward}`
      : "",
    psychologySummary ? `Psychology: ${psychologySummary}` : "",
  ];

  return normalizeText(parts.filter(Boolean).join("\n"));
}

function extractSentences(text: string): string[] {
  const normalized = normalizeText(text);
  if (!normalized) {
    return [];
  }

  const matches = normalized.match(/[^.!?]+[.!?]?/g) || [];
  return matches.map((sentence) => sentence.trim()).filter(Boolean);
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(
    new Set(values.map((value) => normalizeText(value)).filter(Boolean))
  );
}

function getTopKeywords(text: string, limit: number): string[] {
  const counts = new Map<string, number>();
  const words = normalizeText(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((word) => word.length >= 4 && !FALLBACK_STOP_WORDS.has(word));

  for (const word of words) {
    counts.set(word, (counts.get(word) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([word]) => word);
}

function inferSentiment(
  entry: typeof journalEntry.$inferSelect,
  plainText: string
): JournalAnalysisResult["sentiment"] {
  if (entry.actualOutcome === "win") {
    return "positive";
  }

  if (entry.actualOutcome === "loss") {
    return "negative";
  }

  const positiveWords = ["confident", "disciplined", "calm", "good", "great", "patient"];
  const negativeWords = ["fear", "greed", "frustrated", "anxious", "mistake", "revenge"];
  const lower = plainText.toLowerCase();
  const positiveHits = positiveWords.filter((word) => lower.includes(word)).length;
  const negativeHits = negativeWords.filter((word) => lower.includes(word)).length;

  if (positiveHits > 0 && negativeHits > 0) {
    return "mixed";
  }

  if (positiveHits > negativeHits) {
    return "positive";
  }

  if (negativeHits > positiveHits) {
    return "negative";
  }

  return "neutral";
}

function inferTopics(
  entry: typeof journalEntry.$inferSelect,
  plainText: string
): string[] {
  const metadataTopics = [
    entry.entryType?.replace(/_/g, " "),
    entry.tradePhase?.replace(/-/g, " "),
    entry.actualOutcome,
    entry.psychology?.emotionalState,
    ...(Array.isArray(entry.tags)
      ? entry.tags.filter(
          (tag) => !["auto-generated", "trade-close-auto"].includes(tag)
        )
      : []),
  ].filter(Boolean) as string[];

  const keywordTopics = getTopKeywords(plainText, 5);
  return uniqueStrings([...metadataTopics, ...keywordTopics]).slice(0, 5);
}

function buildFallbackPatterns(
  entry: typeof journalEntry.$inferSelect
): JournalAIInsight[] {
  const patterns: JournalAIInsight[] = [];
  const createdAt = new Date().toISOString();

  if (entry.psychology) {
    if (entry.psychology.focus >= 7 && entry.psychology.confidence >= 7) {
      patterns.push({
        type: "strength",
        title: "High-conviction execution mindset",
        description:
          "The journal captures strong focus and confidence, which usually supports cleaner execution.",
        confidence: 0.72,
        createdAt,
      });
    }

    if (entry.psychology.fear >= 7 || entry.psychology.greed >= 7) {
      patterns.push({
        type: "weakness",
        title: "Elevated emotional pressure",
        description:
          "Fear or greed is elevated in this entry, which can distort decision quality and trade management.",
        confidence: 0.78,
        createdAt,
      });
    }
  }

  if (entry.tradePhase === "post-trade") {
    patterns.push({
      type: "pattern",
      title: "Post-trade reflection captured",
      description:
        "This entry was written after execution, which makes it useful for reviewing process and outcome alignment.",
      confidence: 0.68,
      createdAt,
    });
  }

  if (entry.actualOutcome === "loss") {
    patterns.push({
      type: "recommendation",
      title: "Loss review opportunity",
      description:
        "Compare the original plan with the actual execution and isolate the first decision that drifted from the setup.",
      confidence: 0.74,
      createdAt,
    });
  } else if (entry.actualOutcome === "win") {
    patterns.push({
      type: "recommendation",
      title: "Capture the repeatable edge",
      description:
        "Document what was executed well so the same setup can be repeated without turning one good trade into overconfidence.",
      confidence: 0.7,
      createdAt,
    });
  }

  if (patterns.length === 0) {
    patterns.push({
      type: "recommendation",
      title: "Expand the review detail",
      description:
        "Add more context about setup quality, execution, and psychology to make future analyses more specific.",
      confidence: 0.56,
      createdAt,
    });
  }

  return patterns.slice(0, 5);
}

function buildFallbackAnalysis(
  entry: typeof journalEntry.$inferSelect,
  plainText: string
): JournalAnalysisResult {
  const sentences = extractSentences(plainText);
  const sentiment = inferSentiment(entry, plainText);
  const topics = inferTopics(entry, plainText);
  const excerpt = sentences.slice(0, 2).join(" ");
  const summaryBase = excerpt || plainText.slice(0, 240);
  const summary = normalizeText(
    [
      summaryBase,
      entry.actualOutcome
        ? `Recorded outcome: ${entry.actualOutcome}.`
        : entry.tradePhase
          ? `This note captures the ${entry.tradePhase} phase.`
          : "",
    ]
      .filter(Boolean)
      .join(" ")
  );

  const keyInsights = uniqueStrings([
    entry.actualOutcome ? `Outcome logged as ${entry.actualOutcome}.` : "",
    entry.tradePhase ? `Trade phase noted as ${entry.tradePhase}.` : "",
    entry.psychology
      ? `Psychology snapshot shows ${entry.psychology.emotionalState} with confidence ${entry.psychology.confidence}/10 and focus ${entry.psychology.focus}/10.`
      : "",
    entry.plannedRiskReward !== null && entry.plannedRiskReward !== undefined
      ? `Planned risk-reward was recorded as ${entry.plannedRiskReward}.`
      : "",
    topics.length > 0 ? `Main themes in this entry: ${topics.join(", ")}.` : "",
  ]).slice(0, 5);

  return {
    summary:
      summary ||
      "This entry contains enough context to review, but it needs a bit more detail for a richer AI summary.",
    keyInsights:
      keyInsights.length > 0
        ? keyInsights
        : ["Add more detail about the setup, execution, and outcome to deepen analysis."],
    patterns: buildFallbackPatterns(entry),
    sentiment,
    topics,
  };
}

function extractFirstJsonObject(text: string): string | null {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const source = fencedMatch?.[1] || text;
  const start = source.indexOf("{");

  if (start === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];

    if (escaping) {
      escaping = false;
      continue;
    }

    if (char === "\\") {
      escaping = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  return null;
}

function sanitizePatternType(value: unknown): JournalAIInsight["type"] {
  if (
    value === "pattern" ||
    value === "strength" ||
    value === "weakness" ||
    value === "recommendation" ||
    value === "correlation"
  ) {
    return value;
  }

  return "pattern";
}

function sanitizeSentiment(value: unknown): JournalAnalysisResult["sentiment"] {
  if (
    value === "positive" ||
    value === "negative" ||
    value === "neutral" ||
    value === "mixed"
  ) {
    return value;
  }

  return "neutral";
}

function mergeAnalysisResult(
  raw: unknown,
  fallback: JournalAnalysisResult
): JournalAnalysisResult {
  const parsed =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const sentiment =
    parsed.sentiment === undefined
      ? fallback.sentiment
      : sanitizeSentiment(parsed.sentiment);
  const summary =
    typeof parsed.summary === "string" && normalizeText(parsed.summary)
      ? normalizeText(parsed.summary)
      : fallback.summary;
  const keyInsights = Array.isArray(parsed.keyInsights)
    ? uniqueStrings(
        parsed.keyInsights
          .filter((value): value is string => typeof value === "string")
          .slice(0, 5)
      )
    : fallback.keyInsights;
  const topics = Array.isArray(parsed.topics)
    ? uniqueStrings(
        parsed.topics
          .filter((value): value is string => typeof value === "string")
          .slice(0, 5)
      )
    : fallback.topics;
  const patterns = Array.isArray(parsed.patterns)
    ? parsed.patterns
        .filter(
          (pattern): pattern is Record<string, unknown> =>
            !!pattern && typeof pattern === "object"
        )
        .map((pattern) => ({
          type: sanitizePatternType(pattern.type),
          title:
            typeof pattern.title === "string" && normalizeText(pattern.title)
              ? normalizeText(pattern.title)
              : fallback.patterns[0]?.title || "Journal pattern",
          description:
            typeof pattern.description === "string" &&
            normalizeText(pattern.description)
              ? normalizeText(pattern.description)
              : fallback.patterns[0]?.description ||
                "No description returned by the model.",
          confidence:
            typeof pattern.confidence === "number" &&
            Number.isFinite(pattern.confidence)
              ? Math.max(0, Math.min(1, pattern.confidence))
              : 0.6,
          createdAt: new Date().toISOString(),
        }))
        .slice(0, 5)
    : fallback.patterns;

  return {
    summary,
    keyInsights: keyInsights.length > 0 ? keyInsights : fallback.keyInsights,
    patterns: patterns.length > 0 ? patterns : fallback.patterns,
    sentiment,
    topics: topics.length > 0 ? topics : fallback.topics,
  };
}

async function persistJournalAnalysis(
  entryId: string,
  result: JournalAnalysisResult,
  plainText: string
) {
  await db
    .update(journalEntry)
    .set({
      aiSummary: result.summary,
      aiKeyInsights: result.keyInsights,
      aiPatterns: result.patterns,
      aiSentiment: result.sentiment,
      aiTopics: result.topics,
      aiAnalyzedAt: new Date(),
      plainTextContent: plainText,
      updatedAt: new Date(),
    })
    .where(eq(journalEntry.id, entryId));
}

export async function generateJournalSummary(entryId: string): Promise<JournalAnalysisResult> {
  const [entry] = await db
    .select()
    .from(journalEntry)
    .where(eq(journalEntry.id, entryId))
    .limit(1);

  if (!entry) {
    throw new Error("Journal entry not found");
  }

  const plainText = extractEntryAnalysisText(entry);
  
  if (!plainText) {
    throw new Error("Add some journal content before running AI analysis");
  }

  const fallbackResult = buildFallbackAnalysis(entry, plainText);

  const prompt = `Analyze this trading journal entry and provide:
1. A concise 2-3 sentence summary
2. 3-5 key insights extracted from the entry
3. Any patterns detected (psychological, behavioral, or trading-related)
4. Overall sentiment (positive/negative/neutral/mixed)
5. Main topics discussed

Journal Title: ${entry.title}
Journal Entry:
${plainText}

${entry.psychology ? `Psychology snapshot at time of writing:
- Mood: ${entry.psychology.mood}/10
- Confidence: ${entry.psychology.confidence}/10
- Emotional State: ${entry.psychology.emotionalState}
- Focus: ${entry.psychology.focus}/10
- Fear: ${entry.psychology.fear}/10
- Greed: ${entry.psychology.greed}/10` : ''}

${entry.tradePhase ? `Trade Phase: ${entry.tradePhase}` : ''}

Respond in JSON format:
{
  "summary": "string - 2-3 sentence summary",
  "keyInsights": ["string - insight 1", "string - insight 2", ...],
  "patterns": [
    {
      "type": "pattern|strength|weakness|recommendation|correlation",
      "title": "string",
      "description": "string",
      "confidence": 0.0-1.0
    }
  ],
  "sentiment": "positive|negative|neutral|mixed",
  "topics": ["string - topic 1", "string - topic 2", ...]
}`;

  if (!process.env.GEMINI_API_KEY) {
    await persistJournalAnalysis(entryId, fallbackResult, plainText);
    return fallbackResult;
  }

  try {
    const model = genAI.getGenerativeModel({ model: JOURNAL_MODEL });
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
      },
    });
    const response = result.response.text();
    const jsonText = extractFirstJsonObject(response);

    if (!jsonText) {
      console.error("No JSON found in AI response");
      await persistJournalAnalysis(entryId, fallbackResult, plainText);
      return fallbackResult;
    }

    const parsed = JSON.parse(jsonText);
    const mergedResult = mergeAnalysisResult(parsed, fallbackResult);
    await persistJournalAnalysis(entryId, mergedResult, plainText);
    return mergedResult;
  } catch (error) {
    console.error("Error generating journal summary:", error);
    await persistJournalAnalysis(entryId, fallbackResult, plainText);
    return fallbackResult;
  }
}

export async function extractPatternsFromEntries(
  userId: string,
  entryIds: string[]
): Promise<JournalAIInsight[]> {
  const entries = await db
    .select()
    .from(journalEntry)
    .where(and(eq(journalEntry.userId, userId), inArray(journalEntry.id, entryIds)))
    .limit(20);

  if (entries.length < 3) {
    return [];
  }

  const model = genAI.getGenerativeModel({ model: JOURNAL_MODEL });

  const entriesText = entries
    .filter(e => e.content)
    .map(e => {
      const blocks = e.content as JournalBlock[];
      const text = extractPlainText(blocks);
      return `Entry: ${e.title}\nDate: ${e.journalDate || e.createdAt}\n${text.slice(0, 500)}...`;
    })
    .join('\n\n---\n\n');

  const prompt = `Analyze these trading journal entries and identify patterns, strengths, weaknesses, and actionable recommendations.

${entriesText}

Identify:
1. Recurring patterns (behavioral, psychological, or trading-related)
2. Consistent strengths the trader demonstrates
3. Recurring weaknesses or areas for improvement
4. Correlations between psychology states and outcomes
5. Actionable recommendations

Respond in JSON format:
{
  "patterns": [
    {
      "type": "pattern|strength|weakness|recommendation|correlation",
      "title": "string",
      "description": "string",
      "confidence": 0.0-1.0
    }
  ]
}`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return [];
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.patterns.map((p: any) => ({
      ...p,
      createdAt: new Date().toISOString()
    }));
  } catch (error) {
    console.error("Error extracting patterns:", error);
    return [];
  }
}

export async function analyzeSentiment(text: string): Promise<'positive' | 'negative' | 'neutral' | 'mixed'> {
  const model = genAI.getGenerativeModel({ model: JOURNAL_MODEL });
  
  const prompt = `Analyze the sentiment of this trading journal text. Respond with exactly one word: positive, negative, neutral, or mixed.

Text: ${text.slice(0, 1000)}`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response.text().toLowerCase().trim();
    
    if (['positive', 'negative', 'neutral', 'mixed'].includes(response)) {
      return response as 'positive' | 'negative' | 'neutral' | 'mixed';
    }
    return 'neutral';
  } catch {
    return 'neutral';
  }
}

export async function extractTopics(text: string): Promise<string[]> {
  const model = genAI.getGenerativeModel({ model: JOURNAL_MODEL });
  
  const prompt = `Extract the main topics from this trading journal text. Respond with a JSON array of 3-5 topic strings.

Text: ${text.slice(0, 1000)}`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [];
    }
    
    return JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }
}

export async function generateJournalContextQuery(
  userQuery: string,
  userId: string
): Promise<{ answer: string; relevantEntries: string[] }> {
  const model = genAI.getGenerativeModel({ model: JOURNAL_MODEL });
  
  const entries = await db
    .select({
      id: journalEntry.id,
      title: journalEntry.title,
      aiSummary: journalEntry.aiSummary,
      aiTopics: journalEntry.aiTopics,
      plainTextContent: journalEntry.plainTextContent,
    })
    .from(journalEntry)
    .where(eq(journalEntry.userId, userId))
    .limit(50);

  const entriesContext = entries
    .filter(e => e.aiSummary || e.plainTextContent)
    .map(e => ({
      id: e.id,
      title: e.title,
      summary: e.aiSummary || (e.plainTextContent?.slice(0, 300) + '...'),
      topics: e.aiTopics || []
    }));

  const prompt = `You are analyzing a trader's journal to answer their question. Use the journal entries provided to give a helpful, contextual answer.

User Question: ${userQuery}

Journal Entries Summary:
${entriesContext.map(e => `- [${e.id}] ${e.title}: ${e.summary}`).join('\n')}

Provide:
1. A direct answer to the question based on journal content
2. IDs of entries that are most relevant

Respond in JSON format:
{
  "answer": "string - your answer to the question",
  "relevantEntryIds": ["id1", "id2", ...]
}`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { answer: "I couldn't find relevant information in your journal.", relevantEntries: [] };
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      answer: parsed.answer,
      relevantEntries: parsed.relevantEntryIds || []
    };
  } catch (error) {
    console.error("Error generating journal context:", error);
    return { answer: "Error analyzing journal entries.", relevantEntries: [] };
  }
}
