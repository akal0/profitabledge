"use client";

import * as React from "react";
import { trpcClient, queryClient } from "@/utils/trpc";
import { useMutation } from "@tanstack/react-query";
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
import {
  ColorPicker,
  ColorPickerSelection,
  ColorPickerHue,
  ColorPickerFormat,
  ColorPickerOutput,
} from "@/components/ui/color-picker";
import { cn } from "@/lib/utils";
import Color from "color";
import {
  getTradeIdentifierColorStyle,
  TRADE_IDENTIFIER_BUTTON_CLASS,
  TRADE_IDENTIFIER_PILL_CLASS,
} from "@/components/trades/trade-identifier-pill";

interface ModelTagCellProps {
  tradeId: string;
  modelTag: string | null | undefined;
  modelTagColor: string | null | undefined;
}

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
}: ModelTagCellProps) {
  const [open, setOpen] = React.useState(false);
  const [tagName, setTagName] = React.useState(modelTag ?? "");
  const [selectedColor, setSelectedColor] = React.useState(
    modelTagColor ?? DEFAULT_MODEL_COLORS[0]
  );
  const [showColorPicker, setShowColorPicker] = React.useState(false);

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
      queryClient.invalidateQueries();
      setOpen(false);
    },
    onError: (error) => {
      console.error("Model tag update failed:", error);
    },
  });

  const handleSave = () => {
    if (!tagName.trim()) {
      // Clear the tag if name is empty
      updateMutation.mutate({
        tradeId,
        modelTag: null,
        modelTagColor: null,
      });
    } else {
      updateMutation.mutate({
        tradeId,
        modelTag: tagName.trim(),
        modelTagColor: selectedColor,
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
  }, [modelTag, modelTagColor]);

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
          {modelTag && modelTagColor ? (
            <Badge
              style={getTradeIdentifierColorStyle(modelTagColor)}
              className={cn(
                TRADE_IDENTIFIER_PILL_CLASS,
                "hover:opacity-90"
              )}
            >
              <Lightbulb size={12} />
              <span className="max-w-[12rem] truncate">{modelTag}</span>
            </Badge>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className={cn(TRADE_IDENTIFIER_BUTTON_CLASS, "gap-1.5")}
            >
              <Plus className="mb-0.5 size-3.5" />
              Add model
            </Button>
          )}
        </div>
      </PopoverTrigger>

      <PopoverContent
        className="w-80"
        align="start"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="space-y-4">
          <div className="space-y-3">
            <Label htmlFor="model-name" className="text-xs">
              Model / Strategy
            </Label>
            <Input
              id="model-name"
              placeholder="e.g., Liquidity Raid, Breaker Block..."
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSave();
                }
              }}
            />
          </div>

          <div className="space-y-3">
            <Label className="text-xs">Color</Label>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_MODEL_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={cn(
                    "w-8 h-8 rounded-md border-2 transition-all cursor-pointer",
                    selectedColor === color
                      ? "border-white/100 scale-110"
                      : "border-white/5 hover:border-foreground/50"
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => {
                    setSelectedColor(color);
                    setShowColorPicker(false);
                  }}
                />
              ))}
              <button
                type="button"
                className={cn(
                  "w-8 h-8 rounded-md border-2 flex items-center justify-center transition-all",
                  showColorPicker
                    ? "border-foreground bg-accent"
                    : "border-border hover:border-foreground/50"
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
            {modelTag && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRemove}
                disabled={updateMutation.isPending}
              >
                Remove
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="ml-auto"
            >
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
