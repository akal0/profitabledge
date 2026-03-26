export type CurrencySymbol = "$" | "£" | "€";

export function formatDisplayNumber(
  value: number,
  options?: Intl.NumberFormatOptions
): string {
  return value.toLocaleString(undefined, options);
}

export function formatDisplayCurrency(
  value: number,
  currencySymbol: CurrencySymbol = "$",
  options?: Intl.NumberFormatOptions
): string {
  const absoluteValue = Math.abs(value);
  const hasFraction = Math.round(absoluteValue * 100) !== Math.round(absoluteValue) * 100;
  const formattedNumber = formatDisplayNumber(absoluteValue, {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
    ...options,
  });

  return `${value < 0 ? "-" : ""}${currencySymbol}${formattedNumber}`;
}
