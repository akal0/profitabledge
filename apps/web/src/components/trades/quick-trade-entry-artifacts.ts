import type { MediaFile } from "@/components/media/media-dropzone";
import type { JournalBlock } from "@/components/journal/types";
import { trpcClient } from "@/utils/trpc";

function flattenJournalBlockText(block: JournalBlock): string {
  const segments: string[] = [];

  if (typeof block.content === "string" && block.content.trim().length > 0) {
    segments.push(block.content.trim());
  }

  if (Array.isArray(block.children)) {
    for (const child of block.children) {
      const childText = flattenJournalBlockText(child);
      if (childText) {
        segments.push(childText);
      }
    }
  }

  return segments.join(" ").trim();
}

function extractPlainText(blocks: JournalBlock[]) {
  return blocks
    .map((block) => flattenJournalBlockText(block))
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function countWords(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Failed to read file"));
    };

    reader.onerror = () => {
      reject(reader.error ?? new Error("Failed to read file"));
    };

    reader.readAsDataURL(file);
  });
}

async function uploadTradeMediaFile(tradeId: string, mediaFile: MediaFile) {
  const url = await readFileAsDataUrl(mediaFile.file);

  await trpcClient.journal.createTradeMedia.mutate({
    tradeId,
    mediaType: mediaFile.type,
    url,
    thumbnailUrl: mediaFile.preview,
    fileName: mediaFile.file.name,
    fileSize: mediaFile.file.size,
    mimeType: mediaFile.file.type,
    width: 0,
    height: 0,
  });
}

export async function persistQuickTradeEntryArtifacts(input: {
  tradeId: string;
  noteContent: JournalBlock[];
  noteHtml?: string;
  mediaFiles: MediaFile[];
}) {
  const { tradeId, noteContent, noteHtml, mediaFiles } = input;
  const plainTextContent = extractPlainText(noteContent);
  const validMediaFiles = mediaFiles.filter((file) => !file.error);

  let noteSaved = false;
  let noteFailed = false;
  let uploadedMediaCount = 0;
  let failedMediaCount = 0;

  if (plainTextContent.length > 0) {
    try {
      await trpcClient.tradeNotes.upsert.mutate({
        tradeId,
        content: noteContent,
        htmlContent: noteHtml || undefined,
        plainTextContent,
        wordCount: countWords(plainTextContent),
      });
      noteSaved = true;
    } catch {
      noteFailed = true;
    }
  }

  if (validMediaFiles.length > 0) {
    const uploadResults = await Promise.allSettled(
      validMediaFiles.map((mediaFile) =>
        uploadTradeMediaFile(tradeId, mediaFile)
      )
    );

    uploadedMediaCount = uploadResults.filter(
      (result) => result.status === "fulfilled"
    ).length;
    failedMediaCount = uploadResults.length - uploadedMediaCount;
  }

  return {
    noteSaved,
    noteFailed,
    uploadedMediaCount,
    failedMediaCount,
  };
}
