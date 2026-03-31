import {
  resolveServerAlphaFlags,
  type AlphaFeatureKey,
} from "@profitabledge/platform";

let cachedFlags: ReturnType<typeof resolveServerAlphaFlags> | null = null;

export function getServerAlphaFlags() {
  if (cachedFlags) {
    return cachedFlags;
  }

  cachedFlags = resolveServerAlphaFlags();
  return cachedFlags;
}

export function resetServerAlphaFlagsForTests() {
  cachedFlags = null;
}

export function assertAlphaFeatureEnabled(feature: AlphaFeatureKey) {
  void feature;
}

export function buildAlphaFeatureDisabledResponse(feature: AlphaFeatureKey) {
  void feature;
  return {
    error: null,
  };
}
