import { customAlphabet } from "nanoid";

const randomSuffix = customAlphabet("abcdefghjkmnpqrstuvwxyz23456789", 8);

function slugifySegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function buildPublicAccountSlug(accountName: string) {
  const base = slugifySegment(accountName) || "account";
  return `${base}-${randomSuffix()}`;
}

export function buildPublicProofPath(
  username: string,
  publicAccountSlug: string
) {
  return `/${username}/${publicAccountSlug}/trades`;
}
