import { describe, expect, test } from "bun:test";

import {
  issuePublicEdgeVerification,
  issuePublicProofVerification,
  issueWidgetShareVerification,
  readVerificationToken,
} from "./share-verification";

describe("share verification tokens", () => {
  test("round-trips a proof verification token", () => {
    const verification = issuePublicProofVerification({
      shareId: "share_test_123",
      username: "trader",
      publicAccountSlug: "alpha-ledger",
      accountName: "Alpha ledger",
      broker: "FTMO",
    });

    const token = verification.path.split("/verify/")[1];
    expect(token).toBeTruthy();

    const parsed = readVerificationToken(token!);
    expect(parsed).not.toBeNull();
    expect(parsed?.r).toBe("proof");
    if (!parsed || parsed.r !== "proof") {
      throw new Error("Expected proof token payload");
    }
    expect(parsed.id).toBe("share_test_123");
  });

  test("round-trips a widget verification token", () => {
    const verification = issueWidgetShareVerification({
      accountId: "account_test_123",
      title: "Trading calendar",
      snapshotKey: "snapshot_test_key",
      accountName: "$200k FTMO",
      broker: "FTMO",
      totalPnl: 10324,
      totalTrades: 218,
    });

    const token = verification.path.split("/verify/")[1];
    expect(token).toBeTruthy();

    const parsed = readVerificationToken(token!);
    expect(parsed).not.toBeNull();
    expect(parsed?.r).toBe("widget");
    if (!parsed || parsed.r !== "widget") {
      throw new Error("Expected widget token payload");
    }
    expect(parsed.wt).toBe("Trading calendar");
    if (parsed.v !== 2) {
      throw new Error("Expected v2 widget token payload");
    }
    expect(parsed.wk).toBe("snapshot_test_key");
    expect(parsed.tt).toBe(218);
  });

  test("round-trips a public edge verification token", () => {
    const verification = issuePublicEdgeVerification({
      edgeId: "edge_test_123",
      username: "trader",
      edgeSlug: "standard-reaccumulation",
      edgeName: "Standard Reaccumulation",
      ownerName: "Trader One",
    });

    const token = verification.path.split("/verify/")[1];
    expect(token).toBeTruthy();

    const parsed = readVerificationToken(token!);
    expect(parsed).not.toBeNull();
    expect(parsed?.r).toBe("edge");
    if (!parsed || parsed.r !== "edge") {
      throw new Error("Expected edge token payload");
    }
    expect(parsed.id).toBe("edge_test_123");
    expect(parsed.s).toBe("standard-reaccumulation");
  });

  test("rejects a tampered verification token", () => {
    const verification = issuePublicProofVerification({
      shareId: "share_test_123",
      username: "trader",
      publicAccountSlug: "alpha-ledger",
    });

    const token = verification.path.split("/verify/")[1];
    const tampered = `${token}x`;

    expect(readVerificationToken(tampered)).toBeNull();
  });
});
