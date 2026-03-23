"use client";

import * as React from "react";
import { trpcClient, queryClient } from "@/utils/trpc";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Trash2, Star, Settings2, Plus, MoreVertical, Edit } from "lucide-react";
import { cn } from "@/lib/utils";

interface ViewManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Available columns for the trade table
const AVAILABLE_COLUMNS = [
  // Core columns
  { id: "symbol", label: "Symbol", category: "Core" },
  { id: "tradeDirection", label: "Direction", category: "Core" },
  { id: "volume", label: "Volume", category: "Core" },
  { id: "profit", label: "Profit and loss", category: "Core" },
  { id: "open", label: "Open time", category: "Core" },
  { id: "close", label: "Close time", category: "Core" },
  { id: "holdSeconds", label: "Hold time", category: "Core" },

  // Tagging
  { id: "killzone", label: "Session (legacy)", category: "Tags" },
  { id: "sessionTag", label: "Session tag", category: "Tags" },
  { id: "modelTag", label: "Edge", category: "Tags" },
  { id: "customTags", label: "Trade tags", category: "Tags" },
  { id: "protocolAlignment", label: "Protocol", category: "Tags" },
  { id: "outcome", label: "Outcome", category: "Tags" },
  { id: "complianceStatus", label: "Compliance status", category: "Tags" },

  // Intent Metrics
  { id: "plannedRR", label: "Planned reward to risk", category: "Intent" },
  { id: "plannedRiskPips", label: "Planned risk (pips)", category: "Intent" },
  { id: "plannedTargetPips", label: "Planned target (pips)", category: "Intent" },
  { id: "tp", label: "Take profit", category: "Intent" },
  { id: "sl", label: "Stop loss", category: "Intent" },

  // Execution Metrics
  { id: "realisedRR", label: "Realised reward to risk", category: "Execution" },
  { id: "commissions", label: "Commissions", category: "Execution" },
  { id: "swap", label: "Swap", category: "Execution" },

  // Opportunity Metrics
  { id: "maxRR", label: "Maximum reward to risk", category: "Opportunity" },
  { id: "manipulationPips", label: "Manipulation pips", category: "Opportunity" },
  { id: "mpeManipLegR", label: "Maximum price excursion manipulation leg (risk units)", category: "Opportunity" },
  { id: "mpeManipPE_R", label: "Maximum price excursion manipulation post exit (risk units)", category: "Opportunity" },
  { id: "rawSTDV", label: "Raw standard deviation", category: "Opportunity" },
  { id: "rawSTDV_PE", label: "Raw standard deviation post exit", category: "Opportunity" },
  { id: "stdvBucket", label: "Standard deviation (bucket)", category: "Opportunity" },
  { id: "estimatedWeightedMPE_R", label: "Estimated weighted maximum price excursion (risk units)", category: "Opportunity" },

  // Efficiency Metrics
  { id: "exitEfficiency", label: "Exit efficiency", category: "Efficiency" },
  { id: "rrCaptureEfficiency", label: "Reward to risk capture efficiency (percent)", category: "Efficiency" },
  { id: "manipRREfficiency", label: "Manipulation reward to risk efficiency (percent)", category: "Efficiency" },

  // Other
  { id: "drawdown", label: "Drawdown", category: "Other" },
];

const DEFAULT_ICONS = ["📊", "🎯", "🧪", "⚖️", "📈", "🕐", "✅", "❌", "💡", "🔍", "📌", "⭐"];

const COLUMN_TOOLTIPS: Record<string, string> = {
  symbol: "Instrument traded (e.g., EURUSD).",
  tradeDirection: "Long (buy) or short (sell).",
  volume: "Position size or lot size.",
  profit: "Net profit or loss for the trade.",
  open: "Trade entry time.",
  close: "Trade exit time.",
  holdSeconds: "How long the trade was open.",
  killzone: "Legacy session tag for the trade.",
  sessionTag: "Session or time window tag.",
  modelTag: "Edge label.",
  customTags: "Custom trade tags attached to the trade.",
  protocolAlignment: "Whether rules were followed.",
  outcome: "Win, loss, break-even, or partial win.",
  complianceStatus: "Compliance audit status for this trade.",
  plannedRR: "Planned reward to risk at entry.",
  plannedRiskPips: "Planned stop distance in pips.",
  plannedTargetPips: "Planned target distance in pips.",
  tp: "Take profit price.",
  sl: "Stop loss price.",
  realisedRR: "Actual reward to risk gained or lost.",
  commissions: "Fees paid on the trade.",
  swap: "Swap or rollover cost.",
  maxRR: "Maximum reward to risk the market offered while open.",
  manipulationPips: "Size of the manipulation leg in pips.",
  mpeManipLegR: "Maximum price excursion on the manipulation leg in risk units.",
  mpeManipPE_R: "Post-exit maximum price excursion relative to manipulation in risk units.",
  rawSTDV: "Raw standard deviation measure.",
  rawSTDV_PE: "Post-exit standard deviation excursion.",
  stdvBucket: "Bucketed standard deviation regime.",
  estimatedWeightedMPE_R: "Weighted maximum price excursion estimate for targets.",
  exitEfficiency: "Exit timing quality versus post-exit peak.",
  rrCaptureEfficiency: "How much available reward to risk was captured.",
  manipRREfficiency: "Capture versus the manipulation leg move.",
  drawdown: "Maximum adverse move while in trade.",
};

export function ViewManagementDialog({ open, onOpenChange }: ViewManagementDialogProps) {
  const [activeTab, setActiveTab] = React.useState("my-views");
  const [editingViewId, setEditingViewId] = React.useState<string | null>(null);

  // Fetch existing views
  const [views, setViews] = React.useState<any[]>([]);
  const [isLoadingViews, setIsLoadingViews] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setIsLoadingViews(true);
      trpcClient.views.list.query()
        .then(setViews)
        .finally(() => setIsLoadingViews(false));
    }
  }, [open]);

  // Create/Edit view state
  const [newViewName, setNewViewName] = React.useState("");
  const [newViewIcon, setNewViewIcon] = React.useState("📊");
  const [newViewDescription, setNewViewDescription] = React.useState("");
  const [selectedColumns, setSelectedColumns] = React.useState<string[]>([
    "symbol",
    "tradeDirection",
    "volume",
    "profit",
    "open",
    "close",
  ]);

  // Reset form helper
  const resetForm = () => {
    setNewViewName("");
    setNewViewIcon("📊");
    setNewViewDescription("");
    setSelectedColumns([
      "symbol",
      "tradeDirection",
      "volume",
      "profit",
      "open",
      "close",
    ]);
    setEditingViewId(null);
  };

  // When editing a view, populate the form
  React.useEffect(() => {
    if (editingViewId) {
      const view = views.find((v) => v.id === editingViewId);
      if (view) {
        setNewViewName(view.name);
        setNewViewIcon(view.icon || "📊");
        setNewViewDescription(view.description || "");
        const viewConfig = view.config as any;
        setSelectedColumns(viewConfig?.visibleColumns || []);
        setActiveTab("create"); // Switch to create/edit tab
      }
    }
  }, [editingViewId, views]);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (viewId: string) => {
      return await trpcClient.views.delete.mutate({ id: viewId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      // Refresh views list
      trpcClient.views.list.query().then(setViews);
    },
  });

  // Set default mutation
  const setDefaultMutation = useMutation({
    mutationFn: async (viewId: string) => {
      return await trpcClient.views.setDefault.mutate({ id: viewId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      trpcClient.views.list.query().then(setViews);
    },
  });

  // Create/Update view mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const viewData = {
        name: newViewName,
        icon: newViewIcon,
        description: newViewDescription || undefined,
        config: {
          filters: {},
          visibleColumns: selectedColumns,
          sorting: [],
        },
      };

      if (editingViewId) {
        // Update existing view
        return await trpcClient.views.update.mutate({
          id: editingViewId,
          ...viewData,
        });
      } else {
        // Create new view
        return await trpcClient.views.create.mutate(viewData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      // Reset form
      resetForm();
      // Refresh views and switch to my views tab
      trpcClient.views.list.query().then(setViews);
      setActiveTab("my-views");
    },
  });

  const handleSaveView = () => {
    if (!newViewName.trim()) return;
    saveMutation.mutate();
  };

  const toggleColumn = (columnId: string) => {
    setSelectedColumns((prev) =>
      prev.includes(columnId)
        ? prev.filter((id) => id !== columnId)
        : [...prev, columnId]
    );
  };

  const columnsByCategory = React.useMemo(() => {
    const grouped: Record<string, typeof AVAILABLE_COLUMNS> = {};
    AVAILABLE_COLUMNS.forEach((col) => {
      if (!grouped[col.category]) grouped[col.category] = [];
      grouped[col.category].push(col);
    });
    return grouped;
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col bg-sidebar border border-white/5 rounded-md p-0 gap-0">
        <div className="px-6 py-5">
          <DialogHeader className="p-0">
            <DialogTitle className="text-base font-semibold text-white">Manage views</DialogTitle>
            <DialogDescription className="text-xs text-white/40">
              Create custom views with specific columns and filters
            </DialogDescription>
          </DialogHeader>
        </div>

        <Separator />

        <Tabs value={activeTab} onValueChange={(value) => {
          setActiveTab(value);
          if (value === "my-views") {
            resetForm();
          }
        }} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 pt-4">
            <TabsList className="grid w-full grid-cols-2 bg-muted/25 rounded-sm p-[3px]">
              <TabsTrigger value="my-views" className="text-xs rounded-sm data-[state=active]:bg-[#222225] data-[state=active]:text-white text-white/40">
                My views
              </TabsTrigger>
              <TabsTrigger value="create" className="text-xs rounded-sm data-[state=active]:bg-[#222225] data-[state=active]:text-white text-white/40">
                {editingViewId ? "Edit view" : "Create view"}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* My Views Tab */}
          <TabsContent value="my-views" className="flex-1 overflow-auto px-6 py-5">
            {isLoadingViews ? (
              <div className="text-center py-8 text-white/40 text-xs">
                Loading views...
              </div>
            ) : views.length === 0 ? (
              <div className="text-center py-8 text-white/40 text-xs">
                <p>No custom views yet.</p>
                <p className="text-xs mt-2">Create your first view to get started.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {views.map((view) => (
                  <div
                    key={view.id}
                    className="flex items-center justify-between p-3 border border-white/5 rounded-sm hover:bg-sidebar-accent transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-2xl">{view.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-white text-sm">{view.name}</h4>
                          {view.isDefault && (
                            <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                          )}
                        </div>
                        {view.description && (
                          <p className="text-xs text-white/40">{view.description}</p>
                        )}
                        <p className="text-xs text-white/40 mt-1">
                          {view.config?.visibleColumns?.length || 0} columns
                        </p>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button className="cursor-pointer flex items-center justify-center px-2 py-2 h-[32px] text-xs rounded-sm transition-all active:scale-95 duration-250 border border-white/5 bg-sidebar hover:bg-sidebar-accent">
                          <MoreVertical className="h-4 w-4 text-white/60" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-sm bg-sidebar border border-white/5 p-1">
                        <DropdownMenuItem
                          onClick={() => setEditingViewId(view.id)}
                          className="px-4 py-2.5 text-white/70 hover:bg-sidebar-accent"
                        >
                          <Edit className="mr-2 h-4 w-4 text-white/60" />
                          Edit
                        </DropdownMenuItem>
                        {!view.isDefault && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDefaultMutation.mutate(view.id)}
                              className="px-4 py-2.5 text-white/70 hover:bg-sidebar-accent"
                            >
                              <Star className="mr-2 h-4 w-4 text-white/60" />
                              Set as default
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => deleteMutation.mutate(view.id)}
                          className="px-4 py-2.5 text-rose-400 hover:bg-sidebar-accent"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Create View Tab */}
          <TabsContent value="create" className="flex-1 overflow-auto">
            <div className="px-6 py-3">
              <h3 className="text-xs font-semibold text-white/70 tracking-wide">View details</h3>
            </div>
            <Separator />
            <div className="px-6 py-5 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-white/50">View name</Label>
                <Input
                  placeholder="e.g., London Wins"
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  className="bg-sidebar border border-white/5 rounded-sm text-white/80 placeholder:text-white/30"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-white/50">Description (optional)</Label>
                <Input
                  placeholder="e.g., Winning trades during London session"
                  value={newViewDescription}
                  onChange={(e) => setNewViewDescription(e.target.value)}
                  className="bg-sidebar border border-white/5 rounded-sm text-white/80 placeholder:text-white/30"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-white/50">Icon</Label>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {DEFAULT_ICONS.map((icon) => (
                    <button
                      key={icon}
                      onClick={() => setNewViewIcon(icon)}
                      className={cn(
                        "text-2xl p-2 rounded-sm border border-white/5 hover:bg-sidebar-accent transition-colors",
                        newViewIcon === icon && "bg-sidebar-accent border-white/20"
                      )}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Separator />

            <div className="px-6 py-3">
              <h3 className="text-xs font-semibold text-white/70 tracking-wide">Visible columns</h3>
            </div>
            <Separator />
            <div className="px-6 py-5 space-y-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="w-full justify-between cursor-pointer px-3 py-2 h-[38px] text-xs transition-all active:scale-95 duration-250 border border-white/5 bg-sidebar rounded-sm hover:bg-sidebar-accent text-white/70">
                    <span>{selectedColumns.length} columns selected</span>
                    <Settings2 className="h-4 w-4 text-white/50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="rounded-sm bg-sidebar border border-white/5 w-[400px] max-h-[400px] overflow-auto p-1">
                  {Object.entries(columnsByCategory).map(([category, columns]) => (
                    <DropdownMenuSub key={category}>
                      <DropdownMenuSubTrigger>{category}</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="rounded-sm bg-sidebar border border-white/5 max-h-[300px] overflow-auto p-1">
                        {columns.map((col) => (
                          <DropdownMenuItem
                            key={col.id}
                            onSelect={(e) => {
                              e.preventDefault();
                              toggleColumn(col.id);
                            }}
                            className="cursor-pointer px-4 py-2.5 text-white/70 hover:bg-sidebar-accent"
                          >
                            <Checkbox
                              checked={selectedColumns.includes(col.id)}
                              onCheckedChange={() => toggleColumn(col.id)}
                              className="mr-2 rounded-sm"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help">{col.label}</span>
                              </TooltipTrigger>
                              <TooltipContent className="text-xs">
                                {COLUMN_TOOLTIPS[col.id] || "Column details"}
                              </TooltipContent>
                            </Tooltip>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Selected columns preview */}
              {selectedColumns.length > 0 && (
                <div className="p-3 bg-sidebar-accent rounded-sm border border-white/5">
                  <p className="text-xs text-white/40 mb-2">Selected columns:</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedColumns.map((colId) => {
                      const col = AVAILABLE_COLUMNS.find((c) => c.id === colId);
                      return (
                        <span
                          key={colId}
                          className="text-xs px-2 py-1 bg-sidebar rounded-sm border border-white/5 text-white/70"
                        >
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help">
                                {col?.label || colId}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="text-xs">
                              {COLUMN_TOOLTIPS[colId] || "Column details"}
                            </TooltipContent>
                          </Tooltip>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <Separator />

            <div className="px-6 py-5">
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  className="rounded-sm"
                  onClick={() => {
                    resetForm();
                    setActiveTab("my-views");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="gap-2 rounded-sm"
                  onClick={handleSaveView}
                  disabled={!newViewName.trim() || saveMutation.isPending}
                >
                  {saveMutation.isPending
                    ? (editingViewId ? "Updating..." : "Creating...")
                    : (editingViewId ? "Update view" : "Create view")
                  }
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
