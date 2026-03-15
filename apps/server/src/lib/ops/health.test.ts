import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { resetServerEnvForTests } from "../env";
import { resetServerAlphaFlagsForTests } from "./alpha-runtime";
import { buildServerHealthSnapshot } from "./health";

const ORIGINAL_ENV = { ...process.env };

describe("buildServerHealthSnapshot", () => {
  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      DATABASE_URL:
        ORIGINAL_ENV.DATABASE_URL ||
        "postgresql://postgres:postgres@localhost:5432/profitabledge",
      BETTER_AUTH_SECRET: "test-auth-secret",
      BETTER_AUTH_URL: "http://127.0.0.1:3000",
      CREDENTIAL_ENCRYPTION_KEY:
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      BROKER_WORKER_SECRET: "worker-secret",
      UPLOADTHING_TOKEN: "uploadthing-token",
      ALPHA_SUPPORT_EMAIL: "support@example.com",
    };
    resetServerEnvForTests();
    resetServerAlphaFlagsForTests();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetServerEnvForTests();
    resetServerAlphaFlagsForTests();
  });

  it("returns a stable server health snapshot", () => {
    const snapshot = buildServerHealthSnapshot();

    expect(snapshot.status).toBe("ok");
    expect(snapshot.service).toBe("server");
    expect(snapshot.config.databaseConfigured).toBe(true);
    expect(snapshot.config.authConfigured).toBe(true);
    expect(snapshot.config.supportEmail).toBe("support@example.com");
    expect(snapshot.flags.feedback).toBe(true);
    expect(typeof snapshot.uptimeSeconds).toBe("number");
  });
});
