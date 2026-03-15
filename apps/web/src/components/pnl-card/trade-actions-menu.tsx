"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Share2, Download, Copy, Play } from "lucide-react";
import { ShareCardDialog } from "./share-card-dialog";
import { TradeReplay } from "@/components/trades/trade-replay";
import { exportTradeDetails } from "@/components/trades/export-trade-details";
import type { PnlCardData } from "./pnl-card-renderer";
import { toast } from "sonner";

interface TradeActionsMenuProps {
  trade: {
    id: string;
    symbol?: string | null;
    tradeDirection: "long" | "short";
    profit: number;
    open: string;
    close: string;
    volume: number;
    sl?: number | null;
    tp?: number | null;
    realisedRR?: number | null;
    outcome?: "Win" | "Loss" | "BE" | "PW" | null;
    holdSeconds?: number;
    openPrice?: number | null;
    closePrice?: number | null;
  };
}

export function TradeActionsMenu({ trade }: TradeActionsMenuProps) {
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showReplayDialog, setShowReplayDialog] = useState(false);

  // Prepare card data
  const cardData: PnlCardData = {
    symbol: trade.symbol || "Unknown",
    tradeType: trade.tradeDirection,
    profit: trade.profit,
    openPrice: trade.openPrice || 0,
    closePrice: trade.closePrice || 0,
    volume: trade.volume,
    openTime: trade.open,
    closeTime: trade.close,
    realisedRR: trade.realisedRR || 0,
    outcome: trade.outcome || null,
    duration: trade.holdSeconds || 0,
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              setShowReplayDialog(true);
            }}
          >
            <Play className="mr-2 h-4 w-4" />
            Replay Trade
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              setShowShareDialog(true);
            }}
          >
            <Share2 className="mr-2 h-4 w-4" />
            Share PnL Card
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(trade.id);
              toast.success("Trade ID copied to clipboard");
            }}
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy Trade ID
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              exportTradeDetails(trade);
              toast.success("Trade details exported");
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Export Details
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ShareCardDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        tradeData={cardData}
      />

      <TradeReplay
        tradeId={trade.id}
        open={showReplayDialog}
        onOpenChange={setShowReplayDialog}
      />
    </>
  );
}
