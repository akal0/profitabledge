"use client";

import { useMemo, useReducer } from "react";

import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { ShareCardDialog } from "@/components/pnl-card/share-card-dialog";
import type { PnlCardData } from "@/components/pnl-card/pnl-card-renderer";
import { exportTradeDetails } from "@/components/trades/export-trade-details";
import { TradeReplay } from "@/components/trades/trade-replay";
import { downloadTextFile, exportTradesToCSV } from "@/lib/export-trades";
import { useAccountStore } from "@/stores/account";
import { queryClient, trpcClient, trpcOptions } from "@/utils/trpc";

import { BulkActionsBar } from "./bulk-actions-bar";
import { BulkActionsDialogs } from "./bulk-actions-dialogs";
import { useBulkMutation } from "../hooks/use-bulk-mutation";
import {
  DEFAULT_MODEL_COLORS,
  DEFAULT_SESSION_COLORS,
} from "../lib/bulk-actions-constants";
import { getBulkFavoriteAction } from "../lib/bulk-actions-utils";
import {
  bulkActionsReducer,
  createInitialBulkActionsState,
} from "../lib/bulk-actions-state";
import type {
  BulkTagEditorProps,
  BulkActionsToolbarProps,
  NamedColorTag,
  ProtocolAlignment,
  SelectedTradesStats,
} from "../lib/bulk-actions-types";

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
  const [state, dispatch] = useReducer(
    bulkActionsReducer,
    undefined,
    createInitialBulkActionsState
  );

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
    enabled: selectedTradeIds.length > 0 && state.statsOpen,
  });
  const stats = statsQuery.data as SelectedTradesStats | undefined;

  const bulkUpdateSessionMutation = useBulkMutation({
    errorMessage: "Failed to update session tags. Please try again.",
    mutationFn: async (input: {
      tradeIds: string[];
      sessionTag: string | null;
      sessionTagColor: string | null;
    }) => trpcClient.trades.bulkUpdateSessionTags.mutate(input),
    onSuccess: async () => {
      dispatch({ type: "resetSessionTag" });
      onClear();
    },
    successMessage: (data: { updatedCount: number }) =>
      `Updated ${data.updatedCount} trades with session tag`,
  });

  const bulkUpdateModelMutation = useBulkMutation({
    errorMessage: "Failed to update model tags. Please try again.",
    mutationFn: async (input: {
      tradeIds: string[];
      modelTag: string | null;
      modelTagColor: string | null;
    }) => trpcClient.trades.bulkUpdateModelTags.mutate(input),
    onSuccess: async () => {
      dispatch({ type: "resetModelTag" });
      onClear();
    },
    successMessage: (data: { updatedCount: number }) =>
      `Updated ${data.updatedCount} trades with model tag`,
  });

  const bulkUpdateProtocolMutation = useBulkMutation({
    errorMessage: "Failed to update protocol alignment. Please try again.",
    mutationFn: async (input: {
      tradeIds: string[];
      protocolAlignment: ProtocolAlignment | null;
    }) => trpcClient.trades.bulkUpdateProtocolAlignment.mutate(input),
    onSuccess: async () => {
      onClear();
    },
    successMessage: (data: { updatedCount: number }) =>
      `Updated protocol alignment for ${data.updatedCount} trades`,
  });

  const bulkDeleteMutation = useBulkMutation({
    errorMessage: "Failed to delete trades. Please try again.",
    mutationFn: async (input: { tradeIds: string[] }) =>
      trpcClient.trades.bulkDeleteTrades.mutate(input),
    onSuccess: async () => {
      dispatch({ type: "setDeleteDialogOpen", open: false });
      onClear();
    },
    successMessage: (data: { deletedCount: number }) =>
      `Deleted ${data.deletedCount} trades`,
  });

  const bulkAddNotesMutation = useBulkMutation({
    errorMessage: "Failed to add notes. Please try again.",
    mutationFn: async (input: {
      tradeIds: string[];
      note: string;
      appendToExisting: boolean;
    }) => trpcClient.trades.bulkAddNotes.mutate(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [["tradeNotes"]] });
      dispatch({ type: "resetNotes" });
      onClear();
    },
    successMessage: (data: { updatedCount: number }) =>
      `Added notes to ${data.updatedCount} trades`,
  });

  const bulkToggleFavoriteMutation = useBulkMutation({
    errorMessage: "Failed to update favorites. Please try again.",
    mutationFn: async (input: { tradeIds: string[]; favorite: boolean }) =>
      trpcClient.trades.bulkToggleFavorite.mutate(input),
    onSuccess: async () => {
      onClear();
    },
    successMessage: (data: { updatedCount: number }) =>
      `Updated ${data.updatedCount} trades`,
  });

  const handleApplySessionTag = () => {
    const trimmed = state.sessionTagName.trim();
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
      sessionTagColor: existingTag ? existingTag.color : state.sessionTagColor,
    });
  };

  const handleApplyModelTag = () => {
    const trimmed = state.modelTagName.trim();
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
      modelTagColor: existingTag ? existingTag.color : state.modelTagColor,
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
    const trimmed = state.noteText.trim();
    if (!trimmed) {
      toast.error("Please enter a note");
      return;
    }

    bulkAddNotesMutation.mutate({
      tradeIds: selectedTradeIds,
      note: trimmed,
      appendToExisting: state.appendNote,
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

    downloadTextFile(
      `Trade IDs\n${selectedTradeIds.join("\n")}`,
      `trades_${new Date().toISOString().split("T")[0]}.csv`,
      "text/csv;charset=utf-8;"
    );
    toast.success(`Exported ${selectedTradeIds.length} trade IDs`);
  };

  const handleShare = async () => {
    if (selectedTradeIds.length === 0) {
      toast.error("No trades selected");
      return;
    }

    const shareUrl = `${window.location.origin}${sharePath}?ids=${selectedTradeIds.join(",")}`;
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
        tradeId: singleTrade.id,
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
    tagName: state.sessionTagName,
    tagColor: state.sessionTagColor,
    showColorPicker: state.showSessionColorPicker,
    defaultColors: DEFAULT_SESSION_COLORS,
    existingTags: sessionTags,
    selectedCount,
    isPending: bulkUpdateSessionMutation.isPending,
    onTagNameChange: (value) => dispatch({ type: "setSessionTagName", value }),
    onTagColorChange: (value) => dispatch({ type: "setSessionTagColor", value }),
    onShowColorPickerChange: (open) =>
      dispatch({ type: "setShowSessionColorPicker", open }),
    onApply: handleApplySessionTag,
  };

  const modelTagEditor: BulkTagEditorProps = {
    title: "Model Tag",
    inputId: "bulk-model-tag-name",
    inputLabel: "Model name",
    placeholder: "e.g., Breakout, Reversal, Trend...",
    existingLabel: "Existing models",
    tagName: state.modelTagName,
    tagColor: state.modelTagColor,
    showColorPicker: state.showModelColorPicker,
    defaultColors: DEFAULT_MODEL_COLORS,
    existingTags: modelTags,
    selectedCount,
    isPending: bulkUpdateModelMutation.isPending,
    onTagNameChange: (value) => dispatch({ type: "setModelTagName", value }),
    onTagColorChange: (value) => dispatch({ type: "setModelTagColor", value }),
    onShowColorPickerChange: (open) =>
      dispatch({ type: "setShowModelColorPicker", open }),
    onApply: handleApplyModelTag,
  };

  return (
    <>
      <BulkActionsBar
        selectedCount={selectedCount}
        sessionTagEditor={sessionTagEditor}
        modelTagEditor={modelTagEditor}
        onProtocolAlignment={handleProtocolAlignment}
        onOpenStats={() => dispatch({ type: "setStatsOpen", open: true })}
        onExport={handleExport}
        onShare={() => void handleShare()}
        onOpenTradeDetails={onOpenTradeDetails}
        onReplayTrade={
          singleTrade
            ? () => dispatch({ type: "setReplayOpen", open: true })
            : undefined
        }
        onShareCard={
          singleTrade
            ? () => dispatch({ type: "setShareCardOpen", open: true })
            : undefined
        }
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
        onOpenNotes={() => dispatch({ type: "setNotesDialogOpen", open: true })}
        onToggleFavorite={handleToggleFavorite}
        favoriteActionLabel={favoriteAction.label}
        onCompare={onCompare}
        onOpenDelete={() => dispatch({ type: "setDeleteDialogOpen", open: true })}
        onClear={onClear}
      />

      <BulkActionsDialogs
        selectedCount={selectedCount}
        deleteDialogOpen={state.deleteDialogOpen}
        notesDialogOpen={state.notesDialogOpen}
        statsOpen={state.statsOpen}
        noteText={state.noteText}
        appendNote={state.appendNote}
        stats={stats}
        deletePending={bulkDeleteMutation.isPending}
        notesPending={bulkAddNotesMutation.isPending}
        onDeleteDialogOpenChange={(open) =>
          dispatch({ type: "setDeleteDialogOpen", open })
        }
        onNotesDialogOpenChange={(open) =>
          dispatch({ type: "setNotesDialogOpen", open })
        }
        onStatsOpenChange={(open) => dispatch({ type: "setStatsOpen", open })}
        onNoteTextChange={(value) => dispatch({ type: "setNoteText", value })}
        onAppendNoteChange={(checked) =>
          dispatch({ type: "setAppendNote", value: checked })
        }
        onDelete={handleDelete}
        onAddNotes={handleAddNotes}
      />

      {singleTradeCardData ? (
        <ShareCardDialog
          open={state.shareCardOpen}
          onOpenChange={(open) => dispatch({ type: "setShareCardOpen", open })}
          tradeData={singleTradeCardData}
        />
      ) : null}

      {singleTrade ? (
        <TradeReplay
          tradeId={singleTrade.id}
          open={state.replayOpen}
          onOpenChange={(open) => dispatch({ type: "setReplayOpen", open })}
        />
      ) : null}
    </>
  );
}
