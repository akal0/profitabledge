import { describe, expect, it } from "bun:test";
import {
  activateTab,
  closeTab,
  createInitialDesktopState,
  createTab,
  hydrateDesktopState,
  openTab,
  updateTab,
} from "./desktop-state";
import { parseDesktopDeepLink } from "./deep-links";

describe("desktop-state", () => {
  it("hydrates an empty payload with defaults", () => {
    const state = hydrateDesktopState(null);
    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0]?.path).toBe("/dashboard");
    expect(state.tabs[0]?.kind).toBe("dashboard");
  });

  it("migrates legacy workspace state to a single active tab", () => {
    const state = hydrateDesktopState({
      activeWorkspaceId: "workspace-1",
      workspaces: [
        {
          id: "workspace-1",
          activeTabId: "tab-1",
          tabs: [
            {
              id: "tab-1",
              path: "/dashboard/trades",
              lastKnownPath: "/dashboard/trades?focus=1",
              title: "Trades",
              accountId: "acct_1",
            },
          ],
        },
      ],
    });

    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0]?.path).toBe("/dashboard/trades");
    expect(state.tabs[0]?.lastKnownPath).toBe("/dashboard/trades?focus=1");
    expect(state.tabs[0]?.accountId).toBe("acct_1");
  });

  it("opens, activates, updates, and closes tabs", () => {
    const initial = createInitialDesktopState();
    const reportsTab = createTab("/dashboard/reports", { title: "Reports" });
    const opened = openTab(initial, reportsTab);

    expect(opened.activeTabId).toBe(reportsTab.id);
    expect(opened.tabs).toHaveLength(2);

    const activated = activateTab(opened, initial.tabs[0]!.id);
    expect(activated.activeTabId).toBe(initial.tabs[0]!.id);

    const updated = updateTab(activated, initial.tabs[0]!.id, {
      lastKnownPath: "/dashboard?panel=calendar",
    });
    expect(updated.tabs[0]?.lastKnownPath).toBe("/dashboard?panel=calendar");

    const closed = closeTab(updated, reportsTab.id);
    expect(closed.tabs).toHaveLength(1);
    expect(closed.tabs[0]?.id).toBe(initial.tabs[0]!.id);
  });
});

describe("deep-links", () => {
  it("parses explicit path deep links", () => {
    expect(
      parseDesktopDeepLink(
        "profitabledge://open?path=%2Fdashboard%2Freports&accountId=abc"
      )
    ).toEqual({
      path: "/dashboard/reports",
      accountId: "abc",
      kind: "reports",
    });
  });

  it("parses assistant deep links", () => {
    expect(parseDesktopDeepLink("profitabledge://assistant?accountId=acct_1")).toEqual({
      path: "/assistant?accountId=acct_1",
      accountId: "acct_1",
      kind: "assistant",
    });
  });

  it("preserves route query and hash in fallback deep links", () => {
    expect(
      parseDesktopDeepLink(
        "profitabledge://open/dashboard/reports?focus=1#panel"
      )
    ).toEqual({
      path: "/dashboard/reports?focus=1#panel",
      accountId: null,
      kind: "reports",
    });
  });
});
