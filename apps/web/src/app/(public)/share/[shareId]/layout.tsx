import { Suspense } from "react";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";

export default function SharedCardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<RouteLoadingFallback route="sharedCard" className="min-h-screen bg-background dark:bg-sidebar" />}>
      {children}
    </Suspense>
  );
}
