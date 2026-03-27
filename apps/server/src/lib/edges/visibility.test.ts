import { describe, expect, test } from "bun:test";

import {
  applyPublicSummaryStatsVisibility,
  buildPublicEdgePath,
  canViewPrivateEdgeActivity,
  canViewPublicEdgePage,
  canViewPublicEdgeStats,
  getEdgeForkDepth,
} from "./visibility";

describe("edge visibility helpers", () => {
  test("hides library stats unless the edge is explicitly public", () => {
    expect(
      canViewPublicEdgeStats({
        publicationMode: "library",
        isFeatured: false,
        publicStatsVisible: false,
      })
    ).toBe(false);

    expect(
      canViewPublicEdgeStats({
        publicationMode: "library",
        isFeatured: false,
        publicStatsVisible: true,
      })
    ).toBe(true);

    expect(
      canViewPublicEdgeStats({
        publicationMode: "private",
        isFeatured: false,
        publicStatsVisible: false,
      })
    ).toBe(true);

    expect(
      canViewPublicEdgeStats({
        publicationMode: "library",
        isFeatured: true,
        publicStatsVisible: false,
      })
    ).toBe(true);
  });

  test("blocks archived and private edges from the public proof route", () => {
    expect(
      canViewPublicEdgePage({
        status: "archived",
        publicationMode: "library",
        isFeatured: true,
      })
    ).toBe(false);

    expect(
      canViewPublicEdgePage({
        status: "active",
        publicationMode: "library",
        isFeatured: false,
      })
    ).toBe(true);

    expect(
      canViewPublicEdgePage({
        status: "active",
        publicationMode: "private",
        isFeatured: true,
      })
    ).toBe(true);

    expect(
      canViewPublicEdgePage({
        status: "active",
        publicationMode: "private",
        isFeatured: false,
      })
    ).toBe(false);
  });

  test("keeps private activity gated to the owner or a direct share", () => {
    expect(
      canViewPrivateEdgeActivity({
        viewerIsOwner: true,
        viewerHasDirectShare: false,
      })
    ).toBe(true);

    expect(
      canViewPrivateEdgeActivity({
        viewerIsOwner: false,
        viewerHasDirectShare: true,
      })
    ).toBe(true);

    expect(
      canViewPrivateEdgeActivity({
        viewerIsOwner: false,
        viewerHasDirectShare: false,
      })
    ).toBe(false);
  });

  test("reduces lineage depth to a binary fork indicator", () => {
    expect(getEdgeForkDepth(null)).toBe(0);
    expect(getEdgeForkDepth(undefined)).toBe(0);
    expect(getEdgeForkDepth("edge_root_123")).toBe(1);
  });

  test("sanitizes hidden public stats while keeping the rest of the shell", () => {
    const summary = {
      publicationMode: "library",
      isFeatured: false,
      publicStatsVisible: false,
      metrics: {
        tradeCount: 24,
      },
      passport: {
        cards: {
          sample: {
            label: "Sample",
            value: "24 trades",
            detail: "Enough",
            tone: "teal",
          },
        },
        fitNotes: [{ label: "Account context", value: "Prop-heavy" }],
        readiness: {
          label: "Ready",
          score: 80,
          note: "Good",
        },
        lineage: {
          forkCount: 2,
          shareCount: 1,
          source: null,
        },
      },
    };

    const sanitized = applyPublicSummaryStatsVisibility(summary);

    expect(sanitized.metrics).toBeNull();
    expect(sanitized.passport?.cards).toBeNull();
    expect(sanitized.passport?.fitNotes).toEqual([]);
    expect(sanitized.passport?.readiness).toBeNull();
    expect(sanitized.passport?.lineage).toEqual(summary.passport.lineage);
  });

  test("keeps visible public stats intact", () => {
    const summary = {
      publicationMode: "library",
      isFeatured: false,
      publicStatsVisible: true,
      metrics: { tradeCount: 24 },
      passport: {
        cards: { sample: { label: "Sample", value: "24 trades", detail: "Enough", tone: "teal" } },
        fitNotes: [{ label: "Account context", value: "Prop-heavy" }],
        readiness: { label: "Ready", score: 80, note: "Good" },
        lineage: { forkCount: 2, shareCount: 1, source: null },
      },
    };

    expect(applyPublicSummaryStatsVisibility(summary)).toBe(summary);
    expect(buildPublicEdgePath("edge_public_123")).toBe("/edge/edge_public_123");
  });
});
