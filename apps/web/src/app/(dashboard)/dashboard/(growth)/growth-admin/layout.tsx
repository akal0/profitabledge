import type { Metadata } from "next";
import { Suspense } from "react";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";

export const metadata: Metadata = {
  title: { absolute: "Growth admin" },
  description: "Growth admin of accounts.",
};

export default function GrowthAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<RouteLoadingFallback route="growthAdmin" />}>
      {children}
    </Suspense>
  );
}
