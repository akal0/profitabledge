import { evaluateAssistantRegressions } from "../lib/ai/assistant-regression-suite";

async function run() {
  const results = await evaluateAssistantRegressions();
  const failures = results.filter((result) => !result.pass);

  if (failures.length > 0) {
    console.error("Assistant regression failures:");
    failures.forEach((failure) => {
      console.error(`- ${failure.id}: ${failure.failures.join("; ")}`);
    });
    process.exitCode = 1;
  } else {
    console.log(`Assistant regressions passed (${results.length} cases)`);
  }
}

run().catch((error) => {
  console.error("Assistant regression runner error:", error);
  process.exit(1);
});
