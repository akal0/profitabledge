import {
  getAlphaFeatureDisabledMessage,
  resolvePublicAlphaFlags,
  type AlphaFeatureKey,
} from "@profitabledge/platform";

export const publicAlphaFlags = resolvePublicAlphaFlags(process.env);

export function isPublicAlphaFeatureEnabled(feature: AlphaFeatureKey) {
  return Boolean(publicAlphaFlags[feature]);
}

export function getPublicAlphaFeatureDisabledMessage(feature: AlphaFeatureKey) {
  return getAlphaFeatureDisabledMessage(feature);
}
