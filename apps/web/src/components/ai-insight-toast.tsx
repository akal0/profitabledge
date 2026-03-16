"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccountStore } from "@/stores/account";
import { trpcClient } from "@/utils/trpc";
import { toast } from "sonner";
import { AlertTriangle, Info, Lightbulb, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const INSIGHT_INTERVAL = 30 * 60 * 1000; // 30 minutes
const STORAGE_KEY = "lastInsightTime";

function formatInsightTitle(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return title;

  return words
    .map((word, index) => {
      if (index === 0) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }

      return /^[A-Z0-9:+/-]+$/.test(word) ? word : word.toLowerCase();
    })
    .join(" ");
}

type ShowInsightToastOptions = {
  recordShownAt?: boolean;
};

export async function showInsightToast(
  accountId: string,
  options: ShowInsightToastOptions = {}
) {
  const { recordShownAt = true } = options;
  const insight = await trpcClient.accounts.randomInsight.query({
    accountId,
  });
  if (!insight) return;

  const IconComponent =
    insight.severity === "positive"
      ? Sparkles
      : insight.severity === "warning"
      ? AlertTriangle
      : Info;

  const iconColor =
    insight.severity === "positive"
      ? "text-teal-400"
      : insight.severity === "warning"
      ? "text-amber-400"
      : "text-blue-400";

  toast(formatInsightTitle(insight.title), {
    description: insight.message,
    icon: <IconComponent className={`size-4 ${iconColor}`} />,
    duration: 8000,
    classNames: {
      toast:
        "bg-sidebar ring-white/10 text-white !min-w-[300px] !max-w-[500px]",
      title: "text-white font-medium",
      description: "text-white/70",
      actionButton:
        "bg-teal-500/20 text-teal-400 hover:bg-teal-500/30 ring-teal-500/30",
    },
  });

  if (recordShownAt) {
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
  }
}

export function InsightToastTestButton() {
  const accountId = useAccountStore((s) => s.selectedAccountId);
  const [isPending, setIsPending] = useState(false);

  const handleClick = async () => {
    if (!accountId || isPending) return;

    setIsPending(true);
    try {
      await showInsightToast(accountId, { recordShownAt: false });
    } catch (error) {
      console.error("Failed to trigger insight toast:", error);
      toast.error("Failed to trigger insight toast");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Button
      onClick={() => void handleClick()}
      disabled={!accountId || isPending}
      className={cn(
        "cursor-pointer flex h-[38px] w-max items-center justify-center gap-2 rounded-sm ring ring-white/5 bg-sidebar px-3 py-2 text-xs text-white transition-all duration-250 hover:bg-sidebar-accent hover:brightness-110 active:scale-95",
        isPending && "cursor-wait"
      )}
    >
      <Lightbulb className="size-3 text-white/75" />
      <span>{isPending ? "Testing..." : "Test insight toast"}</span>
    </Button>
  );
}

export function AIInsightToast() {
  const accountId = useAccountStore((s) => s.selectedAccountId);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasShownLoginInsight = useRef(false);

  const showInsight = useCallback(async () => {
    if (!accountId) return;

    try {
      await showInsightToast(accountId);
    } catch (error) {
      console.error("Failed to fetch insight:", error);
    }
  }, [accountId]);

  useEffect(() => {
    if (!accountId) return;

    // Check if we should show an insight on mount
    const lastInsightTime = localStorage.getItem(STORAGE_KEY);
    const now = Date.now();
    const shouldShowInsight =
      !lastInsightTime || now - parseInt(lastInsightTime) > INSIGHT_INTERVAL;

    // Show insight on login (once per session) if enough time has passed
    if (!hasShownLoginInsight.current && shouldShowInsight) {
      hasShownLoginInsight.current = true;
      // Delay slightly to avoid overwhelming on page load
      setTimeout(() => {
        showInsight();
      }, 3000); // 3 seconds after mount
    } else {
      // Mark as shown to prevent duplicate on this mount
      hasShownLoginInsight.current = true;
    }

    // Set up periodic insights every 30 minutes
    intervalRef.current = setInterval(() => {
      showInsight();
    }, INSIGHT_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [accountId, showInsight]);

  return null; // This component doesn't render anything
}
