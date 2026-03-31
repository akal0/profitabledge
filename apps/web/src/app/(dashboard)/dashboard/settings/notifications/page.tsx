"use client";

import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Bell,
  Target,
  AlertTriangle,
  Users,
  Newspaper,
  Settings,
  Activity,
  Monitor,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { trpcOptions, queryClient } from "@/utils/trpc";
import { publicAlphaFlags } from "@/lib/alpha-flags";
import {
  ensureWebPushSubscription,
  removeWebPushSubscription,
} from "@/lib/push-notifications";
import { useEffect } from "react";

export default function NotificationsSettingsPage() {
  const { data: preferences } = useQuery(
    trpcOptions.notifications.getPreferences.queryOptions()
  );
  const { data: deliveryHealth } = useQuery(
    trpcOptions.notifications.getDeliveryHealth.queryOptions()
  );
  const showSocialNotifications = publicAlphaFlags.community;
  const isDesktopShell =
    typeof window !== "undefined" &&
    (window.parent !== window || "__TAURI_INTERNALS__" in window);

  const formatHealthTimestamp = (value?: string | Date | null) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString();
  };

  const updatePreferences = useMutation({
    ...trpcOptions.notifications.updatePreferences.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [["notifications", "getPreferences"]],
      });
    },
  });

  const handleToggle = async (key: string, nextValue: boolean) => {
    if (key === "push" && nextValue && typeof Notification !== "undefined") {
      try {
        const subscribed = await ensureWebPushSubscription();
        if (!subscribed) {
          toast.error("Desktop notifications were blocked.");
          return;
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to enable push notifications"
        );
        return;
      }
    }

    if (key === "push" && !nextValue) {
      try {
        await removeWebPushSubscription();
      } catch {
        // Keep preference update available even if browser cleanup fails.
      }
    }

    try {
      await updatePreferences.mutateAsync({ [key]: nextValue });
      toast.success("Notification settings updated");
    } catch (error: any) {
      toast.error(error.message || "Failed to update notification settings");
    }
  };

  const handleDesktopToggle = async (key: string, nextValue: boolean) => {
    try {
      await updatePreferences.mutateAsync({
        desktop: {
          [key]: nextValue,
        },
      });
      toast.success("Desktop notification settings updated");
    } catch (error: any) {
      toast.error(error.message || "Failed to update desktop settings");
    }
  };

  const handleQuietHoursUpdate = async (
    key: string,
    nextValue: boolean | number
  ) => {
    try {
      await updatePreferences.mutateAsync({
        desktop: {
          quietHours: {
            [key]: nextValue,
          },
        },
      });
      toast.success("Quiet hours updated");
    } catch (error: any) {
      toast.error(error.message || "Failed to update quiet hours");
    }
  };

  useEffect(() => {
    if (!preferences?.push) return;

    void ensureWebPushSubscription().catch(() => {
      // Silent background re-subscribe for existing enabled users.
    });
  }, [preferences?.push]);

  return (
    <div className="flex flex-col w-full">
      {/* Notification Channels heading */}
      <div className="px-6 sm:px-8 py-5">
        <h2 className="text-sm font-semibold text-white">
          Notification channels
        </h2>
        <p className="mt-0.5 w-max text-xs text-white/40">
          Choose how you receive notifications.
        </p>
      </div>

      <Separator />

      {/* In-App */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-center gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">In-app</Label>
          <p className="mt-0.5 w-max text-xs text-white/40">
            Notification hub and in-app toast fallback.
          </p>
        </div>
        <div className="flex justify-end">
          <Switch
            checked={preferences?.inApp ?? true}
            onCheckedChange={(next) => handleToggle("inApp", next)}
            disabled={updatePreferences.isPending}
            className="data-[state=checked]:bg-teal-600"
          />
        </div>
      </div>

      <Separator />

      {/* Push */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-center gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">Push</Label>
          <p className="mt-0.5 w-max text-xs text-white/40">
            Background browser and desktop notifications when available.
          </p>
        </div>
        <div className="flex justify-end">
          <Switch
            checked={preferences?.push ?? false}
            onCheckedChange={(next) => handleToggle("push", next)}
            disabled={updatePreferences.isPending}
            className="data-[state=checked]:bg-teal-600"
          />
        </div>
      </div>

      <Separator />

      {isDesktopShell ? (
        <>
          <div className="px-6 sm:px-8 py-5">
            <div className="flex items-center gap-2">
              <Monitor className="size-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-white">
                Desktop workstation
              </h2>
            </div>
            <p className="mt-0.5 w-max text-xs text-white/40">
              Native alerts, tray behaviour, autostart, and quieter desktop flows.
            </p>
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-center gap-2 sm:gap-6 px-6 sm:px-8 py-5">
            <div>
              <Label className="text-sm text-white/80 font-medium">
                Native desktop alerts
              </Label>
              <p className="mt-0.5 w-max text-xs text-white/40">
                OS notifications from the desktop app itself.
              </p>
            </div>
            <div className="flex justify-end">
              <Switch
                checked={preferences?.desktop?.enabled ?? true}
                onCheckedChange={(next) => handleDesktopToggle("enabled", next)}
                disabled={updatePreferences.isPending}
                className="data-[state=checked]:bg-cyan-600"
              />
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-center gap-2 sm:gap-6 px-6 sm:px-8 py-5">
            <div>
              <Label className="text-sm text-white/80 font-medium">
                Close to tray
              </Label>
              <p className="mt-0.5 w-max text-xs text-white/40">
                Hide the main window instead of quitting.
              </p>
            </div>
            <div className="flex justify-end">
              <Switch
                checked={preferences?.desktop?.closeToTray ?? true}
                onCheckedChange={(next) =>
                  handleDesktopToggle("closeToTray", next)
                }
                disabled={updatePreferences.isPending}
                className="data-[state=checked]:bg-cyan-600"
              />
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-center gap-2 sm:gap-6 px-6 sm:px-8 py-5">
            <div>
              <Label className="text-sm text-white/80 font-medium">
                Launch on login
              </Label>
              <p className="mt-0.5 w-max text-xs text-white/40">
                Start the workstation when your computer signs in.
              </p>
            </div>
            <div className="flex justify-end">
              <Switch
                checked={preferences?.desktop?.launchOnLogin ?? false}
                onCheckedChange={(next) =>
                  handleDesktopToggle("launchOnLogin", next)
                }
                disabled={updatePreferences.isPending}
                className="data-[state=checked]:bg-cyan-600"
              />
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-center gap-2 sm:gap-6 px-6 sm:px-8 py-5">
            <div>
              <Label className="text-sm text-white/80 font-medium">
                High priority only
              </Label>
              <p className="mt-0.5 w-max text-xs text-white/40">
                Only surface alerts and higher-priority desktop events.
              </p>
            </div>
            <div className="flex justify-end">
              <Switch
                checked={preferences?.desktop?.highPriorityOnly ?? false}
                onCheckedChange={(next) =>
                  handleDesktopToggle("highPriorityOnly", next)
                }
                disabled={updatePreferences.isPending}
                className="data-[state=checked]:bg-cyan-600"
              />
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
            <div>
              <Label className="text-sm text-white/80 font-medium">
                Quiet hours
              </Label>
              <p className="mt-0.5 max-w-[260px] text-xs text-white/40">
                Mute desktop toasts during off-hours while keeping the in-app feed.
              </p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <Switch
                checked={preferences?.desktop?.quietHours?.enabled ?? false}
                onCheckedChange={(next) =>
                  handleQuietHoursUpdate("enabled", next)
                }
                disabled={updatePreferences.isPending}
                className="data-[state=checked]:bg-cyan-600"
              />
              <div className="flex items-center gap-3 text-sm text-white/70">
                <label className="flex items-center gap-2">
                  <span>From</span>
                  <select
                    className="h-9 rounded-md border border-white/10 bg-white/5 px-2 text-white outline-none"
                    value={preferences?.desktop?.quietHours?.startHour ?? 22}
                    onChange={(event) =>
                      handleQuietHoursUpdate(
                        "startHour",
                        Number(event.target.value)
                      )
                    }
                  >
                    {Array.from({ length: 24 }, (_, hour) => (
                      <option key={hour} value={hour} className="bg-[#0b1324]">
                        {hour.toString().padStart(2, "0")}:00
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <span>To</span>
                  <select
                    className="h-9 rounded-md border border-white/10 bg-white/5 px-2 text-white outline-none"
                    value={preferences?.desktop?.quietHours?.endHour ?? 7}
                    onChange={(event) =>
                      handleQuietHoursUpdate(
                        "endHour",
                        Number(event.target.value)
                      )
                    }
                  >
                    {Array.from({ length: 24 }, (_, hour) => (
                      <option key={hour} value={hour} className="bg-[#0b1324]">
                        {hour.toString().padStart(2, "0")}:00
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </div>

          <Separator />
        </>
      ) : null}

      {/* Trade Notifications heading */}
      <div className="px-6 sm:px-8 py-5">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-teal-400" />
          <h2 className="text-sm font-semibold text-white">
            Trade notifications
          </h2>
        </div>
        <p className="mt-0.5 w-max text-xs text-white/40">
          Notifications for your trading activity.
        </p>
      </div>

      <Separator />

      {/* Trade Closed */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-center gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">
            Trade closed
          </Label>
          <p className="mt-0.5 w-max text-xs text-white/40">
            When trades close via EA sync.
          </p>
        </div>
        <div className="flex justify-end">
          <Switch
            checked={preferences?.tradeClosed ?? true}
            onCheckedChange={(next) => handleToggle("tradeClosed", next)}
            disabled={updatePreferences.isPending}
            className="data-[state=checked]:bg-teal-600"
          />
        </div>
      </div>

      <Separator />

      {/* Post-exit metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-center gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">
            Post-exit metrics
          </Label>
          <p className="mt-0.5 w-max text-xs text-white/40">
            Money left on table analysis.
          </p>
        </div>
        <div className="flex justify-end">
          <Switch
            checked={preferences?.postExit ?? true}
            onCheckedChange={(next) => handleToggle("postExit", next)}
            disabled={updatePreferences.isPending}
            className="data-[state=checked]:bg-teal-600"
          />
        </div>
      </div>

      <Separator />

      {/* Trade Opened */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-center gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">
            Trade opened
          </Label>
          <p className="mt-0.5 w-max text-xs text-white/40">
            When new trades are opened.
          </p>
        </div>
        <div className="flex justify-end">
          <Switch
            checked={preferences?.tradeOpened ?? false}
            onCheckedChange={(next) => handleToggle("tradeOpened", next)}
            disabled={updatePreferences.isPending}
            className="data-[state=checked]:bg-teal-600"
          />
        </div>
      </div>

      <Separator />

      {/* Goal Notifications heading */}
      <div className="px-6 sm:px-8 py-5">
        <div className="flex items-center gap-2">
          <Target className="size-4 text-orange-400" />
          <h2 className="text-sm font-semibold text-white">
            Goal notifications
          </h2>
        </div>
        <p className="mt-0.5 w-max text-xs text-white/40">
          Updates on trading goals and milestones.
        </p>
      </div>

      <Separator />

      {/* Goal Achieved */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-center gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">
            Goal achieved
          </Label>
          <p className="mt-0.5 w-max text-xs text-white/40">
            When you hit a trading goal.
          </p>
        </div>
        <div className="flex justify-end">
          <Switch
            checked={preferences?.goals ?? true}
            onCheckedChange={(next) => handleToggle("goals", next)}
            disabled={updatePreferences.isPending}
            className="data-[state=checked]:bg-teal-600"
          />
        </div>
      </div>

      <Separator />

      {/* Alert Notifications heading */}
      <div className="px-6 sm:px-8 py-5">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-red-400" />
          <h2 className="text-sm font-semibold text-white">
            Alert notifications
          </h2>
        </div>
        <p className="mt-0.5 w-max text-xs text-white/40">
          Rule violations and warnings.
        </p>
      </div>

      <Separator />

      {/* Alert Triggered */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-center gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">
            Alert triggered
          </Label>
          <p className="mt-0.5 w-max text-xs text-white/40">
            When your custom alerts fire.
          </p>
        </div>
        <div className="flex justify-end">
          <Switch
            checked={preferences?.alerts ?? true}
            onCheckedChange={(next) => handleToggle("alerts", next)}
            disabled={updatePreferences.isPending}
            className="data-[state=checked]:bg-teal-600"
          />
        </div>
      </div>

      <Separator />

      {/* Market events heading */}
      <div className="px-6 sm:px-8 py-5">
        <h2 className="text-sm font-semibold text-white">
          {showSocialNotifications ? "Market events & social" : "Market events"}
        </h2>
        <p className="mt-0.5 w-max text-xs text-white/40">
          {showSocialNotifications
            ? "Economic calendar alerts and optional social updates."
            : "Economic calendar alerts and market-event reminders."}
        </p>
      </div>

      <Separator />

      {/* Economic Events */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-center gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <div className="flex items-center gap-2">
            <Newspaper className="size-4 text-blue-400" />
            <Label className="text-sm text-white/80 font-medium">
              Economic events
            </Label>
          </div>
          <p className="mt-0.5 w-max text-xs text-white/40">
            Upcoming economic-calendar alerts.
          </p>
        </div>
        <div className="flex justify-end">
          <Switch
            checked={preferences?.news ?? true}
            onCheckedChange={(next) => handleToggle("news", next)}
            disabled={updatePreferences.isPending}
            className="data-[state=checked]:bg-teal-600"
          />
        </div>
      </div>

      {showSocialNotifications ? (
        <>
          <Separator />

          {/* Social */}
          <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-center gap-2 sm:gap-6 px-6 sm:px-8 py-5">
            <div>
              <div className="flex items-center gap-2">
                <Users className="size-4 text-purple-400" />
                <Label className="text-sm text-white/80 font-medium">
                  Leaderboard & copy
                </Label>
              </div>
              <p className="mt-0.5 w-max text-xs text-white/40">
                Social updates.
              </p>
            </div>
            <div className="flex justify-end">
              <Switch
                checked={preferences?.social ?? false}
                onCheckedChange={(next) => handleToggle("social", next)}
                disabled={updatePreferences.isPending}
                className="data-[state=checked]:bg-teal-600"
              />
            </div>
          </div>

          <Separator />
        </>
      ) : (
        <Separator />
      )}

      {/* System heading */}
      <div className="px-6 sm:px-8 py-5">
        <div className="flex items-center gap-2">
          <Settings className="size-4 text-white/50" />
          <h2 className="text-sm font-semibold text-white">System</h2>
        </div>
        <p className="mt-0.5 w-max text-xs text-white/40">
          Account settings and API updates.
        </p>
      </div>

      <Separator />

      {/* System Updates */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-center gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">
            System updates
          </Label>
          <p className="mt-0.5 w-max text-xs text-white/40">
            Imports, API keys, settings.
          </p>
        </div>
        <div className="flex justify-end">
          <Switch
            checked={preferences?.system ?? true}
            onCheckedChange={(next) => handleToggle("system", next)}
            disabled={updatePreferences.isPending}
            className="data-[state=checked]:bg-teal-600"
          />
        </div>
      </div>
    </div>
  );
}
