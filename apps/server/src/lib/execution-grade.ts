export type ExecutionGrade = "A" | "B" | "C" | "D" | "F" | "N/A";

type ExecutionGradeInput = {
  avgEntrySpread?: number | null;
  avgExitSpread?: number | null;
  avgEntrySlippage?: number | null;
  avgExitSlippage?: number | null;
  avgRrCaptureEfficiency?: number | null;
  avgExitEfficiency?: number | null;
  tradeCount?: number | null;
  tradesWithExecutionData?: number | null;
};

function meanDefined(values: Array<number | null | undefined>) {
  const definedValues = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value)
  );

  if (definedValues.length === 0) return null;

  return definedValues.reduce((sum, value) => sum + value, 0) / definedValues.length;
}

export function computeExecutionGrade(input: ExecutionGradeInput): {
  grade: ExecutionGrade;
  gradeScore: number | null;
  avgSpread: number | null;
  avgSlippage: number | null;
} {
  const avgSpread = meanDefined([input.avgEntrySpread, input.avgExitSpread]);
  const avgSlippage = meanDefined([
    input.avgEntrySlippage,
    input.avgExitSlippage,
  ]);

  const hasMetricData =
    avgSpread != null ||
    avgSlippage != null ||
    input.avgRrCaptureEfficiency != null ||
    input.avgExitEfficiency != null;
  const hasGradeData =
    Number(input.tradeCount ?? 0) > 0 &&
    Number(input.tradesWithExecutionData ?? 0) > 0 &&
    hasMetricData;

  if (!hasGradeData) {
    return {
      grade: "N/A",
      gradeScore: null,
      avgSpread,
      avgSlippage,
    };
  }

  let gradeScore = 100;

  if (avgSpread != null) {
    if (avgSpread > 2) gradeScore -= 15;
    else if (avgSpread > 1) gradeScore -= 5;
  }

  if (avgSlippage != null) {
    if (avgSlippage > 1) gradeScore -= 20;
    else if (avgSlippage > 0.5) gradeScore -= 10;
  }

  if (
    input.avgRrCaptureEfficiency != null &&
    input.avgRrCaptureEfficiency < 50
  ) {
    gradeScore -= 10;
  }

  if (input.avgExitEfficiency != null && input.avgExitEfficiency < 50) {
    gradeScore -= 10;
  }

  gradeScore = Math.max(0, Math.min(100, gradeScore));

  const grade: ExecutionGrade =
    gradeScore >= 90
      ? "A"
      : gradeScore >= 80
        ? "B"
        : gradeScore >= 70
          ? "C"
          : gradeScore >= 60
            ? "D"
            : "F";

  return {
    grade,
    gradeScore,
    avgSpread,
    avgSlippage,
  };
}
