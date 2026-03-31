import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === "number" && result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

if (process.platform !== "darwin") {
  process.exit(0);
}

const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");
const esbuildPackage =
  process.arch === "arm64" ? "@esbuild/darwin-arm64" : "@esbuild/darwin-x64";
const esbuildBinary = path.join(repoRoot, "node_modules", esbuildPackage, "bin", "esbuild");

if (!fs.existsSync(esbuildBinary)) {
  console.warn(`[desktop] esbuild binary not found at ${esbuildBinary}`);
  process.exit(0);
}

spawnSync("xattr", ["-d", "com.apple.provenance", esbuildBinary], {
  stdio: "ignore",
});

run("codesign", ["--force", "--sign", "-", esbuildBinary]);
run(esbuildBinary, ["--version"]);
