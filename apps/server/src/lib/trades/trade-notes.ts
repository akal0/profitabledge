import { eq, inArray } from "drizzle-orm";

import { db } from "../../db";
import { tradeNote } from "../../db/schema/journal";

export async function upsertPlainTextTradeNotes(input: {
  userId: string;
  tradeIds: string[];
  note: string;
  appendToExisting?: boolean;
  existingNotes: Array<{
    id: string;
    tradeId: string;
    content: unknown;
    plainTextContent: string | null;
  }>;
}) {
  const existingByTradeId = new Map(
    input.existingNotes.map((noteRow) => [noteRow.tradeId, noteRow])
  );

  let updatedCount = 0;
  let createdCount = 0;

  for (const tradeId of input.tradeIds) {
    const existing = existingByTradeId.get(tradeId);
    const plainTextContent =
      input.appendToExisting && existing?.plainTextContent
        ? `${existing.plainTextContent}\n${input.note}`.trim()
        : input.note.trim();

    const content = [
      {
        id: crypto.randomUUID(),
        type: "paragraph",
        content: plainTextContent,
        props: undefined,
      },
    ];

    if (existing) {
      await db
        .update(tradeNote)
        .set({
          content,
          plainTextContent,
          wordCount: plainTextContent.split(/\s+/).filter(Boolean).length,
          updatedAt: new Date(),
        })
        .where(eq(tradeNote.id, existing.id));
      updatedCount += 1;
    } else {
      await db.insert(tradeNote).values({
        id: crypto.randomUUID(),
        tradeId,
        userId: input.userId,
        content,
        plainTextContent,
        wordCount: plainTextContent.split(/\s+/).filter(Boolean).length,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      createdCount += 1;
    }
  }

  return {
    updatedCount,
    createdCount,
    noteAppliedTo: input.tradeIds.length,
  };
}
