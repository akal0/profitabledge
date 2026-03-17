"use client";

import { normalizeCurrencyCode } from "@/features/dashboard/widgets/lib/widget-shared";

type CurrencyAccountLike = {
  initialCurrency?: string | null;
};

export function getAvailableDashboardCurrencyCodes(
  accounts: CurrencyAccountLike[] | undefined
) {
  if (!accounts?.length) {
    return [] as string[];
  }

  return Array.from(
    new Set(
      accounts
        .map((account) => normalizeCurrencyCode(account.initialCurrency))
        .filter((currencyCode): currencyCode is string => Boolean(currencyCode))
    )
  ).sort((left, right) => left.localeCompare(right));
}

export function resolveDashboardCurrencyCode(input: {
  isAllAccounts: boolean;
  preferredCurrencyCode?: string | null;
  availableCurrencyCodes?: string[];
  selectedAccountCurrency?: string | null;
}) {
  if (!input.isAllAccounts) {
    return normalizeCurrencyCode(input.selectedAccountCurrency);
  }

  const availableCurrencyCodes = input.availableCurrencyCodes ?? [];
  const preferredCurrencyCode = normalizeCurrencyCode(input.preferredCurrencyCode);

  if (preferredCurrencyCode && availableCurrencyCodes.includes(preferredCurrencyCode)) {
    return preferredCurrencyCode;
  }

  return availableCurrencyCodes[0];
}
