export function toSentenceCaseTitle(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  return trimmed
    .split(/\s+/)
    .map((word, index) => {
      if (index === 0) {
        if (/^[A-Z0-9:%/.-]+$/.test(word)) {
          return word;
        }

        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }

      if (/^[A-Z0-9:%/.-]+$/.test(word)) {
        return word;
      }

      return word.toLowerCase();
    })
    .join(" ");
}
