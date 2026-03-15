import { describe, expect, test } from "bun:test";

import {
  buildAchievementSnapshot,
  resolveEarnedAchievements,
} from "./achievement-rules";

describe("achievements", () => {
  test("computes streak and pnl milestones from ordered trade history", () => {
    const now = new Date("2026-03-15T12:00:00.000Z");
    const oneDay = 24 * 60 * 60 * 1000;
    const trades = [
      { profit: "120", createdAt: new Date(now.getTime() - oneDay * 5) },
      { profit: "80", createdAt: new Date(now.getTime() - oneDay * 4) },
      { profit: "65", createdAt: new Date(now.getTime() - oneDay * 3) },
      { profit: "40", createdAt: new Date(now.getTime() - oneDay * 2) },
      { profit: "25", createdAt: new Date(now.getTime() - oneDay) },
      { profit: "-10", createdAt: now },
    ];

    const snapshot = buildAchievementSnapshot(trades);
    const earned = resolveEarnedAchievements(snapshot).map((item) => item.id);

    expect(snapshot.totalTrades).toBe(6);
    expect(snapshot.totalPnl).toBe(320);
    expect(snapshot.maxWinStreak).toBe(5);
    expect(snapshot.maxGreenStreak).toBe(5);
    expect(earned).toContain("first_trade");
    expect(earned).toContain("win_streak_5");
    expect(earned).toContain("green_week");
  });
});
