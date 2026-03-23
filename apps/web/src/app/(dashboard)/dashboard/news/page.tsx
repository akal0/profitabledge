import { Suspense } from "react";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import EconomicCalendar from "@/features/dashboard/economic-calendar/components/economic-calendar";

export default function EconomicCalendarPage() {
  return (
    <main className="w-full space-y-4 p-6 py-4">
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
