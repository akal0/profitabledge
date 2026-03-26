"use client";

import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import type { SuggestionItem } from "@/components/ai/types";
import { trpcOptions } from "@/utils/trpc";

interface UsePremiumAssistantSuggestionsOptions {
  accountId?: string;
}

function normalizeSuggestionItems(items: SuggestionItem[]) {
  const seen = new Map<string, number>();

  return items.map((item) => {
    const baseId = `${item.type}:${item.category || "uncategorized"}:${item.id}:${item.name}`;
    const count = seen.get(baseId) ?? 0;
    seen.set(baseId, count + 1);

    return {
      ...item,
      id: count === 0 ? baseId : `${baseId}:${count}`,
    };
  });
}

export function usePremiumAssistantSuggestions({
  accountId,
}: UsePremiumAssistantSuggestionsOptions) {
  const sessionTagsOpts = trpcOptions.trades.listSessionTags.queryOptions({
    accountId: accountId || "",
  });
  const { data: sessionTags } = useQuery({
    ...sessionTagsOpts,
    enabled: Boolean(accountId),
  });

  const modelTagsOpts = trpcOptions.trades.listModelTags.queryOptions({
    accountId: accountId || "",
  });
  const { data: modelTags } = useQuery({
    ...modelTagsOpts,
    enabled: Boolean(accountId),
  });

  const symbolsOpts = trpcOptions.trades.listSymbols.queryOptions({
    accountId: accountId || "",
  });
  const { data: symbols } = useQuery({
    ...symbolsOpts,
    enabled: Boolean(accountId),
  });

  const sessionTagsList = useMemo(() => (sessionTags as any[]) || [], [sessionTags]);
  const modelTagsList = useMemo(() => (modelTags as any[]) || [], [modelTags]);
  const symbolsList = useMemo(() => (symbols as string[]) || [], [symbols]);

  const fetchSuggestions = useCallback(
    async (query: string, type: "mention" | "command") => {
      const lowerQuery = query.toLowerCase();

      if (type === "command") {
        const { TRADE_COMMAND_SUGGESTIONS } = await import("@/components/ai/trade-command-suggestions");
        return normalizeSuggestionItems(TRADE_COMMAND_SUGGESTIONS.filter((item) => {
          if (!query) return true;
          return (
            item.name.toLowerCase().includes(lowerQuery) ||
            item.description?.toLowerCase().includes(lowerQuery)
          );
        }));
      }

      const mentionItems: SuggestionItem[] = [];

      if (sessionTagsList.length > 0) {
        sessionTagsList.forEach((tag: any) => {
          const name = typeof tag === "string" ? tag : tag?.name;
          if (!name || (query && !name.toLowerCase().includes(lowerQuery))) return;
          mentionItems.push({
            id: name,
            name,
            type: "session",
            description: "Session tag",
            category: "session",
          });
        });
      }

      if (modelTagsList.length > 0) {
        modelTagsList.forEach((tag: any) => {
          const name = typeof tag === "string" ? tag : tag?.name;
          if (!name || (query && !name.toLowerCase().includes(lowerQuery))) return;
          mentionItems.push({
            id: name,
            name,
            type: "model",
            description: "Model tag",
            category: "model",
          });
        });
      }

      if (symbolsList.length > 0) {
        symbolsList.forEach((symbol) => {
          if (!symbol || (query && !symbol.toLowerCase().includes(lowerQuery))) return;
          mentionItems.push({
            id: symbol,
            name: symbol,
            type: "symbol",
            description: "Symbol",
            category: "symbol",
          });
        });
      }

      [
        { id: "Win", name: "Win", description: "Outcome", category: "Outcome" },
        { id: "Loss", name: "Loss", description: "Outcome", category: "Outcome" },
        { id: "BE", name: "Break-even", description: "Outcome", category: "Outcome" },
        { id: "PW", name: "Partial win", description: "Outcome", category: "Outcome" },
      ].forEach((item) => {
        if (!query || item.name.toLowerCase().includes(lowerQuery)) {
          mentionItems.push({
            id: item.id,
            name: item.name,
            type: "field",
            description: item.description,
            category: item.category,
          });
        }
      });

      [
        {
          id: "Aligned",
          name: "Aligned",
          description: "Protocol alignment",
          category: "Protocol",
        },
        {
          id: "Against",
          name: "Against",
          description: "Protocol alignment",
          category: "Protocol",
        },
        {
          id: "Discretionary",
          name: "Discretionary",
          description: "Protocol alignment",
          category: "Protocol",
        },
      ].forEach((item) => {
        if (!query || item.name.toLowerCase().includes(lowerQuery)) {
          mentionItems.push({
            id: item.id,
            name: item.name,
            type: "field",
            description: item.description,
            category: item.category,
          });
        }
      });

      [
        { id: "Long", name: "Long" },
        { id: "Short", name: "Short" },
      ].forEach((item) => {
        if (!query || item.name.toLowerCase().includes(lowerQuery)) {
          mentionItems.push({
            id: item.id,
            name: item.name,
            type: "field",
            description: "Trade direction",
            category: "Direction",
          });
        }
      });

      return normalizeSuggestionItems(mentionItems);
    },
    [modelTagsList, sessionTagsList, symbolsList]
  );

  return { fetchSuggestions };
}
