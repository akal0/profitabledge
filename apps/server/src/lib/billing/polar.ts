import { Polar } from "@polar-sh/sdk";
import { TRPCError } from "@trpc/server";
import { getServerEnv } from "../env";

let cachedPolar: Polar | null = null;

export function getPolarClient() {
  if (cachedPolar) {
    return cachedPolar;
  }

  const env = getServerEnv();
  if (!env.POLAR_ACCESS_TOKEN) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Polar is not configured",
    });
  }

  cachedPolar = new Polar({
    accessToken: env.POLAR_ACCESS_TOKEN,
    server: env.POLAR_SERVER ?? "production",
  });

  return cachedPolar;
}

export function getPolarWebhookSecret() {
  const env = getServerEnv();
  if (!env.POLAR_WEBHOOK_SECRET) {
    throw new Error("POLAR_WEBHOOK_SECRET is not configured");
  }

  return env.POLAR_WEBHOOK_SECRET;
}

export function resetPolarClientForTests() {
  cachedPolar = null;
}
