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
import { queryClient, trpcOptions } from "@/utils/trpc";
import { useAccountStore } from "@/stores/account";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  getBrokerSettingsBrokerLabel,
  getBrokerSettingsDataSourceLabel,
  getBrokerSettingsPlatformLabel,
  isDemoWorkspaceAccount,
} from "@/features/accounts/lib/account-metadata";

function readBreakevenThresholdPips(account: unknown) {
  if (!account || typeof account !== "object") {
    return 0.5;
  }

  const rawValue = (account as { breakevenThresholdPips?: unknown })
    .breakevenThresholdPips;
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : 0.5;
}

function readInitialBalanceInputValue(account: unknown) {
  if (!account || typeof account !== "object") {
    return "";
  }

  const rawValue = (account as { initialBalance?: unknown }).initialBalance;
  if (rawValue == null || rawValue === "") {
    return "";
  }

  const parsed = Number(rawValue);
  return Number.isFinite(parsed)
    ? new Intl.NumberFormat("en-US", {
        minimumFractionDigits:
          Math.round(parsed * 100) !== Math.round(parsed) * 100 ? 2 : 0,
        maximumFractionDigits:
          Math.round(parsed * 100) !== Math.round(parsed) * 100 ? 2 : 0,
      }).format(parsed)
    : "";
}

function normalizeInitialBalanceInput(value: string) {
  const sanitized = value.replace(/[^0-9.,]/g, "");
  if (sanitized.length === 0) {
    return "";
  }

  const [wholePart = "", ...fractionParts] = sanitized.split(".");
  const wholeDigits = wholePart.replace(/,/g, "");
  const normalizedWholePart = wholeDigits.replace(/^0+(?=\d)/, "");
  const formattedWholePart =
    normalizedWholePart.length > 0
      ? new Intl.NumberFormat("en-US", {
          maximumFractionDigits: 0,
        }).format(Number(normalizedWholePart))
      : "";

  if (fractionParts.length === 0) {
    return formattedWholePart;
  }

  const normalizedFraction = fractionParts
    .join("")
    .replace(/,/g, "")
    .slice(0, 2);
  return `${formattedWholePart || "0"}.${normalizedFraction}`;
}

function parseInitialBalanceInput(value: string) {
  const normalized = value.replace(/,/g, "");
  if (normalized.length === 0) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getCurrencyPrefix(currency: string | null | undefined) {
  const normalizedCurrency = String(currency ?? "")
    .trim()
    .toUpperCase();

  switch (normalizedCurrency) {
    case "$":
    case "USD":
      return "$";
    case "£":
    case "GBP":
      return "£";
    case "€":
    case "EUR":
      return "EUR";
    case "AUD":
      return "AUD";
    case "CAD":
      return "CAD";
    case "JPY":
      return "JPY";
    default:
      return normalizedCurrency || null;
  }
}

function formatInitialBalanceDisplay(
  value: number | undefined,
  currency: string | null | undefined
) {
  if (value == null || !Number.isFinite(value)) {
    return "";
  }

  const prefix = getCurrencyPrefix(currency);
  const hasFraction = Math.round(value * 100) !== Math.round(value) * 100;
  const formattedValue = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  }).format(value);

  if (!prefix) {
    return formattedValue;
  }

  return /^[A-Z]{3}$/.test(prefix)
    ? `${prefix} ${formattedValue}`
    : `${prefix}${formattedValue}`;
}

export default function BrokerSettingsPage() {
  const { selectedAccountId } = useAccountStore();

  const { data: accounts } = useQuery(trpcOptions.accounts.list.queryOptions());
  const currentAccount = accounts?.find((acc) => acc.id === selectedAccountId);
  const isDemoAccount = currentAccount
    ? isDemoWorkspaceAccount(currentAccount)
    : false;
  const brokerDisplayLabel = getBrokerSettingsBrokerLabel(currentAccount);
  const platformDisplayLabel = getBrokerSettingsPlatformLabel(currentAccount);
  const dataSourceDisplayLabel =
    getBrokerSettingsDataSourceLabel(currentAccount);
  const [initialBalanceFocused, setInitialBalanceFocused] = useState(false);

  const updateBrokerSettings = useMutation(
    trpcOptions.accounts.updateBrokerSettings.mutationOptions()
  );

  const [brokerSettings, setBrokerSettings] = useState({
    brokerType: (currentAccount?.brokerType as any) || "mt5",
    preferredDataSource:
      (currentAccount?.preferredDataSource as any) || "dukascopy",
    averageSpreadPips: currentAccount?.averageSpreadPips
      ? Number(currentAccount.averageSpreadPips)
      : undefined,
    breakevenThresholdPips: readBreakevenThresholdPips(currentAccount),
    initialBalance: currentAccount?.initialBalance
      ? Number(currentAccount.initialBalance)
      : undefined,
  });
  const [initialBalanceInput, setInitialBalanceInput] = useState(() =>
    readInitialBalanceInputValue(currentAccount)
  );

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
      breakevenThresholdPips: readBreakevenThresholdPips(currentAccount),
      initialBalance: currentAccount?.initialBalance
        ? Number(currentAccount.initialBalance)
        : undefined,
    }));
    setInitialBalanceInput(readInitialBalanceInputValue(currentAccount));
    setInitialBalanceFocused(false);
  }, [currentAccount]);

  const handleSaveBrokerSettings = async () => {
    if (!selectedAccountId) {
      toast.error("Please select an account");
      return;
    }

    try {
      await updateBrokerSettings.mutateAsync({
        accountId: selectedAccountId,
        ...brokerSettings,
      } as any);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["accounts"] }),
        queryClient.invalidateQueries({ queryKey: [["trades"]] }),
      ]);
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
        <Input
          value={brokerDisplayLabel}
          readOnly
          className="bg-sidebar-accent ring-white/5 text-white"
        />
      </div>

      <Separator />

      {/* Platform type */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">
            Platform type
          </Label>
          <p className="text-xs text-white/40 mt-0.5">Your trading platform.</p>
        </div>
        {isDemoAccount ? (
          <Input
            value={platformDisplayLabel}
            readOnly
            className="bg-sidebar-accent ring-white/5 text-white"
          />
        ) : (
          <Select
            value={brokerSettings.brokerType}
            onValueChange={(value: any) =>
              setBrokerSettings({
                ...brokerSettings,
                brokerType: value,
              })
            }
          >
            <SelectTrigger className="bg-sidebar-accent ring-white/5 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mt4">MetaTrader 4</SelectItem>
              <SelectItem value="mt5">MetaTrader 5</SelectItem>
              <SelectItem value="ctrader">cTrader</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      <Separator />

      {/* Data source */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">
            Data source
          </Label>
          <p className="text-xs text-white/40 mt-0.5">
            Price data for drawdown analysis.
          </p>
        </div>
        {isDemoAccount ? (
          <Input
            value={dataSourceDisplayLabel}
            readOnly
            className="bg-sidebar-accent ring-white/5 text-white"
          />
        ) : (
          <Select
            value={brokerSettings.preferredDataSource}
            onValueChange={(value: any) =>
              setBrokerSettings({
                ...brokerSettings,
                preferredDataSource: value,
              })
            }
          >
            <SelectTrigger className="bg-sidebar-accent ring-white/5 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dukascopy">Dukascopy (Recommended)</SelectItem>
              <SelectItem value="alphavantage">Alpha Vantage</SelectItem>
              <SelectItem value="truefx">TrueFX</SelectItem>
              <SelectItem value="broker">Broker (EA Required)</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      <Separator />

      {/* Average spread */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">
            Average spread
          </Label>
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
          className="bg-sidebar-accent ring-white/5 text-white"
        />
      </div>

      <Separator />

      {/* Breakeven Threshold */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">
            Breakeven tolerance
          </Label>
          <p className="text-xs text-white/40 mt-0.5">
            Per-account break-even threshold in pips.
          </p>
        </div>
        <div className="space-y-3">
          <Input
            type="number"
            step="0.1"
            min="0"
            max="100"
            placeholder="e.g., 0.5 pips"
            value={brokerSettings.breakevenThresholdPips ?? ""}
            onChange={(e) =>
              setBrokerSettings({
                ...brokerSettings,
                breakevenThresholdPips: e.target.value
                  ? parseFloat(e.target.value)
                  : 0,
              })
            }
            className="bg-sidebar-accent ring-white/5 text-white"
          />
          <div className="space-y-1 text-xs leading-5 text-white/45">
            <p>
              Trades that finish inside this pip buffer count as{" "}
              <span className="text-white/75">breakeven</span> for this account.
            </p>
            <p>
              Start around <span className="text-white/75">0.25-0.5</span> for
              tight-spread FX, or <span className="text-white/75">0.5-1.5</span>{" "}
              when spread, commissions, or symbol volatility make scratch exits
              look like small losses.
            </p>
            <p>
              Saving this refreshes trade outcomes and BE counts for the
              account.
            </p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Initial balance */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] items-start gap-2 sm:gap-6 px-6 sm:px-8 py-5">
        <div>
          <Label className="text-sm text-white/80 font-medium">
            Initial balance
          </Label>
          <p className="text-xs text-white/40 mt-0.5">
            Baseline for return (%) calculations.
          </p>
        </div>
        <Input
          type="text"
          inputMode="decimal"
          placeholder="e.g., 100,000"
          value={
            initialBalanceFocused
              ? initialBalanceInput
              : formatInitialBalanceDisplay(
                  brokerSettings.initialBalance,
                  currentAccount?.initialCurrency
                )
          }
          onFocus={() => setInitialBalanceFocused(true)}
          onBlur={() => setInitialBalanceFocused(false)}
          onChange={(e) => {
            const nextInput = normalizeInitialBalanceInput(e.target.value);
            setInitialBalanceInput(nextInput);
            setBrokerSettings({
              ...brokerSettings,
              initialBalance: parseInitialBalanceInput(nextInput),
            });
          }}
          className="bg-sidebar-accent ring-white/5 text-white"
        />
      </div>

      <Separator />

      {/* Save */}
      <div className="flex justify-end px-6 sm:px-8 py-6">
        <Button
          onClick={handleSaveBrokerSettings}
          disabled={updateBrokerSettings.isPending || !selectedAccountId}
          className="cursor-pointer flex items-center justify-center py-2 h-[38px] w-max transition-all active:scale-95 text-white text-xs hover:brightness-110 duration-250 ring ring-white/5 bg-sidebar rounded-sm hover:bg-sidebar-accent px-5"
        >
          {updateBrokerSettings.isPending ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
