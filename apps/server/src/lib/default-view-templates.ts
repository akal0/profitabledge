/**
 * Default View Templates
 *
 * Each view answers ONE question. No view tries to answer everything.
 * Views educate by contrast, not instruction.
 *
 * Philosophy:
 * - The same column may appear in multiple views for different reasons
 * - Advanced columns only appear when relevant
 * - Views change the question, not the data
 * - No view recalculates metrics
 * - No view mutates trades
 */

import type { TradeViewConfig } from '../types/trade-view';

interface ViewTemplate {
  name: string;
  description: string;
  icon: string;
  config: TradeViewConfig;
  sortOrder: number;
  isDefault: boolean;
}

export const DEFAULT_VIEW_TEMPLATES: ViewTemplate[] = [
  // ============================================================================
  // 1. OUTCOME-FOCUSED VIEW
  // Question: "Am I winning or losing overall?"
  // ============================================================================
  {
    name: 'Outcome-focused',
    description: 'High-level results without analysis.',
    icon: '📊',
    sortOrder: 1,
    isDefault: true,
    config: {
      filters: {},
      visibleColumns: [
        'select',
        'symbol',
        'tradeDirection',
        'open',
        'close',
        'profit',
        'holdSeconds',
        'sessionTag',
        'outcome',
        'realisedRR',
      ],
      sorting: [{ columnId: 'open', direction: 'desc' }],
    },
  },

  // ============================================================================
  // 2. EXECUTION-FOCUSED VIEW
  // Question: "Did I manage my trades well once I was in them?"
  // ============================================================================
  {
    name: 'Execution-focused',
    description: 'Trade management quality, not strategy quality.',
    icon: '🎯',
    sortOrder: 2,
    isDefault: false,
    config: {
      filters: {},
      visibleColumns: [
        'select',
        'symbol',
        'tradeDirection',
        'open',
        'close',
        'profit',
        'holdSeconds',
        'plannedRR',
        'realisedRR',
        'maxRR',
        'rrCaptureEfficiency',
        'exitEfficiency',
      ],
      sorting: [{ columnId: 'rrCaptureEfficiency', direction: 'asc' }],
    },
  },

  // ============================================================================
  // 3. STRATEGY / MODEL VIEW
  // Question: "Does this setup or model actually work?"
  // ============================================================================
  {
    name: 'Strategy / model',
    description: 'Evaluate idea quality, not execution.',
    icon: '🧪',
    sortOrder: 3,
    isDefault: false,
    config: {
      filters: {},
      visibleColumns: [
        'select',
        'symbol',
        'modelTag',
        'tradeDirection',
        'open',
        'close',
        'profit',
        'holdSeconds',
        'sessionTag',
        'outcome',
        'realisedRR',
        'maxRR',
        'mpeManipLegR',
      ],
      sorting: [
        { columnId: 'modelTag', direction: 'asc' },
        { columnId: 'outcome', direction: 'asc' },
      ],
    },
  },

  // ============================================================================
  // 4. DISCIPLINE / PROTOCOL VIEW
  // Question: "Are losses coming from bad strategy or rule-breaking?"
  // ============================================================================
  {
    name: 'Discipline / protocol',
    description: 'Separate system failure from rule-breaking.',
    icon: '⚖️',
    sortOrder: 4,
    isDefault: false,
    config: {
      filters: {},
      visibleColumns: [
        'select',
        'symbol',
        'tradeDirection',
        'open',
        'close',
        'profit',
        'holdSeconds',
        'protocolAlignment',
        'modelTag',
        'sessionTag',
        'outcome',
        'realisedRR',
        'maxRR',
        'rrCaptureEfficiency',
      ],
      sorting: [
        { columnId: 'protocolAlignment', direction: 'asc' },
        { columnId: 'outcome', direction: 'asc' },
      ],
    },
  },

  // ============================================================================
  // 5. MINIMAL "DAILY REVIEW" VIEW
  // Question: "Did today make sense?"
  // ============================================================================
  {
    name: 'Minimal daily review',
    description: 'Quick review without analysis paralysis.',
    icon: '📅',
    sortOrder: 5,
    isDefault: false,
    config: {
      filters: {},
      visibleColumns: [
        'select',
        'symbol',
        'tradeDirection',
        'open',
        'close',
        'profit',
        'holdSeconds',
        'outcome',
        'realisedRR',
        'sessionTag',
      ],
      sorting: [{ columnId: 'open', direction: 'desc' }],
    },
  },

  // ============================================================================
  // 6. ENTRY-QUALITY (STRUCTURE) VIEW
  // Question: "Am I entering where I say I am?"
  // ============================================================================
  {
    name: 'Entry quality',
    description: 'Entry precision relative to structure.',
    icon: '🧭',
    sortOrder: 6,
    isDefault: false,
    config: {
      filters: {},
      visibleColumns: [
        'select',
        'symbol',
        'tradeDirection',
        'open',
        'close',
        'profit',
        'holdSeconds',
        'modelTag',
        'sessionTag',
        'manipulationPips',
        'mpeManipLegR',
        'manipRREfficiency',
        'outcome',
      ],
      sorting: [{ columnId: 'manipRREfficiency', direction: 'desc' }],
    },
  },

  // ============================================================================
  // 7. VOLATILITY / ENVIRONMENT VIEW
  // Question: "Under what market conditions do I perform best?"
  // ============================================================================
  {
    name: 'Volatility / environment',
    description: 'Performance across volatility regimes.',
    icon: '🌡️',
    sortOrder: 7,
    isDefault: false,
    config: {
      filters: {},
      visibleColumns: [
        'select',
        'symbol',
        'tradeDirection',
        'open',
        'close',
        'profit',
        'holdSeconds',
        'sessionTag',
        'stdvBucket',
        'rawSTDV',
        'outcome',
        'realisedRR',
      ],
      sorting: [
        { columnId: 'stdvBucket', direction: 'desc' },
        { columnId: 'realisedRR', direction: 'desc' },
      ],
    },
  },

  // ============================================================================
  // 8. ADVANCED / STATISTICAL ALIGNMENT VIEW
  // Question: "What does my data say I should realistically be targeting?"
  // ============================================================================
  {
    name: 'Advanced alignment',
    description: 'Statistical alignment for target sizing.',
    icon: '🧪',
    sortOrder: 8,
    isDefault: false,
    config: {
      filters: {},
      visibleColumns: [
        'select',
        'symbol',
        'tradeDirection',
        'open',
        'close',
        'profit',
        'holdSeconds',
        'mpeManipLegR',
        'mpeManipPE_R',
        'estimatedWeightedMPE_R',
        'realisedRR',
        'maxRR',
        'rrCaptureEfficiency',
      ],
      sorting: [{ columnId: 'estimatedWeightedMPE_R', direction: 'desc' }],
    },
  },
];

/**
 * Get a default view template by name
 */
export function getDefaultViewTemplate(name: string): ViewTemplate | undefined {
  return DEFAULT_VIEW_TEMPLATES.find((t) => t.name === name);
}

/**
 * Get all default view templates sorted by sortOrder
 */
export function getAllDefaultViewTemplates(): ViewTemplate[] {
  return [...DEFAULT_VIEW_TEMPLATES].sort((a, b) => a.sortOrder - b.sortOrder);
}
