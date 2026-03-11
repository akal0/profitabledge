"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Home,
  LineChart,
  Settings,
  Bell,
  Target,
  Trophy,
  Calculator,
  FileText,
  BarChart3,
  TrendingUp,
  Wallet,
  Shield,
  Zap,
  Clock,
  Star,
  Newspaper,
  Rss,
  Copy,
  Sparkles,
  MoreHorizontal,
  Brain,
  Loader2,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Cmd from "@/public/graphics/cmd.svg";
import { trpc } from "@/utils/trpc";
import { useAccountStore } from "@/stores/account";

interface CommandPaletteProps {
  className?: string;
}

type CategoryFilter =
  | "all"
  | "pages"
  | "tools"
  | "actions"
  | "community"
  | "settings";

const categoryFilters: {
  label: string;
  value: CategoryFilter;
  icon: LucideIcon;
}[] = [
  { label: "Pages", value: "pages", icon: Home },
  { label: "Tools", value: "tools", icon: Calculator },
  { label: "Community", value: "community", icon: Rss },
  { label: "Actions", value: "actions", icon: Zap },
  { label: "Settings", value: "settings", icon: Settings },
];

type ResultItem = {
  icon: LucideIcon;
  label: string;
  subtitle: string;
  shortcut?: string;
  href: string;
  key: string;
  category: CategoryFilter;
  iconColor: string;
  iconBg: string;
};

const allResults: ResultItem[] = [
  // Pages
  {
    icon: Home,
    label: "Dashboard",
    subtitle: "Pages  ·  Overview",
    shortcut: "⌘D",
    href: "/dashboard",
    key: "d",
    category: "pages",
    iconColor: "text-blue-400",
    iconBg: "bg-blue-500/10",
  },
  {
    icon: LineChart,
    label: "Trades",
    subtitle: "Pages  ·  Trade history & analysis",
    shortcut: "⌘T",
    href: "/dashboard/trades",
    key: "t",
    category: "pages",
    iconColor: "text-emerald-400",
    iconBg: "bg-emerald-500/10",
  },
  {
    icon: Wallet,
    label: "Accounts",
    subtitle: "Pages  ·  Manage trading accounts",
    shortcut: "⌘A",
    href: "/dashboard/accounts",
    key: "a",
    category: "pages",
    iconColor: "text-violet-400",
    iconBg: "bg-violet-500/10",
  },
  {
    icon: FileText,
    label: "Journal",
    subtitle: "Pages  ·  Trade journal entries",
    shortcut: "⌘J",
    href: "/dashboard/journal",
    key: "j",
    category: "pages",
    iconColor: "text-amber-400",
    iconBg: "bg-amber-500/10",
  },
  {
    icon: BarChart3,
    label: "Backtest",
    subtitle: "Pages  ·  Strategy backtesting",
    href: "/backtest",
    key: "",
    category: "pages",
    iconColor: "text-cyan-400",
    iconBg: "bg-cyan-500/10",
  },
  {
    icon: Trophy,
    label: "Prop Tracker",
    subtitle: "Pages  ·  Prop firm challenge tracking",
    shortcut: "⌘P",
    href: "/dashboard/prop-tracker",
    key: "p",
    category: "pages",
    iconColor: "text-yellow-400",
    iconBg: "bg-yellow-500/10",
  },
  // Community
  {
    icon: Rss,
    label: "Feed",
    subtitle: "Community  ·  Social trading feed",
    shortcut: "⌘F",
    href: "/dashboard/feed",
    key: "f",
    category: "community",
    iconColor: "text-orange-400",
    iconBg: "bg-orange-500/10",
  },
  {
    icon: TrendingUp,
    label: "Leaderboard",
    subtitle: "Community  ·  Top traders ranking",
    shortcut: "⌘L",
    href: "/dashboard/leaderboard",
    key: "l",
    category: "community",
    iconColor: "text-green-400",
    iconBg: "bg-green-500/10",
  },
  {
    icon: Newspaper,
    label: "News",
    subtitle: "Community  ·  Market news & updates",
    shortcut: "⌘N",
    href: "/dashboard/news",
    key: "n",
    category: "community",
    iconColor: "text-slate-400",
    iconBg: "bg-slate-500/10",
  },
  // Tools
  {
    icon: Copy,
    label: "Trade Copier",
    subtitle: "Tools  ·  Copy trades across accounts",
    shortcut: "⌘C",
    href: "/dashboard/copier",
    key: "c",
    category: "tools",
    iconColor: "text-indigo-400",
    iconBg: "bg-indigo-500/10",
  },
  {
    icon: Target,
    label: "Goals",
    subtitle: "Tools  ·  Set & track trading goals",
    shortcut: "⌘G",
    href: "/dashboard/goals",
    key: "g",
    category: "tools",
    iconColor: "text-rose-400",
    iconBg: "bg-rose-500/10",
  },
  {
    icon: Shield,
    label: "Rules",
    subtitle: "Tools  ·  Trading rules & discipline",
    shortcut: "⌘U",
    href: "/dashboard/rules",
    key: "u",
    category: "tools",
    iconColor: "text-teal-400",
    iconBg: "bg-teal-500/10",
  },
  {
    icon: Sparkles,
    label: "AI Assistant",
    subtitle: "Tools  ·  AI-powered trade analysis",
    href: "/assistant",
    key: "",
    category: "tools",
    iconColor: "text-purple-400",
    iconBg: "bg-purple-500/10",
  },
  // Settings
  {
    icon: Settings,
    label: "Preferences",
    subtitle: "Settings  ·  App configuration",
    shortcut: "⌘,",
    href: "/dashboard/settings",
    key: ",",
    category: "settings",
    iconColor: "text-neutral-400",
    iconBg: "bg-neutral-500/10",
  },
  {
    icon: Bell,
    label: "Alerts",
    subtitle: "Settings  ·  Notification preferences",
    shortcut: "⌘B",
    href: "/dashboard/settings/alerts",
    key: "b",
    category: "settings",
    iconColor: "text-red-400",
    iconBg: "bg-red-500/10",
  },
  // Actions
  {
    icon: Zap,
    label: "New Trade",
    subtitle: "Action  ·  Log a new trade entry",
    shortcut: "⌘N T",
    href: "/dashboard/trades?new=true",
    key: "",
    category: "actions",
    iconColor: "text-yellow-400",
    iconBg: "bg-yellow-500/10",
  },
  {
    icon: Star,
    label: "Add to Watchlist",
    subtitle: "Action  ·  Watch a new symbol",
    shortcut: "⌘N W",
    href: "/dashboard?widget=watchlist",
    key: "",
    category: "actions",
    iconColor: "text-amber-400",
    iconBg: "bg-amber-500/10",
  },
  {
    icon: Clock,
    label: "Recent Trades",
    subtitle: "Action  ·  View latest trades",
    shortcut: "⌘N R",
    href: "/dashboard/trades",
    key: "",
    category: "actions",
    iconColor: "text-sky-400",
    iconBg: "bg-sky-500/10",
  },
];

// Reusable kbd style matching NavUser's ⌘O button
const kbdClass =
  "inline-flex items-center justify-center gap-1 shadow-primary-button rounded-[6px] bg-sidebar-accent text-white text-[10px] h-max py-1 px-1.5";

/** Strip markdown syntax for clean inline display */
function cleanMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/\*\*(.+?)\*\*/g, "$1") // bold
    .replace(/\*(.+?)\*/g, "$1") // italic
    .replace(/`(.+?)`/g, "$1") // inline code
    .replace(/\n{3,}/g, "\n\n") // collapse extra newlines
    .trim();
}

function looksLikeQuestion(input: string): boolean {
  if (!input || input.length < 3) return false;
  if (input.includes("?")) return true;
  const lower = input.toLowerCase().trim();
  if (
    /^(what|how|why|show|compare|when|where|which|who|tell|give|list|am i|do i|is my|are my|what's|how's)/.test(
      lower
    )
  )
    return true;
  if (lower.length > 20) return true;
  return false;
}

export function CommandPalette({ className }: CommandPaletteProps) {
  const [open, setOpen] = React.useState(false);
  const [activeFilter, setActiveFilter] = React.useState<CategoryFilter>("all");
  const [searchValue, setSearchValue] = React.useState("");
  const [aiAnswer, setAiAnswer] = React.useState<{
    answer: string;
    data?: any;
  } | null>(null);
  const router = useRouter();
  const { selectedAccountId } = useAccountStore();

  const quickQuery = (trpc as any).ai.quickQuery.useMutation({
    onSuccess: (data: any) => {
      setAiAnswer({ answer: data.answer, data: data.data });
    },
  });

  const showAiOption = looksLikeQuestion(searchValue) && !aiAnswer;
  const hasExactMatch = allResults.some(
    (r) => r.label.toLowerCase() === searchValue.toLowerCase().trim()
  );

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modifierKey = isMac ? e.metaKey : e.ctrlKey;

      if (modifierKey) {
        if (e.key === "k" || e.key === "s") {
          e.preventDefault();
          setOpen((prev) => !prev);
          return;
        }
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false);
    setActiveFilter("all");
    setSearchValue("");
    setAiAnswer(null);
    command();
  }, []);

  React.useEffect(() => {
    if (!open) {
      setActiveFilter("all");
      setSearchValue("");
      setAiAnswer(null);
    }
  }, [open]);

  const filteredResults =
    activeFilter === "all"
      ? allResults
      : allResults.filter((r) => r.category === activeFilter);

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      className={cn(
        "max-w-[928px]!",
        "[&_[data-slot=dialog-content]]:max-w-[928]! w-full",
        "[&_[data-slot=dialog-content]]:p-0",
        "[&_[data-slot=dialog-content]]:bg-[#161618]",
        "[&_[data-slot=dialog-content]]:border-white/[0.08]",
        "[&_[data-slot=dialog-content]]:rounded-2xl",
        "[&_[data-slot=dialog-content]]:shadow-2xl",
        "[&_[data-slot=dialog-content]]:overflow-hidden",
        "[&_[data-slot=dialog-overlay]]:bg-black/70",
        className
      )}
      showCloseButton={false}
    >
      <div className="flex flex-col">
        {/* Search Input */}
        <div className="flex items-center gap-3 py-1 border-b border-white/[0.06]">
          {/* <div className={kbdClass}>
            <Cmd className="size-2.5 stroke-white fill-transparent" />
          </div> */}
          <CommandInput
            placeholder="Search anything or ask a question..."
            value={searchValue}
            onValueChange={(v) => {
              setSearchValue(v);
              setAiAnswer(null);
            }}
            className="h-max text-[15px] border-none! bg-transparent px-0 placeholder:text-white/30 min-w-128! ring-0 "
          />
          {/* <div className={cn(kbdClass, "px-2.5 shrink-0")}>
            <span>RETURN</span>
          </div> */}
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.06] overflow-x-auto">
          {categoryFilters.map((filter) => {
            const Icon = filter.icon;
            return (
              <button
                key={filter.value}
                onClick={() =>
                  setActiveFilter(
                    activeFilter === filter.value ? "all" : filter.value
                  )
                }
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-150 cursor-pointer border whitespace-nowrap",
                  activeFilter === filter.value
                    ? "bg-white/[0.08] text-white/90 border-white/[0.12]"
                    : "text-white/40 border-white/[0.06] hover:text-white/60 hover:border-white/[0.1] hover:bg-white/[0.03]"
                )}
              >
                <Icon className="size-3.5" strokeWidth={1.5} />
                {filter.label}
              </button>
            );
          })}
          <button className="flex items-center justify-center size-8 rounded-lg text-white/30 border border-white/[0.06] hover:text-white/50 hover:border-white/[0.1] hover:bg-white/[0.03] transition-all duration-150 cursor-pointer shrink-0">
            <MoreHorizontal className="size-3.5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Section Label */}
        <div className="px-5 pt-3.5 pb-1">
          <span className="text-[12px] text-white/30 font-medium">
            {activeFilter === "all"
              ? "Recent results:"
              : `${
                  categoryFilters.find((f) => f.value === activeFilter)
                    ?.label ?? "Results"
                }:`}
          </span>
        </div>

        {/* Results */}
        <CommandList className="max-h-[420px] bg-transparent px-2 pb-2">
          <CommandEmpty className="py-12 text-center text-white/25 text-sm">
            {looksLikeQuestion(searchValue) ? (
              <div className="flex flex-col items-center gap-3">
                <Brain className="size-8 text-teal-400/40" strokeWidth={1.5} />
                <span>No matching pages. Press Enter to ask AI.</span>
              </div>
            ) : (
              "No results found."
            )}
          </CommandEmpty>

          {/* AI Answer Card */}
          {aiAnswer && (
            <div className="mx-1 mb-2 rounded-xl bg-teal-500/[0.05] border border-teal-500/[0.12] overflow-hidden">
              <div className="px-4 py-3.5">
                <p className="text-[13px] text-white/70 leading-[1.6] whitespace-pre-line">
                  {cleanMarkdown(aiAnswer.answer)}
                </p>
              </div>
              <div className="px-4 py-2 border-t border-teal-500/[0.08] flex items-center justify-end">
                <button
                  onClick={() =>
                    runCommand(() =>
                      router.push(
                        `/assistant?q=${encodeURIComponent(searchValue)}`
                      )
                    )
                  }
                  className="flex items-center gap-1.5 text-[12px] text-teal-400 hover:text-teal-300 transition-colors cursor-pointer"
                >
                  Explore further
                  <ArrowRight className="size-3" strokeWidth={2} />
                </button>
              </div>
            </div>
          )}

          {/* AI Loading State */}
          {quickQuery.isPending && (
            <div className="mx-1 mb-2 p-4 rounded-xl bg-teal-500/[0.05] border border-teal-500/[0.12]">
              <div className="flex items-center gap-3">
                <Loader2
                  className="size-4 text-teal-400 animate-spin"
                  strokeWidth={2}
                />
                <span className="text-[13px] text-white/40">
                  Analyzing your trades...
                </span>
              </div>
            </div>
          )}

          {/* Ask AI Option */}
          {showAiOption && !hasExactMatch && !quickQuery.isPending && (
            <CommandItem
              value={`ai ask ${searchValue}`}
              onSelect={() => {
                if (selectedAccountId) {
                  quickQuery.mutate({
                    message: searchValue,
                    accountId: selectedAccountId,
                  });
                } else {
                  runCommand(() =>
                    router.push(
                      `/assistant?q=${encodeURIComponent(searchValue)}`
                    )
                  );
                }
              }}
              className="group/item mx-1 px-3 py-3 rounded-xl aria-selected:bg-teal-500/[0.06] text-white/70 data-[selected=true]:bg-teal-500/[0.06] cursor-pointer flex items-center gap-4 text-sm mb-1"
              forceMount
            >
              <div className="flex items-center justify-center size-10 rounded-xl border border-teal-500/[0.12] bg-teal-500/10 shrink-0">
                <Brain
                  className="size-[18px] text-teal-400"
                  strokeWidth={1.5}
                />
              </div>
              <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                <span className="font-semibold text-[14px] text-teal-300 truncate">
                  Ask AI: &quot;{searchValue}&quot;
                </span>
                <span className="text-[12px] text-white/30 truncate">
                  Get an instant AI-powered answer
                </span>
              </div>
              <span className={cn(kbdClass, "px-2 shrink-0")}>RETURN</span>
            </CommandItem>
          )}

          {filteredResults.map((item, idx) => (
            <CommandItem
              key={`${item.category}-${item.label}`}
              value={`${item.category} ${item.label} ${item.subtitle}`}
              onSelect={() => runCommand(() => router.push(item.href))}
              className="group/item mx-1 px-3 py-3 rounded-xl aria-selected:bg-white/[0.04] text-white/70 data-[selected=true]:bg-white/[0.04] cursor-pointer flex items-center gap-4 text-sm"
            >
              {/* Icon */}
              <div
                className={cn(
                  "flex items-center justify-center size-10 rounded-xl border border-white/[0.06] shrink-0",
                  item.iconBg
                )}
              >
                <item.icon
                  className={cn("size-[18px]", item.iconColor)}
                  strokeWidth={1.5}
                />
              </div>

              {/* Text */}
              <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                <span className="font-semibold text-[14px] text-white/90 truncate">
                  {item.label}
                </span>
                <span className="text-[12px] text-white/30 truncate">
                  {item.subtitle}
                </span>
              </div>

              {/* Number */}
              <span className="text-white/15 text-[13px] font-medium tabular-nums shrink-0 w-5 text-right">
                {idx + 1}
              </span>
            </CommandItem>
          ))}
        </CommandList>

        {/* Footer with keyboard hints */}
        <div className="flex items-center px-5 py-2.5 border-t border-white/[0.06] gap-5">
          <span className="flex items-center gap-1.5 text-[11px] text-white/25">
            <span className={kbdClass}>↑</span>
            <span className={kbdClass}>↓</span>
            <span className="ml-0.5">Navigate</span>
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-white/25">
            <span className={cn(kbdClass, "px-2")}>RETURN</span>
            <span className="ml-0.5">Open</span>
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-white/25">
            <span className={cn(kbdClass, "px-2")}>TAB</span>
            <span className="ml-0.5">Actions</span>
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-white/25">
            <span className={kbdClass}>/</span>
            <span className="ml-0.5">Guide</span>
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-white/25">
            <span className={cn(kbdClass, "px-2")}>ESC</span>
            <span className="ml-0.5">Close</span>
          </span>
        </div>
      </div>
    </CommandDialog>
  );
}

export function useCommandPalette() {
  return {
    open: () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", metaKey: true })
      );
    },
  };
}
