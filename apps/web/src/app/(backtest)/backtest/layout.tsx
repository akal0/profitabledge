"use client";

import { FloatingAssistant } from "@/components/ai/floating-assistant";
import { AIInsightToast } from "@/components/ai-insight-toast";
import { BacktestSidebar } from "@/components/backtest-sidebar";
import { VerticalSeparator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export default function BacktestLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider defaultOpen className="h-dvh min-h-dvh w-full overflow-hidden">
      <AIInsightToast />
      <BacktestSidebar />
      <VerticalSeparator />

      <SidebarInset className="relative h-dvh min-h-dvh overflow-hidden bg-background dark:bg-sidebar">
        <div className="absolute left-4 top-4 z-40">
          <SidebarTrigger
            className="size-10 border border-white/10 bg-black/35 text-white/75 backdrop-blur-sm hover:bg-black/45 hover:text-white"
          />
        </div>

        <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
          {children}
        </div>
      </SidebarInset>

      <FloatingAssistant />
    </SidebarProvider>
  );
}
