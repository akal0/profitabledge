"use client";

export const GROWTH_STORAGE_KEYS = {
  referralCode: "pe_referral_code",
  affiliateCode: "pe_affiliate_code",
  affiliateChannel: "pe_affiliate_channel",
} as const;

export type StoredGrowthIntent = {
  referralCode?: string;
  affiliateCode?: string;
  affiliateChannel?: string;
};

function normalizeGrowthCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
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
    referralCode:
      storage.getItem(GROWTH_STORAGE_KEYS.referralCode) ?? undefined,
    affiliateCode:
      storage.getItem(GROWTH_STORAGE_KEYS.affiliateCode) ?? undefined,
    affiliateChannel:
      storage.getItem(GROWTH_STORAGE_KEYS.affiliateChannel) ?? undefined,
  };
}

export function clearStoredGrowthIntent() {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.removeItem(GROWTH_STORAGE_KEYS.referralCode);
  storage.removeItem(GROWTH_STORAGE_KEYS.affiliateCode);
  storage.removeItem(GROWTH_STORAGE_KEYS.affiliateChannel);
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
}

export function storeAffiliateIntent(
  codeValue: string,
  channel?: string | null,
) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  const code = codeValue.trim();
  if (!code) {
    storage.removeItem(GROWTH_STORAGE_KEYS.affiliateCode);
    storage.removeItem(GROWTH_STORAGE_KEYS.affiliateChannel);
    return;
  }

  storage.setItem(GROWTH_STORAGE_KEYS.affiliateCode, code);
  storage.removeItem(GROWTH_STORAGE_KEYS.referralCode);

  const normalizedChannel = channel?.trim().toLowerCase() ?? "";
  if (normalizedChannel) {
    storage.setItem(GROWTH_STORAGE_KEYS.affiliateChannel, normalizedChannel);
  } else {
    storage.removeItem(GROWTH_STORAGE_KEYS.affiliateChannel);
  }
}
