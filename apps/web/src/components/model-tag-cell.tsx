"use client";

import * as React from "react";
import { trpcOptions, trpcClient, queryClient } from "@/utils/trpc";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Lightbulb } from "lucide-react";
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
  ColorPickerFormat,
  ColorPickerOutput,
} from "@/components/ui/color-picker";
import { cn } from "@/lib/utils";
import Color from "color";
import { useAccountStore } from "@/stores/account";
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

interface ModelTagCellProps {
  tradeId: string;
  modelTag: string | null | undefined;
  modelTagColor: string | null | undefined;
  isLive?: boolean;
}

type ModelTagOption = {
  name: string;
  color: string;
};

const DEFAULT_MODEL_COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Green
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#84CC16", // Lime
];

export function ModelTagCell({
  tradeId,
  modelTag,
  modelTagColor,
  isLive = false,
}: ModelTagCellProps) {
  const [open, setOpen] = React.useState(false);
  const [tagName, setTagName] = React.useState(modelTag ?? "");
  const [selectedColor, setSelectedColor] = React.useState(
    modelTagColor ?? DEFAULT_MODEL_COLORS[0]
  );
  const [showColorPicker, setShowColorPicker] = React.useState(false);
  const [isColorDirty, setIsColorDirty] = React.useState(false);
  const { selectedAccountId } = useAccountStore();

  const modelTagsOpts = trpcOptions.trades.listModelTags.queryOptions({
    accountId: selectedAccountId || "",
  });
  const { data: modelTags = [] } = useQuery({
    ...modelTagsOpts,
    enabled: Boolean(selectedAccountId),
  }) as { data: ModelTagOption[] | undefined };

  const matchedExistingTag = React.useMemo(() => {
    if (!modelTags || !tagName.trim()) return null;
    const normalized = tagName.trim().toLowerCase();
    return (
      modelTags.find((tag) => tag.name.toLowerCase() === normalized) || null
    );
  }, [modelTags, tagName]);

  const updateMutation = useMutation({
    mutationFn: async (input: {
      tradeId: string;
      modelTag: string | null;
      modelTagColor: string | null;
    }) => {
      const result = await trpcClient.trades.updateModelTag.mutate(input);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["trades"]] });
      queryClient.refetchQueries({ queryKey: [["trades"]] });
      setOpen(false);
      setIsColorDirty(false);
    },
    onError: (error) => {
      console.error("Model tag update failed:", error);
      toast.error("Couldn’t update model tag. Please try again.");
    },
  });

  const handleSave = () => {
    const trimmed = tagName.trim();
    if (!trimmed) {
      // Clear the tag if name is empty
      updateMutation.mutate({
        tradeId,
        modelTag: null,
        modelTagColor: null,
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
        modelTag: finalTagName,
        modelTagColor: finalColor,
      });
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateMutation.mutate({
      tradeId,
      modelTag: null,
      modelTagColor: null,
    });
  };

  // Sync local state when props change
  React.useEffect(() => {
    setTagName(modelTag ?? "");
    setSelectedColor(modelTagColor ?? DEFAULT_MODEL_COLORS[0]);
    setIsColorDirty(false);
  }, [modelTag, modelTagColor]);

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
          {modelTag && modelTagColor ? (
            <Badge
              style={getTradeIdentifierColorStyle(modelTagColor)}
              className={cn(TRADE_IDENTIFIER_PILL_CLASS, "hover:opacity-90")}
            >
              <Lightbulb size={12} />
              <span className="max-w-[12rem] truncate">{modelTag}</span>
            </Badge>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className={tradeTagEditorStyles.addButtonClass}
            >
              <Plus className="mb-0.5 size-3" />
              Add model
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
              htmlFor="model-name"
              className={tradeTagEditorStyles.labelClass}
            >
              Model / Strategy
            </Label>
            <Input
              id="model-name"
              placeholder="e.g., Liquidity Raid, Breaker Block..."
              value={tagName}
              className={tradeTagEditorStyles.inputClass}
              onChange={(e) => {
                const nextValue = e.target.value;
                setTagName(nextValue);
                if (
                  modelTags?.some(
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

        {modelTags && modelTags.length > 0 && (
          <>
            <Separator className={tradeTagEditorStyles.separatorClass} />
            <div className={tradeTagEditorStyles.sectionClass}>
              <Label className={tradeTagEditorStyles.labelClass}>
                Existing models
              </Label>
              <div className="flex flex-wrap gap-2">
                {modelTags.map((tag) => {
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
              {DEFAULT_MODEL_COLORS.map((color) => (
                <button
                  key={color}
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
          {modelTag ? (
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
