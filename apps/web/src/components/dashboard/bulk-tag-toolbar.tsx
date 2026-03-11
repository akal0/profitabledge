"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Tag, CheckCircle2 } from "lucide-react";
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
  ColorPickerOutput,
  ColorPickerFormat,
} from "@/components/ui/color-picker";
import Color from "color";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import { trpcClient, queryClient, trpcOptions } from "@/utils/trpc";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAccountStore } from "@/stores/account";

interface BulkTagToolbarProps {
  selectedCount: number;
  selectedIds: Set<string>;
  onClear: () => void;
}

const DEFAULT_SESSION_COLORS = [
  "#FF5733", "#33FF57", "#3357FF", "#F3FF33",
  "#FF33F3", "#33FFF3", "#FF8C33", "#8C33FF",
];

const DEFAULT_MODEL_COLORS = [
  "#22c55e", "#ef4444", "#3b82f6", "#f59e0b",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316",
];

export function BulkTagToolbar({
  selectedCount,
  selectedIds,
  onClear,
}: BulkTagToolbarProps) {
  const { selectedAccountId } = useAccountStore();
  const [sessionPopoverOpen, setSessionPopoverOpen] = React.useState(false);
  const [modelPopoverOpen, setModelPopoverOpen] = React.useState(false);
  const [sessionTagName, setSessionTagName] = React.useState("");
  const [sessionTagColor, setSessionTagColor] = React.useState(DEFAULT_SESSION_COLORS[0]);
  const [showSessionColorPicker, setShowSessionColorPicker] = React.useState(false);
  const [modelTagName, setModelTagName] = React.useState("");
  const [modelTagColor, setModelTagColor] = React.useState(DEFAULT_MODEL_COLORS[0]);
  const [showModelColorPicker, setShowModelColorPicker] = React.useState(false);

  // Fetch existing tags
  const sessionTagsOpts = trpcOptions.trades.listSessionTags.queryOptions({
    accountId: selectedAccountId || "",
  });
  const { data: sessionTags } = useQuery({
    ...sessionTagsOpts,
    enabled: Boolean(selectedAccountId),
  });

  const modelTagsOpts = trpcOptions.trades.listModelTags.queryOptions({
    accountId: selectedAccountId || "",
  });
  const { data: modelTags } = useQuery({
    ...modelTagsOpts,
    enabled: Boolean(selectedAccountId),
  });

  // Bulk update session tag mutation
  const bulkUpdateSessionMutation = useMutation({
    mutationFn: async (input: {
      tradeIds: string[];
      sessionTag: string | null;
      sessionTagColor: string | null;
    }) => {
      return await trpcClient.trades.bulkUpdateSessionTags.mutate(input);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [["trades"]] });
      queryClient.refetchQueries({ queryKey: [["trades"]] });
      toast.success(`Updated ${data.updatedCount} trades with session tag`);
      setSessionPopoverOpen(false);
      setSessionTagName("");
      onClear();
    },
    onError: (error) => {
      console.error("Bulk session tag update failed:", error);
      toast.error("Failed to update session tags. Please try again.");
    },
  });

  // Bulk update model tag mutation
  const bulkUpdateModelMutation = useMutation({
    mutationFn: async (input: {
      tradeIds: string[];
      modelTag: string | null;
      modelTagColor: string | null;
    }) => {
      return await trpcClient.trades.bulkUpdateModelTags.mutate(input);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [["trades"]] });
      queryClient.refetchQueries({ queryKey: [["trades"]] });
      toast.success(`Updated ${data.updatedCount} trades with model tag`);
      setModelPopoverOpen(false);
      setModelTagName("");
      onClear();
    },
    onError: (error) => {
      console.error("Bulk model tag update failed:", error);
      toast.error("Failed to update model tags. Please try again.");
    },
  });

  const handleApplySessionTag = () => {
    const trimmed = sessionTagName.trim();
    if (!trimmed) {
      toast.error("Please enter a session tag name");
      return;
    }

    // Check if tag exists
    const existingTag = sessionTags?.find(
      (tag) => tag.name.toLowerCase() === trimmed.toLowerCase()
    );

    const finalTagName = existingTag ? existingTag.name : trimmed;
    const finalColor = existingTag ? existingTag.color : sessionTagColor;

    bulkUpdateSessionMutation.mutate({
      tradeIds: Array.from(selectedIds),
      sessionTag: finalTagName,
      sessionTagColor: finalColor,
    });
  };

  const handleApplyModelTag = () => {
    const trimmed = modelTagName.trim();
    if (!trimmed) {
      toast.error("Please enter a model tag name");
      return;
    }

    // Check if tag exists
    const existingTag = modelTags?.find(
      (tag) => tag.name.toLowerCase() === trimmed.toLowerCase()
    );

    const finalTagName = existingTag ? existingTag.name : trimmed;
    const finalColor = existingTag ? existingTag.color : modelTagColor;

    bulkUpdateModelMutation.mutate({
      tradeIds: Array.from(selectedIds),
      modelTag: finalTagName,
      modelTagColor: finalColor,
    });
  };

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-sidebar border border-white/10 rounded-none shadow-2xl px-6 py-4 flex items-center gap-4">
        <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 rounded-none px-3 py-1.5">
          {selectedCount} selected
        </Badge>

        <div className="h-6 w-px bg-white/10" />

        {/* Session Tag Button */}
        <Popover open={sessionPopoverOpen} onOpenChange={setSessionPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="border-white/5 bg-sidebar-accent hover:bg-sidebar-accent/80 rounded-none text-xs text-white gap-2"
            >
              <Tag className="size-3.5" />
              Tag Session
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-80 bg-sidebar border border-white/5 rounded-none text-white/80"
            align="center"
            side="top"
          >
            <div className="space-y-4">
              <div className="space-y-3">
                <Label htmlFor="bulk-session-tag-name" className="text-xs text-white/70">
                  Session name
                </Label>
                <Input
                  id="bulk-session-tag-name"
                  placeholder="e.g., London, New York, Asia..."
                  value={sessionTagName}
                  className="bg-sidebar border-white/5 rounded-none text-white/80 placeholder:text-white/30"
                  onChange={(e) => setSessionTagName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleApplySessionTag();
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
                        tag.name.toLowerCase() === sessionTagName.trim().toLowerCase();
                      return (
                        <button
                          key={tag.name}
                          type="button"
                          className={cn(
                            "flex items-center gap-2 border border-white/5 bg-sidebar px-2 py-1 text-xs text-white/70 transition-colors hover:bg-sidebar-accent",
                            isActive && "bg-sidebar-accent text-white"
                          )}
                          onClick={() => {
                            setSessionTagName(tag.name);
                            setSessionTagColor(tag.color);
                            setShowSessionColorPicker(false);
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
                        sessionTagColor === color
                          ? "border-white/100 scale-110"
                          : "border-white/5 hover:border-foreground/50"
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => {
                        setSessionTagColor(color);
                        setShowSessionColorPicker(false);
                      }}
                    />
                  ))}
                  <button
                    type="button"
                    className={cn(
                      "w-8 h-8 rounded-none border border-white/5 flex items-center justify-center transition-all text-white/70",
                      showSessionColorPicker
                        ? "border-white/20 bg-sidebar-accent text-white"
                        : "bg-sidebar hover:bg-sidebar-accent"
                    )}
                    onClick={() => setShowSessionColorPicker(!showSessionColorPicker)}
                  >
                    <Plus size={16} />
                  </button>
                </div>

                {showSessionColorPicker && (
                  <div className="mt-4 space-y-3">
                    <ColorPicker
                      value={sessionTagColor}
                      onChange={(rgba) => {
                        const [r, g, b] = rgba;
                        const hex = Color.rgb(r, g, b).hex();
                        setSessionTagColor(hex);
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
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleApplySessionTag}
                  disabled={bulkUpdateSessionMutation.isPending}
                  className="flex-1 border border-white/5 bg-sidebar-accent text-white hover:bg-sidebar-accent/80 rounded-none text-xs gap-2"
                >
                  {bulkUpdateSessionMutation.isPending ? (
                    "Applying..."
                  ) : (
                    <>
                      <CheckCircle2 className="size-3.5" />
                      Apply to {selectedCount}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Model Tag Button */}
        <Popover open={modelPopoverOpen} onOpenChange={setModelPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="border-white/5 bg-sidebar-accent hover:bg-sidebar-accent/80 rounded-none text-xs text-white gap-2"
            >
              <Tag className="size-3.5" />
              Tag Model
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-80 bg-sidebar border border-white/5 rounded-none text-white/80"
            align="center"
            side="top"
          >
            <div className="space-y-4">
              <div className="space-y-3">
                <Label htmlFor="bulk-model-tag-name" className="text-xs text-white/70">
                  Model name
                </Label>
                <Input
                  id="bulk-model-tag-name"
                  placeholder="e.g., Breakout, Reversal, Trend..."
                  value={modelTagName}
                  className="bg-sidebar border-white/5 rounded-none text-white/80 placeholder:text-white/30"
                  onChange={(e) => setModelTagName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleApplyModelTag();
                    }
                  }}
                />
              </div>

              {modelTags && modelTags.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-white/70">Existing models</Label>
                  <div className="flex flex-wrap gap-2">
                    {modelTags.map((tag) => {
                      const isActive =
                        tag.name.toLowerCase() === modelTagName.trim().toLowerCase();
                      return (
                        <button
                          key={tag.name}
                          type="button"
                          className={cn(
                            "flex items-center gap-2 border border-white/5 bg-sidebar px-2 py-1 text-xs text-white/70 transition-colors hover:bg-sidebar-accent",
                            isActive && "bg-sidebar-accent text-white"
                          )}
                          onClick={() => {
                            setModelTagName(tag.name);
                            setModelTagColor(tag.color);
                            setShowModelColorPicker(false);
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
                  {DEFAULT_MODEL_COLORS.map((color, index) => (
                    <button
                      key={`${color}-${index}`}
                      type="button"
                      className={cn(
                        "w-8 h-8 rounded-none border-2 transition-all cursor-pointer",
                        modelTagColor === color
                          ? "border-white/100 scale-110"
                          : "border-white/5 hover:border-foreground/50"
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => {
                        setModelTagColor(color);
                        setShowModelColorPicker(false);
                      }}
                    />
                  ))}
                  <button
                    type="button"
                    className={cn(
                      "w-8 h-8 rounded-none border border-white/5 flex items-center justify-center transition-all text-white/70",
                      showModelColorPicker
                        ? "border-white/20 bg-sidebar-accent text-white"
                        : "bg-sidebar hover:bg-sidebar-accent"
                    )}
                    onClick={() => setShowModelColorPicker(!showModelColorPicker)}
                  >
                    <Plus size={16} />
                  </button>
                </div>

                {showModelColorPicker && (
                  <div className="mt-4 space-y-3">
                    <ColorPicker
                      value={modelTagColor}
                      onChange={(rgba) => {
                        const [r, g, b] = rgba;
                        const hex = Color.rgb(r, g, b).hex();
                        setModelTagColor(hex);
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
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleApplyModelTag}
                  disabled={bulkUpdateModelMutation.isPending}
                  className="flex-1 border border-white/5 bg-sidebar-accent text-white hover:bg-sidebar-accent/80 rounded-none text-xs gap-2"
                >
                  {bulkUpdateModelMutation.isPending ? (
                    "Applying..."
                  ) : (
                    <>
                      <CheckCircle2 className="size-3.5" />
                      Apply to {selectedCount}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <div className="h-6 w-px bg-white/10" />

        {/* Clear Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="text-white/60 hover:text-white hover:bg-sidebar-accent rounded-none text-xs gap-2"
        >
          <X className="size-3.5" />
          Clear
        </Button>
      </div>
    </div>
  );
}
