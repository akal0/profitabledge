import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const separator = process.platform === "win32" ? ";" : ":";
const cargoBin = path.join(os.homedir(), ".cargo", "bin");
const workspaceRoot = path.join(import.meta.dirname, "..");
const repoRoot = path.join(workspaceRoot, "..", "..");
const tauriBinary = path.join(
  repoRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tauri.cmd" : "tauri"
);

const env = {
  ...process.env,
  PATH: process.env.PATH ? `${cargoBin}${separator}${process.env.PATH}` : cargoBin,
};

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === "number" && result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

function parseBundleArgument(argument) {
  return argument
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function findBundleValueIndex(args) {
  const flagIndex = args.findIndex((value) => value === "--bundles");
  return flagIndex >= 0 ? flagIndex + 1 : -1;
}

function getMacBundlePaths() {
  const tauriConfigPath = path.join(workspaceRoot, "src-tauri", "tauri.conf.json");
  const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, "utf8"));
  const productName = tauriConfig.productName;
  const version = tauriConfig.version;
  const arch = process.arch === "arm64" ? "aarch64" : process.arch;

  const macosBundleDir = path.join(
    workspaceRoot,
    "src-tauri",
    "target",
    "release",
    "bundle",
    "macos"
  );
  const dmgBundleDir = path.join(
    workspaceRoot,
    "src-tauri",
    "target",
    "release",
    "bundle",
    "dmg"
  );
  const appPath = path.join(macosBundleDir, `${productName}.app`);
  const dmgPath = path.join(dmgBundleDir, `${productName}_${version}_${arch}.dmg`);

  return {
    appPath,
    dmgPath,
    dmgBundleDir,
    productName,
  };
}

function signMacAppBundle() {
  const { appPath } = getMacBundlePaths();

  if (!fs.existsSync(appPath)) {
    return;
  }

  // Preserve real Apple signatures when they are configured. The ad-hoc
  // fallback is only for local testing on machines without a Developer ID
  // certificate, where Tauri can leave the bundle linker-signed but not
  // properly signed as an app package.
  if (!process.env.APPLE_SIGNING_IDENTITY?.trim()) {
    run("codesign", ["--force", "--deep", "--sign", "-", appPath]);
  }

  run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appPath]);
}

function ensureMacDmg() {
  const { appPath, dmgPath, dmgBundleDir, productName } = getMacBundlePaths();

  if (!fs.existsSync(appPath)) {
    throw new Error(`Missing app bundle at ${appPath}`);
  }

  fs.mkdirSync(dmgBundleDir, { recursive: true });

  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), "profitabledge-dmg-"));
  const stagedAppPath = path.join(stagingDir, `${productName}.app`);
  const applicationsLinkPath = path.join(stagingDir, "Applications");

  try {
    run("ditto", [appPath, stagedAppPath]);
    fs.symlinkSync("/Applications", applicationsLinkPath);

    if (fs.existsSync(dmgPath)) {
      fs.rmSync(dmgPath, { force: true });
    }

    run("hdiutil", [
      "create",
      "-volname",
      productName,
      "-srcfolder",
      stagingDir,
      "-ov",
      "-format",
      "UDZO",
      dmgPath,
    ]);

    console.log(`[desktop] Created dmg at ${dmgPath}`);
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
}

const args = process.argv.slice(2);
const bundleValueIndex = findBundleValueIndex(args);
const bundleValues =
  bundleValueIndex >= 0 ? parseBundleArgument(args[bundleValueIndex]) : [];
const shouldBuildManualDmg =
  process.platform === "darwin" && bundleValues.includes("dmg");

if (!shouldBuildManualDmg) {
  run(tauriBinary, args);
  if (process.platform === "darwin") {
    signMacAppBundle();
  }
  process.exit(0);
}

const nextBundleValues = Array.from(new Set([...bundleValues.filter((value) => value !== "dmg"), "app"]));
const tauriArgs = [...args];
tauriArgs[bundleValueIndex] = nextBundleValues.join(",");

run(tauriBinary, tauriArgs);
signMacAppBundle();
ensureMacDmg();
