import type { Metadata } from "next";
import { Suspense } from "react";

import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";

export const metadata: Metadata = { title: "Edges" };

export default function EdgesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={<RouteLoadingFallback route="edges" className="min-h-full" />}
    >
      {children}
    </Suspense>
  );
}
