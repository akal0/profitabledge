"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { Plus, Tag as TagIcon } from "lucide-react";
import { toast } from "sonner";

import { TagMultiSelect } from "@/components/tags/tag-multi-select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  TRADE_IDENTIFIER_PILL_CLASS,
  TRADE_IDENTIFIER_TONES,
} from "@/components/trades/trade-identifier-pill";
import { tradeTagEditorStyles } from "@/components/trades/trade-tag-editor-styles";
import { cn } from "@/lib/utils";
import { queryClient, trpcClient, trpcOptions } from "@/utils/trpc";

interface TradeTagsCellProps {
  tradeId: string;
  accountId?: string | null;
  customTags?: string[] | null;
  existingTags?: string[];
  isLive?: boolean;
}

function normalizeTradeTags(tags?: string[] | null) {
  if (!Array.isArray(tags)) {
    return [];
  }

  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
        .slice(0, 50)
    )
  );
}

function patchTradeTagsInQueryData(
  data: unknown,
  tradeId: string,
  nextTags: string[]
): unknown {
  if (!data || typeof data !== "object") {
    return data;
  }

  if (Array.isArray(data)) {
    let changed = false;
    const nextData = data.map((value) => {
      const patched = patchTradeTagsInQueryData(value, tradeId, nextTags);
      if (patched !== value) {
        changed = true;
      }
      return patched;
    });

    return changed ? nextData : data;
  }

  const record = data as Record<string, unknown>;

  if (record.id === tradeId) {
    return { ...record, customTags: nextTags };
  }

  if (Array.isArray(record.pages)) {
    let changed = false;
    const nextPages = record.pages.map((page) => {
      const patched = patchTradeTagsInQueryData(page, tradeId, nextTags);
      if (patched !== page) {
        changed = true;
      }
      return patched;
    });

    return changed ? { ...record, pages: nextPages } : data;
  }

  if (Array.isArray(record.items)) {
    let changed = false;
    const nextItems = record.items.map((item) => {
      const patched = patchTradeTagsInQueryData(item, tradeId, nextTags);
      if (patched !== item) {
        changed = true;
      }
      return patched;
    });

    return changed ? { ...record, items: nextItems } : data;
  }

  return data;
}

function mergeTradeTagSuggestions(
  existing: string[] | undefined,
  nextTags: string[]
) {
  return normalizeTradeTags([...(existing ?? []), ...nextTags]);
}

export function TradeTagsCell({
  tradeId,
  accountId,
  customTags,
  existingTags = [],
  isLive = false,
}: TradeTagsCellProps) {
  const [open, setOpen] = React.useState(false);
  const [draftTags, setDraftTags] = React.useState(() =>
    normalizeTradeTags(customTags)
  );
  const [displayedTags, setDisplayedTags] = React.useState(() =>
    normalizeTradeTags(customTags)
  );
  const effectiveAccountId = accountId || "";

  const currentTags = React.useMemo(
    () => normalizeTradeTags(customTags),
    [customTags]
  );
  const currentTagSignature = React.useMemo(
    () => currentTags.join("\u0000"),
    [currentTags]
  );
  const visibleTags = displayedTags.slice(0, 3);
  const hiddenTagCount = Math.max(0, displayedTags.length - visibleTags.length);

  React.useEffect(() => {
    setDraftTags(currentTags);
    setDisplayedTags(currentTags);
  }, [currentTagSignature, currentTags]);

  const updateMutation = useMutation({
    mutationFn: async (nextTags: string[]) =>
      trpcClient.trades.updateCustomTags.mutate({
        tradeId,
        customTags: normalizeTradeTags(nextTags),
      }),
    onMutate: async (nextTags) => {
      const normalizedTags = normalizeTradeTags(nextTags);

      await queryClient.cancelQueries({ queryKey: [["trades"]] });

      const previousTradesData = queryClient.getQueriesData({
        queryKey: [["trades"]],
      });
      const customTagsQueryKey = effectiveAccountId
        ? trpcOptions.trades.listCustomTags.queryOptions({
            accountId: effectiveAccountId,
          }).queryKey
        : null;
      const previousCustomTagSuggestions = customTagsQueryKey
        ? queryClient.getQueryData<string[]>(customTagsQueryKey)
        : undefined;

      setDisplayedTags(normalizedTags);
      setDraftTags(normalizedTags);
      setOpen(false);

      queryClient.setQueriesData({ queryKey: [["trades"]] }, (data) =>
        patchTradeTagsInQueryData(data, tradeId, normalizedTags)
      );

      if (customTagsQueryKey) {
        queryClient.setQueryData<string[] | undefined>(
          customTagsQueryKey,
          (existing) => mergeTradeTagSuggestions(existing, normalizedTags)
        );
      }

      return {
        previousCustomTagSuggestions,
        previousDisplayedTags: currentTags,
        previousTradesData,
      };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [["trades"]] });
      if (effectiveAccountId) {
        void queryClient.invalidateQueries({
          queryKey: trpcOptions.trades.listCustomTags.queryOptions({
            accountId: effectiveAccountId,
          }).queryKey,
        });
      }
    },
    onError: (error, _nextTags, context) => {
      for (const [queryKey, data] of context?.previousTradesData ?? []) {
        queryClient.setQueryData(queryKey, data);
      }

      if (effectiveAccountId) {
        queryClient.setQueryData(
          trpcOptions.trades.listCustomTags.queryOptions({
            accountId: effectiveAccountId,
          }).queryKey,
          context?.previousCustomTagSuggestions
        );
      }

      const fallbackTags = context?.previousDisplayedTags ?? currentTags;
      setDisplayedTags(fallbackTags);
      setDraftTags(fallbackTags);
      console.error("Trade tags update failed:", error);
      toast.error("Couldn’t update trade tags. Please try again.");
    },
  });

  const toggleExistingTag = (tag: string) => {
    setDraftTags((current) => {
      if (current.includes(tag)) {
        return current.filter((value) => value !== tag);
      }

      return normalizeTradeTags([...current, tag]);
    });
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen && isLive) {
          toast.error("You can't edit a live trade.");
          return;
        }

        if (!nextOpen) {
          setDraftTags(displayedTags);
        }

        setOpen(nextOpen);
      }}
    >
      <PopoverTrigger asChild>
        <div
          className="cursor-pointer"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {displayedTags.length > 0 ? (
            <div className="flex max-w-[14rem] flex-wrap gap-1.5">
              {visibleTags.map((tag) => (
                <span
                  key={tag}
                  className={cn(
                    TRADE_IDENTIFIER_PILL_CLASS,
                    TRADE_IDENTIFIER_TONES.neutral,
                    "max-w-full"
                  )}
                  title={tag}
                >
                  <TagIcon className="size-3 shrink-0" />
                  <span className="max-w-[10rem] truncate">{tag}</span>
                </span>
              ))}
              {hiddenTagCount > 0 ? (
                <span
                  className={cn(
                    TRADE_IDENTIFIER_PILL_CLASS,
                    TRADE_IDENTIFIER_TONES.subdued
                  )}
                  title={displayedTags.slice(3).join(", ")}
                >
                  +{hiddenTagCount}
                </span>
              ) : null}
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className={tradeTagEditorStyles.addButtonClass}
            >
              <Plus className="mb-0.5 size-3" />
              Add trade tags
            </Button>
          )}
        </div>
      </PopoverTrigger>

      <PopoverContent
        className={tradeTagEditorStyles.popoverContentClass}
        align="start"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className={tradeTagEditorStyles.sectionClass}>
          <div className="space-y-3">
            <Label className={tradeTagEditorStyles.labelClass}>
              Trade tags
            </Label>
            <TagMultiSelect
              value={draftTags}
              suggestions={existingTags}
              placeholder="Add one or more trade tags"
              onChange={setDraftTags}
              className={cn(
                "border-white/8 bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-white/[0.05]",
                "text-white/85"
              )}
              emptyIndicator={
                <div className="px-3 py-2 text-xs text-white/45">
                  Start typing to add a trade tag.
                </div>
              }
            />
          </div>
        </div>

        {existingTags.length > 0 ? (
          <>
            <Separator className={tradeTagEditorStyles.separatorClass} />
            <div className={tradeTagEditorStyles.sectionClass}>
              <Label className={tradeTagEditorStyles.labelClass}>
                Existing trade tags
              </Label>
              <div className="flex flex-wrap gap-2">
                {existingTags.map((tag) => {
                  const isActive = draftTags.includes(tag);

                  return (
                    <button
                      key={tag}
                      type="button"
                      className={cn(
                        tradeTagEditorStyles.optionChipClass,
                        isActive && tradeTagEditorStyles.optionChipActiveClass
                      )}
                      onClick={() => toggleExistingTag(tag)}
                    >
                      <TagIcon className="size-3 text-white/45" />
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        ) : null}

        <Separator className={tradeTagEditorStyles.separatorClass} />

        <div className={tradeTagEditorStyles.footerClass}>
          {draftTags.length > 0 ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDraftTags([])}
              disabled={updateMutation.isPending}
              className={cn(
                tradeTagEditorStyles.footerButtonClass,
                tradeTagEditorStyles.destructiveButtonClass
              )}
            >
              Clear
            </Button>
          ) : null}
          <Button
            variant="default"
            size="sm"
            onClick={() => updateMutation.mutate(draftTags)}
            disabled={updateMutation.isPending}
            className={cn(
              tradeTagEditorStyles.footerButtonClass,
              tradeTagEditorStyles.primaryButtonClass
            )}
          >
            {updateMutation.isPending ? "Saving..." : "Save"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDraftTags(displayedTags);
              setOpen(false);
            }}
            disabled={updateMutation.isPending}
            className={cn(
              tradeTagEditorStyles.footerButtonClass,
              tradeTagEditorStyles.secondaryButtonClass
            )}
          >
            Cancel
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
