import { Suspense } from "react";
import TradeTableInfinite from "./components/trade-table-infinite";

const TradesPage = () => {
  return (
    <main className="p-6 space-y-4 py-4">
      <Suspense
        fallback={
          <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
            Loading trades workspace...
          </div>
        }
      >
        <TradeTableInfinite />
      </Suspense>
    </main>
  );
};

export default TradesPage;
