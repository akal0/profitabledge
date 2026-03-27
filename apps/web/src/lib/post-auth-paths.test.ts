import { describe, expect, it } from "bun:test";

import {
  buildPostAuthContinuePath,
  buildPostLoginPath,
  buildTwoFactorPath,
} from "./post-auth-paths";

describe("post-auth paths", () => {
  it("keeps login redirects off onboarding", () => {
    expect(buildPostLoginPath("/onboarding")).toBe("/dashboard");
    expect(buildPostLoginPath("/onboarding?step=2")).toBe("/dashboard");
  });

  it("preserves non-onboarding login targets", () => {
    expect(buildPostLoginPath("/dashboard/journal")).toBe(
      "/dashboard/journal"
    );
  });

  it("keeps sign-up redirects on continue", () => {
    expect(buildPostAuthContinuePath("/dashboard/journal")).toBe(
      "/continue?returnTo=%2Fdashboard%2Fjournal"
    );
  });

  it("preserves the target while routing through two-factor verification", () => {
    expect(buildTwoFactorPath("/dashboard/journal")).toBe(
      "/login/two-factor?returnTo=%2Fdashboard%2Fjournal"
    );
  });
});
