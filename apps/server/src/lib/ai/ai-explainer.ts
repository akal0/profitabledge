/**
 * AI-Powered Metric Explainer
 *
 * Generates contextual, personalized explanations for complex trading metrics
 * using Google Gemini AI.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { generateMeteredGeminiContent } from "./gemini";
import { logAIProviderError } from "./provider-errors";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

type AIBillingContext = {
  userId?: string;
  accountId?: string | null;
};

async function generateExplainerContent(input: {
  prompt: string;
  featureKey: string;
  billingContext?: AIBillingContext;
}) {
  if (input.billingContext?.userId) {
    return generateMeteredGeminiContent({
      userId: input.billingContext.userId,
      accountId: input.billingContext.accountId ?? null,
      featureKey: input.featureKey,
      model: "gemini-2.5-flash",
      request: input.prompt,
    });
  }

  return genAI
    .getGenerativeModel({ model: "gemini-2.5-flash" })
    .generateContent(input.prompt);
}

export interface MetricExplanationContext {
  metricName: string;
  value: number | string;
  context?: {
    tradeCount?: number;
    winRate?: number;
    comparison?: string; // e.g., "above average", "below average"
    relatedMetrics?: Record<string, number>;
  };
}

/**
 * Generate AI explanation for a complex metric
 */
export async function explainMetric(
  context: MetricExplanationContext,
  billingContext?: AIBillingContext
): Promise<string> {
  const prompt = `You are a professional trading coach explaining a metric to a trader.

Metric: ${context.metricName}
Value: ${context.value}
${
  context.context?.tradeCount
    ? `Trade Count: ${context.context.tradeCount}`
    : ""
}
${context.context?.winRate ? `Win Rate: ${context.context.winRate}%` : ""}
${
  context.context?.comparison ? `Comparison: ${context.context.comparison}` : ""
}
${
  context.context?.relatedMetrics
    ? `Related Metrics: ${JSON.stringify(context.context.relatedMetrics)}`
    : ""
}

Provide a concise explanation (2-3 sentences) that:
1. Explains what this metric means in simple terms
2. Interprets the value (is it good, bad, or neutral?)
3. Gives one actionable insight or recommendation

Keep it practical and trader-focused. Use markdown formatting for emphasis.`;

  try {
    const result = await generateExplainerContent({
      prompt,
      featureKey: "assistant.explainer.metric",
      billingContext,
    });
    return result.response.text().trim();
  } catch (error) {
    logAIProviderError("Metric explanation", error);
    return "";
  }
}

/**
 * Generate AI insight for performance analysis
 */
export async function generatePerformanceInsight(data: {
  metric: string;
  value: number;
  tradeCount: number;
  winRate: number;
  comparison?: {
    overall?: number;
    benchmark?: number;
  };
}, billingContext?: AIBillingContext): Promise<string> {
  const prompt = `You are analyzing trading performance data. Provide a short, actionable insight.

Metric: ${data.metric}
Value: ${data.value}
Trade Count: ${data.tradeCount}
Win Rate: ${data.winRate}%
${data.comparison?.overall ? `Overall Average: ${data.comparison.overall}` : ""}
${data.comparison?.benchmark ? `Benchmark: ${data.comparison.benchmark}` : ""}

Provide ONE key insight or recommendation (1-2 sentences max). Be direct and actionable.
Use these symbols for clarity:
- ✓ for positive findings
- ⚠ for warnings
- 💡 for tips

Format with markdown bold for emphasis.`;

  try {
    const result = await generateExplainerContent({
      prompt,
      featureKey: "assistant.explainer.performance_insight",
      billingContext,
    });
    return result.response.text().trim();
  } catch (error) {
    logAIProviderError("Performance insight generation", error);
    return "";
  }
}

/**
 * Generate AI analysis comparing two groups
 */
export async function generateComparisonAnalysis(comparison: {
  metric: string;
  group1: { name: string; value: number; count: number };
  group2: { name: string; value: number; count: number };
}, billingContext?: AIBillingContext): Promise<string> {
  const difference = comparison.group1.value - comparison.group2.value;
  const percentDiff = ((difference / comparison.group2.value) * 100).toFixed(1);

  const prompt = `Analyze this trading performance comparison and provide ONE actionable insight.

Metric: ${comparison.metric}

${comparison.group1.name}:
- Value: ${comparison.group1.value}
- Count: ${comparison.group1.count} trades

${comparison.group2.name}:
- Value: ${comparison.group2.value}
- Count: ${comparison.group2.count} trades

Difference: ${difference} (${percentDiff}%)

Provide ONE clear insight (1-2 sentences). Focus on what action the trader should take.
Use ✓ for good findings, ⚠ for warnings. Bold key words.`;

  try {
    const result = await generateExplainerContent({
      prompt,
      featureKey: "assistant.explainer.comparison",
      billingContext,
    });
    return result.response.text().trim();
  } catch (error) {
    logAIProviderError("Comparison analysis generation", error);
    return "";
  }
}

/**
 * Explain a complex metric with definition and context
 */
export async function explainComplexMetric(
  metricName: string,
  userValue?: number,
  tradeCount?: number,
  billingContext?: AIBillingContext
): Promise<string> {
  const metricDefinitions: Record<string, string> = {
    "manipulation pips": `The size of the liquidity grab or stop hunt that preceded your entry. Measured from the manipulation high to manipulation low in pips.`,

    mfe: `Maximum Favorable Excursion - the best price your trade reached while you were in it. Shows peak profit opportunity.`,

    mae: `Maximum Adverse Excursion - the worst drawdown your trade experienced while open. Shows how far against you the trade went.`,

    "realised rr": `Your actual reward-to-risk ratio achieved. Calculated as (Exit - Entry) / (Entry - StopLoss). Measures real outcome vs initial risk.`,

    "planned rr": `Your intended reward-to-risk based on TP/SL placement. Calculated as (TP - Entry) / (Entry - SL).`,

    "max rr": `The best possible R:R that was available while you were in the trade (based on peak price). Shows opportunity vs execution.`,

    "rr capture efficiency": `What percentage of the available R:R you actually captured. Formula: (Realised R:R / Max R:R) × 100. High efficiency = good exits.`,

    "exit efficiency": `How well you timed your exit vs what happened after. Compares your exit price to post-exit peak. 100% = perfect timing.`,

    "manip rr efficiency": `How much of the manipulation leg you captured at exit. Can exceed 100% if you exited beyond the manipulation range.`,

    "mpe manip leg r": `Maximum Price Excursion measured from manipulation reference, in R units. Shows how far price traveled from the setup structure.`,

    "trailing stop": `A stop loss that moves with price to lock in profit. Detected when SL modifications follow price direction.`,
  };

  const definition =
    metricDefinitions[metricName.toLowerCase()] ||
    `${metricName} - An advanced trading performance metric.`;

  if (!userValue || !tradeCount) {
    return `**${metricName}**\n\n${definition}`;
  }

  // Generate AI-powered contextual explanation
  const prompt = `Explain this trading metric to a trader in simple, practical terms.

Metric: ${metricName}
Definition: ${definition}
Trader's Value: ${userValue}
Based on: ${tradeCount} trades

Provide:
1. What this means for THEIR trading (2 sentences max)
2. Is their value good, bad, or neutral? (be specific)
3. ONE actionable tip

Keep it conversational and practical. Use markdown bold for emphasis.`;

  try {
    const result = await generateExplainerContent({
      prompt,
      featureKey: "assistant.explainer.complex_metric",
      billingContext,
    });
    const aiExplanation = result.response.text().trim();

    return `**${metricName}**

${definition}

**Your Performance:**
${aiExplanation}`;
  } catch (error) {
    logAIProviderError("Complex metric explanation", error);
    return `**${metricName}**\n\n${definition}`;
  }
}

/**
 * Generate recommendations based on multiple metrics
 */
export async function generateRecommendations(
  metrics: Array<{ name: string; value: number; target?: number }>,
  billingContext?: AIBillingContext
): Promise<string[]> {
  const metricsText = metrics
    .map(
      (m) =>
        `- ${m.name}: ${m.value}${m.target ? ` (target: ${m.target})` : ""}`
    )
    .join("\n");

  const prompt = `Based on these trading metrics, provide 3 specific, actionable recommendations.

Metrics:
${metricsText}

Requirements:
- Each recommendation must be specific and actionable
- Focus on the biggest opportunities for improvement
- Keep each recommendation to 1 sentence
- Start with action verbs (Review, Focus, Consider, etc.)

Return ONLY the 3 recommendations, one per line, without numbering.`;

  try {
    const result = await generateExplainerContent({
      prompt,
      featureKey: "assistant.explainer.recommendations",
      billingContext,
    });
    const text = result.response.text().trim();

    // Split by newlines and filter empty
    const recommendations = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .slice(0, 3); // Take only first 3

    return recommendations;
  } catch (error) {
    logAIProviderError("Recommendation generation", error);
    return [
      "Review your trading journal regularly for patterns",
      "Focus on improving your risk management",
      "Consider tracking additional metrics for better insights",
    ];
  }
}

/**
 * Generate natural language summary of trading statistics
 */
export async function generateStatsSummary(stats: {
  totalTrades: number;
  winRate: number;
  avgProfit: number;
  avgWin: number;
  avgLoss: number;
  profitFactor?: number;
  expectancy?: number;
}, billingContext?: AIBillingContext): Promise<string> {
  const prompt = `Summarize these trading statistics in 2-3 clear, conversational sentences.

Total Trades: ${stats.totalTrades}
Win Rate: ${stats.winRate}%
Average Profit: $${stats.avgProfit}
Average Win: $${stats.avgWin}
Average Loss: $${stats.avgLoss}
${stats.profitFactor ? `Profit Factor: ${stats.profitFactor}` : ""}
${stats.expectancy ? `Expectancy: ${stats.expectancy}R` : ""}

Provide:
1. Overall assessment (profitable or not?)
2. Key strength
3. Main area to improve

Be honest and direct. Use markdown bold for key numbers.`;

  try {
    const result = await generateExplainerContent({
      prompt,
      featureKey: "assistant.explainer.stats_summary",
      billingContext,
    });
    return result.response.text().trim();
  } catch (error) {
    logAIProviderError("Stats summary generation", error);

    // Fallback to deterministic summary
    const profitable = stats.avgProfit > 0;
    const goodWinRate = stats.winRate >= 50;

    return `You've taken **${
      stats.totalTrades
    } trades** with a **${stats.winRate.toFixed(1)}% win rate**. ${
      profitable
        ? `Your average profit of **$${stats.avgProfit.toFixed(
            2
          )}** shows you're profitable.`
        : `Your average loss of **$${Math.abs(stats.avgProfit).toFixed(
            2
          )}** indicates you need to review your strategy.`
    } ${
      goodWinRate
        ? "Your win rate is solid."
        : "Focus on improving your win rate or increasing your average win size."
    }`;
  }
}
