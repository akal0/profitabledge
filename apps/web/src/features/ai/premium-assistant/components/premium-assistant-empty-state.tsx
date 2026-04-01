"use client";

const SUGGESTION_ROW_SIZES = [1, 2, 3, 2, 1];
const SUGGESTION_SKELETON_WIDTHS = [
  [168],
  [228, 194],
  [248, 294, 236],
  [212, 184],
  [176],
];

function arrangeSuggestionsForPyramid(suggestions: string[]) {
  if (suggestions.length <= 2) {
    return suggestions;
  }

  const sortedByLength = [...suggestions].sort((a, b) => {
    if (a.length === b.length) {
      return a.localeCompare(b);
    }

    return a.length - b.length;
  });

  const positions = Array.from({ length: sortedByLength.length }, (_, index) => index)
    .sort((a, b) => {
      const midpoint = (sortedByLength.length - 1) / 2;
      const distanceA = Math.abs(a - midpoint);
      const distanceB = Math.abs(b - midpoint);

      if (distanceA === distanceB) {
        return a - b;
      }

      return distanceA - distanceB;
    });

  const arranged = new Array<string>(sortedByLength.length);

  [...sortedByLength].reverse().forEach((suggestion, index) => {
    arranged[positions[index]!] = suggestion;
  });

  return arranged.filter(Boolean);
}

export function PremiumAssistantEmptyState({
  onSuggestionClick,
  suggestions,
  isLoadingSuggestions = false,
}: {
  onSuggestionClick: (suggestion: string) => void;
  suggestions: string[];
  isLoadingSuggestions?: boolean;
}) {
  const arrangedSuggestions = arrangeSuggestionsForPyramid(suggestions);
  const suggestionRows = SUGGESTION_ROW_SIZES.reduce<string[][]>(
    (rows, rowSize) => {
      const start = rows.flat().length;
      const row = arrangedSuggestions.slice(start, start + rowSize);
      if (row.length > 0) {
        rows.push(row);
      }
      return rows;
    },
    []
  );

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center p-8 text-center">
      <div className="relative z-10 mx-auto w-full max-w-4xl space-y-8">
        <div className="space-y-2">
          <h3 className="text-3xl font-medium tracking-[-0.04em] text-white sm:text-[2.15rem] sm:leading-[1.02]">
            Your edge assistant
          </h3>
          <p className="mx-auto max-w-md text-sm leading-6 text-white/56 sm:text-[15px]">
            Ask questions about your trades, analyze performance, compare
            sessions, or discover patterns in your data.
          </p>
        </div>

        <div className="w-full">
          <div className="flex w-full flex-col items-center gap-2">
            {isLoadingSuggestions
              ? SUGGESTION_SKELETON_WIDTHS.map((row, index) => (
                  <div
                    key={`skeleton-${index}`}
                    className="flex items-center justify-center gap-2"
                  >
                    {row.map((width, itemIndex) => (
                      <div
                        key={`${index}-${itemIndex}`}
                        className="h-10 animate-pulse rounded-full border border-white/8 bg-white/6"
                        style={{ width }}
                      />
                    ))}
                  </div>
                ))
              : suggestionRows.map((row, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-center gap-2"
                  >
                    {row.map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => onSuggestionClick(suggestion)}
                        className="inline-flex cursor-pointer items-center justify-center whitespace-nowrap rounded-full border border-white/10 bg-white/6 px-4 py-2 text-[13px] font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                ))}
          </div>
        </div>
      </div>
    </div>
  );
}
