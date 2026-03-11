import {
  evaluateAssistantRegressions,
  type AssistantRegressionResult,
} from "../lib/ai/assistant-regression-suite";
import {
  evaluateQueryTestMatrix,
  type QueryTestResult,
} from "../lib/ai/query-test-matrix";

function reportAssistantFailures(results: AssistantRegressionResult[]): number {
  const failures = results.filter((result) => !result.pass);
  if (failures.length === 0) {
    console.log(`Assistant regressions passed (${results.length} cases)`);
    return 0;
  }

  console.error("Assistant regression failures:");
  failures.forEach((failure) => {
    console.error(`- ${failure.id}: ${failure.failures.join("; ")}`);
  });
  return failures.length;
}

function reportQueryFailures(results: QueryTestResult[]): number {
  const failures = results.filter((result) => !result.pass);
  if (failures.length === 0) {
    console.log(`Query matrix passed (${results.length} cases)`);
    return 0;
  }

  console.error("Query matrix failures:");
  failures.forEach((failure) => {
    console.error(`- ${failure.id}: ${failure.failures.join("; ")}`);
    console.error(`  query: ${failure.query}`);
    console.error(`  normalized: ${failure.normalized}`);
  });
  return failures.length;
}

async function run() {
  const assistantFailures = reportAssistantFailures(await evaluateAssistantRegressions());
  const queryFailures = reportQueryFailures(evaluateQueryTestMatrix());

  if (assistantFailures + queryFailures > 0) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error("AI regression runner error:", error);
  process.exit(1);
});
