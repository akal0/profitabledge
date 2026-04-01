import { Suspense } from "react";
import TradeTableInfinite from "./components/trade-table-infinite";
import { TradeTableRouteSkeleton } from "./components/trade-table-route-skeleton";

const TradesPage = () => {
  return (
    <main className="p-6 space-y-4 py-4">
      <Suspense
        fallback={<TradeTableRouteSkeleton className="min-h-full" />}
      >
        <TradeTableInfinite />
      </Suspense>
    </main>
  );
};

export default TradesPage;
