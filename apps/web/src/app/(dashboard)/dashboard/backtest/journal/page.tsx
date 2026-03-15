"use client";

import React, { useEffect, useState, useCallback } from "react";
import { trpcClient } from "@/utils/trpc";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Plus,
  Trash2,
  Save,
  Sparkles,
  ChevronRight,
  Smile,
  Frown,
  Meh,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type SessionOption = { id: string; name: string; symbol: string; status: string };

type JournalEntry = {
  id: string;
  title: string;
  plainTextContent: string | null;
  tags: string[] | null;
  psychology: PsychologyData | null;
  lessonsLearned: string | null;
  linkedTradeIds: string[] | null;
  aiSummary: string | null;
  aiSentiment: string | null;
  createdAt: string;
  updatedAt: string;
};

type PsychologyData = {
  mood: number;
  confidence: number;
  energy: number;
  focus: number;
  fear: number;
  greed: number;
  emotionalState:
    | "calm"
    | "confident"
    | "neutral"
    | "excited"
    | "anxious"
    | "stressed"
    | "frustrated"
    | "angry"
    | "confused"
    | "discouraged"
    | "overwhelmed"
    | "regretful"
    | "impatient";
  notes?: string;
};

const defaultPsychology: PsychologyData = {
  mood: 5,
  confidence: 5,
  energy: 5,
  focus: 5,
  fear: 3,
  greed: 3,
  emotionalState: "neutral",
};

function PsychologySlider({
  label,
  value,
  onChange,
  lowLabel,
  highLabel,
  color = "blue",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  lowLabel: string;
  highLabel: string;
  color?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/60">{label}</span>
        <span className="text-xs font-medium text-white">{value}/10</span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-teal-400 bg-white/10"
      />
      <div className="flex justify-between">
        <span className="text-[10px] text-white/30">{lowLabel}</span>
        <span className="text-[10px] text-white/30">{highLabel}</span>
      </div>
    </div>
  );
}

function getMoodIcon(mood: number) {
  if (mood >= 7) return <Smile className="size-3.5 text-teal-400" />;
  if (mood >= 4) return <Meh className="size-3.5 text-amber-400" />;
  return <Frown className="size-3.5 text-rose-400" />;
}

function getSessionIdFromTags(tags: string[] | null): string | null {
  if (!tags) return null;
  const tag = tags.find((t) => t.startsWith("backtest:"));
  return tag ? tag.replace("backtest:", "") : null;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function BacktestJournalPage() {
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<string>("all");
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editor state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [lessonsLearned, setLessonsLearned] = useState("");
  const [entrySessionId, setEntrySessionId] = useState<string>("");
  const [psychology, setPsychology] = useState<PsychologyData>(defaultPsychology);

  // Fetch sessions
  useEffect(() => {
    (async () => {
      try {
        const result = await trpcClient.backtest.listSessions.query();
        setSessions(result.map((s: any) => ({
          id: s.id, name: s.name, symbol: s.symbol, status: s.status,
        })));
      } catch {}
    })();
  }, []);

  // Fetch journal entries
  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const input = selectedSession === "all" ? undefined : { sessionId: selectedSession };
      const result = await trpcClient.backtest.getJournalEntries.query(input);
      setEntries(result as JournalEntry[]);
    } catch (e) {
      console.error("Failed to fetch journal entries:", e);
    } finally {
      setLoading(false);
    }
  }, [selectedSession]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // Select an entry for viewing/editing
  const selectEntry = (entry: JournalEntry) => {
    setSelectedEntry(entry);
    setIsCreating(false);
    setTitle(entry.title);
    setContent(entry.plainTextContent ?? "");
    setLessonsLearned(entry.lessonsLearned ?? "");
    setPsychology(entry.psychology ?? defaultPsychology);
    setEntrySessionId(getSessionIdFromTags(entry.tags) ?? "");
  };

  // Start creating new entry
  const startNewEntry = () => {
    setSelectedEntry(null);
    setIsCreating(true);
    setTitle("");
    setContent("");
    setLessonsLearned("");
    setPsychology(defaultPsychology);
    setEntrySessionId(selectedSession === "all" ? (sessions[0]?.id ?? "") : selectedSession);
  };

  // Save entry
  const saveEntry = async () => {
    if (!title.trim() || !entrySessionId) return;
    setSaving(true);
    try {
      if (isCreating) {
        const result = await trpcClient.backtest.createJournalEntry.mutate({
          sessionId: entrySessionId,
          title: title.trim(),
          content: content.trim() || undefined,
          psychology,
          lessonsLearned: lessonsLearned.trim() || undefined,
        });
        setSelectedEntry(result as JournalEntry);
        setIsCreating(false);
      } else if (selectedEntry) {
        const result = await trpcClient.backtest.updateJournalEntry.mutate({
          entryId: selectedEntry.id,
          title: title.trim(),
          content: content.trim() || undefined,
          psychology,
          lessonsLearned: lessonsLearned.trim() || undefined,
        });
        setSelectedEntry(result as JournalEntry);
      }
      fetchEntries();
    } catch (e) {
      console.error("Failed to save:", e);
    } finally {
      setSaving(false);
    }
  };

  // Delete entry
  const deleteEntry = async (id: string) => {
    try {
      await trpcClient.backtest.deleteJournalEntry.mutate({ entryId: id });
      if (selectedEntry?.id === id) {
        setSelectedEntry(null);
        setIsCreating(false);
      }
      fetchEntries();
    } catch (e) {
      console.error("Failed to delete:", e);
    }
  };

  const showEditor = isCreating || selectedEntry !== null;

  return (
    <main className="p-6 py-4 h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold">Journal</h1>
          <p className="text-sm text-muted-foreground">
            Reflect on your backtesting sessions and track learnings.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedSession} onValueChange={setSelectedSession}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by session" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sessions</SelectItem>
              {sessions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} ({s.symbol})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={startNewEntry}
            className="bg-teal-500/20 text-teal-300 hover:bg-teal-500/30 border border-teal-500/30"
          >
            <Plus className="size-4 mr-1.5" />
            New Entry
          </Button>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
        {/* Left: Entry list */}
        <div className="w-80 shrink-0 flex flex-col bg-sidebar border border-white/5 rounded-sm overflow-hidden">
          <div className="p-3 border-b border-white/5">
            <span className="text-xs font-medium text-white/50">{entries.length} entries</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-3 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-sm bg-sidebar-accent" />
                ))}
              </div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <BookOpen className="size-8 text-white/20" />
                <p className="text-sm text-white/40">No journal entries yet</p>
                <p className="text-xs text-white/30">Click "New Entry" to get started</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {entries.map((entry) => {
                  const sessionTag = getSessionIdFromTags(entry.tags);
                  const session = sessions.find((s) => s.id === sessionTag);
                  const isSelected = selectedEntry?.id === entry.id;

                  return (
                    <button
                      key={entry.id}
                      onClick={() => selectEntry(entry)}
                      className={cn(
                        "w-full text-left p-3 rounded-sm transition-colors cursor-pointer",
                        isSelected ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/50"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-white truncate max-w-[180px]">
                          {entry.title}
                        </span>
                        {entry.psychology && getMoodIcon(entry.psychology.mood)}
                      </div>
                      <div className="flex items-center gap-2">
                        {session && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40">
                            {session.symbol}
                          </span>
                        )}
                        <span className="text-[10px] text-white/30">
                          {timeAgo(entry.createdAt)}
                        </span>
                        {entry.aiSentiment && (
                          <span className={cn(
                            "text-[10px] px-1 py-0.5 rounded",
                            entry.aiSentiment === "positive" ? "bg-teal-500/10 text-teal-400" :
                            entry.aiSentiment === "negative" ? "bg-rose-500/10 text-rose-400" :
                            "bg-white/5 text-white/40"
                          )}>
                            {entry.aiSentiment}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Entry editor */}
        <div className="flex-1 flex flex-col bg-sidebar border border-white/5 rounded-sm overflow-hidden">
          {!showEditor ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <BookOpen className="size-10 text-white/15" />
              <p className="text-sm text-white/40">Select an entry or create a new one</p>
            </div>
          ) : (
            <>
              {/* Editor header */}
              <div className="flex items-center justify-between p-3 border-b border-white/5 shrink-0">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Entry title..."
                  className="text-lg font-semibold bg-transparent border-none outline-none text-white placeholder:text-white/30 flex-1"
                />
                <div className="flex items-center gap-2">
                  {selectedEntry && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteEntry(selectedEntry.id)}
                      className="text-rose-400/60 hover:text-rose-400 hover:bg-rose-500/10"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                  <Button
                    onClick={saveEntry}
                    disabled={saving || !title.trim() || !entrySessionId}
                    size="sm"
                    className="bg-teal-500/20 text-teal-300 hover:bg-teal-500/30"
                  >
                    <Save className="size-4 mr-1.5" />
                    {saving ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>

              {/* Editor body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {/* Session selector */}
                <div>
                  <Label className="text-xs text-white/50 mb-1.5 block">Linked Session</Label>
                  <Select value={entrySessionId} onValueChange={setEntrySessionId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a session" />
                    </SelectTrigger>
                    <SelectContent>
                      {sessions.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} ({s.symbol})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Content */}
                <div>
                  <Label className="text-xs text-white/50 mb-1.5 block">Notes & Observations</Label>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="What did you observe during this session? What went well? What could improve?"
                    className="min-h-[120px] bg-sidebar-accent/30 border-white/5 resize-y"
                  />
                </div>

                {/* Psychology Tracker */}
                <div>
                  <Label className="text-xs text-white/50 mb-3 block">Psychology Tracker</Label>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 bg-sidebar-accent/20 rounded-sm p-4">
                    <PsychologySlider
                      label="Mood"
                      value={psychology.mood}
                      onChange={(v) => setPsychology({ ...psychology, mood: v })}
                      lowLabel="Terrible"
                      highLabel="Excellent"
                    />
                    <PsychologySlider
                      label="Confidence"
                      value={psychology.confidence}
                      onChange={(v) => setPsychology({ ...psychology, confidence: v })}
                      lowLabel="Uncertain"
                      highLabel="Very confident"
                    />
                    <PsychologySlider
                      label="Energy"
                      value={psychology.energy}
                      onChange={(v) => setPsychology({ ...psychology, energy: v })}
                      lowLabel="Exhausted"
                      highLabel="Energized"
                    />
                    <PsychologySlider
                      label="Focus"
                      value={psychology.focus}
                      onChange={(v) => setPsychology({ ...psychology, focus: v })}
                      lowLabel="Distracted"
                      highLabel="Laser focused"
                    />
                    <PsychologySlider
                      label="Fear"
                      value={psychology.fear}
                      onChange={(v) => setPsychology({ ...psychology, fear: v })}
                      lowLabel="No fear"
                      highLabel="Terrified"
                      color="red"
                    />
                    <PsychologySlider
                      label="Greed"
                      value={psychology.greed}
                      onChange={(v) => setPsychology({ ...psychology, greed: v })}
                      lowLabel="Patient"
                      highLabel="FOMO/Greedy"
                      color="red"
                    />
                  </div>

                  <div className="mt-3">
                    <Label className="text-xs text-white/50 mb-1.5 block">Emotional State</Label>
                    <Select
                      value={psychology.emotionalState}
                      onValueChange={(v) =>
                        setPsychology({
                          ...psychology,
                          emotionalState: v as PsychologyData["emotionalState"],
                        })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="calm">Calm</SelectItem>
                        <SelectItem value="neutral">Neutral</SelectItem>
                        <SelectItem value="confident">Confident</SelectItem>
                        <SelectItem value="excited">Excited</SelectItem>
                        <SelectItem value="anxious">Anxious</SelectItem>
                        <SelectItem value="frustrated">Frustrated</SelectItem>
                        <SelectItem value="stressed">Stressed</SelectItem>
                        <SelectItem value="angry">Angry</SelectItem>
                        <SelectItem value="confused">Confused</SelectItem>
                        <SelectItem value="discouraged">Discouraged</SelectItem>
                        <SelectItem value="overwhelmed">Overwhelmed</SelectItem>
                        <SelectItem value="regretful">Regretful</SelectItem>
                        <SelectItem value="impatient">Impatient</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Lessons Learned */}
                <div>
                  <Label className="text-xs text-white/50 mb-1.5 block">Lessons Learned</Label>
                  <Textarea
                    value={lessonsLearned}
                    onChange={(e) => setLessonsLearned(e.target.value)}
                    placeholder="What key takeaways will you apply to future sessions?"
                    className="min-h-[80px] bg-sidebar-accent/30 border-white/5 resize-y"
                  />
                </div>

                {/* AI Summary (read-only, if available) */}
                {selectedEntry?.aiSummary && (
                  <div className="bg-purple-500/5 border border-purple-500/20 rounded-sm p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Sparkles className="size-3.5 text-purple-400" />
                      <span className="text-xs font-medium text-purple-300">AI Analysis</span>
                    </div>
                    <p className="text-sm text-white/70">{selectedEntry.aiSummary}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
