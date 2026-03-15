"use client";

import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { journalToolbarPrimaryButtonClassName } from "@/components/journal/list/journal-list-shared";

export function JournalListEmptyState({
  onCreateEntry,
}: {
  onCreateEntry: () => void;
}) {
  return (
    <div className="flex h-64 flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-md bg-sidebar-accent">
        <FileText className="h-8 w-8 text-white/20" />
      </div>
      <h3 className="mb-1 text-lg font-medium text-white">
        No journal entries yet
      </h3>
      <p className="mb-4 max-w-xs text-sm text-white/40">
        Start documenting your trading journey, reviewing trades, and tracking
        your progress
      </p>
      <Button onClick={onCreateEntry} className={journalToolbarPrimaryButtonClassName}>
        <Plus className="mr-1 h-4 w-4" />
        Create your first entry
      </Button>
    </div>
  );
}
