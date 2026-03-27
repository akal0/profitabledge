const AUTH_USERNAME_PATTERN = /^[a-z0-9._-]+$/;

export function normalizeAuthUsername(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/^[._-]+|[._-]+$/g, "");
}

export function isValidNormalizedAuthUsername(value: string) {
  return AUTH_USERNAME_PATTERN.test(value);
}
