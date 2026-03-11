import { db } from "../db";
import { propFirm, propChallengeRule } from "../db/schema/trading";

/**
 * Seed additional prop firms (25+ firms beyond the original 6).
 * Run: bun run apps/server/src/scripts/seed-additional-prop-firms.ts
 *
 * This script is idempotent — uses onConflictDoUpdate.
 */

interface FirmSeed {
  id: string;
  name: string;
  displayName: string;
  description: string;
  website: string;
  supportedPlatforms: string[];
  brokerDetectionPatterns: string[];
  challenges: {
    id: string;
    challengeType: string;
    displayName: string;
    phases: {
      order: number;
      name: string;
      profitTarget: number;
      profitTargetType: "percentage" | "absolute";
      dailyLossLimit: number;
      maxLoss: number;
      maxLossType: "absolute" | "trailing";
      timeLimitDays: number | null;
      minTradingDays: number | null;
      consistencyRule: number | null;
    }[];
  }[];
}

const firms: FirmSeed[] = [
  // ──── CFD / FOREX PROP FIRMS ────
  {
    id: "fundingpips",
    name: "FundingPips",
    displayName: "FundingPips",
    description: "Popular prop firm with multiple platform support and competitive rules.",
    website: "https://fundingpips.com",
    supportedPlatforms: ["mt4", "mt5", "dxtrade", "ctrader"],
    brokerDetectionPatterns: ["FundingPips", "fundingpips", "FPips"],
    challenges: [{
      id: "fundingpips-2step",
      challengeType: "standard",
      displayName: "FundingPips 2-Step",
      phases: [
        { order: 1, name: "Phase 1", profitTarget: 8, profitTargetType: "percentage", dailyLossLimit: 5, maxLoss: 10, maxLossType: "absolute", timeLimitDays: null, minTradingDays: 3, consistencyRule: null },
        { order: 2, name: "Phase 2", profitTarget: 5, profitTargetType: "percentage", dailyLossLimit: 5, maxLoss: 10, maxLossType: "absolute", timeLimitDays: null, minTradingDays: 3, consistencyRule: null },
      ],
    }],
  },
  {
    id: "alpha-capital",
    name: "Alpha Capital Group",
    displayName: "Alpha Capital Group",
    description: "UK-based prop firm offering multiple platforms and account sizes up to $200K.",
    website: "https://alphacapitalgroup.uk",
    supportedPlatforms: ["mt4", "mt5", "match-trader", "ctrader"],
    brokerDetectionPatterns: ["AlphaCapital", "Alpha Capital", "ACG", "alpha-capital"],
    challenges: [{
      id: "alpha-capital-2step",
      challengeType: "standard",
      displayName: "Alpha Capital 2-Step",
      phases: [
        { order: 1, name: "Phase 1", profitTarget: 8, profitTargetType: "percentage", dailyLossLimit: 5, maxLoss: 10, maxLossType: "absolute", timeLimitDays: null, minTradingDays: 5, consistencyRule: null },
        { order: 2, name: "Phase 2", profitTarget: 5, profitTargetType: "percentage", dailyLossLimit: 5, maxLoss: 10, maxLossType: "absolute", timeLimitDays: null, minTradingDays: 5, consistencyRule: null },
      ],
    }],
  },
  {
    id: "maven-trading",
    name: "Maven Trading",
    displayName: "Maven Trading",
    description: "Prop firm offering MT5, Match-Trader, and cTrader with funded accounts up to $200K.",
    website: "https://maventrading.com",
    supportedPlatforms: ["mt5", "match-trader", "ctrader"],
    brokerDetectionPatterns: ["Maven", "MavenTrading", "maven-trading"],
    challenges: [{
      id: "maven-2step",
      challengeType: "standard",
      displayName: "Maven 2-Step",
      phases: [
        { order: 1, name: "Phase 1", profitTarget: 8, profitTargetType: "percentage", dailyLossLimit: 5, maxLoss: 10, maxLossType: "absolute", timeLimitDays: null, minTradingDays: 3, consistencyRule: null },
        { order: 2, name: "Phase 2", profitTarget: 5, profitTargetType: "percentage", dailyLossLimit: 5, maxLoss: 10, maxLossType: "absolute", timeLimitDays: null, minTradingDays: 3, consistencyRule: null },
      ],
    }],
  },
  {
    id: "goat-funded",
    name: "Goat Funded Trader",
    displayName: "Goat Funded Trader",
    description: "Fast-growing prop firm with competitive pricing and multiple account sizes.",
    website: "https://goatfundedtrader.com",
    supportedPlatforms: ["mt5", "ctrader"],
    brokerDetectionPatterns: ["GoatFunded", "Goat Funded", "GFT"],
    challenges: [{
      id: "goat-2step",
      challengeType: "standard",
      displayName: "Goat 2-Step",
      phases: [
        { order: 1, name: "Phase 1", profitTarget: 8, profitTargetType: "percentage", dailyLossLimit: 5, maxLoss: 10, maxLossType: "absolute", timeLimitDays: null, minTradingDays: 3, consistencyRule: null },
        { order: 2, name: "Phase 2", profitTarget: 4, profitTargetType: "percentage", dailyLossLimit: 5, maxLoss: 10, maxLossType: "absolute", timeLimitDays: null, minTradingDays: 3, consistencyRule: null },
      ],
    }],
  },
  {
    id: "brightfunded",
    name: "BrightFunded",
    displayName: "BrightFunded",
    description: "Multi-platform prop firm with TradeLocker, DXTrade, and cTrader support.",
    website: "https://brightfunded.com",
    supportedPlatforms: ["mt5", "dxtrade", "tradelocker", "ctrader"],
    brokerDetectionPatterns: ["BrightFunded", "brightfunded", "Bright-Funded"],
    challenges: [{
      id: "bright-2step",
      challengeType: "standard",
      displayName: "BrightFunded 2-Step",
      phases: [
        { order: 1, name: "Phase 1", profitTarget: 8, profitTargetType: "percentage", dailyLossLimit: 5, maxLoss: 10, maxLossType: "absolute", timeLimitDays: null, minTradingDays: 5, consistencyRule: null },
        { order: 2, name: "Phase 2", profitTarget: 5, profitTargetType: "percentage", dailyLossLimit: 5, maxLoss: 10, maxLossType: "absolute", timeLimitDays: null, minTradingDays: 5, consistencyRule: null },
      ],
    }],
  },
  {
    id: "dna-funded",
    name: "DNA Funded",
    displayName: "DNA Funded",
    description: "TradeLocker and DXTrade-based prop firm with flexible rules.",
    website: "https://dnafunded.com",
    supportedPlatforms: ["tradelocker", "dxtrade"],
    brokerDetectionPatterns: ["DNAFunded", "DNA Funded", "dna-funded"],
    challenges: [{
      id: "dna-2step",
      challengeType: "standard",
      displayName: "DNA 2-Step",
      phases: [
        { order: 1, name: "Phase 1", profitTarget: 10, profitTargetType: "percentage", dailyLossLimit: 5, maxLoss: 10, maxLossType: "absolute", timeLimitDays: null, minTradingDays: 5, consistencyRule: null },
        { order: 2, name: "Phase 2", profitTarget: 5, profitTargetType: "percentage", dailyLossLimit: 5, maxLoss: 10, maxLossType: "absolute", timeLimitDays: null, minTradingDays: 5, consistencyRule: null },
      ],
    }],
  },
  {
    id: "rebels-funding",
    name: "Rebels Funding",
    displayName: "Rebels Funding",
    description: "Multi-platform prop firm with MT4, MT5, and TradeLocker.",
    website: "https://rebelsfunding.com",
    supportedPlatforms: ["mt4", "mt5", "tradelocker"],
    brokerDetectionPatterns: ["RebelsFunding", "Rebels", "rebels-funding"],
    challenges: [{
      id: "rebels-2step",
      challengeType: "standard",
      displayName: "Rebels 2-Step",
      phases: [
        { order: 1, name: "Phase 1", profitTarget: 8, profitTargetType: "percentage", dailyLossLimit: 5, maxLoss: 10, maxLossType: "absolute", timeLimitDays: null, minTradingDays: 5, consistencyRule: null },
        { order: 2, name: "Phase 2", profitTarget: 5, profitTargetType: "percentage", dailyLossLimit: 5, maxLoss: 10, maxLossType: "absolute", timeLimitDays: null, minTradingDays: 5, consistencyRule: null },
      ],
    }],
  },
  {
    id: "city-traders-imperium",
    name: "City Traders Imperium",
    displayName: "City Traders Imperium",
    description: "London-based prop firm with unique scaling plans and mentorship.",
    website: "https://citytradersimperium.com",
    supportedPlatforms: ["mt5", "ctrader"],
    brokerDetectionPatterns: ["CTI", "CityTraders", "City Traders"],
    challenges: [{
      id: "cti-2step",
      challengeType: "standard",
      displayName: "CTI 2-Step",
      phases: [
        { order: 1, name: "Phase 1", profitTarget: 10, profitTargetType: "percentage", dailyLossLimit: 5, maxLoss: 10, maxLossType: "absolute", timeLimitDays: null, minTradingDays: 5, consistencyRule: null },
        { order: 2, name: "Phase 2", profitTarget: 5, profitTargetType: "percentage", dailyLossLimit: 5, maxLoss: 10, maxLossType: "absolute", timeLimitDays: null, minTradingDays: 5, consistencyRule: null },
      ],
    }],
  },
  {
    id: "lux-trading-firm",
    name: "Lux Trading Firm",
    displayName: "Lux Trading Firm",
    description: "Premium prop firm with unique evaluation and scaling to $10M.",
    website: "https://luxtradingfirm.com",
    supportedPlatforms: ["mt4", "mt5"],
    brokerDetectionPatterns: ["LuxTrading", "Lux Trading", "lux-trading"],
    challenges: [{
      id: "lux-2step",
      challengeType: "standard",
      displayName: "Lux 2-Step Evaluation",
      phases: [
        { order: 1, name: "Phase 1", profitTarget: 6, profitTargetType: "percentage", dailyLossLimit: 4, maxLoss: 6, maxLossType: "absolute", timeLimitDays: null, minTradingDays: 15, consistencyRule: null },
        { order: 2, name: "Phase 2", profitTarget: 4, profitTargetType: "percentage", dailyLossLimit: 4, maxLoss: 6, maxLossType: "absolute", timeLimitDays: null, minTradingDays: 15, consistencyRule: null },
      ],
    }],
  },
  {
    id: "true-forex-funds",
    name: "True Forex Funds",
    displayName: "True Forex Funds",
    description: "Prop firm focused on forex with MT4 and MT5.",
    website: "https://trueforexfunds.com",
    supportedPlatforms: ["mt4", "mt5"],
    brokerDetectionPatterns: ["TrueForex", "TFF", "True Forex"],
    challenges: [{
      id: "tff-1step",
      challengeType: "express",
      displayName: "TFF 1-Step Challenge",
      phases: [
        { order: 1, name: "Evaluation", profitTarget: 10, profitTargetType: "percentage", dailyLossLimit: 5, maxLoss: 10, maxLossType: "absolute", timeLimitDays: null, minTradingDays: 5, consistencyRule: null },
      ],
    }],
  },
  {
    id: "funded-trading-plus",
    name: "Funded Trading Plus",
    displayName: "Funded Trading Plus",
    description: "UK-regulated prop firm with instant funding options.",
    website: "https://fundedtradingplus.com",
    supportedPlatforms: ["mt5", "ctrader"],
    brokerDetectionPatterns: ["FundedTrading+", "FTP", "Funded Trading Plus"],
    challenges: [{
      id: "ftp-2step",
      challengeType: "standard",
      displayName: "FTP 2-Step",
      phases: [
        { order: 1, name: "Phase 1", profitTarget: 10, profitTargetType: "percentage", dailyLossLimit: 4, maxLoss: 6, maxLossType: "trailing", timeLimitDays: null, minTradingDays: 5, consistencyRule: null },
        { order: 2, name: "Phase 2", profitTarget: 5, profitTargetType: "percentage", dailyLossLimit: 4, maxLoss: 6, maxLossType: "trailing", timeLimitDays: null, minTradingDays: 5, consistencyRule: null },
      ],
    }],
  },
  {
    id: "fxify",
    name: "FXify",
    displayName: "FXify",
    description: "Modern prop firm with competitive rules and fast payouts.",
    website: "https://fxify.com",
    supportedPlatforms: ["mt5"],
    brokerDetectionPatterns: ["FXify", "fxify"],
    challenges: [{
      id: "fxify-2step",
      challengeType: "standard",
      displayName: "FXify 2-Step",
      phases: [
        { order: 1, name: "Phase 1", profitTarget: 10, profitTargetType: "percentage", dailyLossLimit: 5, maxLoss: 10, maxLossType: "absolute", timeLimitDays: null, minTradingDays: 5, consistencyRule: null },
        { order: 2, name: "Phase 2", profitTarget: 5, profitTargetType: "percentage", dailyLossLimit: 5, maxLoss: 10, maxLossType: "absolute", timeLimitDays: null, minTradingDays: 5, consistencyRule: null },
      ],
    }],
  },

  // ──── FUTURES PROP FIRMS ────
  {
    id: "apex-trader",
    name: "Apex Trader Funding",
    displayName: "Apex Trader Funding",
    description: "Leading futures prop firm. Rithmic/NinjaTrader. Trailing drawdown, no daily loss limit.",
    website: "https://apextraderfunding.com",
    supportedPlatforms: ["rithmic", "ninjatrader"],
    brokerDetectionPatterns: ["Apex", "ApexTrader", "ATF"],
    challenges: [{
      id: "apex-combine-50k",
      challengeType: "combine",
      displayName: "Apex $50K Combine",
      phases: [
        { order: 1, name: "Evaluation", profitTarget: 3000, profitTargetType: "absolute", dailyLossLimit: 0, maxLoss: 2500, maxLossType: "trailing", timeLimitDays: null, minTradingDays: 7, consistencyRule: null },
      ],
    }],
  },
  {
    id: "bulenox",
    name: "Bulenox",
    displayName: "Bulenox",
    description: "Futures prop firm with competitive pricing and Rithmic platform.",
    website: "https://bulenox.com",
    supportedPlatforms: ["rithmic", "ninjatrader"],
    brokerDetectionPatterns: ["Bulenox", "bulenox"],
    challenges: [{
      id: "bulenox-50k",
      challengeType: "combine",
      displayName: "Bulenox $50K",
      phases: [
        { order: 1, name: "Evaluation", profitTarget: 3000, profitTargetType: "absolute", dailyLossLimit: 1100, maxLoss: 2500, maxLossType: "trailing", timeLimitDays: null, minTradingDays: 5, consistencyRule: null },
      ],
    }],
  },
  {
    id: "elite-trader",
    name: "Elite Trader Funding",
    displayName: "Elite Trader Funding",
    description: "Futures prop firm with end-of-day trailing drawdown.",
    website: "https://elitetraderfunding.com",
    supportedPlatforms: ["rithmic", "ninjatrader"],
    brokerDetectionPatterns: ["EliteTrader", "ETF", "Elite Trader"],
    challenges: [{
      id: "elite-50k",
      challengeType: "combine",
      displayName: "Elite $50K",
      phases: [
        { order: 1, name: "Evaluation", profitTarget: 3000, profitTargetType: "absolute", dailyLossLimit: 1100, maxLoss: 2500, maxLossType: "trailing", timeLimitDays: null, minTradingDays: 5, consistencyRule: null },
      ],
    }],
  },
  {
    id: "tradeday",
    name: "TradeDay",
    displayName: "TradeDay",
    description: "Futures prop firm with Rithmic and competitive combine rules.",
    website: "https://tradeday.com",
    supportedPlatforms: ["rithmic", "ninjatrader"],
    brokerDetectionPatterns: ["TradeDay", "tradeday"],
    challenges: [{
      id: "tradeday-50k",
      challengeType: "combine",
      displayName: "TradeDay $50K",
      phases: [
        { order: 1, name: "Evaluation", profitTarget: 3000, profitTargetType: "absolute", dailyLossLimit: 1000, maxLoss: 2500, maxLossType: "trailing", timeLimitDays: null, minTradingDays: 5, consistencyRule: null },
      ],
    }],
  },
  {
    id: "earn2trade",
    name: "Earn2Trade",
    displayName: "Earn2Trade",
    description: "Educational futures prop firm with the Gauntlet Mini evaluation.",
    website: "https://earn2trade.com",
    supportedPlatforms: ["rithmic", "ninjatrader"],
    brokerDetectionPatterns: ["Earn2Trade", "earn2trade", "E2T"],
    challenges: [{
      id: "e2t-gauntlet-50k",
      challengeType: "gauntlet",
      displayName: "Gauntlet Mini $50K",
      phases: [
        { order: 1, name: "Gauntlet", profitTarget: 3000, profitTargetType: "absolute", dailyLossLimit: 1100, maxLoss: 2000, maxLossType: "trailing", timeLimitDays: null, minTradingDays: 15, consistencyRule: null },
      ],
    }],
  },
  {
    id: "myfunded-futures",
    name: "MyFunded Futures",
    displayName: "MyFunded Futures",
    description: "Futures prop firm with static drawdown options.",
    website: "https://myfundedfutures.com",
    supportedPlatforms: ["rithmic", "ninjatrader"],
    brokerDetectionPatterns: ["MyFundedFutures", "MFF-Futures"],
    challenges: [{
      id: "mff-50k",
      challengeType: "combine",
      displayName: "MyFunded $50K",
      phases: [
        { order: 1, name: "Evaluation", profitTarget: 3000, profitTargetType: "absolute", dailyLossLimit: 1100, maxLoss: 2500, maxLossType: "trailing", timeLimitDays: null, minTradingDays: 5, consistencyRule: null },
      ],
    }],
  },
  {
    id: "leeloo-trading",
    name: "Leeloo Trading",
    displayName: "Leeloo Trading",
    description: "Futures prop firm with realistic evaluation and progressive scaling.",
    website: "https://leelootrading.com",
    supportedPlatforms: ["rithmic", "ninjatrader"],
    brokerDetectionPatterns: ["Leeloo", "LeelooTrading", "leeloo"],
    challenges: [{
      id: "leeloo-50k",
      challengeType: "combine",
      displayName: "Leeloo $50K",
      phases: [
        { order: 1, name: "Evaluation", profitTarget: 3000, profitTargetType: "absolute", dailyLossLimit: 1100, maxLoss: 2500, maxLossType: "trailing", timeLimitDays: null, minTradingDays: 10, consistencyRule: null },
      ],
    }],
  },
  {
    id: "oneup-trader",
    name: "OneUp Trader",
    displayName: "OneUp Trader",
    description: "Futures prop firm with simple evaluation and no time limits.",
    website: "https://oneuptrader.com",
    supportedPlatforms: ["rithmic"],
    brokerDetectionPatterns: ["OneUp", "OneUpTrader"],
    challenges: [{
      id: "oneup-50k",
      challengeType: "combine",
      displayName: "OneUp $50K",
      phases: [
        { order: 1, name: "Evaluation", profitTarget: 3000, profitTargetType: "absolute", dailyLossLimit: 1100, maxLoss: 2000, maxLossType: "trailing", timeLimitDays: null, minTradingDays: 15, consistencyRule: null },
      ],
    }],
  },
  {
    id: "uprofit",
    name: "UProfit",
    displayName: "UProfit",
    description: "Budget-friendly futures prop firm with Rithmic.",
    website: "https://uprofit.com",
    supportedPlatforms: ["rithmic"],
    brokerDetectionPatterns: ["UProfit", "uprofit"],
    challenges: [{
      id: "uprofit-50k",
      challengeType: "combine",
      displayName: "UProfit $50K",
      phases: [
        { order: 1, name: "Evaluation", profitTarget: 3000, profitTargetType: "absolute", dailyLossLimit: 1100, maxLoss: 2500, maxLossType: "trailing", timeLimitDays: null, minTradingDays: 5, consistencyRule: null },
      ],
    }],
  },
];

async function seedAdditionalPropFirms() {
  console.log(`Seeding ${firms.length} additional prop firms...`);

  for (const firm of firms) {
    try {
      await db
        .insert(propFirm)
        .values({
          id: firm.id,
          name: firm.name,
          displayName: firm.displayName,
          description: firm.description,
          website: firm.website,
          supportedPlatforms: firm.supportedPlatforms,
          brokerDetectionPatterns: firm.brokerDetectionPatterns,
          active: true,
        })
        .onConflictDoUpdate({
          target: propFirm.id,
          set: {
            displayName: firm.displayName,
            description: firm.description,
            website: firm.website,
            supportedPlatforms: firm.supportedPlatforms,
            brokerDetectionPatterns: firm.brokerDetectionPatterns,
            updatedAt: new Date(),
          },
        });

      for (const challenge of firm.challenges) {
        await db
          .insert(propChallengeRule)
          .values({
            id: challenge.id,
            propFirmId: firm.id,
            challengeType: challenge.challengeType,
            displayName: challenge.displayName,
            phases: challenge.phases,
            active: true,
          })
          .onConflictDoUpdate({
            target: propChallengeRule.id,
            set: {
              displayName: challenge.displayName,
              phases: challenge.phases,
              updatedAt: new Date(),
            },
          });
      }

      console.log(`  ${firm.displayName}`);
    } catch (err) {
      console.error(`  Failed: ${firm.displayName}`, err);
    }
  }

  console.log("Done! Seeded additional prop firms.");
  process.exit(0);
}

seedAdditionalPropFirms();
