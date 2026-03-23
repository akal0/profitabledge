"use client";

import * as React from "react";
import { trpcOptions, trpcClient, queryClient } from "@/utils/trpc";
import { useMutation } from "@tanstack/react-query";
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
import { Separator } from "@/components/ui/separator";
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
import { toast } from "sonner";
import {
  getTradeIdentifierColorStyle,
  TRADE_IDENTIFIER_PILL_CLASS,
} from "@/components/trades/trade-identifier-pill";
import {
  getTradeTagColorButtonStyle,
  getTradeTagColorSwatchStyle,
  tradeTagEditorStyles,
} from "@/components/trades/trade-tag-editor-styles";

interface SessionTagCellProps {
  tradeId: string;
  accountId?: string | null;
  sessionTag: string | null | undefined;
  sessionTagColor: string | null | undefined;
  allSessionTags?: SessionTagOption[];
  isLive?: boolean;
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
  accountId,
  sessionTag,
  sessionTagColor,
  allSessionTags = [],
  isLive = false,
}: SessionTagCellProps) {
  const [open, setOpen] = React.useState(false);
  const [tagName, setTagName] = React.useState(sessionTag ?? "");
  const [selectedColor, setSelectedColor] = React.useState(
    sessionTagColor ?? DEFAULT_SESSION_COLORS[0]
  );
  const [showColorPicker, setShowColorPicker] = React.useState(false);
  const [isColorDirty, setIsColorDirty] = React.useState(false);
  const sessionTags = allSessionTags;

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
      queryClient.invalidateQueries({
        queryKey: [["trades"]],
        refetchType: "active",
      });
      if (accountId) {
        void queryClient.invalidateQueries({
          queryKey: trpcOptions.trades.listSessionTags.queryOptions({
            accountId,
          }).queryKey,
        });
      }
      setOpen(false);
      setIsColorDirty(false);
    },
    onError: () => {
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
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen && isLive) {
          toast.error("You can't edit a live trade.");
          return;
        }
        setOpen(nextOpen);
      }}
    >
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
              className={cn(TRADE_IDENTIFIER_PILL_CLASS, "hover:opacity-90")}
            >
              <TagIcon size={12} />
              <span className="max-w-[12rem] truncate">{sessionTag}</span>
            </Badge>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className={tradeTagEditorStyles.addButtonClass}
            >
              <Plus className="mb-0.5 size-3" />
              Add session
            </Button>
          )}
        </div>
      </PopoverTrigger>

      <PopoverContent
        className={tradeTagEditorStyles.popoverContentClass}
        align="start"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className={tradeTagEditorStyles.sectionClass}>
          <div className="space-y-3">
            <Label
              htmlFor="session-tag-name"
              className={tradeTagEditorStyles.labelClass}
            >
              Session name
            </Label>
            <Input
              id="session-tag-name"
              placeholder="e.g., London, New York, Asia..."
              value={tagName}
              className={tradeTagEditorStyles.inputClass}
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
        </div>

        {sessionTags && sessionTags.length > 0 && (
          <>
            <Separator className={tradeTagEditorStyles.separatorClass} />
            <div className={tradeTagEditorStyles.sectionClass}>
              <Label className={tradeTagEditorStyles.labelClass}>
                Existing sessions
              </Label>
              <div className="flex flex-wrap gap-2">
                {sessionTags.map((tag) => {
                  const isActive =
                    tag.name.toLowerCase() === tagName.trim().toLowerCase();
                  return (
                    <button
                      key={tag.name}
                      type="button"
                      className={cn(
                        tradeTagEditorStyles.optionChipClass,
                        isActive && tradeTagEditorStyles.optionChipActiveClass
                      )}
                      onClick={() => {
                        setTagName(tag.name);
                        setSelectedColor(tag.color);
                        setShowColorPicker(false);
                        setIsColorDirty(false);
                      }}
                    >
                      <span
                        className={tradeTagEditorStyles.colorSwatchClass}
                        style={getTradeTagColorSwatchStyle(tag.color)}
                      />
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        <Separator className={tradeTagEditorStyles.separatorClass} />

        <div className={tradeTagEditorStyles.sectionClass}>
          <div className="space-y-3">
            <Label className={tradeTagEditorStyles.labelClass}>Color</Label>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_SESSION_COLORS.map((color, index) => (
                <button
                  key={`${color}-${index}`}
                  type="button"
                  className={cn(
                    tradeTagEditorStyles.colorButtonClass,
                    selectedColor === color
                      ? tradeTagEditorStyles.colorButtonActiveClass
                      : tradeTagEditorStyles.colorButtonInactiveClass
                  )}
                  style={getTradeTagColorButtonStyle(color, {
                    active: selectedColor === color,
                  })}
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
                  tradeTagEditorStyles.colorCustomButtonClass,
                  showColorPicker
                    ? "border-white/15 bg-sidebar-accent/80 text-white"
                    : ""
                )}
                onClick={() => setShowColorPicker(!showColorPicker)}
              >
                <Plus size={16} />
              </button>
            </div>

            {showColorPicker && (
              <div
                className={cn(
                  "mt-4 space-y-3",
                  tradeTagEditorStyles.colorPickerPanelClass
                )}
              >
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
        </div>

        <Separator className={tradeTagEditorStyles.separatorClass} />

        <div className={tradeTagEditorStyles.footerClass}>
          {sessionTag ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRemove}
              disabled={updateMutation.isPending}
              className={cn(
                tradeTagEditorStyles.footerButtonClass,
                tradeTagEditorStyles.destructiveButtonClass
              )}
            >
              Remove
            </Button>
          ) : null}
          <Button
            variant="default"
            size="sm"
            onClick={handleSave}
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
            onClick={() => setOpen(false)}
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
