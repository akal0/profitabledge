"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { useAccountStore } from "@/stores/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Eye,
  Plus,
  MoreHorizontal,
  Trash2,
  Edit2,
  TrendingUp,
  TrendingDown,
  Target,
  CheckCircle,
  Archive,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";

interface WatchlistWidgetProps {
  isEditing?: boolean;
  className?: string;
}

export function WatchlistWidget({ isEditing = false, className }: WatchlistWidgetProps) {
  const { selectedAccountId } = useAccountStore();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  
  const { data: watchlist, isLoading, refetch } = trpc.watchlist.list.useQuery(
    { accountId: selectedAccountId, status: "watching" },
    { enabled: !!selectedAccountId }
  );
  
  const createItem = trpc.watchlist.create.useMutation({
    onSuccess: () => {
      setShowAddDialog(false);
      refetch();
      toast.success("Added to watchlist");
    },
    onError: () => toast.error("Failed to add item"),
  });
  
  const updateItem = trpc.watchlist.update.useMutation({
    onSuccess: () => {
      setEditingItem(null);
      refetch();
      toast.success("Updated");
    },
    onError: () => toast.error("Failed to update"),
  });
  
  const deleteItem = trpc.watchlist.delete.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Removed from watchlist");
    },
    onError: () => toast.error("Failed to delete"),
  });
  
  return (
    <div
      className={cn(
        "bg-sidebar h-72 w-full border border-white/5 p-1.5 flex flex-col rounded-sm group",
        isEditing && "animate-tilt-subtle hover:animate-none",
        className
      )}
    >
      <div className="flex w-full gap-1.5 items-center p-3.5 widget-header">
        <Eye className="size-4 stroke-white/50 group-hover:stroke-white fill-sidebar transition-all duration-250" />
        <h2 className="text-xs font-medium flex items-center gap-2 text-white/50 group-hover:text-white transition-all duration-250">
          <span>Watchlist</span>
          {watchlist && watchlist.length > 0 && (
            <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-white/10 text-white/50">
              {watchlist.length}
            </Badge>
          )}
        </h2>
        <div className="ml-auto">
          <Button
            size="sm"
            variant="outline"
            className="h-7 rounded-none bg-transparent! border-white/5! text-white/70 text-xs"
            onClick={() => setShowAddDialog(true)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-sidebar-accent dark:group-hover:brightness-120 transition-all duration-250 flex flex-col h-full w-full">
        {isLoading ? (
          <div className="p-3.5 space-y-2">
            <Skeleton className="h-8 w-full bg-sidebar" />
            <Skeleton className="h-8 w-full bg-sidebar" />
            <Skeleton className="h-8 w-full bg-sidebar" />
          </div>
        ) : !selectedAccountId ? (
          <div className="flex-1 flex items-center justify-center text-white/40 text-xs">
            Select an account to view watchlist
          </div>
        ) : !watchlist || watchlist.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-white/40 text-xs gap-2">
            <Eye className="h-6 w-6 opacity-50" />
            <span>No symbols being watched</span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-white/10"
              onClick={() => setShowAddDialog(true)}
            >
              Add your first symbol
            </Button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-1">
            {watchlist.map((item) => (
              <WatchlistItemRow
                key={item.id}
                item={item}
                onEdit={() => setEditingItem(item.id)}
                onDelete={() => deleteItem.mutate({ id: item.id })}
                onUpdateStatus={(status) =>
                  updateItem.mutate({ id: item.id, status })
                }
                isEditing={editingItem === item.id}
                onSaveEdit={(data) =>
                  updateItem.mutate({ id: item.id, ...data })
                }
                onCancelEdit={() => setEditingItem(null)}
              />
            ))}
          </div>
        )}
      </div>

      <AddWatchlistDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAdd={(data) =>
          createItem.mutate({
            ...data,
            accountId: selectedAccountId,
          })
        }
        isLoading={createItem.isPending}
      />
    </div>
  );
}

interface WatchlistItemRowProps {
  item: {
    id: string;
    symbol: string;
    notes?: string | null;
    tags?: string[] | null;
    priority?: number | null;
    status: string;
    targetPrice?: string | null;
    stopPrice?: string | null;
    lastPrice?: string | null;
  };
  onEdit: () => void;
  onDelete: () => void;
  onUpdateStatus: (status: "watching" | "entered" | "exited" | "archived") => void;
  isEditing: boolean;
  onSaveEdit: (data: { symbol?: string; notes?: string; targetPrice?: string; stopPrice?: string }) => void;
  onCancelEdit: () => void;
}

function WatchlistItemRow({
  item,
  onEdit,
  onDelete,
  onUpdateStatus,
  isEditing,
  onSaveEdit,
  onCancelEdit,
}: WatchlistItemRowProps) {
  const [editSymbol, setEditSymbol] = useState(item.symbol);
  const [editNotes, setEditNotes] = useState(item.notes || "");
  const [editTarget, setEditTarget] = useState(item.targetPrice || "");
  const [editStop, setEditStop] = useState(item.stopPrice || "");
  
  const priority = item.priority ?? 0;
  const priorityColor =
    priority === 1 ? "text-teal-400" : priority === -1 ? "text-white/40" : "text-white/60";
  
  if (isEditing) {
    return (
      <div className="flex flex-col gap-2 p-2 bg-white/5 border-b border-white/5">
        <Input
          value={editSymbol}
          onChange={(e) => setEditSymbol(e.target.value.toUpperCase())}
          placeholder="Symbol"
          className="h-8 text-sm bg-sidebar-accent border-white/10"
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            value={editTarget}
            onChange={(e) => setEditTarget(e.target.value)}
            placeholder="Target price"
            className="h-8 text-xs bg-sidebar-accent border-white/10"
          />
          <Input
            value={editStop}
            onChange={(e) => setEditStop(e.target.value)}
            placeholder="Stop price"
            className="h-8 text-xs bg-sidebar-accent border-white/10"
          />
        </div>
        <Textarea
          value={editNotes}
          onChange={(e) => setEditNotes(e.target.value)}
          placeholder="Notes..."
          className="h-16 text-xs bg-sidebar-accent border-white/10 resize-none"
        />
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="ghost" onClick={onCancelEdit} className="h-7 text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => onSaveEdit({ symbol: editSymbol, notes: editNotes, targetPrice: editTarget, stopPrice: editStop })}
            className="h-7 text-xs bg-teal-500 hover:bg-teal-600"
          >
            Save
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-2 px-3 py-2 hover:bg-white/5 border-b border-white/5 group/row">
      <GripVertical className="h-3 w-3 text-white/20 opacity-0 group-hover/row:opacity-100 cursor-grab" />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("font-semibold text-sm", priorityColor)}>
            {item.symbol}
          </span>
          {item.targetPrice && (
            <span className="flex items-center gap-1 text-[10px] text-teal-400">
              <Target className="h-2.5 w-2.5" />
              {item.targetPrice}
            </span>
          )}
          {item.stopPrice && (
            <span className="flex items-center gap-1 text-[10px] text-red-400">
              <TrendingDown className="h-2.5 w-2.5" />
              {item.stopPrice}
            </span>
          )}
        </div>
        {item.notes && (
          <p className="text-[10px] text-white/40 truncate mt-0.5">{item.notes}</p>
        )}
      </div>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="p-1 opacity-0 group-hover/row:opacity-100 hover:bg-white/10 rounded">
            <MoreHorizontal className="h-3.5 w-3.5 text-white/40" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-sidebar border-white/10">
          <DropdownMenuItem onClick={onEdit} className="text-xs">
            <Edit2 className="h-3 w-3 mr-2" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-white/10" />
          <DropdownMenuItem onClick={() => onUpdateStatus("entered")} className="text-xs">
            <TrendingUp className="h-3 w-3 mr-2 text-teal-400" />
            Mark as Entered
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onUpdateStatus("exited")} className="text-xs">
            <CheckCircle className="h-3 w-3 mr-2 text-green-400" />
            Mark as Exited
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onUpdateStatus("archived")} className="text-xs">
            <Archive className="h-3 w-3 mr-2 text-white/40" />
            Archive
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-white/10" />
          <DropdownMenuItem onClick={onDelete} className="text-xs text-red-400">
            <Trash2 className="h-3 w-3 mr-2" />
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

interface AddWatchlistDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (data: { symbol: string; notes?: string; targetPrice?: string; stopPrice?: string }) => void;
  isLoading: boolean;
}

function AddWatchlistDialog({ open, onClose, onAdd, isLoading }: AddWatchlistDialogProps) {
  const [symbol, setSymbol] = useState("");
  const [notes, setNotes] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [stopPrice, setStopPrice] = useState("");
  
  const handleSubmit = () => {
    if (!symbol.trim()) {
      toast.error("Symbol is required");
      return;
    }
    onAdd({
      symbol: symbol.toUpperCase(),
      notes: notes || undefined,
      targetPrice: targetPrice || undefined,
      stopPrice: stopPrice || undefined,
    });
    setSymbol("");
    setNotes("");
    setTargetPrice("");
    setStopPrice("");
  };
  
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-sidebar border-white/10 max-w-md">
        <DialogHeader>
          <DialogTitle>Add to Watchlist</DialogTitle>
          <DialogDescription className="text-white/40">
            Track a symbol you're interested in trading
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className="text-xs text-white/60">Symbol *</label>
            <Input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="e.g., EURUSD, GBPJPY"
              className="bg-sidebar-accent border-white/10"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs text-white/60">Target Price</label>
              <Input
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="e.g., 1.0950"
                className="bg-sidebar-accent border-white/10"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-white/60">Stop Price</label>
              <Input
                value={stopPrice}
                onChange={(e) => setStopPrice(e.target.value)}
                placeholder="e.g., 1.0850"
                className="bg-sidebar-accent border-white/10"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs text-white/60">Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Why are you watching this?"
              className="bg-sidebar-accent border-white/10 resize-none"
              rows={3}
            />
          </div>
        </div>
        
        <DialogFooter className="border-t border-white/5 pt-4 mt-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading} className="bg-teal-500 hover:bg-teal-600">
            {isLoading ? "Adding..." : "Add to Watchlist"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
