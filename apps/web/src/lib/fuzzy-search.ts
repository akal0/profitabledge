/**
 * Simple fuzzy search implementation
 * Scores matches based on consecutive character matches and position
 */
export function fuzzyMatch(text: string, query: string): { matches: boolean; score: number } {
  if (!query) return { matches: true, score: 1 };
  if (!text) return { matches: false, score: 0 };

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // Exact match gets highest score
  if (lowerText === lowerQuery) {
    return { matches: true, score: 1000 };
  }

  // Contains exact substring gets high score
  if (lowerText.includes(lowerQuery)) {
    const index = lowerText.indexOf(lowerQuery);
    // Earlier matches score higher
    const positionScore = 1 - (index / lowerText.length);
    return { matches: true, score: 500 + (positionScore * 100) };
  }

  // Fuzzy match: check if all characters in query appear in order in text
  let textIndex = 0;
  let queryIndex = 0;
  let consecutiveMatches = 0;
  let maxConsecutive = 0;
  let matchPositions: number[] = [];

  while (textIndex < lowerText.length && queryIndex < lowerQuery.length) {
    if (lowerText[textIndex] === lowerQuery[queryIndex]) {
      matchPositions.push(textIndex);
      queryIndex++;
      consecutiveMatches++;
      maxConsecutive = Math.max(maxConsecutive, consecutiveMatches);
    } else {
      consecutiveMatches = 0;
    }
    textIndex++;
  }

  // All query characters must be found in order
  if (queryIndex !== lowerQuery.length) {
    return { matches: false, score: 0 };
  }

  // Calculate score based on:
  // 1. How many consecutive matches
  // 2. How early the match starts
  // 3. How compact the matches are
  const consecutiveBonus = (maxConsecutive / lowerQuery.length) * 100;
  const startPositionBonus = matchPositions.length > 0
    ? (1 - (matchPositions[0] / lowerText.length)) * 50
    : 0;
  const compactnessBonus = matchPositions.length > 1
    ? (1 - ((matchPositions[matchPositions.length - 1] - matchPositions[0]) / lowerText.length)) * 50
    : 25;

  const score = consecutiveBonus + startPositionBonus + compactnessBonus;

  return { matches: true, score };
}

/**
 * Search through multiple fields with fuzzy matching
 */
export function fuzzySearchFields<T extends Record<string, any>>(
  item: T,
  query: string,
  fields: (keyof T)[]
): { matches: boolean; score: number } {
  if (!query) return { matches: true, score: 1 };

  let bestScore = 0;
  let anyMatch = false;

  for (const field of fields) {
    const value = item[field];
    if (value == null) continue;

    const stringValue = String(value);
    const result = fuzzyMatch(stringValue, query);

    if (result.matches) {
      anyMatch = true;
      bestScore = Math.max(bestScore, result.score);
    }
  }

  return { matches: anyMatch, score: bestScore };
}

/**
 * Filter and sort array by fuzzy search
 */
export function fuzzyFilterAndSort<T extends Record<string, any>>(
  items: T[],
  query: string,
  fields: (keyof T)[]
): T[] {
  if (!query) return items;

  const results = items
    .map(item => ({
      item,
      ...fuzzySearchFields(item, query, fields),
    }))
    .filter(result => result.matches)
    .sort((a, b) => b.score - a.score)
    .map(result => result.item);

  return results;
}
