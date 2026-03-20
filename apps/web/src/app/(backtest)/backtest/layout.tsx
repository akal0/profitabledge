"use client";

import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { FloatingAssistant } from "@/components/ai/floating-assistant";
import { AIInsightToast } from "@/components/ai-insight-toast";
import { BacktestSidebar } from "@/components/backtest-sidebar";
import {
  RouteLoadingFallback,
  type RouteLoadingVariant,
} from "@/components/ui/route-loading-fallback";
import { VerticalSeparator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useAlphaPageTracking } from "@/features/platform/alpha/hooks/use-alpha-page-tracking";

function resolveBacktestRouteVariant(pathname: string): RouteLoadingVariant {
  if (pathname.startsWith("/backtest/replay")) return "backtestReplay";
  if (pathname.startsWith("/backtest/analytics")) return "backtestAnalytics";
  if (pathname.startsWith("/backtest/compare")) return "backtestCompare";
  if (pathname.startsWith("/backtest/sessions")) return "backtestSessions";
  if (pathname.startsWith("/backtest/") && pathname.endsWith("/review")) {
    return "backtestReview";
  }

  return "backtest";
}

export default function BacktestLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname() ?? "/backtest";
  const loadingVariant = resolveBacktestRouteVariant(pathname);

  useAlphaPageTracking("backtest");

  return (
    <SidebarProvider
      defaultOpen
      className="h-dvh min-h-dvh w-full overflow-hidden"
    >
      <AIInsightToast />
      <BacktestSidebar />
      <VerticalSeparator />

      <SidebarInset className="relative h-dvh min-h-dvh overflow-hidden bg-background dark:bg-sidebar">
        <div className="absolute left-4 top-4 z-40">
          <SidebarTrigger className="size-10 border border-white/10 bg-black/35 text-white/75 backdrop-blur-sm hover:bg-black/45 hover:text-white" />
        </div>

        <Suspense
          fallback={
            <RouteLoadingFallback route={loadingVariant} className="min-h-full bg-background dark:bg-sidebar" />
          }
        >
          <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
            {children}
          </div>
        </Suspense>
      </SidebarInset>

      {/*<Suspense fallback={null}>
        <FloatingAssistant />
      </Suspense>*/}
    </SidebarProvider>
  );
}
