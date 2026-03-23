import { describe, expect, it } from "bun:test";

import {
  parseManualTradeCapture,
  parseManualTradeCaptureBulk,
  parseManualTradeCaptureLine,
} from "./manual-trade-capture";

describe("manual trade capture", () => {
  it("parses free text and derives hidden fields", () => {
    const result = parseManualTradeCapture(
      "Long EURUSD 0.5 entry 1.0850 exit 1.0900 sl 1.0820 tp 1.0915 pnl +250 commission -5 swap 0 open 2026-03-21 09:30 close 2026-03-21 10:15",
      {
        referenceDate: new Date("2026-03-21T12:00:00Z"),
        resolvePipSize: () => 0.0001,
        resolveContractSize: () => 100000,
      }
    );

    expect(result.kind).toBe("single");
    if (result.kind !== "single") return;

    expect(result.fields.symbol.value).toBe("EURUSD");
    expect(result.fields.direction.value).toBe("long");
    expect(result.fields.volume.value).toBe(0.5);
    expect(result.derived.estimatedPips.value).toBeCloseTo(50);
    expect(result.derived.estimatedProfit.value).toBeCloseTo(250);
    expect(result.derived.netPnl.value).toBeCloseTo(245);
    expect(result.derived.plannedRR.value).toBeCloseTo(2.1666666667);
  });

  it("parses a headered delimited row", () => {
    const result = parseManualTradeCaptureBulk(
      "symbol,direction,volume,openPrice,closePrice,sl,tp,profit,openTime,closeTime\nEURUSD,long,1,1.085,1.09,1.082,1.092,500,2026-03-21 09:30,2026-03-21 10:00",
      {
        resolvePipSize: () => 0.0001,
        resolveContractSize: () => 100000,
      }
    );

    expect(result.kind).toBe("bulk");
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.fields.symbol.value).toBe("EURUSD");
    expect(row.fields.openPrice.value).toBe(1.085);
    expect(row.derived.holdSeconds.value).toBe(1800);
  });

  it("handles a single delimited row without a header", () => {
    const result = parseManualTradeCaptureLine(
      "EURUSD,long,1,1.085,1.09,1.082,1.092,500,5,-1,2026-03-21 09:30,2026-03-21 10:00,fast scalp"
    );

    expect(result.kind).toBe("single");
    expect(result.fields.symbol.value).toBe("EURUSD");
    expect(result.fields.direction.value).toBe("long");
  });
});
