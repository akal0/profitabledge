import type { Metadata } from "next";
import { Suspense } from "react";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";

export const metadata: Metadata = {
  title: { absolute: "profitabledge - Continue" },
  description: "Continue to your profitabledge account.",
};

export default function ContinueLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={<RouteLoadingFallback route="continue" className="min-h-screen" />}
    >
      {children}
    </Suspense>
  );
}
