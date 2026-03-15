"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { ChartEmbedType } from "../types";
import { EquityCurveChart } from "@/components/dashboard/charts/equity-curve";
import { DrawdownChart } from "@/components/dashboard/charts/drawdown-chart";
import { DailyNetBarChart } from "@/components/dashboard/charts/daily-net";
import { PerformanceWeekdayChart } from "@/components/dashboard/charts/performance-weekday";
import { PerformingAssetsBarChart } from "@/components/dashboard/charts/performing-assets";
import { PerformanceHeatmap } from "@/components/dashboard/charts/performance-heatmap";
import { StreakDistributionChart } from "@/components/dashboard/charts/streak-distribution";
import { RMultipleDistributionChart } from "@/components/dashboard/charts/r-multiple-distribution";
import { MAEMFEScatterChart } from "@/components/dashboard/charts/mae-mfe-scatter";
import { EntryExitTimeChart } from "@/components/dashboard/charts/entry-exit-time";
import { Trash2, Settings, GripVertical, LineChart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/utils/trpc";
import { useAccountStore } from "@/stores/account";
import { ChartRenderModeProvider } from "@/components/dashboard/charts/chart-render-mode";

// Chart type metadata
const chartTypeInfo: Record<ChartEmbedType, { label: string }> = {
  "equity-curve": { label: "Equity Curve" },
  drawdown: { label: "Drawdown" },
  "daily-net": { label: "Daily P&L" },
  "performance-weekday": { label: "Performance by Day" },
  "performing-assets": { label: "Asset Performance" },
  "performance-heatmap": { label: "Performance Heatmap" },
  "streak-distribution": { label: "Win/Loss Streaks" },
  "r-multiple-distribution": { label: "R-Multiple" },
  "mae-mfe-scatter": { label: "MAE / MFE scatter" },
  "entry-exit-time": { label: "Entry / exit time" },
};

// Node View Component
function ChartNodeView({ node, deleteNode, selected, updateAttributes }: any) {
  const [isHovered, setIsHovered] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const chartContentRef = useRef<HTMLDivElement>(null);
  const chartType = node.attrs.chartType as ChartEmbedType;
  const accountId = node.attrs.accountId;
  const height = node.attrs.height || 460;
  const title =
    node.attrs.title || chartTypeInfo[chartType]?.label || chartType;

  const { selectedAccountId } = useAccountStore();
  const effectiveAccountId = accountId || selectedAccountId;
  const shouldLoadAccounts = showConfig || !effectiveAccountId;

  const { data: accounts } = trpc.accounts.list.useQuery(undefined, {
    enabled: shouldLoadAccounts,
  });

  useEffect(() => {
    const container = chartContentRef.current;

    if (!container) {
      return;
    }

    const patchEmbeddedChartFocus = () => {
      container
        .querySelectorAll<SVGElement>(".recharts-surface")
        .forEach((surface) => {
          if (surface.getAttribute("tabindex") !== "-1") {
            surface.setAttribute("tabindex", "-1");
          }
          if (surface.getAttribute("focusable") !== "false") {
            surface.setAttribute("focusable", "false");
          }
        });
    };

    patchEmbeddedChartFocus();

    const observer = new MutationObserver(() => {
      patchEmbeddedChartFocus();
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [chartType, effectiveAccountId]);

  // Config state
  const [configTitle, setConfigTitle] = useState(node.attrs.title || "");
  const [configHeight, setConfigHeight] = useState(String(height));
  const [configChartType, setConfigChartType] = useState(chartType);
  const [configAccountId, setConfigAccountId] = useState(accountId || "");

  const handleSaveConfig = () => {
    updateAttributes({
      title: configTitle || null,
      height: parseInt(configHeight) || 460,
      chartType: configChartType,
      accountId: configAccountId || null,
    });
    setShowConfig(false);
  };

  const handleAccountChange = (newAccountId: string) => {
    updateAttributes({ accountId: newAccountId });
  };

  const renderChart = () => {
    if (!effectiveAccountId) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 py-8">
          <LineChart className="h-12 w-12 text-white/20" />
          <div className="text-center">
            <p className="text-sm text-white/60 mb-2">
              Select an account to view chart data
            </p>
            <Select onValueChange={handleAccountChange}>
              <SelectTrigger className="w-64 bg-sidebar-accent border-white/10">
                <SelectValue placeholder="Select account..." />
              </SelectTrigger>
              <SelectContent className="bg-sidebar border-white/10">
                {accounts?.map((account) => (
                  <SelectItem
                    key={account.id}
                    value={account.id}
                    className="text-white focus:bg-white/10"
                  >
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      );
    }

    switch (chartType) {
      case "equity-curve":
        return (
          <EquityCurveChart
            accountId={effectiveAccountId}
            ownerId={`journal-${chartType}`}
            comparisonMode="none"
          />
        );
      case "drawdown":
        return (
          <DrawdownChart
            accountId={effectiveAccountId}
            ownerId={`journal-${chartType}`}
            comparisonMode="none"
          />
        );
      case "daily-net":
        return (
          <DailyNetBarChart
            accountId={effectiveAccountId}
            ownerId={`journal-${chartType}`}
            comparisonMode="none"
          />
        );
      case "performance-weekday":
        return (
          <PerformanceWeekdayChart
            accountId={effectiveAccountId}
            ownerId={`journal-${chartType}`}
            comparisonMode="none"
          />
        );
      case "performing-assets":
        return (
          <PerformingAssetsBarChart
            accountId={effectiveAccountId}
            ownerId={`journal-${chartType}`}
            comparisonMode="none"
          />
        );
      case "performance-heatmap":
        return <PerformanceHeatmap accountId={effectiveAccountId} />;
      case "streak-distribution":
        return (
          <StreakDistributionChart
            accountId={effectiveAccountId}
            ownerId={`journal-${chartType}`}
            comparisonMode="none"
          />
        );
      case "r-multiple-distribution":
        return (
          <RMultipleDistributionChart
            accountId={effectiveAccountId}
            ownerId={`journal-${chartType}`}
            comparisonMode="none"
          />
        );
      case "mae-mfe-scatter":
        return <MAEMFEScatterChart accountId={effectiveAccountId} />;
      case "entry-exit-time":
        return (
          <EntryExitTimeChart
            accountId={effectiveAccountId}
            ownerId={`journal-${chartType}`}
            comparisonMode="none"
          />
        );
      default:
        return (
          <div className="flex items-center justify-center h-full text-white/40">
            Unknown chart type: {chartType}
          </div>
        );
    }
  };

  return (
    <NodeViewWrapper className="my-4">
      <div
        className={cn(
          "relative bg-sidebar border border-white/5 rounded-lg overflow-hidden group",
          selected && "ring-2 ring-teal-400/50"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        contentEditable={false}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 pt-3">
          <div className="flex items-center gap-2">
            <div
              className="cursor-grab active:cursor-grabbing text-white/30 hover:text-white/50"
              data-drag-handle
            >
              <GripVertical className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-medium text-white/50">{title}</h3>
          </div>

          {/* Controls */}
          {isHovered && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-white/40 hover:text-white hover:bg-white/10"
                onClick={() => {
                  setConfigTitle(node.attrs.title || "");
                  setConfigHeight(String(height));
                  setConfigChartType(chartType);
                  setConfigAccountId(accountId || "");
                  setShowConfig(true);
                }}
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-red-400 hover:text-red-400 hover:bg-red-400/10"
                onClick={() => deleteNode()}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Chart container - fixed height to contain the chart */}
        <div ref={chartContentRef} className="px-3 pb-3">
          <div
            className="[&_.recharts-wrapper]:!h-full [&>div]:h-full"
            style={{ height: `${height}px` }}
          >
            <ChartRenderModeProvider mode="embedded">
              {renderChart()}
            </ChartRenderModeProvider>
          </div>
        </div>

        {/* Config Dialog */}
        <Dialog open={showConfig} onOpenChange={setShowConfig}>
          <DialogContent
            showCloseButton={false}
            className="flex flex-col gap-0 overflow-hidden rounded-md border border-white/5 bg-sidebar/5 p-2 shadow-2xl backdrop-blur-lg max-w-md"
          >
            <div className="flex flex-col gap-0 overflow-hidden rounded-sm border border-white/5 bg-sidebar-accent/80">
              {/* Header */}
              <div className="flex items-start gap-3 px-5 py-4 shrink-0">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-white/5 bg-sidebar-accent">
                  <Settings className="h-3.5 w-3.5 text-white/60" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white">
                    Chart Settings
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-white/40">
                    Customize how this chart appears in your journal
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
              <Separator />
              {/* Body */}
              <div className="space-y-4 px-5 py-4">
                {/* Account */}
                <div className="space-y-2">
                  <Label className="text-sm text-white/60">Account</Label>
                  <Select
                    value={configAccountId}
                    onValueChange={setConfigAccountId}
                  >
                    <SelectTrigger className="bg-sidebar-accent border-white/10 text-white">
                      <SelectValue placeholder="Use selected account" />
                    </SelectTrigger>
                    <SelectContent className="bg-sidebar border-white/10">
                      <SelectItem
                        value=""
                        className="text-white/60 focus:bg-white/10"
                      >
                        Use selected account
                      </SelectItem>
                      {accounts?.map((account) => (
                        <SelectItem
                          key={account.id}
                          value={account.id}
                          className="text-white focus:bg-white/10"
                        >
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Chart Type */}
                <div className="space-y-2">
                  <Label className="text-sm text-white/60">Chart Type</Label>
                  <Select
                    value={configChartType}
                    onValueChange={(v) =>
                      setConfigChartType(v as ChartEmbedType)
                    }
                  >
                    <SelectTrigger className="bg-sidebar-accent border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-sidebar border-white/10">
                      {Object.entries(chartTypeInfo).map(([key, info]) => (
                        <SelectItem
                          key={key}
                          value={key}
                          className="text-white focus:bg-white/10 focus:text-white"
                        >
                          {info.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Custom Title */}
                <div className="space-y-2">
                  <Label className="text-sm text-white/60">
                    Custom Title (optional)
                  </Label>
                  <Input
                    value={configTitle}
                    onChange={(e) => setConfigTitle(e.target.value)}
                    placeholder={
                      chartTypeInfo[configChartType]?.label || "Chart"
                    }
                    className="bg-sidebar-accent border-white/10 text-white placeholder:text-white/30"
                  />
                </div>

                {/* Height */}
                <div className="space-y-2">
                  <Label className="text-sm text-white/60">Height (px)</Label>
                  <div className="flex gap-2">
                    {["300", "400", "500"].map((h) => (
                      <Button
                        key={h}
                        variant={configHeight === h ? "default" : "outline"}
                        size="sm"
                        onClick={() => setConfigHeight(h)}
                        className={cn(
                          configHeight === h
                            ? "bg-teal-500 hover:bg-teal-600"
                            : "border-white/10 text-white/60 hover:text-white"
                        )}
                      >
                        {h}
                      </Button>
                    ))}
                    <Input
                      type="number"
                      value={configHeight}
                      onChange={(e) => setConfigHeight(e.target.value)}
                      min="200"
                      max="800"
                      className="w-20 bg-sidebar-accent border-white/10 text-white"
                    />
                  </div>
                </div>
              </div>
              <Separator />
              {/* Footer */}
              <div className="flex items-center justify-end gap-2 px-5 py-3 shrink-0">
                <Button
                  className="cursor-pointer flex items-center justify-center gap-2 rounded-sm border border-white/5 bg-sidebar px-3 py-2 h-9 text-xs text-white/70 transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 shadow-none"
                  onClick={() => setShowConfig(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveConfig}
                  className="cursor-pointer flex items-center justify-center gap-2 rounded-sm border border-white/5 bg-sidebar px-3 py-2 h-9 text-xs text-white transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 shadow-none"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </NodeViewWrapper>
  );
}

// TipTap Extension
export const ChartNode = Node.create({
  name: "chartEmbed",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      chartType: {
        default: "equity-curve",
      },
      accountId: {
        default: null,
      },
      height: {
        default: 400,
      },
      title: {
        default: null,
      },
      dateRange: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-chart-embed]",
        getAttrs: (dom) => {
          if (typeof dom === "string") return {};
          const element = dom as HTMLElement;
          return {
            chartType: element.getAttribute("data-chart-type"),
            accountId: element.getAttribute("data-account-id"),
            height: element.getAttribute("data-height")
              ? parseInt(element.getAttribute("data-height")!)
              : 400,
            title: element.getAttribute("data-title"),
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    // Include all attrs as data attributes for proper serialization
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-chart-embed": "",
        "data-chart-type": node.attrs.chartType || "",
        "data-account-id": node.attrs.accountId || "",
        "data-height": String(node.attrs.height || 300),
        "data-title": node.attrs.title || "",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ChartNodeView);
  },

  addCommands() {
    return {
      insertChart:
        (attrs: {
          chartType: ChartEmbedType;
          accountId?: string;
          height?: number;
        }) =>
        ({ chain }: { chain: any }) => {
          return chain()
            .insertContent({
              type: this.name,
              attrs,
            })
            .run();
        },
    } as any;
  },
});
