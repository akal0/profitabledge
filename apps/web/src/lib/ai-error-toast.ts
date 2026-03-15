import { toast } from "sonner";

const AI_ERROR_WINDOW_MS = 3000;

let lastAIToast: { key: string; at: number } | null = null;

function extractMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) {
      return message;
    }
  }

  return "Something went wrong.";
}

export function isAIErrorMessage(message: string): boolean {
  return message.trim().toLowerCase().startsWith("ai ");
}

export function showAIErrorToast(error: unknown): boolean {
  const message = extractMessage(error);

  if (!isAIErrorMessage(message)) {
    return false;
  }

  const key = message.trim().toLowerCase();
  const now = Date.now();

  if (lastAIToast && lastAIToast.key === key && now - lastAIToast.at < AI_ERROR_WINDOW_MS) {
    return true;
  }

  lastAIToast = { key, at: now };
  toast.error(message);
  return true;
}
