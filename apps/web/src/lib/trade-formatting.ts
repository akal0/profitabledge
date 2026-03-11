type FormatValueOptions = {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  showPlus?: boolean;
};

function getSafeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function getSign(value: number, showPlus = false): string {
  if (value < 0) return "-";
  if (showPlus && value > 0) return "+";
  return "";
}

export function formatNumberValue(
  value: number,
  {
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
    showPlus = false,
  }: FormatValueOptions = {}
): string {
  const safeValue = getSafeNumber(value);
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(Math.abs(safeValue));

  return `${getSign(safeValue, showPlus)}${formatted}`;
}

export function formatCurrencyValue(
  value: number,
  {
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
    showPlus = false,
  }: FormatValueOptions = {}
): string {
  const safeValue = getSafeNumber(value);
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(Math.abs(safeValue));

  return `${getSign(safeValue, showPlus)}$${formatted}`;
}
