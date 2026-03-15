import {
  getAlphaFeatureDisabledMessage,
  resolveServerAlphaFlags,
  type AlphaFeatureKey,
} from "@profitabledge/platform";
import { TRPCError } from "@trpc/server";
import { getServerEnv } from "../env";

let cachedFlags: ReturnType<typeof resolveServerAlphaFlags> | null = null;

export function getServerAlphaFlags() {
  if (cachedFlags) {
    return cachedFlags;
  }

  getServerEnv();
  cachedFlags = resolveServerAlphaFlags(process.env);
  return cachedFlags;
}

export function resetServerAlphaFlagsForTests() {
  cachedFlags = null;
}

export function assertAlphaFeatureEnabled(feature: AlphaFeatureKey) {
  const flags = getServerAlphaFlags();
  if (flags[feature]) {
    return;
  }

  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message: getAlphaFeatureDisabledMessage(feature),
  });
}

export function buildAlphaFeatureDisabledResponse(feature: AlphaFeatureKey) {
  return {
    error: getAlphaFeatureDisabledMessage(feature),
  };
}
