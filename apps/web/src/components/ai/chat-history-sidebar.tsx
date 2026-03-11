"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import {
  Search,
  MessageSquare,
  Plus,
  Trash2,
  Loader2,
  ChevronLeft,
  History,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpcOptions } from "@/utils/trpc";
import { useDebouncedCallback } from "use-debounce";

interface ChatHistorySidebarProps {
  accountId?: string;
  onSelectReport: (reportId: string) => void;
  onNewChat: () => void;
  currentReportId?: string | null;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export function ChatHistorySidebar({
  accountId,
  onSelectReport,
  onNewChat,
  currentReportId,
  isOpen,
  onClose,
  className,
}: ChatHistorySidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: reportsData, isLoading } = useQuery({
    ...trpcOptions.ai.getReports.queryOptions({
      limit: 50,
      accountId,
    }),
  });

  const reports = reportsData?.items || [];

  const filteredReports = reports.filter((report) =>
    report.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSearchChange = useDebouncedCallback((value: string) => {
    setSearchQuery(value);
  }, 300);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleSearchChange(e.target.value);
  };

  const groupedReports = groupReportsByDate(filteredReports);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: -320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -320, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className={cn(
            "w-80 h-full border-r border-white/5 bg-sidebar flex flex-col",
            className
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-white/70" />
              <span className="text-sm font-medium text-white/90">Chat History</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 text-white/50 hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>

          {/* Search */}
          <div className="px-4 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <Input
                placeholder="Search conversations..."
                onChange={handleInputChange}
                className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-white/20"
              />
            </div>
          </div>

          {/* New Chat Button */}
          <div className="px-4 pb-3">
            <Button
              variant="outline"
              onClick={onNewChat}
              className="w-full justify-start gap-2 bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:text-white"
            >
              <Plus className="w-4 h-4" />
              New Chat
            </Button>
          </div>

          {/* Reports List */}
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-white/40" />
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <MessageSquare className="w-10 h-10 text-white/20 mb-3" />
                <p className="text-sm text-white/50">
                  {searchQuery ? "No conversations found" : "No chat history yet"}
                </p>
                <p className="text-xs text-white/30 mt-1">
                  Start a conversation to see it here
                </p>
              </div>
            ) : (
              <div className="px-2 space-y-4 pb-4">
                {Object.entries(groupedReports).map(([group, groupReports]) => (
                  <div key={group}>
                    <p className="text-xs font-medium text-white/40 uppercase tracking-wider px-2 mb-2">
                      {group}
                    </p>
                    <div className="space-y-1">
                      {groupReports.map((report) => (
                        <button
                          key={report.id}
                          onClick={() => onSelectReport(report.id)}
                          className={cn(
                            "w-full text-left px-3 py-2.5 rounded-lg transition-colors",
                            "hover:bg-white/5",
                            currentReportId === report.id
                              ? "bg-white/10 border border-white/10"
                              : "border border-transparent"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white/80 truncate">
                                {report.title}
                              </p>
                              <p className="text-xs text-white/40 mt-0.5">
                                {formatDistanceToNow(new Date(report.updatedAt), {
                                  addSuffix: true,
                                })}
                              </p>
                            </div>
                            {currentReportId === report.id && (
                              <div className="w-2 h-2 rounded-full bg-purple-500 mt-1.5" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function groupReportsByDate(
  reports: Array<{ id: string; title: string; updatedAt: Date | string; createdAt: Date | string }>
): Record<string, typeof reports> {
  const groups: Record<string, typeof reports> = {};
  const now = new Date();

  reports.forEach((report) => {
    const date = new Date(report.updatedAt);
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    let group: string;
    if (diffDays === 0) {
      group = "Today";
    } else if (diffDays === 1) {
      group = "Yesterday";
    } else if (diffDays < 7) {
      group = "This Week";
    } else if (diffDays < 30) {
      group = "This Month";
    } else {
      group = "Older";
    }

    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(report);
  });

  return groups;
}
