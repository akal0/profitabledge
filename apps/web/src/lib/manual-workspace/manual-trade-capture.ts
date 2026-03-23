import type {
  ManualTradeCaptureBulkResult,
  ManualTradeCaptureDerivedFields,
  ManualTradeCaptureField,
  ManualTradeCaptureFields,
  ManualTradeCaptureParseOptions,
  ManualTradeCaptureResult,
  ManualTradeCaptureSourceKind,
  ManualTradeDirection,
} from "./manual-trade-capture-types";

type FieldKey = keyof ManualTradeCaptureFields;

const DEFAULT_FIELDS: ManualTradeCaptureFields = {
  symbol: createField(null, "regex", 0),
  direction: createField(null, "regex", 0),
  volume: createField(null, "regex", 0),
  openPrice: createField(null, "regex", 0),
  closePrice: createField(null, "regex", 0),
  stopLoss: createField(null, "regex", 0),
  takeProfit: createField(null, "regex", 0),
  profit: createField(null, "regex", 0),
  commission: createField(null, "regex", 0),
  swap: createField(null, "regex", 0),
  openTime: createField(null, "regex", 0),
  closeTime: createField(null, "regex", 0),
  notes: createField(null, "regex", 0),
};

const HEADER_SYNONYMS: Record<string, FieldKey> = {
  symbol: "symbol",
  pair: "symbol",
  market: "symbol",
  direction: "direction",
  side: "direction",
  type: "direction",
  volume: "volume",
  size: "volume",
  qty: "volume",
  quantity: "volume",
  lot: "volume",
  lots: "volume",
  contracts: "volume",
  open: "openPrice",
  entry: "openPrice",
  entryprice: "openPrice",
  openprice: "openPrice",
  buyprice: "openPrice",
  sellprice: "openPrice",
  close: "closePrice",
  exit: "closePrice",
  exitprice: "closePrice",
  closeprice: "closePrice",
  stoploss: "stopLoss",
  sl: "stopLoss",
  takeprofit: "takeProfit",
  tp: "takeProfit",
  profit: "profit",
  pnl: "profit",
  pl: "profit",
  commission: "commission",
  commissions: "commission",
  fee: "commission",
  fees: "commission",
  swap: "swap",
  opentime: "openTime",
  opened: "openTime",
  entrytime: "openTime",
  entrydate: "openTime",
  closetime: "closeTime",
  closed: "closeTime",
  exittime: "closeTime",
  exitdate: "closeTime",
  notes: "notes",
  note: "notes",
  comment: "notes",
  remarks: "notes",
};

const POSitional_KEYS: FieldKey[] = [
  "symbol",
  "direction",
  "volume",
  "openPrice",
  "closePrice",
  "stopLoss",
  "takeProfit",
  "profit",
  "commission",
  "swap",
  "openTime",
  "closeTime",
  "notes",
];

function createField<T>(
  value: T,
  source: ManualTradeCaptureField<T>["source"],
  confidence: number,
  raw?: string | null
): ManualTradeCaptureField<T> {
  return { value, source, confidence, raw };
}

function cloneDefaultFields(): ManualTradeCaptureFields {
  return {
    symbol: { ...DEFAULT_FIELDS.symbol },
    direction: { ...DEFAULT_FIELDS.direction },
    volume: { ...DEFAULT_FIELDS.volume },
    openPrice: { ...DEFAULT_FIELDS.openPrice },
    closePrice: { ...DEFAULT_FIELDS.closePrice },
    stopLoss: { ...DEFAULT_FIELDS.stopLoss },
    takeProfit: { ...DEFAULT_FIELDS.takeProfit },
    profit: { ...DEFAULT_FIELDS.profit },
    commission: { ...DEFAULT_FIELDS.commission },
    swap: { ...DEFAULT_FIELDS.swap },
    openTime: { ...DEFAULT_FIELDS.openTime },
    closeTime: { ...DEFAULT_FIELDS.closeTime },
    notes: { ...DEFAULT_FIELDS.notes },
  };
}

function cloneDefaultDerivedFields(): ManualTradeCaptureDerivedFields {
  return {
    isOpenTrade: createField(false, "derived", 0),
    holdSeconds: createField(null, "derived", 0),
    estimatedPips: createField(null, "derived", 0),
    estimatedProfit: createField(null, "derived", 0),
    netPnl: createField(null, "derived", 0),
    riskPips: createField(null, "derived", 0),
    targetPips: createField(null, "derived", 0),
    plannedRR: createField(null, "derived", 0),
  };
}

function normalizeText(value: string) {
  return value.replace(/\u00a0/g, " ").trim();
}

function lowerCompact(value: string) {
  return normalizeText(value).toLowerCase().replace(/\s+/g, " ");
}

function toNumber(value: string | null | undefined) {
  if (!value) return null;
  const cleaned = value
    .replace(/[$£€¥,]/g, "")
    .replace(/\s+/g, "")
    .replace(/[()]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDirection(value: string | null | undefined): ManualTradeDirection {
  if (!value) return null;
  const normalized = lowerCompact(value);
  if (
    /\b(long|buy|bull|bullish|b)\b/.test(normalized) &&
    !/\b(short|sell|bear|bearish|s)\b/.test(normalized)
  ) {
    return "long";
  }

  if (/\b(short|sell|bear|bearish)\b/.test(normalized)) {
    return "short";
  }

  return null;
}

function isLikelySymbolToken(value: string) {
  const token = value.trim().toUpperCase();
  return (
    /^[A-Z0-9][A-Z0-9._/-]{2,11}$/.test(token) &&
    !/^(SL|TP|RR|PNL|PL|BUY|SELL|LONG|SHORT|OPEN|CLOSE|ENTRY|EXIT|SIZE)$/i.test(
      token
    )
  );
}

function normalizeSymbol(value: string | null | undefined) {
  if (!value) return null;
  const cleaned = value.trim().toUpperCase().replace(/\s+/g, "");
  return cleaned || null;
}

function formatResidualText(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function stripMatchedSegments(text: string, patterns: RegExp[]) {
  let current = text;
  for (const pattern of patterns) {
    current = current.replace(pattern, " ");
  }
  return current.replace(/\s+/g, " ").trim();
}

function detectDelimiter(text: string) {
  const sample = text.split(/\r?\n/).find((line) => line.trim().length > 0);
  if (!sample) return null;
  const candidates = ["\t", "|", ";", ","];
  let best: string | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const score = sample.split(candidate).length - 1;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return bestScore > 0 ? best : null;
}

function splitDelimitedLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells.map((cell) => cell.replace(/^"|"$/g, "").trim());
}

function normalizeHeaderName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function isHeaderRow(cells: string[]) {
  const normalized = cells.map(normalizeHeaderName);
  const hits = normalized.filter((cell) =>
    Object.prototype.hasOwnProperty.call(HEADER_SYNONYMS, cell)
  ).length;
  return hits >= 2;
}

function parseDateTimeCandidate(
  value: string | null | undefined,
  referenceDate: Date
) {
  if (!value) return null;
  const raw = normalizeText(value);
  if (!raw) return null;

  const lowered = raw.toLowerCase();
  const relativeMatch = lowered.match(
    /\b(today|yesterday|tomorrow)\b(?:\s+(?:at)?\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/
  );
  if (relativeMatch) {
    const base = new Date(referenceDate);
    base.setSeconds(0, 0);
    if (relativeMatch[1] === "yesterday") {
      base.setDate(base.getDate() - 1);
    } else if (relativeMatch[1] === "tomorrow") {
      base.setDate(base.getDate() + 1);
    }

    let hour = Number(relativeMatch[2]);
    const minute = Number(relativeMatch[3] || "0");
    const meridiem = relativeMatch[4];
    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    base.setHours(hour, minute, 0, 0);
    return base;
  }

  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  const cleaned = raw
    .replace(/\bat\b/i, " ")
    .replace(/\s+/g, " ")
    .trim();
  const dateTimeMatch = cleaned.match(
    /(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(am|pm))?/i
  );
  if (dateTimeMatch) {
    const [, datePart, hourPart, minutePart, secondPart, meridiem] =
      dateTimeMatch;
    const base = new Date(`${datePart}T00:00:00`);
    if (Number.isNaN(base.getTime())) return null;
    let hour = Number(hourPart);
    if (meridiem?.toLowerCase() === "pm" && hour < 12) hour += 12;
    if (meridiem?.toLowerCase() === "am" && hour === 12) hour = 0;
    base.setHours(hour, Number(minutePart), Number(secondPart || "0"), 0);
    return base;
  }

  return null;
}

function mergeResidualPieces(rawText: string, extracted: string[]) {
  const cleaned = stripMatchedSegments(
    rawText,
    extracted
      .filter(Boolean)
      .map(
        (piece) => new RegExp(piece.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
      )
  );

  return formatResidualText(cleaned);
}

function setField<T>(
  fields: ManualTradeCaptureFields,
  key: FieldKey,
  value: T,
  source: ManualTradeCaptureField<T>["source"],
  confidence: number,
  raw?: string | null
) {
  fields[key] = createField(value, source, confidence, raw) as any;
}

function setDerived<T>(
  derived: ManualTradeCaptureDerivedFields,
  key: keyof ManualTradeCaptureDerivedFields,
  value: T,
  source: ManualTradeCaptureField<T>["source"] = "derived",
  confidence = 100,
  raw?: string | null
) {
  derived[key] = createField(value, source, confidence, raw) as any;
}

function parseKeyValueFields(text: string, fields: ManualTradeCaptureFields) {
  const matchedSegments: string[] = [];
  const patterns: Array<{
    key: FieldKey;
    regex: RegExp;
    transform?: (value: string) => unknown;
  }> = [
    {
      key: "symbol",
      regex: /\b(?:symbol|pair|market)\s*(?:=|:|@)?\s*([A-Za-z0-9._/-]{3,16})/i,
      transform: (value) => normalizeSymbol(value),
    },
    {
      key: "direction",
      regex:
        /\b(?:direction|side|trade\s*type)\s*(?:=|:|@)?\s*(long|short|buy|sell)\b/i,
      transform: (value) => toDirection(value),
    },
    {
      key: "volume",
      regex:
        /\b(?:volume|size|qty|quantity|lots?|contracts?)\s*(?:=|:|@)?\s*([+\-]?\d[\d,]*(?:\.\d+)?)\b/i,
      transform: (value) => toNumber(value),
    },
    {
      key: "openPrice",
      regex:
        /\b(?:open|entry|entryprice|openprice|buyprice|sellprice)\s*(?:=|:|@)?\s*([+\-]?\d[\d,]*(?:\.\d+)?)\b/i,
      transform: (value) => toNumber(value),
    },
    {
      key: "closePrice",
      regex:
        /\b(?:close|exit|exitprice|closeprice)\s*(?:=|:|@)?\s*([+\-]?\d[\d,]*(?:\.\d+)?)\b/i,
      transform: (value) => toNumber(value),
    },
    {
      key: "stopLoss",
      regex:
        /\b(?:sl|stop\s*loss|stoploss)\s*(?:=|:|@)?\s*([+\-]?\d[\d,]*(?:\.\d+)?)\b/i,
      transform: (value) => toNumber(value),
    },
    {
      key: "takeProfit",
      regex:
        /\b(?:tp|take\s*profit|takeprofit|target)\s*(?:=|:|@)?\s*([+\-]?\d[\d,]*(?:\.\d+)?)\b/i,
      transform: (value) => toNumber(value),
    },
    {
      key: "profit",
      regex:
        /\b(?:pnl|profit|pl|net\s*pnl)\s*(?:=|:|@)?\s*([+\-]?\$?\d[\d,]*(?:\.\d+)?)\b/i,
      transform: (value) => toNumber(value),
    },
    {
      key: "commission",
      regex:
        /\b(?:commission|commissions|fee|fees)\s*(?:=|:|@)?\s*([+\-]?\$?\d[\d,]*(?:\.\d+)?)\b/i,
      transform: (value) => toNumber(value),
    },
    {
      key: "swap",
      regex:
        /\b(?:swap|rollover)\s*(?:=|:|@)?\s*([+\-]?\$?\d[\d,]*(?:\.\d+)?)\b/i,
      transform: (value) => toNumber(value),
    },
    {
      key: "openTime",
      regex:
        /\b(?:open(?:ed)?|entry)\s*(?:time|at|on)?\s*(?:=|:|-)?\s*([^\n,|;]+)/i,
      transform: (value) => value.trim(),
    },
    {
      key: "closeTime",
      regex:
        /\b(?:close(?:d)?|exit)\s*(?:time|at|on)?\s*(?:=|:|-)?\s*([^\n,|;]+)/i,
      transform: (value) => value.trim(),
    },
    {
      key: "notes",
      regex: /\b(?:notes?|remarks?|comment)\s*(?:=|:|-)\s*([^\n]+)/i,
      transform: (value) => value.trim(),
    },
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern.regex);
    if (!match) continue;

    matchedSegments.push(match[0]);
    const captured = match[1] ?? "";
    const transformed = pattern.transform
      ? pattern.transform(captured)
      : captured;

    switch (pattern.key) {
      case "symbol":
        setField(
          fields,
          "symbol",
          transformed as string | null,
          "regex",
          92,
          captured
        );
        break;
      case "direction":
        setField(
          fields,
          "direction",
          transformed as ManualTradeDirection,
          "regex",
          92,
          captured
        );
        break;
      case "volume":
      case "openPrice":
      case "closePrice":
      case "stopLoss":
      case "takeProfit":
      case "profit":
      case "commission":
      case "swap":
        setField(
          fields,
          pattern.key,
          transformed as number | null,
          "regex",
          90,
          captured
        );
        break;
      case "openTime":
      case "closeTime":
        setField(
          fields,
          pattern.key,
          parseDateTimeCandidate(captured, new Date()) ?? null,
          "regex",
          86,
          captured
        );
        break;
      case "notes":
        setField(fields, "notes", transformed as string, "regex", 70, captured);
        break;
      default:
        break;
    }
  }

  if (fields.direction.value === null) {
    const direction = toDirection(text);
    if (direction) {
      setField(fields, "direction", direction, "regex", 72, direction);
    }
  }

  if (fields.symbol.value === null) {
    const symbolToken =
      text.split(/\s+/).find((token) => isLikelySymbolToken(token)) ?? null;
    if (symbolToken) {
      setField(
        fields,
        "symbol",
        normalizeSymbol(symbolToken),
        "regex",
        65,
        symbolToken
      );
    }
  }

  if (fields.volume.value === null) {
    const positionalVolume =
      text.match(
        /\b(?:long|short|buy|sell)\b[\s,:-]+(?:[A-Za-z0-9._/-]+\s+)?([+\-]?\d[\d,]*(?:\.\d+)?)\b/i
      )?.[1] ?? null;
    if (positionalVolume) {
      setField(
        fields,
        "volume",
        toNumber(positionalVolume),
        "regex",
        60,
        positionalVolume
      );
    }
  }

  return matchedSegments;
}

function parseDelimitedCaptureRow(
  cells: string[],
  header: string[] | null,
  referenceDate: Date
) {
  const fields = cloneDefaultFields();
  const extracted: string[] = [];

  const assignByHeader = (index: number, cell: string) => {
    if (!header) return false;
    const normalized = normalizeHeaderName(header[index] ?? "");
    const key = HEADER_SYNONYMS[normalized];
    if (!key) return false;

    extracted.push(cell);
    applyCellToField(fields, key, cell, "header", referenceDate);
    return true;
  };

  cells.forEach((cell, index) => {
    if (assignByHeader(index, cell)) {
      return;
    }
    const key = POSitional_KEYS[index];
    if (!key) return;
    extracted.push(cell);
    applyCellToField(fields, key, cell, "positional", referenceDate);
  });

  const sourceKind: ManualTradeCaptureSourceKind = header
    ? "headered-delimited"
    : "delimited";
  return { fields, sourceKind, extracted };
}

function applyCellToField(
  fields: ManualTradeCaptureFields,
  key: FieldKey,
  cell: string,
  source: ManualTradeCaptureField<unknown>["source"],
  referenceDate: Date
) {
  const trimmed = cell.trim();
  if (!trimmed) return;

  switch (key) {
    case "symbol":
      setField(fields, key, normalizeSymbol(trimmed), source, 90, trimmed);
      break;
    case "direction":
      setField(fields, key, toDirection(trimmed), source, 86, trimmed);
      break;
    case "volume":
    case "openPrice":
    case "closePrice":
    case "stopLoss":
    case "takeProfit":
    case "profit":
    case "commission":
    case "swap":
      setField(fields, key, toNumber(trimmed), source, 88, trimmed);
      break;
    case "openTime":
    case "closeTime":
      setField(
        fields,
        key,
        parseDateTimeCandidate(trimmed, referenceDate),
        source,
        90,
        trimmed
      );
      break;
    case "notes":
      setField(fields, key, trimmed, source, 80, trimmed);
      break;
    default:
      break;
  }
}

function deriveCaptureFields(
  fields: ManualTradeCaptureFields,
  options: ManualTradeCaptureParseOptions
) {
  const derived = cloneDefaultDerivedFields();
  const referenceDate = options.referenceDate ?? new Date();
  const symbol = fields.symbol.value;
  const direction = fields.direction.value;
  const openPrice = fields.openPrice.value;
  const closePrice = fields.closePrice.value;
  const stopLoss = fields.stopLoss.value;
  const takeProfit = fields.takeProfit.value;
  const volume = fields.volume.value;
  const profit = fields.profit.value;
  const commission = fields.commission.value;
  const swap = fields.swap.value;
  const openTime = fields.openTime.value;
  const closeTime = fields.closeTime.value;

  const isOpenTrade =
    closePrice == null &&
    closeTime == null &&
    /(?:\bopen\b|\blive\b|\bright now\b|\bcurrently\b)/i.test(
      `${symbol ?? ""} ${fields.notes.value ?? ""}`
    );
  setDerived(derived, "isOpenTrade", isOpenTrade, "derived", 100);

  if (openTime && closeTime) {
    const holdSeconds = Math.max(
      0,
      Math.floor((closeTime.getTime() - openTime.getTime()) / 1000)
    );
    setDerived(derived, "holdSeconds", holdSeconds, "derived", 100);
  }

  if (symbol && openPrice != null && closePrice != null && direction) {
    const pipSize = options.resolvePipSize?.(symbol) ?? null;
    if (pipSize && pipSize > 0) {
      const delta =
        direction === "long" ? closePrice - openPrice : openPrice - closePrice;
      setDerived(derived, "estimatedPips", delta / pipSize, "derived", 100);
    }
  }

  if (symbol && openPrice != null && closePrice != null && volume != null) {
    const contractSize = options.resolveContractSize?.(symbol) ?? null;
    if (contractSize && Number.isFinite(contractSize)) {
      const delta =
        direction === "short" ? openPrice - closePrice : closePrice - openPrice;
      setDerived(
        derived,
        "estimatedProfit",
        delta * volume * contractSize,
        "derived",
        100
      );
    }
  }

  const effectiveProfit = profit ?? derived.estimatedProfit.value;
  if (effectiveProfit != null) {
    const net = effectiveProfit + (commission ?? 0) + (swap ?? 0);
    setDerived(derived, "netPnl", net, "derived", 100);
  }

  if (symbol && openPrice != null && stopLoss != null) {
    const pipSize = options.resolvePipSize?.(symbol) ?? null;
    if (pipSize && pipSize > 0) {
      const riskPips = Math.abs(openPrice - stopLoss) / pipSize;
      setDerived(derived, "riskPips", riskPips, "derived", 100);
    }
  }

  if (symbol && openPrice != null && takeProfit != null) {
    const pipSize = options.resolvePipSize?.(symbol) ?? null;
    if (pipSize && pipSize > 0) {
      const targetPips = Math.abs(takeProfit - openPrice) / pipSize;
      setDerived(derived, "targetPips", targetPips, "derived", 100);
    }
  }

  if (derived.riskPips.value && derived.targetPips.value) {
    const risk = derived.riskPips.value;
    const target = derived.targetPips.value;
    if (risk > 0) {
      setDerived(derived, "plannedRR", target / risk, "derived", 100);
    }
  }

  const residual: string[] = [];
  const noteText = fields.notes.value?.trim();
  if (noteText) {
    residual.push(noteText);
  }

  const confidence = Math.min(
    100,
    Math.round(
      [
        fields.symbol.confidence,
        fields.direction.confidence,
        fields.openPrice.confidence,
        fields.closePrice.confidence,
        fields.volume.confidence,
        fields.openTime.confidence,
        fields.closeTime.confidence,
        derived.estimatedProfit.value != null ? 90 : 0,
        derived.estimatedPips.value != null ? 90 : 0,
      ].reduce((sum, value) => sum + value, 0) / 6
    )
  );

  return {
    fields,
    derived,
    confidence,
    warnings: buildWarnings(fields, derived, referenceDate),
    residualText: residual,
  };
}

function buildWarnings(
  fields: ManualTradeCaptureFields,
  derived: ManualTradeCaptureDerivedFields,
  referenceDate: Date
) {
  const warnings: string[] = [];

  if (!fields.symbol.value) warnings.push("Symbol was not detected.");
  if (!fields.direction.value) warnings.push("Direction was not detected.");
  if (fields.openPrice.value == null)
    warnings.push("Entry price was not detected.");
  if (!derived.isOpenTrade.value && fields.closePrice.value == null) {
    warnings.push("Exit price was not detected.");
  }
  if (fields.openTime.value && fields.closeTime.value) {
    const holdSeconds =
      (fields.closeTime.value.getTime() - fields.openTime.value.getTime()) /
      1000;
    if (holdSeconds < 0) {
      warnings.push("Close time is earlier than open time.");
    }
  }

  if (fields.openTime.value == null && fields.closeTime.value == null) {
    warnings.push("No trade timestamps were detected.");
  } else if (
    fields.openTime.value &&
    Math.abs(fields.openTime.value.getTime() - referenceDate.getTime()) >
      365 * 24 * 3600 * 1000
  ) {
    warnings.push("Detected time is outside the current trading context.");
  }

  return warnings;
}

function parseSingleCapture(
  input: string,
  options: ManualTradeCaptureParseOptions,
  sourceKind: ManualTradeCaptureSourceKind,
  delimiter: string | null,
  headerRow: string[] | null
): ManualTradeCaptureResult {
  const rawText = normalizeText(input);
  const fields = cloneDefaultFields();
  const referenceDate = options.referenceDate ?? new Date();
  const matchedSegments: string[] = [];

  if (delimiter) {
    const lines = rawText
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0);
    const contentLine = lines[0] ?? "";
    const contentCells = splitDelimitedLine(contentLine, delimiter);
    const parsed = parseDelimitedCaptureRow(
      contentCells,
      headerRow,
      referenceDate
    );
    Object.assign(fields, parsed.fields);
    matchedSegments.push(...parsed.extracted);
  } else {
    matchedSegments.push(...parseKeyValueFields(rawText, fields));
  }

  const residualText = mergeResidualPieces(rawText, matchedSegments);
  const derivedResult = deriveCaptureFields(fields, options);
  const sourceConfidence =
    derivedResult.confidence + (residualText.length > 0 ? 0 : 5);

  return {
    kind: "single",
    rawText,
    sourceKind,
    delimiter,
    hasHeader: Boolean(headerRow),
    fields: derivedResult.fields,
    derived: derivedResult.derived,
    confidence: Math.min(100, sourceConfidence),
    warnings: derivedResult.warnings,
    residualText,
  };
}

function looksLikeBulkTable(text: string, delimiter: string | null) {
  if (!delimiter) return false;
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return lines.length > 1 && lines.some((line) => line.includes(delimiter));
}

function parseBulkCapture(
  input: string,
  options: ManualTradeCaptureParseOptions,
  delimiter: string
): ManualTradeCaptureBulkResult {
  const rawText = normalizeText(input);
  const lines = rawText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const headerCells = splitDelimitedLine(lines[0] ?? "", delimiter);
  const hasHeader = isHeaderRow(headerCells);
  const header = hasHeader ? headerCells : [];
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const rows = dataLines
    .map((line) =>
      parseSingleCapture(
        line,
        options,
        hasHeader ? "headered-delimited" : "delimited",
        delimiter,
        hasHeader ? headerCells : null
      )
    )
    .filter((row) => row.rawText.length > 0);

  return {
    kind: "bulk",
    rawText,
    delimiter,
    hasHeader,
    header,
    rows,
    warnings: rows.flatMap((row) => row.warnings),
  };
}

export function parseManualTradeCapture(
  input: string,
  options: ManualTradeCaptureParseOptions = {}
): ManualTradeCaptureResult | ManualTradeCaptureBulkResult {
  const rawText = normalizeText(input);
  const delimiter = detectDelimiter(rawText);

  if (looksLikeBulkTable(rawText, delimiter)) {
    return parseBulkCapture(rawText, options, delimiter!);
  }

  return parseSingleCapture(
    rawText,
    options,
    delimiter ? "delimited" : "free-text",
    delimiter,
    null
  );
}

export function parseManualTradeCaptureBulk(
  input: string,
  options: ManualTradeCaptureParseOptions = {}
): ManualTradeCaptureBulkResult {
  const rawText = normalizeText(input);
  const delimiter = detectDelimiter(rawText) ?? ",";
  return parseBulkCapture(rawText, options, delimiter);
}

export function parseManualTradeCaptureLine(
  line: string,
  options: ManualTradeCaptureParseOptions = {}
) {
  const result = parseManualTradeCapture(line, options);
  if (result.kind === "bulk") {
    return (
      result.rows[0] ??
      parseSingleCapture(line, options, "free-text", null, null)
    );
  }

  return result;
}
