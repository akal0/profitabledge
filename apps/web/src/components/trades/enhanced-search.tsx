"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Search, History } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface EnhancedSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchableFields?: string[];
  className?: string;
}

const SEARCH_HISTORY_KEY = "trade-search-history";
const MAX_HISTORY_ITEMS = 10;

export function EnhancedSearch({
  value,
  onChange,
  placeholder = "Search trades...",
  searchableFields = ["Symbol", "Notes", "Tags"],
  className,
}: EnhancedSearchProps) {
  const [isFocused, setIsFocused] = React.useState(false);
  const [searchHistory, setSearchHistory] = React.useState<string[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Load search history from localStorage
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
      if (stored) {
        setSearchHistory(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Failed to load search history:", error);
    }
  }, []);

  const saveToHistory = React.useCallback((searchTerm: string) => {
    if (!searchTerm.trim()) return;

    setSearchHistory(prev => {
      const newHistory = [
        searchTerm,
        ...prev.filter(item => item !== searchTerm),
      ].slice(0, MAX_HISTORY_ITEMS);

      try {
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory));
      } catch (error) {
        console.error("Failed to save search history:", error);
      }

      return newHistory;
    });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && value.trim()) {
      saveToHistory(value.trim());
      inputRef.current?.blur();
    } else if (e.key === "Escape") {
      onChange("");
      inputRef.current?.blur();
    }
  };

  const handleClear = () => {
    onChange("");
    inputRef.current?.focus();
  };

  const handleHistoryClick = (term: string) => {
    onChange(term);
    inputRef.current?.focus();
  };

  const clearHistory = () => {
    setSearchHistory([]);
    try {
      localStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch (error) {
      console.error("Failed to clear search history:", error);
    }
  };

  const showHistory = isFocused && searchHistory.length > 0 && !value;

  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(
          "flex items-center border border-white/5 pl-8 pr-2 group transition-all duration-200",
          isFocused && "bg-sidebar-accent border-white/10"
        )}
      >
        <Search className="absolute left-2.5 size-4 text-white/40 group-hover:text-white/60 transition-colors" />

        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          placeholder={placeholder}
          className={cn(
            "h-max py-4 text-xs border-none hover:none px-0 pl-2",
            "focus-visible:scale-100 focus-visible:ring-0",
            "placeholder:text-white/30"
          )}
        />

        {value && (
          <button
            onClick={handleClear}
            className="ml-2 p-1 rounded-xs hover:bg-white/10 transition-colors"
            aria-label="Clear search"
          >
            <X className="size-3.5 text-white/60 hover:text-white" />
          </button>
        )}
      </div>

      {/* Searchable fields badges */}
      <div className="absolute -bottom-5 left-0 flex items-center gap-1">
        <span className="text-[10px] text-white/30">Searching:</span>
        {searchableFields.map((field, index) => (
          <Badge
            key={index}
            variant="outline"
            className="text-[9px] px-1.5 py-0 h-4 border-white/10 text-white/40 rounded-xs"
          >
            {field}
          </Badge>
        ))}
      </div>

      {/* Search history popover */}
      {showHistory && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-sidebar border border-white/10 rounded-xs shadow-lg">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
            <div className="flex items-center gap-2">
              <History className="size-3 text-white/40" />
              <span className="text-xs text-white/50">Recent searches</span>
            </div>
            <button
              onClick={clearHistory}
              className="text-[10px] text-white/40 hover:text-white/70 transition-colors"
            >
              Clear
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {searchHistory.map((term, index) => (
              <button
                key={index}
                onClick={() => handleHistoryClick(term)}
                className="w-full text-left px-3 py-2 text-xs text-white/70 hover:bg-white/5 transition-colors"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
