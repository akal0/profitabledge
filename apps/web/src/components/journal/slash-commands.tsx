"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  AlertCircle,
  Minus,
  Code,
  Image as ImageIcon,
  Link,
  LineChart,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Activity,
  Target,
  Flame,
  Calendar,
  Clock,
  Table,
  FileText,
  Layers,
  GitCompare,
  Youtube,
  ExternalLink,
  Brain,
  Sparkles,
} from "lucide-react";
import type { ChartEmbedType } from "./types";

export interface SlashCommandItem {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: "text" | "media" | "analytics" | "trading";
  keywords?: string[];
  action: () => void;
}

interface SlashCommandsMenuProps {
  isOpen: boolean;
  position: { top: number; left: number };
  query: string;
  onSelect: (command: SlashCommandItem) => void;
  onClose: () => void;
  onInsertBlock: (type: string, props?: Record<string, unknown>) => void;
  onInsertChart: (chartType: ChartEmbedType) => void;
  onInsertTrade: () => void;
  onInsertTradeComparison: () => void;
  onInsertImage: () => void;
  onInsertLink: () => void;
  onInsertEmbed: () => void;
  onInsertPsychology: () => void;
  onOpenAICapture?: () => void;
}

const iconClass = "h-4 w-4";

export function SlashCommandsMenu({
  isOpen,
  position,
  query,
  onSelect,
  onClose,
  onInsertBlock,
  onInsertChart,
  onInsertTrade,
  onInsertTradeComparison,
  onInsertImage,
  onInsertLink,
  onInsertEmbed,
  onInsertPsychology,
  onOpenAICapture,
}: SlashCommandsMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // Define all available commands
  const allCommands: SlashCommandItem[] = [
    // Text blocks
    {
      id: "paragraph",
      label: "Text",
      description: "Just start writing with plain text",
      icon: <Type className={iconClass} />,
      category: "text",
      keywords: ["text", "paragraph", "plain"],
      action: () => onInsertBlock("paragraph"),
    },
    {
      id: "heading1",
      label: "Heading 1",
      description: "Big section heading",
      icon: <Heading1 className={iconClass} />,
      category: "text",
      keywords: ["h1", "title", "header"],
      action: () => onInsertBlock("heading1"),
    },
    {
      id: "heading2",
      label: "Heading 2",
      description: "Medium section heading",
      icon: <Heading2 className={iconClass} />,
      category: "text",
      keywords: ["h2", "subtitle"],
      action: () => onInsertBlock("heading2"),
    },
    {
      id: "heading3",
      label: "Heading 3",
      description: "Small section heading",
      icon: <Heading3 className={iconClass} />,
      category: "text",
      keywords: ["h3"],
      action: () => onInsertBlock("heading3"),
    },
    {
      id: "bulletList",
      label: "Bulleted List",
      description: "Create a simple bullet list",
      icon: <List className={iconClass} />,
      category: "text",
      keywords: ["bullet", "unordered", "ul"],
      action: () => onInsertBlock("bulletList"),
    },
    {
      id: "numberedList",
      label: "Numbered List",
      description: "Create a numbered list",
      icon: <ListOrdered className={iconClass} />,
      category: "text",
      keywords: ["number", "ordered", "ol"],
      action: () => onInsertBlock("numberedList"),
    },
    {
      id: "checkList",
      label: "To-do List",
      description: "Track tasks with a to-do list",
      icon: <CheckSquare className={iconClass} />,
      category: "text",
      keywords: ["todo", "task", "checkbox"],
      action: () => onInsertBlock("checkList"),
    },
    {
      id: "quote",
      label: "Quote",
      description: "Capture a quote",
      icon: <Quote className={iconClass} />,
      category: "text",
      keywords: ["blockquote", "citation"],
      action: () => onInsertBlock("quote"),
    },
    {
      id: "callout",
      label: "Callout",
      description: "Highlight important information",
      icon: <AlertCircle className={iconClass} />,
      category: "text",
      keywords: ["alert", "note", "info", "warning"],
      action: () =>
        onInsertBlock("callout", {
          calloutEmoji: "💡",
          calloutColor: "#f59e0b",
        }),
    },
    {
      id: "divider",
      label: "Divider",
      description: "Visually divide blocks",
      icon: <Minus className={iconClass} />,
      category: "text",
      keywords: ["separator", "line", "hr"],
      action: () => onInsertBlock("divider"),
    },
    {
      id: "code",
      label: "Code Block",
      description: "Add a code snippet",
      icon: <Code className={iconClass} />,
      category: "text",
      keywords: ["snippet", "programming"],
      action: () => onInsertBlock("code", { language: "javascript" }),
    },
    {
      id: "table",
      label: "Table",
      description: "Add a simple table",
      icon: <Table className={iconClass} />,
      category: "text",
      keywords: ["grid", "data"],
      action: () =>
        onInsertBlock("table", {
          tableData: {
            rows: [
              ["", ""],
              ["", ""],
            ],
            headers: ["Column 1", "Column 2"],
          },
        }),
    },

    // Media
    {
      id: "image",
      label: "Image",
      description: "Upload or embed an image",
      icon: <ImageIcon className={iconClass} />,
      category: "media",
      keywords: ["picture", "photo", "upload"],
      action: onInsertImage,
    },
    {
      id: "link",
      label: "Link",
      description: "Insert a hyperlink",
      icon: <Link className={iconClass} />,
      category: "media",
      keywords: ["link", "url", "hyperlink", "href"],
      action: onInsertLink,
    },
    {
      id: "embed",
      label: "Embed",
      description: "Embed YouTube, Twitter, or any URL",
      icon: <Youtube className={iconClass} />,
      category: "media",
      keywords: ["youtube", "twitter", "video", "embed", "url", "external"],
      action: onInsertEmbed,
    },

    // Charts
    {
      id: "chart-equity-curve",
      label: "Equity Curve",
      description: "Your account equity over time",
      icon: <TrendingUp className={iconClass} />,
      category: "analytics",
      keywords: ["equity", "balance", "growth"],
      action: () => onInsertChart("equity-curve"),
    },
    {
      id: "chart-drawdown",
      label: "Drawdown Chart",
      description: "Visualize drawdown from peak",
      icon: <TrendingDown className={iconClass} />,
      category: "analytics",
      keywords: ["drawdown", "loss", "peak"],
      action: () => onInsertChart("drawdown"),
    },
    {
      id: "chart-daily-net",
      label: "Daily P&L",
      description: "Net profit/loss by day",
      icon: <BarChart3 className={iconClass} />,
      category: "analytics",
      keywords: ["daily", "pnl", "profit", "loss"],
      action: () => onInsertChart("daily-net"),
    },
    {
      id: "chart-performance-weekday",
      label: "Performance by Day",
      description: "Performance breakdown by weekday",
      icon: <Calendar className={iconClass} />,
      category: "analytics",
      keywords: ["weekday", "monday", "friday"],
      action: () => onInsertChart("performance-weekday"),
    },
    {
      id: "chart-performing-assets",
      label: "Asset Performance",
      description: "Profit/loss by trading asset",
      icon: <Activity className={iconClass} />,
      category: "analytics",
      keywords: ["asset", "symbol", "pair"],
      action: () => onInsertChart("performing-assets"),
    },
    {
      id: "chart-heatmap",
      label: "Performance Heatmap",
      description: "Hour x Day performance grid",
      icon: <Layers className={iconClass} />,
      category: "analytics",
      keywords: ["heatmap", "hour", "time"],
      action: () => onInsertChart("performance-heatmap"),
    },
    {
      id: "chart-streak",
      label: "Win/Loss Streaks",
      description: "Distribution of winning/losing streaks",
      icon: <Flame className={iconClass} />,
      category: "analytics",
      keywords: ["streak", "win", "consecutive"],
      action: () => onInsertChart("streak-distribution"),
    },
    {
      id: "chart-r-multiple",
      label: "R-multiple distribution",
      description: "Distribution of R-multiples",
      icon: <Target className={iconClass} />,
      category: "analytics",
      keywords: ["r-multiple", "risk", "reward"],
      action: () => onInsertChart("r-multiple-distribution"),
    },
    {
      id: "chart-mae-mfe",
      label: "MAE / MFE scatter",
      description: "Maximum adverse/favorable excursion",
      icon: <LineChart className={iconClass} />,
      category: "analytics",
      keywords: ["mae", "mfe", "excursion"],
      action: () => onInsertChart("mae-mfe-scatter"),
    },
    {
      id: "chart-entry-exit",
      label: "Entry/Exit Analysis",
      description: "Trade entry and exit time analysis",
      icon: <Clock className={iconClass} />,
      category: "analytics",
      keywords: ["entry", "exit", "timing"],
      action: () => onInsertChart("entry-exit-time"),
    },

    // Trading
    {
      id: "trade",
      label: "Trade",
      description: "Embed a specific trade for analysis",
      icon: <FileText className={iconClass} />,
      category: "trading",
      keywords: ["trade", "position", "order"],
      action: onInsertTrade,
    },
    {
      id: "trade-comparison",
      label: "Trade Comparison",
      description: "Compare multiple trades side by side",
      icon: <GitCompare className={iconClass} />,
      category: "trading",
      keywords: ["compare", "versus", "side"],
      action: onInsertTradeComparison,
    },
    {
      id: "psychology",
      label: "Psychology Check-in",
      description: "Track your mental state before/during/after trading",
      icon: <Brain className={iconClass} />,
      category: "trading",
      keywords: ["mood", "mindset", "mental", "psychology", "emotion", "focus"],
      action: onInsertPsychology,
    },
    ...(onOpenAICapture
      ? [
          {
            id: "ai-capture",
            label: "AI Capture",
            description:
              "Turn one natural-language note into structured journal fields",
            icon: <Sparkles className={iconClass} />,
            category: "trading" as const,
            keywords: ["ai", "capture", "parse", "journal", "metadata"],
            action: onOpenAICapture,
          },
        ]
      : []),
  ];

  // Filter commands based on query
  const filteredCommands = query
    ? allCommands.filter((cmd) => {
        const searchText = query.toLowerCase();
        return (
          cmd.label.toLowerCase().includes(searchText) ||
          cmd.description.toLowerCase().includes(searchText) ||
          cmd.keywords?.some((k) => k.toLowerCase().includes(searchText))
        );
      })
    : allCommands;

  // Group commands by category
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) {
      acc[cmd.category] = [];
    }
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, SlashCommandItem[]>);

  const categoryLabels: Record<string, string> = {
    text: "Basic blocks",
    media: "Media",
    analytics: "Charts & Analytics",
    trading: "Trading",
  };

  const categoryOrder = ["text", "media", "analytics", "trading"];

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredCommands.length - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case "Enter":
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            onSelect(filteredCommands[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [isOpen, filteredCommands, selectedIndex, onSelect, onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = menuRef.current?.querySelector(
      `[data-index="${selectedIndex}"]`
    );
    selectedElement?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!isOpen || filteredCommands.length === 0) return null;

  let globalIndex = 0;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-72 max-h-80 overflow-y-auto rounded-md border border-white/5 bg-sidebar/95 p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.42)] backdrop-blur-xl"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      {(() => {
        let firstRendered = true;
        return categoryOrder.map((category) => {
          const commands = groupedCommands[category];
          if (!commands || commands.length === 0) return null;
          const isFirst = firstRendered;
          firstRendered = false;

          const sep = (
            <div className="-mx-1.5 h-px bg-[#000000]/50 border-b border-[#222225]" />
          );

          return (
            <div key={category}>
              {!isFirst && sep}
              <div className="px-2 pb-2 pt-3 first:pt-2">
                <div className="text-[11px] font-semibold text-white/55">
                  {categoryLabels[category]}
                </div>
              </div>
              {sep}
              <div className="py-1">
                {commands.map((cmd) => {
                  const currentIndex = globalIndex++;
                  return (
                    <button
                      key={cmd.id}
                      data-index={currentIndex}
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-2.5 rounded-sm px-2.5 py-2 text-left transition-colors",
                        currentIndex === selectedIndex
                          ? "bg-sidebar-accent/80 text-white"
                          : "text-white/75 hover:bg-sidebar-accent/80 hover:text-white"
                      )}
                      onClick={() => onSelect(cmd)}
                      onMouseEnter={() => setSelectedIndex(currentIndex)}
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-sm border border-white/5 bg-sidebar-accent text-white/50">
                        {cmd.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium leading-tight">
                          {cmd.label}
                        </div>
                        <div className="truncate text-[11px] text-white/40 leading-tight mt-0.5">
                          {cmd.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        });
      })()}
    </div>
  );
}
