"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function TradesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="p-6 space-y-4 py-4">
      <div className="bg-sidebar border border-white/5 rounded-md p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-sm border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-amber-300">
              <AlertTriangle className="size-3.5" />
              Trades route
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">
                Something went wrong
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-white/55">
                {error.message ||
                  "We couldn't finish loading your trades workspace. Try again to restore the table, filters, and summary cards."}
              </p>
            </div>
          </div>

          <Button
            type="button"
            className="h-9 rounded-sm px-4 text-xs"
            onClick={() => reset()}
          >
            Retry
          </Button>
        </div>
      </div>
    </main>
  );
}
