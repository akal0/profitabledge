"use client";

import React, { useState, useRef } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Bookmark,
  Save,
  Download,
  Upload,
  Trash2,
  FileJson,
  FileSpreadsheet,
  Check,
  RotateCcw,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import type { WidgetType } from "@/components/dashboard/widgets";

export interface WidgetPreset {
  id: string;
  name: string;
  createdAt: string;
  widgets: WidgetType[];
  spans: Partial<Record<WidgetType, number>>;
}

interface WidgetPresetsProps {
  currentWidgets: WidgetType[];
  currentSpans: Partial<Record<WidgetType, number>>;
  onApplyPreset: (
    widgets: WidgetType[],
    spans: Partial<Record<WidgetType, number>>
  ) => void;
  onExport: (format: "json" | "csv") => void;
}

const STORAGE_KEY = "profitable-edge-widget-presets";
const VALID_WIDGET_TYPES = new Set<WidgetType>([
  "account-balance",
  "account-equity",
  "win-rate",
  "profit-factor",
  "win-streak",
  "hold-time",
  "average-rr",
  "asset-profitability",
  "trade-counts",
  "profit-expectancy",
  "total-losses",
  "consistency-score",
  "open-trades",
  "execution-scorecard",
  "money-left-on-table",
  "watchlist",
  "session-performance",
  "streak-calendar",
  "tiltmeter",
  "daily-briefing",
  "risk-intelligence",
  "rule-compliance",
  "edge-coach",
  "what-if",
  "benchmark",
]);

function sanitizeWidgetList(widgets: unknown): WidgetType[] {
  if (!Array.isArray(widgets)) return [];
  return widgets.filter(
    (widget): widget is WidgetType =>
      typeof widget === "string" && VALID_WIDGET_TYPES.has(widget as WidgetType)
  );
}

const builtInPresets: WidgetPreset[] = [
  {
    id: "builtin-default",
    name: "Default",
    createdAt: new Date().toISOString(),
    widgets: ["account-balance", "win-rate", "profit-factor", "win-streak"],
    spans: {},
  },
  {
    id: "builtin-risk",
    name: "Risk focused",
    createdAt: new Date().toISOString(),
    widgets: [
      "account-balance",
      "total-losses",
      "consistency-score",
      "money-left-on-table",
    ],
    spans: {},
  },
  {
    id: "builtin-performance",
    name: "Performance analysis",
    createdAt: new Date().toISOString(),
    widgets: [
      "win-rate",
      "profit-factor",
      "average-rr",
      "profit-expectancy",
      "execution-scorecard",
      "hold-time",
    ],
    spans: { "asset-profitability": 2 },
  },
  {
    id: "builtin-minimal",
    name: "Minimal",
    createdAt: new Date().toISOString(),
    widgets: ["account-balance", "win-rate"],
    spans: {},
  },
  {
    id: "builtin-active",
    name: "Active trader",
    createdAt: new Date().toISOString(),
    widgets: [
      "account-balance",
      "account-equity",
      "open-trades",
      "watchlist",
      "win-streak",
      "profit-factor",
    ],
    spans: {},
  },
  {
    id: "builtin-session",
    name: "Session analyst",
    createdAt: new Date().toISOString(),
    widgets: [
      "session-performance",
      "streak-calendar",
      "win-rate",
      "profit-factor",
      "hold-time",
    ],
    spans: {},
  },
  {
    id: "builtin-streak",
    name: "Streak tracker",
    createdAt: new Date().toISOString(),
    widgets: ["streak-calendar", "win-streak", "consistency-score", "win-rate"],
    spans: {},
  },
  {
    id: "builtin-ai-coach",
    name: "AI Coach",
    createdAt: new Date().toISOString(),
    widgets: [
      "tiltmeter",
      "daily-briefing",
      "rule-compliance",
      "risk-intelligence",
      "account-balance",
      "win-rate",
    ],
    spans: {},
  },
  {
    id: "builtin-psychology",
    name: "Psychology focus",
    createdAt: new Date().toISOString(),
    widgets: [
      "tiltmeter",
      "daily-briefing",
      "consistency-score",
      "win-streak",
    ],
    spans: {},
  },
  {
    id: "builtin-analysis",
    name: "What-If Analysis",
    createdAt: new Date().toISOString(),
    widgets: [
      "money-left-on-table",
      "execution-scorecard",
      "profit-expectancy",
      "account-balance",
    ],
    spans: {},
  },
  {
    id: "builtin-benchmark",
    name: "Benchmark",
    createdAt: new Date().toISOString(),
    widgets: [
      "win-rate",
      "profit-factor",
      "average-rr",
      "consistency-score",
    ],
    spans: {},
  },
  {
    id: "builtin-full-analytics",
    name: "Full analytics",
    createdAt: new Date().toISOString(),
    widgets: [
      "account-balance",
      "win-rate",
      "profit-factor",
      "asset-profitability",
      "execution-scorecard",
      "tiltmeter",
      "risk-intelligence",
      "rule-compliance",
    ],
    spans: { "asset-profitability": 2 },
  },
];

const isBuiltinPreset = (id: string) => id.startsWith("builtin-");

function loadCustomPresets(): WidgetPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((preset) => ({
          ...preset,
          widgets: sanitizeWidgetList(preset?.widgets),
        }))
        .filter((preset) => preset.widgets.length > 0);
    }
  } catch (e) {
    console.error("Failed to load presets:", e);
  }
  return [];
}

function saveCustomPresets(presets: WidgetPreset[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch (e) {
    console.error("Failed to save presets:", e);
  }
}

export function WidgetPresets({
  currentWidgets,
  currentSpans,
  onApplyPreset,
  onExport,
}: WidgetPresetsProps) {
  const [customPresets, setCustomPresets] =
    useState<WidgetPreset[]>(loadCustomPresets);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [renamePresetId, setRenamePresetId] = useState<string | null>(null);
  const [renamePresetName, setRenamePresetName] = useState("");
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSavePreset = () => {
    if (!presetName.trim()) {
      toast.error("Please enter a preset name");
      return;
    }

    const newPreset: WidgetPreset = {
      id: `custom-${Date.now()}`,
      name: presetName.trim(),
      createdAt: new Date().toISOString(),
      widgets: currentWidgets,
      spans: currentSpans,
    };

    const updated = [...customPresets, newPreset];
    setCustomPresets(updated);
    saveCustomPresets(updated);
    setActivePresetId(newPreset.id);
    setShowSaveDialog(false);
    setPresetName("");
    toast.success(`Preset "${presetName}" saved`);
  };

  const handleApplyPreset = (preset: WidgetPreset) => {
    const widgets = sanitizeWidgetList(preset.widgets);
    if (widgets.length === 0) {
      toast.error("This preset does not contain any available widgets");
      return;
    }
    onApplyPreset(widgets, preset.spans);
    setActivePresetId(preset.id);
    toast.success(`Applied "${preset.name}"`);
  };

  const handleDeletePreset = (presetId: string) => {
    const updated = customPresets.filter((p) => p.id !== presetId);
    setCustomPresets(updated);
    saveCustomPresets(updated);
    if (activePresetId === presetId) {
      setActivePresetId(null);
    }
    toast.success("Preset deleted");
  };

  const handleOpenRenameDialog = (preset: WidgetPreset) => {
    setRenamePresetId(preset.id);
    setRenamePresetName(preset.name);
    setShowRenameDialog(true);
  };

  const handleRenamePreset = () => {
    if (!renamePresetName.trim()) {
      toast.error("Please enter a preset name");
      return;
    }

    const updated = customPresets.map((p) =>
      p.id === renamePresetId ? { ...p, name: renamePresetName.trim() } : p
    );
    setCustomPresets(updated);
    saveCustomPresets(updated);
    setShowRenameDialog(false);
    setRenamePresetId(null);
    setRenamePresetName("");
    toast.success("Preset renamed");
  };

  const handleExportAllPresets = () => {
    const allPresets = [...builtInPresets, ...customPresets];
    const data = JSON.stringify(allPresets, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `widget-presets-${
      new Date().toISOString().split("T")[0]
    }.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Presets exported");
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportPresets = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const imported = JSON.parse(text);

      let presetsToImport: WidgetPreset[] = [];

      if (Array.isArray(imported)) {
        presetsToImport = imported;
      } else if (imported.widgets && Array.isArray(imported.widgets)) {
        presetsToImport = [
          {
            id: `imported-${Date.now()}`,
            name: imported.name || file.name.replace(".json", ""),
            createdAt: imported.createdAt || new Date().toISOString(),
            widgets: sanitizeWidgetList(imported.widgets),
            spans: imported.spans || {},
          },
        ];
      } else {
        throw new Error("Invalid format");
      }

      const validPresets = presetsToImport.filter(
        (p) => sanitizeWidgetList(p.widgets).length > 0
      );

      if (validPresets.length === 0) {
        toast.error("No valid presets found in file");
        return;
      }

      const newCustomPresets = validPresets
        .filter((p) => !isBuiltinPreset(p.id))
        .map((p, idx) => ({
          ...p,
          widgets: sanitizeWidgetList(p.widgets),
          id: `imported-${Date.now()}-${idx}`,
          createdAt: p.createdAt || new Date().toISOString(),
        }));

      if (newCustomPresets.length > 0) {
        const updated = [...customPresets, ...newCustomPresets];
        setCustomPresets(updated);
        saveCustomPresets(updated);
        toast.success(`Imported ${newCustomPresets.length} preset(s)`);
      } else {
        toast.info("File only contains built-in presets (already available)");
      }
    } catch (err) {
      toast.error("Failed to import. Invalid JSON format.");
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleResetToDefault = () => {
    const defaultPreset = builtInPresets[0];
    handleApplyPreset(defaultPreset);
    toast.success("Reset to default layout");
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleImportPresets}
        className="hidden"
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="cursor-pointer flex items-center justify-center py-2 h-[38px] transition-all active:scale-95 text-white w-max text-xs hover:brightness-110 duration-250 border border-white/5 bg-sidebar rounded-sm hover:bg-sidebar-accent px-3">
            <Bookmark className="size-3 " />
            Presets
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-76 bg-sidebar border-white/10 rounded-none p-1"
        >
          <div className="px-2 py-1.5 text-[10px] font-semibold text-white/40 uppercase tracking-wider">
            Built-in
          </div>
          {builtInPresets.map((preset) => (
            <DropdownMenuItem
              key={preset.id}
              onClick={() => handleApplyPreset(preset)}
              className="px-2 py-1.5 text-xs text-white/70 hover:text-white hover:bg-sidebar-accent rounded-none cursor-pointer flex items-center justify-between"
            >
              <span>{preset.name}</span>
              {activePresetId === preset.id && (
                <Check className="size-3 text-teal-400" />
              )}
            </DropdownMenuItem>
          ))}

          {customPresets.length > 0 && (
            <>
              <DropdownMenuSeparator className="bg-white/5 my-1" />
              <div className="px-2 py-1.5 text-[10px] font-semibold text-white/40 uppercase tracking-wider">
                Custom
              </div>
              {customPresets.map((preset) => (
                <DropdownMenuItem
                  key={preset.id}
                  onClick={() => handleApplyPreset(preset)}
                  className="px-2 py-1.5 text-xs text-white/70 hover:text-white hover:bg-sidebar-accent rounded-none cursor-pointer flex items-center justify-between group"
                >
                  <span className="truncate flex-1 mr-2">{preset.name}</span>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {activePresetId === preset.id && (
                      <Check className="size-3 text-teal-400" />
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenRenameDialog(preset);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 cursor-pointer transition-opacity"
                      title="Rename"
                    >
                      <Pencil className="size-3 text-white/50 hover:text-white" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePreset(preset.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 cursor-pointer transition-opacity"
                      title="Delete"
                    >
                      <Trash2 className="size-3 text-red-400" />
                    </button>
                  </div>
                </DropdownMenuItem>
              ))}
            </>
          )}

          <DropdownMenuSeparator className="bg-white/5 my-1" />

          <DropdownMenuItem
            onClick={() => setShowSaveDialog(true)}
            className="px-2 py-1.5 text-xs text-white/70 hover:text-white hover:bg-sidebar-accent rounded-none cursor-pointer"
          >
            <Save className="size-3 mr-2" />
            Save current as preset
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-white/5 my-1" />

          <div className="px-2 py-1.5 text-[10px] font-semibold text-white/40 uppercase tracking-wider">
            Export / Import
          </div>

          <DropdownMenuItem
            onClick={() => onExport("json")}
            className="px-2 py-1.5 text-xs text-white/70 hover:text-white hover:bg-sidebar-accent rounded-none cursor-pointer"
          >
            <FileJson className="size-3 mr-2" />
            Export widgets (JSON)
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => onExport("csv")}
            className="px-2 py-1.5 text-xs text-white/70 hover:text-white hover:bg-sidebar-accent rounded-none cursor-pointer"
          >
            <FileSpreadsheet className="size-3 mr-2" />
            Export widgets (CSV)
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={handleExportAllPresets}
            className="px-2 py-1.5 text-xs text-white/70 hover:text-white hover:bg-sidebar-accent rounded-none cursor-pointer"
          >
            <Download className="size-3 mr-2" />
            Export all presets
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={handleImportClick}
            className="px-2 py-1.5 text-xs text-white/70 hover:text-white hover:bg-sidebar-accent rounded-none cursor-pointer"
          >
            <Upload className="size-3 mr-2" />
            Import presets
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-white/5 my-1" />

          <DropdownMenuItem
            onClick={handleResetToDefault}
            className="px-2 py-1.5 text-xs text-white/70 hover:text-white hover:bg-sidebar-accent rounded-none cursor-pointer"
          >
            <RotateCcw className="size-3 mr-2" />
            Reset to default
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="bg-sidebar border-white/10 rounded-none max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white text-sm">
              Save widget preset
            </DialogTitle>
            <DialogDescription className="text-white/50 text-xs">
              Save your current widget layout as a reusable preset
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Enter preset name..."
              className="bg-sidebar-accent border-white/10 rounded-none text-white text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSavePreset();
              }}
            />
            <p className="text-[10px] text-white/40 mt-2">
              {currentWidgets.length} widgets will be saved
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSaveDialog(false)}
              className="h-7 px-3 text-xs rounded-none border-white/10 text-white/70 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePreset}
              className="h-7 px-3 text-xs rounded-none bg-teal-600 hover:bg-teal-500 text-white"
            >
              Save preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent className="bg-sidebar border-white/10 rounded-none max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white text-sm">
              Rename preset
            </DialogTitle>
            <DialogDescription className="text-white/50 text-xs">
              Enter a new name for this preset
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Input
              value={renamePresetName}
              onChange={(e) => setRenamePresetName(e.target.value)}
              placeholder="Enter new name..."
              className="bg-sidebar-accent border-white/10 rounded-none text-white text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenamePreset();
              }}
              autoFocus
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowRenameDialog(false)}
              className="h-7 px-3 text-xs rounded-none border-white/10 text-white/70 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRenamePreset}
              className="h-7 px-3 text-xs rounded-none bg-teal-600 hover:bg-teal-500 text-white"
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
