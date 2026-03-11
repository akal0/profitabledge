"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  X,
  Tag,
  CheckCircle2,
  Trash2,
  Download,
  BarChart3,
  StickyNote,
  Share2,
  Target,
  GitCompare,
  RefreshCw,
  Star,
  ChevronDown,
  Shield,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { exportTradesToCSV } from "@/lib/export-trades";

interface BulkActionsToolbarProps {
  selectedCount: number;
  selectedIds: Set<string>;
  selectedTrades?: Array<Record<string, unknown>>;
  visibleColumns?: string[];
  sharePath?: string;
  onClear: () => void;
  onCompare?: () => void;
}

type NamedColorTag = {
  name: string;
  color: string;
};

type SelectedTradesStats = {
  totalPnL?: number | null;
  netPnL?: number | null;
  winRate?: number | null;
  wins?: number | null;
  losses?: number | null;
  breakeven?: number | null;
  avgRR?: number | null;
  totalVolume?: number | null;
  avgHold?: number | null;
  totalCommissions?: number | null;
  totalSwap?: number | null;
};

const DEFAULT_SESSION_COLORS = [
  "#FF5733",
  "#33FF57",
  "#3357FF",
  "#F3FF33",
  "#FF33F3",
  "#33FFF3",
  "#FF8C33",
  "#8C33FF",
];

const DEFAULT_MODEL_COLORS = [
  "#22c55e",
  "#ef4444",
  "#3b82f6",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
];

export function BulkActionsToolbar({
  selectedCount,
  selectedIds,
  selectedTrades,
  visibleColumns,
  sharePath = "/dashboard/trades",
  onClear,
  onCompare,
}: BulkActionsToolbarProps) {
  const { selectedAccountId } = useAccountStore();

  // Dialog states
  const [sessionPopoverOpen, setSessionPopoverOpen] = React.useState(false);
  const [modelPopoverOpen, setModelPopoverOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = React.useState(false);
  const [statsOpen, setStatsOpen] = React.useState(false);

  // Form states
  const [sessionTagName, setSessionTagName] = React.useState("");
  const [sessionTagColor, setSessionTagColor] = React.useState(
    DEFAULT_SESSION_COLORS[0]
  );
  const [showSessionColorPicker, setShowSessionColorPicker] =
    React.useState(false);
  const [modelTagName, setModelTagName] = React.useState("");
  const [modelTagColor, setModelTagColor] = React.useState(
    DEFAULT_MODEL_COLORS[0]
  );
  const [showModelColorPicker, setShowModelColorPicker] = React.useState(false);
  const [noteText, setNoteText] = React.useState("");
  const [appendNote, setAppendNote] = React.useState(false);

  // Fetch existing tags
  const sessionTagsOpts = trpcOptions.trades.listSessionTags.queryOptions({
    accountId: selectedAccountId || "",
  });
  const { data: sessionTagsRaw } = useQuery({
    ...sessionTagsOpts,
    enabled: Boolean(selectedAccountId),
  });
  const sessionTags = sessionTagsRaw as NamedColorTag[] | undefined;

  const modelTagsOpts = trpcOptions.trades.listModelTags.queryOptions({
    accountId: selectedAccountId || "",
  });
  const { data: modelTagsRaw } = useQuery({
    ...modelTagsOpts,
    enabled: Boolean(selectedAccountId),
  });
  const modelTags = modelTagsRaw as NamedColorTag[] | undefined;

  // Fetch stats for selected trades
  const tradeIdsArray = React.useMemo(() => {
    return selectedIds ? Array.from(selectedIds) : [];
  }, [selectedIds]);

  const statsOpts = trpcOptions.trades.getSelectedTradesStats.queryOptions({
    tradeIds: tradeIdsArray,
  });
  const { data: statsRaw } = useQuery({
    ...statsOpts,
    enabled: tradeIdsArray.length > 0 && statsOpen,
  });
  const stats = statsRaw as SelectedTradesStats | undefined;

  // Mutations
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

  const bulkUpdateProtocolMutation = useMutation({
    mutationFn: async (input: {
      tradeIds: string[];
      protocolAlignment: "aligned" | "against" | "discretionary" | null;
    }) => {
      return await trpcClient.trades.bulkUpdateProtocolAlignment.mutate(input);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [["trades"]] });
      toast.success(
        `Updated protocol alignment for ${data.updatedCount} trades`
      );
      onClear();
    },
    onError: (error) => {
      console.error("Bulk protocol update failed:", error);
      toast.error("Failed to update protocol alignment. Please try again.");
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (input: { tradeIds: string[] }) => {
      return await trpcClient.trades.bulkDeleteTrades.mutate(input);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [["trades"]] });
      toast.success(`Deleted ${data.deletedCount} trades`);
      setDeleteDialogOpen(false);
      onClear();
    },
    onError: (error) => {
      console.error("Bulk delete failed:", error);
      toast.error("Failed to delete trades. Please try again.");
    },
  });

  const bulkAddNotesMutation = useMutation({
    mutationFn: async (input: {
      tradeIds: string[];
      note: string;
      appendToExisting: boolean;
    }) => {
      return await trpcClient.trades.bulkAddNotes.mutate(input);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [["trades"]] });
      toast.success(`Added notes to ${data.updatedCount} trades`);
      setNotesDialogOpen(false);
      setNoteText("");
      setAppendNote(false);
      onClear();
    },
    onError: (error) => {
      console.error("Bulk notes failed:", error);
      toast.error("Failed to add notes. Please try again.");
    },
  });

  const bulkToggleFavoriteMutation = useMutation({
    mutationFn: async (input: { tradeIds: string[]; favorite: boolean }) => {
      return await trpcClient.trades.bulkToggleFavorite.mutate(input);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [["trades"]] });
      toast.success(`Updated ${data.updatedCount} trades`);
      onClear();
    },
    onError: (error) => {
      console.error("Bulk favorite failed:", error);
      toast.error("Failed to update favorites. Please try again.");
    },
  });

  // Handlers
  const handleApplySessionTag = () => {
    const trimmed = sessionTagName.trim();
    if (!trimmed) {
      toast.error("Please enter a session tag name");
      return;
    }

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

  const handleProtocolAlignment = (
    alignment: "aligned" | "against" | "discretionary"
  ) => {
    bulkUpdateProtocolMutation.mutate({
      tradeIds: Array.from(selectedIds),
      protocolAlignment: alignment,
    });
  };

  const handleDelete = () => {
    bulkDeleteMutation.mutate({
      tradeIds: Array.from(selectedIds),
    });
  };

  const handleAddNotes = () => {
    if (!noteText.trim()) {
      toast.error("Please enter a note");
      return;
    }

    bulkAddNotesMutation.mutate({
      tradeIds: Array.from(selectedIds),
      note: noteText.trim(),
      appendToExisting: appendNote,
    });
  };

  const handleExport = () => {
    if (!selectedIds || selectedIds.size === 0) {
      toast.error("No trades selected");
      return;
    }

    if (selectedTrades && selectedTrades.length > 0 && visibleColumns?.length) {
      exportTradesToCSV(
        selectedTrades,
        visibleColumns,
        Object.fromEntries(visibleColumns.map((column) => [column, column]))
      );
      toast.success(`Exported ${selectedTrades.length} trades`);
      return;
    }

    const csvContent = `data:text/csv;charset=utf-8,Trade IDs\n${Array.from(
      selectedIds
    ).join("\n")}`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `trades_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${selectedIds.size} trade IDs`);
  };

  const handleShare = async () => {
    if (!selectedIds || selectedIds.size === 0) {
      toast.error("No trades selected");
      return;
    }
    const shareUrl = `${window.location.origin}${sharePath}?ids=${Array.from(
      selectedIds
    ).join(",")}`;
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Share link copied to clipboard!");
  };

  const handleRecalculate = () => {
    toast.info("Recalculation feature coming soon!");
  };

  const handleToggleFavorite = () => {
    if (!selectedIds || selectedIds.size === 0) {
      toast.error("No trades selected");
      return;
    }
    bulkToggleFavoriteMutation.mutate({
      tradeIds: Array.from(selectedIds),
      favorite: true,
    });
  };

  return (
    <>
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300">
        <div className="bg-sidebar border border-white/5 rounded-sm shadow-2xl shadow-black/50 px-2 py-1.5 flex items-center gap-1.5">
          <div className="flex items-center overflow-hidden border border-blue-500/25 bg-blue-500/10 rounded-sm">
            <span className="px-3 py-1.5 text-xs text-blue-300 font-medium tabular-nums">
              {selectedCount} selected
            </span>
          </div>

          <div className="h-7 w-[1px] bg-white/5" />

          {/* Tag Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="cursor-pointer flex items-center justify-center gap-1.5 px-3 py-2 h-[32px] text-xs rounded-sm transition-all active:scale-95 duration-250 border border-white/5 bg-sidebar hover:bg-sidebar-accent text-white/70">
                <Tag className="size-3.5" />
                Tag
                <ChevronDown className="size-3 text-white/40" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="bg-sidebar border border-white/5 rounded-sm"
            >
              <DropdownMenuItem
                className="text-xs"
                onSelect={(e) => {
                  e.preventDefault();
                  setTimeout(() => {
                    setModelPopoverOpen(false);
                    setSessionPopoverOpen(true);
                  }, 0);
                }}
              >
                <Tag className="size-3.5 mr-2" />
                Session Tag
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-xs"
                onSelect={(e) => {
                  e.preventDefault();
                  setTimeout(() => {
                    setSessionPopoverOpen(false);
                    setModelPopoverOpen(true);
                  }, 0);
                }}
              >
                <Tag className="size-3.5 mr-2" />
                Model Tag
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Protocol Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="cursor-pointer flex items-center justify-center gap-1.5 px-3 py-2 h-[32px] text-xs rounded-sm transition-all active:scale-95 duration-250 border border-white/5 bg-sidebar hover:bg-sidebar-accent text-white/70">
                <Shield className="size-3.5" />
                Protocol
                <ChevronDown className="size-3 text-white/40" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="bg-sidebar border border-white/5 rounded-sm"
            >
              <DropdownMenuItem
                className="text-xs"
                onSelect={() => handleProtocolAlignment("aligned")}
              >
                <div className="size-2 rounded-full bg-green-500 mr-2" />
                Aligned
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-xs"
                onSelect={() => handleProtocolAlignment("against")}
              >
                <div className="size-2 rounded-full bg-red-500 mr-2" />
                Against
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-xs"
                onSelect={() => handleProtocolAlignment("discretionary")}
              >
                <div className="size-2 rounded-full bg-gray-500 mr-2" />
                Discretionary
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Actions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="cursor-pointer flex items-center justify-center gap-1.5 px-3 py-2 h-[32px] text-xs rounded-sm transition-all active:scale-95 duration-250 border border-white/5 bg-sidebar hover:bg-sidebar-accent text-white/70">
                Actions
                <ChevronDown className="size-3 text-white/40" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="bg-sidebar border border-white/5 rounded-sm w-48"
            >
              <DropdownMenuItem
                className="text-xs"
                onSelect={() => setStatsOpen(true)}
              >
                <BarChart3 className="size-3.5 mr-2" />
                Quick Stats
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs" onSelect={handleExport}>
                <Download className="size-3.5 mr-2" />
                Export
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs" onSelect={handleShare}>
                <Share2 className="size-3.5 mr-2" />
                Share
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-xs"
                onSelect={() => setNotesDialogOpen(true)}
              >
                <StickyNote className="size-3.5 mr-2" />
                Add Notes
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-xs"
                onSelect={handleToggleFavorite}
              >
                <Star className="size-3.5 mr-2" />
                Favorite
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {onCompare && (
                <DropdownMenuItem className="text-xs" onSelect={onCompare}>
                  <GitCompare className="size-3.5 mr-2" />
                  Compare
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="text-xs"
                onSelect={handleRecalculate}
              >
                <RefreshCw className="size-3.5 mr-2" />
                Recalculate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-xs text-red-400"
                onSelect={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="size-3.5 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="h-7 w-[1px] bg-white/5" />

          {/* Clear Button */}
          <Button
            onClick={onClear}
            className="cursor-pointer flex items-center justify-center gap-1.5 px-3 py-2 h-[32px] text-xs rounded-sm transition-all active:scale-95 duration-250 border border-white/5 bg-sidebar hover:bg-sidebar-accent text-white/40 hover:text-white"
          >
            <X className="size-3.5" />
            Clear
          </Button>
        </div>
      </div>

      {/* Session Tag Popover */}
      <Popover
        open={sessionPopoverOpen}
        onOpenChange={setSessionPopoverOpen}
        modal={false}
      >
        <PopoverTrigger asChild>
          <div
            style={{
              position: "fixed",
              left: "50%",
              bottom: "150px",
              pointerEvents: "none",
              width: 0,
              height: 0,
            }}
          />
        </PopoverTrigger>

        <PopoverContent
          className="w-full bg-sidebar border border-white/5 rounded-sm text-white ml-28"
          align="center"
          side="top"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            const target = e.target as HTMLElement;
            if (
              target.closest('[role="menu"]') ||
              target.closest('[role="menuitem"]')
            ) {
              e.preventDefault();
            }
          }}
        >
          <div className="space-y-4">
            <div className="space-y-3">
              <Label
                htmlFor="bulk-session-tag-name"
                className="text-xs text-white/70"
              >
                Session name
              </Label>
              <Input
                id="bulk-session-tag-name"
                placeholder="e.g., London, New York, Asia..."
                value={sessionTagName}
                className="bg-sidebar border-white/5 rounded-sm text-white/80 placeholder:text-white/30"
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
                <Label className="text-xs text-white/70">
                  Existing sessions
                </Label>
                <div className="flex flex-wrap gap-2">
                  {sessionTags.map((tag) => {
                    const isActive =
                      tag.name.toLowerCase() ===
                      sessionTagName.trim().toLowerCase();
                    return (
                      <button
                        key={tag.name}
                        type="button"
                        className={cn(
                          "flex items-center gap-2 border border-white/5 bg-sidebar rounded-sm px-2 py-1 text-xs text-white/70 transition-colors hover:bg-sidebar-accent",
                          isActive && "bg-sidebar-accent text-white"
                        )}
                        onClick={() => {
                          setSessionTagName(tag.name);
                          setSessionTagColor(tag.color);
                          setShowSessionColorPicker(false);
                        }}
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-sm border border-white/20"
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
                      "w-8 h-8 rounded-sm border-2 transition-all cursor-pointer",
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
                    "w-8 h-8 rounded-sm border border-white/5 flex items-center justify-center transition-all text-white/70",
                    showSessionColorPicker
                      ? "border-white/20 bg-sidebar-accent text-white"
                      : "bg-sidebar hover:bg-sidebar-accent"
                  )}
                  onClick={() =>
                    setShowSessionColorPicker(!showSessionColorPicker)
                  }
                >
                  <Plus size={16} />
                </button>
              </div>

              {showSessionColorPicker && (
                <div className="mt-4 space-y-3">
                  <ColorPicker
                    value={sessionTagColor}
                    onChange={(rgba) => {
                      if (!Array.isArray(rgba)) {
                        return;
                      }
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
                className="flex-1 border border-white/5 bg-sidebar-accent text-white hover:bg-sidebar-accent/80 rounded-sm text-xs gap-2"
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

      {/* Model Tag Popover - Similar structure */}
      <Popover
        open={modelPopoverOpen}
        onOpenChange={setModelPopoverOpen}
        modal={false}
      >
        <PopoverTrigger asChild>
          <div
            style={{
              position: "fixed",
              left: "50%",
              bottom: "150px",
              pointerEvents: "none",
              width: 0,
              height: 0,
            }}
          />
        </PopoverTrigger>
        <PopoverContent
          className="w-full bg-sidebar border border-white/5 rounded-none text-white ml-28"
          align="center"
          side="top"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            // Prevent closing when clicking the dropdown menu
            const target = e.target as HTMLElement;
            if (
              target.closest('[role="menu"]') ||
              target.closest('[role="menuitem"]')
            ) {
              e.preventDefault();
            }
          }}
        >
          <div className="space-y-4">
            <div className="space-y-3">
              <Label
                htmlFor="bulk-model-tag-name"
                className="text-xs text-white/70"
              >
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
                      tag.name.toLowerCase() ===
                      modelTagName.trim().toLowerCase();
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
                      if (!Array.isArray(rgba)) {
                        return;
                      }
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-sidebar border border-white/5 rounded-none">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Trades</DialogTitle>
            <DialogDescription className="text-white/60">
              Are you sure you want to delete {selectedCount} trades? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="border-white/5 bg-transparent text-white/70 hover:bg-sidebar-accent rounded-none"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={bulkDeleteMutation.isPending}
              className="bg-red-500/10 text-red-300 hover:bg-red-500/20 rounded-none"
            >
              {bulkDeleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Notes Dialog */}
      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent className="bg-sidebar border border-white/5 rounded-none">
          <DialogHeader>
            <DialogTitle className="text-white">Add Notes</DialogTitle>
            <DialogDescription className="text-white/60">
              Add notes to {selectedCount} selected trades
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="note-text" className="text-xs text-white/70">
                Note
              </Label>
              <Textarea
                id="note-text"
                placeholder="Enter your note..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="bg-sidebar border-white/5 rounded-none text-white/80 placeholder:text-white/30 min-h-[100px]"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="append-note"
                checked={appendNote}
                onChange={(e) => setAppendNote(e.target.checked)}
                className="rounded border-white/5"
              />
              <Label
                htmlFor="append-note"
                className="text-xs text-white/70 cursor-pointer"
              >
                Append to existing notes
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNotesDialogOpen(false)}
              className="border-white/5 bg-transparent text-white/70 hover:bg-sidebar-accent rounded-none"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddNotes}
              disabled={bulkAddNotesMutation.isPending}
              className="bg-sidebar-accent text-white hover:bg-sidebar-accent/80 rounded-none"
            >
              {bulkAddNotesMutation.isPending ? "Adding..." : "Add Notes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Stats Dialog */}
      <Dialog open={statsOpen} onOpenChange={setStatsOpen}>
        <DialogContent className="bg-sidebar border border-white/5 rounded-none max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Quick Stats</DialogTitle>
            <DialogDescription className="text-white/60">
              Statistics for {selectedCount} selected trades
            </DialogDescription>
          </DialogHeader>
          {stats && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-xs text-white/50">Total P&L</div>
                <div
                  className={cn(
                    "text-2xl font-bold",
                    (stats.totalPnL || 0) >= 0
                      ? "text-green-400"
                      : "text-red-400"
                  )}
                >
                  $
                  {Number(stats.totalPnL || 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-white/50">Net P&L</div>
                <div
                  className={cn(
                    "text-2xl font-bold",
                    (stats.netPnL || 0) >= 0 ? "text-green-400" : "text-red-400"
                  )}
                >
                  $
                  {Number(stats.netPnL || 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-white/50">Win Rate</div>
                <div className="text-xl font-semibold text-white">
                  {Number(stats.winRate || 0).toFixed(1)}%
                </div>
                <div className="text-xs text-white/40">
                  {stats.wins || 0}W / {stats.losses || 0}L /{" "}
                  {stats.breakeven || 0}BE
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-white/50">Avg RR</div>
                <div className="text-xl font-semibold text-white">
                  {Number(stats.avgRR || 0).toFixed(2)}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-white/50">Total Volume</div>
                <div className="text-xl font-semibold text-white">
                  {Number(stats.totalVolume || 0).toFixed(2)} lots
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-white/50">Avg Hold Time</div>
                <div className="text-xl font-semibold text-white">
                  {Math.floor((stats.avgHold || 0) / 3600)}h{" "}
                  {Math.floor(((stats.avgHold || 0) % 3600) / 60)}m
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-white/50">Total Commissions</div>
                <div className="text-xl font-semibold text-red-400">
                  $
                  {Math.abs(Number(stats.totalCommissions || 0)).toLocaleString(
                    undefined,
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-white/50">Total Swap</div>
                <div
                  className={cn(
                    "text-xl font-semibold",
                    (stats.totalSwap || 0) >= 0
                      ? "text-green-400"
                      : "text-red-400"
                  )}
                >
                  $
                  {Number(stats.totalSwap || 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
