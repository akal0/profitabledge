import type { Metadata } from "next";
import { Suspense } from "react";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";

export const metadata: Metadata = { title: "Alerts" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<RouteLoadingFallback route="settingsAlerts" />}>
      {children}
    </Suspense>
  );
}
