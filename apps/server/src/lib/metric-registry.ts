/**
 * Metric Registry
 *
 * Central definition of all trade metrics with categorization and sample gating.
 * This registry defines:
 * - What metrics exist
 * - How they're categorized (Intent, Execution, Opportunity, Efficiency)
 * - When they should be shown (sample gate tiers)
 * - How they should be formatted and explained
 *
 * Philosophy: Metrics quantify what happened, not what the user thinks happened.
 * All metrics are deterministic and recomputable.
 */

import {
  type MetricDefinition,
  METRIC_CATEGORY,
  SAMPLE_GATE_TIERS,
} from '../types/trade-view';

export const METRIC_REGISTRY: Record<string, MetricDefinition> = {
  // ============================================================================
  // INTENT METRICS - What the user planned
  // ============================================================================

  plannedRR: {
    id: 'plannedRR',
    name: 'Planned R:R',
    category: METRIC_CATEGORY.INTENT,
    sampleGate: SAMPLE_GATE_TIERS.BASIC,
    tooltip: 'Initial risk-to-reward ratio based on TP/SL placement at entry',
    format: 'ratio',
    unit: 'R',
  },

  plannedRiskPips: {
    id: 'plannedRiskPips',
    name: 'Planned Risk',
    category: METRIC_CATEGORY.INTENT,
    sampleGate: SAMPLE_GATE_TIERS.BASIC,
    tooltip: 'Distance from entry to stop loss in pips',
    format: 'pips',
    unit: 'pips',
  },

  plannedTargetPips: {
    id: 'plannedTargetPips',
    name: 'Planned Target',
    category: METRIC_CATEGORY.INTENT,
    sampleGate: SAMPLE_GATE_TIERS.BASIC,
    tooltip: 'Distance from entry to take profit in pips',
    format: 'pips',
    unit: 'pips',
  },

  // ============================================================================
  // EXECUTION METRICS - What the user did
  // ============================================================================

  realisedRR: {
    id: 'realisedRR',
    name: 'Realized R:R',
    category: METRIC_CATEGORY.EXECUTION,
    sampleGate: SAMPLE_GATE_TIERS.BASIC,
    tooltip: 'Actual R achieved after fees and commissions',
    format: 'ratio',
    unit: 'R',
  },

  profit: {
    id: 'profit',
    name: 'Net P/L',
    category: METRIC_CATEGORY.EXECUTION,
    sampleGate: SAMPLE_GATE_TIERS.BASIC,
    tooltip: 'Total profit/loss including commissions and swap',
    format: 'currency',
    unit: '$',
  },

  holdTime: {
    id: 'holdTime',
    name: 'Hold Time',
    category: METRIC_CATEGORY.EXECUTION,
    sampleGate: SAMPLE_GATE_TIERS.BASIC,
    tooltip: 'Duration the trade was held from open to close',
    format: 'duration',
  },

  outcome: {
    id: 'outcome',
    name: 'Outcome',
    category: METRIC_CATEGORY.EXECUTION,
    sampleGate: SAMPLE_GATE_TIERS.BASIC,
    tooltip: 'Trade result: Win, Loss, Break-Even (BE), or Partial Win (PW)',
    format: 'number', // Special formatting in UI
  },

  // ============================================================================
  // OPPORTUNITY METRICS - What the market offered
  // ============================================================================

  maxRR: {
    id: 'maxRR',
    name: 'Max R:R',
    category: METRIC_CATEGORY.OPPORTUNITY,
    sampleGate: SAMPLE_GATE_TIERS.INTERMEDIATE,
    tooltip:
      'Best R:R offered by the market during the trade (before exit). Requires ~30 trades for statistical context.',
    format: 'ratio',
    unit: 'R',
  },

  manipulationPips: {
    id: 'manipulationPips',
    name: 'Manipulation Size',
    category: METRIC_CATEGORY.OPPORTUNITY,
    sampleGate: SAMPLE_GATE_TIERS.INTERMEDIATE,
    tooltip:
      'Size of the manipulation leg in pips (structural displacement before reversal)',
    format: 'pips',
    unit: 'pips',
  },

  mpeManipLegR: {
    id: 'mpeManipLegR',
    name: 'MPE Manip Leg',
    category: METRIC_CATEGORY.OPPORTUNITY,
    sampleGate: SAMPLE_GATE_TIERS.INTERMEDIATE,
    tooltip:
      'Max Price Exertion from manipulation reference during trade, normalized by SL (R units)',
    format: 'ratio',
    unit: 'R',
  },

  mpeManipPE: {
    id: 'mpeManipPE',
    name: 'MPE Manip PE',
    category: METRIC_CATEGORY.OPPORTUNITY,
    sampleGate: SAMPLE_GATE_TIERS.INTERMEDIATE,
    tooltip:
      'Post-exit max price movement from manipulation reference (what you left on the table)',
    format: 'ratio',
    unit: 'R',
  },

  rawStdv: {
    id: 'rawStdv',
    name: 'Raw STDV',
    category: METRIC_CATEGORY.OPPORTUNITY,
    sampleGate: SAMPLE_GATE_TIERS.INTERMEDIATE,
    tooltip:
      'Raw volatility expression during trade (equivalent to MPE Manip Leg R)',
    format: 'ratio',
    unit: 'R',
  },

  rawStdvPE: {
    id: 'rawStdvPE',
    name: 'Raw STDV PE',
    category: METRIC_CATEGORY.OPPORTUNITY,
    sampleGate: SAMPLE_GATE_TIERS.INTERMEDIATE,
    tooltip: 'Post-exit volatility excursion (how much volatility emerged after exit)',
    format: 'ratio',
    unit: 'R',
  },

  stdvBucket: {
    id: 'stdvBucket',
    name: 'STDV Bucket',
    category: METRIC_CATEGORY.OPPORTUNITY,
    sampleGate: SAMPLE_GATE_TIERS.ADVANCED,
    tooltip:
      'Categorical volatility regime (-2, -1, 0, +1, +2 STDV). Requires ~100 trades for reliable bucketing.',
    format: 'number', // Special formatting in UI
  },

  estimatedWeightedMpe: {
    id: 'estimatedWeightedMpe',
    name: 'Est. Weighted MPE',
    category: METRIC_CATEGORY.OPPORTUNITY,
    sampleGate: SAMPLE_GATE_TIERS.ADVANCED,
    tooltip:
      'Adaptive TP recommendation based on historical volatility and capture patterns. Becomes statistically reliable after ~100 trades.',
    format: 'ratio',
    unit: 'R',
  },

  // ============================================================================
  // EFFICIENCY METRICS - How well opportunity was used
  // ============================================================================

  rrCaptureEfficiency: {
    id: 'rrCaptureEfficiency',
    name: 'Capture Efficiency',
    category: METRIC_CATEGORY.EFFICIENCY,
    sampleGate: SAMPLE_GATE_TIERS.INTERMEDIATE,
    tooltip:
      'Percentage of max R:R captured (0-100%). Shows how much of the available opportunity you took.',
    format: 'percentage',
    unit: '%',
  },

  manipRREfficiency: {
    id: 'manipRREfficiency',
    name: 'Entry Efficiency',
    category: METRIC_CATEGORY.EFFICIENCY,
    sampleGate: SAMPLE_GATE_TIERS.INTERMEDIATE,
    tooltip:
      'Capture rate vs manipulation move (can exceed 100% if price exceeded manipulation zone)',
    format: 'percentage',
    unit: '%',
  },

  exitEfficiency: {
    id: 'exitEfficiency',
    name: 'Exit Efficiency',
    category: METRIC_CATEGORY.EFFICIENCY,
    sampleGate: SAMPLE_GATE_TIERS.INTERMEDIATE,
    tooltip:
      'Timing quality vs post-exit peak (100% = exited at perfect time, <100% = left opportunity on table)',
    format: 'percentage',
    unit: '%',
  },
};

/**
 * Get all metrics for a specific category
 */
export function getMetricsByCategory(
  category: (typeof METRIC_CATEGORY)[keyof typeof METRIC_CATEGORY]
): MetricDefinition[] {
  return Object.values(METRIC_REGISTRY).filter((m) => m.category === category);
}

/**
 * Get all metrics for a specific sample gate tier (or lower)
 */
export function getMetricsByMaxTier(
  tier: (typeof SAMPLE_GATE_TIERS)[keyof typeof SAMPLE_GATE_TIERS]
): MetricDefinition[] {
  const tierOrder = [
    SAMPLE_GATE_TIERS.BASIC,
    SAMPLE_GATE_TIERS.INTERMEDIATE,
    SAMPLE_GATE_TIERS.ADVANCED,
    SAMPLE_GATE_TIERS.STATISTICAL,
  ];

  const maxIndex = tierOrder.indexOf(tier);

  return Object.values(METRIC_REGISTRY).filter(
    (m) => tierOrder.indexOf(m.sampleGate) <= maxIndex
  );
}

/**
 * Get metric definition by ID
 */
export function getMetricById(id: string): MetricDefinition | undefined {
  return METRIC_REGISTRY[id];
}

/**
 * Check if a metric should be shown based on sample size
 */
export function isMetricUnlocked(
  metricId: string,
  currentSampleSize: number,
  userPreferences?: {
    disableAllGates?: boolean;
    minimumSamples?: Record<string, number>;
  }
): boolean {
  const metric = METRIC_REGISTRY[metricId];
  if (!metric) return false;

  // User has disabled all gates
  if (userPreferences?.disableAllGates) return true;

  // Get required sample size for this tier
  const requiredSamples =
    userPreferences?.minimumSamples?.[metric.sampleGate] ??
    {
      basic: 0,
      intermediate: 30,
      advanced: 100,
      statistical: 200,
    }[metric.sampleGate];

  return currentSampleSize >= requiredSamples;
}

/**
 * Get sample gate status for all tiers
 */
export function getSampleGateStatus(
  currentSampleSize: number,
  userPreferences?: {
    disableAllGates?: boolean;
    minimumSamples?: Record<string, number>;
  }
) {
  const tiers = [
    SAMPLE_GATE_TIERS.BASIC,
    SAMPLE_GATE_TIERS.INTERMEDIATE,
    SAMPLE_GATE_TIERS.ADVANCED,
    SAMPLE_GATE_TIERS.STATISTICAL,
  ];

  return tiers.map((tier) => {
    const requiredSamples =
      userPreferences?.minimumSamples?.[tier] ??
      {
        basic: 0,
        intermediate: 30,
        advanced: 100,
        statistical: 200,
      }[tier];

    const isUnlocked =
      userPreferences?.disableAllGates || currentSampleSize >= requiredSamples;
    const remaining = Math.max(0, requiredSamples - currentSampleSize);

    return {
      tier,
      required: requiredSamples,
      current: currentSampleSize,
      isUnlocked,
      message: isUnlocked
        ? `${tier.charAt(0).toUpperCase() + tier.slice(1)} metrics unlocked`
        : `${remaining} more trade${remaining === 1 ? '' : 's'} needed to unlock ${tier} metrics`,
    };
  });
}
