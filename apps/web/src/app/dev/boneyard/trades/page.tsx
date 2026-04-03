import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  TradeTableInlineSkeleton,
  TradeTableRouteSkeleton,
} from "@/app/(dashboard)/dashboard/trades/components/trade-table-route-skeleton";

export const metadata: Metadata = {
  title: "Trades Boneyard Capture",
  robots: {
    index: false,
    follow: false,
  },
};

export default function TradesBoneyardCapturePage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <main className="min-h-screen w-full bg-background px-6 py-4">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-10">
        <TradeTableRouteSkeleton timeoutMs={60_000} />
        <TradeTableInlineSkeleton />
      </div>
    </main>
  );
}
