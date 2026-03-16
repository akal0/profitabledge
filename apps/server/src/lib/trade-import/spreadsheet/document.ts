import * as XLSX from "xlsx";
import type { CsvRowRecord, ParsedCsvDocument } from "../csv/types";

const SPREADSHEET_EXTENSIONS = [".xlsx", ".xls", ".xlsm", ".xlsb"];

export function looksLikeSpreadsheetFile(fileName?: string | null): boolean {
  const normalized = fileName?.trim().toLowerCase() ?? "";
  return SPREADSHEET_EXTENSIONS.some((extension) =>
    normalized.endsWith(extension)
  );
}

export function parseSpreadsheetDocument(
  content: Buffer | Uint8Array | ArrayBuffer
): ParsedCsvDocument {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content as any);

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, {
      type: "buffer",
      raw: false,
      dense: true,
      cellFormula: false,
      cellHTML: false,
      cellNF: false,
      cellStyles: false,
      cellText: false,
    });
  } catch {
    return emptyDocument();
  }

  let bestRecords: CsvRowRecord[] = [];
  let bestScore = 0;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rawRows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    }) as unknown[][];

    const rows = rawRows
      .map(normalizeRow)
      .filter((row) => row.some((cell) => cell.length > 0));

    const records = buildBestTableRecords(rows);
    const score = scoreTableRecords(records);
    if (score > bestScore) {
      bestRecords = records;
      bestScore = score;
    }
  }

  return bestRecords.length > 0 ? recordsToDocument(bestRecords) : emptyDocument();
}

function emptyDocument(): ParsedCsvDocument {
  return { delimiter: "", headers: [], rows: [], records: [] };
}

function normalizeRow(row: unknown[]): string[] {
  const cells = row.map((cell) => {
    if (cell == null) return "";
    return String(cell).trim();
  });

  let lastPopulatedIndex = cells.length - 1;
  while (lastPopulatedIndex >= 0 && cells[lastPopulatedIndex] === "") {
    lastPopulatedIndex -= 1;
  }

  return lastPopulatedIndex >= 0
    ? cells.slice(0, lastPopulatedIndex + 1)
    : [];
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

function buildBestTableRecords(rowValues: string[][]): CsvRowRecord[] {
  let bestRecords: CsvRowRecord[] = [];
  let bestScore = 0;

  for (let headerIndex = 0; headerIndex < rowValues.length - 1; headerIndex += 1) {
    const headerRow = rowValues[headerIndex]?.map((cell) => cell.trim()) ?? [];
    const headerScore = scoreHeaderRow(headerRow);
    if (headerScore <= 0) {
      continue;
    }

    const sectionLabel = findSectionLabel(rowValues, headerIndex);

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

    const score =
      headerScore * 10 +
      scoreTableRecords(records) +
      scoreSectionLabel(sectionLabel, headerRow);
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
  if (
    normalized.some((cell) =>
      /symbol|instrument|contract|market|product/.test(cell)
    )
  ) {
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
  if (
    normalized.includes("position") &&
    normalized.includes("time") &&
    normalized.includes("time 2") &&
    normalized.includes("price") &&
    normalized.includes("price 2")
  ) {
    score += 12;
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

  if (
    normalized.some((key) => /symbol|instrument|contract|market|product/.test(key))
  ) {
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

function findSectionLabel(
  rowValues: string[][],
  headerIndex: number
): string | null {
  for (let index = headerIndex - 1; index >= 0; index -= 1) {
    const row = rowValues[index] ?? [];
    const nonEmpty = row.filter((cell) => cell.length > 0);

    if (nonEmpty.length === 0) {
      continue;
    }

    if (nonEmpty.length === 1) {
      return nonEmpty[0] ?? null;
    }

    return null;
  }

  return null;
}

function scoreSectionLabel(
  sectionLabel: string | null,
  headerRow: string[]
): number {
  const normalizedLabel = sectionLabel?.trim().toLowerCase() ?? "";
  if (!normalizedLabel) {
    return 0;
  }

  if (normalizedLabel === "positions") {
    return 120;
  }

  if (normalizedLabel === "open positions") {
    return 40;
  }

  if (normalizedLabel === "deals") {
    const normalizedHeaders = headerRow.map((cell) => cell.toLowerCase());
    if (
      normalizedHeaders.includes("balance") ||
      normalizedHeaders.includes("deal")
    ) {
      return -40;
    }
    return 10;
  }

  if (
    normalizedLabel === "orders" ||
    normalizedLabel === "results" ||
    normalizedLabel === "balance drawdown"
  ) {
    return -80;
  }

  return 0;
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
