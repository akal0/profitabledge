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

export const SESSION_CONFIRM_REQUEST_TIMEOUT_MS = 1200;
const SESSION_CONFIRM_TIMEOUT = Symbol("session-confirm-timeout");

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getSessionWithinTimeout(
  timeoutMs = SESSION_CONFIRM_REQUEST_TIMEOUT_MS
) {
  try {
    return await Promise.race([
      authClient.getSession(),
      sleep(timeoutMs).then(() => SESSION_CONFIRM_TIMEOUT),
    ]);
  } catch {
    return SESSION_CONFIRM_TIMEOUT;
  }
}

export async function waitForConfirmedSession(
  retryDelays: readonly number[] = DEFAULT_SESSION_CONFIRM_RETRY_DELAYS_MS
) {
  for (const delay of retryDelays) {
    if (delay > 0) {
      await sleep(delay);
    }

    const result = await getSessionWithinTimeout();
    if (
      result !== SESSION_CONFIRM_TIMEOUT &&
      typeof result === "object" &&
      result !== null &&
      "data" in result &&
      result.data
    ) {
      return true;
    }
  }

  return false;
}
