"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Clock, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface SessionConfig {
  id: string;
  name: string;
  startHourUTC: number;
  endHourUTC: number;
  color: string;
  daysActive: number[];
}

const DEFAULT_SESSIONS: SessionConfig[] = [
  { id: "sydney", name: "Sydney", startHourUTC: 21, endHourUTC: 6, color: "#22c55e", daysActive: [1, 2, 3, 4, 5] },
  { id: "tokyo", name: "Tokyo", startHourUTC: 0, endHourUTC: 9, color: "#f59e0b", daysActive: [1, 2, 3, 4, 5] },
  { id: "london", name: "London", startHourUTC: 7, endHourUTC: 16, color: "#8b5cf6", daysActive: [1, 2, 3, 4, 5] },
  { id: "new-york", name: "New York", startHourUTC: 12, endHourUTC: 21, color: "#3b82f6", daysActive: [1, 2, 3, 4, 5] },
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function SessionsSettingsPage() {
  const [sessions, setSessions] = useState<SessionConfig[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("profitabledge-sessions");
      if (saved) {
        try { return JSON.parse(saved); } catch {}
      }
    }
    return DEFAULT_SESSIONS;
  });

  const addSession = () => {
    setSessions((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: "",
        startHourUTC: 8,
        endHourUTC: 17,
        color: "#6b7280",
        daysActive: [1, 2, 3, 4, 5],
      },
    ]);
  };

  const removeSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const updateSession = (id: string, updates: Partial<SessionConfig>) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  const toggleDay = (id: string, day: number) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const days = s.daysActive.includes(day)
          ? s.daysActive.filter((d) => d !== day)
          : [...s.daysActive, day].sort();
        return { ...s, daysActive: days };
      })
    );
  };

  const save = () => {
    localStorage.setItem("profitabledge-sessions", JSON.stringify(sessions));
    toast.success("Session configuration saved");
  };

  const resetDefaults = () => {
    setSessions(DEFAULT_SESSIONS);
    localStorage.removeItem("profitabledge-sessions");
    toast.success("Reset to default sessions");
  };

  return (
    <div className="flex flex-col w-full">
      {/* Header with actions */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">Trading Sessions</Label>
          <p className="text-xs text-white/40 mt-0.5">
            Trades are auto-tagged based on these time ranges.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={resetDefaults}
            className="cursor-pointer flex items-center justify-center py-2 h-[38px] w-max transition-all active:scale-95 text-white/60 text-xs hover:brightness-110 duration-250 border border-white/5 bg-sidebar rounded-sm hover:bg-sidebar-accent px-4"
          >
            Reset Defaults
          </Button>
          <Button
            onClick={addSession}
            className="border border-white/5 bg-teal-600/25 hover:bg-teal-600/35 px-4 py-2 h-[38px] w-max text-xs text-teal-300 cursor-pointer justify-start gap-2 transition-all active:scale-95 duration-250"
          >
            <Plus className="size-3.5" />
            Add Session
          </Button>
        </div>
      </div>

      <Separator />

      {/* Timeline Visualization */}
      <div className="px-6 sm:px-8 py-5">
        <p className="text-[10px] text-white/30 uppercase tracking-wider mb-3">
          24-Hour Timeline (UTC)
        </p>
        <div className="relative h-10 rounded-md bg-white/5 overflow-hidden">
          {sessions.map((s) => {
            const start = s.startHourUTC;
            const end = s.endHourUTC;
            const wraps = end < start;
            const width = wraps ? (24 - start + end) / 24 : (end - start) / 24;
            const left = start / 24;

            return (
              <div
                key={s.id}
                className="absolute top-0 h-full opacity-40 transition-all"
                style={{
                  left: `${left * 100}%`,
                  width: `${Math.min(width * 100, 100 - left * 100)}%`,
                  backgroundColor: s.color,
                }}
                title={`${s.name}: ${start}:00 - ${end}:00 UTC`}
              />
            );
          })}
          {Array.from({ length: 24 }, (_, i) => (
            <div
              key={i}
              className="absolute top-0 h-full border-l border-white/5"
              style={{ left: `${(i / 24) * 100}%` }}
            >
              {i % 4 === 0 && (
                <span className="absolute -top-4 -translate-x-1/2 text-[8px] text-white/25">
                  {i}:00
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Session items */}
      {sessions.map((session, idx) => (
        <div key={session.id}>
          <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={session.color}
                onChange={(e) =>
                  updateSession(session.id, { color: e.target.value })
                }
                className="size-6 rounded cursor-pointer border-0 bg-transparent"
              />
              <div>
                <Label className="text-sm text-white/80 font-medium">
                  {session.name || "New Session"}
                </Label>
                <p className="text-xs text-white/40 mt-0.5">
                  {session.startHourUTC}:00 - {session.endHourUTC}:00 UTC
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {/* Name */}
              <Input
                value={session.name}
                onChange={(e) =>
                  updateSession(session.id, { name: e.target.value })
                }
                placeholder="Session name"
                className="bg-sidebar-accent border-white/5 text-white text-sm"
              />

              {/* Time range */}
              <div className="flex items-center gap-2 text-sm">
                <Clock className="size-3.5 text-white/30" />
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={session.startHourUTC}
                  onChange={(e) =>
                    updateSession(session.id, {
                      startHourUTC: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-16 text-center text-xs bg-sidebar-accent border-white/5 text-white"
                />
                <span className="text-white/40 text-xs">:00 to</span>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={session.endHourUTC}
                  onChange={(e) =>
                    updateSession(session.id, {
                      endHourUTC: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-16 text-center text-xs bg-sidebar-accent border-white/5 text-white"
                />
                <span className="text-white/40 text-xs">:00 UTC</span>
              </div>

              {/* Active days */}
              <div className="flex items-center gap-1.5">
                {DAY_LABELS.map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleDay(session.id, i)}
                    className={`px-2 py-0.5 text-[10px] rounded-sm border transition-all cursor-pointer ${
                      session.daysActive.includes(i)
                        ? "border-white/20 bg-white/10 text-white"
                        : "border-white/5 bg-transparent text-white/25"
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeSession(session.id)}
                  className="ml-auto text-white/30 hover:text-red-400 h-6 w-6 p-0"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
          {idx < sessions.length - 1 && <Separator />}
        </div>
      ))}

      <Separator />

      {/* Save */}
      <div className="flex justify-end px-6 sm:px-8 py-6">
        <Button
          onClick={save}
          className="cursor-pointer flex items-center justify-center py-2 h-[38px] w-max transition-all active:scale-95 text-white text-xs hover:brightness-110 duration-250 border border-white/5 bg-sidebar rounded-sm hover:bg-sidebar-accent px-5"
        >
          Save changes
        </Button>
      </div>
    </div>
  );
}
