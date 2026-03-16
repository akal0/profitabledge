"use client";

import React, { useState, useRef, useMemo } from "react";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  toolbarFilterMenuContentClass,
  toolbarFilterMenuItemClass,
  toolbarFilterMenuSectionTitleClass,
  toolbarFilterMenuMainSeparatorClass,
} from "@/components/ui/filter-menu-styles";
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
  X,
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
  onExport: (format: "json" | "csv", fileName?: string) => void;
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
  "session-performance",
  "streak-calendar",
  "tiltmeter",
  "daily-briefing",
  "rule-compliance",
  "edge-coach",
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
    id: "builtin-performance",
    name: "Performance",
    createdAt: new Date().toISOString(),
    widgets: [
      "win-rate",
      "profit-factor",
      "average-rr",
      "profit-expectancy",
      "execution-scorecard",
      "hold-time",
    ],
    spans: {},
  },
  {
    id: "builtin-risk",
    name: "Risk",
    createdAt: new Date().toISOString(),
    widgets: [
      "account-balance",
      "total-losses",
      "rule-compliance",
      "consistency-score",
    ],
    spans: {},
  },
  {
    id: "builtin-psychology",
    name: "Psychology",
    createdAt: new Date().toISOString(),
    widgets: ["tiltmeter", "daily-briefing", "consistency-score", "win-streak"],
    spans: {},
  },
  {
    id: "builtin-minimal",
    name: "Minimal",
    createdAt: new Date().toISOString(),
    widgets: ["account-balance", "win-rate"],
    spans: {},
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
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportDialogType, setExportDialogType] = useState<"json" | "csv">(
    "json"
  );
  const [exportFileName, setExportFileName] = useState("");
  const [presetName, setPresetName] = useState("");
  const [renamePresetId, setRenamePresetId] = useState<string | null>(null);
  const [renamePresetName, setRenamePresetName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activePresetId = useMemo(() => {
    const currentSet = new Set(currentWidgets);
    const allPresets = [...builtInPresets, ...customPresets];
    for (const preset of allPresets) {
      const presetSet = new Set(preset.widgets);
      if (
        currentSet.size === presetSet.size &&
        [...currentSet].every((w) => presetSet.has(w))
      ) {
        return preset.id;
      }
    }
    return null;
  }, [currentWidgets, customPresets]);

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
    toast.success(`Applied "${preset.name}"`);
  };

  const handleDeletePreset = (presetId: string) => {
    const updated = customPresets.filter((p) => p.id !== presetId);
    setCustomPresets(updated);
    saveCustomPresets(updated);
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

  const openExportDialog = (type: "json" | "csv") => {
    const date = new Date().toISOString().split("T")[0];
    setExportDialogType(type);
    setExportFileName(`dashboard-widgets-${date}`);
    setShowExportDialog(true);
  };

  const handleConfirmExport = () => {
    const name = exportFileName.trim() || "export";
    onExport(exportDialogType, name);
    setShowExportDialog(false);
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
        handleApplyPreset(newCustomPresets[0]);
        toast.success(`Imported ${newCustomPresets.length} preset(s)`);
      } else {
        // File only had built-in presets — apply the first one
        const first = validPresets[0];
        handleApplyPreset({
          ...first,
          widgets: sanitizeWidgetList(first.widgets),
        });
        toast.info("Applied built-in preset");
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
          <Button className="cursor-pointer flex items-center justify-center py-2 h-[38px] transition-all active:scale-95 text-white w-max text-xs hover:brightness-110 duration-250 ring ring-white/5 bg-sidebar rounded-sm hover:bg-sidebar-accent px-3">
            <Bookmark className="size-3 " />
            Presets
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className={`w-76 ${toolbarFilterMenuContentClass}`}
        >
          <div className={toolbarFilterMenuSectionTitleClass}>Built-in</div>
          <DropdownMenuSeparator
            className={toolbarFilterMenuMainSeparatorClass}
          />
          {builtInPresets.map((preset) => (
            <DropdownMenuItem
              key={preset.id}
              onClick={() => handleApplyPreset(preset)}
              className={`${toolbarFilterMenuItemClass} cursor-pointer flex items-center justify-between rounded-sm`}
            >
              <span>{preset.name}</span>
              {activePresetId === preset.id && (
                <Check className="size-3 text-teal-400" />
              )}
            </DropdownMenuItem>
          ))}

          {customPresets.length > 0 && (
            <>
              <DropdownMenuSeparator
                className={toolbarFilterMenuMainSeparatorClass}
              />
              <div className={toolbarFilterMenuSectionTitleClass}>Custom</div>
              <DropdownMenuSeparator
                className={toolbarFilterMenuMainSeparatorClass}
              />
              {customPresets.map((preset) => (
                <DropdownMenuItem
                  key={preset.id}
                  onClick={() => handleApplyPreset(preset)}
                  className={`${toolbarFilterMenuItemClass} cursor-pointer flex items-center justify-between group rounded-sm`}
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

          <DropdownMenuSeparator
            className={toolbarFilterMenuMainSeparatorClass}
          />

          <DropdownMenuItem
            onClick={() => setShowSaveDialog(true)}
            className={`${toolbarFilterMenuItemClass} cursor-pointer rounded-sm`}
          >
            <Save className="size-3 mr-2" />
            Save current as preset
          </DropdownMenuItem>

          <DropdownMenuSeparator
            className={toolbarFilterMenuMainSeparatorClass}
          />

          <div className={toolbarFilterMenuSectionTitleClass}>
            Export / Import
          </div>
          <DropdownMenuSeparator
            className={toolbarFilterMenuMainSeparatorClass}
          />

          <DropdownMenuItem
            onClick={() => openExportDialog("json")}
            className={`${toolbarFilterMenuItemClass} cursor-pointer rounded-sm`}
          >
            <FileJson className="size-3 mr-2" />
            Export widgets (JSON)
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => openExportDialog("csv")}
            className={`${toolbarFilterMenuItemClass} cursor-pointer rounded-sm`}
          >
            <FileSpreadsheet className="size-3 mr-2" />
            Export widgets (CSV)
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={handleImportClick}
            className={`${toolbarFilterMenuItemClass} cursor-pointer rounded-sm`}
          >
            <Upload className="size-3 mr-2" />
            Import presets
          </DropdownMenuItem>

          <DropdownMenuSeparator
            className={toolbarFilterMenuMainSeparatorClass}
          />

          <DropdownMenuItem
            onClick={handleResetToDefault}
            className={`${toolbarFilterMenuItemClass} cursor-pointer rounded-sm`}
          >
            <RotateCcw className="size-3 mr-2" />
            Reset to default
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save Preset Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent
          showCloseButton={false}
          className="flex flex-col gap-0 overflow-hidden rounded-md ring ring-white/5 bg-sidebar/5 p-2 shadow-2xl backdrop-blur-lg max-w-sm"
        >
          <div className="flex flex-col gap-0 overflow-hidden rounded-sm ring ring-white/5 bg-sidebar-accent/80">
            {/* Header */}
            <div className="flex items-start gap-3 px-5 py-4">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md ring ring-white/5 bg-sidebar-accent">
                <Bookmark className="h-3.5 w-3.5 text-white/60" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-white">
                  Save widget preset
                </div>
                <p className="mt-1 text-xs leading-relaxed text-white/40">
                  Save your current widget layout as a reusable preset
                </p>
              </div>
              <DialogClose asChild>
                <button
                  type="button"
                  className="ml-auto flex size-8 cursor-pointer items-center justify-center rounded-sm ring ring-white/5 bg-sidebar-accent text-white/50 transition-colors hover:bg-sidebar-accent hover:brightness-110 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                  <span className="sr-only">Close</span>
                </button>
              </DialogClose>
            </div>
            <Separator />

            {/* Body */}
            <div className="px-5 py-4">
              <Input
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Enter preset name..."
                className="bg-sidebar-accent ring-white/10 rounded-sm text-white text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSavePreset();
                }}
              />
              <p className="text-[10px] text-white/40 mt-2">
                {currentWidgets.length} widgets will be saved
              </p>
            </div>

            <Separator />
            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3">
              <Button
                className="cursor-pointer flex items-center justify-center gap-2 rounded-sm ring ring-white/5 bg-sidebar px-3 py-2 h-9 text-xs text-white/70 transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 shadow-none"
                onClick={() => setShowSaveDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSavePreset}
                className="cursor-pointer flex items-center justify-center gap-2 rounded-sm ring ring-white/5 bg-sidebar px-3 py-2 h-9 text-xs text-white transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 shadow-none"
              >
                Save preset
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Preset Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent
          showCloseButton={false}
          className="flex flex-col gap-0 overflow-hidden rounded-md ring ring-white/5 bg-sidebar/5 p-2 shadow-2xl backdrop-blur-lg max-w-sm"
        >
          <div className="flex flex-col gap-0 overflow-hidden rounded-sm ring ring-white/5 bg-sidebar-accent/80">
            {/* Header */}
            <div className="flex items-start gap-3 px-5 py-4">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md ring ring-white/5 bg-sidebar-accent">
                <Pencil className="h-3.5 w-3.5 text-white/60" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-white">
                  Rename preset
                </div>
                <p className="mt-1 text-xs leading-relaxed text-white/40">
                  Enter a new name for this preset
                </p>
              </div>
              <DialogClose asChild>
                <button
                  type="button"
                  className="ml-auto flex size-8 cursor-pointer items-center justify-center rounded-sm ring ring-white/5 bg-sidebar-accent text-white/50 transition-colors hover:bg-sidebar-accent hover:brightness-110 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                  <span className="sr-only">Close</span>
                </button>
              </DialogClose>
            </div>
            <Separator />

            {/* Body */}
            <div className="px-5 py-4">
              <Input
                value={renamePresetName}
                onChange={(e) => setRenamePresetName(e.target.value)}
                placeholder="Enter new name..."
                className="bg-sidebar-accent ring-white/10 rounded-sm text-white text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRenamePreset();
                }}
                autoFocus
              />
            </div>

            <Separator />
            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3">
              <Button
                className="cursor-pointer flex items-center justify-center gap-2 rounded-sm ring ring-white/5 bg-sidebar px-3 py-2 h-9 text-xs text-white/70 transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 shadow-none"
                onClick={() => setShowRenameDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleRenamePreset}
                className="cursor-pointer flex items-center justify-center gap-2 rounded-sm ring ring-white/5 bg-sidebar px-3 py-2 h-9 text-xs text-white transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 shadow-none"
              >
                Rename
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent
          showCloseButton={false}
          className="flex flex-col gap-0 overflow-hidden rounded-md ring ring-white/5 bg-sidebar/5 p-2 shadow-2xl backdrop-blur-lg max-w-sm"
        >
          <div className="flex flex-col gap-0 overflow-hidden rounded-sm ring ring-white/5 bg-sidebar-accent/80">
            <div className="flex items-start gap-3 px-5 py-4">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md ring ring-white/5 bg-sidebar-accent">
                <Download className="h-3.5 w-3.5 text-white/60" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-white">Export</div>
                <p className="mt-1 text-xs leading-relaxed text-white/40">
                  Choose a filename for your export
                </p>
              </div>
              <DialogClose asChild>
                <button
                  type="button"
                  className="ml-auto flex size-8 cursor-pointer items-center justify-center rounded-sm ring ring-white/5 bg-sidebar-accent text-white/50 transition-colors hover:bg-sidebar-accent hover:brightness-110 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                  <span className="sr-only">Close</span>
                </button>
              </DialogClose>
            </div>
            <Separator />
            <div className="px-5 py-4">
              <Input
                value={exportFileName}
                onChange={(e) => setExportFileName(e.target.value)}
                placeholder="Enter filename..."
                className="bg-sidebar-accent ring-white/10 rounded-sm text-white text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConfirmExport();
                }}
                autoFocus
              />
              <p className="text-[10px] text-white/40 mt-2">
                .{exportDialogType === "csv" ? "csv" : "json"} will be appended
                automatically
              </p>
            </div>
            <Separator />
            <div className="flex items-center justify-end gap-2 px-5 py-3">
              <Button
                className="cursor-pointer flex items-center justify-center gap-2 rounded-sm ring ring-white/5 bg-sidebar px-3 py-2 h-9 text-xs text-white/70 transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 shadow-none"
                onClick={() => setShowExportDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmExport}
                className="cursor-pointer flex items-center justify-center gap-2 rounded-sm ring ring-white/5 bg-sidebar px-3 py-2 h-9 text-xs text-white transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 shadow-none"
              >
                Export
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
