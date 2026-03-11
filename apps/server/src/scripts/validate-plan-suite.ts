import { generatePlan } from "../lib/ai/plan-generator";
import {
  PLAN_TEST_SUITE,
  evaluatePlanExpectations,
  type PlanTestResult,
} from "../lib/ai/plan-test-suite";

async function run() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set. Plan suite requires LLM access.");
    process.exit(1);
  }

  const results: PlanTestResult[] = [];

  for (const test of PLAN_TEST_SUITE) {
    const planResult = await generatePlan(test.query, [], "plan-suite");
    if (!planResult.success || !planResult.plan) {
      results.push({
        id: test.id,
        query: test.query,
        pass: false,
        failures: [planResult.error || "plan generation failed"],
      });
      continue;
    }

    const failures = evaluatePlanExpectations(planResult.plan, test.expect);
    results.push({
      id: test.id,
      query: test.query,
      pass: failures.length === 0,
      failures,
      plan: planResult.plan,
    });
  }

  const failed = results.filter((result) => !result.pass);
  if (failed.length > 0) {
    console.error("Plan suite failures:");
    failed.forEach((failure) => {
      console.error(`- ${failure.id}: ${failure.failures.join("; ")}`);
      console.error(`  query: ${failure.query}`);
    });
    process.exit(1);
  }

  console.log(`Plan suite passed (${results.length} cases)`);
}

run().catch((error) => {
  console.error("Plan suite error:", error);
  process.exit(1);
});
