import { Suspense } from "react";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import EconomicCalendar from "@/features/dashboard/economic-calendar/components/economic-calendar";
import { isPublicAlphaFeatureEnabled } from "@/lib/alpha-flags";
import { AlphaFeatureLocked } from "@/features/platform/alpha/components/alpha-feature-locked";

export default function EconomicCalendarPage() {
  if (!isPublicAlphaFeatureEnabled("community")) {
    return (
      <AlphaFeatureLocked
        feature="community"
        title="Economic calendar is held back in this alpha"
      />
    );
  }

  return (
    <main className="p-6 space-y-4 py-4">
      <Suspense
        fallback={
          <RouteLoadingFallback
            route="economicCalendar"
            className="min-h-[calc(100vh-10rem)]"
          />
        }
      >
        <EconomicCalendar />
      </Suspense>
    </main>
  );
}
