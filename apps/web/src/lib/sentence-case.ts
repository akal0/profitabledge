const SENTENCE_CASE_PRESERVE_TOKEN_RE =
  /^(?:[A-Z0-9]{2,}|[A-Z0-9]+(?:[\/&+-][A-Z0-9]+)+)$/;

function normalizeSentenceCaseToken(token: string, isFirstToken: boolean) {
  const match = token.match(/^([^A-Za-z0-9]*)(.*?)([^A-Za-z0-9]*)$/);
  if (!match) return token;

  const [, leading, core, trailing] = match;
  if (!core || !/[A-Za-z]/.test(core)) return token;

  const shouldPreserve =
    SENTENCE_CASE_PRESERVE_TOKEN_RE.test(core) ||
    /[a-z][A-Z]|[A-Z][a-z]+[A-Z]/.test(core);

  if (shouldPreserve) {
    return `${leading}${core}${trailing}`;
  }

  if (isFirstToken) {
    return `${leading}${core.charAt(0).toUpperCase()}${core
      .slice(1)
      .toLowerCase()}${trailing}`;
  }

  return `${leading}${core.toLowerCase()}${trailing}`;
}

export function toSentenceCase(value: string): string {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";

  return trimmed
    .replace(/\s+/g, " ")
    .split(" ")
    .map((token, index) => normalizeSentenceCaseToken(token, index === 0))
    .join(" ");
}
