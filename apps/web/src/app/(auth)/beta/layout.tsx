import type { Metadata } from "next";
import { Suspense } from "react";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";

export const metadata: Metadata = {
  title: { absolute: "profitabledge - Private beta" },
  description: "Enter your beta access code to join profitabledge.",
};

export default function BetaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<RouteLoadingFallback route="beta" className="min-h-screen" />}>
      {children}
    </Suspense>
  );
}
