"use client";

export function PremiumAssistantEmptyState({
  onSuggestionClick,
  suggestions,
}: {
  onSuggestionClick: (suggestion: string) => void;
  suggestions: string[];
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <div className="space-y-2">
          <h3 className="text-3xl font-medium text-white">
            Your edge assistant
          </h3>
          <p className="mx-auto max-w-md text-sm text-white/50">
            Ask questions about your trades, analyze performance, compare sessions,
            or discover patterns in your data.
          </p>
        </div>

        <div className="w-full">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/40">
            Try asking
          </p>

          <div className="flex w-full flex-wrap justify-center gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => onSuggestionClick(suggestion)}
                className="inline-flex cursor-pointer items-center justify-center rounded-full border border-white/5 bg-sidebar px-4 py-2 text-[13px] font-medium text-white/80 transition-colors hover:bg-sidebar-accent hover:text-white"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
