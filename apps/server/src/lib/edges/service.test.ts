import { describe, expect, mock, test } from "bun:test";

type DbQueue = {
  results: unknown[][];
};

function createDbMock(state: DbQueue) {
  const chain = {
    from() {
      return chain;
    },
    where() {
      return chain;
    },
    innerJoin() {
      return chain;
    },
    orderBy() {
      return chain;
    },
    groupBy() {
      return chain;
    },
    values() {
      return chain;
    },
    set() {
      return chain;
    },
    onConflictDoUpdate() {
      return chain;
    },
    limit() {
      return Promise.resolve((state.results.shift() ?? []) as never[]);
    },
    returning() {
      return Promise.resolve((state.results.shift() ?? []) as never[]);
    },
  };

  return {
    db: {
      select() {
        return chain;
      },
      insert() {
        return chain;
      },
      update() {
        return chain;
      },
      delete() {
        return chain;
      },
    },
  };
}

const dbState: DbQueue = {
  results: [],
};

mock.module("../../db", () => createDbMock(dbState));

const { getAccessibleEdgeById } = await import("./service");

describe("edge access lookups", () => {
  test("returns an owned edge even when it is private", async () => {
    const ownedEdge: any = {
      id: "edge-owned",
      ownerUserId: "user-1",
      publicationMode: "private",
      name: "Owned edge",
      publicStatsVisible: false,
    };

    dbState.results = [[ownedEdge]];

    const result = await getAccessibleEdgeById("user-1", "edge-owned");

    expect(result).toEqual(ownedEdge);
    expect(dbState.results).toHaveLength(0);
  });

  test("returns a library edge for a non-owner viewer", async () => {
    const libraryEdge: any = {
      id: "edge-library",
      ownerUserId: "user-2",
      publicationMode: "library",
      name: "Library edge",
      publicStatsVisible: true,
    };

    dbState.results = [[libraryEdge]];

    const result = await getAccessibleEdgeById("viewer-1", "edge-library");

    expect(result).toEqual(libraryEdge);
    expect(dbState.results).toHaveLength(0);
  });

  test("falls back to a direct share when ownership and library access are absent", async () => {
    const sharedEdge: any = {
      id: "edge-shared",
      ownerUserId: "user-2",
      sourceEdgeId: "edge-root",
      publicationMode: "private",
      name: "Shared edge",
      publicStatsVisible: false,
    };

    dbState.results = [[], [sharedEdge]];

    const result = await getAccessibleEdgeById("viewer-1", "edge-shared");

    expect(result).toEqual(sharedEdge);
    expect(dbState.results).toHaveLength(0);
  });

  test("returns null when the edge is neither owned nor shared", async () => {
    dbState.results = [[], []];

    const result = await getAccessibleEdgeById("viewer-1", "edge-hidden");

    expect(result).toBeNull();
    expect(dbState.results).toHaveLength(0);
  });
});
