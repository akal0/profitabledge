import { describe, expect, it } from "bun:test";

import { computeExecutionGrade } from "./execution-grade";

describe("computeExecutionGrade", () => {
  it("returns N/A when there is no execution dataset", () => {
    expect(
      computeExecutionGrade({
        tradeCount: 12,
        tradesWithExecutionData: 0,
        avgEntrySpread: null,
        avgExitSpread: null,
        avgEntrySlippage: null,
        avgExitSlippage: null,
        avgRrCaptureEfficiency: null,
        avgExitEfficiency: null,
      })
    ).toEqual({
      grade: "N/A",
      gradeScore: null,
      avgSpread: null,
      avgSlippage: null,
    });
  });

  it("scores based on available metrics instead of treating missing values as zero", () => {
    expect(
      computeExecutionGrade({
        tradeCount: 20,
        tradesWithExecutionData: 20,
        avgEntrySpread: 1.5,
        avgExitSpread: null,
        avgEntrySlippage: 0.2,
        avgExitSlippage: null,
        avgRrCaptureEfficiency: 72,
        avgExitEfficiency: 65,
      })
    ).toEqual({
      grade: "A",
      gradeScore: 95,
      avgSpread: 1.5,
      avgSlippage: 0.2,
    });
  });

  it("applies penalties across spreads, slippage, and efficiency", () => {
    expect(
      computeExecutionGrade({
        tradeCount: 18,
        tradesWithExecutionData: 18,
        avgEntrySpread: 2.4,
        avgExitSpread: 2.2,
        avgEntrySlippage: 1.1,
        avgExitSlippage: 0.9,
        avgRrCaptureEfficiency: 40,
        avgExitEfficiency: 48,
      })
    ).toEqual({
      grade: "F",
      gradeScore: 55,
      avgSpread: 2.3,
      avgSlippage: 1,
    });
  });
});
