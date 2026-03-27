/**
 * AES-256-GCM symmetric encryption for platform credentials.
 *
 * Required env var: CREDENTIAL_ENCRYPTION_KEY (64-char hex = 32 bytes)
 * Generate with: openssl rand -hex 32
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { getServerEnv } from "../env";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

function normalizeKey(hex: string | undefined, label: string): Buffer {
  if (!hex || hex.length !== 64) {
    throw new Error(
      `${label} must be a 64-character hex string (32 bytes). ` +
        "Generate with: openssl rand -hex 32"
    );
  }
  return Buffer.from(hex, "hex");
}

function getKeyCandidates(): Buffer[] {
  const env = getServerEnv();
  const primaryKey = normalizeKey(
    env.CREDENTIAL_ENCRYPTION_KEY,
    "CREDENTIAL_ENCRYPTION_KEY"
  );
  const fallbackKeys = (env.CREDENTIAL_ENCRYPTION_PREVIOUS_KEYS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value, index) =>
      normalizeKey(
        value,
        `CREDENTIAL_ENCRYPTION_PREVIOUS_KEYS[${index}]`
      )
    );

  return [primaryKey, ...fallbackKeys];
}

function getPrimaryKey(): Buffer {
  const [primaryKey] = getKeyCandidates();
  if (!primaryKey) {
    throw new Error("CREDENTIAL_ENCRYPTION_KEY is not configured");
  }
  return primaryKey;
}

export function encryptCredentials(plaintext: string): {
  encrypted: string;
  iv: string;
} {
  const key = getPrimaryKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    encrypted: Buffer.concat([encrypted, authTag]).toString("base64"),
    iv: iv.toString("base64"),
  };
}

export function decryptCredentials(
  encryptedBase64: string,
  ivBase64: string
): string {
  const iv = Buffer.from(ivBase64, "base64");
  const raw = Buffer.from(encryptedBase64, "base64");

  const ciphertext = raw.subarray(0, raw.length - TAG_BYTES);
  const authTag = raw.subarray(raw.length - TAG_BYTES);
  let lastError: unknown = null;

  for (const key of getKeyCandidates()) {
    try {
      const decipher = createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      return Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]).toString("utf8");
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    lastError instanceof Error
      ? `Unable to decrypt credentials with configured key set: ${lastError.message}`
      : "Unable to decrypt credentials with configured key set."
  );
}
