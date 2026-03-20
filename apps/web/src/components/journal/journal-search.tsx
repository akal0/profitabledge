"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  X,
  FileText,
  Clock,
  Calendar,
  ArrowRight,
  Brain,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";

interface JournalSearchProps {
  onSelectEntry?: (entryId: string) => void;
  accountId?: string;
  className?: string;
}

export function JournalSearch({
  onSelectEntry,
  accountId,
  className,
}: JournalSearchProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2) {
        setDebouncedQuery(query);
      } else {
        setDebouncedQuery("");
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, isLoading } = trpc.journal.search.useQuery(
    { query: debouncedQuery, limit: 10, accountId },
    { enabled: debouncedQuery.length >= 2 }
  );

  const handleSelectEntry = (entryId: string) => {
    setIsOpen(false);
    setQuery("");
    if (onSelectEntry) {
      onSelectEntry(entryId);
    } else {
      router.push(`/dashboard/journal?entryId=${entryId}`);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search journal..."
          className="pl-9 pr-8 bg-sidebar-accent ring-white/10 text-white placeholder:text-white/30"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setIsOpen(false);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-white/40 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-sidebar ring ring-white/10 shadow-xl z-50 max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 bg-sidebar-accent" />
              ))}
            </div>
          ) : results && results.length > 0 ? (
            <div className="divide-y divide-white/5">
              {results.map((result: any) => (
                <SearchResult
                  key={result.id}
                  result={result}
                  query={query}
                  onSelect={() => handleSelectEntry(result.id)}
                />
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <Search className="h-8 w-8 text-white/20 mx-auto mb-2" />
              <p className="text-sm text-white/40">No results for "{query}"</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface SearchResultProps {
  result: {
    id: string;
    title: string;
    emoji?: string | null;
    entryType: string | null;
    journalDate?: Date | string | null;
    aiSummary?: string | null;
    plainTextContent?: string | null;
    highlightedText?: string;
    updatedAt: Date | string;
  };
  query: string;
  onSelect: () => void;
}

function SearchResult({ result, query, onSelect }: SearchResultProps) {
  const timeAgo = formatDistanceToNow(new Date(result.updatedAt), {
    addSuffix: true,
  });
  const displayText =
    result.highlightedText || result.aiSummary || result.plainTextContent;

  return (
    <button
      onClick={onSelect}
      className="w-full p-4 text-left hover:bg-white/5 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-8 h-8 bg-sidebar-accent text-white/60 flex-shrink-0">
          {result.emoji ? (
            <span>{result.emoji}</span>
          ) : (
            <FileText className="h-4 w-4" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-white truncate">
              {result.title}
            </p>
            {result.entryType && result.entryType !== "general" && (
              <Badge
                variant="outline"
                className="text-xs ring-white/10 text-white/40"
              >
                {result.entryType}
              </Badge>
            )}
          </div>
          {displayText && (
            <p
              className="text-xs text-white/60 mt-1 line-clamp-2"
              dangerouslySetInnerHTML={{
                __html: displayText.replace(
                  new RegExp(`(${query})`, "gi"),
                  '<mark class="bg-teal-500/30 text-teal-300 px-0.5 rounded">$1</mark>'
                ),
              }}
            />
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-white/30">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeAgo}
            </span>
            {result.journalDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(result.journalDate), "MMM d, yyyy")}
              </span>
            )}
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-white/20 flex-shrink-0 mt-2" />
      </div>
    </button>
  );
}

export function JournalSearchDialog({
  isOpen,
  onClose,
  onSelectEntry,
  accountId,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelectEntry?: (entryId: string) => void;
  accountId?: string;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const router = useRouter();

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  React.useEffect(() => {
    if (!isOpen) {
      setQuery("");
    }
  }, [isOpen]);

  const { data: results, isLoading } = trpc.journal.search.useQuery(
    { query: debouncedQuery, limit: 20, accountId },
    { enabled: debouncedQuery.length >= 2 }
  );

  const handleSelectEntry = (entryId: string) => {
    onClose();
    if (onSelectEntry) {
      onSelectEntry(entryId);
    } else {
      router.push(`/dashboard/journal?entryId=${entryId}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex flex-col gap-0 overflow-hidden rounded-md ring ring-white/5 bg-sidebar/5 p-2 shadow-2xl backdrop-blur-lg max-w-2xl"
      >
        <div className="flex flex-col gap-0 overflow-hidden rounded-sm ring ring-white/5 bg-sidebar-accent/80">
          {/* Header */}
          <div className="flex items-start gap-3 px-5 py-4">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md ring ring-white/5 bg-sidebar-accent">
              <Search className="size-3 text-white/60 z-10 relative" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-white">
                Search journal
              </div>
              <p className="mt-1 text-xs leading-relaxed text-white/40">
                Search entries, insights, and patterns
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

          {/* Search input */}
          <div className="px-5 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3 text-white/40 z-10" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search entries, insights, patterns..."
                className="pl-8 bg-sidebar-accent ring-white/10 text-white placeholder:text-white/30"
                autoFocus
              />
            </div>
          </div>

          <Separator />

          <div className="max-h-96 overflow-y-auto">
            {query.length < 2 ? (
              <div className="p-8 text-center">
                <Brain className="h-8 w-8 text-white/20 mx-auto mb-2" />
                <p className="text-sm text-white/40">
                  Type at least 2 characters to search
                </p>
              </div>
            ) : isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 bg-sidebar-accent" />
                ))}
              </div>
            ) : results && results.length > 0 ? (
              <div className="divide-y divide-white/5">
                {results.map((result: any) => (
                  <SearchResult
                    key={result.id}
                    result={result}
                    query={query}
                    onSelect={() => handleSelectEntry(result.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <Search className="h-8 w-8 text-white/20 mx-auto mb-2" />
                <p className="text-sm text-white/40">
                  No results for "{query}"
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
