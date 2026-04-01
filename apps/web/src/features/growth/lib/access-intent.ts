"use client";

import {
  GROWTH_TOUCH_WINDOW_DAYS,
  GROWTH_VISITOR_COOKIE,
  readCookie,
} from "./growth-attribution";

export const GROWTH_STORAGE_KEYS = {
  referralCode: "pe_referral_code",
  affiliateCode: "pe_affiliate_code",
  affiliateChannel: "pe_affiliate_channel",
  touch: "pe_growth_intent_v2",
} as const;

export type StoredGrowthIntent = {
  type: "affiliate" | "referral";
  code: string;
  offerCode?: string;
  channel?: string;
  trackingLinkSlug?: string;
  affiliateGroupSlug?: string;
  visitorToken?: string;
  capturedAtISO: string;
};

function normalizeGrowthCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeSlug(value?: string | null) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

function persistStoredGrowthIntent(intent: StoredGrowthIntent | null) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  if (!intent) {
    storage.removeItem(GROWTH_STORAGE_KEYS.touch);
    storage.removeItem(GROWTH_STORAGE_KEYS.referralCode);
    storage.removeItem(GROWTH_STORAGE_KEYS.affiliateCode);
    storage.removeItem(GROWTH_STORAGE_KEYS.affiliateChannel);
    return;
  }

  storage.setItem(GROWTH_STORAGE_KEYS.touch, JSON.stringify(intent));
  if (intent.type === "referral") {
    storage.setItem(GROWTH_STORAGE_KEYS.referralCode, intent.code);
    storage.removeItem(GROWTH_STORAGE_KEYS.affiliateCode);
    storage.removeItem(GROWTH_STORAGE_KEYS.affiliateChannel);
    return;
  }

  storage.setItem(GROWTH_STORAGE_KEYS.affiliateCode, intent.code);
  storage.removeItem(GROWTH_STORAGE_KEYS.referralCode);
  if (intent.channel) {
    storage.setItem(GROWTH_STORAGE_KEYS.affiliateChannel, intent.channel);
  } else {
    storage.removeItem(GROWTH_STORAGE_KEYS.affiliateChannel);
  }
}

function parseStoredGrowthIntent(value: string | null): StoredGrowthIntent | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as StoredGrowthIntent;
    if (
      (parsed?.type !== "affiliate" && parsed?.type !== "referral") ||
      !parsed.capturedAtISO
    ) {
      return null;
    }

    const normalizedCode =
      parsed.type === "referral"
        ? normalizeGrowthCode(parsed.code ?? "")
        : (parsed.code ?? "").trim();
    const normalizedOfferCode = parsed.offerCode
      ? normalizeGrowthCode(parsed.offerCode)
      : undefined;
    if (!normalizedCode && !(parsed.type === "affiliate" && normalizedOfferCode)) {
      return null;
    }

    const capturedAt = new Date(parsed.capturedAtISO);
    if (Number.isNaN(capturedAt.getTime())) {
      return null;
    }

    return {
      type: parsed.type,
      code: normalizedCode,
      offerCode: normalizedOfferCode,
      channel: parsed.channel?.trim().toLowerCase() || undefined,
      trackingLinkSlug: normalizeSlug(parsed.trackingLinkSlug) || undefined,
      affiliateGroupSlug: normalizeSlug(parsed.affiliateGroupSlug) || undefined,
      visitorToken: parsed.visitorToken?.trim() || undefined,
      capturedAtISO: capturedAt.toISOString(),
    };
  } catch {
    return null;
  }
}

export function isGrowthIntentExpired(
  intent: Pick<StoredGrowthIntent, "capturedAtISO">,
  now = new Date()
) {
  const capturedAt = new Date(intent.capturedAtISO);
  if (Number.isNaN(capturedAt.getTime())) {
    return true;
  }

  return (
    now.getTime() - capturedAt.getTime() >
    GROWTH_TOUCH_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );
}

export function getStoredGrowthIntent(): StoredGrowthIntent | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  const parsed = parseStoredGrowthIntent(storage.getItem(GROWTH_STORAGE_KEYS.touch));
  if (parsed) {
    if (isGrowthIntentExpired(parsed)) {
      persistStoredGrowthIntent(null);
      return null;
    }

    return parsed;
  }

  const hasLegacyState = Boolean(
    storage.getItem(GROWTH_STORAGE_KEYS.referralCode) ||
      storage.getItem(GROWTH_STORAGE_KEYS.affiliateCode) ||
      storage.getItem(GROWTH_STORAGE_KEYS.affiliateChannel)
  );
  if (hasLegacyState) {
    persistStoredGrowthIntent(null);
  }

  return null;
}

export function clearStoredGrowthIntent() {
  persistStoredGrowthIntent(null);
}

export function storeGrowthIntent(
  value:
    | {
        type: "referral";
        code: string;
        visitorToken?: string | null;
      }
    | {
        type: "affiliate";
        code?: string | null;
        offerCode?: string | null;
        channel?: string | null;
        trackingLinkSlug?: string | null;
        affiliateGroupSlug?: string | null;
        visitorToken?: string | null;
      }
) {
  const normalizedCode =
    value.type === "referral"
      ? normalizeGrowthCode(value.code)
      : value.code?.trim() ?? "";
  const normalizedOfferCode =
    value.type === "affiliate" && value.offerCode
      ? normalizeGrowthCode(value.offerCode)
      : undefined;

  if (!normalizedCode && !(value.type === "affiliate" && normalizedOfferCode)) {
    persistStoredGrowthIntent(null);
    return;
  }

  persistStoredGrowthIntent({
    type: value.type,
    code: normalizedCode,
    offerCode: normalizedOfferCode,
    channel:
      value.type === "affiliate"
        ? value.channel?.trim().toLowerCase() || undefined
        : undefined,
    trackingLinkSlug:
      value.type === "affiliate"
        ? normalizeSlug(value.trackingLinkSlug) || undefined
        : undefined,
    affiliateGroupSlug:
      value.type === "affiliate"
        ? normalizeSlug(value.affiliateGroupSlug) || undefined
        : undefined,
    visitorToken:
      value.visitorToken?.trim() || readCookie(GROWTH_VISITOR_COOKIE) || undefined,
    capturedAtISO: new Date().toISOString(),
  });
}

export function storeReferralIntent(
  value: string,
  options?: { visitorToken?: string | null }
) {
  const code = normalizeGrowthCode(value);
  if (!code) {
    persistStoredGrowthIntent(null);
    return;
  }

  storeGrowthIntent({
    type: "referral",
    code,
    visitorToken: options?.visitorToken,
  });
}

export function storeAffiliateIntent(
  codeValue: string,
  channel?: string | null,
  options?: {
    offerCode?: string | null;
    trackingLinkSlug?: string | null;
    affiliateGroupSlug?: string | null;
    visitorToken?: string | null;
  }
) {
  const code = codeValue.trim();
  if (!code) {
    persistStoredGrowthIntent(null);
    return;
  }

  storeGrowthIntent({
    type: "affiliate",
    code,
    channel,
    offerCode: options?.offerCode,
    trackingLinkSlug: options?.trackingLinkSlug,
    affiliateGroupSlug: options?.affiliateGroupSlug,
    visitorToken: options?.visitorToken,
  });
}
