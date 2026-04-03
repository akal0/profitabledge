import type { Metadata } from "next";
import { Suspense } from "react";

import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";

export const metadata: Metadata = { title: "Shop" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <RouteLoadingFallback
          route="settings"
          message="Opening the customization shop and laying out your profile loadout..."
        />
      }
    >
      {children}
    </Suspense>
  );
}
