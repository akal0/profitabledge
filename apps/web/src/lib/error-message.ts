const ERROR_CODE_MESSAGES: Record<string, string> = {
  AUTH_CANCELLED: "Passkey request was cancelled or not allowed.",
  REGISTRATION_CANCELLED: "Passkey registration was cancelled or not allowed.",
  PREVIOUSLY_REGISTERED: "This passkey is already registered.",
};

function lookupErrorCodeMessage(code: string) {
  return ERROR_CODE_MESSAGES[code] ?? null;
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (!error) {
    return fallback;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  if (typeof error !== "object") {
    return fallback;
  }

  const candidate = error as {
    message?: unknown;
    error?: unknown;
    code?: unknown;
    toString?: () => string;
  };

  if (typeof candidate.message === "string" && candidate.message.trim()) {
    return candidate.message;
  }

  if (candidate.message && typeof candidate.message === "object") {
    return getErrorMessage(candidate.message, fallback);
  }

  if (candidate.error) {
    return getErrorMessage(candidate.error, fallback);
  }

  if (typeof candidate.code === "string" && candidate.code.trim()) {
    return lookupErrorCodeMessage(candidate.code) ?? candidate.code;
  }

  if (typeof candidate.toString === "function") {
    const value = candidate.toString();
    if (value && value !== "[object Object]") {
      return lookupErrorCodeMessage(value) ?? value;
    }
  }

  return fallback;
}
