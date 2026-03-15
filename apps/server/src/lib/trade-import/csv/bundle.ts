export interface ParsedImportTrade {
  ticket: string | null;
  open: string | null;
  tradeType: "long" | "short" | null;
  volume: number | null;
  symbol: string | null;
  openPrice: number | null;
  sl: number | null;
  tp: number | null;
  close: string | null;
  closePrice: number | null;
  swap: number | null;
  commissions: number | null;
  profit: number | null;
  pips: number | null;
  tradeDurationSeconds: string | null;
  openTime: Date | null;
  closeTime: Date | null;
  sessionTag: string | null;
  sessionTagColor: string | null;
}

export interface ParsedImportAccountHints {
  brokerType: string | null;
  brokerServer: string | null;
  accountNumber: string | null;
  currency: string | null;
  liveBalance: number | null;
  liveEquity: number | null;
}

export interface ParsedImportBundle {
  parserId: string;
  parserLabel: string;
  reportType: string;
  files: string[];
  warnings: string[];
  accountHints: ParsedImportAccountHints;
  trades: ParsedImportTrade[];
  existingTrades: ParsedImportTrade[];
}

function parseNumber(value: string | undefined) {
  if (!value) return null;
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTradeType(value: string | undefined) {
  const lowered = value?.trim().toLowerCase() ?? "";
  if (["buy", "long"].includes(lowered)) return "long" as const;
  if (["sell", "short"].includes(lowered)) return "short" as const;
  return null;
}

function parseDate(value: string | undefined) {
  if (!value) return null;
  const parsed = new Date(value.trim());
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getField(
  row: Record<string, string>,
  candidates: string[]
): string | undefined {
  const entries = Object.entries(row);
  for (const candidate of candidates) {
    const match = entries.find(
      ([key]) => key.trim().toLowerCase() === candidate.toLowerCase()
    );
    if (match) return match[1];
  }
  return undefined;
}

function parseCsvText(csvText: string) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0]!.split(",").map((cell) => cell.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((cell) => cell.trim());
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return row;
  });
}

export function parseBrokerCsvImportBundle(input: {
  broker: string;
  files: Array<{ fileName?: string | null; csvText: string }>;
  existingTrades?: ParsedImportTrade[];
}): ParsedImportBundle {
  const parsedRows = input.files.flatMap((file) => parseCsvText(file.csvText));

  const trades: ParsedImportTrade[] = parsedRows.map((row, index) => {
    const openTime =
      parseDate(getField(row, ["open time", "openTime", "entry time"])) ?? null;
    const closeTime =
      parseDate(getField(row, ["close time", "closeTime", "exit time"])) ?? null;
    const profit = parseNumber(getField(row, ["profit", "pnl", "net pnl"]));
    const openPrice = parseNumber(getField(row, ["open price", "entry", "entry price"]));
    const closePrice = parseNumber(
      getField(row, ["close price", "exit", "exit price"])
    );

    return {
      ticket: getField(row, ["ticket", "trade id", "id"]) ?? `csv-${index + 1}`,
      open: openTime?.toISOString() ?? null,
      tradeType: parseTradeType(getField(row, ["type", "side", "direction"])),
      volume: parseNumber(getField(row, ["volume", "lot", "lots"])),
      symbol: getField(row, ["symbol", "instrument", "market"]) ?? null,
      openPrice,
      sl: parseNumber(getField(row, ["sl", "stop loss"])),
      tp: parseNumber(getField(row, ["tp", "take profit"])),
      close: closeTime?.toISOString() ?? null,
      closePrice,
      swap: parseNumber(getField(row, ["swap"])),
      commissions: parseNumber(getField(row, ["commission", "commissions"])),
      profit,
      pips: parseNumber(getField(row, ["pips"])),
      tradeDurationSeconds: null,
      openTime,
      closeTime,
      sessionTag: null,
      sessionTagColor: null,
    };
  });

  return {
    parserId: `csv:${input.broker.toLowerCase()}`,
    parserLabel: `${input.broker} CSV`,
    reportType: "csv",
    files: input.files.map((file) => file.fileName ?? "upload.csv"),
    warnings: [],
    accountHints: {
      brokerType: input.broker.toLowerCase().includes("mt")
        ? "mt5"
        : "other",
      brokerServer: null,
      accountNumber: null,
      currency: null,
      liveBalance: null,
      liveEquity: null,
    },
    trades,
    existingTrades: input.existingTrades ?? [],
  };
}
