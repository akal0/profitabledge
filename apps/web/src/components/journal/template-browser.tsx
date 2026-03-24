"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  FileText,
  Calendar,
  CalendarDays,
  Target,
  GitCompare,
  Sparkles,
  Plus,
  ChevronRight,
  X,
} from "lucide-react";
import { TRADE_SURFACE_CARD_CLASS } from "@/components/trades/trade-identifier-pill";

// Template categories with icons
const categoryConfig = {
  daily: { label: "Daily Review", icon: Calendar, color: "text-blue-400" },
  weekly: {
    label: "Weekly Review",
    icon: CalendarDays,
    color: "text-purple-400",
  },
  trade_review: { label: "Trade Review", icon: Target, color: "text-teal-400" },
  strategy: { label: "Strategy", icon: Sparkles, color: "text-yellow-400" },
  custom: { label: "Custom", icon: FileText, color: "text-white/60" },
};

type JournalTemplateCategory = keyof typeof categoryConfig;

// Pre-built system templates
const systemTemplates = [
  {
    id: "daily-review",
    name: "Daily Trading Review",
    description: "Review your trading day with structured reflection",
    emoji: "📅",
    category: "daily",
    content: [
      { id: "1", type: "heading1", content: "Daily Trading Review" },
      { id: "2", type: "heading2", content: "Market Overview" },
      {
        id: "3",
        type: "paragraph",
        content: "What were the key market conditions today?",
      },
      { id: "4", type: "heading2", content: "Trades Taken" },
      {
        id: "5",
        type: "paragraph",
        content: "List your trades and brief analysis:",
      },
      { id: "6", type: "heading2", content: "What Went Well" },
      { id: "7", type: "checkList", content: "" },
      { id: "8", type: "heading2", content: "Areas for Improvement" },
      { id: "9", type: "checkList", content: "" },
      { id: "10", type: "heading2", content: "Tomorrow's Plan" },
      {
        id: "11",
        type: "paragraph",
        content: "Key levels and setups to watch:",
      },
    ],
  },
  {
    id: "weekly-review",
    name: "Weekly Performance Review",
    description: "Analyze your week with charts and statistics",
    emoji: "📊",
    category: "weekly",
    content: [
      { id: "1", type: "heading1", content: "Weekly Performance Review" },
      { id: "2", type: "paragraph", content: "Week of [DATE]" },
      { id: "3", type: "heading2", content: "Performance Summary" },
      {
        id: "4",
        type: "chart",
        content: "",
        props: { chartType: "equity-curve" },
      },
      { id: "5", type: "heading2", content: "Key Statistics" },
      {
        id: "6",
        type: "bulletList",
        content: "Total trades: \nWin rate: \nProfit factor: \nAverage R: ",
      },
      { id: "7", type: "heading2", content: "Best Trade of the Week" },
      {
        id: "8",
        type: "paragraph",
        content: "Describe your best trade and what made it work:",
      },
      { id: "9", type: "heading2", content: "Worst Trade of the Week" },
      {
        id: "10",
        type: "paragraph",
        content: "What went wrong and how to avoid it:",
      },
      { id: "11", type: "heading2", content: "Lessons Learned" },
      { id: "12", type: "numberedList", content: "" },
      { id: "13", type: "heading2", content: "Goals for Next Week" },
      { id: "14", type: "checkList", content: "" },
    ],
  },
  {
    id: "trade-analysis",
    name: "Trade Analysis",
    description: "Deep dive into a specific trade",
    emoji: "🎯",
    category: "trade_review",
    content: [
      { id: "1", type: "heading1", content: "Trade Analysis" },
      { id: "2", type: "heading2", content: "Trade Details" },
      { id: "3", type: "paragraph", content: "Insert your trade below:" },
      { id: "4", type: "heading2", content: "Setup & Entry" },
      {
        id: "5",
        type: "paragraph",
        content: "What was the setup? Why did you enter?",
      },
      { id: "6", type: "heading2", content: "Trade Management" },
      {
        id: "7",
        type: "paragraph",
        content: "How did you manage the trade? Any adjustments?",
      },
      { id: "8", type: "heading2", content: "Exit Analysis" },
      {
        id: "9",
        type: "paragraph",
        content: "Why did you exit? Was it according to plan?",
      },
      { id: "10", type: "heading2", content: "What I Did Well" },
      { id: "11", type: "bulletList", content: "" },
      { id: "12", type: "heading2", content: "What I Could Improve" },
      { id: "13", type: "bulletList", content: "" },
      {
        id: "14",
        type: "callout",
        content: "Key takeaway from this trade",
        props: { calloutType: "info" },
      },
    ],
  },
  {
    id: "strategy-doc",
    name: "Strategy Documentation",
    description: "Document a trading strategy with rules",
    emoji: "📝",
    category: "strategy",
    content: [
      { id: "1", type: "heading1", content: "Strategy: [Name]" },
      { id: "2", type: "heading2", content: "Overview" },
      {
        id: "3",
        type: "paragraph",
        content: "Brief description of the strategy and its edge:",
      },
      { id: "4", type: "heading2", content: "Market Conditions" },
      { id: "5", type: "paragraph", content: "When to use this strategy:" },
      {
        id: "6",
        type: "bulletList",
        content: "Trending markets\nHigh volatility\nSpecific sessions",
      },
      { id: "7", type: "heading2", content: "Entry Rules" },
      { id: "8", type: "numberedList", content: "" },
      { id: "9", type: "heading2", content: "Exit Rules" },
      { id: "10", type: "numberedList", content: "" },
      { id: "11", type: "heading2", content: "Risk Management" },
      {
        id: "12",
        type: "bulletList",
        content:
          "Position size: \nStop loss: \nTake profit: \nMax daily loss: ",
      },
      { id: "13", type: "heading2", content: "Performance Results" },
      {
        id: "14",
        type: "paragraph",
        content: "Add charts and statistics here:",
      },
      {
        id: "15",
        type: "callout",
        content: "Remember: Stick to the rules!",
        props: { calloutType: "warning" },
      },
    ],
  },
  {
    id: "comparison",
    name: "Trade Comparison",
    description: "Compare multiple trades side by side",
    emoji: "⚖️",
    category: "trade_review",
    content: [
      { id: "1", type: "heading1", content: "Trade Comparison" },
      {
        id: "2",
        type: "paragraph",
        content: "Comparing trades to identify patterns and improvements",
      },
      { id: "3", type: "heading2", content: "Trade 1" },
      { id: "4", type: "paragraph", content: "Insert first trade:" },
      { id: "5", type: "heading2", content: "Trade 2" },
      { id: "6", type: "paragraph", content: "Insert second trade:" },
      { id: "7", type: "heading2", content: "Comparison Analysis" },
      { id: "8", type: "table", content: "" },
      { id: "9", type: "heading2", content: "Similarities" },
      { id: "10", type: "bulletList", content: "" },
      { id: "11", type: "heading2", content: "Differences" },
      { id: "12", type: "bulletList", content: "" },
      { id: "13", type: "heading2", content: "Key Insights" },
      {
        id: "14",
        type: "callout",
        content: "What can you learn from comparing these trades?",
        props: { calloutType: "info" },
      },
    ],
  },
];

// ============================================================================
// Template Browser Dialog
// ============================================================================

interface TemplateBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: any) => void;
  onStartBlank: () => void;
}

export function TemplateBrowser({
  isOpen,
  onClose,
  onSelectTemplate,
  onStartBlank,
}: TemplateBrowserProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<JournalTemplateCategory | null>(null);

  const templateFilters = selectedCategory
    ? { category: selectedCategory }
    : undefined;

  // Fetch user templates
  const { data: userTemplates, isLoading } =
    trpc.journal.listTemplates.useQuery(templateFilters, { enabled: isOpen });

  // Combine system templates with user templates
  const allTemplates = [
    ...systemTemplates.filter(
      (t) =>
        (!selectedCategory || t.category === selectedCategory) &&
        (!search ||
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          t.description.toLowerCase().includes(search.toLowerCase()))
    ),
    ...(userTemplates || []).filter(
      (t: any) =>
        !search ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        (t.description || "").toLowerCase().includes(search.toLowerCase())
    ),
  ];

  const handleSelectTemplate = (template: any) => {
    onSelectTemplate(template);
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-hidden rounded-md p-0 sm:max-w-xl">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="px-6 py-5">
            <SheetHeader className="p-0">
              <SheetTitle className="text-base font-semibold text-white">
                Create new entry
              </SheetTitle>
              <SheetDescription className="text-xs text-white/40">
                Start blank or choose a journal template.
              </SheetDescription>
            </SheetHeader>
          </div>

          <Separator />

          <div className="px-6 py-3">
            <h3 className="text-xs font-semibold tracking-wide text-white/70">
              Start point
            </h3>
          </div>
          <Separator />

          <div className="px-6 py-5">
            <button
              onClick={() => {
                onStartBlank();
                onClose();
              }}
              className={cn(
                TRADE_SURFACE_CARD_CLASS,
                "group flex w-full items-center gap-4 ring ring-white/8 px-4 py-4 text-left transition-colors hover:ring-white/12 hover:bg-white/[0.05]"
              )}
            >
              <div className="flex size-11 items-center justify-center rounded-sm ring ring-white/8 bg-white/[0.03] transition-colors group-hover:bg-white/[0.06]">
                <Plus className="size-5 text-white/55 group-hover:text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-white">
                  Blank entry
                </div>
                <div className="mt-1 text-xs text-white/45">
                  Open a clean editor and build from scratch.
                </div>
              </div>
              <ChevronRight className="size-4 text-white/25 transition-colors group-hover:text-white/55" />
            </button>
          </div>

          <Separator />

          <div className="px-6 py-3">
            <h3 className="text-xs font-semibold tracking-wide text-white/70">
              Templates
            </h3>
          </div>
          <Separator />

          <div className="px-6 py-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search templates..."
                className="h-10 rounded-sm ring-white/8 bg-white/[0.03] pl-9 text-sm text-white placeholder:text-white/30"
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => setSelectedCategory(null)}
                className={cn(
                  "h-8 rounded-sm ring px-3 text-xs font-medium ",
                  selectedCategory === null
                    ? "ring-white/10 bg-white/[0.08] text-white hover:bg-white/[0.12]"
                    : "ring-white/8 bg-white/[0.03] text-white/65 hover:bg-white/[0.06] hover:text-white"
                )}
              >
                All
              </Button>
              {(
                Object.entries(categoryConfig) as Array<
                  [
                    JournalTemplateCategory,
                    (typeof categoryConfig)[JournalTemplateCategory]
                  ]
                >
              ).map(([key, config]) => {
                const Icon = config.icon;
                return (
                  <Button
                    key={key}
                    size="sm"
                    onClick={() => setSelectedCategory(key)}
                    className={cn(
                      "h-8 gap-1.5 rounded-sm ring px-3 text-xs font-medium ",
                      selectedCategory === key
                        ? "ring-white/10 bg-white/[0.08] text-white hover:bg-white/[0.12]"
                        : "ring-white/8 bg-white/[0.03] text-white/65 hover:bg-white/[0.06] hover:text-white"
                    )}
                  >
                    <Icon className="size-3.5" />
                    {config.label}
                  </Button>
                );
              })}
            </div>
          </div>

          <Separator />

          <ScrollArea className="min-h-0 flex-1 px-6 py-5">
            <div className="grid grid-cols-1 gap-3 pb-1 sm:grid-cols-2 px-0.5 py-2">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton
                    key={i}
                    className="h-36 rounded-sm bg-sidebar-accent"
                  />
                ))
              ) : allTemplates.length === 0 ? (
                <div className="py-12 text-center text-sm text-white/40 sm:col-span-2">
                  {search
                    ? "No templates match your search"
                    : "No templates found"}
                </div>
              ) : (
                allTemplates.map((template) => {
                  const category =
                    categoryConfig[
                      template.category as keyof typeof categoryConfig
                    ] || categoryConfig.custom;
                  const Icon = category.icon;
                  const isSystem =
                    "id" in template &&
                    systemTemplates.some((t) => t.id === template.id);

                  return (
                    <button
                      key={template.id}
                      onClick={() => handleSelectTemplate(template)}
                      className={cn(
                        TRADE_SURFACE_CARD_CLASS,
                        "group flex flex-col items-center ring ring-white/8 p-4 text-left transition-colors hover:ring-white/12 hover:bg-white/[0.05]"
                      )}
                    >
                      <div className="flex w-full items-center gap-3">
                        <div className="text-3xl leading-none">
                          {template.emoji || "📄"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-white">
                            {template.name}
                          </div>
                          <div className="mt-1 line-clamp-3 text-xs leading-5 text-white/40">
                            {template.description || "No description"}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-sm ring-white/10 text-[11px]",
                            category.color
                          )}
                        >
                          <Icon className="mr-1 size-3" />
                          {category.label}
                        </Badge>
                        {isSystem ? (
                          <Badge
                            variant="outline"
                            className="rounded-sm ring-white/10 text-[11px] text-white/40"
                          >
                            Built-in
                          </Badge>
                        ) : null}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============================================================================
// Save as Template Dialog
// ============================================================================

interface SaveTemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  entryTitle: string;
  entryContent: any[];
  onSaved: () => void;
}

export function SaveTemplateDialog({
  isOpen,
  onClose,
  entryTitle,
  entryContent,
  onSaved,
}: SaveTemplateDialogProps) {
  const [name, setName] = useState(entryTitle || "My Template");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<JournalTemplateCategory>("custom");
  const [emoji, setEmoji] = useState("📄");

  const createTemplate = trpc.journal.createTemplate.useMutation({
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });

  const handleSave = () => {
    createTemplate.mutate({
      name,
      description: description || undefined,
      emoji,
      content: entryContent,
      category,
    });
  };

  const commonEmojis = [
    "📄",
    "📅",
    "📊",
    "🎯",
    "📝",
    "💡",
    "🔥",
    "✨",
    "📈",
    "🏆",
    "⚖️",
    "🧪",
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex flex-col gap-0 overflow-hidden rounded-md ring ring-white/5 bg-sidebar/5 p-2 shadow-2xl backdrop-blur-lg max-w-md"
      >
        <div className="flex flex-col gap-0 overflow-hidden rounded-sm ring ring-white/5 bg-sidebar-accent/80">
          {/* Header */}
          <div className="flex items-start gap-3 px-5 py-4 shrink-0">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md ring ring-white/5 bg-sidebar-accent">
              <FileText className="h-3.5 w-3.5 text-white/60" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-white">
                Save as Template
              </div>
              <p className="mt-1 text-xs leading-relaxed text-white/40">
                Create a reusable template from this entry
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
          <div className="space-y-4 px-5 py-4">
            {/* Emoji picker */}
            <div>
              <label className="text-sm text-white/60 mb-2 block">Icon</label>
              <div className="flex gap-1 flex-wrap">
                {commonEmojis.map((e) => (
                  <button
                    key={e}
                    onClick={() => setEmoji(e)}
                    className={cn(
                      "text-xl p-1.5 rounded transition-colors",
                      emoji === e
                        ? "bg-teal-500/20 ring-1 ring-teal-500"
                        : "hover:bg-white/5"
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="text-sm text-white/60 mb-2 block">
                Template Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Template"
                className="bg-sidebar-accent ring-white/10 text-white"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-sm text-white/60 mb-2 block">
                Description
              </label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this template for?"
                className="bg-sidebar-accent ring-white/10 text-white"
              />
            </div>

            {/* Category */}
            <div>
              <label className="text-sm text-white/60 mb-2 block">
                Category
              </label>
              <div className="flex gap-2 flex-wrap">
                {(
                  Object.entries(categoryConfig) as Array<
                    [
                      JournalTemplateCategory,
                      (typeof categoryConfig)[JournalTemplateCategory]
                    ]
                  >
                ).map(([key, config]) => {
                  const Icon = config.icon;
                  return (
                    <Button
                      key={key}
                      variant={category === key ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCategory(key)}
                      className={cn(
                        category === key
                          ? "bg-teal-500 hover:bg-teal-600"
                          : "ring-white/10 text-white/60 hover:text-white"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 mr-1.5" />
                      {config.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
          <Separator />
          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 py-3 shrink-0">
            <Button
              className="cursor-pointer flex items-center justify-center gap-2 rounded-sm ring ring-white/5 bg-sidebar px-3 py-2 h-9 text-xs text-white/70 transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 shadow-none"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!name.trim() || createTemplate.isPending}
              className="cursor-pointer flex items-center justify-center gap-2 rounded-sm ring ring-white/5 bg-sidebar px-3 py-2 h-9 text-xs text-white transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 shadow-none"
            >
              {createTemplate.isPending ? "Saving..." : "Save Template"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
