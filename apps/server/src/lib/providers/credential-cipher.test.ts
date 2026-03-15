import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { resetServerEnvForTests } from "../env";
import { decryptCredentials, encryptCredentials } from "./credential-cipher";

const ORIGINAL_ENV = { ...process.env };
const TEST_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("credential-cipher", () => {
  beforeEach(() => {
    process.env.CREDENTIAL_ENCRYPTION_KEY = TEST_KEY;
    resetServerEnvForTests();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetServerEnvForTests();
  });

  it("round-trips encrypted platform credentials", () => {
    const payload = JSON.stringify({
      login: "123456",
      password: "super-secret",
      server: "Broker-Demo",
    });

    const encrypted = encryptCredentials(payload);
    const decrypted = decryptCredentials(encrypted.encrypted, encrypted.iv);

    expect(decrypted).toBe(payload);
  });
});
