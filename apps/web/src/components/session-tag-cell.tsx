"use client";

import * as React from "react";
import { trpcOptions, trpcClient, queryClient } from "@/utils/trpc";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Tag as TagIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ColorPicker,
  ColorPickerSelection,
  ColorPickerHue,
  ColorPickerAlpha,
  ColorPickerFormat,
  ColorPickerOutput,
} from "@/components/ui/color-picker";
import { cn } from "@/lib/utils";
import Color from "color";
import { useAccountStore } from "@/stores/account";
import { toast } from "sonner";
import {
  getTradeIdentifierColorStyle,
  TRADE_IDENTIFIER_BUTTON_CLASS,
  TRADE_IDENTIFIER_PILL_CLASS,
} from "@/components/trades/trade-identifier-pill";

interface SessionTagCellProps {
  tradeId: string;
  sessionTag: string | null | undefined;
  sessionTagColor: string | null | undefined;
}

type SessionTagOption = {
  name: string;
  color: string;
};

const DEFAULT_SESSION_COLORS = [
  "#FF5733", // Red
  "#33FF57", // Green
  "#3357FF", // Blue
  "#F3FF33", // Yellow
  "#FF33F3", // Magenta
  "#33FFF3", // Cyan
  "#FF8C33", // Orange
  "#FF33F3", // Purple
];

export function SessionTagCell({
  tradeId,
  sessionTag,
  sessionTagColor,
}: SessionTagCellProps) {
  const [open, setOpen] = React.useState(false);
  const [tagName, setTagName] = React.useState(sessionTag ?? "");
  const [selectedColor, setSelectedColor] = React.useState(
    sessionTagColor ?? DEFAULT_SESSION_COLORS[0]
  );
  const [showColorPicker, setShowColorPicker] = React.useState(false);
  const [isColorDirty, setIsColorDirty] = React.useState(false);
  const { selectedAccountId } = useAccountStore();

  const sessionTagsOpts = trpcOptions.trades.listSessionTags.queryOptions({
    accountId: selectedAccountId || "",
  });
  const { data: sessionTags = [] } = useQuery({
    ...sessionTagsOpts,
    enabled: Boolean(selectedAccountId),
  }) as { data: SessionTagOption[] | undefined };

  const matchedExistingTag = React.useMemo(() => {
    if (!sessionTags || !tagName.trim()) return null;
    const normalized = tagName.trim().toLowerCase();
    return (
      sessionTags.find((tag) => tag.name.toLowerCase() === normalized) || null
    );
  }, [sessionTags, tagName]);

  const updateMutation = useMutation({
    mutationFn: async (input: {
      tradeId: string;
      sessionTag: string | null;
      sessionTagColor: string | null;
    }) => {
      const result = await trpcClient.trades.updateSessionTag.mutate(input);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["trades"]] });
      queryClient.refetchQueries({ queryKey: [["trades"]] });
      setOpen(false);
      setIsColorDirty(false);
    },
    onError: (error) => {
      console.error("Session tag update failed:", error);
      toast.error("Couldn’t update session tag. Please try again.");
    },
  });

  const handleSave = () => {
    const trimmed = tagName.trim();
    if (!trimmed) {
      // Clear the tag if name is empty
      updateMutation.mutate({
        tradeId,
        sessionTag: null,
        sessionTagColor: null,
      });
    } else {
      const finalTagName = matchedExistingTag
        ? matchedExistingTag.name
        : trimmed;
      const finalColor =
        matchedExistingTag && !isColorDirty
          ? matchedExistingTag.color
          : selectedColor;
      updateMutation.mutate({
        tradeId,
        sessionTag: finalTagName,
        sessionTagColor: finalColor,
      });
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateMutation.mutate({
      tradeId,
      sessionTag: null,
      sessionTagColor: null,
    });
  };

  // Sync local state when props change
  React.useEffect(() => {
    setTagName(sessionTag ?? "");
    setSelectedColor(sessionTagColor ?? DEFAULT_SESSION_COLORS[0]);
    setIsColorDirty(false);
  }, [sessionTag, sessionTagColor]);

  React.useEffect(() => {
    if (!matchedExistingTag || isColorDirty) return;
    if (matchedExistingTag.color !== selectedColor) {
      setSelectedColor(matchedExistingTag.color);
    }
  }, [matchedExistingTag, isColorDirty, selectedColor]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          className="cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
        >
          {sessionTag && sessionTagColor ? (
            <Badge
              style={getTradeIdentifierColorStyle(sessionTagColor)}
              className={cn(
                TRADE_IDENTIFIER_PILL_CLASS,
                "hover:opacity-90"
              )}
            >
              <TagIcon size={12} />
              <span className="max-w-[12rem] truncate">{sessionTag}</span>
            </Badge>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className={cn(TRADE_IDENTIFIER_BUTTON_CLASS, "gap-1.5")}
            >
              <Plus className="mb-0.5 size-3.5" />
              Add session
            </Button>
          )}
        </div>
      </PopoverTrigger>

      <PopoverContent
        className="w-80 bg-sidebar border border-white/5 rounded-none text-white/80"
        align="start"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="space-y-4">
          <div className="space-y-3">
            <Label htmlFor="session-tag-name" className="text-xs text-white/70">
              Session name
            </Label>
            <Input
              id="session-tag-name"
              placeholder="e.g., London, New York, Asia..."
              value={tagName}
              className="bg-sidebar border-white/5 rounded-none text-white/80 placeholder:text-white/30"
              onChange={(e) => {
                const nextValue = e.target.value;
                setTagName(nextValue);
                if (
                  sessionTags?.some(
                    (tag) =>
                      tag.name.toLowerCase() === nextValue.trim().toLowerCase()
                  )
                ) {
                  setIsColorDirty(false);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSave();
                }
              }}
            />
          </div>

          {sessionTags && sessionTags.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-white/70">Existing sessions</Label>
              <div className="flex flex-wrap gap-2">
                {sessionTags.map((tag) => {
                  const isActive =
                    tag.name.toLowerCase() === tagName.trim().toLowerCase();
                  return (
                    <button
                      key={tag.name}
                      type="button"
                      className={cn(
                        "flex items-center gap-2 border border-white/5 bg-sidebar px-2 py-1 text-xs text-white/70 transition-colors hover:bg-sidebar-accent",
                        isActive && "bg-sidebar-accent text-white"
                      )}
                      onClick={() => {
                        setTagName(tag.name);
                        setSelectedColor(tag.color);
                        setShowColorPicker(false);
                        setIsColorDirty(false);
                      }}
                    >
                      <span
                        className="h-2.5 w-2.5 border border-white/20"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <Label className="text-xs text-white/70">Color</Label>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_SESSION_COLORS.map((color, index) => (
                <button
                  key={`${color}-${index}`}
                  type="button"
                  className={cn(
                    "w-8 h-8 rounded-none border-2 transition-all cursor-pointer",
                    selectedColor === color
                      ? "border-white/100 scale-110"
                      : "border-white/5 hover:border-foreground/50"
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => {
                    setSelectedColor(color);
                    setShowColorPicker(false);
                    setIsColorDirty(true);
                  }}
                />
              ))}
              <button
                type="button"
                className={cn(
                  "w-8 h-8 rounded-none border border-white/5 flex items-center justify-center transition-all text-white/70",
                  showColorPicker
                    ? "border-white/20 bg-sidebar-accent text-white"
                    : "bg-sidebar hover:bg-sidebar-accent"
                )}
                onClick={() => setShowColorPicker(!showColorPicker)}
              >
                <Plus size={16} />
              </button>
            </div>

            {showColorPicker && (
              <div className="mt-4 space-y-3">
                <ColorPicker
                  value={selectedColor}
                  onChange={(rgba) => {
                    const [r, g, b] = rgba as [number, number, number];
                    const hex = Color.rgb(r, g, b).hex();
                    setSelectedColor(hex);
                    setIsColorDirty(true);
                  }}
                >
                  <div className="space-y-3">
                    <ColorPickerSelection className="h-32 w-full" />
                    <ColorPickerHue />
                    <div className="flex items-center gap-2">
                      <ColorPickerFormat className="flex-1" />
                      <ColorPickerOutput />
                    </div>
                  </div>
                </ColorPicker>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            {sessionTag && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRemove}
                disabled={updateMutation.isPending}
                className="border border-white/5 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 rounded-none text-xs"
              >
                Remove
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="ml-auto border border-white/5 bg-sidebar-accent text-white hover:bg-sidebar-accent/80 rounded-none text-xs"
            >
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={updateMutation.isPending}
              className="border border-white/5 bg-transparent text-white/70 hover:bg-sidebar-accent rounded-none text-xs"
            >
              Cancel
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
