"use client";

import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { trpcClient } from "@/utils/trpc";
import { useAccountStore, ALL_ACCOUNTS_ID } from "@/stores/account";
import { Tag, Clock } from "lucide-react";
import { useEffect, useState } from "react";

type NamedTag = { name: string; color: string };

export default function TagsSettingsPage() {
  const selectedAccountId = useAccountStore((s) => s.selectedAccountId);
  const accountId = selectedAccountId || ALL_ACCOUNTS_ID;

  const [sessionTags, setSessionTags] = useState<NamedTag[]>([]);
  const [modelTags, setModelTags] = useState<NamedTag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      trpcClient.trades.listSessionTags.query({ accountId }),
      trpcClient.trades.listModelTags.query({ accountId }),
    ])
      .then(([sessions, models]) => {
        if (cancelled) return;
        setSessionTags((sessions ?? []) as NamedTag[]);
        setModelTags((models ?? []) as NamedTag[]);
      })
      .catch((err) => {
        console.error("[Tags] fetch error:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accountId]);

  return (
    <div className="flex flex-col w-full">
      {/* Session Tags */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div className="max-w-[200px]">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-blue-400" />
            <Label className="text-sm text-white/80 font-medium">
              Session Tags
            </Label>
          </div>
          <p className="text-xs text-white/40 mt-0.5">
            Assigned by trading session or time of day.
          </p>
        </div>
        <div className="space-y-2">
          {loading ? (
            <>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </>
          ) : sessionTags.length > 0 ? (
            sessionTags.map((tag) => (
              <div
                key={tag.name}
                className="flex items-center gap-3 p-3 bg-sidebar-accent border border-white/5 rounded-md"
              >
                <div
                  className="w-4 h-4 rounded-sm shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="text-white text-sm">{tag.name}</span>
              </div>
            ))
          ) : (
            <p className="text-xs text-white/40 py-4">
              No session tags yet. Assign session tags to trades in the trade
              table.
            </p>
          )}
        </div>
      </div>

      <Separator />

      {/* Model Tags */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div className="max-w-[200px]">
          <div className="flex items-center gap-2">
            <Tag className="size-4 text-green-400" />
            <Label className="text-sm text-white/80 font-medium">
              Model Tags
            </Label>
          </div>
          <p className="text-xs text-white/40 mt-0.5">
            Assigned by strategy or setup.
          </p>
        </div>
        <div className="space-y-2">
          {loading ? (
            <>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </>
          ) : modelTags.length > 0 ? (
            modelTags.map((tag) => (
              <div
                key={tag.name}
                className="flex items-center gap-3 p-3 bg-sidebar-accent border border-white/5 rounded-md"
              >
                <div
                  className="w-4 h-4 rounded-sm shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="text-white text-sm">{tag.name}</span>
              </div>
            ))
          ) : (
            <p className="text-xs text-white/40 py-4">
              No model tags yet. Assign model tags to trades in the trade table.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
