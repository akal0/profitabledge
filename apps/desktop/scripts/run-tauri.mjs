import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const separator = process.platform === "win32" ? ";" : ":";
const cargoBin = path.join(os.homedir(), ".cargo", "bin");
const tauriBinary = path.join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tauri.cmd" : "tauri"
);

const env = {
  ...process.env,
  PATH: process.env.PATH
    ? `${cargoBin}${separator}${process.env.PATH}`
    : cargoBin,
};

const result = spawnSync(tauriBinary, process.argv.slice(2), {
  stdio: "inherit",
  env,
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 0);
