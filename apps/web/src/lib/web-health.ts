import { publicAlphaFlags } from "./alpha-flags";

export function buildWebHealthSnapshot() {
  return {
    status: "ok" as const,
    service: "web" as const,
    timestamp: new Date().toISOString(),
    runtime: {
      nodeEnv: process.env.NODE_ENV ?? "development",
    },
    config: {
      serverUrlConfigured: Boolean(process.env.NEXT_PUBLIC_SERVER_URL),
      webUrlConfigured: Boolean(process.env.NEXT_PUBLIC_WEB_URL),
    },
    flags: publicAlphaFlags,
  };
}
