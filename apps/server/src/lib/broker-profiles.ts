/**
 * Broker Spread Profiles
 *
 * This file contains average spread data for popular brokers to improve
 * drawdown calculation accuracy when using public market data (Dukascopy, etc.)
 *
 * Spreads are in pips and represent typical trading conditions.
 * Source: Industry averages and broker specifications as of 2025
 */

export interface BrokerProfile {
  name: string;
  displayName: string;
  type: 'mt4' | 'mt5' | 'ctrader' | 'proprietary';
  averageSpreads: Record<string, number>; // symbol -> pips
  spreadAdjustment: number; // Global multiplier (e.g., 1.2 = 20% wider spreads)
  timezone: string; // Broker server timezone
  dataSourceRecommendation: 'dukascopy' | 'alphavantage' | 'truefx';
}

/**
 * Common forex pairs and their typical spread ranges
 */
const STANDARD_SPREADS = {
  // Majors
  EURUSD: 0.8,
  GBPUSD: 1.2,
  USDJPY: 0.9,
  USDCHF: 1.1,
  AUDUSD: 1.0,
  USDCAD: 1.3,
  NZDUSD: 1.5,

  // Crosses
  EURJPY: 1.5,
  GBPJPY: 2.0,
  EURGBP: 1.3,
  AUDNZD: 2.5,

  // Exotics
  USDTRY: 15.0,
  USDZAR: 20.0,
  USDMXN: 35.0,
};

/**
 * Broker-specific profiles
 */
export const BROKER_PROFILES: Record<string, BrokerProfile> = {
  // FTMO (Prop firm using various brokers, typically tight spreads)
  ftmo: {
    name: 'ftmo',
    displayName: 'FTMO',
    type: 'mt5',
    averageSpreads: {
      EURUSD: 0.5,
      GBPUSD: 0.8,
      USDJPY: 0.6,
      USDCHF: 0.7,
      AUDUSD: 0.7,
      USDCAD: 0.9,
      NZDUSD: 1.0,
      EURJPY: 1.0,
      GBPJPY: 1.5,
      EURGBP: 0.9,
      XAUUSD: 20.0, // Gold
      US30: 2.0,    // Dow Jones
      NAS100: 2.0,  // Nasdaq
    },
    spreadAdjustment: 0.8, // FTMO typically has tighter spreads
    timezone: 'GMT+2',
    dataSourceRecommendation: 'dukascopy',
  },

  // IC Markets (Popular ECN broker)
  icmarkets: {
    name: 'icmarkets',
    displayName: 'IC Markets',
    type: 'mt5',
    averageSpreads: {
      EURUSD: 0.6,
      GBPUSD: 0.9,
      USDJPY: 0.7,
      USDCHF: 0.8,
      AUDUSD: 0.8,
      USDCAD: 1.0,
      NZDUSD: 1.1,
      XAUUSD: 12.0,
    },
    spreadAdjustment: 0.85,
    timezone: 'GMT+2',
    dataSourceRecommendation: 'dukascopy',
  },

  // OANDA (Retail broker, wider spreads)
  oanda: {
    name: 'oanda',
    displayName: 'OANDA',
    type: 'proprietary',
    averageSpreads: {
      EURUSD: 1.2,
      GBPUSD: 1.8,
      USDJPY: 1.3,
      USDCHF: 1.6,
      AUDUSD: 1.5,
      USDCAD: 1.7,
      NZDUSD: 2.0,
    },
    spreadAdjustment: 1.3, // OANDA has wider retail spreads
    timezone: 'GMT-5',
    dataSourceRecommendation: 'dukascopy',
  },

  // Pepperstone (Low spread ECN)
  pepperstone: {
    name: 'pepperstone',
    displayName: 'Pepperstone',
    type: 'mt5',
    averageSpreads: {
      EURUSD: 0.7,
      GBPUSD: 1.0,
      USDJPY: 0.8,
      USDCHF: 0.9,
      AUDUSD: 0.9,
      USDCAD: 1.1,
      XAUUSD: 15.0,
    },
    spreadAdjustment: 0.9,
    timezone: 'GMT+2',
    dataSourceRecommendation: 'dukascopy',
  },

  // XM (Retail broker, moderate spreads)
  xm: {
    name: 'xm',
    displayName: 'XM',
    type: 'mt4',
    averageSpreads: {
      EURUSD: 1.6,
      GBPUSD: 2.2,
      USDJPY: 1.6,
      USDCHF: 2.0,
      AUDUSD: 1.8,
      USDCAD: 2.1,
    },
    spreadAdjustment: 1.5,
    timezone: 'GMT+2',
    dataSourceRecommendation: 'dukascopy',
  },

  // Default/Unknown broker (conservative estimates)
  default: {
    name: 'default',
    displayName: 'Other',
    type: 'mt5',
    averageSpreads: STANDARD_SPREADS,
    spreadAdjustment: 1.0,
    timezone: 'GMT+2',
    dataSourceRecommendation: 'dukascopy',
  },
};

/**
 * Get broker profile by name (case-insensitive)
 */
export function getBrokerProfile(brokerName: string | null | undefined): BrokerProfile {
  if (!brokerName) return BROKER_PROFILES.default;

  const normalized = brokerName.toLowerCase().trim();

  // Direct match
  if (BROKER_PROFILES[normalized]) {
    return BROKER_PROFILES[normalized];
  }

  // Fuzzy match (e.g., "FTMO Challenge" -> "ftmo")
  for (const [key, profile] of Object.entries(BROKER_PROFILES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return profile;
    }
  }

  return BROKER_PROFILES.default;
}

/**
 * Get expected spread for a symbol from a broker profile
 */
export function getExpectedSpread(
  broker: BrokerProfile,
  symbol: string,
  userReportedSpread?: number | null
): number {
  // If user provided their own spread data, use it (highest priority)
  if (userReportedSpread != null && userReportedSpread > 0) {
    return userReportedSpread;
  }

  const normalizedSymbol = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');

  // Check broker-specific spreads
  if (broker.averageSpreads[normalizedSymbol]) {
    return broker.averageSpreads[normalizedSymbol];
  }

  // Check standard spreads
  if (STANDARD_SPREADS[normalizedSymbol]) {
    return STANDARD_SPREADS[normalizedSymbol] * broker.spreadAdjustment;
  }

  // Fallback: assume 2 pips for unknown pairs
  return 2.0 * broker.spreadAdjustment;
}

/**
 * Calculate confidence score for drawdown calculation
 * Returns a percentage (0-100) indicating how confident we are in the accuracy
 */
export function calculateConfidenceScore(
  dataSource: 'dukascopy' | 'alphavantage' | 'truefx' | 'broker',
  broker: BrokerProfile,
  symbol: string,
  hasUserSpreadData: boolean
): number {
  let confidence = 0;

  // Base confidence from data source
  switch (dataSource) {
    case 'broker':
      confidence = 100; // Perfect accuracy
      break;
    case 'dukascopy':
      confidence = 75; // Good aggregated data
      break;
    case 'alphavantage':
      confidence = 70;
      break;
    case 'truefx':
      confidence = 80; // Dense tick data
      break;
    default:
      confidence = 60;
  }

  // If we're using broker data, return 100% immediately
  if (dataSource === 'broker') {
    return 100;
  }

  // Adjust based on broker match with data source recommendation
  if (broker.dataSourceRecommendation === dataSource) {
    confidence += 5;
  } else {
    confidence -= 5;
  }

  // Bonus if user provided spread calibration
  if (hasUserSpreadData) {
    confidence += 10;
  }

  // Penalty for exotic pairs (harder to match)
  const normalizedSymbol = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const isExotic = !Object.keys(STANDARD_SPREADS).includes(normalizedSymbol);
  if (isExotic) {
    confidence -= 15;
  }

  // Clamp to 0-100
  return Math.max(0, Math.min(100, confidence));
}

/**
 * Adjust Dukascopy price to account for broker spread differences
 * This improves accuracy when comparing public data to broker-specific execution
 */
export function adjustPriceForBrokerSpread(
  price: number,
  direction: 'long' | 'short',
  publicSpread: number, // Dukascopy spread
  brokerSpread: number  // Expected broker spread
): number {
  const spreadDiff = brokerSpread - publicSpread;

  if (Math.abs(spreadDiff) < 0.1) {
    return price; // Negligible difference
  }

  // For longs: broker spread wider means entry was higher, SL further
  // For shorts: broker spread wider means entry was lower, SL further
  const adjustment = spreadDiff / 2; // Split the difference

  return direction === 'long' ? price + adjustment : price - adjustment;
}
