import type { Metadata } from "next";
import { Suspense } from "react";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<RouteLoadingFallback route="reports" className="min-h-full" />}>
      {children}
    </Suspense>
  );
}
