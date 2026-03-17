"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  Bookmark,
  Check,
  Download,
  FileJson,
  FileSpreadsheet,
  Pencil,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import type { ChartWidgetType } from "@/components/dashboard/chart-widgets";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  toolbarFilterMenuContentClass,
  toolbarFilterMenuItemClass,
  toolbarFilterMenuMainSeparatorClass,
  toolbarFilterMenuSectionTitleClass,
} from "@/components/ui/filter-menu-styles";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export type ChartWidgetPreset = {
  id: string;
  name: string;
  createdAt: string;
  widgets: ChartWidgetType[];
};

type ChartWidgetPresetsProps = {
  currentWidgets: ChartWidgetType[];
  onApplyPreset: (widgets: ChartWidgetType[]) => void | Promise<void>;
};

type ChartWidgetExportData = {
  exportedAt: string;
  version: string;
  widgets: ChartWidgetType[];
  metadata: {
    totalWidgets: number;
    widgetNames: string[];
  };
};

const STORAGE_KEY = "profitable-edge-chart-widget-presets";
const VALID_CHART_WIDGET_TYPES = new Set<ChartWidgetType>([
  "daily-net",
  "performance-weekday",
  "performing-assets",
  "equity-curve",
  "drawdown-chart",
  "performance-heatmap",
  "streak-distribution",
  "r-multiple-distribution",
  "mae-mfe-scatter",
  "entry-exit-time",
  "hold-time-scatter",
  "monte-carlo",
  "rolling-performance",
  "correlation-matrix",
  "radar-comparison",
  "risk-adjusted",
  "bell-curve",
]);
const chartWidgetLabels: Record<ChartWidgetType, string> = {
  "daily-net": "Daily Net",
  "performance-weekday": "Performance Weekday",
  "performing-assets": "Performing Assets",
  "equity-curve": "Equity Curve",
  "drawdown-chart": "Drawdown Chart",
  "performance-heatmap": "Performance Heatmap",
  "streak-distribution": "Streak Distribution",
  "r-multiple-distribution": "R-Multiple Distribution",
  "mae-mfe-scatter": "MAE / MFE Scatter",
  "entry-exit-time": "Entry / Exit Time",
  "hold-time-scatter": "Hold Time Scatter",
  "monte-carlo": "Monte Carlo",
  "rolling-performance": "Rolling Performance",
  "correlation-matrix": "Correlation Matrix",
  "radar-comparison": "Radar Comparison",
  "risk-adjusted": "Risk Adjusted",
  "bell-curve": "Bell Curve",
};

const builtInPresets: ChartWidgetPreset[] = [
  {
    id: "builtin-default",
    name: "Default",
    createdAt: new Date().toISOString(),
    widgets: ["daily-net", "performance-weekday", "performing-assets"],
  },
  {
    id: "builtin-performance",
    name: "Performance",
    createdAt: new Date().toISOString(),
    widgets: [
      "daily-net",
      "equity-curve",
      "drawdown-chart",
      "rolling-performance",
      "performance-weekday",
    ],
  },
  {
    id: "builtin-execution",
    name: "Execution",
    createdAt: new Date().toISOString(),
    widgets: [
      "performance-heatmap",
      "entry-exit-time",
      "hold-time-scatter",
      "mae-mfe-scatter",
      "streak-distribution",
    ],
  },
  {
    id: "builtin-risk",
    name: "Risk",
    createdAt: new Date().toISOString(),
    widgets: [
      "drawdown-chart",
      "risk-adjusted",
      "r-multiple-distribution",
      "bell-curve",
      "monte-carlo",
    ],
  },
  {
    id: "builtin-market",
    name: "Market relationships",
    createdAt: new Date().toISOString(),
    widgets: [
      "performing-assets",
      "correlation-matrix",
      "radar-comparison",
      "performance-weekday",
    ],
  },
];

function sanitizeWidgetList(widgets: unknown): ChartWidgetType[] {
  if (!Array.isArray(widgets)) return [];

  return widgets.filter(
    (widget): widget is ChartWidgetType =>
      typeof widget === "string" &&
      VALID_CHART_WIDGET_TYPES.has(widget as ChartWidgetType)
  );
}

function isBuiltinPreset(id: string) {
  return id.startsWith("builtin-");
}

function loadCustomPresets(): ChartWidgetPreset[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((preset) => ({
        id: String(preset?.id ?? ""),
        name: String(preset?.name ?? "").trim(),
        createdAt: String(preset?.createdAt ?? new Date().toISOString()),
        widgets: sanitizeWidgetList(preset?.widgets),
      }))
      .filter(
        (preset) =>
          preset.id.length > 0 &&
          preset.name.length > 0 &&
          preset.widgets.length > 0
      );
  } catch (error) {
    console.error("Failed to load chart widget presets:", error);
    return [];
  }
}

function saveCustomPresets(presets: ChartWidgetPreset[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch (error) {
    console.error("Failed to save chart widget presets:", error);
  }
}

function sameWidgetSet(left: ChartWidgetType[], right: ChartWidgetType[]) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((widget) => rightSet.has(widget));
}

function exportChartWidgetsAsJson(
  widgets: ChartWidgetType[],
  fileName?: string
) {
  const exportData: ChartWidgetExportData = {
    exportedAt: new Date().toISOString(),
    version: "1.0",
    widgets,
    metadata: {
      totalWidgets: widgets.length,
      widgetNames: widgets.map((widget) => chartWidgetLabels[widget] || widget),
    },
  };

  const data = JSON.stringify(exportData, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${
    fileName ??
    `dashboard-chart-widgets-${new Date().toISOString().split("T")[0]}`
  }.json`;
  link.click();
  URL.revokeObjectURL(url);

  toast.success("Chart widgets exported as JSON");
}

function exportChartWidgetsAsCsv(
  widgets: ChartWidgetType[],
  fileName?: string
) {
  const headers = ["Position", "Widget ID", "Widget Name"];
  const rows = widgets.map((widget, index) => [
    index + 1,
    widget,
    chartWidgetLabels[widget] || widget,
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${
    fileName ??
    `dashboard-chart-widgets-${new Date().toISOString().split("T")[0]}`
  }.csv`;
  link.click();
  URL.revokeObjectURL(url);

  toast.success("Chart widgets exported as CSV");
}

export function ChartWidgetPresets({
  currentWidgets,
  onApplyPreset,
}: ChartWidgetPresetsProps) {
  const [customPresets, setCustomPresets] =
    useState<ChartWidgetPreset[]>(loadCustomPresets);
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
    const allPresets = [...builtInPresets, ...customPresets];
    const current = sanitizeWidgetList(currentWidgets);
    return (
      allPresets.find((preset) => sameWidgetSet(current, preset.widgets))?.id ??
      null
    );
  }, [currentWidgets, customPresets]);

  const handleApplyPreset = async (preset: ChartWidgetPreset) => {
    const widgets = sanitizeWidgetList(preset.widgets);
    if (widgets.length === 0) {
      toast.error("This preset does not contain any available chart widgets");
      return;
    }

    try {
      await Promise.resolve(onApplyPreset(widgets));
      toast.success(`Applied "${preset.name}"`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to apply preset"
      );
    }
  };

  const handleSavePreset = () => {
    const trimmedName = presetName.trim();
    if (!trimmedName) {
      toast.error("Please enter a preset name");
      return;
    }

    const widgets = sanitizeWidgetList(currentWidgets);
    if (widgets.length === 0) {
      toast.error("Choose at least one chart widget before saving a preset");
      return;
    }

    const nextPreset: ChartWidgetPreset = {
      id: `custom-${Date.now()}`,
      name: trimmedName,
      createdAt: new Date().toISOString(),
      widgets,
    };

    const nextPresets = [...customPresets, nextPreset];
    setCustomPresets(nextPresets);
    saveCustomPresets(nextPresets);
    setPresetName("");
    setShowSaveDialog(false);
    toast.success(`Preset "${trimmedName}" saved`);
  };

  const handleDeletePreset = (presetId: string) => {
    const nextPresets = customPresets.filter(
      (preset) => preset.id !== presetId
    );
    setCustomPresets(nextPresets);
    saveCustomPresets(nextPresets);
    toast.success("Preset deleted");
  };

  const handleOpenRenameDialog = (preset: ChartWidgetPreset) => {
    setRenamePresetId(preset.id);
    setRenamePresetName(preset.name);
    setShowRenameDialog(true);
  };

  const handleRenamePreset = () => {
    const trimmedName = renamePresetName.trim();
    if (!trimmedName) {
      toast.error("Please enter a preset name");
      return;
    }

    const nextPresets = customPresets.map((preset) =>
      preset.id === renamePresetId ? { ...preset, name: trimmedName } : preset
    );
    setCustomPresets(nextPresets);
    saveCustomPresets(nextPresets);
    setShowRenameDialog(false);
    setRenamePresetId(null);
    setRenamePresetName("");
    toast.success("Preset renamed");
  };

  const openExportDialog = (type: "json" | "csv") => {
    const date = new Date().toISOString().split("T")[0];
    setExportDialogType(type);
    setExportFileName(`dashboard-chart-widgets-${date}`);
    setShowExportDialog(true);
  };

  const handleConfirmExport = () => {
    const fileName = exportFileName.trim() || "export";

    if (exportDialogType === "json") {
      exportChartWidgetsAsJson(currentWidgets, fileName);
    } else {
      exportChartWidgetsAsCsv(currentWidgets, fileName);
    }

    setShowExportDialog(false);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportPresets = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const imported = JSON.parse(text);

      let presetsToImport: ChartWidgetPreset[] = [];

      if (Array.isArray(imported)) {
        presetsToImport = imported.map((preset) => ({
          id: String(preset?.id ?? ""),
          name: String(preset?.name ?? "").trim(),
          createdAt: String(preset?.createdAt ?? new Date().toISOString()),
          widgets: sanitizeWidgetList(preset?.widgets),
        }));
      } else if (Array.isArray(imported.widgets)) {
        presetsToImport = [
          {
            id: `imported-${Date.now()}`,
            name: imported.name || file.name.replace(".json", ""),
            createdAt: imported.createdAt || new Date().toISOString(),
            widgets: sanitizeWidgetList(imported.widgets),
          },
        ];
      } else {
        throw new Error("Invalid format");
      }

      const validPresets = presetsToImport.filter(
        (preset) => preset.name && preset.widgets.length > 0
      );

      if (validPresets.length === 0) {
        toast.error("No valid presets found in file");
        return;
      }

      const nextCustomPresets = validPresets
        .filter((preset) => !isBuiltinPreset(preset.id))
        .map((preset, index) => ({
          ...preset,
          id: `imported-${Date.now()}-${index}`,
          createdAt: preset.createdAt || new Date().toISOString(),
        }));

      if (nextCustomPresets.length > 0) {
        const updated = [...customPresets, ...nextCustomPresets];
        setCustomPresets(updated);
        saveCustomPresets(updated);
        await handleApplyPreset(nextCustomPresets[0]);
        toast.success(`Imported ${nextCustomPresets.length} preset(s)`);
      } else {
        await handleApplyPreset(validPresets[0]);
        toast.info("Applied built-in preset");
      }
    } catch (error) {
      toast.error("Failed to import. Invalid JSON format.");
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleResetToDefault = async () => {
    await handleApplyPreset(builtInPresets[0]);
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
          <Button className="flex h-[38px] w-max cursor-pointer items-center justify-center gap-2 rounded-sm bg-sidebar px-3 py-2 text-xs text-white ring ring-white/5 transition-all duration-250 hover:bg-sidebar-accent hover:brightness-110 active:scale-95">
            <Bookmark className="size-3" />
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
              onClick={() => void handleApplyPreset(preset)}
              className={`${toolbarFilterMenuItemClass} cursor-pointer flex items-center justify-between rounded-sm`}
            >
              <span>{preset.name}</span>
              {activePresetId === preset.id ? (
                <Check className="size-3 text-teal-400" />
              ) : null}
            </DropdownMenuItem>
          ))}

          {customPresets.length > 0 ? (
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
                  onClick={() => void handleApplyPreset(preset)}
                  className={`${toolbarFilterMenuItemClass} group flex cursor-pointer items-center justify-between rounded-sm`}
                >
                  <span className="mr-2 flex-1 truncate">{preset.name}</span>
                  <div className="flex shrink-0 items-center gap-0.5">
                    {activePresetId === preset.id ? (
                      <Check className="size-3 text-teal-400" />
                    ) : null}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleOpenRenameDialog(preset);
                      }}
                      className="cursor-pointer p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                      title="Rename"
                    >
                      <Pencil className="size-3 text-white/50 hover:text-white" />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDeletePreset(preset.id);
                      }}
                      className="cursor-pointer p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                      title="Delete"
                    >
                      <Trash2 className="size-3 text-red-400" />
                    </button>
                  </div>
                </DropdownMenuItem>
              ))}
            </>
          ) : null}

          <DropdownMenuSeparator
            className={toolbarFilterMenuMainSeparatorClass}
          />

          <DropdownMenuItem
            onClick={() => setShowSaveDialog(true)}
            className={`${toolbarFilterMenuItemClass} cursor-pointer rounded-sm`}
          >
            <Save className="mr-2 size-3" />
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
            <FileJson className="mr-2 size-3" />
            Export chart widgets (JSON)
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => openExportDialog("csv")}
            className={`${toolbarFilterMenuItemClass} cursor-pointer rounded-sm`}
          >
            <FileSpreadsheet className="mr-2 size-3" />
            Export chart widgets (CSV)
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleImportClick}
            className={`${toolbarFilterMenuItemClass} cursor-pointer rounded-sm`}
          >
            <Upload className="mr-2 size-3" />
            Import presets
          </DropdownMenuItem>

          <DropdownMenuSeparator
            className={toolbarFilterMenuMainSeparatorClass}
          />

          <DropdownMenuItem
            onClick={() => void handleResetToDefault()}
            className={`${toolbarFilterMenuItemClass} cursor-pointer rounded-sm`}
          >
            <RotateCcw className="mr-2 size-3" />
            Reset to default
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent
          showCloseButton={false}
          className="flex max-w-sm flex-col gap-0 overflow-hidden rounded-md bg-sidebar/5 p-2 shadow-2xl ring ring-white/5 backdrop-blur-lg"
        >
          <div className="flex flex-col gap-0 overflow-hidden rounded-sm bg-sidebar-accent/80 ring ring-white/5">
            <div className="flex items-start gap-3 px-5 py-4">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-accent ring ring-white/5">
                <Bookmark className="h-3.5 w-3.5 text-white/60" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-white">
                  Save chart preset
                </div>
                <p className="mt-1 text-xs leading-relaxed text-white/40">
                  Save your current chart widget selection as a reusable preset
                </p>
              </div>
              <DialogClose asChild>
                <button
                  type="button"
                  className="ml-auto flex size-8 cursor-pointer items-center justify-center rounded-sm bg-sidebar-accent text-white/50 ring ring-white/5 transition-colors hover:bg-sidebar-accent hover:brightness-110 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                  <span className="sr-only">Close</span>
                </button>
              </DialogClose>
            </div>

            <Separator />

            <div className="px-5 py-4">
              <Input
                value={presetName}
                onChange={(event) => setPresetName(event.target.value)}
                placeholder="Enter preset name..."
                className="rounded-sm bg-sidebar-accent text-sm text-white ring-white/10"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleSavePreset();
                  }
                }}
              />
              <p className="mt-2 text-[10px] text-white/40">
                {currentWidgets.length} chart widgets will be saved
              </p>
            </div>

            <Separator />

            <div className="flex items-center justify-end gap-2 px-5 py-3">
              <Button
                className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-sm bg-sidebar px-3 py-2 text-xs text-white/70 shadow-none ring ring-white/5 transition-all duration-250 hover:bg-sidebar-accent hover:brightness-110 active:scale-95"
                onClick={() => setShowSaveDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSavePreset}
                className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-sm bg-sidebar px-3 py-2 text-xs text-white shadow-none ring ring-white/5 transition-all duration-250 hover:bg-sidebar-accent hover:brightness-110 active:scale-95"
              >
                Save preset
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent
          showCloseButton={false}
          className="flex max-w-sm flex-col gap-0 overflow-hidden rounded-md bg-sidebar/5 p-2 shadow-2xl ring ring-white/5 backdrop-blur-lg"
        >
          <div className="flex flex-col gap-0 overflow-hidden rounded-sm bg-sidebar-accent/80 ring ring-white/5">
            <div className="flex items-start gap-3 px-5 py-4">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-accent ring ring-white/5">
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
                  className="ml-auto flex size-8 cursor-pointer items-center justify-center rounded-sm bg-sidebar-accent text-white/50 ring ring-white/5 transition-colors hover:bg-sidebar-accent hover:brightness-110 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                  <span className="sr-only">Close</span>
                </button>
              </DialogClose>
            </div>

            <Separator />

            <div className="px-5 py-4">
              <Input
                value={renamePresetName}
                onChange={(event) => setRenamePresetName(event.target.value)}
                placeholder="Enter new name..."
                className="rounded-sm bg-sidebar-accent text-sm text-white ring-white/10"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleRenamePreset();
                  }
                }}
                autoFocus
              />
            </div>

            <Separator />

            <div className="flex items-center justify-end gap-2 px-5 py-3">
              <Button
                className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-sm bg-sidebar px-3 py-2 text-xs text-white/70 shadow-none ring ring-white/5 transition-all duration-250 hover:bg-sidebar-accent hover:brightness-110 active:scale-95"
                onClick={() => setShowRenameDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleRenamePreset}
                className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-sm bg-sidebar px-3 py-2 text-xs text-white shadow-none ring ring-white/5 transition-all duration-250 hover:bg-sidebar-accent hover:brightness-110 active:scale-95"
              >
                Rename
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent
          showCloseButton={false}
          className="flex max-w-sm flex-col gap-0 overflow-hidden rounded-md bg-sidebar/5 p-2 shadow-2xl ring ring-white/5 backdrop-blur-lg"
        >
          <div className="flex flex-col gap-0 overflow-hidden rounded-sm bg-sidebar-accent/80 ring ring-white/5">
            <div className="flex items-start gap-3 px-5 py-4">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-accent ring ring-white/5">
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
                  className="ml-auto flex size-8 cursor-pointer items-center justify-center rounded-sm bg-sidebar-accent text-white/50 ring ring-white/5 transition-colors hover:bg-sidebar-accent hover:brightness-110 hover:text-white"
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
                onChange={(event) => setExportFileName(event.target.value)}
                placeholder="Enter filename..."
                className="rounded-sm bg-sidebar-accent text-sm text-white ring-white/10"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleConfirmExport();
                  }
                }}
                autoFocus
              />
              <p className="mt-2 text-[10px] text-white/40">
                .{exportDialogType === "csv" ? "csv" : "json"} will be appended
                automatically
              </p>
            </div>
            <Separator />
            <div className="flex items-center justify-end gap-2 px-5 py-3">
              <Button
                className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-sm bg-sidebar px-3 py-2 text-xs text-white/70 shadow-none ring ring-white/5 transition-all duration-250 hover:bg-sidebar-accent hover:brightness-110 active:scale-95"
                onClick={() => setShowExportDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmExport}
                className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-sm bg-sidebar px-3 py-2 text-xs text-white shadow-none ring ring-white/5 transition-all duration-250 hover:bg-sidebar-accent hover:brightness-110 active:scale-95"
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
