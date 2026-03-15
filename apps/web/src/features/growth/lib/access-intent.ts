"use client";

export const GROWTH_STORAGE_KEYS = {
  betaCode: "pe_beta_code",
  referralCode: "pe_referral_code",
  affiliateCode: "pe_affiliate_code",
  affiliateGroupSlug: "pe_affiliate_group",
} as const;

export type StoredGrowthIntent = {
  betaCode?: string;
  referralCode?: string;
  affiliateCode?: string;
  affiliateGroupSlug?: string;
};

function normalizeGrowthCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeGroupSlug(value: string) {
  return value.trim().toLowerCase();
}

function getStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

export function getStoredGrowthIntent(): StoredGrowthIntent {
  const storage = getStorage();
  if (!storage) {
    return {};
  }

  return {
    betaCode: storage.getItem(GROWTH_STORAGE_KEYS.betaCode) ?? undefined,
    referralCode:
      storage.getItem(GROWTH_STORAGE_KEYS.referralCode) ?? undefined,
    affiliateCode:
      storage.getItem(GROWTH_STORAGE_KEYS.affiliateCode) ?? undefined,
    affiliateGroupSlug:
      storage.getItem(GROWTH_STORAGE_KEYS.affiliateGroupSlug) ?? undefined,
  };
}

export function clearStoredGrowthIntent() {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.removeItem(GROWTH_STORAGE_KEYS.betaCode);
  storage.removeItem(GROWTH_STORAGE_KEYS.referralCode);
  storage.removeItem(GROWTH_STORAGE_KEYS.affiliateCode);
  storage.removeItem(GROWTH_STORAGE_KEYS.affiliateGroupSlug);
}

export function storeBetaCode(value: string) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  const code = normalizeGrowthCode(value);
  if (!code) {
    storage.removeItem(GROWTH_STORAGE_KEYS.betaCode);
    return;
  }

  storage.setItem(GROWTH_STORAGE_KEYS.betaCode, code);
}

export function storeReferralIntent(value: string) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  const code = normalizeGrowthCode(value);
  if (!code) {
    storage.removeItem(GROWTH_STORAGE_KEYS.referralCode);
    return;
  }

  storage.setItem(GROWTH_STORAGE_KEYS.referralCode, code);
  storage.removeItem(GROWTH_STORAGE_KEYS.affiliateCode);
  storage.removeItem(GROWTH_STORAGE_KEYS.affiliateGroupSlug);
}

export function storeAffiliateIntent(codeValue: string, groupSlug?: string | null) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  const code = normalizeGrowthCode(codeValue);
  if (!code) {
    storage.removeItem(GROWTH_STORAGE_KEYS.affiliateCode);
    storage.removeItem(GROWTH_STORAGE_KEYS.affiliateGroupSlug);
    return;
  }

  storage.setItem(GROWTH_STORAGE_KEYS.affiliateCode, code);
  storage.removeItem(GROWTH_STORAGE_KEYS.referralCode);

  const normalizedGroupSlug = groupSlug ? normalizeGroupSlug(groupSlug) : "";
  if (normalizedGroupSlug) {
    storage.setItem(
      GROWTH_STORAGE_KEYS.affiliateGroupSlug,
      normalizedGroupSlug
    );
  } else {
    storage.removeItem(GROWTH_STORAGE_KEYS.affiliateGroupSlug);
  }
}
