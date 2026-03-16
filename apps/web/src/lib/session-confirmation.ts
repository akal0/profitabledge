"use client";

import { authClient } from "@/lib/auth-client";

export const DEFAULT_SESSION_CONFIRM_RETRY_DELAYS_MS = [
  0,
  150,
  350,
  750,
] as const;

export const CHECKOUT_SESSION_CONFIRM_RETRY_DELAYS_MS = [
  0,
  250,
  750,
  1500,
  3000,
] as const;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForConfirmedSession(
  retryDelays: readonly number[] = DEFAULT_SESSION_CONFIRM_RETRY_DELAYS_MS
) {
  for (const delay of retryDelays) {
    if (delay > 0) {
      await sleep(delay);
    }

    const result = await authClient.getSession();
    if (result.data) {
      return true;
    }
  }

  return false;
}
