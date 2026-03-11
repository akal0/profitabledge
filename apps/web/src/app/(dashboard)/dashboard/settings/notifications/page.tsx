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
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { trpcOptions, queryClient } from "@/utils/trpc";

export default function NotificationsSettingsPage() {
  const { data: preferences } = useQuery(
    trpcOptions.notifications.getPreferences.queryOptions()
  );

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
      if (Notification.permission === "default") {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          toast.error("Desktop notifications were blocked.");
          return;
        }
      }
      if (Notification.permission === "denied") {
        toast.error("Desktop notifications are blocked in your browser.");
        return;
      }
    }

    try {
      await updatePreferences.mutateAsync({ [key]: nextValue });
      toast.success("Notification settings updated");
    } catch (error: any) {
      toast.error(error.message || "Failed to update notification settings");
    }
  };

  return (
    <div className="flex flex-col w-full">
      {/* Notification Channels heading */}
      <div className="px-6 sm:px-8 py-5">
        <h2 className="text-sm font-semibold text-white">
          Notification Channels
        </h2>
        <p className="text-xs text-white/40 mt-0.5">
          Choose how you receive notifications.
        </p>
      </div>

      <Separator />

      {/* In-App */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-center gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">In-app</Label>
          <p className="text-xs text-white/40 mt-0.5">Notification hub.</p>
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
          <p className="text-xs text-white/40 mt-0.5">Browser notifications.</p>
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

      {/* Trade Notifications heading */}
      <div className="px-6 sm:px-8 py-5">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-teal-400" />
          <h2 className="text-sm font-semibold text-white">
            Trade Notifications
          </h2>
        </div>
        <p className="text-xs text-white/40 mt-0.5">
          Notifications for your trading activity.
        </p>
      </div>

      <Separator />

      {/* Trade Closed */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-center gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">Trade closed</Label>
          <p className="text-xs text-white/40 mt-0.5">When trades close via EA sync.</p>
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

      {/* Post-Exit Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-center gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">Post-exit metrics</Label>
          <p className="text-xs text-white/40 mt-0.5">Money left on table analysis.</p>
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
          <Label className="text-sm text-white/80 font-medium">Trade opened</Label>
          <p className="text-xs text-white/40 mt-0.5">When new trades are opened.</p>
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
            Goal Notifications
          </h2>
        </div>
        <p className="text-xs text-white/40 mt-0.5">
          Updates on trading goals and milestones.
        </p>
      </div>

      <Separator />

      {/* Goal Achieved */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-center gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">Goal achieved</Label>
          <p className="text-xs text-white/40 mt-0.5">When you hit a trading goal.</p>
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
            Alert Notifications
          </h2>
        </div>
        <p className="text-xs text-white/40 mt-0.5">
          Rule violations and warnings.
        </p>
      </div>

      <Separator />

      {/* Alert Triggered */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-center gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">Alert triggered</Label>
          <p className="text-xs text-white/40 mt-0.5">When your custom alerts fire.</p>
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

      {/* News & Social heading */}
      <div className="px-6 sm:px-8 py-5">
        <h2 className="text-sm font-semibold text-white">
          News & Social
        </h2>
        <p className="text-xs text-white/40 mt-0.5">
          Market news and social updates.
        </p>
      </div>

      <Separator />

      {/* Economic Events */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-center gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <div className="flex items-center gap-2">
            <Newspaper className="size-4 text-blue-400" />
            <Label className="text-sm text-white/80 font-medium">Economic events</Label>
          </div>
          <p className="text-xs text-white/40 mt-0.5">Today's news alerts.</p>
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

      <Separator />

      {/* Social */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-center gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <div className="flex items-center gap-2">
            <Users className="size-4 text-purple-400" />
            <Label className="text-sm text-white/80 font-medium">Leaderboard & Copy</Label>
          </div>
          <p className="text-xs text-white/40 mt-0.5">Social updates.</p>
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

      {/* System heading */}
      <div className="px-6 sm:px-8 py-5">
        <div className="flex items-center gap-2">
          <Settings className="size-4 text-white/50" />
          <h2 className="text-sm font-semibold text-white">System</h2>
        </div>
        <p className="text-xs text-white/40 mt-0.5">
          Account settings and API updates.
        </p>
      </div>

      <Separator />

      {/* System Updates */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-center gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">System updates</Label>
          <p className="text-xs text-white/40 mt-0.5">Imports, API keys, settings.</p>
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
