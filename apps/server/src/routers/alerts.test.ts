import { beforeAll, describe, expect, mock, test } from "bun:test";

type EdgeConditionAlertCandidate = {
  tradeId: string;
  edgeId: string;
  edgeName: string;
  symbol: string | null;
  sessionTag: string | null;
  closeTime: Date | null;
  followedCount: number;
  brokenCount: number;
  notReviewedCount: number;
};

let evaluateEdgeConditionMetCandidates: (args: {
  threshold: number;
  thresholdUnit: "percent" | "usd" | "count";
  candidates: EdgeConditionAlertCandidate[];
}) => {
  candidate: EdgeConditionAlertCandidate;
  currentValue: number;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
} | null;

beforeAll(async () => {
  const procedureBuilder = {
    input() {
      return procedureBuilder;
    },
    query(handler: unknown) {
      return handler;
    },
    mutation(handler: unknown) {
      return handler;
    },
  };

  mock.module("../db", () => ({
    db: {},
  }));

  mock.module("../lib/trpc", () => ({
    router: (shape: unknown) => shape,
    protectedProcedure: procedureBuilder,
  }));

  mock.module("../lib/notifications", () => ({
    createNotification: async () => ({ skipped: false }),
  }));

  const alertsModule = await import("./alerts");
  evaluateEdgeConditionMetCandidates =
    alertsModule.evaluateEdgeConditionMetCandidates;
});

function createCandidate(
  overrides: Partial<EdgeConditionAlertCandidate> = {}
): EdgeConditionAlertCandidate {
  return {
    tradeId: "trade_1",
    edgeId: "edge_1",
    edgeName: "Standard Reaccumulation",
    symbol: "EURUSD",
    sessionTag: "London",
    closeTime: new Date("2026-03-27T10:00:00.000Z"),
    followedCount: 3,
    brokenCount: 0,
    notReviewedCount: 0,
    ...overrides,
  };
}

describe("evaluateEdgeConditionMetCandidates", () => {
  test("triggers when the most recent candidate clears the count threshold with no broken rules", () => {
    const result = evaluateEdgeConditionMetCandidates({
      threshold: 3,
      thresholdUnit: "count",
      candidates: [createCandidate()],
    });

    expect(result).not.toBeNull();
    expect(result?.currentValue).toBe(3);
    expect(result?.title).toBe("Edge Condition Met");
    expect(result?.message).toContain("Standard Reaccumulation");
    expect(result?.message).toContain("3 rules");
    expect(result?.metadata.tradeId).toBe("trade_1");
  });

  test("skips a broken candidate and returns the next qualifying recent trade", () => {
    const result = evaluateEdgeConditionMetCandidates({
      threshold: 2,
      thresholdUnit: "count",
      candidates: [
        createCandidate({
          tradeId: "trade_broken",
          followedCount: 4,
          brokenCount: 1,
        }),
        createCandidate({
          tradeId: "trade_clean",
          edgeId: "edge_2",
          edgeName: "NY Reversal",
          followedCount: 2,
          brokenCount: 0,
        }),
      ],
    });

    expect(result).not.toBeNull();
    expect(result?.candidate.tradeId).toBe("trade_clean");
    expect(result?.candidate.edgeId).toBe("edge_2");
  });

  test("supports percent thresholds using reviewed plus unreviewed applicable conditions", () => {
    const result = evaluateEdgeConditionMetCandidates({
      threshold: 75,
      thresholdUnit: "percent",
      candidates: [
        createCandidate({
          tradeId: "trade_percent",
          followedCount: 3,
          brokenCount: 0,
          notReviewedCount: 1,
        }),
      ],
    });

    expect(result).not.toBeNull();
    expect(result?.currentValue).toBe(75);
    expect(result?.message).toContain("75%");
  });

  test("does not trigger when there are broken edge conditions", () => {
    const result = evaluateEdgeConditionMetCandidates({
      threshold: 2,
      thresholdUnit: "count",
      candidates: [
        createCandidate({
          followedCount: 3,
          brokenCount: 1,
        }),
      ],
    });

    expect(result).toBeNull();
  });

  test("does not trigger for unsupported usd thresholds", () => {
    const result = evaluateEdgeConditionMetCandidates({
      threshold: 100,
      thresholdUnit: "usd",
      candidates: [createCandidate()],
    });

    expect(result).toBeNull();
  });
});
