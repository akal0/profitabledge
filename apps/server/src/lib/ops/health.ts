import { getServerEnv } from "../env";
import { getServerAlphaFlags } from "./alpha-runtime";

const SERVER_BOOTED_AT = new Date();

function asIso(value: Date) {
  return value.toISOString();
}

export function buildServerHealthSnapshot() {
  const env = getServerEnv();
  const flags = getServerAlphaFlags();

  return {
    status: "ok" as const,
    service: "server" as const,
    timestamp: asIso(new Date()),
    bootedAt: asIso(SERVER_BOOTED_AT),
    uptimeSeconds: Math.floor(process.uptime()),
    runtime: {
      nodeEnv: process.env.NODE_ENV ?? "development",
      pid: process.pid,
    },
    config: {
      databaseConfigured: Boolean(env.DATABASE_URL),
      authConfigured: Boolean(env.BETTER_AUTH_SECRET && env.BETTER_AUTH_URL),
      credentialEncryptionConfigured: Boolean(env.CREDENTIAL_ENCRYPTION_KEY),
      workerSecretConfigured: Boolean(env.BROKER_WORKER_SECRET),
      uploadthingConfigured: Boolean(env.UPLOADTHING_TOKEN),
      aiConfigured: Boolean(
        env.GEMINI_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY
      ),
      supportEmail: env.ALPHA_SUPPORT_EMAIL ?? "support@profitabledge.com",
    },
    flags,
  };
}
