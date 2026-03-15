"use client";

import type { TradeRow } from "@/features/trades/table/lib/trade-table-types";

export interface BulkActionsToolbarProps {
  selectedCount: number;
  selectedIds: Set<string>;
  selectedTrades?: TradeRow[];
  visibleColumns?: string[];
  sharePath?: string;
  onClear: () => void;
  onCompare?: () => void;
  onOpenTradeDetails?: () => void;
}

export type NamedColorTag = {
  name: string;
  color: string;
};

export type SelectedTradesStats = {
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

export type ProtocolAlignment = "aligned" | "against" | "discretionary";

export type BulkTagEditorProps = {
  title: string;
  inputId: string;
  inputLabel: string;
  placeholder: string;
  existingLabel: string;
  tagName: string;
  tagColor: string;
  showColorPicker: boolean;
  defaultColors: string[];
  existingTags?: NamedColorTag[];
  selectedCount: number;
  isPending: boolean;
  onTagNameChange: (value: string) => void;
  onTagColorChange: (value: string) => void;
  onShowColorPickerChange: (open: boolean) => void;
  onApply: () => void;
};
