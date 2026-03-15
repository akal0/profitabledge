"use client";

import { AppSidebar } from "@/features/navigation/components/app-sidebar";
import { SettingsSidebar } from "@/components/settings-sidebar";
import { BacktestSidebar } from "@/components/backtest-sidebar";

export function DashboardShellSidebar({ pathname }: { pathname: string }) {
  if (pathname.startsWith("/dashboard/settings")) {
    return <SettingsSidebar />;
  }

  if (pathname.startsWith("/dashboard/backtest") && !pathname.includes("/replay")) {
    return <BacktestSidebar />;
  }

  return <AppSidebar />;
}
