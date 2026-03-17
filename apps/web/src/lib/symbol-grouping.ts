"use client";

type SymbolGroupLike = {
  symbol?: string | null;
  rawSymbol?: string | null;
  symbolGroup?: string | null;
};

function normalizeSymbolValue(value: string | null | undefined) {
  return String(value || "").trim();
}

export function getSymbolGroupKey(value: SymbolGroupLike) {
  return (
    normalizeSymbolValue(value.symbolGroup) ||
    normalizeSymbolValue(value.rawSymbol) ||
    normalizeSymbolValue(value.symbol) ||
    "Unknown"
  );
}

export function getSymbolGroupLabelCandidate(value: SymbolGroupLike) {
  return (
    normalizeSymbolValue(value.rawSymbol) ||
    normalizeSymbolValue(value.symbol) ||
    getSymbolGroupKey(value)
  );
}

export function createSymbolGroupDisplayMap<T extends SymbolGroupLike>(
  values: T[]
) {
  const labelCountsByGroup = new Map<string, Map<string, number>>();

  for (const value of values) {
    const groupKey = getSymbolGroupKey(value);
    const label = getSymbolGroupLabelCandidate(value);
    const groupLabelCounts = labelCountsByGroup.get(groupKey) ?? new Map();

    groupLabelCounts.set(label, (groupLabelCounts.get(label) ?? 0) + 1);
    labelCountsByGroup.set(groupKey, groupLabelCounts);
  }

  const displayMap = new Map<string, string>();

  for (const [groupKey, labelCounts] of labelCountsByGroup.entries()) {
    const [displayLabel] =
      [...labelCounts.entries()].sort((left, right) => {
        if (right[1] !== left[1]) {
          return right[1] - left[1];
        }

        return left[0].localeCompare(right[0]);
      })[0] ?? [groupKey];

    displayMap.set(groupKey, displayLabel);
  }

  return displayMap;
}
