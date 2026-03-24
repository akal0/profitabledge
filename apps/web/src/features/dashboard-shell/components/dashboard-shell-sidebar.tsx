"use client";

import { AppSidebar } from "@/features/navigation/components/app-sidebar";
import { SettingsSidebar } from "@/components/settings-sidebar";
import { EdgesSidebar } from "@/components/edges/edges-sidebar";

export function DashboardShellSidebar({ pathname }: { pathname: string }) {
  if (pathname.startsWith("/dashboard/edges")) {
    return <EdgesSidebar />;
  }

  if (pathname.startsWith("/dashboard/settings")) {
    return <SettingsSidebar />;
  }

  return <AppSidebar />;
}
