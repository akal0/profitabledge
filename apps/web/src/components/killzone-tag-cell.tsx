"use client";

import * as React from "react";
import { trpcClient, queryClient } from "@/utils/trpc";
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

interface KillzoneTagCellProps {
  tradeId: string;
  killzone: string | null | undefined;
  killzoneColor: string | null | undefined;
}

const DEFAULT_KILLZONE_COLORS = [
  "#FF5733", // Red
  "#33FF57", // Green
  "#3357FF", // Blue
  "#F3FF33", // Yellow
  "#FF33F3", // Magenta
  "#33FFF3", // Cyan
  "#FF8C33", // Orange
  "#8C33FF", // Purple
];

export function KillzoneTagCell({
  tradeId,
  killzone,
  killzoneColor,
}: KillzoneTagCellProps) {
  const [open, setOpen] = React.useState(false);
  const [tagName, setTagName] = React.useState(killzone ?? "");
  const [selectedColor, setSelectedColor] = React.useState(
    killzoneColor ?? DEFAULT_KILLZONE_COLORS[0]
  );
  const [showColorPicker, setShowColorPicker] = React.useState(false);

  const updateMutation = useMutation({
    mutationFn: async (input: {
      tradeId: string;
      killzone: string | null;
      killzoneColor: string | null;
    }) => {
      console.log("Mutation input:", input);
      const result = await trpcClient.trades.updateKillzone.mutate(input);
      console.log("Mutation result:", result);
      return result;
    },
    onSuccess: () => {
      console.log("Mutation successful, invalidating queries");
      queryClient.invalidateQueries();
      setOpen(false);
    },
    onError: (error) => {
      console.error("Mutation failed:", error);
    },
  });

  const handleSave = () => {
    if (!tagName.trim()) {
      // Clear the tag if name is empty
      updateMutation.mutate({
        tradeId,
        killzone: null,
        killzoneColor: null,
      });
    } else {
      updateMutation.mutate({
        tradeId,
        killzone: tagName.trim(),
        killzoneColor: selectedColor,
      });
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateMutation.mutate({
      tradeId,
      killzone: null,
      killzoneColor: null,
    });
  };

  // Sync local state when props change
  React.useEffect(() => {
    setTagName(killzone ?? "");
    setSelectedColor(killzoneColor ?? DEFAULT_KILLZONE_COLORS[0]);
  }, [killzone, killzoneColor]);

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
          {killzone && killzoneColor ? (
            <Badge
              style={{
                backgroundColor: killzoneColor,
                color: Color(killzoneColor).isDark() ? "#fff" : "#000",
              }}
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
            >
              <TagIcon size={12} />
              {killzone}
            </Badge>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-0! hover:bg-transparent! text-muted-foreground hover:text-foreground text-xs"
            >
              <Plus className="mb-0.5 size-3.5" />
              Add tag
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
            <Label htmlFor="tag-name" className="text-xs">
              Killzone name
            </Label>
            <Input
              id="tag-name"
              placeholder="e.g., London Open, New York..."
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
              {DEFAULT_KILLZONE_COLORS.map((color) => (
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
                    const [r, g, b] = rgba;
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
            {killzone && (
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
