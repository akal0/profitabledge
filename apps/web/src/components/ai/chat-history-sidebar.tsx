"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import {
  Search,
  MessageSquare,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ChevronLeft,
  History,
  MoreHorizontal,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VerticalSeparator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { trpcClient, trpcOptions } from "@/utils/trpc";
import { useDebouncedCallback } from "use-debounce";

interface ChatHistorySidebarProps {
  accountId?: string;
  userImage?: string | null;
  userName?: string | null;
  onSelectReport: (reportId: string) => void;
  onNewChat: () => void;
  currentReportId?: string | null;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export function ChatHistorySidebar({
  accountId,
  userImage,
  userName,
  onSelectReport,
  onNewChat,
  currentReportId,
  isOpen,
  onClose,
  className,
}: ChatHistorySidebarProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInputValue, setSearchInputValue] = useState("");
  const [renameReportId, setRenameReportId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteReportId, setDeleteReportId] = useState<string | null>(null);
  const reportsQueryKey = trpcOptions.ai.getReports.queryOptions({
    limit: 50,
    accountId,
  }).queryKey;

  const { data: reportsData, isLoading } = useQuery({
    ...trpcOptions.ai.getReports.queryOptions({
      limit: 50,
      accountId,
    }),
    staleTime: 15_000,
  });

  const reports = reportsData?.items || [];

  const filteredReports = reports.filter((report) =>
    report.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSearchChange = useDebouncedCallback((value: string) => {
    setSearchQuery(value);
  }, 300);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInputValue(e.target.value);
    handleSearchChange(e.target.value);
  };

  const renameReportMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) =>
      trpcClient.ai.updateReport.mutate({ id, title }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: reportsQueryKey });
      toast.success("Conversation renamed");
      setRenameReportId(null);
      setRenameValue("");
    },
    onError: () => {
      toast.error("Could not rename that conversation.");
    },
  });

  const deleteReportMutation = useMutation({
    mutationFn: async (id: string) => trpcClient.ai.deleteReport.mutate({ id }),
    onSuccess: async (_, deletedReportId) => {
      await queryClient.invalidateQueries({ queryKey: reportsQueryKey });
      if (currentReportId === deletedReportId) {
        onNewChat();
      }
      toast.success("Conversation deleted");
      setDeleteReportId(null);
    },
    onError: () => {
      toast.error("Could not delete that conversation.");
    },
  });

  const activeDeleteReport =
    reports.find((report) => report.id === deleteReportId) ?? null;

  const groupedReports = groupReportsByDate(filteredReports);

  const handleRenameSubmit = async () => {
    const title = renameValue.trim();
    if (!renameReportId || !title) {
      toast.error("Enter a title before saving.");
      return;
    }

    await renameReportMutation.mutateAsync({
      id: renameReportId,
      title,
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: -320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -320, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className={cn("z-20 flex h-full shrink-0", className)}
        >
          <div className="flex h-full w-80 flex-col bg-sidebar/95">
            {/* Header */}
            <div className="flex items-center justify-between ring-b ring-white/5 px-4 py-3">
              <div className="flex items-center gap-2">
                {userImage ? (
                  <Image
                    src={userImage}
                    alt={userName || "You"}
                    width={20}
                    height={20}
                    className="h-5 w-5 rounded-full object-cover ring-1 ring-white/10"
                  />
                ) : (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/8 text-[10px] font-medium text-white/70 ring-1 ring-white/10">
                    {(userName || "Y").charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-medium text-white/90">
                  Chat history
                </span>
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
                  value={searchInputValue}
                  onChange={handleInputChange}
                  className="pl-9 bg-white/5 ring-white/10 text-white placeholder:text-white/40 focus:ring-white/20"
                />
              </div>
            </div>

            {/* New Chat Button */}
            <div className="px-4 pb-3">
              <Button
                variant="outline"
                onClick={onNewChat}
                className="w-full justify-start gap-2 bg-white/5 ring-white/10 text-white/80 hover:bg-white/10 hover:text-white text-xs"
              >
                <Plus className="size-3" />
                New chat
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
                  <MessageSquare className="mb-3 h-10 w-10 text-white/20 stroke-1" />
                  <p className="text-sm text-white/50">
                    {searchQuery
                      ? "No conversations found"
                      : "No chat history yet"}
                  </p>
                  <p className="mt-1 text-xs text-white/30">
                    Start a conversation to see it here
                  </p>
                </div>
              ) : (
                <div className="space-y-4 px-2 pb-4">
                  {Object.entries(groupedReports).map(
                    ([group, groupReports]) => (
                      <div key={group}>
                        <p className="mb-2 px-2 text-xs font-medium text-white/40">
                          {group}
                        </p>
                        <div className="space-y-1">
                          {groupReports.map((report) => (
                            <div
                              key={report.id}
                              className={cn(
                                "group flex items-start gap-2 rounded-lg ring transition-colors",
                                "hover:bg-white/5 cursor-pointer",
                                currentReportId === report.id
                                  ? "ring ring-white/10 bg-white/10"
                                  : "ring ring-transparent"
                              )}
                            >
                              <button
                                type="button"
                                onClick={() => onSelectReport(report.id)}
                                className="flex items-start justify-between gap-1.5 px-3 py-2.5 text-left cursor-pointer"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium text-white/80">
                                    {report.title}
                                  </p>
                                  <p className="mt-0.5 text-xs text-white/40">
                                    {formatDistanceToNow(
                                      new Date(report.updatedAt),
                                      {
                                        addSuffix: true,
                                      }
                                    )}
                                  </p>
                                </div>
                                {currentReportId === report.id && (
                                  <div className="mt-2 size-1 rounded-full bg-teal-400 animate-pulse" />
                                )}
                              </button>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-4 mt-1 h-8 w-8 shrink-0 text-white/35 opacity-0 transition-opacity hover:text-white group-hover:opacity-100 data-[state=open]:opacity-100"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  className="w-44 rounded-sm ring ring-white/10 bg-sidebar"
                                >
                                  <DropdownMenuItem
                                    className="text-sm text-white/80 focus:bg-sidebar-accent focus:text-white"
                                    onClick={() => {
                                      setRenameReportId(report.id);
                                      setRenameValue(report.title);
                                    }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                    Rename
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-sm text-rose-300 focus:bg-rose-500/10 focus:text-rose-200"
                                    onClick={() => {
                                      setDeleteReportId(report.id);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </ScrollArea>
          </div>

          <VerticalSeparator className="shrink-0" />

          <Dialog
            open={Boolean(renameReportId)}
            onOpenChange={(open) => {
              if (!open) {
                setRenameReportId(null);
                setRenameValue("");
              }
            }}
          >
            <DialogContent className="ring-white/10 bg-sidebar sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-white">
                  Rename conversation
                </DialogTitle>
                <DialogDescription className="text-white/45">
                  Give this analysis thread a clearer label so it is easier to
                  find later.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label
                  htmlFor="assistant-report-title"
                  className="text-white/70"
                >
                  Title
                </Label>
                <Input
                  id="assistant-report-title"
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleRenameSubmit();
                    }
                  }}
                  placeholder="Untitled conversation"
                  className="ring-white/10 bg-white/5 text-white placeholder:text-white/30"
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  className="ring-white/10 bg-transparent text-white/70 hover:bg-white/5 hover:text-white"
                  onClick={() => {
                    setRenameReportId(null);
                    setRenameValue("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="bg-white text-black hover:bg-white/90"
                  disabled={renameReportMutation.isPending}
                  onClick={() => {
                    void handleRenameSubmit();
                  }}
                >
                  {renameReportMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog
            open={Boolean(deleteReportId)}
            onOpenChange={(open) => {
              if (!open) {
                setDeleteReportId(null);
              }
            }}
          >
            <AlertDialogContent className="ring-white/10 bg-sidebar">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white">
                  Delete conversation
                </AlertDialogTitle>
                <AlertDialogDescription className="text-white/45">
                  {activeDeleteReport
                    ? `Delete "${activeDeleteReport.title}" and its saved messages? This cannot be undone.`
                    : "Delete this saved conversation and its messages? This cannot be undone."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="ring-white/10 bg-transparent text-white/70 hover:bg-white/5 hover:text-white">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  className="bg-rose-500 text-white hover:bg-rose-500/90"
                  onClick={(event) => {
                    event.preventDefault();
                    if (deleteReportId) {
                      void deleteReportMutation.mutateAsync(deleteReportId);
                    }
                  }}
                >
                  {deleteReportMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function groupReportsByDate(
  reports: Array<{
    id: string;
    title: string;
    updatedAt: Date | string;
    createdAt: Date | string;
  }>
): Record<string, typeof reports> {
  const groups: Record<string, typeof reports> = {};
  const now = new Date();

  reports.forEach((report) => {
    const date = new Date(report.updatedAt);
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

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
