import type { JournalBlock } from "../db/schema/journal";

function toSentenceCase(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "Journal capture";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export async function parseNaturalJournalCapture(
  text: string,
  _context?: { userId?: string; accountId?: string }
) {
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
    contentBlocks,
  };
}
