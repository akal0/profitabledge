"use client";

import {
  BarChart3,
  ChevronDown,
  Copy,
  Download,
  Eye,
  GitCompare,
  Play,
  Share2,
  Shield,
  Star,
  StickyNote,
  Tag,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import { BulkTagSubmenuContent } from "./bulk-tag-submenu-content";
import { bulkActionsStyles } from "../lib/bulk-actions-styles";
import type {
  BulkTagEditorProps,
  ProtocolAlignment,
} from "../lib/bulk-actions-types";

type BulkActionsBarProps = {
  selectedCount: number;
  sessionTagEditor: BulkTagEditorProps;
  modelTagEditor: BulkTagEditorProps;
  onProtocolAlignment: (alignment: ProtocolAlignment) => void;
  onOpenStats: () => void;
  onExport: () => void;
  onShare: () => void;
  onOpenTradeDetails?: () => void;
  onReplayTrade?: () => void;
  onShareCard?: () => void;
  onCopyTradeId?: () => void;
  onExportTradeDetails?: () => void;
  onOpenNotes: () => void;
  onToggleFavorite: () => void;
  favoriteActionLabel: string;
  onCompare?: () => void;
  onOpenDelete: () => void;
  onClear: () => void;
};

export function BulkActionsBar({
  selectedCount,
  sessionTagEditor,
  modelTagEditor,
  onProtocolAlignment,
  onOpenStats,
  onExport,
  onShare,
  onOpenTradeDetails,
  onReplayTrade,
  onShareCard,
  onCopyTradeId,
  onExportTradeDetails,
  onOpenNotes,
  onToggleFavorite,
  favoriteActionLabel,
  onCompare,
  onOpenDelete,
  onClear,
}: BulkActionsBarProps) {
  return (
    <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 animate-in slide-in-from-bottom-4 duration-300">
      <div
        className={cn(
          "flex items-center gap-1.5",
          bulkActionsStyles.floatingBarClass
        )}
      >
        <div className={bulkActionsStyles.floatingBarCountPillClass}>
          <span className="px-3 py-1.5 text-xs font-medium tabular-nums text-blue-300">
            {selectedCount} selected
          </span>
        </div>

        <div className="h-7 w-px bg-white/5" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className={bulkActionsStyles.buttonClass}>
              <Tag className="size-3.5" />
              Tag
              <ChevronDown className="size-3 text-white/40" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className={cn(bulkActionsStyles.menuPanelClass, "w-[240px]")}
          >
            <div className={bulkActionsStyles.menuLabelClass}>Tag trades</div>
            <Separator className={bulkActionsStyles.menuMainSeparatorClass} />

            <DropdownMenuSub>
              <DropdownMenuSubTrigger
                className={bulkActionsStyles.menuTriggerClass}
              >
                Session tag
              </DropdownMenuSubTrigger>
              <BulkTagSubmenuContent {...sessionTagEditor} />
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger
                className={bulkActionsStyles.menuTriggerClass}
              >
                Model tag
              </DropdownMenuSubTrigger>
              <BulkTagSubmenuContent {...modelTagEditor} />
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className={bulkActionsStyles.buttonClass}>
              <Shield className="size-3.5" />
              Protocol
              <ChevronDown className="size-3 text-white/40" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className={cn(bulkActionsStyles.menuPanelClass, "w-[220px]")}
          >
            <div className={bulkActionsStyles.menuLabelClass}>Protocol</div>
            <Separator className={bulkActionsStyles.menuMainSeparatorClass} />

            <DropdownMenuItem
              className={bulkActionsStyles.menuItemClass}
              onSelect={() => onProtocolAlignment("aligned")}
            >
              <div className="mr-2 size-2 rounded-full bg-green-500" />
              Aligned
            </DropdownMenuItem>
            <DropdownMenuItem
              className={bulkActionsStyles.menuItemClass}
              onSelect={() => onProtocolAlignment("against")}
            >
              <div className="mr-2 size-2 rounded-full bg-red-500" />
              Against
            </DropdownMenuItem>
            <DropdownMenuItem
              className={bulkActionsStyles.menuItemClass}
              onSelect={() => onProtocolAlignment("discretionary")}
            >
              <div className="mr-2 size-2 rounded-full bg-gray-500" />
              Discretionary
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className={bulkActionsStyles.buttonClass}>
              Actions
              <ChevronDown className="size-3 text-white/40" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className={cn(bulkActionsStyles.menuPanelClass, "w-[248px]")}
          >
            <div className={bulkActionsStyles.menuLabelClass}>
              Selection actions
            </div>
            <Separator className={bulkActionsStyles.menuMainSeparatorClass} />

            {onOpenTradeDetails ||
            onReplayTrade ||
            onShareCard ||
            onCopyTradeId ||
            onExportTradeDetails ? (
              <>
                {onOpenTradeDetails ? (
                  <DropdownMenuItem
                    className={bulkActionsStyles.menuItemClass}
                    onSelect={onOpenTradeDetails}
                  >
                    <Eye className="mr-2 size-3.5" />
                    Open trade details
                  </DropdownMenuItem>
                ) : null}
                {onReplayTrade ? (
                  <DropdownMenuItem
                    className={bulkActionsStyles.menuItemClass}
                    onSelect={onReplayTrade}
                  >
                    <Play className="mr-2 size-3.5" />
                    Replay trade
                  </DropdownMenuItem>
                ) : null}
                {onShareCard ? (
                  <DropdownMenuItem
                    className={bulkActionsStyles.menuItemClass}
                    onSelect={onShareCard}
                  >
                    <Share2 className="mr-2 size-3.5" />
                    Share PnL card
                  </DropdownMenuItem>
                ) : null}
                {onCopyTradeId ? (
                  <DropdownMenuItem
                    className={bulkActionsStyles.menuItemClass}
                    onSelect={onCopyTradeId}
                  >
                    <Copy className="mr-2 size-3.5" />
                    Copy trade ID
                  </DropdownMenuItem>
                ) : null}
                {onExportTradeDetails ? (
                  <DropdownMenuItem
                    className={bulkActionsStyles.menuItemClass}
                    onSelect={onExportTradeDetails}
                  >
                    <Download className="mr-2 size-3.5" />
                    Export trade details
                  </DropdownMenuItem>
                ) : null}
                <Separator
                  className={bulkActionsStyles.menuMainSeparatorClass}
                />
              </>
            ) : null}

            <DropdownMenuItem
              className={bulkActionsStyles.menuItemClass}
              onSelect={onOpenStats}
            >
              <BarChart3 className="mr-2 size-3.5" />
              Selection stats
            </DropdownMenuItem>
            {onCompare ? (
              <DropdownMenuItem
                className={bulkActionsStyles.menuItemClass}
                onSelect={onCompare}
              >
                <GitCompare className="mr-2 size-3.5" />
                Compare selected
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              className={bulkActionsStyles.menuItemClass}
              onSelect={onExport}
            >
              <Download className="mr-2 size-3.5" />
              Export selected rows
            </DropdownMenuItem>
            <DropdownMenuItem
              className={bulkActionsStyles.menuItemClass}
              onSelect={onShare}
            >
              <Share2 className="mr-2 size-3.5" />
              Copy share link
            </DropdownMenuItem>

            <Separator className={bulkActionsStyles.menuMainSeparatorClass} />

            <DropdownMenuItem
              className={bulkActionsStyles.menuItemClass}
              onSelect={onOpenNotes}
            >
              <StickyNote className="mr-2 size-3.5" />
              Add notes
            </DropdownMenuItem>
            <DropdownMenuItem
              className={bulkActionsStyles.menuItemClass}
              onSelect={onToggleFavorite}
            >
              <Star className="mr-2 size-3.5" />
              {favoriteActionLabel}
            </DropdownMenuItem>

            <Separator className={bulkActionsStyles.menuMainSeparatorClass} />

            <DropdownMenuItem
              className={bulkActionsStyles.destructiveMenuItemClass}
              onSelect={onOpenDelete}
            >
              <Trash2 className="mr-2 size-3.5" />
              Delete selected trades
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {onOpenTradeDetails ? (
          <Button
            className={bulkActionsStyles.buttonClass}
            onClick={onOpenTradeDetails}
          >
            <Eye className="size-3.5" />
            View trade details
          </Button>
        ) : null}

        <div className="h-7 w-px bg-white/5" />

        <Button
          onClick={onClear}
          className={bulkActionsStyles.mutedButtonClass}
        >
          <X className="size-3.5" />
          Clear
        </Button>
      </div>
    </div>
  );
}
