"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { trpcOptions } from "@/utils/trpc";
import { useAccountStore } from "@/stores/account";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQuery, useMutation } from "@tanstack/react-query";

const BROKER_LIST = [
  { value: "ftmo", label: "FTMO" },
  { value: "icmarkets", label: "IC Markets" },
  { value: "pepperstone", label: "Pepperstone" },
  { value: "oanda", label: "OANDA" },
  { value: "xm", label: "XM" },
  { value: "other", label: "Other" },
];

export default function BrokerSettingsPage() {
  const { selectedAccountId } = useAccountStore();

  const { data: accounts } = useQuery(trpcOptions.accounts.list.queryOptions());
  const currentAccount = accounts?.find((acc) => acc.id === selectedAccountId);

  const updateBrokerSettings = useMutation(trpcOptions.accounts.updateBrokerSettings.mutationOptions());

  const [brokerSettings, setBrokerSettings] = useState({
    brokerType: (currentAccount?.brokerType as any) || "mt5",
    preferredDataSource:
      (currentAccount?.preferredDataSource as any) || "dukascopy",
    averageSpreadPips: currentAccount?.averageSpreadPips
      ? Number(currentAccount.averageSpreadPips)
      : undefined,
    initialBalance: currentAccount?.initialBalance
      ? Number(currentAccount.initialBalance)
      : undefined,
  });

  useEffect(() => {
    if (!currentAccount) return;
    setBrokerSettings((prev) => ({
      ...prev,
      brokerType: (currentAccount?.brokerType as any) || "mt5",
      preferredDataSource:
        (currentAccount?.preferredDataSource as any) || "dukascopy",
      averageSpreadPips: currentAccount?.averageSpreadPips
        ? Number(currentAccount.averageSpreadPips)
        : undefined,
      initialBalance: currentAccount?.initialBalance
        ? Number(currentAccount.initialBalance)
        : undefined,
    }));
  }, [currentAccount?.id]);

  const handleSaveBrokerSettings = async () => {
    if (!selectedAccountId) {
      toast.error("Please select an account");
      return;
    }

    try {
      await updateBrokerSettings.mutateAsync({
        accountId: selectedAccountId,
        ...brokerSettings,
      });
      toast.success("Broker settings saved");
    } catch (error: any) {
      toast.error(error.message || "Failed to save settings");
    }
  };

  return (
    <div className="flex flex-col w-full">
      {/* Broker */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">Broker</Label>
          <p className="text-xs text-white/40 mt-0.5">
            Set during account creation.
          </p>
        </div>
        <Select value={currentAccount?.broker || ""} disabled>
          <SelectTrigger className="bg-sidebar-accent border-white/5 text-white">
            <SelectValue placeholder="Select broker" />
          </SelectTrigger>
          <SelectContent>
            {BROKER_LIST.map((broker) => (
              <SelectItem key={broker.value} value={broker.value}>
                {broker.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Platform Type */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">Platform Type</Label>
          <p className="text-xs text-white/40 mt-0.5">
            Your trading platform.
          </p>
        </div>
        <Select
          value={brokerSettings.brokerType}
          onValueChange={(value: any) =>
            setBrokerSettings({
              ...brokerSettings,
              brokerType: value,
            })
          }
        >
          <SelectTrigger className="bg-sidebar-accent border-white/5 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mt4">MetaTrader 4</SelectItem>
            <SelectItem value="mt5">MetaTrader 5</SelectItem>
            <SelectItem value="ctrader">cTrader</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Data Source */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">Data Source</Label>
          <p className="text-xs text-white/40 mt-0.5">
            Price data for drawdown analysis.
          </p>
        </div>
        <Select
          value={brokerSettings.preferredDataSource}
          onValueChange={(value: any) =>
            setBrokerSettings({
              ...brokerSettings,
              preferredDataSource: value,
            })
          }
        >
          <SelectTrigger className="bg-sidebar-accent border-white/5 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dukascopy">Dukascopy (Recommended)</SelectItem>
            <SelectItem value="alphavantage">Alpha Vantage</SelectItem>
            <SelectItem value="truefx">TrueFX</SelectItem>
            <SelectItem value="broker">Broker (EA Required)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Average Spread */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">Average Spread</Label>
          <p className="text-xs text-white/40 mt-0.5">
            Improves accuracy for your broker.
          </p>
        </div>
        <Input
          type="number"
          step="0.1"
          min="0"
          placeholder="e.g., 0.8 pips"
          value={brokerSettings.averageSpreadPips || ""}
          onChange={(e) =>
            setBrokerSettings({
              ...brokerSettings,
              averageSpreadPips: e.target.value
                ? parseFloat(e.target.value)
                : undefined,
            })
          }
          className="bg-sidebar-accent border-white/5 text-white"
        />
      </div>

      <Separator />

      {/* Initial Balance */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">Initial Balance</Label>
          <p className="text-xs text-white/40 mt-0.5">
            Baseline for return (%) calculations.
          </p>
        </div>
        <Input
          type="number"
          step="0.01"
          min="0"
          placeholder="e.g., 200000"
          value={brokerSettings.initialBalance ?? ""}
          onChange={(e) =>
            setBrokerSettings({
              ...brokerSettings,
              initialBalance: e.target.value
                ? parseFloat(e.target.value)
                : undefined,
            })
          }
          className="bg-sidebar-accent border-white/5 text-white"
        />
      </div>

      <Separator />

      {/* Save */}
      <div className="flex justify-end px-6 sm:px-8 py-6">
        <Button
          onClick={handleSaveBrokerSettings}
          disabled={updateBrokerSettings.isPending || !selectedAccountId}
          className="cursor-pointer flex items-center justify-center py-2 h-[38px] w-max transition-all active:scale-95 text-white text-xs hover:brightness-110 duration-250 border border-white/5 bg-sidebar rounded-sm hover:bg-sidebar-accent px-5"
        >
          {updateBrokerSettings.isPending ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
