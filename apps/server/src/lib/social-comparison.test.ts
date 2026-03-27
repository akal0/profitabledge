import { describe, expect, it } from "bun:test";

import {
  buildMirrorComparisonData,
  calculateMirrorComparisonSideMetrics,
} from "./social-comparison";

describe("social comparison metrics", () => {
  it("falls back to open and close timestamps when tradeDurationSeconds is missing", () => {
    const metrics = calculateMirrorComparisonSideMetrics([
      {
        openTime: "2026-03-25T10:00:00.000Z",
        closeTime: "2026-03-25T10:45:00.000Z",
        rrCaptureEfficiency: "72.5",
        exitEfficiency: 64,
        protocolAlignment: "aligned",
      },
    ]);

    expect(metrics).toEqual({
      avgHoldTime: 2700,
      rrCaptureEfficiency: 72.5,
      exitEfficiency: 64,
      protocolRate: 1,
      sampleSize: 1,
    });
  });

  it("builds a comparison payload from two trade sets", () => {
    const comparison = buildMirrorComparisonData({
      mineTrades: [
        {
          tradeDurationSeconds: 1800,
          rrCaptureEfficiency: 80,
          exitEfficiency: 75,
          protocolAlignment: "aligned",
        },
        {
          tradeDurationSeconds: 3600,
          rrCaptureEfficiency: 60,
          exitEfficiency: 55,
          protocolAlignment: "against",
        },
      ],
      theirTrades: [
        {
          tradeDurationSeconds: 1200,
          rrCaptureEfficiency: 50,
          exitEfficiency: 45,
          protocolAlignment: "aligned",
        },
      ],
    });

    expect(comparison.comparisonData).toEqual({
      avgHoldTime: { mine: 2700, theirs: 1200 },
      rrCaptureEfficiency: { mine: 70, theirs: 50 },
      exitEfficiency: { mine: 65, theirs: 45 },
      protocolRate: { mine: 0.5, theirs: 1 },
    });
    expect(comparison.insights.length).toBeGreaterThan(0);
    expect(comparison.insights[0]).toContain("average hold time");
  });

  it("returns a no-data insight when one side has no closed trades", () => {
    const comparison = buildMirrorComparisonData({
      mineTrades: [],
      theirTrades: [
        {
          tradeDurationSeconds: 1200,
          rrCaptureEfficiency: 50,
          exitEfficiency: 45,
          protocolAlignment: "aligned",
        },
      ],
    });

    expect(comparison.insights).toEqual([
      "One or both accounts have no closed trades to compare yet.",
    ]);
  });
});
