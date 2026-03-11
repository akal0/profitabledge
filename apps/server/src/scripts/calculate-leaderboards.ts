#!/usr/bin/env bun
/**
 * Calculate Leaderboards Script
 *
 * Run this script periodically (e.g., daily via cron) to calculate
 * leaderboard rankings for all verified accounts.
 *
 * Usage:
 *   bun run src/scripts/calculate-leaderboards.ts
 *
 * Cron example (daily at 3 AM):
 *   0 3 * * * cd /path/to/apps/server && bun run src/scripts/calculate-leaderboards.ts
 */

import { calculateAllLeaderboards } from "../lib/leaderboard-calculator";

async function main() {
  console.log("[Leaderboard] Starting leaderboard calculation...");
  console.log("[Leaderboard] Time:", new Date().toISOString());

  try {
    await calculateAllLeaderboards();
    console.log("[Leaderboard] ✅ All leaderboards calculated successfully");
    process.exit(0);
  } catch (error) {
    console.error("[Leaderboard] ❌ Failed to calculate leaderboards:");
    console.error(error);
    process.exit(1);
  }
}

main();
