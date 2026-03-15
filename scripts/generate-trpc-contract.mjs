import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const tempRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), "profitabledge-trpc-contract-")
);
const tempTsconfigPath = path.join(
  repoRoot,
  "apps",
  "server",
  `tsconfig.generate.${Date.now()}.json`
);
const generatedRoot = path.join(
  repoRoot,
  "packages",
  "contracts",
  "generated",
  "server"
);
const stagedGeneratedRoot = path.join(
  repoRoot,
  "packages",
  "contracts",
  "generated",
  `server.__staging__.${process.pid}.${Date.now()}`
);
const emittedServerRootCandidates = [
  path.join(tempRoot, "apps", "server", "src"),
  path.join(tempRoot, "src"),
];

function fail(message) {
  console.error(`[generate-trpc-contract] ${message}`);
  process.exit(1);
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

const tsconfigPath = path.join(repoRoot, "apps", "server", "tsconfig.json");
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

fs.writeFileSync(tempTsconfigPath, JSON.stringify(filteredConfig, null, 2));

const tsc = spawnSync(
  path.join(repoRoot, "node_modules", ".bin", "tsc"),
  [
    "-p",
    tempTsconfigPath,
    "--declaration",
    "--emitDeclarationOnly",
    "--noEmit",
    "false",
    "--outDir",
    tempRoot,
  ],
  {
    cwd: repoRoot,
    encoding: "utf8",
  }
);

if (tsc.status !== 0) {
  process.stderr.write(tsc.stdout ?? "");
  process.stderr.write(tsc.stderr ?? "");
  fail("TypeScript declaration generation failed.");
}

const emittedServerRoot = emittedServerRootCandidates.find((candidate) =>
  fs.existsSync(candidate)
);

if (!emittedServerRoot) {
  fail(
    `Expected emitted declarations under one of: ${emittedServerRootCandidates.join(
      ", "
    )}`
  );
}

fs.rmSync(stagedGeneratedRoot, { recursive: true, force: true });
fs.mkdirSync(stagedGeneratedRoot, { recursive: true });
fs.cpSync(emittedServerRoot, path.join(stagedGeneratedRoot, "src"), {
  recursive: true,
});

let published = false;

for (let attempt = 0; attempt < 3 && !published; attempt += 1) {
  try {
    fs.rmSync(generatedRoot, { recursive: true, force: true });
    fs.renameSync(stagedGeneratedRoot, generatedRoot);
    published = true;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      ["EEXIST", "ENOTEMPTY", "EPERM", "EBUSY"].includes(error.code)
    ) {
      sleep(50 * (attempt + 1));
      continue;
    }

    throw error;
  }
}

if (!published) {
  fail("Failed to publish generated contract declarations.");
}

fs.rmSync(tempTsconfigPath, { force: true });

console.log(
  `[generate-trpc-contract] Wrote declarations to ${path.relative(
    repoRoot,
    generatedRoot
  )}`
);
