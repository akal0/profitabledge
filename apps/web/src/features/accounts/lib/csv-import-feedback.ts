type CsvImportFeedback = {
  noNewData: boolean;
  tradesUpdated: number;
  tradesCreated: number;
  suppressedDeletedTrades?: number;
  accountMetadataUpdated?: boolean;
};

const formatTradeCount = (count: number) =>
  `${count} trade${count === 1 ? "" : "s"}`;

const formatSuppressedDeletedTrades = (count: number) =>
  count > 0
    ? ` ${formatTradeCount(count)} previously deleted in the platform ${count === 1 ? "was" : "were"} skipped.`
    : "";

export function getCsvImportFeedbackMessage(
  result: CsvImportFeedback,
  options?: { accountName?: string | null }
) {
  const accountSuffix = options?.accountName ? ` to ${options.accountName}` : "";
  const suppressedSuffix = formatSuppressedDeletedTrades(
    result.suppressedDeletedTrades ?? 0
  );

  if (result.noNewData) {
    return result.suppressedDeletedTrades
      ? `No new trades imported.${suppressedSuffix}`
      : "No new data to import.";
  }

  if (
    result.accountMetadataUpdated &&
    result.tradesCreated === 0 &&
    result.tradesUpdated === 0
  ) {
    return "Account metadata refreshed from the uploaded files.";
  }

  if (result.tradesCreated > 0) {
    return `${formatTradeCount(result.tradesUpdated)} updated and ${formatTradeCount(
      result.tradesCreated
    )} added${accountSuffix}.${suppressedSuffix}`;
  }

  return `${formatTradeCount(result.tradesUpdated)} updated${accountSuffix}.${suppressedSuffix}`;
}
