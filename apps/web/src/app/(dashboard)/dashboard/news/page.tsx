import { Suspense } from "react";
import EconomicCalendar from "@/components/dashboard/calendar/economic-calendar";

export default function NewsPage() {
  return (
    <main className="p-6 space-y-4 py-4">
      <Suspense>
        <EconomicCalendar />
      </Suspense>
    </main>
  );
}
