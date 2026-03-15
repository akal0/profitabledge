import { createHash } from "node:crypto";

export function buildTrackRecordShareId(accountId: string) {
  const encoded = Buffer.from(accountId, "utf8").toString("base64url");
  const signature = createHash("sha256")
    .update(`track-record:${accountId}`)
    .digest("hex")
    .slice(0, 10);
  return `${encoded}.${signature}`;
}

export function readTrackRecordAccountId(shareId: string) {
  const [encodedAccountId, signature] = shareId.split(".");
  if (!encodedAccountId || !signature) return null;

  try {
    const accountId = Buffer.from(encodedAccountId, "base64url").toString(
      "utf8"
    );
    if (!accountId) return null;
    return buildTrackRecordShareId(accountId) === shareId ? accountId : null;
  } catch {
    return null;
  }
}

export function buildTrackRecordVerificationHash(input: {
  accountId: string;
  totalTrades: number;
  totalPnl: number;
}) {
  return createHash("sha256")
    .update(
      `${input.accountId}:${input.totalTrades}:${input.totalPnl.toFixed(2)}`
    )
    .digest("hex")
    .slice(0, 16);
}
