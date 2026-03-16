import { XMLParser } from "fast-xml-parser";
import type { CsvRowRecord, ParsedCsvDocument } from "../csv/types";

/**
 * Parses an XML string into the same ParsedCsvDocument shape used by CSV
 * imports so broker parsers can stay format-agnostic.
 */
export function parseXmlDocument(text: string): ParsedCsvDocument {
  const cleaned = text.replace(/^\uFEFF/, "").trim();
  if (!cleaned) return emptyDocument();

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    textNodeName: "#text",
    trimValues: true,
    parseTagValue: false,
    removeNSPrefix: true,
  });

  let parsed: unknown;
  try {
    parsed = parser.parse(cleaned);
  } catch {
    return emptyDocument();
  }

  if (!parsed || typeof parsed !== "object") return emptyDocument();

  const tableRecords = extractTableRecords(parsed);
  if (tableRecords.length > 0) {
    return recordsToDocument(tableRecords);
  }

  const arrayRows = collectBestObjectArray(parsed);
  if (arrayRows.length > 0) {
    return recordsToDocument(arrayRows.map(flattenToRecord));
  }

  const singleRow = findSingleDataRow(parsed);
  if (singleRow) {
    return recordsToDocument([flattenToRecord(singleRow)]);
  }

  return emptyDocument();
}

/**
 * Heuristic to detect whether raw text is XML/HTML rather than CSV.
 */
export function looksLikeXml(text: string): boolean {
  const trimmed = text.replace(/^\uFEFF/, "").trimStart();
  if (/^<\?xml\s/i.test(trimmed)) return true;
  if (/^<!doctype\s/i.test(trimmed)) return true;
  if (/^<[a-zA-Z_]/.test(trimmed)) {
    const preview = trimmed.slice(0, 1000);
    return /<\/[a-zA-Z_]/.test(preview) || /\/>/.test(preview);
  }
  return false;
}

function emptyDocument(): ParsedCsvDocument {
  return { delimiter: "", headers: [], rows: [], records: [] };
}

function recordsToDocument(flatRecords: CsvRowRecord[]): ParsedCsvDocument {
  if (flatRecords.length === 0) return emptyDocument();

  const headerSet = new Set<string>();
  for (const record of flatRecords) {
    for (const key of Object.keys(record)) {
      headerSet.add(key);
    }
  }

  const headers = [...headerSet];
  const records = flatRecords.map((row) => {
    const normalized: CsvRowRecord = {};
    for (const header of headers) {
      normalized[header] = row[header] ?? "";
    }
    return normalized;
  });

  return {
    delimiter: "",
    headers,
    rows: records.map((record) => headers.map((header) => record[header] ?? "")),
    records,
  };
}

function collectBestObjectArray(root: unknown): Record<string, unknown>[] {
  let best: Record<string, unknown>[] = [];
  let bestScore = 0;

  function walk(node: unknown, path: string[]): void {
    if (node == null || typeof node !== "object") return;

    if (Array.isArray(node)) {
      const objects = node.filter(
        (item): item is Record<string, unknown> =>
          item != null && typeof item === "object" && !Array.isArray(item)
      );

      if (objects.length > 0) {
        const score = scoreObjectArray(objects, path);
        if (score > bestScore) {
          best = objects;
          bestScore = score;
        }
      }

      for (const item of node) {
        walk(item, path);
      }
      return;
    }

    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      walk(value, [...path, key]);
    }
  }

  walk(root, []);
  return best;
}

function scoreObjectArray(
  rows: Record<string, unknown>[],
  path: string[]
): number {
  if (
    path.some((segment) =>
      ["table", "worksheet", "tr", "row", "td", "cell"].includes(
        segment.toLowerCase()
      )
    )
  ) {
    return 0;
  }

  const sample = rows.slice(0, 10).map(flattenToRecord);
  const averageScore =
    sample.reduce((sum, record) => sum + scoreFlatRecord(record), 0) /
    sample.length;

  if (averageScore < 3) {
    return 0;
  }

  return averageScore * 10 + rows.length;
}

function findSingleDataRow(root: unknown): Record<string, unknown> | null {
  let best: Record<string, unknown> | null = null;
  let bestScore = 0;

  function walk(node: unknown): void {
    if (node == null || typeof node !== "object" || Array.isArray(node)) return;

    const record = node as Record<string, unknown>;
    const score = scoreFlatRecord(flattenToRecord(record));
    if (score > bestScore) {
      best = record;
      bestScore = score;
    }

    for (const value of Object.values(record)) {
      walk(value);
    }
  }

  walk(root);
  return bestScore >= 8 ? best : null;
}

function flattenToRecord(obj: Record<string, unknown>): CsvRowRecord {
  const leaves: Array<{ keyPath: string[]; value: string }> = [];
  collectLeafEntries(obj, [], leaves);

  const leafCounts = new Map<string, number>();
  for (const leaf of leaves) {
    const leafName = leaf.keyPath[leaf.keyPath.length - 1];
    if (!leafName) continue;
    leafCounts.set(leafName, (leafCounts.get(leafName) ?? 0) + 1);
  }

  const record: CsvRowRecord = {};
  for (const leaf of leaves) {
    const contextualLabel = buildLeafLabel(leaf.keyPath);
    if (contextualLabel) {
      assignRecordValue(record, contextualLabel, leaf.value);
    }

    const leafName = leaf.keyPath[leaf.keyPath.length - 1];
    if (leafName && (leafCounts.get(leafName) ?? 0) === 1) {
      assignRecordValue(record, leafName, leaf.value);
    }
  }

  return record;
}

function collectLeafEntries(
  node: unknown,
  path: string[],
  leaves: Array<{ keyPath: string[]; value: string }>
): void {
  if (node == null) {
    if (path.length > 0) {
      leaves.push({ keyPath: path, value: "" });
    }
    return;
  }

  if (typeof node !== "object") {
    if (path.length > 0) {
      leaves.push({ keyPath: path, value: String(node) });
    }
    return;
  }

  if (Array.isArray(node)) {
    if (path.length > 0) {
      leaves.push({
        keyPath: path,
        value: node.map((item) => textContent(item)).filter(Boolean).join(", "),
      });
    }
    return;
  }

  const record = node as Record<string, unknown>;
  const childKeys = Object.keys(record).filter(
    (key) => key !== "#text" && key !== "#cdata"
  );

  if ("#text" in record && path.length > 0) {
    const text = String(record["#text"] ?? "").trim();
    if (text.length > 0) {
      leaves.push({ keyPath: path, value: text });
    }
  }

  if (childKeys.length === 0) {
    if (path.length > 0) {
      leaves.push({ keyPath: path, value: textContent(record) });
    }
    return;
  }

  for (const key of childKeys) {
    collectLeafEntries(record[key], [...path, key], leaves);
  }
}

function assignRecordValue(record: CsvRowRecord, key: string, value: string): void {
  const normalizedKey = key.trim();
  if (!normalizedKey) return;

  const normalizedValue = value.trim();
  const currentValue = record[normalizedKey];
  if (currentValue == null || currentValue.trim() === "") {
    record[normalizedKey] = normalizedValue;
  }
}

function buildLeafLabel(path: string[]): string {
  const filtered = path.filter((segment) => {
    const normalized = segment.toLowerCase();
    return ![
      "trade",
      "trades",
      "row",
      "rows",
      "item",
      "items",
      "record",
      "records",
      "result",
      "results",
      "report",
      "reports",
      "data",
      "list",
      "table",
      "worksheet",
      "workbook",
    ].includes(normalized);
  });

  const relevant = filtered.length > 0 ? filtered : path;
  return relevant.join(" ").trim();
}

function extractTableRecords(root: unknown): CsvRowRecord[] {
  const tableNodes = collectByTagName(root, [
    "table",
    "Table",
    "TABLE",
    "worksheet",
    "Worksheet",
    "WORKSHEET",
  ]);

  let bestRecords: CsvRowRecord[] = [];
  let bestScore = 0;

  for (const tableNode of tableNodes) {
    const rowNodes = collectByTagName(tableNode, [
      "tr",
      "TR",
      "Tr",
      "row",
      "ROW",
      "Row",
    ]);
    const rowValues = rowNodes
      .map(extractCellValues)
      .filter((cells) => cells.some((cell) => cell.trim().length > 0));

    const candidate = buildBestTableRecords(rowValues);
    const score = scoreTableRecords(candidate);
    if (score > bestScore) {
      bestRecords = candidate;
      bestScore = score;
    }
  }

  return bestRecords;
}

function buildBestTableRecords(rowValues: string[][]): CsvRowRecord[] {
  let bestRecords: CsvRowRecord[] = [];
  let bestScore = 0;

  for (let headerIndex = 0; headerIndex < rowValues.length - 1; headerIndex += 1) {
    const headerRow = rowValues[headerIndex]?.map((cell) => cell.trim()) ?? [];
    const headerScore = scoreHeaderRow(headerRow);
    if (headerScore <= 0) {
      continue;
    }

    const headers = dedupeHeaders(headerRow);
    const records: CsvRowRecord[] = [];

    for (let rowIndex = headerIndex + 1; rowIndex < rowValues.length; rowIndex += 1) {
      const row = rowValues[rowIndex]?.map((cell) => cell.trim()) ?? [];

      if (row.every((cell) => cell.length === 0)) {
        if (records.length > 0) break;
        continue;
      }

      if (rowsMatchHeader(row, headerRow)) {
        if (records.length > 0) break;
        continue;
      }

      if (looksLikeSectionLabel(row)) {
        if (records.length > 0) break;
        continue;
      }

      const record: CsvRowRecord = {};
      let hasValue = false;

      for (let cellIndex = 0; cellIndex < headers.length; cellIndex += 1) {
        const header = headers[cellIndex];
        if (!header) continue;
        const value = row[cellIndex] ?? "";
        record[header] = value;
        if (value.length > 0) {
          hasValue = true;
        }
      }

      if (hasValue) {
        records.push(record);
      }
    }

    const score = headerScore * 10 + scoreTableRecords(records);
    if (score > bestScore) {
      bestRecords = records;
      bestScore = score;
    }
  }

  return bestRecords;
}

function scoreHeaderRow(row: string[]): number {
  const normalized = row
    .map((cell) => cell.toLowerCase())
    .filter((cell) => cell.length > 0);

  if (normalized.length < 3) {
    return 0;
  }

  let score = normalized.length;

  if (normalized.some((cell) => /ticket|trade id|order id|position/.test(cell))) {
    score += 2;
  }
  if (normalized.some((cell) => /symbol|instrument|contract|market|product/.test(cell))) {
    score += 4;
  }
  if (normalized.some((cell) => /open|entry/.test(cell))) {
    score += 4;
  }
  if (normalized.some((cell) => /close|exit/.test(cell))) {
    score += 4;
  }
  if (normalized.some((cell) => /profit|p\/l|pnl|net/.test(cell))) {
    score += 4;
  }
  if (normalized.some((cell) => /volume|qty|quantity|lot/.test(cell))) {
    score += 2;
  }
  if (normalized.some((cell) => /price/.test(cell))) {
    score += 2;
  }

  return score;
}

function scoreFlatRecord(record: CsvRowRecord): number {
  const populatedKeys = Object.keys(record).filter((key) => {
    const value = record[key]?.trim();
    return key.trim().length > 0 && value != null && value.length > 0;
  });

  if (populatedKeys.length < 2) {
    return 0;
  }

  const normalized = populatedKeys.map((key) => key.toLowerCase());
  let score = Math.min(populatedKeys.length, 8);

  if (normalized.some((key) => /symbol|instrument|contract|market|product/.test(key))) {
    score += 4;
  }
  if (normalized.some((key) => /open|entry/.test(key))) {
    score += 4;
  }
  if (normalized.some((key) => /close|exit/.test(key))) {
    score += 4;
  }
  if (normalized.some((key) => /profit|p\/l|pnl|net/.test(key))) {
    score += 4;
  }
  if (normalized.some((key) => /price/.test(key))) {
    score += 2;
  }
  if (normalized.some((key) => /volume|qty|quantity|lot/.test(key))) {
    score += 2;
  }
  if (normalized.some((key) => /type|side|direction/.test(key))) {
    score += 2;
  }

  return score;
}

function scoreTableRecords(records: CsvRowRecord[]): number {
  if (records.length === 0) {
    return 0;
  }

  const sample = records.slice(0, 10);
  const averageScore =
    sample.reduce((sum, record) => sum + scoreFlatRecord(record), 0) /
    sample.length;

  return averageScore * 5 + records.length;
}

function rowsMatchHeader(row: string[], header: string[]): boolean {
  const normalizedRow = row.map((cell) => cell.toLowerCase().trim()).filter(Boolean);
  const normalizedHeader = header
    .map((cell) => cell.toLowerCase().trim())
    .filter(Boolean);

  if (normalizedRow.length === 0 || normalizedRow.length !== normalizedHeader.length) {
    return false;
  }

  return normalizedRow.every((cell, index) => cell === normalizedHeader[index]);
}

function looksLikeSectionLabel(row: string[]): boolean {
  const nonEmpty = row.filter((cell) => cell.length > 0);
  return nonEmpty.length === 1 && row[0]?.length > 0;
}

function dedupeHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();

  return headers.map((header, index) => {
    const trimmed = header.trim() || `Column ${index + 1}`;
    const count = seen.get(trimmed) ?? 0;
    seen.set(trimmed, count + 1);
    return count === 0 ? trimmed : `${trimmed} ${count + 1}`;
  });
}

function collectByTagName(root: unknown, names: string[]): unknown[] {
  const results: unknown[] = [];

  function walk(node: unknown): void {
    if (node == null || typeof node !== "object") return;

    if (Array.isArray(node)) {
      for (const item of node) {
        walk(item);
      }
      return;
    }

    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (names.includes(key)) {
        if (Array.isArray(value)) results.push(...value);
        else results.push(value);
      }
      walk(value);
    }
  }

  walk(root);
  return results;
}

function extractCellValues(row: unknown): string[] {
  if (row == null || typeof row !== "object") return [];

  const record = row as Record<string, unknown>;
  for (const key of [
    "td",
    "TD",
    "Td",
    "th",
    "TH",
    "Th",
    "cell",
    "CELL",
    "Cell",
  ]) {
    const cells = record[key];
    if (cells == null) continue;

    if (Array.isArray(cells)) {
      return cells.map((cell) => textContent(cell));
    }

    return [textContent(cells)];
  }

  return [];
}

function textContent(node: unknown): string {
  if (node == null) return "";
  if (typeof node !== "object") return String(node);
  if (Array.isArray(node)) return node.map(textContent).filter(Boolean).join(" ");

  const record = node as Record<string, unknown>;
  if ("#text" in record && Object.keys(record).length === 1) {
    return String(record["#text"] ?? "");
  }

  return Object.values(record).map(textContent).filter(Boolean).join(" ");
}
