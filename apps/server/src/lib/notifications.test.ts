import { describe, expect, it } from "bun:test";

import {
  defaultNotificationPreferences,
  isDesktopNotificationEnabled,
  isDesktopQuietHoursActive,
  mergeNotificationPreferences,
  type NotificationPreferencesInput,
} from "./notifications";

describe("notification preferences", () => {
  it("deep merges nested desktop preferences", () => {
    const input = {
      push: true,
      desktop: {
        closeToTray: false,
        quietHours: {
          enabled: true,
          timezone: "Europe/London",
        },
      },
    } satisfies NotificationPreferencesInput;

    const merged = mergeNotificationPreferences(input);

    expect(merged.push).toBe(true);
    expect(merged.desktop.closeToTray).toBe(false);
    expect(merged.desktop.enabled).toBe(true);
    expect(merged.desktop.quietHours).toEqual({
      enabled: true,
      startHour: defaultNotificationPreferences.desktop.quietHours.startHour,
      endHour: defaultNotificationPreferences.desktop.quietHours.endHour,
      timezone: "Europe/London",
    });
  });

  it("suppresses low priority desktop notifications when high-priority-only is enabled", () => {
    const input = {
      desktop: {
        highPriorityOnly: true,
      },
    } satisfies NotificationPreferencesInput;

    const merged = mergeNotificationPreferences(input);

    expect(isDesktopNotificationEnabled(merged, "trade_closed")).toBe(false);
    expect(isDesktopNotificationEnabled(merged, "alert_triggered")).toBe(true);
  });

  it("detects quiet hours across midnight", () => {
    const input = {
      desktop: {
        quietHours: {
          enabled: true,
          startHour: 22,
          endHour: 7,
          timezone: "UTC",
        },
      },
    } satisfies NotificationPreferencesInput;

    const merged = mergeNotificationPreferences(input);

    expect(
      isDesktopQuietHoursActive(
        merged.desktop,
        new Date("2026-03-30T23:00:00.000Z")
      )
    ).toBe(true);
    expect(
      isDesktopQuietHoursActive(
        merged.desktop,
        new Date("2026-03-30T12:00:00.000Z")
      )
    ).toBe(false);
  });
});
