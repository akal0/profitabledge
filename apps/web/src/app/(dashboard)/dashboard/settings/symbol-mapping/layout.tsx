import type { Metadata } from "next";
import { Suspense } from "react";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";

export const metadata: Metadata = { title: "Symbol mapping" };

export default function SymbolMappingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={<RouteLoadingFallback route="settingsSymbolMapping" className="min-h-full" />}
    >
      {children}
    </Suspense>
  );
}
