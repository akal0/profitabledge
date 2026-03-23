import { Suspense } from "react";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import TradeTableInfinite from "./components/trade-table-infinite";

const TradesPage = () => {
  return (
    <main className="p-6 space-y-4 py-4">
      <Suspense
        fallback={<RouteLoadingFallback route="trades" className="min-h-full" />}
      >
        <TradeTableInfinite />
      </Suspense>
    </main>
  );
};

export default TradesPage;
