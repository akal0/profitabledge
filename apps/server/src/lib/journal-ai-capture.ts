import { GoogleAIFileManager } from "@google/generative-ai/server";
import { generateMeteredGeminiContent } from "./ai/gemini";
import { getDecryptedAIProviderKey } from "./ai/provider-keys";
import { getServerEnv } from "./env";
import type { JournalBlock, PsychologySnapshot } from "../db/schema/journal";

type JournalAICaptureEntryType =
  | "general"
  | "daily"
  | "weekly"
  | "monthly"
  | "trade_review"
  | "strategy"
  | "comparison"
  | "backtest";

type JournalAICaptureOutcome =
  | "win"
  | "loss"
  | "breakeven"
  | "scratched"
  | null;

type JournalAIParsedCapture = {
  title?: string;
  journalDate?: string | null;
  tags?: string[];
  entryType?: JournalAICaptureEntryType | null;
  tradePhase?: "pre-trade" | "during-trade" | "post-trade" | null;
  psychology?: Partial<PsychologySnapshot> | null;
  plannedEntryPrice?: string | null;
  plannedExitPrice?: string | null;
  plannedStopLoss?: string | null;
  plannedTakeProfit?: string | null;
  plannedRiskReward?: string | null;
  plannedNotes?: string | null;
  actualOutcome?: JournalAICaptureOutcome;
  actualPnl?: string | null;
  actualPips?: string | null;
  postTradeAnalysis?: string | null;
  lessonsLearned?: string | null;
  transcript?: string | null;
  summary?: string | null;
  contentBlocks?: JournalBlock[];
};

function toSentenceCase(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "Journal capture";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function buildFallbackCapture(text: string) {
  const trimmed = text.trim();
  const lowered = trimmed.toLowerCase();
  const tags = [
    ...new Set(
      ["revenge", "fomo", "discipline", "fear", "greed", "patience"]
        .filter((tag) => lowered.includes(tag))
        .concat(
          Array.from(trimmed.matchAll(/#([a-z0-9_-]+)/gi)).map(
            (match) => match[1]!.toLowerCase()
          )
        )
    ),
  ];

  const contentBlocks: JournalBlock[] = trimmed
    ? [
        {
          id: crypto.randomUUID(),
          type: "paragraph",
          content: trimmed,
          props: undefined,
        },
      ]
    : [];

  return {
    title: toSentenceCase(trimmed.split(/[.!?]/)[0] ?? "Journal capture"),
    journalDate: null,
    tags,
    entryType: null,
    tradePhase: null,
    psychology: null,
    plannedEntryPrice: null,
    plannedExitPrice: null,
    plannedStopLoss: null,
    plannedTakeProfit: null,
    plannedRiskReward: null,
    plannedNotes: null,
    actualOutcome: null,
    actualPnl: null,
    actualPips: null,
    postTradeAnalysis: null,
    lessonsLearned: null,
    transcript: null,
    summary: trimmed ? trimmed.slice(0, 240) : null,
    contentBlocks,
  };
}

function extractJsonObject(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() || trimmed;

  try {
    return JSON.parse(candidate) as JournalAIParsedCapture;
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1)) as JournalAIParsedCapture;
      } catch {
        return null;
      }
    }

    return null;
  }
}

function normalizeBlocks(
  blocks: JournalBlock[] | undefined,
  summary: string | null,
  transcript: string | null
): JournalBlock[] {
  if (blocks && blocks.length > 0) {
    return blocks
      .filter((block) => Boolean(block.type))
      .map((block) => ({
        ...block,
        id: block.id || crypto.randomUUID(),
      }));
  }

  const fallbackText = summary || transcript;
  return fallbackText
    ? [
        {
          id: crypto.randomUUID(),
          type: "paragraph",
          content: fallbackText,
          props: undefined,
        },
      ]
    : [];
}

async function resolveGeminiApiKey(userId: string) {
  const storedKey = await getDecryptedAIProviderKey(userId, "gemini");
  if (storedKey) {
    return storedKey.apiKey;
  }

  const env = getServerEnv();
  const platformApiKey = env.GEMINI_API_KEY ?? env.GOOGLE_GENERATIVE_AI_API_KEY ?? null;
  if (!platformApiKey) {
    throw new Error("AI is unavailable right now. Please try again later.");
  }

  return platformApiKey;
}

async function waitForGeminiFileReady(fileManager: GoogleAIFileManager, fileName: string) {
  const deadline = Date.now() + 120_000;
  let current = await fileManager.getFile(fileName);

  while (current.state === "PROCESSING" && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 2_500));
    current = await fileManager.getFile(fileName);
  }

  if (current.state !== "ACTIVE") {
    throw new Error("Video transcription failed to finish processing");
  }

  return current;
}

async function transcribeVideoCapture(input: {
  userId: string;
  text: string;
  videoUrl: string;
  videoName?: string;
  videoMimeType?: string;
  accountId?: string;
}) {
  const apiKey = await resolveGeminiApiKey(input.userId);
  const response = await fetch(input.videoUrl);

  if (!response.ok) {
    throw new Error("Failed to fetch the uploaded video");
  }

  const mimeType =
    input.videoMimeType ||
    response.headers.get("content-type") ||
    "video/mp4";

  const uploadBuffer = Buffer.from(await response.arrayBuffer());
  const fileManager = new GoogleAIFileManager(apiKey);
  let uploadedFileName: string | null = null;
  try {
    const upload = await fileManager.uploadFile(uploadBuffer, {
      mimeType,
      displayName: input.videoName || "journal-capture-video",
    });
    uploadedFileName = upload.file.name;
    const activeFile = await waitForGeminiFileReady(fileManager, upload.file.name);

    const prompt = `You are transcribing and structuring a trading journal video.

Use the video as the source of truth. If there is narration, transcribe it. If the audio is silent or unclear, summarize the visible content and say so in the transcript.

Return JSON with these keys only:
{
  "title": "short title",
  "journalDate": "ISO date string or null",
  "tags": ["tag"],
  "entryType": "general|daily|weekly|monthly|trade_review|strategy|comparison|backtest|null",
  "tradePhase": "pre-trade|during-trade|post-trade|null",
  "psychology": {
    "mood": 1-10,
    "confidence": 1-10,
    "energy": 1-10,
    "focus": 1-10,
    "fear": 1-10,
    "greed": 1-10,
    "emotionalState": "calm|confident|neutral|excited|anxious|stressed|frustrated|angry|confused|discouraged|overwhelmed|regretful|impatient",
    "notes": "string or null"
  },
  "plannedEntryPrice": "string or null",
  "plannedExitPrice": "string or null",
  "plannedStopLoss": "string or null",
  "plannedTakeProfit": "string or null",
  "plannedRiskReward": "string or null",
  "plannedNotes": "string or null",
  "actualOutcome": "win|loss|breakeven|scratched|null",
  "actualPnl": "string or null",
  "actualPips": "string or null",
  "postTradeAnalysis": "string or null",
  "lessonsLearned": "string or null",
  "summary": "2-4 sentence summary",
  "transcript": "verbatim or cleaned transcription",
  "contentBlocks": [
    {
      "id": "string",
      "type": "paragraph|bulletList|numberedList|quote|callout",
      "content": "string",
      "props": {}
    }
  ]
}

The text note the user provided is:
${input.text || "(none)"}

Keep the contentBlocks concise and useful for inserting directly into the journal.`;

    const result = await generateMeteredGeminiContent({
      userId: input.userId,
      accountId: input.accountId,
      featureKey: "journal.capture.video_transcription",
      model: "gemini-2.5-flash",
      request: {
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                fileData: {
                  fileUri: activeFile.uri,
                  mimeType,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 16384,
          responseMimeType: "application/json",
        },
      },
      metadata: {
        videoUrl: input.videoUrl,
        videoName: input.videoName || null,
      },
    });

    const responseText = result.response.text();
    const parsed = extractJsonObject(responseText);
    if (!parsed) {
      console.error("[journal-ai-capture] unparseable Gemini response:", responseText.slice(0, 1000));
      throw new Error("Failed to parse video transcription result");
    }

    const fallback = buildFallbackCapture(input.text);
    const summary = typeof parsed.summary === "string" && parsed.summary.trim()
      ? parsed.summary.trim()
      : fallback.summary;
    const transcript = typeof parsed.transcript === "string" && parsed.transcript.trim()
      ? parsed.transcript.trim()
      : null;

    const contentBlocks = normalizeBlocks(parsed.contentBlocks, summary, transcript);
    const hasVideoBlock = contentBlocks.some((block) => block.type === "video");
    if (!hasVideoBlock) {
      contentBlocks.unshift({
        id: crypto.randomUUID(),
        type: "video",
        content: "",
        props: {
          videoUrl: input.videoUrl,
          videoCaption: input.videoName || "Trade video",
          videoMuted: true,
          videoAutoplay: false,
        },
      });
    }

    return {
      title:
        typeof parsed.title === "string" && parsed.title.trim()
          ? parsed.title.trim()
          : fallback.title,
      journalDate:
        typeof parsed.journalDate === "string" || parsed.journalDate === null
          ? parsed.journalDate
          : fallback.journalDate,
      tags: Array.isArray(parsed.tags)
        ? parsed.tags.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean)
        : fallback.tags,
      entryType:
        parsed.entryType &&
        ["general", "daily", "weekly", "monthly", "trade_review", "strategy", "comparison", "backtest"].includes(parsed.entryType)
          ? parsed.entryType
          : fallback.entryType,
      tradePhase:
        parsed.tradePhase &&
        ["pre-trade", "during-trade", "post-trade"].includes(parsed.tradePhase)
          ? parsed.tradePhase
          : fallback.tradePhase,
      psychology:
        parsed.psychology &&
        typeof parsed.psychology === "object"
          ? Object.fromEntries(
              Object.entries(parsed.psychology).filter(([, v]) => v != null)
            )
          : fallback.psychology,
      plannedEntryPrice:
        typeof parsed.plannedEntryPrice === "string" || parsed.plannedEntryPrice === null
          ? parsed.plannedEntryPrice
          : fallback.plannedEntryPrice,
      plannedExitPrice:
        typeof parsed.plannedExitPrice === "string" || parsed.plannedExitPrice === null
          ? parsed.plannedExitPrice
          : fallback.plannedExitPrice,
      plannedStopLoss:
        typeof parsed.plannedStopLoss === "string" || parsed.plannedStopLoss === null
          ? parsed.plannedStopLoss
          : fallback.plannedStopLoss,
      plannedTakeProfit:
        typeof parsed.plannedTakeProfit === "string" || parsed.plannedTakeProfit === null
          ? parsed.plannedTakeProfit
          : fallback.plannedTakeProfit,
      plannedRiskReward:
        typeof parsed.plannedRiskReward === "string" || parsed.plannedRiskReward === null
          ? parsed.plannedRiskReward
          : fallback.plannedRiskReward,
      plannedNotes:
        typeof parsed.plannedNotes === "string" || parsed.plannedNotes === null
          ? parsed.plannedNotes
          : fallback.plannedNotes,
      actualOutcome:
        parsed.actualOutcome &&
        ["win", "loss", "breakeven", "scratched"].includes(parsed.actualOutcome)
          ? parsed.actualOutcome
          : fallback.actualOutcome,
      actualPnl:
        typeof parsed.actualPnl === "string" || parsed.actualPnl === null
          ? parsed.actualPnl
          : fallback.actualPnl,
      actualPips:
        typeof parsed.actualPips === "string" || parsed.actualPips === null
          ? parsed.actualPips
          : fallback.actualPips,
      postTradeAnalysis:
        typeof parsed.postTradeAnalysis === "string" || parsed.postTradeAnalysis === null
          ? parsed.postTradeAnalysis
          : fallback.postTradeAnalysis,
      lessonsLearned:
        typeof parsed.lessonsLearned === "string" || parsed.lessonsLearned === null
          ? parsed.lessonsLearned
          : fallback.lessonsLearned,
      transcript,
      summary,
      contentBlocks,
    };
  } finally {
    if (uploadedFileName) {
      void fileManager.deleteFile(uploadedFileName).catch((error) => {
        console.error("[journal-ai-capture] failed to delete Gemini file", error);
      });
    }
  }
}

export async function parseNaturalJournalCapture(
  text: string,
  context?: {
    userId?: string;
    accountId?: string;
    videoUrl?: string;
    videoName?: string;
    videoMimeType?: string;
  }
) {
  const trimmed = text.trim();

  if (context?.userId && context.videoUrl) {
    return await transcribeVideoCapture({
      userId: context.userId,
      accountId: context.accountId,
      text: trimmed,
      videoUrl: context.videoUrl,
      videoName: context.videoName,
      videoMimeType: context.videoMimeType,
    });
  }

  return buildFallbackCapture(trimmed);
}
