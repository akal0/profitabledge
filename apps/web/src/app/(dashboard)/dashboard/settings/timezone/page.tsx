"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import { Separator } from "@/components/ui/separator";
import { Clock, Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpcClient, trpcOptions } from "@/utils/trpc";
import { toast } from "sonner";

const TIMEZONES = [
  { value: "UTC", label: "UTC", offset: "+00:00" },
  { value: "America/New_York", label: "Eastern Time (US)", offset: "-05:00" },
  { value: "America/Chicago", label: "Central Time (US)", offset: "-06:00" },
  { value: "America/Denver", label: "Mountain Time (US)", offset: "-07:00" },
  {
    value: "America/Los_Angeles",
    label: "Pacific Time (US)",
    offset: "-08:00",
  },
  { value: "America/Anchorage", label: "Alaska Time", offset: "-09:00" },
  { value: "Pacific/Honolulu", label: "Hawaii Time", offset: "-10:00" },
  {
    value: "America/Toronto",
    label: "Eastern Time (Canada)",
    offset: "-05:00",
  },
  { value: "America/Sao_Paulo", label: "Brasilia Time", offset: "-03:00" },
  { value: "Europe/London", label: "London (GMT)", offset: "+00:00" },
  { value: "Europe/Paris", label: "Central European Time", offset: "+01:00" },
  { value: "Europe/Berlin", label: "Berlin (CET)", offset: "+01:00" },
  { value: "Europe/Moscow", label: "Moscow Time", offset: "+03:00" },
  { value: "Europe/Istanbul", label: "Turkey Time", offset: "+03:00" },
  { value: "Asia/Dubai", label: "Gulf Standard Time", offset: "+04:00" },
  { value: "Asia/Kolkata", label: "India Standard Time", offset: "+05:30" },
  { value: "Asia/Bangkok", label: "Indochina Time", offset: "+07:00" },
  { value: "Asia/Singapore", label: "Singapore Time", offset: "+08:00" },
  { value: "Asia/Shanghai", label: "China Standard Time", offset: "+08:00" },
  { value: "Asia/Hong_Kong", label: "Hong Kong Time", offset: "+08:00" },
  { value: "Asia/Tokyo", label: "Japan Standard Time", offset: "+09:00" },
  { value: "Asia/Seoul", label: "Korea Standard Time", offset: "+09:00" },
  {
    value: "Australia/Sydney",
    label: "Australian Eastern Time",
    offset: "+11:00",
  },
  {
    value: "Australia/Perth",
    label: "Australian Western Time",
    offset: "+08:00",
  },
  { value: "Pacific/Auckland", label: "New Zealand Time", offset: "+13:00" },
  { value: "Africa/Cairo", label: "Egypt Standard Time", offset: "+02:00" },
  { value: "Africa/Lagos", label: "West Africa Time", offset: "+01:00" },
  {
    value: "Africa/Johannesburg",
    label: "South Africa Time",
    offset: "+02:00",
  },
];

function getCurrentTimeInTimezone(tz: string): string {
  try {
    return new Date().toLocaleTimeString("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return "--:--:--";
  }
}

export default function TimezonePage() {
  const [selectedTz, setSelectedTz] = useState("UTC");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const { data: user, isLoading } = useQuery({
    ...trpcOptions.users.me.queryOptions(),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    const prefs = (user as any)?.widgetPreferences || {};
    if (prefs.timezone) {
      setSelectedTz(prefs.timezone);
    }
  }, [user]);

  useEffect(() => {
    setCurrentTime(getCurrentTimeInTimezone(selectedTz));
    const interval = setInterval(() => {
      setCurrentTime(getCurrentTimeInTimezone(selectedTz));
    }, 1000);
    return () => clearInterval(interval);
  }, [selectedTz]);

  const filtered = useMemo(() => {
    if (!search) return TIMEZONES;
    const q = search.toLowerCase();
    return TIMEZONES.filter(
      (tz) =>
        tz.label.toLowerCase().includes(q) ||
        tz.value.toLowerCase().includes(q) ||
        tz.offset.includes(q)
    );
  }, [search]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await trpcClient.users.updateTimezone.mutate({ timezone: selectedTz });
      toast.success(`Timezone set to ${selectedTz}`);
    } catch (e: any) {
      toast.error("Failed to save timezone");
    }
    setSaving(false);
  };

  if (isLoading) {
    return (
      <RouteLoadingFallback route="settingsTimezone" className="min-h-full" />
    );
  }

  const currentTzInfo = TIMEZONES.find((tz) => tz.value === selectedTz);

  return (
    <div className="flex flex-col w-full">
      {/* Current Time Preview */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">
            Current time
          </Label>
          <p className="text-xs text-white/40 mt-0.5">
            Preview for selected timezone.
          </p>
        </div>
        <div className="flex items-center justify-between p-4 bg-sidebar border border-white/5 rounded-md">
          <div>
            <p className="text-2xl font-semibold text-white tabular-nums">
              {currentTime}
            </p>
            <p className="text-xs text-white/40 mt-1">
              {currentTzInfo?.label || selectedTz}{" "}
              <span className="text-white/20">
                ({currentTzInfo?.offset || ""})
              </span>
            </p>
          </div>
          <Clock className="size-8 text-white/10" />
        </div>
      </div>

      <Separator />

      {/* Timezone Selector */}
      <div className="flex flex-col  gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">Timezone</Label>
          <p className="text-xs text-white/40 mt-0.5">
            For trade times and calendar data.
          </p>
        </div>
        <div className="bg-sidebar ring ring-white/5 rounded-md">
          {/* Search */}
          <div className="p-3 ring-b ring-white/5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-white/25" />
              <input
                type="text"
                placeholder="Search timezone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-white/[0.02] ring ring-white/5 rounded text-xs text-white placeholder:text-white/20 focus:outline-none focus:ring-white/15"
              />
            </div>
          </div>

          {/* Timezone List */}
          <div className="max-h-[320px] overflow-y-auto w-full">
            {filtered.map((tz) => (
              <button
                key={tz.value}
                onClick={() => setSelectedTz(tz.value)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer",
                  selectedTz === tz.value
                    ? "bg-teal-500/10 border-l border-l-teal-400"
                    : "hover:bg-white/[0.02] border-l border-l-transparent"
                )}
              >
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "text-xs",
                      selectedTz === tz.value
                        ? "text-teal-400"
                        : "text-white/70"
                    )}
                  >
                    {tz.label}
                  </p>
                  <p className="text-[10px] text-white/25 mt-0.5">{tz.value}</p>
                </div>
                <span className="text-[10px] text-white/30 tabular-nums shrink-0">
                  {tz.offset}
                </span>
                {selectedTz === tz.value && (
                  <Check className="size-3 text-teal-400 shrink-0" />
                )}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="p-4 text-center text-xs text-white/20">
                No matching timezones
              </p>
            )}
          </div>
        </div>
      </div>

      <Separator />

      {/* Save */}
      <div className="flex justify-end px-6 sm:px-8 py-6">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="cursor-pointer flex items-center justify-center py-2 h-[38px] w-max transition-all active:scale-95 text-white text-xs hover:brightness-110 duration-250 ring ring-white/5 bg-sidebar rounded-sm hover:bg-sidebar-accent px-5"
        >
          {saving ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
