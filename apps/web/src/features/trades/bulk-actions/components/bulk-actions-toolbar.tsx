"use client";

import { useMemo, useState } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { ShareCardDialog } from "@/components/pnl-card/share-card-dialog";
import type { PnlCardData } from "@/components/pnl-card/pnl-card-renderer";
import { exportTradeDetails } from "@/components/trades/export-trade-details";
import { TradeReplay } from "@/components/trades/trade-replay";
import { exportTradesToCSV } from "@/lib/export-trades";
import { useAccountStore } from "@/stores/account";
import { queryClient, trpcClient, trpcOptions } from "@/utils/trpc";

import { BulkActionsBar } from "./bulk-actions-bar";
import { BulkActionsDialogs } from "./bulk-actions-dialogs";
import {
  DEFAULT_MODEL_COLORS,
  DEFAULT_SESSION_COLORS,
} from "../lib/bulk-actions-constants";
import { getBulkFavoriteAction } from "../lib/bulk-actions-utils";
import type {
  BulkTagEditorProps,
  BulkActionsToolbarProps,
  NamedColorTag,
  ProtocolAlignment,
  SelectedTradesStats,
} from "../lib/bulk-actions-types";

function invalidateTradesQuery() {
  queryClient.invalidateQueries({ queryKey: [["trades"]] });
}

export function BulkActionsToolbar({
  selectedCount,
  selectedIds,
  selectedTrades,
  visibleColumns,
  sharePath = "/dashboard/trades",
  onClear,
  onCompare,
  onOpenTradeDetails,
}: BulkActionsToolbarProps) {
  const { selectedAccountId } = useAccountStore();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [shareCardOpen, setShareCardOpen] = useState(false);
  const [replayOpen, setReplayOpen] = useState(false);

  const [sessionTagName, setSessionTagName] = useState("");
  const [sessionTagColor, setSessionTagColor] = useState(
    DEFAULT_SESSION_COLORS[0]
  );
  const [showSessionColorPicker, setShowSessionColorPicker] = useState(false);
  const [modelTagName, setModelTagName] = useState("");
  const [modelTagColor, setModelTagColor] = useState(DEFAULT_MODEL_COLORS[0]);
  const [showModelColorPicker, setShowModelColorPicker] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [appendNote, setAppendNote] = useState(false);

  const selectedTradeIds = useMemo(
    () => Array.from(selectedIds ?? []),
    [selectedIds]
  );

  const sessionTagsQuery = useQuery({
    ...trpcOptions.trades.listSessionTags.queryOptions({
      accountId: selectedAccountId || "",
    }),
    enabled: Boolean(selectedAccountId),
  });
  const sessionTags = sessionTagsQuery.data as NamedColorTag[] | undefined;

  const modelTagsQuery = useQuery({
    ...trpcOptions.trades.listModelTags.queryOptions({
      accountId: selectedAccountId || "",
    }),
    enabled: Boolean(selectedAccountId),
  });
  const modelTags = modelTagsQuery.data as NamedColorTag[] | undefined;

  const statsQuery = useQuery({
    ...trpcOptions.trades.getSelectedTradesStats.queryOptions({
      tradeIds: selectedTradeIds,
    }),
    enabled: selectedTradeIds.length > 0 && statsOpen,
  });
  const stats = statsQuery.data as SelectedTradesStats | undefined;

  const bulkUpdateSessionMutation = useMutation({
    mutationFn: async (input: {
      tradeIds: string[];
      sessionTag: string | null;
      sessionTagColor: string | null;
    }) => trpcClient.trades.bulkUpdateSessionTags.mutate(input),
    onSuccess: (data) => {
      invalidateTradesQuery();
      toast.success(`Updated ${data.updatedCount} trades with session tag`);
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
    }) => trpcClient.trades.bulkUpdateModelTags.mutate(input),
    onSuccess: (data) => {
      invalidateTradesQuery();
      toast.success(`Updated ${data.updatedCount} trades with model tag`);
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
      protocolAlignment: ProtocolAlignment | null;
    }) => trpcClient.trades.bulkUpdateProtocolAlignment.mutate(input),
    onSuccess: (data) => {
      invalidateTradesQuery();
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
    mutationFn: async (input: { tradeIds: string[] }) =>
      trpcClient.trades.bulkDeleteTrades.mutate(input),
    onSuccess: (data) => {
      invalidateTradesQuery();
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
    }) => trpcClient.trades.bulkAddNotes.mutate(input),
    onSuccess: (data) => {
      invalidateTradesQuery();
      void queryClient.invalidateQueries({ queryKey: [["tradeNotes"]] });
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
    mutationFn: async (input: { tradeIds: string[]; favorite: boolean }) =>
      trpcClient.trades.bulkToggleFavorite.mutate(input),
    onSuccess: (data) => {
      invalidateTradesQuery();
      toast.success(`Updated ${data.updatedCount} trades`);
      onClear();
    },
    onError: (error) => {
      console.error("Bulk favorite failed:", error);
      toast.error("Failed to update favorites. Please try again.");
    },
  });

  const handleApplySessionTag = () => {
    const trimmed = sessionTagName.trim();
    if (!trimmed) {
      toast.error("Please enter a session tag name");
      return;
    }

    const existingTag = sessionTags?.find(
      (tag) => tag.name.toLowerCase() === trimmed.toLowerCase()
    );

    bulkUpdateSessionMutation.mutate({
      tradeIds: selectedTradeIds,
      sessionTag: existingTag ? existingTag.name : trimmed,
      sessionTagColor: existingTag ? existingTag.color : sessionTagColor,
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

    bulkUpdateModelMutation.mutate({
      tradeIds: selectedTradeIds,
      modelTag: existingTag ? existingTag.name : trimmed,
      modelTagColor: existingTag ? existingTag.color : modelTagColor,
    });
  };

  const handleProtocolAlignment = (alignment: ProtocolAlignment) => {
    bulkUpdateProtocolMutation.mutate({
      tradeIds: selectedTradeIds,
      protocolAlignment: alignment,
    });
  };

  const handleDelete = () => {
    bulkDeleteMutation.mutate({ tradeIds: selectedTradeIds });
  };

  const handleAddNotes = () => {
    const trimmed = noteText.trim();
    if (!trimmed) {
      toast.error("Please enter a note");
      return;
    }

    bulkAddNotesMutation.mutate({
      tradeIds: selectedTradeIds,
      note: trimmed,
      appendToExisting: appendNote,
    });
  };

  const handleExport = () => {
    if (selectedTradeIds.length === 0) {
      toast.error("No trades selected");
      return;
    }

    if (selectedTrades?.length && visibleColumns?.length) {
      exportTradesToCSV(
        selectedTrades,
        visibleColumns,
        Object.fromEntries(visibleColumns.map((column) => [column, column]))
      );
      toast.success(`Exported ${selectedTrades.length} trades`);
      return;
    }

    const csvContent = `data:text/csv;charset=utf-8,Trade IDs\n${selectedTradeIds.join(
      "\n"
    )}`;
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
    toast.success(`Exported ${selectedTradeIds.length} trade IDs`);
  };

  const handleShare = async () => {
    if (selectedTradeIds.length === 0) {
      toast.error("No trades selected");
      return;
    }

    const shareUrl = `${
      window.location.origin
    }${sharePath}?ids=${selectedTradeIds.join(",")}`;
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Share link copied to clipboard!");
  };

  const handleToggleFavorite = () => {
    if (selectedTradeIds.length === 0) {
      toast.error("No trades selected");
      return;
    }

    const favoriteAction = getBulkFavoriteAction(selectedTrades);

    bulkToggleFavoriteMutation.mutate({
      tradeIds: selectedTradeIds,
      favorite: favoriteAction.favorite,
    });
  };

  const favoriteAction = getBulkFavoriteAction(selectedTrades);
  const singleTrade = selectedTrades?.length === 1 ? selectedTrades[0] : null;

  const singleTradeCardData: PnlCardData | null = singleTrade
    ? {
        symbol: singleTrade.symbol || "Unknown",
        tradeType: singleTrade.tradeDirection,
        profit: singleTrade.profit,
        openPrice: singleTrade.openPrice || 0,
        closePrice: singleTrade.closePrice || 0,
        volume: singleTrade.volume,
        openTime: singleTrade.open,
        closeTime: singleTrade.close,
        realisedRR: singleTrade.realisedRR || 0,
        outcome: singleTrade.outcome || null,
        duration: singleTrade.holdSeconds || 0,
      }
    : null;

  const sessionTagEditor: BulkTagEditorProps = {
    title: "Session tag",
    inputId: "bulk-session-tag-name",
    inputLabel: "Session name",
    placeholder: "e.g., London, New York, Asia...",
    existingLabel: "Existing sessions",
    tagName: sessionTagName,
    tagColor: sessionTagColor,
    showColorPicker: showSessionColorPicker,
    defaultColors: DEFAULT_SESSION_COLORS,
    existingTags: sessionTags,
    selectedCount,
    isPending: bulkUpdateSessionMutation.isPending,
    onTagNameChange: setSessionTagName,
    onTagColorChange: setSessionTagColor,
    onShowColorPickerChange: setShowSessionColorPicker,
    onApply: handleApplySessionTag,
  };

  const modelTagEditor: BulkTagEditorProps = {
    title: "Model Tag",
    inputId: "bulk-model-tag-name",
    inputLabel: "Model name",
    placeholder: "e.g., Breakout, Reversal, Trend...",
    existingLabel: "Existing models",
    tagName: modelTagName,
    tagColor: modelTagColor,
    showColorPicker: showModelColorPicker,
    defaultColors: DEFAULT_MODEL_COLORS,
    existingTags: modelTags,
    selectedCount,
    isPending: bulkUpdateModelMutation.isPending,
    onTagNameChange: setModelTagName,
    onTagColorChange: setModelTagColor,
    onShowColorPickerChange: setShowModelColorPicker,
    onApply: handleApplyModelTag,
  };

  return (
    <>
      <BulkActionsBar
        selectedCount={selectedCount}
        sessionTagEditor={sessionTagEditor}
        modelTagEditor={modelTagEditor}
        onProtocolAlignment={handleProtocolAlignment}
        onOpenStats={() => setStatsOpen(true)}
        onExport={handleExport}
        onShare={() => void handleShare()}
        onOpenTradeDetails={onOpenTradeDetails}
        onReplayTrade={singleTrade ? () => setReplayOpen(true) : undefined}
        onShareCard={singleTrade ? () => setShareCardOpen(true) : undefined}
        onCopyTradeId={
          singleTrade
            ? () => {
                navigator.clipboard.writeText(singleTrade.id);
                toast.success("Trade ID copied to clipboard");
              }
            : undefined
        }
        onExportTradeDetails={
          singleTrade
            ? () => {
                exportTradeDetails(singleTrade);
                toast.success("Trade details exported");
              }
            : undefined
        }
        onOpenNotes={() => setNotesDialogOpen(true)}
        onToggleFavorite={handleToggleFavorite}
        favoriteActionLabel={favoriteAction.label}
        onCompare={onCompare}
        onOpenDelete={() => setDeleteDialogOpen(true)}
        onClear={onClear}
      />

      <BulkActionsDialogs
        selectedCount={selectedCount}
        deleteDialogOpen={deleteDialogOpen}
        notesDialogOpen={notesDialogOpen}
        statsOpen={statsOpen}
        noteText={noteText}
        appendNote={appendNote}
        stats={stats}
        deletePending={bulkDeleteMutation.isPending}
        notesPending={bulkAddNotesMutation.isPending}
        onDeleteDialogOpenChange={setDeleteDialogOpen}
        onNotesDialogOpenChange={setNotesDialogOpen}
        onStatsOpenChange={setStatsOpen}
        onNoteTextChange={setNoteText}
        onAppendNoteChange={setAppendNote}
        onDelete={handleDelete}
        onAddNotes={handleAddNotes}
      />

      {singleTradeCardData ? (
        <ShareCardDialog
          open={shareCardOpen}
          onOpenChange={setShareCardOpen}
          tradeData={singleTradeCardData}
        />
      ) : null}

      {singleTrade ? (
        <TradeReplay
          tradeId={singleTrade.id}
          open={replayOpen}
          onOpenChange={setReplayOpen}
        />
      ) : null}
    </>
  );
}
