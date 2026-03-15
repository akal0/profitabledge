import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { resetServerEnvForTests } from "../env";
import {
  getServerAlphaFlags,
  resetServerAlphaFlagsForTests,
} from "./alpha-runtime";

const ORIGINAL_ENV = { ...process.env };

describe("alpha-runtime", () => {
  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      DATABASE_URL:
        ORIGINAL_ENV.DATABASE_URL ||
        "postgresql://postgres:postgres@localhost:5432/profitabledge",
    };
    resetServerEnvForTests();
    resetServerAlphaFlagsForTests();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetServerEnvForTests();
    resetServerAlphaFlagsForTests();
  });

  it("uses default alpha flags when no override is present", () => {
    const flags = getServerAlphaFlags();

    expect(flags.aiAssistant).toBe(true);
    expect(flags.community).toBe(false);
    expect(flags.feedback).toBe(true);
  });

  it("honors server-side kill switches", () => {
    process.env.ALPHA_ENABLE_CONNECTIONS = "false";
    process.env.ALPHA_ENABLE_MT5_INGESTION = "0";
    resetServerEnvForTests();
    resetServerAlphaFlagsForTests();

    const flags = getServerAlphaFlags();

    expect(flags.connections).toBe(false);
    expect(flags.mt5Ingestion).toBe(false);
  });
});
