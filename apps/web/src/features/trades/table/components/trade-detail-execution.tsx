"use client";

import type { TradeRow } from "@/features/trades/table/lib/trade-table-types";

import { TradeDetailSection, TradeDetailStaticRow } from "./trade-detail-shared";

type TradeDetailExecutionProps = {
  trade: TradeRow;
};

export function TradeDetailExecution({ trade }: TradeDetailExecutionProps) {
  const hasExecutionData = Boolean(
    trade.openText ||
      trade.closeText ||
      trade.closeReason ||
      trade.entrySource ||
      trade.exitSource ||
      trade.executionMode ||
      trade.magicNumber != null
  );

  if (!hasExecutionData) {
    return null;
  }

  return (
    <TradeDetailSection title="Execution" bodyClassName="space-y-5">
      {(trade.openText || trade.closeText) && (
        <div className="space-y-3">
          {trade.openText ? (
            <div className="text-sm">
              <span className="text-white/50">Entry:</span>{" "}
              <span className="text-white/80">{trade.openText}</span>
            </div>
          ) : null}
          {trade.closeText ? (
            <div className="text-sm">
              <span className="text-white/50">Exit:</span>{" "}
              <span className="text-white/80">{trade.closeText}</span>
            </div>
          ) : null}
        </div>
      )}

      <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
        <TradeDetailStaticRow label="Close reason" value={trade.closeReason || "—"} />
        <TradeDetailStaticRow label="Entry source" value={trade.entrySource || "—"} />
        <TradeDetailStaticRow label="Exit source" value={trade.exitSource || "—"} />
        <TradeDetailStaticRow label="Execution mode" value={trade.executionMode || "—"} />
        <TradeDetailStaticRow
          label="Magic number"
          value={trade.magicNumber != null ? trade.magicNumber : "—"}
        />
        <TradeDetailStaticRow
          label="Created"
          value={new Date(trade.createdAtISO).toLocaleString()}
        />
      </div>
    </TradeDetailSection>
  );
}
