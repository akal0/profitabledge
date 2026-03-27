"use client";

import { CircleDashed, History } from "lucide-react";

import {
  GoalContentSeparator,
  GoalSurface,
} from "@/components/goals/goal-surface";
import { Badge } from "@/components/ui/badge";

export type EdgeVersionHistoryItem = {
  id: string;
  label: string;
  createdAt?: string | Date | null;
  authorName?: string | null;
  summary?: string | null;
  isCurrent?: boolean;
  isPublished?: boolean;
  changes?: Array<{
    label: string;
    value: string;
  }>;
};

export type EdgeVersionHistoryData = {
  versions: EdgeVersionHistoryItem[];
};

function formatDateTime(value?: string | Date | null) {
  if (!value) return "Unscheduled";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unscheduled";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function EdgeVersionHistoryPanel({
  versionHistory,
}: {
  versionHistory: EdgeVersionHistoryData | null;
}) {
  if (!versionHistory || versionHistory.versions.length === 0) {
    return (
      <GoalSurface className="w-full">
        <div className="p-4">
          <div className="flex items-center gap-2">
            <CircleDashed className="h-4 w-4 text-white/45" />
            <p className="text-sm font-medium text-white/78">Version history</p>
          </div>
          <GoalContentSeparator className="mb-4 mt-4" />
          <p className="text-sm text-white/45">
            Version snapshots will appear here once this Edge starts writing
            history records.
          </p>
        </div>
      </GoalSurface>
    );
  }

  return (
    <GoalSurface className="w-full">
      <div className="p-4">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-teal-300" />
          <p className="text-sm font-medium text-white/78">Version history</p>
        </div>
        <GoalContentSeparator className="mb-4 mt-4" />

        <div className="space-y-4">
          {versionHistory.versions.map((version) => (
            <div
              key={version.id}
              className="rounded-sm border border-white/6 bg-white/[0.03] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">{version.label}</p>
                  <p className="mt-1 text-xs text-white/45">
                    {formatDateTime(version.createdAt)}
                    {version.authorName ? ` · ${version.authorName}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {version.isCurrent ? (
                    <Badge
                      variant="outline"
                      className="border-teal-400/20 bg-teal-400/10 text-[11px] text-teal-100"
                    >
                      Current
                    </Badge>
                  ) : null}
                  {version.isPublished ? (
                    <Badge
                      variant="outline"
                      className="border-sky-400/20 bg-sky-400/10 text-[11px] text-sky-100"
                    >
                      Public
                    </Badge>
                  ) : null}
                </div>
              </div>

              {version.summary ? (
                <p className="mt-3 text-sm leading-6 text-white/68">
                  {version.summary}
                </p>
              ) : null}

              {version.changes?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {version.changes.map((change) => (
                    <Badge
                      key={`${version.id}-${change.label}`}
                      variant="secondary"
                      className="border-white/10 bg-white/5 text-[11px] text-white/75"
                    >
                      {change.label}: {change.value}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </GoalSurface>
  );
}
