"use client";

import { useState } from "react";
import { useTRPC } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Loader2, Info, Users, X } from "lucide-react";

interface AddSlaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  onAdded: () => void;
}

type LotMode = "fixed" | "multiplier" | "balance_ratio" | "risk_percent";

interface AvailableSlaveAccount {
  id: string;
  name: string;
  accountNumber: string | null;
  liveBalance: string | null;
}

const optionCardClass = "flex items-start space-x-3 rounded-sm border border-white/5 bg-sidebar-accent p-3";
const selectTriggerClass = "border-white/5 rounded-sm bg-transparent text-white/60";
const selectContentClass = "rounded-sm border border-white/5 bg-sidebar-accent";

export function AddSlaveDialog({ open, onOpenChange, groupId, onAdded }: AddSlaveDialogProps) {
  const trpc = useTRPC() as any;
  const [slaveAccountId, setSlaveAccountId] = useState("");
  const [lotMode, setLotMode] = useState<LotMode>("multiplier");
  const [fixedLot, setFixedLot] = useState("0.10");
  const [lotMultiplier, setLotMultiplier] = useState("1.0");
  const [riskPercent, setRiskPercent] = useState("1.0");
  const [maxLotSize, setMaxLotSize] = useState("5.0");
  const [maxDailyLoss, setMaxDailyLoss] = useState("");
  const [maxTradesPerDay, setMaxTradesPerDay] = useState("");

  const { data: availableAccounts, isLoading: accountsLoading } =
    trpc.copier.getAvailableAccounts.useQuery(
      { groupId },
      { enabled: open }
    ) as {
      data: AvailableSlaveAccount[] | undefined;
      isLoading: boolean;
    };

  const addSlave = trpc.copier.addSlave.useMutation({
    onSuccess: () => {
      resetForm();
      onAdded();
    },
  });

  const resetForm = () => {
    setSlaveAccountId("");
    setLotMode("multiplier");
    setFixedLot("0.10");
    setLotMultiplier("1.0");
    setRiskPercent("1.0");
    setMaxLotSize("5.0");
    setMaxDailyLoss("");
    setMaxTradesPerDay("");
  };

  const handleAdd = () => {
    if (!slaveAccountId) return;

    addSlave.mutate({
      groupId,
      slaveAccountId,
      config: {
        lotMode,
        fixedLot: parseFloat(fixedLot) || 0.01,
        lotMultiplier: parseFloat(lotMultiplier) || 1.0,
        riskPercent: parseFloat(riskPercent) || 1.0,
        maxLotSize: parseFloat(maxLotSize) || 10.0,
        maxDailyLoss: maxDailyLoss ? parseFloat(maxDailyLoss) : undefined,
        maxTradesPerDay: maxTradesPerDay ? parseInt(maxTradesPerDay, 10) : undefined,
      },
    });
  };

  const getLotModeDescription = (mode: LotMode) => {
    switch (mode) {
      case "fixed":
        return "Always trade a fixed lot size regardless of master's volume";
      case "multiplier":
        return "Multiply the master's lot size by a factor";
      case "balance_ratio":
        return "Scale lots based on the ratio of slave/master balance";
      case "risk_percent":
        return "Calculate lot size based on a percentage of slave account at risk";
    }
  };

  const getPreviewText = () => {
    const masterLots = 0.5;
    let slaveLots: number;

    switch (lotMode) {
      case "fixed":
        slaveLots = parseFloat(fixedLot) || 0.1;
        break;
      case "multiplier":
        slaveLots = masterLots * (parseFloat(lotMultiplier) || 1.0);
        break;
      case "balance_ratio":
        slaveLots = masterLots * 0.5; // Example: 50% balance ratio
        return `Master 0.50 lots → Slave ~0.25 lots (depends on balance)`;
      case "risk_percent":
        return `Master 0.50 lots → Slave varies (${riskPercent}% risk per trade)`;
    }

    slaveLots = Math.min(slaveLots, parseFloat(maxLotSize) || 10);
    return `Master 0.50 lots → Slave ${slaveLots.toFixed(2)} lots`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex flex-col gap-0 overflow-hidden rounded-md border border-white/5 bg-sidebar/5 p-2 shadow-2xl backdrop-blur-lg sm:max-w-lg"
      >
        <div className="flex flex-col gap-0 overflow-hidden rounded-sm border border-white/5 bg-sidebar-accent/80 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-start gap-3 px-5 py-4 sticky top-0 bg-sidebar-accent/80 z-10">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-white/5 bg-sidebar-accent">
              <Users className="h-3.5 w-3.5 text-white/60" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-white">Add Slave Account</div>
              <p className="mt-1 text-xs leading-relaxed text-white/40">Select an account to receive copied trades and configure how lots should be sized.</p>
            </div>
            <DialogClose asChild>
              <button type="button" className="ml-auto flex size-8 cursor-pointer items-center justify-center rounded-sm border border-white/5 bg-sidebar-accent text-white/50 transition-colors hover:bg-sidebar-accent hover:brightness-110 hover:text-white">
                <X className="h-3.5 w-3.5" />
                <span className="sr-only">Close</span>
              </button>
            </DialogClose>
          </div>
          <Separator />

          {/* Body */}
          <div className="space-y-6 px-5 py-4">
            {/* Account Selection */}
            <div className="space-y-2">
              <Label className="text-white/75">Select Account</Label>
              <Select value={slaveAccountId} onValueChange={setSlaveAccountId}>
                <SelectTrigger className={selectTriggerClass}>
                  <SelectValue placeholder="Choose a slave account" />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
                  {accountsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="size-4 animate-spin text-white/50" />
                    </div>
                  ) : availableAccounts && availableAccounts.length > 0 ? (
                    availableAccounts.map((account) => (
                      <SelectItem
                        key={account.id}
                        value={account.id}
                        className="text-xs text-white/75 data-[highlighted]:bg-sidebar data-[highlighted]:text-white"
                      >
                        <div className="flex items-center gap-2">
                          <span>{account.name}</span>
                          {account.accountNumber && (
                            <span className="text-xs text-white/50">({account.accountNumber})</span>
                          )}
                          {account.liveBalance && (
                            <span className="text-xs text-teal-300">
                              ${parseFloat(account.liveBalance).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <div className="py-4 text-center text-sm text-white/45">
                      No available accounts
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Lot Sizing Mode */}
            <div className="space-y-3">
              <Label className="text-white/75">Lot Sizing Mode</Label>
              <RadioGroup
                value={lotMode}
                onValueChange={(v) => setLotMode(v as LotMode)}
                className="space-y-2"
              >
                <div className={optionCardClass}>
                  <RadioGroupItem value="multiplier" id="multiplier" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="multiplier" className="text-sm font-medium cursor-pointer">
                      Lot Multiplier
                    </Label>
                    <p className="text-xs text-white/50 mt-0.5">
                      {getLotModeDescription("multiplier")}
                    </p>
                    {lotMode === "multiplier" && (
                      <div className="mt-2">
                        <Input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="10"
                          value={lotMultiplier}
                          onChange={(e) => setLotMultiplier(e.target.value)}
                          className="w-24"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className={optionCardClass}>
                  <RadioGroupItem value="fixed" id="fixed" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="fixed" className="text-sm font-medium cursor-pointer">
                      Fixed Lot Size
                    </Label>
                    <p className="text-xs text-white/50 mt-0.5">
                      {getLotModeDescription("fixed")}
                    </p>
                    {lotMode === "fixed" && (
                      <div className="mt-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max="100"
                          value={fixedLot}
                          onChange={(e) => setFixedLot(e.target.value)}
                          className="w-24"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className={optionCardClass}>
                  <RadioGroupItem value="balance_ratio" id="balance_ratio" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="balance_ratio" className="text-sm font-medium cursor-pointer">
                      Balance Ratio
                    </Label>
                    <p className="text-xs text-white/50 mt-0.5">
                      {getLotModeDescription("balance_ratio")}
                    </p>
                  </div>
                </div>

                <div className={optionCardClass}>
                  <RadioGroupItem value="risk_percent" id="risk_percent" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="risk_percent" className="text-sm font-medium cursor-pointer">
                      Risk Percentage
                    </Label>
                    <p className="text-xs text-white/50 mt-0.5">
                      {getLotModeDescription("risk_percent")}
                    </p>
                    {lotMode === "risk_percent" && (
                      <div className="mt-2 flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="10"
                          value={riskPercent}
                          onChange={(e) => setRiskPercent(e.target.value)}
                          className="w-24"
                        />
                        <span className="text-sm text-white/50">% per trade</span>
                      </div>
                    )}
                  </div>
                </div>
              </RadioGroup>

              {/* Preview */}
              <div className="flex items-center gap-2 rounded-sm border border-teal-400/20 bg-teal-400/12 p-2">
                <Info className="size-4 shrink-0 text-teal-200" />
                <p className="text-xs text-teal-200">{getPreviewText()}</p>
              </div>
            </div>

            {/* Risk Management */}
            <div className="space-y-3">
              <Label className="text-white/75">Risk Management</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-white/60">Max Lot Size</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0.01"
                    value={maxLotSize}
                    onChange={(e) => setMaxLotSize(e.target.value)}
                    placeholder="5.0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-white/60">Max Daily Loss ($)</Label>
                  <Input
                    type="number"
                    step="100"
                    min="0"
                    value={maxDailyLoss}
                    onChange={(e) => setMaxDailyLoss(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs text-white/60">Max Trades Per Day</Label>
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    value={maxTradesPerDay}
                    onChange={(e) => setMaxTradesPerDay(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>
          </div>

          <Separator />
          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 py-3">
            <Button
              className="cursor-pointer flex items-center justify-center gap-2 rounded-sm border border-white/5 bg-sidebar px-3 py-2 h-9 text-xs text-white/70 transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 shadow-none"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="cursor-pointer flex items-center justify-center gap-2 py-2 h-[38px] transition-all active:scale-95 text-xs duration-250 rounded-sm px-5 border border-teal-400/20 bg-teal-400/12 text-teal-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-teal-400/20 hover:brightness-110 disabled:opacity-50 disabled:pointer-events-none"
              onClick={handleAdd}
              disabled={!slaveAccountId || addSlave.isPending}
            >
              {addSlave.isPending && <Loader2 className="size-4 mr-2 animate-spin" />}
              Add Slave
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
