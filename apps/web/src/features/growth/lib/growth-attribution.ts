export const GROWTH_VISITOR_COOKIE = "pe_growth_visitor";
export const GROWTH_TOUCH_COOKIE = "pe_growth_touch";
export const GROWTH_TOUCH_WINDOW_DAYS = 180;
export const GROWTH_TOUCH_MAX_AGE_SECONDS =
  GROWTH_TOUCH_WINDOW_DAYS * 24 * 60 * 60;

export type GrowthTouchPayload = {
  type: "affiliate" | "referral";
  code: string;
  offerCode?: string;
  channel?: string;
  trackingLinkSlug?: string;
  landingPath?: string;
  query?: string;
};

export type StoredGrowthTouch = GrowthTouchPayload & {
  visitorToken: string;
  capturedAtISO: string;
};

type ComparableGrowthTouch = GrowthTouchPayload | StoredGrowthTouch;

function normalizeGrowthCode(value: string | null) {
  return (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeSlug(value: string | null) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function readGrowthTouchFromSearchParams(
  searchParams: URLSearchParams,
  pathname?: string | null
) {
  const affiliateCode = searchParams.get("aff")?.trim() || "";
  const referralCode = normalizeGrowthCode(searchParams.get("ref"));
  const offerCode = normalizeGrowthCode(
    searchParams.get("offer") ?? searchParams.get("code")
  );
  const channel = searchParams.get("channel")?.trim().toLowerCase() || "";
  const trackingLinkSlug = normalizeSlug(searchParams.get("link"));

  if (!affiliateCode && !referralCode && !offerCode) {
    return null;
  }

  if (affiliateCode) {
    return {
      type: "affiliate" as const,
      code: affiliateCode,
      offerCode: offerCode || undefined,
      channel: channel || undefined,
      trackingLinkSlug: trackingLinkSlug || undefined,
      landingPath: pathname ?? undefined,
      query: searchParams.toString() || undefined,
    };
  }

  if (referralCode) {
    return {
      type: "referral" as const,
      code: referralCode,
      landingPath: pathname ?? undefined,
      query: searchParams.toString() || undefined,
    };
  }

  if (offerCode) {
    return {
      type: "affiliate" as const,
      code: "",
      offerCode,
      channel: channel || undefined,
      trackingLinkSlug: trackingLinkSlug || undefined,
      landingPath: pathname ?? undefined,
      query: searchParams.toString() || undefined,
    };
  }

  return null;
}

export function buildStoredGrowthTouch(
  visitorToken: string,
  touch: GrowthTouchPayload
): StoredGrowthTouch {
  return {
    ...touch,
    visitorToken,
    capturedAtISO: new Date().toISOString(),
  };
}

export function serializeStoredGrowthTouch(value: StoredGrowthTouch) {
  return encodeURIComponent(JSON.stringify(value));
}

function toComparableGrowthTouchKey(value: ComparableGrowthTouch) {
  return JSON.stringify({
    type: value.type,
    code: value.code ?? "",
    offerCode: value.offerCode ?? "",
    channel: value.channel ?? "",
    trackingLinkSlug: value.trackingLinkSlug ?? "",
    landingPath: value.landingPath ?? "",
    query: value.query ?? "",
  });
}

export function areGrowthTouchesEquivalent(
  left?: ComparableGrowthTouch | null,
  right?: ComparableGrowthTouch | null
) {
  if (!left || !right) {
    return false;
  }

  return toComparableGrowthTouchKey(left) === toComparableGrowthTouchKey(right);
}

export function parseStoredGrowthTouch(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as StoredGrowthTouch;
    if (!parsed?.type || !parsed.visitorToken || !parsed.capturedAtISO) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function readCookie(name: string) {
  if (typeof document === "undefined") {
    return null;
  }

  const prefix = `${name}=`;
  const value = document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(prefix));

  return value ? decodeURIComponent(value.slice(prefix.length)) : null;
}
