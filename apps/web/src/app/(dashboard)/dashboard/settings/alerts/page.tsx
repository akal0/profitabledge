"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Bell, Plus, Trash2, Edit2 } from "lucide-react";
import { useAccountStore } from "@/stores/account";
import { trpcClient, trpcOptions, queryClient } from "@/utils/trpc";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

type RuleType = "daily_loss" | "max_drawdown" | "win_streak" | "loss_streak" | "consecutive_green" | "consecutive_red";
type ThresholdUnit = "percent" | "usd" | "count";
type Severity = "info" | "warning" | "critical";

const RULE_TYPE_LABELS: Record<RuleType, string> = {
  daily_loss: "Daily Loss Limit",
  max_drawdown: "Max Drawdown",
  win_streak: "Win Streak",
  loss_streak: "Loss Streak",
  consecutive_green: "Consecutive Green Days",
  consecutive_red: "Consecutive Red Days",
};

const RULE_TYPE_DESCRIPTIONS: Record<RuleType, string> = {
  daily_loss: "Alert when daily losses exceed threshold",
  max_drawdown: "Alert when total drawdown exceeds threshold",
  win_streak: "Celebrate when you hit a winning streak",
  loss_streak: "Warning when you're on a losing streak",
  consecutive_green: "Track consecutive profitable days",
  consecutive_red: "Warning for consecutive losing days",
};

const SEVERITY_COLORS: Record<Severity, string> = {
  info: "bg-blue-500/20 text-blue-400",
  warning: "bg-yellow-500/20 text-yellow-400",
  critical: "bg-rose-500/20 text-rose-400",
};

export default function AlertsSettingsPage() {
  const { selectedAccountId } = useAccountStore();
  const [showCreateDialog, setShowCreateDialog] = React.useState(false);
  const [editingRule, setEditingRule] = React.useState<any>(null);

  const [name, setName] = React.useState("");
  const [ruleType, setRuleType] = React.useState<RuleType>("daily_loss");
  const [thresholdValue, setThresholdValue] = React.useState("");
  const [thresholdUnit, setThresholdUnit] = React.useState<ThresholdUnit>("percent");
  const [severity, setSeverity] = React.useState<Severity>("warning");
  const [notifyInApp, setNotifyInApp] = React.useState(true);
  const [notifyEmail, setNotifyEmail] = React.useState(false);
  const [webhookUrl, setWebhookUrl] = React.useState("");
  const [cooldownMinutes, setCooldownMinutes] = React.useState("60");

  const { data: rules, isLoading } = useQuery({
    ...trpcOptions.alerts.listRules.queryOptions({ accountId: selectedAccountId || undefined }),
    enabled: true,
  });

  const { data: summary } = useQuery({
    ...trpcOptions.alerts.getSummary.queryOptions({ accountId: selectedAccountId || undefined }),
    enabled: true,
  });

  const resetForm = () => {
    setName("");
    setRuleType("daily_loss");
    setThresholdValue("");
    setThresholdUnit("percent");
    setSeverity("warning");
    setNotifyInApp(true);
    setNotifyEmail(false);
    setWebhookUrl("");
    setCooldownMinutes("60");
    setEditingRule(null);
  };

  const handleEdit = (rule: any) => {
    setEditingRule(rule);
    setName(rule.name);
    setRuleType(rule.ruleType);
    setThresholdValue(rule.thresholdValue);
    setThresholdUnit(rule.thresholdUnit);
    setSeverity(rule.alertSeverity);
    setNotifyInApp(rule.notifyInApp);
    setNotifyEmail(rule.notifyEmail || false);
    setWebhookUrl("");
    setCooldownMinutes(String(rule.cooldownMinutes || 60));
    setShowCreateDialog(true);
  };

  const handleCreate = async () => {
    if (!name || !thresholdValue) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      if (editingRule) {
        await trpcClient.alerts.updateRule.mutate({
          ruleId: editingRule.id,
          name,
          thresholdValue: parseFloat(thresholdValue),
          alertSeverity: severity,
          notifyInApp,
          notifyEmail,
          cooldownMinutes: parseInt(cooldownMinutes, 10),
        });
        toast.success("Alert rule updated");
      } else {
        await trpcClient.alerts.createRule.mutate({
          accountId: selectedAccountId || undefined,
          name,
          ruleType,
          thresholdValue: parseFloat(thresholdValue),
          thresholdUnit,
          alertSeverity: severity,
          notifyInApp,
          notifyEmail,
          cooldownMinutes: parseInt(cooldownMinutes, 10),
        });
        if (webhookUrl) {
          try {
            const existing = JSON.parse(localStorage.getItem("profitabledge-alert-webhooks") || "{}");
            existing[name] = webhookUrl;
            localStorage.setItem("profitabledge-alert-webhooks", JSON.stringify(existing));
          } catch {}
        }
        toast.success("Alert rule created");
      }

      queryClient.invalidateQueries({ queryKey: [["alerts"]] });
      setShowCreateDialog(false);
      resetForm();
    } catch (error: any) {
      toast.error(error?.message || "Failed to save alert rule");
    }
  };

  const handleDelete = async (ruleId: string) => {
    try {
      await trpcClient.alerts.deleteRule.mutate({ ruleId });
      toast.success("Alert rule deleted");
      queryClient.invalidateQueries({ queryKey: [["alerts"]] });
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete rule");
    }
  };

  const handleToggle = async (ruleId: string, isEnabled: boolean) => {
    try {
      await trpcClient.alerts.updateRule.mutate({ ruleId, isEnabled });
      queryClient.invalidateQueries({ queryKey: [["alerts"]] });
    } catch (error: any) {
      toast.error(error?.message || "Failed to update rule");
    }
  };

  return (
    <div className="flex flex-col w-full">
      {/* Header with Add button */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">
            Performance Alerts
          </Label>
          <p className="text-xs text-white/40 mt-0.5">
            Daily loss, drawdown, and streak notifications.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => {
              resetForm();
              setShowCreateDialog(true);
            }}
            className="border border-white/5 bg-teal-600/25 hover:bg-teal-600/35 px-4 py-2 h-[38px] w-max text-xs text-teal-300 cursor-pointer justify-start gap-2 transition-all active:scale-95 duration-250"
          >
            <Plus className="size-3.5" />
            Add Alert Rule
          </Button>
        </div>
      </div>

      <Separator />

      {/* Summary Stats */}
      {summary && (
        <>
          <div className="grid grid-cols-3 gap-4 px-6 sm:px-8 py-5">
            <div className="p-3 bg-sidebar border border-white/5 rounded-md">
              <div className="text-xs text-white/50">Active Rules</div>
              <div className="text-xl font-bold text-white">{summary.activeRulesCount}</div>
            </div>
            <div className="p-3 bg-sidebar border border-white/5 rounded-md">
              <div className="text-xs text-white/50">Unacknowledged</div>
              <div className="text-xl font-bold text-rose-400">{summary.unacknowledgedTotal}</div>
            </div>
            <div className="p-3 bg-sidebar border border-white/5 rounded-md">
              <div className="text-xs text-white/50">Critical</div>
              <div className="text-xl font-bold text-rose-400">{summary.bySeverity?.critical || 0}</div>
            </div>
          </div>
          <Separator />
        </>
      )}

      {/* Rules List */}
      <div className="px-6 sm:px-8 py-5">
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-white/50 py-4 text-sm">Loading rules...</div>
          ) : rules?.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="size-8 text-white/20 mx-auto mb-2" />
              <div className="text-white/50 text-sm">No alert rules configured</div>
              <div className="text-xs text-white/30 mt-1">
                Create your first alert rule to get notified about trading events
              </div>
            </div>
          ) : (
            rules?.map((rule: any) => (
              <div
                key={rule.id}
                className={cn(
                  "p-4 bg-sidebar-accent border border-white/5 rounded-md flex items-center justify-between",
                  !rule.isEnabled && "opacity-50"
                )}
              >
                <div className="flex items-center gap-4">
                  <Switch
                    checked={rule.isEnabled}
                    onCheckedChange={(checked) => handleToggle(rule.id, checked)}
                    className="data-[state=checked]:bg-teal-600"
                  />
                  <div>
                    <div className="font-medium text-white text-sm flex items-center gap-2">
                      {rule.name}
                      <span className={cn("text-xs px-2 py-0.5 rounded", SEVERITY_COLORS[rule.alertSeverity as Severity])}>
                        {rule.alertSeverity}
                      </span>
                    </div>
                    <div className="text-xs text-white/50 mt-0.5">
                      {RULE_TYPE_LABELS[rule.ruleType as RuleType]} &bull;{" "}
                      Threshold: {rule.thresholdValue} {rule.thresholdUnit}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(rule)}
                    className="text-white/40 hover:text-white h-8 w-8 p-0"
                  >
                    <Edit2 className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-rose-400 hover:text-rose-300 h-8 w-8 p-0"
                    onClick={() => handleDelete(rule.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-sidebar border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">{editingRule ? "Edit Alert Rule" : "Create Alert Rule"}</DialogTitle>
            <DialogDescription className="text-white/60">
              Configure when you want to be alerted about your trading performance
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-white/80">Rule Name</Label>
              <Input
                placeholder="e.g., Daily 5% Loss Limit"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-sidebar-accent border-white/5 text-white"
              />
            </div>

            {!editingRule && (
              <div className="space-y-2">
                <Label className="text-white/80">Rule Type</Label>
                <Select value={ruleType} onValueChange={(v) => setRuleType(v as RuleType)}>
                  <SelectTrigger className="bg-sidebar-accent border-white/5 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(RULE_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-white/50">{RULE_TYPE_DESCRIPTIONS[ruleType]}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-white/80">Threshold Value</Label>
                <Input
                  type="number"
                  placeholder="5"
                  value={thresholdValue}
                  onChange={(e) => setThresholdValue(e.target.value)}
                  className="bg-sidebar-accent border-white/5 text-white"
                />
              </div>
              {!editingRule && (
                <div className="space-y-2">
                  <Label className="text-white/80">Unit</Label>
                  <Select value={thresholdUnit} onValueChange={(v) => setThresholdUnit(v as ThresholdUnit)}>
                    <SelectTrigger className="bg-sidebar-accent border-white/5 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Percent (%)</SelectItem>
                      <SelectItem value="usd">USD ($)</SelectItem>
                      <SelectItem value="count">Count</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-white/80">Severity</Label>
              <Select value={severity} onValueChange={(v) => setSeverity(v as Severity)}>
                <SelectTrigger className="bg-sidebar-accent border-white/5 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-white/80">Cooldown (minutes)</Label>
              <Input
                type="number"
                placeholder="60"
                value={cooldownMinutes}
                onChange={(e) => setCooldownMinutes(e.target.value)}
                className="bg-sidebar-accent border-white/5 text-white"
              />
              <p className="text-xs text-white/50">
                Minimum time between repeat alerts of the same type
              </p>
            </div>

            <div className="space-y-3">
              <Label className="text-xs text-white/60 uppercase tracking-wider">Notification Channels</Label>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-white/80">In-App Notifications</Label>
                  <p className="text-[10px] text-white/30">Show alert in the notification hub</p>
                </div>
                <Switch checked={notifyInApp} onCheckedChange={setNotifyInApp} className="data-[state=checked]:bg-teal-600" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-white/80">Email Notifications</Label>
                  <p className="text-[10px] text-white/30">Send alert to your email address</p>
                </div>
                <Switch checked={notifyEmail} onCheckedChange={setNotifyEmail} className="data-[state=checked]:bg-teal-600" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/80">Webhook (Discord/Slack/Custom)</Label>
                <Input
                  type="url"
                  placeholder="https://discord.com/api/webhooks/..."
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="bg-sidebar-accent border-white/5 text-white text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowCreateDialog(false)}
              className="text-white/60"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              className="cursor-pointer flex items-center justify-center py-2 h-[38px] w-max transition-all active:scale-95 text-white text-xs hover:brightness-110 duration-250 border border-white/5 bg-sidebar rounded-sm hover:bg-sidebar-accent px-5"
            >
              {editingRule ? "Save Changes" : "Create Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
