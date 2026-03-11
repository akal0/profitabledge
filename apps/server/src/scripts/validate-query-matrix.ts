import { evaluateQueryTestMatrix } from "../lib/ai/query-test-matrix";

const results = evaluateQueryTestMatrix();
const failures = results.filter((result) => !result.pass);

if (failures.length > 0) {
  console.error("Query matrix failures:");
  failures.forEach((failure) => {
    console.error(`- ${failure.id}: ${failure.failures.join("; ")}`);
    console.error(`  query: ${failure.query}`);
    console.error(`  normalized: ${failure.normalized}`);
  });
  process.exitCode = 1;
} else {
  console.log(`Query matrix passed (${results.length} cases)`);
}
