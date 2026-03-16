import { Suspense } from "react";
import EconomicCalendar from "@/features/dashboard/economic-calendar/components/economic-calendar";
import { isPublicAlphaFeatureEnabled } from "@/lib/alpha-flags";
import { AlphaFeatureLocked } from "@/features/platform/alpha/components/alpha-feature-locked";

export default function NewsPage() {
  if (!isPublicAlphaFeatureEnabled("community")) {
    return (
      <AlphaFeatureLocked
        feature="community"
        title="News is held back in this alpha"
      />
    );
  }

  return (
    <main className="p-6 space-y-4 py-4">
      <Suspense fallback={<div> Loading economic calendar...</div>}>
        <EconomicCalendar />
      </Suspense>
    </main>
  );
}
