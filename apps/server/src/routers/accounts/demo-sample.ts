import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { db } from "../../db";
import { equitySnapshot } from "../../db/schema/connections";
import {
  tradeChecklistResult,
  tradeChecklistTemplate,
} from "../../db/schema/coaching";
import { journalEntry, tradeMedia, tradeNote } from "../../db/schema/journal";
import { tradeAnnotation } from "../../db/schema/social-redesign";
import {
  edge,
  edgeRule,
  edgeSection,
  openTrade,
  trade,
  tradeEdgeAssignment,
  tradingAccount,
} from "../../db/schema/trading";
import { calculateAllAdvancedMetrics } from "../../lib/advanced-metrics";
import { createAutoTradeReviewEntry } from "../../lib/auto-journal";
import { createEdgeRecord } from "../../lib/edges/compatibility";
import { bulkAssignLegacyModelTagToTrades } from "../../lib/edges/service";
import { generateFeedEventForTrade } from "../../lib/feed-event-generator";
import { seedDemoBacktestSessions } from "./demo-backtest";
import { seedDemoDigests } from "./demo-digests";
import { seedDemoGoalsAndAlerts } from "./demo-governance";
import {
  DEMO_ACCOUNT_NAME,
  DEMO_ACCOUNT_PREFIX,
  DEMO_BROKER,
  DEMO_BROKER_SERVER,
  isDemoWorkspaceAccountRecord,
  seedDemoAiHistory,
} from "./demo-workspace";

type SeedSampleAccountOptions = {
  accountId?: string;
  accountNumber?: string | null;
  resetExistingAccount?: boolean;
  provisionShell?: boolean;
};

const DEMO_INITIAL_BALANCE = 100_000;
const INSERT_BATCH_SIZE = 100;
const POST_SEED_CONCURRENCY = 6;

type DemoWorkspaceAccountSummary = {
  id: string;
  name: string;
  broker: string;
  brokerType: string | null;
  brokerServer: string | null;
  accountNumber: string | null;
};

type DemoSeedAccountRow = typeof tradingAccount.$inferSelect;
type DemoSeedTradeRow = typeof trade.$inferSelect;
type DemoSeedOpenTradeRow = typeof openTrade.$inferSelect;
type DemoSession = "London" | "New York" | "Asian";
type DemoSymbol = "EURUSD" | "GBPUSD" | "USDJPY" | "AUDUSD" | "XAUUSD";
type DemoDirection = "long" | "short";
type DemoPhaseName =
  | "foundation"
  | "leak-cluster"
  | "recovery"
  | "refined-edge";
type DemoEdgeArchetype =
  | "reversal"
  | "continuation"
  | "breakout"
  | "mean_reversion"
  | "macro"
  | "news"
  | "midday";
type DemoEdgeRuleTemplate = {
  sectionTitle: "Entry rules" | "In position rules" | "Exit rules";
  title: string;
  description: string;
  appliesOutcomes?: string[];
};

type DemoEdgeSeedProfile = {
  archetype: DemoEdgeArchetype;
  allowedDirections: DemoDirection[];
  preferredSessions: DemoSession[];
  preferredSymbols: DemoSymbol[];
  disallowedSessions?: DemoSession[];
  directionBias?: DemoDirection;
};

type DemoEdgeTemplate = {
  name: string;
  color: string;
  description: string;
  tradeSeed: boolean;
  seedProfile?: DemoEdgeSeedProfile;
  contentParagraphs: string[];
  exampleParagraphs: string[];
  rules: DemoEdgeRuleTemplate[];
};

const DEMO_EDGE_SECTION_DESCRIPTIONS: Record<
  DemoEdgeRuleTemplate["sectionTitle"],
  string
> = {
  "Entry rules":
    "The pre-trade conditions that must be present before this Edge is valid.",
  "In position rules":
    "How the trade should be managed once the Edge is live and risk is on.",
  "Exit rules":
    "How profits are protected, partials are taken, or invalidation is handled.",
};

function buildDemoEdgeTemplate(input: {
  name: string;
  color: string;
  description: string;
  tradeSeed?: boolean;
  seedProfile?: DemoEdgeSeedProfile;
  contentParagraphs: string[];
  exampleParagraphs: string[];
  entryRule: string;
  entryRuleDescription: string;
  managementRule: string;
  managementRuleDescription: string;
  exitRule: string;
  exitRuleDescription: string;
}) {
  return {
    name: input.name,
    color: input.color,
    description: input.description,
    tradeSeed: input.tradeSeed ?? false,
    seedProfile: input.seedProfile,
    contentParagraphs: input.contentParagraphs,
    exampleParagraphs: input.exampleParagraphs,
    rules: [
      {
        sectionTitle: "Entry rules",
        title: input.entryRule,
        description: input.entryRuleDescription,
        appliesOutcomes: ["all"],
      },
      {
        sectionTitle: "In position rules",
        title: input.managementRule,
        description: input.managementRuleDescription,
        appliesOutcomes: ["all"],
      },
      {
        sectionTitle: "Exit rules",
        title: input.exitRule,
        description: input.exitRuleDescription,
        appliesOutcomes: ["winner", "partial_win", "breakeven", "loser"],
      },
    ],
  } satisfies DemoEdgeTemplate;
}

const DEMO_EDGE_TEMPLATES: DemoEdgeTemplate[] = [
  buildDemoEdgeTemplate({
    name: "Liquidity Raid",
    color: "#14B8A6",
    description:
      "Fade the sweep, then align with reclaim once the trap has fully shown its hand.",
    tradeSeed: true,
    seedProfile: {
      archetype: "reversal",
      allowedDirections: ["long", "short"],
      preferredSessions: ["London", "New York"],
      preferredSymbols: ["EURUSD", "GBPUSD", "XAUUSD", "USDJPY"],
    },
    contentParagraphs: [
      "This Edge is built around one-sided liquidity grabs that sweep an obvious high or low, fail to continue, and then reclaim back inside the dealing range.",
      "The ideal version happens during London or the New York overlap when the sweep is obvious, displacement confirms intent, and the invalidation is clean enough to define risk without negotiation.",
    ],
    exampleParagraphs: [
      "Best example: London sweeps the Asian high, rejects immediately, displaces back under the sweep, then offers a clean pullback into the reclaim candle.",
      "Avoid forcing the setup when the sweep keeps accepting above the level or when the reclaim only happens after the move is already overextended.",
    ],
    entryRule: "Wait for a clear sweep and reclaim before committing risk",
    entryRuleDescription:
      "The sweep alone is not the setup. Price must reject the raid and reclaim back through the trigger area with intent.",
    managementRule: "Protect the trade once displacement has fully held",
    managementRuleDescription:
      "If follow-through confirms, move to a structure-based protection plan instead of widening the idea.",
    exitRule: "Scale or close into opposing liquidity pools",
    exitRuleDescription:
      "Pay yourself into the next draw on liquidity rather than assuming the move will trend indefinitely.",
  }),
  buildDemoEdgeTemplate({
    name: "Breaker Block",
    color: "#F59E0B",
    description:
      "Use a failed block or reclaimed candle body as the reaction point after structure shifts.",
    tradeSeed: true,
    seedProfile: {
      archetype: "continuation",
      allowedDirections: ["long", "short"],
      preferredSessions: ["London", "New York"],
      preferredSymbols: ["EURUSD", "GBPUSD", "XAUUSD"],
    },
    contentParagraphs: [
      "This Edge focuses on the first clean revisit into a breaker after market structure has already shifted.",
      "The quality comes from context. The breaker should sit inside a clean dealing range, align with session intent, and offer asymmetric invalidation.",
    ],
    exampleParagraphs: [
      "Best example: New York opens with displacement, breaks short-term structure, then retraces into the failed bearish candle before continuing higher.",
      "Skip the setup when the breaker sits in the middle of noisy price or when the revisit happens after multiple reactions have already consumed the level.",
    ],
    entryRule: "Only take the first meaningful revisit into the breaker",
    entryRuleDescription:
      "The reaction should come from fresh structure, not from a level that has already been tested repeatedly.",
    managementRule: "Hold only while the shift in structure remains intact",
    managementRuleDescription:
      "If price starts accepting back through the breaker, the original thesis is no longer clean.",
    exitRule: "Exit when the next structure objective is filled",
    exitRuleDescription:
      "Treat opposing highs, lows, and intraday objectives as planned destinations for the move.",
  }),
  buildDemoEdgeTemplate({
    name: "Supply Zone",
    color: "#EF4444",
    description:
      "Fade into pre-defined premium zones when price arrives stretched and reaction quality is obvious.",
    tradeSeed: true,
    seedProfile: {
      archetype: "mean_reversion",
      allowedDirections: ["short"],
      preferredSessions: ["London", "New York"],
      preferredSymbols: ["GBPUSD", "XAUUSD", "EURUSD"],
      directionBias: "short",
    },
    contentParagraphs: [
      "This Edge is a zone reaction model built for stretched moves into obvious premium or discount pockets.",
      "It works best when the session is already extended, the level is clean on higher timeframes, and the reaction offers immediate rejection.",
    ],
    exampleParagraphs: [
      "Best example: GBPUSD pushes into a marked supply shelf after a one-sided morning auction, tags the level, then rejects with immediate volume failure.",
      "Avoid taking every touch. If price is grinding into the zone with acceptance, the level is already weakening.",
    ],
    entryRule: "Let price prove rejection inside the zone",
    entryRuleDescription:
      "A marked zone is context, not a blind entry. Rejection quality still matters.",
    managementRule: "Do not babysit weak reactions",
    managementRuleDescription:
      "If the trade cannot leave the zone decisively, treat the idea as compromised rather than hoping.",
    exitRule: "Reduce risk into mid-range or prior session equilibrium",
    exitRuleDescription:
      "Zone reactions often mean-revert first. Book partials where the auction is likely to rebalance.",
  }),
  buildDemoEdgeTemplate({
    name: "Trend Continuation",
    color: "#22C55E",
    description:
      "Participate with the dominant session move after a clean pullback into structure or value.",
    tradeSeed: true,
    seedProfile: {
      archetype: "continuation",
      allowedDirections: ["long", "short"],
      preferredSessions: ["London", "New York"],
      preferredSymbols: ["EURUSD", "GBPUSD", "XAUUSD"],
      directionBias: "long",
    },
    contentParagraphs: [
      "This Edge is for continuation, not reversal. The trend should already be in force before the entry is even considered.",
      "The cleanest versions come after early session displacement, a measured pullback, and then renewed expansion in the original direction.",
    ],
    exampleParagraphs: [
      "Best example: EURUSD trends higher through London, pulls into a prior imbalance, holds above structure, and then resumes with fresh displacement.",
      "Skip the trade when the pullback becomes a full structural failure or when the continuation leg would require chasing above obvious expansion.",
    ],
    entryRule: "Enter only after the pullback respects trend structure",
    entryRuleDescription:
      "Continuation needs a valid higher-low or lower-high sequence, not a deep retrace that destroys the trend map.",
    managementRule: "Trail behind defended structure as the move extends",
    managementRuleDescription:
      "Let the market earn more room only when new structure is clearly being protected.",
    exitRule: "Take profits before exhaustion becomes obvious",
    exitRuleDescription:
      "Continuation trades degrade fast once extension is obvious to everyone and momentum begins to flatten.",
  }),
  buildDemoEdgeTemplate({
    name: "Opening Range Breakout",
    color: "#3B82F6",
    description:
      "Trade the first clean expansion out of the opening range when volume and structure agree.",
    tradeSeed: true,
    seedProfile: {
      archetype: "breakout",
      allowedDirections: ["long", "short"],
      preferredSessions: ["London", "New York"],
      preferredSymbols: ["EURUSD", "GBPUSD", "XAUUSD", "USDJPY"],
    },
    contentParagraphs: [
      "This Edge looks for an honest break from the opening range rather than random first-move volatility.",
      "The breakout should expand with intent, not just poke the edge of the range and stall immediately.",
    ],
    exampleParagraphs: [
      "Best example: the first thirty minutes define a tight range, then price breaks with broad participation and never accepts back inside the base.",
      "Avoid trading the setup late after the expansion is already extended or when the breakout comes directly into higher-timeframe opposition.",
    ],
    entryRule: "Demand acceptance outside the opening range",
    entryRuleDescription:
      "A wick through the range is not enough. Price needs to hold outside the base before it becomes actionable.",
    managementRule: "Stay with the breakout while range lows or highs keep holding",
    managementRuleDescription:
      "Once the breakout starts failing back through its launch point, the clean expansion thesis has gone.",
    exitRule: "Pay into the next session objective or measured move",
    exitRuleDescription:
      "Opening range trades work best when exits are planned around obvious range projections and session liquidity.",
  }),
  buildDemoEdgeTemplate({
    name: "VWAP Reclaim",
    color: "#8B5CF6",
    description:
      "Use VWAP as a control line after price loses and then reclaims fair intraday value.",
    tradeSeed: true,
    seedProfile: {
      archetype: "continuation",
      allowedDirections: ["long", "short"],
      preferredSessions: ["New York", "London"],
      preferredSymbols: ["XAUUSD", "USDJPY", "AUDUSD", "EURUSD"],
      directionBias: "long",
    },
    contentParagraphs: [
      "This Edge treats VWAP as a decision filter, not a magic line. The reclaim matters because it shows auction control shifting back through value.",
      "The cleanest opportunities happen when price extends away from VWAP, fails to continue, then reclaims it with fresh structure in the direction of the reclaim.",
    ],
    exampleParagraphs: [
      "Best example: price opens below VWAP, sweeps liquidity, reclaims back above value, then holds VWAP on the first pullback before trending.",
      "Avoid using this Edge when VWAP is flat and price is just chopping around it with no directional intent.",
    ],
    entryRule: "Wait for reclaim plus a held retest of VWAP",
    entryRuleDescription:
      "The reclaim and hold matter more than the first touch. Value needs to flip cleanly.",
    managementRule: "Abort if price loses value again without response",
    managementRuleDescription:
      "Once price re-accepts on the wrong side of VWAP, the reclaim thesis is no longer intact.",
    exitRule: "Reduce size into extension away from value",
    exitRuleDescription:
      "This Edge often resolves in rotations. Pay yourself once the move becomes stretched relative to VWAP.",
  }),
  buildDemoEdgeTemplate({
    name: "Session Sweep Reclaim",
    color: "#06B6D4",
    description:
      "Capture the post-sweep reversal when one session runs the prior session’s extremes and immediately gives them back.",
    tradeSeed: true,
    seedProfile: {
      archetype: "reversal",
      allowedDirections: ["long", "short"],
      preferredSessions: ["London", "New York"],
      preferredSymbols: ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD"],
    },
    contentParagraphs: [
      "This Edge is built around one session sweeping the prior session high or low and then failing to sustain the break.",
      "The setup becomes stronger when the reclaim happens with urgency and the return path offers clean room back through the prior range.",
    ],
    exampleParagraphs: [
      "Best example: New York runs London high, prints rejection, then collapses back through the prior session range with momentum.",
      "Skip it when the sweep happens inside already balanced price or when the reclaim is too delayed to offer a clean invalidation.",
    ],
    entryRule: "Anchor the idea to the prior session extreme",
    entryRuleDescription:
      "The sweep must take something obvious before the reclaim has real informational value.",
    managementRule: "Stay aggressive only while the prior range keeps accepting the reclaim",
    managementRuleDescription:
      "If price stalls right back at the range edge, the reversal is not yet proven.",
    exitRule: "Target the opposite side of the prior session range",
    exitRuleDescription:
      "The range itself provides a clear framework for scaling and final distribution.",
  }),
  buildDemoEdgeTemplate({
    name: "Macro Pullback",
    color: "#84CC16",
    description:
      "Rejoin a higher-timeframe directional idea on an intraday retracement instead of chasing expansion.",
    tradeSeed: true,
    seedProfile: {
      archetype: "macro",
      allowedDirections: ["long"],
      preferredSessions: ["London", "New York"],
      preferredSymbols: ["EURUSD", "GBPUSD", "XAUUSD"],
      directionBias: "long",
    },
    contentParagraphs: [
      "This Edge is built for days where the higher-timeframe story is already directional and the intraday job is simply to enter efficiently.",
      "The pullback should land in a meaningful area of value, not just any random pause after expansion.",
    ],
    exampleParagraphs: [
      "Best example: a daily bullish bias is intact, the intraday retrace lands in discount, then lower-timeframe structure turns back with trend.",
      "Avoid taking the trade if the pullback turns into full higher-timeframe invalidation or if the entry requires chasing after the retracement is already gone.",
    ],
    entryRule: "Use higher-timeframe bias plus intraday confirmation",
    entryRuleDescription:
      "Bias alone is not enough. The lower timeframe still needs to agree at the area of interest.",
    managementRule: "Manage against the retracement low or high, not emotion",
    managementRuleDescription:
      "The pullback defines the risk. If that pivot fails, the macro idea is mistimed at minimum.",
    exitRule: "Distribute into higher-timeframe objectives",
    exitRuleDescription:
      "This Edge should be paid into obvious daily or four-hour targets rather than scalped without a plan.",
  }),
  buildDemoEdgeTemplate({
    name: "Range Rotation",
    color: "#F97316",
    description:
      "Trade responsive rotations from one side of a balanced range back toward the other.",
    tradeSeed: true,
    seedProfile: {
      archetype: "mean_reversion",
      allowedDirections: ["long", "short"],
      preferredSessions: ["Asian", "London"],
      preferredSymbols: ["EURUSD", "USDJPY", "AUDUSD"],
    },
    contentParagraphs: [
      "This Edge assumes the market is balanced first. It is designed for responsive trade location inside clear intraday or multi-session ranges.",
      "The best trades come from the edges, not the middle. If the setup starts in the center of the range, there is usually no edge to claim.",
    ],
    exampleParagraphs: [
      "Best example: price tags the upper edge of a two-day range, rejects, then rotates back toward the mid and opposite extreme.",
      "Avoid range rotations on trend days where one side of the balance is already giving way with real acceptance.",
    ],
    entryRule: "Initiate from the range edge, not the midpoint",
    entryRuleDescription:
      "The edge of the range provides the asymmetry. Mid-range entries erase most of that advantage.",
    managementRule: "Hold only while the balance thesis remains intact",
    managementRuleDescription:
      "If price starts accepting outside the range, the responsive trade becomes the wrong idea.",
    exitRule: "Scale through the midpoint and opposite edge",
    exitRuleDescription:
      "The midpoint and far edge are the natural rotation checkpoints for this Edge.",
  }),
  buildDemoEdgeTemplate({
    name: "News Fade Continuation",
    color: "#EC4899",
    description:
      "Let event volatility overreact, then align with the cleaner post-news continuation once the dust settles.",
    tradeSeed: true,
    seedProfile: {
      archetype: "news",
      allowedDirections: ["long", "short"],
      preferredSessions: ["New York"],
      preferredSymbols: ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY"],
      disallowedSessions: ["Asian"],
    },
    contentParagraphs: [
      "This Edge is for days where a news impulse creates emotional overextension, followed by a cleaner continuation once the reaction normalizes.",
      "The idea is not to fight news blindly. It is to wait for the reactive crowd move to exhaust and then re-enter with better structure.",
    ],
    exampleParagraphs: [
      "Best example: CPI spikes price violently into liquidity, the impulse retraces, then the underlying direction resumes from a cleaner location.",
      "Skip this Edge when the event changes the higher-timeframe narrative completely or when spreads remain disorderly.",
    ],
    entryRule: "Wait until post-news spreads and structure normalize",
    entryRuleDescription:
      "The cleanup phase is part of the setup. If the tape is still disorderly, the edge is not ready.",
    managementRule: "Stay with the continuation only while post-news structure holds",
    managementRuleDescription:
      "Once the normalized structure fails, the event-driven thesis is no longer behaving cleanly.",
    exitRule: "Book into the next obvious expansion target",
    exitRuleDescription:
      "News continuation often moves quickly. Planned distribution matters because the move can finish abruptly.",
  }),
  buildDemoEdgeTemplate({
    name: "HTF Reversal Sweep",
    color: "#A855F7",
    description:
      "Fade a higher-timeframe extreme only after the sweep shows exhaustion and structure rotates back.",
    tradeSeed: true,
    seedProfile: {
      archetype: "reversal",
      allowedDirections: ["long", "short"],
      preferredSessions: ["London", "New York"],
      preferredSymbols: ["XAUUSD", "GBPUSD", "EURUSD"],
    },
    contentParagraphs: [
      "This Edge is reserved for higher-timeframe extremes where the market reaches a premium or discount area that actually matters.",
      "Because reversal trades can be expensive to force, the sweep has to show real exhaustion before capital is committed.",
    ],
    exampleParagraphs: [
      "Best example: price runs a weekly high into a marked premium zone, fails to hold, and then breaks lower-timeframe structure back down.",
      "Avoid catching falling knives or standing in front of acceleration. Higher-timeframe reversals need proof.",
    ],
    entryRule: "Require both the sweep and the structural failure",
    entryRuleDescription:
      "The level matters, but the failure to continue through it is what turns context into a valid reversal idea.",
    managementRule: "Respect the higher-timeframe invalidation level",
    managementRuleDescription:
      "Reversal trades should not be given endless room. If the extreme keeps accepting, the thesis is wrong.",
    exitRule: "De-risk into the first major counter-rotation objective",
    exitRuleDescription:
      "Higher-timeframe fades often snap hard at first, so distribution should begin into the nearest major rotation objective.",
  }),
  buildDemoEdgeTemplate({
    name: "NY Midday Reclaim",
    color: "#0EA5E9",
    description:
      "Use the midday reset to catch a cleaner reclaim after the opening impulse has already shown its hand.",
    tradeSeed: true,
    seedProfile: {
      archetype: "midday",
      allowedDirections: ["long"],
      preferredSessions: ["New York"],
      preferredSymbols: ["XAUUSD", "USDJPY", "AUDUSD"],
      directionBias: "long",
    },
    contentParagraphs: [
      "This Edge is designed for slower midday conditions where the open created the map and the reclaim offers the cleaner entry.",
      "It works best when the morning move swept liquidity, overextended, and then left behind a clear reclaim level into the lunch reset.",
    ],
    exampleParagraphs: [
      "Best example: the open runs hard, price compresses through midday, then reclaims a key intraday level and resumes with cleaner risk.",
      "Avoid forcing this during dead lunch chop when there is no clear reclaim and no afternoon catalyst in sight.",
    ],
    entryRule: "Use the reclaim to define the afternoon thesis",
    entryRuleDescription:
      "The level being reclaimed should clearly separate the failed morning auction from the afternoon opportunity.",
    managementRule: "Stay patient unless reclaim acceptance clearly fails",
    managementRuleDescription:
      "Midday trades can breathe more slowly, but they should still hold the reclaimed level with intent.",
    exitRule: "Target the afternoon expansion or prior session liquidity",
    exitRuleDescription:
      "This Edge works best when the afternoon has a clean destination already mapped.",
  }),
];

function makeDemoAccountNumber(input?: string | null) {
  if (input && input.trim().length > 0) {
    return input;
  }

  return `${DEMO_ACCOUNT_PREFIX}${Math.floor(
    10_000_000 + Math.random() * 90_000_000
  )}`;
}

async function insertRowsInBatches<T>(
  rows: T[],
  insertBatch: (batch: T[]) => Promise<unknown>,
  batchSize = INSERT_BATCH_SIZE
) {
  if (rows.length === 0) {
    return;
  }

  const tasks: Array<Promise<unknown>> = [];

  for (let index = 0; index < rows.length; index += batchSize) {
    tasks.push(insertBatch(rows.slice(index, index + batchSize)));
  }

  await Promise.all(tasks);
}

async function runInBatches<T>(
  items: T[],
  worker: (item: T) => Promise<unknown>,
  batchSize = POST_SEED_CONCURRENCY
) {
  for (let index = 0; index < items.length; index += batchSize) {
    await Promise.all(
      items.slice(index, index + batchSize).map((item) => worker(item))
    );
  }
}

async function runOptionalDemoSeedStep<T>(
  label: string,
  task: () => Promise<T>
) {
  try {
    return await task();
  } catch (error) {
    console.error(`[hydrateDemoWorkspace] ${label} failed`, error);
    return null;
  }
}

function escapeDemoHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildDemoBlocks(paragraphs: string[]) {
  return paragraphs.map((content) => ({
    id: crypto.randomUUID(),
    type: "paragraph",
    content,
  }));
}

function buildDemoHtml(paragraphs: string[]) {
  return paragraphs
    .map((paragraph) => `<p>${escapeDemoHtml(paragraph)}</p>`)
    .join("");
}

async function seedDemoEdgesForUser(userId: string) {
  await db.delete(edge).where(
    and(eq(edge.ownerUserId, userId), eq(edge.isDemoSeeded, true))
  );

  const createdEdges: Array<{
    id: string;
    name: string;
    color: string;
    tradeSeed: boolean;
    seedProfile?: DemoEdgeSeedProfile;
  }> = [];

  for (const template of DEMO_EDGE_TEMPLATES) {
    const createdEdge = await createEdgeRecord({
      ownerUserId: userId,
      name: template.name,
      description: template.description,
      color: template.color,
      publicationMode: "private",
      isDemoSeeded: true,
    });

    await db
      .update(edge)
      .set({
        contentBlocks: buildDemoBlocks(template.contentParagraphs),
        contentHtml: buildDemoHtml(template.contentParagraphs),
        examplesBlocks: buildDemoBlocks(template.exampleParagraphs),
        examplesHtml: buildDemoHtml(template.exampleParagraphs),
        updatedAt: new Date(),
      })
      .where(eq(edge.id, createdEdge.id));

    const sections = await db
      .select({
        id: edgeSection.id,
        title: edgeSection.title,
      })
      .from(edgeSection)
      .where(eq(edgeSection.edgeId, createdEdge.id))
      .orderBy(asc(edgeSection.sortOrder), asc(edgeSection.title));

    const sectionIdByTitle = new Map(
      sections.map((sectionRow) => [sectionRow.title, sectionRow.id])
    );

    for (const sectionRow of sections) {
      const nextDescription =
        DEMO_EDGE_SECTION_DESCRIPTIONS[
          sectionRow.title as keyof typeof DEMO_EDGE_SECTION_DESCRIPTIONS
        ];

      if (!nextDescription) continue;

      await db
        .update(edgeSection)
        .set({
          description: nextDescription,
          updatedAt: new Date(),
        })
        .where(eq(edgeSection.id, sectionRow.id));
    }

    if (template.rules.length > 0) {
      await db.insert(edgeRule).values(
        template.rules
          .map((rule, index) => {
            const sectionId = sectionIdByTitle.get(rule.sectionTitle);
            if (!sectionId) {
              return null;
            }

            return {
              edgeId: createdEdge.id,
              sectionId,
              title: rule.title,
              description: rule.description,
              sortOrder: index,
              appliesOutcomes: rule.appliesOutcomes ?? ["all"],
            };
          })
          .filter(
            (
              ruleRow
            ): ruleRow is {
              edgeId: string;
              sectionId: string;
              title: string;
              description: string;
              sortOrder: number;
              appliesOutcomes: string[];
            } => Boolean(ruleRow)
          )
      );
    }

    createdEdges.push({
      id: createdEdge.id,
      name: createdEdge.name,
      color: createdEdge.color,
      tradeSeed: template.tradeSeed,
      seedProfile: template.seedProfile,
    });
  }

  return createdEdges;
}

async function selectDemoWorkspaceAccount(
  userId: string,
  accountId: string
): Promise<DemoWorkspaceAccountSummary> {
  const [account] = await db
    .select({
      id: tradingAccount.id,
      name: tradingAccount.name,
      broker: tradingAccount.broker,
      brokerType: tradingAccount.brokerType,
      brokerServer: tradingAccount.brokerServer,
      accountNumber: tradingAccount.accountNumber,
    })
    .from(tradingAccount)
    .where(and(eq(tradingAccount.id, accountId), eq(tradingAccount.userId, userId)))
    .limit(1);

  if (!account || !isDemoWorkspaceAccountRecord(account)) {
    throw new Error("Demo workspace account not found");
  }

  return account;
}

async function loadExistingDemoWorkspaceSeedState(
  userId: string,
  accountId: string
): Promise<{
  account: DemoSeedAccountRow;
  closedTrades: DemoSeedTradeRow[];
  liveOpenTrades: DemoSeedOpenTradeRow[];
}> {
  const [account] = await db
    .select()
    .from(tradingAccount)
    .where(and(eq(tradingAccount.id, accountId), eq(tradingAccount.userId, userId)))
    .limit(1);

  if (!account) {
    throw new Error("Demo workspace account not found");
  }

  const [closedTrades, liveOpenTrades] = await Promise.all([
    db
      .select()
      .from(trade)
      .where(eq(trade.accountId, accountId))
      .orderBy(asc(trade.closeTime), asc(trade.openTime), asc(trade.createdAt)),
    db
      .select()
      .from(openTrade)
      .where(eq(openTrade.accountId, accountId))
      .orderBy(asc(openTrade.createdAt), asc(openTrade.openTime)),
  ]);

  return {
    account,
    closedTrades,
    liveOpenTrades,
  };
}

export async function provisionDemoWorkspaceAccount(
  userId: string,
  options: SeedSampleAccountOptions = {}
) {
  const accountId = options.accountId ?? crypto.randomUUID();
  const accountNumber = makeDemoAccountNumber(options.accountNumber);
  const nowDate = new Date();

  if (options.resetExistingAccount) {
    await db.delete(tradingAccount).where(
      and(eq(tradingAccount.id, accountId), eq(tradingAccount.userId, userId))
    );
  }

  const [account] = await db
    .insert(tradingAccount)
    .values({
      id: accountId,
      userId,
      name: DEMO_ACCOUNT_NAME,
      broker: DEMO_BROKER,
      brokerType: "mt5",
      brokerServer: DEMO_BROKER_SERVER,
      accountNumber,
      preferredDataSource: "broker",
      averageSpreadPips: "1.20",
      initialBalance: DEMO_INITIAL_BALANCE.toFixed(2),
      initialCurrency: "USD",
      isVerified: 1,
      liveBalance: DEMO_INITIAL_BALANCE.toFixed(2),
      liveEquity: DEMO_INITIAL_BALANCE.toFixed(2),
      liveMargin: "0.00",
      liveFreeMargin: DEMO_INITIAL_BALANCE.toFixed(2),
      lastSyncedAt: nowDate,
      propManualOverride: false,
      verificationLevel: "ea_synced",
      socialOptIn: true,
      socialVisibleSince: new Date(nowDate.getTime() - 14 * 24 * 60 * 60 * 1000),
      followerCount: 12,
      feedEventCount: 0,
    })
    .returning({
      id: tradingAccount.id,
      name: tradingAccount.name,
      broker: tradingAccount.broker,
      brokerType: tradingAccount.brokerType,
      brokerServer: tradingAccount.brokerServer,
      accountNumber: tradingAccount.accountNumber,
    });

  return { account };
}

export async function seedSampleAccount(
  userId: string,
  options: SeedSampleAccountOptions = {}
) {
  const seededAccount =
    options.provisionShell === false && options.accountId
      ? await selectDemoWorkspaceAccount(userId, options.accountId)
      : (await provisionDemoWorkspaceAccount(userId, options)).account;

  const accountId = seededAccount.id;
  const now = Date.now();
  const nowDate = new Date(now);
  const initialBalance = DEMO_INITIAL_BALANCE;
  const tradeCount = 120;
  const openTradeCount = 5 + Math.floor(Math.random() * 9);
  const accountNumber = makeDemoAccountNumber(seededAccount.accountNumber);
  const seededDemoEdges = await seedDemoEdgesForUser(userId);

  const symbols = ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "XAUUSD"] as const;
  const sessions = ["London", "New York", "Asian"] as const;
  const alignments = ["aligned", "against", "discretionary"] as const;
  const seededTradeEdges = seededDemoEdges.filter(
    (demoEdge): demoEdge is (typeof seededDemoEdges)[number] & {
      seedProfile: DemoEdgeSeedProfile;
    } => Boolean(demoEdge.tradeSeed && demoEdge.seedProfile)
  );
  const sessionColors: Record<(typeof sessions)[number], string> = {
    London: "#3B82F6",
    "New York": "#F97316",
    Asian: "#8B5CF6",
  };
  const modelColors = Object.fromEntries(
    seededDemoEdges.map((demoEdge) => [demoEdge.name, demoEdge.color])
  ) as Record<string, string>;
  const basePrices: Record<(typeof symbols)[number], number> = {
    EURUSD: 1.085,
    GBPUSD: 1.27,
    USDJPY: 150.5,
    AUDUSD: 0.655,
    XAUUSD: 2050,
  };
  const pipSizes: Record<(typeof symbols)[number], number> = {
    EURUSD: 0.0001,
    GBPUSD: 0.0001,
    USDJPY: 0.01,
    AUDUSD: 0.0001,
    XAUUSD: 0.1,
  };
  const pipValuePerLot: Record<(typeof symbols)[number], number> = {
    EURUSD: 10,
    GBPUSD: 10,
    USDJPY: 6.67,
    AUDUSD: 10,
    XAUUSD: 10,
  };

  const formatPrice = (symbol: (typeof symbols)[number], value: number) =>
    value.toFixed(symbol === "XAUUSD" ? 2 : symbol === "USDJPY" ? 3 : 5);
  const pick = <T>(items: readonly T[]) =>
    items[Math.floor(Math.random() * items.length)];
  const roundTo = (value: number, decimals = 2) =>
    Number(value.toFixed(decimals));
  const formatDay = (date: Date) => date.toISOString().slice(0, 10);
  const startOfUtcDay = (date: Date) => {
    const next = new Date(date);
    next.setUTCHours(0, 0, 0, 0);
    return next;
  };
  const subtractUtcMonths = (date: Date, months: number) => {
    const next = startOfUtcDay(date);
    next.setUTCMonth(next.getUTCMonth() - months);
    return next;
  };
  const previousTradingDay = (date: Date) => {
    const previous = startOfUtcDay(date);
    previous.setUTCDate(previous.getUTCDate() - 1);
    while (previous.getUTCDay() === 0 || previous.getUTCDay() === 6) {
      previous.setUTCDate(previous.getUTCDate() - 1);
    }
    return previous;
  };
  const getTradingDaysBetween = (start: Date, end: Date) => {
    const days: Date[] = [];
    const cursor = startOfUtcDay(start);
    const endDay = startOfUtcDay(end);

    while (cursor.getTime() <= endDay.getTime()) {
      if (cursor.getUTCDay() !== 0 && cursor.getUTCDay() !== 6) {
        days.push(new Date(cursor));
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return days;
  };
  const clampNumber = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));
  const randBetween = (min: number, max: number) =>
    min + Math.random() * (max - min);
  const weightedPick = <T>(
    items: readonly T[],
    getWeight: (item: T) => number
  ) => {
    const weighted = items.map((item) => ({
      item,
      weight: Math.max(0.01, getWeight(item)),
    }));
    const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const entry of weighted) {
      roll -= entry.weight;
      if (roll <= 0) return entry.item;
    }
    return weighted[weighted.length - 1]!.item;
  };
  const pickDirectionForEdge = (
    seedProfile: DemoEdgeSeedProfile,
    session: DemoSession
  ): DemoDirection => {
    if (seedProfile.allowedDirections.length === 1) {
      return seedProfile.allowedDirections[0]!;
    }

    let longBias =
      session === "London" ? 0.58 : session === "New York" ? 0.52 : 0.46;
    if (seedProfile.directionBias === "long") {
      longBias += 0.18;
    }
    if (seedProfile.directionBias === "short") {
      longBias -= 0.18;
    }

    return Math.random() < clampNumber(longBias, 0.15, 0.85)
      ? "long"
      : "short";
  };
  const createDemoTradeImage = ({
    symbol,
    title,
    accent,
    subtitle,
    metric,
  }: {
    symbol: string;
    title: string;
    accent: string;
    subtitle: string;
    metric: string;
  }) =>
    `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
        <rect width="1280" height="720" rx="24" fill="#0b0d10"/>
        <rect x="24" y="24" width="1232" height="672" rx="20" fill="#111418" stroke="#1f252d"/>
        <text x="64" y="96" fill="#7b8794" font-family="Arial, sans-serif" font-size="24">${symbol}</text>
        <text x="64" y="154" fill="#f8fafc" font-family="Arial, sans-serif" font-size="46" font-weight="700">${title}</text>
        <text x="64" y="206" fill="#94a3b8" font-family="Arial, sans-serif" font-size="22">${subtitle}</text>
        <rect x="64" y="252" width="1152" height="320" rx="18" fill="#0f1720" stroke="#1e293b"/>
        <path d="M96 504 C180 430 260 462 340 390 S520 308 612 344 S788 484 886 418 S1030 286 1180 324" stroke="${accent}" stroke-width="10" fill="none" stroke-linecap="round"/>
        <circle cx="1180" cy="324" r="10" fill="${accent}"/>
        <rect x="64" y="608" width="250" height="56" rx="14" fill="${accent}" fill-opacity="0.18" stroke="${accent}" />
        <text x="92" y="645" fill="${accent}" font-family="Arial, sans-serif" font-size="26" font-weight="700">${metric}</text>
      </svg>`
    )}`;
  type DemoPhase = {
    name: DemoPhaseName;
    endIndex: number;
    baseEdge: number;
    discipline: number;
    sameDayProbability: number;
    revengeRisk: number;
    sessionWeights: Record<(typeof sessions)[number], number>;
    archetypeWeights: Record<DemoEdgeArchetype, number>;
    alignmentWeights: Record<(typeof alignments)[number], number>;
  };
  const sessionOrder: Record<(typeof sessions)[number], number> = {
    Asian: 0,
    London: 1,
    "New York": 2,
  };
  const sessionWindows: Record<
    (typeof sessions)[number],
    { startHour: number; endHour: number }
  > = {
    Asian: { startHour: 0, endHour: 5 },
    London: { startHour: 7, endHour: 11 },
    "New York": { startHour: 13, endHour: 17 },
  };
  const phaseConfigs: DemoPhase[] = [
    {
      name: "foundation",
      endIndex: 27,
      baseEdge: 0.05,
      discipline: 0.72,
      sameDayProbability: 0.78,
      revengeRisk: 0.24,
      sessionWeights: { London: 1.5, "New York": 1.1, Asian: 0.7 },
      archetypeWeights: {
        reversal: 1.4,
        continuation: 1.15,
        breakout: 1.1,
        mean_reversion: 0.95,
        macro: 1.0,
        news: 0.78,
        midday: 0.72,
      },
      alignmentWeights: { aligned: 1.55, discretionary: 0.95, against: 0.55 },
    },
    {
      name: "leak-cluster",
      endIndex: 53,
      baseEdge: -0.12,
      discipline: 0.32,
      sameDayProbability: 0.9,
      revengeRisk: 0.62,
      sessionWeights: { London: 0.9, "New York": 1.45, Asian: 1.2 },
      archetypeWeights: {
        reversal: 0.92,
        continuation: 1.25,
        breakout: 1.05,
        mean_reversion: 1.12,
        macro: 0.88,
        news: 1.22,
        midday: 0.84,
      },
      alignmentWeights: { aligned: 0.7, discretionary: 1.2, against: 1.35 },
    },
    {
      name: "recovery",
      endIndex: 87,
      baseEdge: 0.03,
      discipline: 0.82,
      sameDayProbability: 0.72,
      revengeRisk: 0.14,
      sessionWeights: { London: 1.55, "New York": 1.0, Asian: 0.55 },
      archetypeWeights: {
        reversal: 1.48,
        continuation: 1.18,
        breakout: 1.14,
        mean_reversion: 0.94,
        macro: 1.08,
        news: 0.86,
        midday: 0.8,
      },
      alignmentWeights: { aligned: 1.65, discretionary: 0.85, against: 0.45 },
    },
    {
      name: "refined-edge",
      endIndex: tradeCount - 1,
      baseEdge: 0.12,
      discipline: 0.9,
      sameDayProbability: 0.8,
      revengeRisk: 0.08,
      sessionWeights: { London: 1.65, "New York": 1.15, Asian: 0.4 },
      archetypeWeights: {
        reversal: 1.55,
        continuation: 1.3,
        breakout: 1.25,
        mean_reversion: 0.78,
        macro: 1.16,
        news: 0.9,
        midday: 1.08,
      },
      alignmentWeights: { aligned: 1.8, discretionary: 0.75, against: 0.3 },
    },
  ];
  const forcedOutcomes = new Map<number, "win" | "loss" | "breakeven">([
    [28, "loss"],
    [29, "loss"],
    [30, "loss"],
    [31, "loss"],
    [43, "loss"],
    [44, "breakeven"],
    [45, "loss"],
    [61, "win"],
    [62, "win"],
    [63, "win"],
    [95, "win"],
    [96, "win"],
    [97, "win"],
    [108, "win"],
  ]);
  const getPhaseConfig = (index: number) =>
    phaseConfigs.find((phase) => index <= phase.endIndex) ??
    phaseConfigs.at(-1)!;
  const buildSessionTimestamp = (
    day: Date,
    session: (typeof sessions)[number]
  ) => {
    const window = sessionWindows[session];
    const timestamp = new Date(day);
    const hour =
      window.startHour +
      Math.floor(Math.random() * (window.endHour - window.startHour + 1));
    const minute = Math.floor(Math.random() * 60);
    const second = Math.floor(Math.random() * 60);
    timestamp.setUTCHours(hour, minute, second, 0);
    return timestamp.getTime();
  };
  const closedTradeWindowStart = subtractUtcMonths(nowDate, 6);
  const closedTradeWindowEnd = previousTradingDay(nowDate);
  const availableTradingDays = getTradingDaysBetween(
    closedTradeWindowStart,
    closedTradeWindowEnd
  );

  const closedTrades: (typeof trade.$inferInsert)[] = [];
  let runningBalance = initialBalance;
  let currentTradingDayIndex = 0;
  let currentTradingDay = new Date(
    availableTradingDays[currentTradingDayIndex] ?? closedTradeWindowEnd
  );
  const lastTradingDayIndex = Math.max(availableTradingDays.length - 1, 0);
  let previousCloseTs: number | null = null;
  let previousSession: (typeof sessions)[number] | null = null;
  let previousOutcome: "win" | "loss" | "breakeven" | null = null;
  let consecutiveLosses = 0;
  let consecutiveWins = 0;

  for (let i = 0; i < tradeCount; i++) {
    const phase = getPhaseConfig(i);
    let session = weightedPick(
      sessions,
      (candidate) => phase.sessionWeights[candidate]
    );
    const isRevengeTrade =
      previousOutcome === "loss" &&
      previousSession !== null &&
      Math.random() < phase.revengeRisk &&
      consecutiveLosses < 4;
    if (isRevengeTrade && previousSession) {
      session = previousSession;
    }

    const selectedEdge = weightedPick(
      seededTradeEdges,
      (candidate) => {
        let weight = phase.archetypeWeights[candidate.seedProfile.archetype] ?? 1;

        if (candidate.seedProfile.preferredSessions.includes(session)) {
          weight *= 1.65;
        } else {
          weight *= 0.72;
        }

        if (candidate.seedProfile.disallowedSessions?.includes(session)) {
          weight *= 0.12;
        }

        if (
          phase.name === "refined-edge" &&
          candidate.seedProfile.preferredSessions.includes("New York")
        ) {
          weight *= 1.08;
        }

        return weight;
      }
    );
    const model = selectedEdge.name;
    const alignment = weightedPick(
      alignments,
      (candidate) => phase.alignmentWeights[candidate]
    );
    const symbol = weightedPick(symbols, (candidate) => {
      let weight = 1;
      if (selectedEdge.seedProfile.preferredSymbols.includes(candidate)) {
        weight += 1.35;
      } else {
        weight -= 0.08;
      }
      if (
        session === "London" &&
        (candidate === "EURUSD" ||
          candidate === "GBPUSD" ||
          candidate === "XAUUSD")
      ) {
        weight += 0.9;
      }
      if (
        session === "New York" &&
        (candidate === "XAUUSD" ||
          candidate === "AUDUSD" ||
          candidate === "USDJPY")
      ) {
        weight += 0.75;
      }
      if (
        session === "Asian" &&
        (candidate === "USDJPY" || candidate === "AUDUSD")
      ) {
        weight += 0.8;
      }
      if (phase.name === "refined-edge" && candidate === "EURUSD") {
        weight += 0.35;
      }
      if (phase.name === "leak-cluster" && candidate === "GBPUSD") {
        weight += 0.45;
      }
      if (selectedEdge.name === "News Fade Continuation" && candidate === "XAUUSD") {
        weight += 0.7;
      }
      if (selectedEdge.name === "NY Midday Reclaim" && candidate === "XAUUSD") {
        weight += 0.55;
      }
      if (selectedEdge.name === "Macro Pullback" && candidate === "EURUSD") {
        weight += 0.35;
      }
      return Math.max(0.1, weight);
    });
    const tradeDirection = pickDirectionForEdge(selectedEdge.seedProfile, session);
    const directionFactor = tradeDirection === "long" ? 1 : -1;
    const edgeArchetype = selectedEdge.seedProfile.archetype;
    const isGold = symbol === "XAUUSD";
    const pipSize = pipSizes[symbol];
    const pipValue = pipValuePerLot[symbol];
    const pricePrecision =
      symbol === "XAUUSD" ? 2 : symbol === "USDJPY" ? 3 : 5;
    const previousSessionOrder =
      previousSession != null ? sessionOrder[previousSession] : -1;
    const sessionPosition = sessionOrder[session];
    const openNewDay =
      i === 0 ||
      (!isRevengeTrade &&
        (sessionPosition <= previousSessionOrder ||
          Math.random() > phase.sameDayProbability));
    if (i > 0 && openNewDay) {
      currentTradingDayIndex = Math.min(
        lastTradingDayIndex,
        currentTradingDayIndex + (Math.random() < 0.18 ? 2 : 1)
      );
      currentTradingDay = new Date(
        availableTradingDays[currentTradingDayIndex] ?? currentTradingDay
      );
    }

    let openTs: number =
      isRevengeTrade && previousCloseTs
        ? previousCloseTs + (4 + Math.floor(Math.random() * 9)) * 60 * 1000
        : buildSessionTimestamp(currentTradingDay, session);
    if (previousCloseTs && openTs <= previousCloseTs) {
      if (currentTradingDayIndex < lastTradingDayIndex) {
        currentTradingDayIndex += 1;
        currentTradingDay = new Date(
          availableTradingDays[currentTradingDayIndex] ?? currentTradingDay
        );
        openTs = buildSessionTimestamp(currentTradingDay, session);
      } else {
        openTs =
          previousCloseTs + (4 + Math.floor(Math.random() * 9)) * 60 * 1000;
      }
    }

    const isSwingTrade = Math.random() < 0.12;
    const holdSeconds = isSwingTrade
      ? 22 * 3600 + Math.floor(Math.random() * 50 * 3600)
      : 12 * 60 + Math.floor(Math.random() * (6 * 60 * 60));
    const closeTs: number = openTs + holdSeconds * 1000;
    const openTime = new Date(openTs);
    const closeTime = new Date(closeTs);
    const volume = roundTo(
      isGold ? 0.2 + Math.random() * 0.8 : 0.2 + Math.random() * 1.2,
      2
    );
    const openPrice =
      basePrices[symbol] +
      (Math.random() - 0.5) *
        pipSize *
        (isGold ? 300 : symbol === "USDJPY" ? 220 : 180);
    let plannedRR = roundTo(
      phase.name === "refined-edge"
        ? 1.8 + Math.random() * 1.2
        : phase.name === "leak-cluster"
        ? 1.2 + Math.random() * 1.0
        : 1.4 + Math.random() * 1.3,
      2
    );
    if (model === "Liquidity Raid") plannedRR = roundTo(plannedRR + 0.18, 2);
    if (alignment === "against") plannedRR = roundTo(plannedRR - 0.12, 2);
    const riskPips = roundTo(
      isGold ? 45 + Math.random() * 85 : 12 + Math.random() * 28,
      1
    );
    const targetPips = roundTo(riskPips * plannedRR, 1);
    let edgeScore = phase.baseEdge;
    edgeScore +=
      session === "London" ? 0.11 : session === "New York" ? 0.02 : -0.11;
    edgeScore +=
      alignment === "aligned"
        ? 0.14
        : alignment === "discretionary"
        ? -0.03
        : -0.18;
    edgeScore +=
      edgeArchetype === "reversal"
        ? 0.08
        : edgeArchetype === "continuation"
        ? 0.05
        : edgeArchetype === "breakout"
        ? 0.03
        : edgeArchetype === "macro"
        ? 0.07
        : edgeArchetype === "midday"
        ? -0.01
        : edgeArchetype === "news"
        ? 0.01
        : 0;
    if (
      session === "London" &&
      model === "Liquidity Raid" &&
      alignment === "aligned"
    ) {
      edgeScore += 0.16;
    }
    if (
      session === "New York" &&
      model === "Breaker Block" &&
      alignment === "aligned"
    ) {
      edgeScore += 0.08;
    }
    if (session === "Asian" && model === "Trend Continuation") {
      edgeScore -= 0.2;
    }
    if (selectedEdge.name === "Supply Zone") {
      edgeScore += symbol === "XAUUSD" || symbol === "GBPUSD" ? 0.05 : 0.01;
    }
    if (selectedEdge.name === "Macro Pullback" && tradeDirection === "long") {
      edgeScore += 0.07;
    }
    if (selectedEdge.name === "Range Rotation" && session === "Asian") {
      edgeScore += 0.06;
    }
    if (selectedEdge.name === "News Fade Continuation" && session === "New York") {
      edgeScore += 0.11;
    }
    if (selectedEdge.name === "NY Midday Reclaim" && session === "New York") {
      edgeScore += 0.12;
    }
    if (selectedEdge.name === "HTF Reversal Sweep" && symbol === "XAUUSD") {
      edgeScore += 0.04;
    }
    if (
      session === "New York" &&
      alignment !== "aligned" &&
      (symbol === "GBPUSD" || symbol === "XAUUSD")
    ) {
      edgeScore -= 0.16;
    }
    if (
      phase.name === "refined-edge" &&
      session === "London" &&
      symbol === "EURUSD"
    ) {
      edgeScore += 0.08;
    }
    if (phase.name === "leak-cluster" && alignment !== "aligned") {
      edgeScore -= 0.08;
    }
    if (tradeDirection === "long" && session === "Asian") {
      edgeScore -= 0.03;
    }
    if (consecutiveLosses >= 2) {
      edgeScore += phase.name === "leak-cluster" ? -0.06 : -0.02;
    }
    if (consecutiveWins >= 3 && phase.name === "refined-edge") {
      edgeScore += 0.03;
    }

    const forcedOutcome = forcedOutcomes.get(i) ?? null;
    const winProbability = clampNumber(0.24, 0.82, 0.51 + edgeScore);
    const breakevenProbability = forcedOutcome
      ? 0
      : phase.name === "leak-cluster"
      ? 0.05
      : 0.08;

    let outcomeBucket: "win" | "loss" | "breakeven";
    if (forcedOutcome) {
      outcomeBucket = forcedOutcome;
    } else {
      const resultRoll = Math.random();
      if (resultRoll < winProbability) {
        outcomeBucket = "win";
      } else if (resultRoll < winProbability + breakevenProbability) {
        outcomeBucket = "breakeven";
      } else {
        outcomeBucket = "loss";
      }
    }

    let realisedRRSeed: number;
    if (outcomeBucket === "win") {
      const minWinRR =
        phase.name === "refined-edge"
          ? 1.2
          : phase.name === "foundation"
            ? 0.85
            : phase.name === "recovery"
              ? 0.95
              : 0.65;
      const maxWinRR =
        phase.name === "refined-edge"
          ? 2.8
          : phase.name === "foundation"
            ? 2.15
            : phase.name === "recovery"
              ? 2.25
              : 1.65;
      realisedRRSeed = roundTo(
        randBetween(minWinRR, maxWinRR) +
          (alignment === "aligned" ? 0.1 : -0.06) +
          (session === "London" ? 0.08 : 0),
        2
      );
    } else if (outcomeBucket === "breakeven") {
      realisedRRSeed = roundTo((Math.random() - 0.5) * 0.18, 2);
    } else {
      const baseLoss =
        alignment === "aligned"
          ? randBetween(0.35, 0.85)
          : randBetween(0.75, 1.12);
      realisedRRSeed = -roundTo(
        Math.min(
          1.3,
          baseLoss +
            (phase.name === "leak-cluster" ? 0.08 : 0) +
            (session === "Asian" && model === "Trend Continuation" ? 0.06 : 0)
        ),
        2
      );
    }

    const resultPips = roundTo(riskPips * realisedRRSeed, 1);
    const closePrice = openPrice + directionFactor * resultPips * pipSize;
    const sl = openPrice - directionFactor * riskPips * pipSize;
    const tp = openPrice + directionFactor * targetPips * pipSize;

    const favorablePips =
      resultPips >= 0
        ? Math.max(
            resultPips,
            roundTo(
              riskPips * (Math.abs(realisedRRSeed) + 0.2 + Math.random() * 0.8),
              1
            )
          )
        : roundTo(riskPips * (0.15 + Math.random() * 0.9), 1);
    const adversePips =
      resultPips < 0
        ? Math.max(
            Math.abs(resultPips),
            roundTo(riskPips * (0.7 + Math.random() * 0.5), 1)
          )
        : roundTo(riskPips * (0.12 + Math.random() * 0.75), 1);
    const postExitContinuationPips = roundTo(
      riskPips *
        (resultPips >= 0
          ? 0.15 + Math.random() * 0.9
          : 0.1 + Math.random() * 0.5),
      1
    );

    const entryPeakPrice =
      tradeDirection === "long"
        ? openPrice + favorablePips * pipSize
        : openPrice - favorablePips * pipSize;
    const postExitPeakPrice =
      tradeDirection === "long"
        ? closePrice + postExitContinuationPips * pipSize
        : closePrice - postExitContinuationPips * pipSize;
    const manipulationHigh =
      tradeDirection === "long"
        ? openPrice + favorablePips * pipSize
        : openPrice + adversePips * pipSize;
    const manipulationLow =
      tradeDirection === "long"
        ? openPrice - adversePips * pipSize
        : openPrice - favorablePips * pipSize;

    const poorExecutionBias =
      phase.name === "leak-cluster" || alignment !== "aligned";
    const commissionCost = roundTo(volume * (isGold ? 7.2 : 6.1), 2);
    const nightsCrossed = Math.floor(holdSeconds / 86_400);
    const swapValue =
      nightsCrossed === 0
        ? 0
        : roundTo(
            nightsCrossed *
              (Math.random() - 0.72) *
              volume *
              (isGold ? 5.5 : 1.8),
            2
          );
    const grossProfit = resultPips * volume * pipValue;
    const netProfit = roundTo(grossProfit - commissionCost + swapValue, 2);
    const entryMargin = roundTo(
      (volume * (isGold ? 100 : 100_000) * openPrice) / 100,
      2
    );
    const entryEquity = roundTo(
      runningBalance + (Math.random() - 0.5) * 250,
      2
    );
    const entryFreeMargin = roundTo(entryEquity - entryMargin, 2);
    const entryMarginLevel =
      entryMargin > 0 ? roundTo((entryEquity / entryMargin) * 100, 2) : null;
    const entryPeakDurationSeconds = Math.max(
      90,
      Math.min(
        holdSeconds - 60,
        Math.round(holdSeconds * (0.18 + Math.random() * 0.55))
      )
    );
    const postExitPeakDurationSeconds =
      5 * 60 + Math.floor(Math.random() * 55 * 60);
    const postExitSamplingDuration = Math.max(
      3600,
      postExitPeakDurationSeconds + 300
    );
    const entryPeakTimestamp = new Date(
      openTs + entryPeakDurationSeconds * 1000
    );
    const postExitPeakTimestamp = new Date(
      closeTs + postExitPeakDurationSeconds * 1000
    );
    const entrySpreadPips = roundTo(
      isGold
        ? 2.2 + Math.random() * (poorExecutionBias ? 2.6 : 1.6)
        : 0.4 + Math.random() * (poorExecutionBias ? 1.8 : 1.1),
      1
    );
    const exitSpreadPips = roundTo(
      entrySpreadPips +
        (Math.random() - 0.3) * (poorExecutionBias ? 0.8 : 0.5),
      1
    );
    const entrySlippagePips = roundTo(
      Math.random() *
        (poorExecutionBias ? (isGold ? 2.1 : 0.9) : isGold ? 1.1 : 0.35),
      1
    );
    const exitSlippagePips = roundTo(
      Math.random() *
        (poorExecutionBias ? (isGold ? 2.4 : 1.1) : isGold ? 1.2 : 0.45),
      1
    );
    const scaleInCount =
      Math.random() > (poorExecutionBias ? 0.68 : 0.82) ? 1 : 0;
    const scaleOutCount =
      Math.random() > (alignment === "aligned" ? 0.78 : 0.64) ? 1 : 0;
    const partialCloseCount =
      scaleOutCount > 0 ? 1 + Math.floor(Math.random() * 2) : 0;
    const entryDealCount = 1 + scaleInCount;
    const exitDealCount = 1 + partialCloseCount;
    const exitVolume = roundTo(
      Math.max(volume - (partialCloseCount > 0 ? volume * 0.15 : 0), 0.01),
      2
    );
    const alphaWeightedMpe = 0.3;
    const beThresholdPips = isGold ? 1 : 0.5;

    const exitReason =
      outcomeBucket === "win"
        ? Math.random() > 0.18
          ? "tp"
          : "expert"
        : outcomeBucket === "loss"
          ? Math.random() > 0.18
            ? "sl"
            : "expert"
          : "client";
    const tradeComment = `[ProfitEdge] ${exitReason}`;
    const tradeBrokerMeta = {
      comment: tradeComment,
      magicNumber: 11001,
      entryDeal: {
        dealId: 200000 + i,
        reason: "expert",
        type: tradeDirection === "long" ? "buy" : "sell",
      },
      exitDeal: {
        dealId: 200001 + i,
        reason: exitReason,
        type: tradeDirection === "long" ? "sell" : "buy",
      },
    };

    const advanced = calculateAllAdvancedMetrics(
      {
        id: `${accountId}-${i}`,
        symbol,
        tradeDirection,
        entryPrice: openPrice,
        sl,
        tp,
        closePrice,
        profit: netProfit,
        commissions: commissionCost,
        swap: swapValue,
        volume,
        manipulationHigh,
        manipulationLow,
        manipulationPips: null,
        entryPeakPrice,
        postExitPeakPrice,
        alphaWeightedMpe,
        beThresholdPips,
      },
      tradeCount,
      true
    );

    const tradeId = `${accountId}:demo-trade:${String(i + 1).padStart(3, "0")}`;
    closedTrades.push({
      id: tradeId,
      accountId,
      ticket: `SIM-${String(i + 1).padStart(5, "0")}`,
      open: openTime.toISOString(),
      tradeType: tradeDirection,
      volume: volume.toFixed(2),
      symbol,
      openPrice: formatPrice(symbol, openPrice),
      sl: formatPrice(symbol, sl),
      tp: formatPrice(symbol, tp),
      close: closeTime.toISOString(),
      closePrice: formatPrice(symbol, closePrice),
      swap: swapValue.toFixed(2),
      commissions: commissionCost.toFixed(2),
      profit: netProfit.toFixed(2),
      pips: resultPips.toFixed(1),
      tradeDurationSeconds: holdSeconds.toString(),
      openTime,
      closeTime,
      useBrokerData: 1,
      manipulationHigh: formatPrice(symbol, manipulationHigh),
      manipulationLow: formatPrice(symbol, manipulationLow),
      manipulationPips:
        advanced.manipulationPips != null
          ? advanced.manipulationPips.toFixed(1)
          : null,
      entryPeakPrice: formatPrice(symbol, entryPeakPrice),
      entryPeakTimestamp,
      postExitPeakPrice: formatPrice(symbol, postExitPeakPrice),
      postExitPeakTimestamp,
      postExitSamplingDuration,
      entrySpreadPips: entrySpreadPips.toFixed(1),
      exitSpreadPips: exitSpreadPips.toFixed(1),
      entrySlippagePips: entrySlippagePips.toFixed(1),
      exitSlippagePips: exitSlippagePips.toFixed(1),
      slModCount: poorExecutionBias
        ? 2 + Math.floor(Math.random() * 3)
        : Math.floor(Math.random() * 2),
      tpModCount:
        alignment === "aligned"
          ? Math.floor(Math.random() * 2)
          : 1 + Math.floor(Math.random() * 2),
      partialCloseCount,
      exitDealCount,
      exitVolume: exitVolume.toFixed(2),
      entryDealCount,
      entryVolume: volume.toFixed(2),
      scaleInCount,
      scaleOutCount,
      trailingStopDetected:
        alignment === "aligned" ? Math.random() > 0.48 : Math.random() > 0.74,
      entryPeakDurationSeconds,
      postExitPeakDurationSeconds,
      entryBalance: runningBalance.toFixed(2),
      entryEquity: entryEquity.toFixed(2),
      entryMargin: entryMargin.toFixed(2),
      entryFreeMargin: entryFreeMargin.toFixed(2),
      entryMarginLevel:
        entryMarginLevel != null ? entryMarginLevel.toFixed(2) : null,
      alphaWeightedMpe: alphaWeightedMpe.toFixed(2),
      beThresholdPips: beThresholdPips.toFixed(2),
      sessionTag: session,
      sessionTagColor: sessionColors[session],
      modelTag: model,
      modelTagColor: modelColors[model],
      protocolAlignment: alignment,
      outcome: advanced.outcome,
      plannedRR:
        advanced.plannedRR != null ? advanced.plannedRR.toFixed(2) : null,
      plannedRiskPips:
        advanced.plannedRiskPips != null
          ? advanced.plannedRiskPips.toFixed(1)
          : null,
      plannedTargetPips:
        advanced.plannedTargetPips != null
          ? advanced.plannedTargetPips.toFixed(1)
          : null,
      mfePips: advanced.mfePips != null ? advanced.mfePips.toFixed(1) : null,
      maePips: advanced.maePips != null ? advanced.maePips.toFixed(1) : null,
      mpeManipLegR:
        advanced.mpeManipLegR != null ? advanced.mpeManipLegR.toFixed(2) : null,
      mpeManipPE_R:
        advanced.mpeManipPE_R != null ? advanced.mpeManipPE_R.toFixed(2) : null,
      maxRR: advanced.maxRR != null ? advanced.maxRR.toFixed(2) : null,
      rawSTDV: advanced.rawSTDV != null ? advanced.rawSTDV.toFixed(2) : null,
      rawSTDV_PE:
        advanced.rawSTDV_PE != null ? advanced.rawSTDV_PE.toFixed(2) : null,
      stdvBucket: advanced.stdvBucket,
      estimatedWeightedMPE_R:
        advanced.estimatedWeightedMPE_R != null
          ? advanced.estimatedWeightedMPE_R.toFixed(2)
          : null,
      realisedRR:
        advanced.realisedRR != null ? advanced.realisedRR.toFixed(2) : null,
      rrCaptureEfficiency:
        advanced.rrCaptureEfficiency != null
          ? advanced.rrCaptureEfficiency.toFixed(2)
          : null,
      manipRREfficiency:
        advanced.manipRREfficiency != null
          ? advanced.manipRREfficiency.toFixed(2)
          : null,
      exitEfficiency:
        advanced.exitEfficiency != null
          ? advanced.exitEfficiency.toFixed(2)
          : null,
      killzone: session,
      killzoneColor: sessionColors[session],
      brokerMeta: tradeBrokerMeta,
      createdAt: closeTime,
    });

    runningBalance = roundTo(runningBalance + netProfit, 2);
    previousCloseTs = closeTs;
    previousSession = session;
    previousOutcome = outcomeBucket;
    if (outcomeBucket === "loss") {
      consecutiveLosses += 1;
      consecutiveWins = 0;
    } else if (outcomeBucket === "win") {
      consecutiveWins += 1;
      consecutiveLosses = 0;
    } else {
      consecutiveWins = 0;
      consecutiveLosses = 0;
    }
  }

  const liveOpenTrades: (typeof openTrade.$inferInsert)[] = [];
  let totalFloatingPnl = 0;
  let totalOpenMargin = 0;

  for (let i = 0; i < openTradeCount; i++) {
    const symbol = pick(symbols);
    const session = pick(sessions);
    const direction = Math.random() > 0.5 ? "long" : "short";
    const directionFactor = direction === "long" ? 1 : -1;
    const isGold = symbol === "XAUUSD";
    const pipSize = pipSizes[symbol];
    const pipValue = pipValuePerLot[symbol];
    const volume = roundTo(
      isGold ? 0.2 + Math.random() * 0.6 : 0.2 + Math.random() * 1.0,
      2
    );
    const openPrice =
      basePrices[symbol] +
      (Math.random() - 0.5) *
        pipSize *
        (isGold ? 160 : symbol === "USDJPY" ? 120 : 100);
    const riskPips = roundTo(
      isGold ? 40 + Math.random() * 55 : 10 + Math.random() * 18,
      1
    );
    const targetPips = roundTo(riskPips * (1.6 + Math.random() * 1.2), 1);
    const openTs = now - (20 * 60 * 1000 + Math.random() * 8 * 60 * 60 * 1000);
    const currentPips = roundTo((Math.random() - 0.2) * riskPips * 0.9, 1);
    const currentPrice = openPrice + directionFactor * currentPips * pipSize;
    const sl = openPrice - directionFactor * riskPips * pipSize;
    const tp = openPrice + directionFactor * targetPips * pipSize;
    const commission = roundTo(volume * (isGold ? 3.4 : 2.8), 2);
    const swap = roundTo((Math.random() - 0.65) * volume * 0.8, 2);
    const floatingPnl = roundTo(
      currentPips * volume * pipValue - commission + swap,
      2
    );
    const margin = roundTo(
      (volume * (isGold ? 100 : 100_000) * openPrice) / 100,
      2
    );

    totalFloatingPnl += floatingPnl;
    totalOpenMargin += margin;

    liveOpenTrades.push({
      id: `${accountId}:demo-open-trade:${String(i + 1).padStart(3, "0")}`,
      accountId,
      ticket: `LIVE-${String(i + 1).padStart(4, "0")}`,
      symbol,
      tradeType: direction,
      volume: volume.toFixed(2),
      openPrice: formatPrice(symbol, openPrice),
      openTime: new Date(openTs),
      sl: formatPrice(symbol, sl),
      tp: formatPrice(symbol, tp),
      currentPrice: formatPrice(symbol, currentPrice),
      swap: swap.toFixed(2),
      commission: commission.toFixed(2),
      profit: floatingPnl.toFixed(2),
      sessionTag: session,
      sessionTagColor: sessionColors[session],
      slModCount: Math.floor(Math.random() * 2),
      tpModCount: Math.floor(Math.random() * 2),
      partialCloseCount: Math.random() > 0.8 ? 1 : 0,
      entryDealCount: 1,
      exitDealCount: 0,
      entryVolume: volume.toFixed(2),
      exitVolume: "0.00",
      scaleInCount: 0,
      scaleOutCount: 0,
      trailingStopDetected: Math.random() > 0.6,
      comment: `Live demo ${session} setup`,
      magicNumber: 1000 + i,
      lastUpdatedAt: nowDate,
      createdAt: new Date(openTs),
    });
  }

  const liveBalance = roundTo(runningBalance, 2);
  const liveEquity = roundTo(liveBalance + totalFloatingPnl, 2);
  const liveMargin = roundTo(totalOpenMargin, 2);
  const liveFreeMargin = roundTo(liveEquity - liveMargin, 2);

  let account: DemoSeedAccountRow;
  let effectiveClosedTrades:
    | (typeof trade.$inferInsert)[]
    | DemoSeedTradeRow[] = closedTrades;
  let effectiveLiveOpenTrades:
    | (typeof openTrade.$inferInsert)[]
    | DemoSeedOpenTradeRow[] = liveOpenTrades;

  const [seededAccountRow] = await db
    .update(tradingAccount)
    .set({
      name: DEMO_ACCOUNT_NAME,
      broker: DEMO_BROKER,
      brokerType: "mt5",
      brokerServer: DEMO_BROKER_SERVER,
      accountNumber,
      preferredDataSource: "broker",
      averageSpreadPips: "1.20",
      initialBalance: initialBalance.toFixed(2),
      initialCurrency: "USD",
      isVerified: 1,
      liveBalance: liveBalance.toFixed(2),
      liveEquity: liveEquity.toFixed(2),
      liveMargin: liveMargin.toFixed(2),
      liveFreeMargin: liveFreeMargin.toFixed(2),
      lastSyncedAt: nowDate,
      propManualOverride: false,
      verificationLevel: "ea_synced",
      socialOptIn: true,
      socialVisibleSince: new Date(now - 14 * 24 * 60 * 60 * 1000),
      followerCount: 12,
      feedEventCount: 0,
    })
    .where(and(eq(tradingAccount.id, accountId), eq(tradingAccount.userId, userId)))
    .returning();

  if (!seededAccountRow) {
    throw new Error("Demo workspace account not found");
  }

  await Promise.all([
    insertRowsInBatches(closedTrades, (batch) =>
      db.insert(trade).values(batch).onConflictDoNothing()
    ),
    liveOpenTrades.length > 0
      ? db.insert(openTrade).values(liveOpenTrades).onConflictDoNothing()
      : Promise.resolve(),
  ]);

  const existingSeedState = await loadExistingDemoWorkspaceSeedState(
    userId,
    accountId
  );
  account = existingSeedState.account;
  effectiveClosedTrades = existingSeedState.closedTrades;
  effectiveLiveOpenTrades = existingSeedState.liveOpenTrades;

  const tradeIdsByModel = new Map<
    string,
    { tradeIds: string[]; color: string | null }
  >();

  for (const row of effectiveClosedTrades) {
    const modelTag = String(row.modelTag ?? "").trim();
    if (!modelTag) continue;

    const existingGroup = tradeIdsByModel.get(modelTag) ?? {
      tradeIds: [],
      color: row.modelTagColor ?? modelColors[modelTag] ?? null,
    };

    existingGroup.tradeIds.push(row.id);
    if (!existingGroup.color && row.modelTagColor) {
      existingGroup.color = row.modelTagColor;
    }

    tradeIdsByModel.set(modelTag, existingGroup);
  }

  for (const [modelTag, assignment] of tradeIdsByModel) {
    await bulkAssignLegacyModelTagToTrades({
      tradeIds: assignment.tradeIds,
      userId,
      modelTag,
      modelTagColor: assignment.color,
    });
  }

  const effectiveTotalFloatingPnl = effectiveLiveOpenTrades.reduce(
    (sum, row) => sum + Number(row.profit || 0),
    0
  );

  const closedTradesByDay = new Map<
    string,
    { profit: number; count: number; closeTimes: Date[] }
  >();
  for (const row of effectiveClosedTrades) {
    const closeTime = row.closeTime instanceof Date ? row.closeTime : null;
    if (!closeTime) continue;
    const dateKey = formatDay(closeTime);
    const existing = closedTradesByDay.get(dateKey) || {
      profit: 0,
      count: 0,
      closeTimes: [],
    };
    existing.profit += Number(row.profit || 0);
    existing.count += 1;
    existing.closeTimes.push(closeTime);
    closedTradesByDay.set(dateKey, existing);
  }

  const snapshots: (typeof equitySnapshot.$inferInsert)[] = [];
  let rollingBalance = initialBalance;
  const snapshotBaseDate = startOfUtcDay(nowDate);

  for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
    const date = new Date(snapshotBaseDate);
    date.setUTCDate(date.getUTCDate() - dayOffset);
    const dateKey = formatDay(date);
    const dayData = closedTradesByDay.get(dateKey) || {
      profit: 0,
      count: 0,
      closeTimes: [],
    };
    const startingBalance = rollingBalance;
    const dailyProfit = roundTo(dayData.profit, 2);
    const endingBalance = roundTo(startingBalance + dailyProfit, 2);
    const floatingForDay = dayOffset === 0 ? effectiveTotalFloatingPnl : 0;
    const endingEquity = roundTo(endingBalance + floatingForDay, 2);
    const dailyHighWaterMark = roundTo(
      Math.max(startingBalance, endingBalance, endingEquity) +
        (dayData.count > 0 ? Math.random() * 180 : 0),
      2
    );
    const lowEquity = roundTo(
      Math.min(startingBalance, endingBalance, endingEquity) -
        (dayData.count > 0 ? Math.random() * 140 : 0),
      2
    );

    snapshots.push({
      accountId,
      snapshotDate: dateKey,
      balance: endingBalance.toFixed(2),
      equity: endingEquity.toFixed(2),
      floatingPnl: floatingForDay.toFixed(2),
      highEquity: dailyHighWaterMark.toFixed(2),
      lowEquity: lowEquity.toFixed(2),
      closedTradesCount: dayData.count,
      dailyRealizedPnl: dailyProfit.toFixed(2),
      source: "manual",
      createdAt: new Date(date.getTime() + 18 * 60 * 60 * 1000),
      updatedAt: new Date(date.getTime() + 18 * 60 * 60 * 1000),
    });
    rollingBalance = endingBalance;
  }

  const [existingChecklistTemplate] = await db
    .select({ id: tradeChecklistTemplate.id })
    .from(tradeChecklistTemplate)
    .where(
      and(
        eq(tradeChecklistTemplate.accountId, accountId),
        eq(tradeChecklistTemplate.userId, userId),
        eq(tradeChecklistTemplate.name, "Demo Pre-Trade Checklist")
      )
    )
    .orderBy(asc(tradeChecklistTemplate.createdAt))
    .limit(1);

  const checklistTemplateId =
    existingChecklistTemplate?.id ?? crypto.randomUUID();
  const checklistTemplateRow: typeof tradeChecklistTemplate.$inferInsert = {
    id: checklistTemplateId,
    accountId,
    userId,
    name: "Demo Pre-Trade Checklist",
    description: "Seeded checklist for the demo account",
    strategyTag: "Liquidity Raid",
    items: [
      { label: "Session bias is clear", isRequired: true, category: "context" },
      {
        label: "Risk is defined before entry",
        isRequired: true,
        category: "risk",
      },
      {
        label: "Entry matches model criteria",
        isRequired: true,
        category: "execution",
      },
      {
        label: "News and liquidity context checked",
        isRequired: false,
        category: "context",
      },
    ],
    isDefault: true,
  };

  const checklistSeedTrades = effectiveClosedTrades.slice(-36);
  const checklistTradeIds = checklistSeedTrades
    .map((row) => row.id)
    .filter((tradeId): tradeId is string => Boolean(tradeId));
  const existingChecklistResultTradeIds =
    checklistTradeIds.length > 0
      ? new Set(
          (
            await db
              .select({ tradeId: tradeChecklistResult.tradeId })
              .from(tradeChecklistResult)
              .where(
                and(
                  eq(tradeChecklistResult.accountId, accountId),
                  inArray(tradeChecklistResult.tradeId, checklistTradeIds)
                )
              )
          )
            .map((row) => row.tradeId)
            .filter((tradeId): tradeId is string => Boolean(tradeId))
        )
      : new Set<string>();
  const checklistRows: (typeof tradeChecklistResult.$inferInsert)[] =
    checklistSeedTrades
      .filter(
        (row) => row.id && !existingChecklistResultTradeIds.has(row.id)
      )
      .map((row, index) => {
        const openTime = row.openTime instanceof Date ? row.openTime : nowDate;
        const completionRate = Math.max(
          50,
          Math.min(100, 72 + ((index % 5) - 2) * 8 + Math.random() * 12)
        );
        const completedItems = Array.from({ length: 4 }, (_, itemIndex) => ({
          itemIndex,
          checked: itemIndex < Math.round((completionRate / 100) * 4),
          timestamp: new Date(
            openTime.getTime() - (4 - itemIndex) * 60 * 1000
          ).toISOString(),
        }));

        return {
          id: crypto.randomUUID(),
          templateId: checklistTemplateId,
          tradeId: row.id,
          accountId,
          userId,
          completedItems,
          completionRate: completionRate.toFixed(2),
          createdAt: new Date(openTime.getTime() - 5 * 60 * 1000),
        };
      });

  await Promise.all([
    runOptionalDemoSeedStep("equity snapshot seed", () =>
      insertRowsInBatches(snapshots, (batch) =>
        db
          .insert(equitySnapshot)
          .values(batch)
          .onConflictDoNothing({
            target: [equitySnapshot.accountId, equitySnapshot.snapshotDate],
          })
      )
    ),
    runOptionalDemoSeedStep("trade checklist seed", async () => {
      if (existingChecklistTemplate) {
        await db
          .update(tradeChecklistTemplate)
          .set({
            description: checklistTemplateRow.description,
            strategyTag: checklistTemplateRow.strategyTag,
            items: checklistTemplateRow.items,
            isDefault: checklistTemplateRow.isDefault,
            updatedAt: new Date(),
          })
          .where(eq(tradeChecklistTemplate.id, checklistTemplateId));
      } else {
        await db.insert(tradeChecklistTemplate).values(checklistTemplateRow);
      }

      if (checklistRows.length > 0) {
        await db.insert(tradeChecklistResult).values(checklistRows);
      }
    }),
  ]);

  const reviewTradeIds = effectiveClosedTrades
    .slice(-36)
    .map((row) => row.id)
    .filter((tradeId): tradeId is string => Boolean(tradeId));

  const feedTradeIds = effectiveClosedTrades
    .slice(-24)
    .map((row) => row.id)
    .filter((tradeId): tradeId is string => Boolean(tradeId));

  const richTradeSeedRows = [...effectiveClosedTrades].slice(-18).reverse();
  const mediaRows: (typeof tradeMedia.$inferInsert)[] = [];
  const noteRows: (typeof tradeNote.$inferInsert)[] = [];
  const annotationRows: (typeof tradeAnnotation.$inferInsert)[] = [];

  richTradeSeedRows.forEach((row, index) => {
    if (!row.id) return;
    const symbol = row.symbol || "TRADE";
    const pnl = Number(row.profit || 0);
    const realizedRR = Number(row.realisedRR || 0);
    const session = row.sessionTag || "London";
    const model = row.modelTag || "Discretionary";
    const closeTime = (row.closeTime as Date) || nowDate;
    const entryAccent = pnl >= 0 ? "#14b8a6" : "#f59e0b";
    const analysisAccent = pnl >= 0 ? "#22c55e" : "#f43f5e";
    const tradeLabel = `${symbol} ${String(row.tradeType || "").toUpperCase()}`;
    const noteText = [
      `${tradeLabel} in ${session} using ${model}.`,
      pnl >= 0
        ? `Execution stayed patient and realized ${realizedRR.toFixed(2)}R.`
        : `Loss came from weak follow-through after entry and closed at ${realizedRR.toFixed(
            2
          )}R.`,
      `Next focus: ${
        pnl >= 0
          ? "repeat the same process without adding risk"
          : "tighten qualification before the click"
      }.`,
    ].join(" ");

    mediaRows.push(
      {
        id: crypto.randomUUID(),
        tradeId: row.id,
        userId,
        mediaType: "image",
        url: createDemoTradeImage({
          symbol,
          title: "Entry Context",
          accent: entryAccent,
          subtitle: `${session} session · ${model} · ${tradeLabel}`,
          metric: `Risk ${Number(row.plannedRiskPips || 0).toFixed(1)} pips`,
        }),
        thumbnailUrl: null,
        fileName: `${symbol.toLowerCase()}-entry-context.svg`,
        fileSize: 24_000,
        mimeType: "image/svg+xml",
        width: 1280,
        height: 720,
        altText: `${symbol} entry context screenshot`,
        caption: `${session} setup context`,
        description: `Seeded entry screenshot showing the setup context for ${tradeLabel}.`,
        isEntryScreenshot: true,
        isExitScreenshot: false,
        isAnalysis: false,
        sortOrder: 0,
        createdAt: new Date(closeTime.getTime() - 10 * 60 * 1000),
      },
      {
        id: crypto.randomUUID(),
        tradeId: row.id,
        userId,
        mediaType: "image",
        url: createDemoTradeImage({
          symbol,
          title: "Post-Trade Review",
          accent: analysisAccent,
          subtitle: `${
            pnl >= 0 ? "Winner managed" : "Loss reviewed"
          } · ${session}`,
          metric: `${pnl >= 0 ? "+" : "-"}$${Math.abs(pnl).toFixed(2)}`,
        }),
        thumbnailUrl: null,
        fileName: `${symbol.toLowerCase()}-post-trade-review.svg`,
        fileSize: 26_000,
        mimeType: "image/svg+xml",
        width: 1280,
        height: 720,
        altText: `${symbol} analysis screenshot`,
        caption: "Post-trade markup",
        description: `Seeded post-trade review screenshot for ${tradeLabel}.`,
        isEntryScreenshot: false,
        isExitScreenshot: index % 3 === 0,
        isAnalysis: true,
        sortOrder: 1,
        createdAt: new Date(closeTime.getTime() - 2 * 60 * 1000),
      }
    );

    noteRows.push({
      id: crypto.randomUUID(),
      tradeId: row.id,
      userId,
      content: [
        {
          id: crypto.randomUUID(),
          type: "paragraph",
          content: noteText,
        },
      ],
      htmlContent: `<p>${noteText}</p>`,
      plainTextContent: noteText,
      wordCount: noteText.split(/\s+/).filter(Boolean).length,
      createdAt: new Date(closeTime.getTime() - 90 * 1000),
      updatedAt: new Date(closeTime.getTime() - 90 * 1000),
    });

    annotationRows.push({
      id: crypto.randomUUID(),
      tradeId: row.id,
      userId,
      content:
        pnl >= 0
          ? `${session} ${model} execution stayed within plan and paid as expected.`
          : `${session} trade slipped away after entry. Qualification needs to be tighter next time.`,
      annotationType:
        pnl >= 0
          ? "execution_note"
          : index % 2 === 0
            ? "rule_note"
            : "learning_note",
      isPublic: index < 6 && pnl >= 0,
      createdAt: new Date(closeTime.getTime() - 60 * 1000),
      editableUntil: new Date(closeTime.getTime() + 4 * 60 * 1000),
      editedAt: null,
    });
  });

  const richTradeIds = richTradeSeedRows
    .map((row) => row.id)
    .filter((tradeId): tradeId is string => Boolean(tradeId));
  const [existingMediaRows, existingNoteRows, existingAnnotationRows] =
    richTradeIds.length > 0
      ? await Promise.all([
          db
            .select({
              tradeId: tradeMedia.tradeId,
              sortOrder: tradeMedia.sortOrder,
            })
            .from(tradeMedia)
            .where(inArray(tradeMedia.tradeId, richTradeIds)),
          db
            .select({ tradeId: tradeNote.tradeId })
            .from(tradeNote)
            .where(inArray(tradeNote.tradeId, richTradeIds)),
          db
            .select({ tradeId: tradeAnnotation.tradeId })
            .from(tradeAnnotation)
            .where(inArray(tradeAnnotation.tradeId, richTradeIds)),
        ])
      : [[], [], []];

  const existingMediaKeys = new Set(
    existingMediaRows.map(
      (row) => `${row.tradeId}:${Number(row.sortOrder ?? 0)}`
    )
  );
  const existingNoteTradeIds = new Set(
    existingNoteRows
      .map((row) => row.tradeId)
      .filter((tradeId): tradeId is string => Boolean(tradeId))
  );
  const existingAnnotationTradeIds = new Set(
    existingAnnotationRows
      .map((row) => row.tradeId)
      .filter((tradeId): tradeId is string => Boolean(tradeId))
  );

  const missingMediaRows = mediaRows.filter(
    (row) =>
      !existingMediaKeys.has(`${row.tradeId}:${Number(row.sortOrder ?? 0)}`)
  );
  const missingNoteRows = noteRows.filter(
    (row) => !existingNoteTradeIds.has(row.tradeId)
  );
  const missingAnnotationRows = annotationRows.filter(
    (row) => !existingAnnotationTradeIds.has(row.tradeId)
  );

  await Promise.all([
    runOptionalDemoSeedStep("trade media seed", () =>
      missingMediaRows.length > 0
        ? insertRowsInBatches(missingMediaRows, (batch) =>
            db.insert(tradeMedia).values(batch)
          )
        : Promise.resolve()
    ),
    runOptionalDemoSeedStep("trade note seed", () =>
      missingNoteRows.length > 0
        ? insertRowsInBatches(missingNoteRows, (batch) =>
            db.insert(tradeNote).values(batch)
          )
        : Promise.resolve()
    ),
    runOptionalDemoSeedStep("trade annotation seed", () =>
      missingAnnotationRows.length > 0
        ? insertRowsInBatches(missingAnnotationRows, (batch) =>
            db
              .insert(tradeAnnotation)
              .values(batch)
              .onConflictDoNothing({ target: [tradeAnnotation.tradeId] })
          )
        : Promise.resolve()
    ),
  ]);

  await runInBatches(reviewTradeIds, async (tradeId) => {
    await createAutoTradeReviewEntry({ userId, tradeId }).catch((error) => {
      console.error(
        "[hydrateDemoWorkspace] auto trade review seed failed",
        { tradeId, error }
      );
    });
  });

  const reviewTradeEdgeRows =
    reviewTradeIds.length > 0
      ? await db
          .select({
            tradeId: tradeEdgeAssignment.tradeId,
            edgeId: tradeEdgeAssignment.edgeId,
          })
          .from(tradeEdgeAssignment)
          .where(inArray(tradeEdgeAssignment.tradeId, reviewTradeIds))
      : [];

  await runInBatches(reviewTradeEdgeRows, async ({ tradeId, edgeId }) => {
    await db
      .update(journalEntry)
      .set({
        linkedEdgeId: edgeId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(journalEntry.userId, userId),
          sql`${journalEntry.linkedTradeIds} @> ${JSON.stringify([tradeId])}::jsonb`
        )
      );
  });

  await runInBatches(feedTradeIds, async (tradeId) => {
    await generateFeedEventForTrade(tradeId).catch((error) => {
      console.error(
        "[hydrateDemoWorkspace] feed event generation failed",
        error
      );
    });
  });

  const alignedTradeCount = effectiveClosedTrades.filter(
    (row) => row.protocolAlignment === "aligned"
  ).length;
  const totalLosses = effectiveClosedTrades.filter(
    (row) => Number(row.profit || 0) < 0
  ).length;
  const sortedClosedTrades = [...effectiveClosedTrades].sort(
    (a, b) =>
      (a.closeTime instanceof Date ? a.closeTime.getTime() : 0) -
      (b.closeTime instanceof Date ? b.closeTime.getTime() : 0)
  );
  let properBreaks = 0;
  for (let i = 0; i < sortedClosedTrades.length - 1; i++) {
    const currentTrade = sortedClosedTrades[i];
    const nextTrade = sortedClosedTrades[i + 1];
    if (!currentTrade || !nextTrade) continue;
    if (Number(currentTrade.profit || 0) >= 0) continue;
    const nextOpenTime =
      nextTrade.openTime instanceof Date
        ? nextTrade.openTime.getTime()
        : 0;
    const currentCloseTime =
      currentTrade.closeTime instanceof Date
        ? currentTrade.closeTime.getTime()
        : 0;
    const gapMinutes = (nextOpenTime - currentCloseTime) / 60000;
    if (gapMinutes >= 15) properBreaks++;
  }

  const checklistMetricRows =
    checklistTradeIds.length > 0
      ? await db
          .select({ completionRate: tradeChecklistResult.completionRate })
          .from(tradeChecklistResult)
          .where(
            and(
              eq(tradeChecklistResult.accountId, accountId),
              inArray(tradeChecklistResult.tradeId, checklistTradeIds)
            )
          )
      : [];
  const checklistCompletionRate =
    checklistMetricRows.length > 0
      ? checklistMetricRows.reduce(
          (sum, row) => sum + Number(row.completionRate || 0),
          0
        ) / checklistMetricRows.length
      : 0;
  const journalRate =
    effectiveClosedTrades.length > 0
      ? (reviewTradeIds.length / effectiveClosedTrades.length) * 100
      : 0;
  const ruleCompliance =
    effectiveClosedTrades.length > 0
      ? (alignedTradeCount / effectiveClosedTrades.length) * 100
      : 0;
  const breakAfterLoss =
    totalLosses > 0 ? (properBreaks / totalLosses) * 100 : 100;
  const winRate =
    effectiveClosedTrades.length > 0
      ? (effectiveClosedTrades.filter((row) => Number(row.profit || 0) > 0)
          .length /
          effectiveClosedTrades.length) *
        100
      : 0;
  const totalProfit = effectiveClosedTrades.reduce(
    (sum, row) => sum + Number(row.profit || 0),
    0
  );
  const averageRR =
    effectiveClosedTrades.length > 0
      ? effectiveClosedTrades.reduce(
          (sum, row) => sum + Number(row.realisedRR || 0),
          0
        ) / effectiveClosedTrades.length
      : 0;

  const tradeDayKeys = [...closedTradesByDay.keys()].sort();
  const fallbackGoalDay =
    effectiveClosedTrades.at(-1)?.closeTime instanceof Date
      ? formatDay(effectiveClosedTrades.at(-1)!.closeTime as Date)
      : formatDay(previousTradingDay(nowDate));
  await Promise.all([
    runOptionalDemoSeedStep("demo goals and alerts seed", () =>
      seedDemoGoalsAndAlerts({
        userId,
        accountId,
        now,
        tradeDayKeys,
        fallbackGoalDay,
        totalProfit,
        journalRate,
        ruleCompliance,
        checklistCompletionRate,
        breakAfterLoss,
        winRate,
        averageRR,
      })
    ),
    runOptionalDemoSeedStep("demo backtest seed", () =>
      seedDemoBacktestSessions({
        userId,
        now,
        basePrices: {
          EURUSD: basePrices.EURUSD,
          XAUUSD: basePrices.XAUUSD,
        },
        pipSizes: {
          EURUSD: pipSizes.EURUSD,
          XAUUSD: pipSizes.XAUUSD,
        },
        pipValuePerLot: {
          EURUSD: pipValuePerLot.EURUSD,
          XAUUSD: pipValuePerLot.XAUUSD,
        },
      })
    ),
    runOptionalDemoSeedStep("demo digest seed", async () => {
      const {
        bestSession,
        bestSymbol,
        bestModel,
        weakestSymbol,
        weakestSession,
        weakestProtocol,
      } = await seedDemoDigests({
        userId,
        accountId,
        now,
        closedTrades: effectiveClosedTrades,
        totalProfit,
        winRate,
        alignedTradeCount,
        totalLosses,
      });

      await seedDemoAiHistory({
        userId,
        accountId,
        now,
        bestSession,
        bestSymbol,
        bestModel,
        weakestSymbol,
        weakestSession,
        weakestProtocol,
      });
    }),
  ]);

  return {
    account,
    tradeCount: effectiveClosedTrades.length,
    openTradeCount: effectiveLiveOpenTrades.length,
  };
}
