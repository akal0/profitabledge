import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { resetServerEnvForTests } from "../env";
import { assertWorkerSecret } from "./worker-control";

const ORIGINAL_ENV = { ...process.env };

describe("assertWorkerSecret", () => {
  beforeEach(() => {
    process.env.BROKER_WORKER_SECRET = "worker-secret";
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@localhost:5432/profitabledge";
    resetServerEnvForTests();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetServerEnvForTests();
  });

  it("accepts the configured worker secret", () => {
    expect(() => assertWorkerSecret("worker-secret")).not.toThrow();
  });

  it("rejects an invalid worker secret", () => {
    expect(() => assertWorkerSecret("wrong-secret")).toThrow("Invalid worker secret");
  });
});
