import { resolvePublicAlphaFlags, type AlphaFeatureKey } from "@profitabledge/platform";

export const publicAlphaFlags = resolvePublicAlphaFlags();

export function isPublicAlphaFeatureEnabled(feature: AlphaFeatureKey) {
  return Boolean(publicAlphaFlags[feature]);
}

export function getPublicAlphaFeatureDisabledMessage(feature: AlphaFeatureKey) {
  return `${feature} is enabled.`;
}
