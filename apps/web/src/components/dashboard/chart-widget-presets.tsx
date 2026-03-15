"use client";

import { useMemo, useState } from "react";
import { Bookmark, Check, Save, Trash2, X } from "lucide-react";
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

type ChartWidgetPreset = {
  id: string;
  name: string;
  widgets: ChartWidgetType[];
};

type ChartWidgetPresetsProps = {
  currentWidgets: ChartWidgetType[];
  onApplyPreset: (widgets: ChartWidgetType[]) => void | Promise<void>;
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

const builtInPresets: ChartWidgetPreset[] = [
  {
    id: "builtin-default",
    name: "Default",
    widgets: ["daily-net", "performance-weekday", "performing-assets"],
  },
  {
    id: "builtin-performance",
    name: "Performance",
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
        widgets: sanitizeWidgetList(preset?.widgets),
      }))
      .filter((preset) => preset.id && preset.name && preset.widgets.length > 0);
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

export function ChartWidgetPresets({
  currentWidgets,
  onApplyPreset,
}: ChartWidgetPresetsProps) {
  const [customPresets, setCustomPresets] =
    useState<ChartWidgetPreset[]>(loadCustomPresets);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState("");

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
      widgets,
    };

    const nextPresets = [...customPresets, nextPreset];
    setCustomPresets(nextPresets);
    saveCustomPresets(nextPresets);
    setPresetName("");
    setIsSaveDialogOpen(false);
    toast.success(`Preset "${trimmedName}" saved`);
  };

  const handleDeletePreset = (presetId: string) => {
    const nextPresets = customPresets.filter((preset) => preset.id !== presetId);
    setCustomPresets(nextPresets);
    saveCustomPresets(nextPresets);
    toast.success("Preset deleted");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="cursor-pointer flex h-[38px] w-max items-center justify-center gap-2 rounded-sm border border-white/5 bg-sidebar px-3 py-2 text-xs text-white transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110">
            <Bookmark className="size-3" />
            Presets
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className={`w-72 ${toolbarFilterMenuContentClass}`}
        >
          <div className={toolbarFilterMenuSectionTitleClass}>Built-in</div>
          <DropdownMenuSeparator className={toolbarFilterMenuMainSeparatorClass} />
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
                  className={`${toolbarFilterMenuItemClass} cursor-pointer group flex items-center justify-between rounded-sm`}
                >
                  <span className="mr-2 flex-1 truncate">{preset.name}</span>
                  <div className="flex shrink-0 items-center gap-1">
                    {activePresetId === preset.id ? (
                      <Check className="size-3 text-teal-400" />
                    ) : null}
                    <button
                      type="button"
                      className="cursor-pointer p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDeletePreset(preset.id);
                      }}
                      title="Delete"
                    >
                      <Trash2 className="size-3 text-red-400" />
                    </button>
                  </div>
                </DropdownMenuItem>
              ))}
            </>
          ) : null}

          <DropdownMenuSeparator className={toolbarFilterMenuMainSeparatorClass} />

          <DropdownMenuItem
            onClick={() => setIsSaveDialogOpen(true)}
            className={`${toolbarFilterMenuItemClass} cursor-pointer rounded-sm`}
          >
            <Save className="mr-2 size-3" />
            Save current as preset
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent
          showCloseButton={false}
          className="max-w-sm gap-0 overflow-hidden rounded-md border border-white/5 bg-sidebar/5 p-2 shadow-2xl backdrop-blur-lg"
        >
          <div className="flex flex-col gap-0 overflow-hidden rounded-sm border border-white/5 bg-sidebar-accent/80">
            <div className="flex items-start gap-3 px-5 py-4">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-white/5 bg-sidebar-accent">
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
                  className="ml-auto flex size-8 cursor-pointer items-center justify-center rounded-sm border border-white/5 bg-sidebar-accent text-white/50 transition-colors hover:bg-sidebar-accent hover:brightness-110 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                  <span className="sr-only">Close</span>
                </button>
              </DialogClose>
            </div>

            <Separator className="bg-white/5" />

            <div className="px-5 py-4">
              <div className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-white/40">
                Preset name
              </div>
              <Input
                value={presetName}
                onChange={(event) => setPresetName(event.target.value)}
                placeholder="Enter preset name..."
                className="h-10 rounded-sm border-white/5 bg-sidebar text-sm text-white placeholder:text-white/25"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleSavePreset();
                  }
                }}
              />
            </div>

            <Separator className="bg-white/5" />

            <div className="flex items-center justify-end gap-2 px-5 py-4">
              <DialogClose asChild>
                <Button className="h-9 rounded-sm border border-white/5 bg-sidebar px-3 text-xs text-white/70 hover:bg-sidebar-accent hover:text-white">
                  Cancel
                </Button>
              </DialogClose>
              <Button
                onClick={handleSavePreset}
                className="h-9 rounded-sm border border-white/5 bg-sidebar px-3 text-xs text-white hover:bg-sidebar-accent"
              >
                Save preset
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
