import { TRPCError } from "@trpc/server";

type AIErrorCode =
  | "PAYMENT_REQUIRED"
  | "TOO_MANY_REQUESTS"
  | "SERVICE_UNAVAILABLE";

export interface NormalizedAIProviderError {
  code: AIErrorCode;
  httpStatus: number;
  message: string;
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object" && "statusText" in error) {
    const statusText = (error as { statusText?: unknown }).statusText;
    if (typeof statusText === "string" && statusText) {
      return statusText;
    }
  }

  return "Unknown AI provider error";
}

function extractErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const candidate = error as { status?: unknown };
  if (typeof candidate.status === "number" && Number.isFinite(candidate.status)) {
    return candidate.status;
  }

  return null;
}

export function normalizeAIProviderError(
  error: unknown,
  fallbackMessage = "AI is temporarily unavailable. Please try again later."
): NormalizedAIProviderError {
  const status = extractErrorStatus(error);
  const message = extractErrorMessage(error).toLowerCase();

  if (
    /\bedge credits?\b/.test(message) ||
    /\binsufficient credits?\b/.test(message) ||
    /\bpayment required\b/.test(message)
  ) {
    return {
      code: "PAYMENT_REQUIRED",
      httpStatus: 402,
      message:
        "No Edge credits remain for platform AI this billing cycle. Upgrade your plan or wait for the next reset.",
    };
  }

  if (
    status === 429 ||
    /\btoo many requests\b/.test(message) ||
    /\brate[-\s]?limit/.test(message) ||
    /\bquota\b/.test(message)
  ) {
    return {
      code: "TOO_MANY_REQUESTS",
      httpStatus: 429,
      message: "AI is temporarily rate-limited. Please wait a minute and try again.",
    };
  }

  if (
    status === 401 ||
    status === 403 ||
    /\bunauthorized\b/.test(message) ||
    /\bforbidden\b/.test(message) ||
    /\bapi key\b/.test(message)
  ) {
    return {
      code: "SERVICE_UNAVAILABLE",
      httpStatus: 503,
      message: "AI is unavailable right now. Please try again later.",
    };
  }

  if (
    status === 408 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    /\bunavailable\b/.test(message) ||
    /\btimeout\b/.test(message) ||
    /\btimed out\b/.test(message) ||
    /\bnetwork\b/.test(message) ||
    /\bfetch\b/.test(message) ||
    /\bsocket\b/.test(message) ||
    /\beconn/.test(message)
  ) {
    return {
      code: "SERVICE_UNAVAILABLE",
      httpStatus: 503,
      message: "AI is temporarily unavailable. Please try again later.",
    };
  }

  return {
    code: "SERVICE_UNAVAILABLE",
    httpStatus: 503,
    message: fallbackMessage,
  };
}

export function toTRPCAIError(
  error: unknown,
  fallbackMessage?: string
): TRPCError {
  const normalized = normalizeAIProviderError(error, fallbackMessage);

  return new TRPCError({
    code:
      normalized.code === "PAYMENT_REQUIRED"
        ? "PRECONDITION_FAILED"
        : normalized.code,
    message: normalized.message,
  });
}

export function logAIProviderError(
  context: string,
  error: unknown,
  fallbackMessage?: string
) {
  const normalized = normalizeAIProviderError(error, fallbackMessage);
  const logger =
    normalized.code === "TOO_MANY_REQUESTS" ||
    normalized.code === "PAYMENT_REQUIRED"
      ? console.warn
      : console.error;

  logger(`[AI] ${context}: ${normalized.message}`);

  return normalized;
}
