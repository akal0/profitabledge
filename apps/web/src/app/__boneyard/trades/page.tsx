import type { Metadata } from "next";

import { TradeTableRouteSkeleton } from "@/app/(dashboard)/dashboard/trades/components/trade-table-route-skeleton";

export const metadata: Metadata = {
  title: "Trades Boneyard Capture",
  robots: {
    index: false,
    follow: false,
  },
};

export default function TradesBoneyardCapturePage() {
  return (
    <main className="min-h-screen w-full bg-background px-6 py-4">
      <TradeTableRouteSkeleton timeoutMs={60_000} />
    </main>
  );
}
