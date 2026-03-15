import { describe, expect, test } from "bun:test";

import {
  buildTrackRecordShareId,
  readTrackRecordAccountId,
} from "./track-record-links";

describe("track record share ids", () => {
  test("round-trips a valid account id", () => {
    const accountId = "acc_test_123";
    const shareId = buildTrackRecordShareId(accountId);

    expect(readTrackRecordAccountId(shareId)).toBe(accountId);
  });

  test("rejects a tampered share id", () => {
    const shareId = buildTrackRecordShareId("acc_test_123");
    const tampered = `${shareId}x`;

    expect(readTrackRecordAccountId(tampered)).toBeNull();
  });
});
