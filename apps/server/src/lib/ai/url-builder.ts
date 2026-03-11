/**
 * URL Builder for creating properly formatted /trades URLs with NUQS query parameters
 */

export interface TradeFilters {
  // Basic filters
  symbols?: string[];
  sessionTags?: string[];
  modelTags?: string[];
  killzones?: string[];
  protocolAlignment?: string[]; // "aligned", "against", "discretionary"
  outcomes?: string[]; // "Win", "Loss", "BE", "PW"
  tradeType?: "long" | "short"; // Direction
  
  // Range filters
  dateRange?: { start?: string; end?: string }; // YYYY-MM-DD format
  profitRange?: { min?: number; max?: number };
  volumeRange?: { min?: number; max?: number };
  holdRange?: { min?: number; max?: number }; // Duration in minutes
  
  // Other filters
  minRR?: number;
  sortBy?: string; // e.g., "close:desc", "profit:desc"
  searchQuery?: string; // General text search
  limit?: number; // Limit number of results displayed
}

export function buildTradesUrl(accountId: string, filters: TradeFilters): string {
  const params = new URLSearchParams();
  
  // Always include accountId
  params.set('accountId', accountId);
  
  // Symbols filter
  if (filters.symbols && filters.symbols.length > 0) {
    params.set('symbols', filters.symbols.join(','));
  }
  
  // Session tags filter
  if (filters.sessionTags && filters.sessionTags.length > 0) {
    params.set('sessionTags', filters.sessionTags.join(','));
  }
  
  // Model tags filter
  if (filters.modelTags && filters.modelTags.length > 0) {
    params.set('modelTags', filters.modelTags.join(','));
  }
  
  // Killzones filter
  if (filters.killzones && filters.killzones.length > 0) {
    params.set('killzones', filters.killzones.join(','));
  }
  
  // Protocol alignment filter
  if (filters.protocolAlignment && filters.protocolAlignment.length > 0) {
    params.set('protocol', filters.protocolAlignment.join(','));
  }
  
  // Outcomes filter (Win, Loss, BE, PW)
  if (filters.outcomes && filters.outcomes.length > 0) {
    params.set('outcome', filters.outcomes.join(','));
  }
  
  // Direction filter (long/short)
  if (filters.tradeType) {
    params.set('dir', filters.tradeType);
  }
  
  // Date range filter
  if (filters.dateRange) {
    if (filters.dateRange.start) {
      params.set('oStart', filters.dateRange.start);
    }
    if (filters.dateRange.end) {
      params.set('oEnd', filters.dateRange.end);
    }
  }
  
  // Profit/Loss range filter
  if (filters.profitRange) {
    const min = filters.profitRange.min ?? '';
    const max = filters.profitRange.max ?? '';
    if (min !== '' || max !== '') {
      // Use hyphen format for ranges: min-max
      // For open-ended ranges: 0.01- for wins, --0.01 for losses
      if (max === '') {
        params.set('pl', `${min}-999999`); // Open upper bound
      } else if (min === '') {
        params.set('pl', `-999999-${max}`); // Open lower bound
      } else {
        params.set('pl', `${min}-${max}`);
      }
    }
  }
  
  // Volume range filter
  if (filters.volumeRange) {
    if (filters.volumeRange.min !== undefined) {
      params.set('vol', `${filters.volumeRange.min},${filters.volumeRange.max ?? ''}`);
    }
  }
  
  // Hold time range filter (duration)
  if (filters.holdRange) {
    if (filters.holdRange.min !== undefined) {
      params.set('hold', `${filters.holdRange.min},${filters.holdRange.max ?? ''}`);
    }
  }
  
  // Search query
  if (filters.searchQuery) {
    params.set('q', filters.searchQuery);
  }
  
  // Sort
  if (filters.sortBy) {
    params.set('sort', filters.sortBy);
  }
  
  return `/dashboard/trades?${params.toString()}`;
}

/**
 * Helper to build URL for specific trade scenarios
 */
export const TradeUrlBuilders = {
  // All winning trades (use profit filter instead of outcome)
  winningTrades: (accountId: string, symbol?: string) => 
    buildTradesUrl(accountId, {
      profitRange: { min: 0.01 }, // Greater than 0
      symbols: symbol ? [symbol] : undefined,
      sortBy: 'close:desc',
    }),
  
  // All losing trades (use profit filter instead of outcome)
  losingTrades: (accountId: string, symbol?: string) =>
    buildTradesUrl(accountId, {
      profitRange: { max: -0.01 }, // Less than 0
      symbols: symbol ? [symbol] : undefined,
      sortBy: 'close:desc',
    }),
  
  // Breakeven trades
  breakevenTrades: (accountId: string) =>
    buildTradesUrl(accountId, {
      outcomes: ['BE'],
    }),
  
  // Trades by symbol
  symbolTrades: (accountId: string, symbol: string) =>
    buildTradesUrl(accountId, {
      symbols: [symbol],
      sortBy: 'close:desc',
    }),
  
  // Trades by session
  sessionTrades: (accountId: string, sessionTag: string) =>
    buildTradesUrl(accountId, {
      sessionTags: [sessionTag],
      sortBy: 'close:desc',
    }),
  
  // Trades by model
  modelTrades: (accountId: string, modelTag: string) =>
    buildTradesUrl(accountId, {
      modelTags: [modelTag],
      sortBy: 'close:desc',
    }),
  
  // Protocol-aligned trades
  alignedTrades: (accountId: string) =>
    buildTradesUrl(accountId, {
      protocolAlignment: ['aligned'],
      sortBy: 'close:desc',
    }),
  
  // Discretionary trades
  discretionaryTrades: (accountId: string) =>
    buildTradesUrl(accountId, {
      protocolAlignment: ['discretionary'],
      sortBy: 'close:desc',
    }),
  
  // Long trades
  longTrades: (accountId: string) =>
    buildTradesUrl(accountId, {
      tradeType: 'long',
      sortBy: 'close:desc',
    }),
  
  // Short trades
  shortTrades: (accountId: string) =>
    buildTradesUrl(accountId, {
      tradeType: 'short',
      sortBy: 'close:desc',
    }),
  
  // This week's trades
  thisWeek: (accountId: string) => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);
    
    return buildTradesUrl(accountId, {
      dateRange: {
        start: startOfWeek.toISOString().split('T')[0],
        end: now.toISOString().split('T')[0],
      },
      sortBy: 'close:desc',
    });
  },
  
  // This month's trades
  thisMonth: (accountId: string) => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    return buildTradesUrl(accountId, {
      dateRange: {
        start: startOfMonth.toISOString().split('T')[0],
        end: now.toISOString().split('T')[0],
      },
      sortBy: 'close:desc',
    });
  },
  
  // Today's trades
  today: (accountId: string) => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    return buildTradesUrl(accountId, {
      dateRange: {
        start: today,
        end: today,
      },
      sortBy: 'close:desc',
    });
  },
  
  // Profitable trades above certain amount
  profitableAbove: (accountId: string, minProfit: number) =>
    buildTradesUrl(accountId, {
      profitRange: { min: minProfit },
      sortBy: 'profit:desc',
    }),
  
  // Big winners (top profitable trades)
  bigWinners: (accountId: string) =>
    buildTradesUrl(accountId, {
      outcomes: ['Win'],
      sortBy: 'profit:desc',
    }),
  
  // Big losers (worst losing trades)
  bigLosers: (accountId: string) =>
    buildTradesUrl(accountId, {
      outcomes: ['Loss'],
      sortBy: 'profit:asc',
    }),
};
