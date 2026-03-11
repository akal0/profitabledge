import { db } from "../db";
import { propFirm, propChallengeRule } from "../db/schema/trading";

/**
 * Seed prop firm data for the prop firm challenge tracker
 * Run: bun run apps/server/src/scripts/seed-prop-firms.ts
 */

async function seedPropFirms() {
  console.log("🌱 Seeding prop firm data...");

  try {
    // 1. FTMO
    const ftmo = await db
      .insert(propFirm)
      .values({
        id: "ftmo",
        name: "FTMO",
        displayName: "FTMO",
        description: "One of the world's leading prop trading firms with a proven track record since 2015.",
        logo: "/prop-logos/ftmo.png",
        website: "https://ftmo.com",
        supportedPlatforms: ["mt4", "mt5", "ctrader"],
        brokerDetectionPatterns: ["FTMO", "ftmo", "FTMO-Demo", "FTMO-Live", "FTMO-Server"],
        active: true,
      })
      .onConflictDoUpdate({
        target: propFirm.id,
        set: {
          displayName: "FTMO",
          description: "One of the world's leading prop trading firms with a proven track record since 2015.",
          website: "https://ftmo.com",
          supportedPlatforms: ["mt4", "mt5", "ctrader"],
          brokerDetectionPatterns: ["FTMO", "ftmo", "FTMO-Demo", "FTMO-Live", "FTMO-Server"],
          updatedAt: new Date(),
        },
      })
      .returning();

    console.log("✅ FTMO prop firm created/updated");

    // FTMO 2-Step Challenge
    await db
      .insert(propChallengeRule)
      .values({
        id: "ftmo-2step",
        propFirmId: "ftmo",
        challengeType: "standard",
        displayName: "FTMO 2-Step Challenge",
        phases: [
          {
            order: 1,
            name: "Phase 1 - FTMO Challenge",
            profitTarget: 10,
            profitTargetType: "percentage",
            dailyLossLimit: 5,
            maxLoss: 10,
            maxLossType: "absolute",
            timeLimitDays: null,
            minTradingDays: 4,
            consistencyRule: null,
            customRules: {
              description: "Achieve 10% profit while staying within risk limits",
            },
          },
          {
            order: 2,
            name: "Phase 2 - Verification",
            profitTarget: 5,
            profitTargetType: "percentage",
            dailyLossLimit: 5,
            maxLoss: 10,
            maxLossType: "absolute",
            timeLimitDays: null,
            minTradingDays: 4,
            consistencyRule: null,
            customRules: {
              description: "Achieve 5% profit to unlock your funded account",
            },
          },
          {
            order: 0,
            name: "Funded Account",
            profitTarget: null,
            profitTargetType: "percentage",
            dailyLossLimit: 5,
            maxLoss: 10,
            maxLossType: "absolute",
            timeLimitDays: null,
            minTradingDays: 0,
            consistencyRule: null,
            customRules: {
              profitSplit: 80,
              profitSplitScaled: 90,
              description: "80% profit split (90% after scaling)",
            },
          },
        ],
        active: true,
      })
      .onConflictDoUpdate({
        target: propChallengeRule.id,
        set: {
          displayName: "FTMO 2-Step Challenge",
          phases: [
            {
              order: 1,
              name: "Phase 1 - FTMO Challenge",
              profitTarget: 10,
              profitTargetType: "percentage",
              dailyLossLimit: 5,
              maxLoss: 10,
              maxLossType: "absolute",
              timeLimitDays: null,
              minTradingDays: 4,
              consistencyRule: null,
              customRules: {
                description: "Achieve 10% profit while staying within risk limits",
              },
            },
            {
              order: 2,
              name: "Phase 2 - Verification",
              profitTarget: 5,
              profitTargetType: "percentage",
              dailyLossLimit: 5,
              maxLoss: 10,
              maxLossType: "absolute",
              timeLimitDays: null,
              minTradingDays: 4,
              consistencyRule: null,
              customRules: {
                description: "Achieve 5% profit to unlock your funded account",
              },
            },
            {
              order: 0,
              name: "Funded Account",
              profitTarget: null,
              profitTargetType: "percentage",
              dailyLossLimit: 5,
              maxLoss: 10,
              maxLossType: "absolute",
              timeLimitDays: null,
              minTradingDays: 0,
              consistencyRule: null,
              customRules: {
                profitSplit: 80,
                profitSplitScaled: 90,
                description: "80% profit split (90% after scaling)",
              },
            },
          ],
          updatedAt: new Date(),
        },
      })
      .returning();

    console.log("✅ FTMO 2-Step Challenge created/updated");

    // 2. FundedNext
    await db
      .insert(propFirm)
      .values({
        id: "fundednext",
        name: "FundedNext",
        displayName: "FundedNext",
        description: "Fast-growing prop firm offering flexible evaluation programs with competitive profit splits.",
        logo: "/prop-logos/fundednext.png",
        website: "https://fundednext.com",
        supportedPlatforms: ["mt4", "mt5"],
        brokerDetectionPatterns: ["FundedNext", "fundednext", "ThinkCapital", "thinkcapital"],
        active: true,
      })
      .onConflictDoUpdate({
        target: propFirm.id,
        set: {
          displayName: "FundedNext",
          description: "Fast-growing prop firm offering flexible evaluation programs with competitive profit splits.",
          website: "https://fundednext.com",
          supportedPlatforms: ["mt4", "mt5"],
          brokerDetectionPatterns: ["FundedNext", "fundednext", "ThinkCapital", "thinkcapital"],
          updatedAt: new Date(),
        },
      })
      .returning();

    console.log("✅ FundedNext prop firm created/updated");

    // FundedNext Stellar 2-Step
    await db
      .insert(propChallengeRule)
      .values({
        id: "fundednext-stellar",
        propFirmId: "fundednext",
        challengeType: "stellar",
        displayName: "Stellar 2-Step Challenge",
        phases: [
          {
            order: 1,
            name: "Phase 1",
            profitTarget: 8,
            profitTargetType: "percentage",
            dailyLossLimit: 5,
            maxLoss: 10,
            maxLossType: "absolute",
            timeLimitDays: null,
            minTradingDays: 5,
            consistencyRule: null,
            customRules: {
              description: "Achieve 8% profit with minimum 5 trading days",
            },
          },
          {
            order: 2,
            name: "Phase 2",
            profitTarget: 5,
            profitTargetType: "percentage",
            dailyLossLimit: 5,
            maxLoss: 10,
            maxLossType: "absolute",
            timeLimitDays: null,
            minTradingDays: 5,
            consistencyRule: null,
            customRules: {
              description: "Achieve 5% profit with minimum 5 trading days",
            },
          },
          {
            order: 0,
            name: "Funded Account",
            profitTarget: null,
            profitTargetType: "percentage",
            dailyLossLimit: 5,
            maxLoss: 10,
            maxLossType: "absolute",
            timeLimitDays: null,
            minTradingDays: 0,
            consistencyRule: null,
            customRules: {
              profitSplit: 80,
              profitSplitScaled: 90,
              description: "80-90% profit split",
            },
          },
        ],
        active: true,
      })
      .onConflictDoUpdate({
        target: propChallengeRule.id,
        set: {
          displayName: "Stellar 2-Step Challenge",
          updatedAt: new Date(),
        },
      })
      .returning();

    console.log("✅ FundedNext Stellar 2-Step Challenge created/updated");

    // 3. E8 Funding / E8 Markets
    await db
      .insert(propFirm)
      .values({
        id: "e8markets",
        name: "E8Markets",
        displayName: "E8 Markets",
        description: "Innovative prop firm offering multiple challenge types with high profit splits up to 100%.",
        logo: "/prop-logos/e8markets.png",
        website: "https://e8markets.com",
        supportedPlatforms: ["ctrader", "tradelocker", "match-trader"],
        brokerDetectionPatterns: ["E8", "e8", "E8Markets", "e8markets", "E8Funding", "e8funding"],
        active: true,
      })
      .onConflictDoUpdate({
        target: propFirm.id,
        set: {
          displayName: "E8 Markets",
          description: "Innovative prop firm offering multiple challenge types with high profit splits up to 100%.",
          website: "https://e8markets.com",
          supportedPlatforms: ["ctrader", "tradelocker", "match-trader"],
          brokerDetectionPatterns: ["E8", "e8", "E8Markets", "e8markets", "E8Funding", "e8funding"],
          updatedAt: new Date(),
        },
      })
      .returning();

    console.log("✅ E8 Markets prop firm created/updated");

    // E8 Standard 2-Step
    await db
      .insert(propChallengeRule)
      .values({
        id: "e8-standard",
        propFirmId: "e8markets",
        challengeType: "standard",
        displayName: "E8 Standard 2-Step",
        phases: [
          {
            order: 1,
            name: "Phase 1",
            profitTarget: 8,
            profitTargetType: "percentage",
            dailyLossLimit: 5,
            maxLoss: 8,
            maxLossType: "absolute",
            timeLimitDays: 30,
            minTradingDays: 0,
            consistencyRule: null,
            customRules: {
              description: "Achieve 8% profit in 30 days",
            },
          },
          {
            order: 2,
            name: "Phase 2",
            profitTarget: 5,
            profitTargetType: "percentage",
            dailyLossLimit: 5,
            maxLoss: 8,
            maxLossType: "absolute",
            timeLimitDays: 60,
            minTradingDays: 0,
            consistencyRule: null,
            customRules: {
              description: "Achieve 5% profit in 60 days",
            },
          },
          {
            order: 0,
            name: "Funded Account",
            profitTarget: null,
            profitTargetType: "percentage",
            dailyLossLimit: 5,
            maxLoss: 8,
            maxLossType: "absolute",
            timeLimitDays: null,
            minTradingDays: 0,
            consistencyRule: 40,
            customRules: {
              profitSplit: 80,
              profitSplitMax: 100,
              description: "80-100% profit split. Consistency rule: no single day > 40% of total profit",
              bestDayRule: "Best day cannot exceed 40% of total profit",
            },
          },
        ],
        active: true,
      })
      .onConflictDoUpdate({
        target: propChallengeRule.id,
        set: {
          displayName: "E8 Standard 2-Step",
          updatedAt: new Date(),
        },
      })
      .returning();

    console.log("✅ E8 Standard 2-Step Challenge created/updated");

    // 4. The5ers
    await db
      .insert(propFirm)
      .values({
        id: "the5ers",
        name: "The5ers",
        displayName: "The5%ers",
        description: "Trader-focused prop firm with flexible evaluation and high profit splits up to 100%.",
        logo: "/prop-logos/the5ers.png",
        website: "https://the5ers.com",
        supportedPlatforms: ["mt4", "mt5"],
        brokerDetectionPatterns: ["The5ers", "the5ers", "5ers", "The5%ers"],
        active: true,
      })
      .onConflictDoUpdate({
        target: propFirm.id,
        set: {
          displayName: "The5%ers",
          description: "Trader-focused prop firm with flexible evaluation and high profit splits up to 100%.",
          website: "https://the5ers.com",
          supportedPlatforms: ["mt4", "mt5"],
          brokerDetectionPatterns: ["The5ers", "the5ers", "5ers", "The5%ers"],
          updatedAt: new Date(),
        },
      })
      .returning();

    console.log("✅ The5ers prop firm created/updated");

    // The5ers High Stakes 2-Step
    await db
      .insert(propChallengeRule)
      .values({
        id: "the5ers-highstakes",
        propFirmId: "the5ers",
        challengeType: "highstakes",
        displayName: "High Stakes 2-Step",
        phases: [
          {
            order: 1,
            name: "Step 1",
            profitTarget: 8,
            profitTargetType: "percentage",
            dailyLossLimit: 5,
            maxLoss: 10,
            maxLossType: "absolute",
            timeLimitDays: null,
            minTradingDays: 3,
            consistencyRule: null,
            customRules: {
              description: "Achieve 8% profit with minimum 3 trading days",
              profitableDay: "Day with at least 0.5% profit",
            },
          },
          {
            order: 2,
            name: "Step 2",
            profitTarget: 5,
            profitTargetType: "percentage",
            dailyLossLimit: 5,
            maxLoss: 10,
            maxLossType: "absolute",
            timeLimitDays: null,
            minTradingDays: 3,
            consistencyRule: null,
            customRules: {
              description: "Achieve 5% profit with minimum 3 trading days",
              profitableDay: "Day with at least 0.5% profit",
            },
          },
          {
            order: 0,
            name: "Funded Account",
            profitTarget: null,
            profitTargetType: "percentage",
            dailyLossLimit: 5,
            maxLoss: 10,
            maxLossType: "absolute",
            timeLimitDays: null,
            minTradingDays: 0,
            consistencyRule: null,
            customRules: {
              profitSplit: 80,
              profitSplitMax: 100,
              description: "80-100% profit split. First payout after 14 days.",
            },
          },
        ],
        active: true,
      })
      .onConflictDoUpdate({
        target: propChallengeRule.id,
        set: {
          displayName: "High Stakes 2-Step",
          updatedAt: new Date(),
        },
      })
      .returning();

    console.log("✅ The5ers High Stakes 2-Step Challenge created/updated");

    // 5. MyForexFunds (MFF)
    await db
      .insert(propFirm)
      .values({
        id: "myforexfunds",
        name: "MyForexFunds",
        displayName: "MyForexFunds",
        description: "Global prop trading firm with progressive profit splits (75% → 85%).",
        logo: "/prop-logos/myforexfunds.png",
        website: "https://myforexfunds.com",
        supportedPlatforms: ["mt4", "mt5"],
        brokerDetectionPatterns: ["MyForexFunds", "myforexfunds", "MFF", "mff"],
        active: true,
      })
      .onConflictDoUpdate({
        target: propFirm.id,
        set: {
          displayName: "MyForexFunds",
          description: "Global prop trading firm with progressive profit splits (75% → 85%).",
          website: "https://myforexfunds.com",
          supportedPlatforms: ["mt4", "mt5"],
          brokerDetectionPatterns: ["MyForexFunds", "myforexfunds", "MFF", "mff"],
          updatedAt: new Date(),
        },
      })
      .returning();

    console.log("✅ MyForexFunds prop firm created/updated");

    // MFF 2-Step Evaluation
    await db
      .insert(propChallengeRule)
      .values({
        id: "mff-evaluation",
        propFirmId: "myforexfunds",
        challengeType: "evaluation",
        displayName: "MFF 2-Step Evaluation",
        phases: [
          {
            order: 1,
            name: "Phase 1",
            profitTarget: 8,
            profitTargetType: "percentage",
            dailyLossLimit: 5,
            maxLoss: 12,
            maxLossType: "absolute",
            timeLimitDays: null,
            minTradingDays: 0,
            consistencyRule: null,
            customRules: {
              description: "Achieve 8% profit with unlimited time",
            },
          },
          {
            order: 2,
            name: "Phase 2",
            profitTarget: 5,
            profitTargetType: "percentage",
            dailyLossLimit: 5,
            maxLoss: 12,
            maxLossType: "absolute",
            timeLimitDays: null,
            minTradingDays: 0,
            consistencyRule: null,
            customRules: {
              description: "Achieve 5% profit with unlimited time",
            },
          },
          {
            order: 0,
            name: "Funded Account",
            profitTarget: null,
            profitTargetType: "percentage",
            dailyLossLimit: 5,
            maxLoss: 12,
            maxLossType: "absolute",
            timeLimitDays: null,
            minTradingDays: 0,
            consistencyRule: null,
            customRules: {
              profitSplit: 75,
              profitSplitMonth2: 80,
              profitSplitMonth3Plus: 85,
              description: "Progressive profit split: 75% (month 1), 80% (month 2), 85% (month 3+)",
            },
          },
        ],
        active: true,
      })
      .onConflictDoUpdate({
        target: propChallengeRule.id,
        set: {
          displayName: "MFF 2-Step Evaluation",
          updatedAt: new Date(),
        },
      })
      .returning();

    console.log("✅ MyForexFunds 2-Step Evaluation created/updated");

    // 6. Topstep (Futures)
    await db
      .insert(propFirm)
      .values({
        id: "topstep",
        name: "Topstep",
        displayName: "Topstep",
        description: "Leading futures prop firm with the Trading Combine evaluation program.",
        logo: "/prop-logos/topstep.png",
        website: "https://topstep.com",
        supportedPlatforms: ["topstepx", "ninjatrader", "tradingview"],
        brokerDetectionPatterns: ["Topstep", "topstep", "TopstepX"],
        active: true,
      })
      .onConflictDoUpdate({
        target: propFirm.id,
        set: {
          displayName: "Topstep",
          description: "Leading futures prop firm with the Trading Combine evaluation program.",
          website: "https://topstep.com",
          supportedPlatforms: ["topstepx", "ninjatrader", "tradingview"],
          brokerDetectionPatterns: ["Topstep", "topstep", "TopstepX"],
          updatedAt: new Date(),
        },
      })
      .returning();

    console.log("✅ Topstep prop firm created/updated");

    // Topstep Trading Combine
    await db
      .insert(propChallengeRule)
      .values({
        id: "topstep-combine",
        propFirmId: "topstep",
        challengeType: "combine",
        displayName: "Trading Combine",
        phases: [
          {
            order: 1,
            name: "Trading Combine",
            profitTarget: 3000,
            profitTargetType: "absolute",
            dailyLossLimit: null,
            maxLoss: 2000,
            maxLossType: "absolute",
            timeLimitDays: null,
            minTradingDays: 0,
            consistencyRule: null,
            customRules: {
              description: "Achieve $3k profit (50k account) or $6k (100k) or $9k (150k)",
              accountSizes: {
                "50k": { profitTarget: 3000, maxLoss: 2000 },
                "100k": { profitTarget: 6000, maxLoss: 3000 },
                "150k": { profitTarget: 9000, maxLoss: 4500 },
              },
              dailyLossCustomizable: true,
              consistencyRuleApplies: true,
            },
          },
          {
            order: 0,
            name: "Express Funded Account",
            profitTarget: null,
            profitTargetType: "absolute",
            dailyLossLimit: null,
            maxLoss: null,
            maxLossType: "absolute",
            timeLimitDays: null,
            minTradingDays: 0,
            consistencyRule: null,
            customRules: {
              profitSplit: 80,
              activationFee: 149,
              description: "80% profit split. $149 activation fee, no monthly subscription.",
            },
          },
        ],
        active: true,
      })
      .onConflictDoUpdate({
        target: propChallengeRule.id,
        set: {
          displayName: "Trading Combine",
          updatedAt: new Date(),
        },
      })
      .returning();

    console.log("✅ Topstep Trading Combine created/updated");

    console.log("\n🎉 Prop firm seeding completed successfully!");
    console.log("\nSeeded firms:");
    console.log("  1. FTMO (2-Step Challenge)");
    console.log("  2. FundedNext (Stellar 2-Step)");
    console.log("  3. E8 Markets (Standard 2-Step)");
    console.log("  4. The5%ers (High Stakes 2-Step)");
    console.log("  5. MyForexFunds (2-Step Evaluation)");
    console.log("  6. Topstep (Trading Combine)");
  } catch (error) {
    console.error("❌ Error seeding prop firms:", error);
    throw error;
  } finally {
    process.exit(0);
  }
}

// Run the seed function
seedPropFirms();
