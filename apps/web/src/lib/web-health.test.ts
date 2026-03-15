import { describe, expect, it } from "bun:test";

import { buildWebHealthSnapshot } from "./web-health";

describe("buildWebHealthSnapshot", () => {
  it("returns a usable public health snapshot", () => {
    const snapshot = buildWebHealthSnapshot();

    expect(snapshot.status).toBe("ok");
    expect(snapshot.service).toBe("web");
    expect(typeof snapshot.config.serverUrlConfigured).toBe("boolean");
    expect(typeof snapshot.flags.backtest).toBe("boolean");
  });
});
