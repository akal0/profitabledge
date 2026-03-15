import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const [, , tsconfigArg] = process.argv;

function fail(message) {
  console.error(`[run-tsc-check] ${message}`);
  process.exit(1);
}

if (!tsconfigArg) {
  fail("Usage: node scripts/run-tsc-check.mjs <tsconfig-path>");
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const tsconfigPath = path.resolve(process.cwd(), tsconfigArg);
const tsconfigDir = path.dirname(tsconfigPath);
const readResult = ts.readConfigFile(tsconfigPath, ts.sys.readFile);

if (readResult.error) {
  fail(ts.flattenDiagnosticMessageText(readResult.error.messageText, "\n"));
}

const rawConfig = readResult.config;
const filteredConfig = {
  ...rawConfig,
  include: Array.isArray(rawConfig.include)
    ? rawConfig.include.filter(
        (entry) =>
          typeof entry !== "string" || !entry.startsWith(".next/types/")
      )
    : rawConfig.include,
};

const tempConfigPath = path.join(
  tsconfigDir,
  `tsconfig.check.${Date.now()}.json`
);

fs.writeFileSync(tempConfigPath, JSON.stringify(filteredConfig, null, 2));

const result = spawnSync(
  path.join(repoRoot, "node_modules", ".bin", "tsc"),
  ["-p", tempConfigPath, "--noEmit", "--pretty", "false"],
  {
    cwd: tsconfigDir,
    stdio: "inherit",
  }
);

fs.rmSync(tempConfigPath, { force: true });
process.exit(result.status ?? 1);
