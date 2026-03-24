export interface JournalListEntry {
  id: string;
  title: string;
  emoji?: string | null;
  coverImageUrl?: string | null;
  coverImagePosition?: number | null;
  entryType: string | null;
  tags: string[] | null;
  journalDate?: Date | string | null;
  isPinned: boolean | null;
  wordCount: number | null;
  readTimeMinutes: number | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  preview?: string;
}

export interface JournalListProps {
  accountId?: string;
  onSelectEntry: (entryId: string) => void;
  onCreateEntry: () => void;
  className?: string;
  forceEntryType?: string;
}

export const entryTypeConfig = {
  general: { label: "General", accent: "#888888", icon: FileText },
  daily: { label: "Daily Review", accent: "#60a5fa", icon: Calendar },
  weekly: { label: "Weekly Review", accent: "#a78bfa", icon: CalendarDays },
  monthly: { label: "Monthly Review", accent: "#e879f9", icon: CalendarDays },
  trade_review: { label: "Trade Review", accent: "#2dd4bf", icon: Target },
  strategy: { label: "Strategy", accent: "#facc15", icon: Sparkles },
  comparison: { label: "Comparison", accent: "#fb923c", icon: GitCompare },
  edge: { label: "Edge entry", accent: "#14b8a6", icon: Sparkles },
} as const;

export function generatePatternSeed(title: string) {
  let hash = 0;
  for (let i = 0; i < title.length; i += 1) {
    hash = ((hash << 5) - hash + title.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
import {
  Calendar,
  CalendarDays,
  FileText,
  GitCompare,
  Sparkles,
  Target,
} from "lucide-react";
