import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

type JournalEntry = {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
};

type JournalFile = {
  version: string;
  dialect: string;
  entries: JournalEntry[];
};

const MIGRATIONS_DIR = resolve(import.meta.dir, "../db/migrations");
const META_DIR = join(MIGRATIONS_DIR, "meta");
const JOURNAL_PATH = join(META_DIR, "_journal.json");
const MIGRATION_FILE_PATTERN = /^(\d{4})_(.+)\.sql$/;
const LEGACY_DUPLICATE_PREFIX_ALLOWLIST = new Set([
  "0010",
  "0011",
  "0012",
  "0013",
  "0014",
  "0036",
  "0040",
]);

function getMigrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();
}

function readJournal() {
  return JSON.parse(readFileSync(JOURNAL_PATH, "utf8")) as JournalFile;
}

function validateMigrationNames(files: string[]) {
  const duplicatePrefixes = new Map<string, string[]>();
  const seenTags = new Set<string>();
  const problems: string[] = [];

  for (const fileName of files) {
    const match = fileName.match(MIGRATION_FILE_PATTERN);
    if (!match) {
      problems.push(`Invalid migration filename: ${fileName}`);
      continue;
    }

    const [, prefix] = match;
    const fileTag = fileName.replace(/\.sql$/, "");

    if (seenTags.has(fileTag)) {
      problems.push(`Duplicate migration tag: ${fileTag}`);
    }
    seenTags.add(fileTag);

    const entries = duplicatePrefixes.get(prefix) ?? [];
    entries.push(fileName);
    duplicatePrefixes.set(prefix, entries);
  }

  for (const [prefix, entries] of duplicatePrefixes) {
    if (entries.length <= 1) {
      continue;
    }

    if (!LEGACY_DUPLICATE_PREFIX_ALLOWLIST.has(prefix)) {
      problems.push(
        `Unexpected duplicate migration prefix ${prefix}: ${entries.join(", ")}`
      );
    }
  }

  return problems;
}

function validateJournal(files: string[], journal: JournalFile) {
  const problems: string[] = [];
  const fileTags = files.map((fileName) => fileName.replace(/\.sql$/, ""));
  const journalTags = journal.entries.map((entry) => entry.tag);

  if (journalTags.length !== fileTags.length) {
    problems.push(
      `Journal/file count mismatch: journal=${journalTags.length}, files=${fileTags.length}`
    );
  }

  fileTags.forEach((tag, index) => {
    const journalTag = journalTags[index];
    if (journalTag !== tag) {
      problems.push(
        `Journal out of sync at index ${index}: expected ${tag}, found ${journalTag ?? "missing"}`
      );
    }
  });

  journal.entries.forEach((entry, index) => {
    if (entry.idx !== index) {
      problems.push(
        `Journal idx mismatch for ${entry.tag}: expected ${index}, found ${entry.idx}`
      );
    }
  });

  return problems;
}

function warnOnSnapshotDrift(files: string[]) {
  const snapshotFiles = new Set(
    readdirSync(META_DIR).filter((fileName) => fileName.endsWith("_snapshot.json"))
  );
  const expectedLatestSnapshot =
    files.length > 0
      ? `${String(files.length - 1).padStart(4, "0")}_snapshot.json`
      : null;

  if (expectedLatestSnapshot && !snapshotFiles.has(expectedLatestSnapshot)) {
    console.warn(
      `[migration-check] Snapshot metadata is stale. Expected at least ${expectedLatestSnapshot}, found latest ${Array.from(snapshotFiles).sort().at(-1) ?? "none"}.`
    );
  }
}

function syncJournal(files: string[], journal: JournalFile) {
  const existingTimesByTag = new Map(
    journal.entries.map((entry) => [entry.tag, entry.when])
  );
  const baseTimestamp = Date.now();
  const nextJournal: JournalFile = {
    version: journal.version || "7",
    dialect: journal.dialect || "postgresql",
    entries: files.map((fileName, index) => {
      const tag = fileName.replace(/\.sql$/, "");
      return {
        idx: index,
        version: journal.version || "7",
        when: existingTimesByTag.get(tag) ?? baseTimestamp + index,
        tag,
        breakpoints: true,
      };
    }),
  };

  mkdirSync(META_DIR, { recursive: true });
  writeFileSync(`${JOURNAL_PATH}`, `${JSON.stringify(nextJournal, null, 2)}\n`);
  return nextJournal;
}

function main() {
  const shouldSyncJournal = process.argv.includes("--sync-journal");
  const migrationFiles = getMigrationFiles();
  let journal = readJournal();

  if (shouldSyncJournal) {
    journal = syncJournal(migrationFiles, journal);
    console.log(`[migration-check] Synced journal with ${migrationFiles.length} migrations.`);
  }

  const problems = [
    ...validateMigrationNames(migrationFiles),
    ...validateJournal(migrationFiles, journal),
  ];

  warnOnSnapshotDrift(migrationFiles);

  if (problems.length > 0) {
    console.error("[migration-check] Integrity check failed:");
    problems.forEach((problem) => console.error(`- ${problem}`));
    process.exit(1);
  }

  console.log(
    `[migration-check] OK. ${migrationFiles.length} migrations and journal entries are aligned.`
  );
}

main();
