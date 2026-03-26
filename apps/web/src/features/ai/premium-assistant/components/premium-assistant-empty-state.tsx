"use client";

const SUGGESTION_ROW_SIZES = [1, 2, 3, 2, 1];

export function PremiumAssistantEmptyState({
  onSuggestionClick,
  suggestions,
}: {
  onSuggestionClick: (suggestion: string) => void;
  suggestions: string[];
}) {
  const suggestionRows = SUGGESTION_ROW_SIZES.reduce<string[][]>(
    (rows, rowSize) => {
      const start = rows.flat().length;
      const row = suggestions.slice(start, start + rowSize);
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
            {suggestionRows.map((row, index) => (
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
