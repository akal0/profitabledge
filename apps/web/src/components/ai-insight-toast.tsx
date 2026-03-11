"use client";

import { useEffect, useRef } from "react";
import { useAccountStore } from "@/stores/account";
import { trpcClient } from "@/utils/trpc";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { TrendingUp, AlertTriangle, Info, Sparkles } from "lucide-react";

const INSIGHT_INTERVAL = 30 * 60 * 1000; // 30 minutes
const STORAGE_KEY = "lastInsightTime";

export function AIInsightToast() {
  const accountId = useAccountStore((s) => s.selectedAccountId);
  const router = useRouter();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasShownLoginInsight = useRef(false);

  const showInsight = async () => {
    if (!accountId) return;

    try {
      const insight = await trpcClient.accounts.randomInsight.query({
        accountId,
      });
      if (!insight) return;

      const IconComponent =
        insight.severity === "success"
          ? Sparkles
          : insight.severity === "warning"
          ? AlertTriangle
          : Info;

      const iconColor =
        insight.severity === "success"
          ? "text-teal-400"
          : insight.severity === "warning"
          ? "text-amber-400"
          : "text-blue-400";

      toast(insight.title, {
        description: insight.message,
        icon: <IconComponent className={`size-4 ${iconColor}`} />,
        duration: 8000,
        // action: {
        //   label: "View AI Assistant",
        //   onClick: () => router.push("/assistant"),
        // },
        classNames: {
          toast:
            "bg-sidebar border-white/10 text-white !min-w-[300px] !max-w-[500px]",
          title: "text-white font-medium",
          description: "text-white/70",
          actionButton:
            "bg-teal-500/20 text-teal-400 hover:bg-teal-500/30 border-teal-500/30",
        },
      });

      // Update last insight time
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    } catch (error) {
      console.error("Failed to fetch insight:", error);
    }
  };

  useEffect(() => {
    if (!accountId) return;

    // Check if we should show an insight on mount
    const lastInsightTime = localStorage.getItem(STORAGE_KEY);
    const now = Date.now();
    const shouldShowInsight = !lastInsightTime || now - parseInt(lastInsightTime) > INSIGHT_INTERVAL;

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
  }, [accountId]);

  return null; // This component doesn't render anything
}
