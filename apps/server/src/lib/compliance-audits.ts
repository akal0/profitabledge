export type ComplianceRules = {
  requireSL?: boolean;
  requireTP?: boolean;
  requireSessionTag?: boolean;
  requireModelTag?: boolean;
  maxEntrySpreadPips?: number;
  maxEntrySlippagePips?: number;
  maxExitSlippagePips?: number;
  maxPlannedRiskPips?: number;
  minPlannedRR?: number;
  maxPlannedRR?: number;
  maxDrawdownPct?: number;
  disallowScaleIn?: boolean;
  disallowScaleOut?: boolean;
  disallowPartials?: boolean;
  minHoldSeconds?: number;
  maxHoldSeconds?: number;
};

export type ComplianceResult = {
  status: "pass" | "fail" | "unknown";
  flags: string[];
};

type TradeComplianceInput = {
  sl?: number | null;
  tp?: number | null;
  sessionTag?: string | null;
  modelTag?: string | null;
  entrySpreadPips?: number | null;
  entrySlippagePips?: number | null;
  exitSlippagePips?: number | null;
  plannedRiskPips?: number | null;
  plannedRR?: number | null;
  maePips?: number | null;
  scaleInCount?: number | null;
  scaleOutCount?: number | null;
  partialCloseCount?: number | null;
  holdSeconds?: number | null;
};

export function evaluateCompliance(
  trade: TradeComplianceInput,
  rules: ComplianceRules | null | undefined
): ComplianceResult {
  if (!rules || Object.keys(rules).length === 0) {
    return { status: "unknown", flags: [] };
  }

  const violations: string[] = [];
  const missing: string[] = [];

  const sl = trade.sl != null && trade.sl > 0 ? trade.sl : null;
  const tp = trade.tp != null && trade.tp > 0 ? trade.tp : null;

  if (rules.requireSL && !sl) violations.push("Missing stop loss");
  if (rules.requireTP && !tp) violations.push("Missing take profit");
  if (rules.requireSessionTag && !trade.sessionTag) {
    violations.push("Missing session tag");
  }
  if (rules.requireModelTag && !trade.modelTag) {
    violations.push("Missing model tag");
  }

  if (rules.maxEntrySpreadPips != null) {
    if (trade.entrySpreadPips == null) {
      missing.push("Missing entry spread data");
    } else if (trade.entrySpreadPips > rules.maxEntrySpreadPips) {
      violations.push("Entry spread too high");
    }
  }

  if (rules.maxEntrySlippagePips != null) {
    if (trade.entrySlippagePips == null) {
      missing.push("Missing entry slippage data");
    } else if (trade.entrySlippagePips > rules.maxEntrySlippagePips) {
      violations.push("Entry slippage too high");
    }
  }

  if (rules.maxExitSlippagePips != null) {
    if (trade.exitSlippagePips == null) {
      missing.push("Missing exit slippage data");
    } else if (trade.exitSlippagePips > rules.maxExitSlippagePips) {
      violations.push("Exit slippage too high");
    }
  }

  if (rules.maxPlannedRiskPips != null) {
    if (trade.plannedRiskPips == null) {
      missing.push("Missing planned risk");
    } else if (trade.plannedRiskPips > rules.maxPlannedRiskPips) {
      violations.push("Planned risk too high");
    }
  }

  if (rules.minPlannedRR != null) {
    if (trade.plannedRR == null) {
      missing.push("Missing planned R:R");
    } else if (trade.plannedRR < rules.minPlannedRR) {
      violations.push("Planned R:R too low");
    }
  }

  if (rules.maxPlannedRR != null) {
    if (trade.plannedRR == null) {
      missing.push("Missing planned R:R");
    } else if (trade.plannedRR > rules.maxPlannedRR) {
      violations.push("Planned R:R too high");
    }
  }

  if (rules.maxDrawdownPct != null) {
    if (trade.maePips == null || !trade.plannedRiskPips) {
      missing.push("Missing drawdown inputs");
    } else {
      const ddPct =
        trade.plannedRiskPips > 0
          ? (trade.maePips / trade.plannedRiskPips) * 100
          : null;
      if (ddPct != null && ddPct > rules.maxDrawdownPct) {
        violations.push("Drawdown exceeds limit");
      }
    }
  }

  if (rules.disallowScaleIn) {
    if (trade.scaleInCount == null) {
      missing.push("Missing scale-in data");
    } else if (trade.scaleInCount > 0) {
      violations.push("Scale-in detected");
    }
  }

  if (rules.disallowScaleOut) {
    if (trade.scaleOutCount == null) {
      missing.push("Missing scale-out data");
    } else if (trade.scaleOutCount > 0) {
      violations.push("Scale-out detected");
    }
  }

  if (rules.disallowPartials) {
    if (trade.partialCloseCount == null) {
      missing.push("Missing partial close data");
    } else if (trade.partialCloseCount > 0) {
      violations.push("Partial close detected");
    }
  }

  if (rules.minHoldSeconds != null) {
    if (trade.holdSeconds == null) {
      missing.push("Missing hold time");
    } else if (trade.holdSeconds < rules.minHoldSeconds) {
      violations.push("Hold time below minimum");
    }
  }

  if (rules.maxHoldSeconds != null) {
    if (trade.holdSeconds == null) {
      missing.push("Missing hold time");
    } else if (trade.holdSeconds > rules.maxHoldSeconds) {
      violations.push("Hold time above maximum");
    }
  }

  if (violations.length > 0) {
    return { status: "fail", flags: [...violations, ...missing] };
  }

  if (missing.length > 0) {
    return { status: "unknown", flags: missing };
  }

  return { status: "pass", flags: [] };
}
