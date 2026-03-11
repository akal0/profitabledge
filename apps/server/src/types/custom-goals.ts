// Custom goal filter types
export type FilterType =
  | "session"      // Trading session (e.g., "asia", "london", "newyork")
  | "model"        // Model tag (e.g., "ICT", "SMC")
  | "symbol"       // Trading pair (e.g., "EURUSD", "GBPUSD")
  | "day"          // Day of week (e.g., "monday", "friday")
  | "direction"    // Trade direction ("long" | "short")
  | "rr"           // Risk/reward range
  | "duration"     // Trade duration range
  | "timeRange";   // Specific time range

export type ComparatorType =
  | "gt"           // Greater than
  | "gte"          // Greater than or equal
  | "lt"           // Less than
  | "lte"          // Less than or equal
  | "eq"           // Equal to
  | "increase"     // Increase from baseline
  | "decrease";    // Decrease from baseline

export type MetricType =
  | "winRate"
  | "profit"
  | "avgRR"
  | "consistency"
  | "tradeCount"
  | "profitFactor"
  | "avgProfit"
  | "avgLoss";

export interface GoalFilter {
  type: FilterType;
  value: string | number | string[];
  operator?: "is" | "isNot" | "in" | "notIn" | "between";
  range?: [number, number]; // For "between" operator
}

export interface CustomGoalCriteria {
  filters: GoalFilter[];
  metric: MetricType;
  comparator: ComparatorType;
  baselineValue?: number; // For "increase" or "decrease" comparator
  targetValue: number;
  description?: string; // Auto-generated human-readable description
}

// Example custom criteria objects:
// 1. "Improve Asia session win rate to 70%"
// {
//   filters: [{ type: "session", value: "asia", operator: "is" }],
//   metric: "winRate",
//   comparator: "gte",
//   targetValue: 70,
//   description: "Achieve 70% win rate in Asia session"
// }

// 2. "Improve ICT model's win rate in London session"
// {
//   filters: [
//     { type: "model", value: "ICT", operator: "is" },
//     { type: "session", value: "london", operator: "is" }
//   ],
//   metric: "winRate",
//   comparator: "increase",
//   baselineValue: 55,
//   targetValue: 65,
//   description: "Increase ICT model win rate in London session from 55% to 65%"
// }

// 3. "Reduce EURUSD losses on Mondays"
// {
//   filters: [
//     { type: "symbol", value: "EURUSD", operator: "is" },
//     { type: "day", value: "monday", operator: "is" }
//   ],
//   metric: "avgLoss",
//   comparator: "decrease",
//   baselineValue: -50,
//   targetValue: -30,
//   description: "Reduce average loss on EURUSD Mondays from $50 to $30"
// }
