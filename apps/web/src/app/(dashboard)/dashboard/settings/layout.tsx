import type { Metadata } from "next";
import { Suspense } from "react";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<RouteLoadingFallback route="settings" className="min-h-full" />}>
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto pb-12">{children}</div>
      </div>
    </Suspense>
  );
}
