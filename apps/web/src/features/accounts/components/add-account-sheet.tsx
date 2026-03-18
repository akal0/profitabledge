"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, ExternalLink, Sparkles, Plug, Cpu } from "lucide-react";
import { trpcClient } from "@/utils/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import CsvUpload from "@/components/upload/CsvUpload";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import {
  TRADE_ACTION_BUTTON_CLASS,
  TRADE_ACTION_BUTTON_PRIMARY_CLASS,
  TRADE_IDENTIFIER_PILL_CLASS,
  TRADE_IDENTIFIER_TONES,
  TRADE_SURFACE_CARD_CLASS,
} from "@/components/trades/trade-identifier-pill";
import {
  BROKER_OPTIONS,
  brokerSupportsMultiCsvImport,
  getAccountImage,
  getBrokerSupplementalCsvReports,
  isDemoWorkspaceAccount,
} from "@/features/accounts/lib/account-metadata";
import { getCsvImportFeedbackMessage } from "@/features/accounts/lib/csv-import-feedback";
import { useAccountCatalog } from "@/features/accounts/hooks/use-account-catalog";

type ManualAccountBrokerType =
  | "mt4"
  | "mt5"
  | "ctrader"
  | "tradovate"
  | "topstepx"
  | "rithmic"
  | "ninjatrader"
  | "other";

const MANUAL_ACCOUNT_BROKER_TYPE_OPTIONS: Array<{
  value: ManualAccountBrokerType;
  label: string;
}> = [
  { value: "mt4", label: "MetaTrader 4" },
  { value: "mt5", label: "MetaTrader 5" },
  { value: "ctrader", label: "cTrader" },
  { value: "tradovate", label: "Tradovate" },
  { value: "topstepx", label: "TopstepX" },
  { value: "rithmic", label: "Rithmic" },
  { value: "ninjatrader", label: "NinjaTrader" },
  { value: "other", label: "Other" },
];

function normalizeBalanceInput(input: string): number | undefined {
  const cleaned = String(input || "").replace(/[^0-9.\-]/g, "");
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export type AddAccountForm = {
  method: "csv" | "broker" | "ea" | "manual" | null;
  name: string;
  broker: string;
  brokerType: ManualAccountBrokerType | "";
  brokerServer: string;
  accountNumber: string;
  initialCurrency: "$" | "£" | "€" | "";
  initialBalance: string;
  files: File[];
};

export type NewAccount = {
  id: string;
  name: string;
  image: string;
};

type PendingCsvImportResolution = {
  matchedAccount: {
    id: string;
    name: string;
    broker: string;
    accountNumber: string | null;
  };
  warnings: string[];
};

type DemoWorkspaceResult = {
  tradeCount: number;
  openTradeCount: number;
  resetCount?: number;
  account?: {
    id: string;
    name: string;
    broker?: string | null;
    brokerType?: string | null;
  };
};

export function AddAccountSheet({
  onAccountCreated,
  trigger,
  open: controlledOpen,
  contentClassName,
}: {
  onAccountCreated: (account: NewAccount) => void;
  trigger?: React.ReactNode;
  /** When provided, overrides internal open state (e.g. for tour) */
  open?: boolean;
  /** Extra className applied to SheetContent (e.g. z-index override for tour) */
  contentClassName?: string;
}) {
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : sheetOpen;
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<AddAccountForm>({
    method: null,
    name: "",
    broker: "",
    brokerType: "",
    brokerServer: "",
    accountNumber: "",
    initialCurrency: "$",
    initialBalance: "",
    files: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [pendingCsvImportResolution, setPendingCsvImportResolution] =
    useState<PendingCsvImportResolution | null>(null);
  const { accounts } = useAccountCatalog();

  const demoAccounts = useMemo(
    () => accounts.filter((account) => isDemoWorkspaceAccount(account)),
    [accounts]
  );

  const normalizedInitialBalance = useMemo(
    () => normalizeBalanceInput(form.initialBalance),
    [form.initialBalance]
  );

  const canSubmit = useMemo(() => {
    if (form.method === "csv") {
      return Boolean(
        form.files.length > 0 && form.name.trim() && form.broker.trim()
      );
    }
    if (form.method === "manual") {
      return Boolean(
        form.name.trim() &&
          form.broker.trim() &&
          form.brokerType &&
          normalizedInitialBalance !== undefined
      );
    }
    return false;
  }, [form, normalizedInitialBalance]);

  const selectedBrokerSupportsMultiCsv = useMemo(
    () => brokerSupportsMultiCsvImport(form.broker),
    [form.broker]
  );
  const canQueueMultipleCsvFiles = useMemo(
    () => !form.broker || selectedBrokerSupportsMultiCsv,
    [form.broker, selectedBrokerSupportsMultiCsv]
  );
  const selectedBrokerSupplementalReports = useMemo(
    () => getBrokerSupplementalCsvReports(form.broker),
    [form.broker]
  );

  function resetAll() {
    setStep(1);
    setForm({
      method: null,
      name: "",
      broker: "",
      brokerType: "",
      brokerServer: "",
      accountNumber: "",
      initialCurrency: "$",
      initialBalance: "",
      files: [],
    });
    setPendingCsvImportResolution(null);
  }

  useEffect(() => {
    if (pendingCsvImportResolution && form.broker !== "tradovate") {
      setPendingCsvImportResolution(null);
    }
  }, [form.broker, pendingCsvImportResolution]);

  // Reset form when externally forced closed
  useEffect(() => {
    if (controlledOpen === false) {
      setSheetOpen(false);
      resetAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlledOpen]);

  function handleOpenChange(next: boolean) {
    setSheetOpen(next);
    if (!next) resetAll();
  }

  async function fileToBase64(file: File): Promise<string> {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1] || "";
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleSubmitCSV(input?: {
    existingAccountAction?: "enrich" | "create_duplicate";
    existingAccountId?: string;
  }) {
    if (!canSubmit || form.files.length === 0) return;
    setSubmitting(true);

    try {
      const encodedFiles = await Promise.all(
        form.files.map(async (file) => ({
          fileName: file.name,
          csvBase64: await fileToBase64(file),
        }))
      );

      const res = await trpcClient.upload.importCsv.mutate({
        name: form.name,
        broker: form.broker,
        initialBalance: normalizeBalanceInput(form.initialBalance),
        initialCurrency: (form.initialCurrency || "$") as "$" | "£" | "€",
        csvBase64: encodedFiles[0]?.csvBase64 ?? "",
        fileName: encodedFiles[0]?.fileName,
        files: encodedFiles,
        existingAccountAction: input?.existingAccountAction,
        existingAccountId: input?.existingAccountId,
      });

      if (res.status === "requires_account_resolution") {
        setPendingCsvImportResolution({
          matchedAccount: res.matchedExistingAccount,
          warnings: res.warnings,
        });
        setSubmitting(false);
        return;
      }

      setPendingCsvImportResolution(null);

      if (res.status === "enriched_existing") {
        toast.success(
          getCsvImportFeedbackMessage(res, {
            accountName: res.matchedExistingAccount.name,
          })
        );
        setSubmitting(false);
        setSheetOpen(false);
        resetAll();
        window.location.reload();
        return;
      }

      onAccountCreated({
        id: res.accountId,
        name: form.name,
        image: getAccountImage({ broker: form.broker }),
      });
      setSubmitting(false);
      setStep(3);
      // Ensure the dashboard re-fetches data for the new account
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    } catch (e) {
      console.error(e);
      setSubmitting(false);
    }
  }

  async function handleManualAccountCreate() {
    if (form.method !== "manual" || !canSubmit) return;
    setSubmitting(true);

    try {
      const account = await trpcClient.accounts.create.mutate({
        name: form.name.trim(),
        broker: form.broker.trim(),
        brokerType: form.brokerType as ManualAccountBrokerType,
        brokerServer:
          form.brokerType === "mt4" || form.brokerType === "mt5"
            ? form.brokerServer.trim() || undefined
            : undefined,
        accountNumber: form.accountNumber.trim() || undefined,
        initialBalance: normalizedInitialBalance,
        initialCurrency: form.initialCurrency || "$",
      });

      await refreshAccounts();
      onAccountCreated({
        id: account.id,
        name: account.name,
        image: getAccountImage({
          broker: account.broker,
          brokerType: account.brokerType,
        }),
      });
      toast.success("Manual account created");
      setStep(3);
    } catch (e: any) {
      toast.error(e?.message || "Failed to create manual account");
    } finally {
      setSubmitting(false);
    }
  }

  async function refreshAccounts() {
    await queryClient.invalidateQueries({ queryKey: ["accounts"] });
  }

  async function handleDemoWorkspace() {
    try {
      setSubmitting(true);
      const result = (await (demoAccounts.length > 0
        ? trpcClient.accounts.resetDemoWorkspace.mutate()
        : trpcClient.accounts.createSampleAccount.mutate())) as DemoWorkspaceResult;

      await refreshAccounts();

      toast.success(
        demoAccounts.length > 0
          ? `Demo workspace regenerated with ${result.tradeCount} trades and ${result.openTradeCount} live positions.`
          : `Demo account created with ${result.tradeCount} trades and ${result.openTradeCount} live positions.`
      );

      setSheetOpen(false);

      if (demoAccounts.length > 0) {
        // Regeneration replaced existing accounts — hard reload to reset all stores
        window.location.reload();
        return;
      }

      const createdAccount = result.account;
      if (!createdAccount) {
        toast.error("Demo account was created without account metadata");
        return;
      }

      onAccountCreated({
        id: createdAccount.id,
        name: createdAccount.name,
        image: getAccountImage({
          broker: createdAccount.broker,
          brokerType: createdAccount.brokerType,
        }),
      });
    } catch (e: any) {
      toast.error(
        e.message ||
          (demoAccounts.length > 0
            ? "Failed to regenerate demo workspace"
            : "Failed to create demo account")
      );
    } finally {
      setSubmitting(false);
    }
  }

  const sheetTitle =
    step === 1
      ? "Connect your account"
      : step === 2
      ? form.method === "csv"
        ? "Import account from file"
        : form.method === "manual"
        ? "Create manual account"
        : form.method === "broker"
        ? "Broker sync"
        : "EA sync"
      : "Account ready";

  const sheetDescription =
    step === 1
      ? "Choose how you want to add your trading account."
      : step === 2 && form.method === "csv"
      ? "Upload your CSV, XML, or XLSX file and enter the details for this trading account."
      : step === 2 && form.method === "manual"
      ? "Create a blank account and log trades manually inside ProfitEdge."
      : step === 2 && form.method === "broker"
      ? "Use Connections to sync supported broker and platform accounts directly."
      : step === 2 && form.method === "ea"
      ? "Use the MT5 EA bridge for terminal-based sync and richer trade analytics."
      : "Your account has been added to the account switcher.";

  const sectionTitleClass = "text-xs font-semibold text-white/70 tracking-wide";
  const fieldLabelClass = "text-xs text-white/50";
  const fieldInputClass =
    "rounded-sm ring-1 ring-white/8 bg-white/[0.03] px-4 text-xs text-white/80 placeholder:text-white/25 hover:brightness-100 border-none";
  const fieldSelectTriggerClass =
    "h-9 w-full px-4 text-xs bg-transparent! cursor-pointer ring-white/5 hover:bg-sidebar-accent! transition duration-250";
  const fieldSelectContentClass = "";
  const fieldSelectItemClass = "whitespace-normal cursor-pointer";

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        {trigger || (
          <Button className="ring-1 ring-white/5 cursor-pointer flex transform items-center justify-center gap-2 rounded-md py-3 transition-all active:scale-95 bg-sidebar-accent text-white w-full text-xs hover:bg-[#222225] hover:!brightness-120 hover:text-white duration-250">
            <div className="flex items-center gap-2 truncate">
              <Plus className="size-3.5" />
              <span className=" truncate">Add an account</span>
            </div>
          </Button>
        )}
      </SheetTrigger>

      <SheetContent
        side="right"
        className={cn("w-full sm:max-w-2xl overflow-y-auto rounded-md p-0", contentClassName)}
      >
        <div className="px-6 py-5 pb-0">
          <SheetHeader className="p-0">
            <div className="flex w-full items-end justify-between gap-4">
              <div className="flex flex-col items-start gap-1">
                <SheetTitle className="text-base font-semibold text-white">
                  {sheetTitle}
                </SheetTitle>
                <SheetDescription className="max-w-md text-xs leading-relaxed text-white/40">
                  {sheetDescription}
                </SheetDescription>
              </div>
              <span
                className={cn(
                  TRADE_IDENTIFIER_PILL_CLASS,
                  TRADE_IDENTIFIER_TONES.neutral,
                  "min-h-6 px-2 py-0.5 text-[10px]"
                )}
              >
                Step {step} of 3
              </span>
            </div>
          </SheetHeader>
        </div>

        <div className="flex flex-col">
          {step === 1 && (
            <>
              <Separator />
              <div className="px-6 py-3">
                <h3 className={sectionTitleClass}>Connection method</h3>
              </div>
              <Separator />
              <div className="px-6 py-5">
                <div className="grid gap-3">
                  <Button
                    className={cn(
                      TRADE_SURFACE_CARD_CLASS,
                      "h-auto w-full justify-between rounded-sm px-4 py-4 text-left hover:bg-white/[0.05]"
                    )}
                    onClick={() => {
                      setForm({ ...form, method: "csv" });
                      setStep(2);
                    }}
                  >
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-sm font-medium text-white">
                        Import account via file
                      </span>
                      <span className="text-xs text-white/45">
                        Upload a CSV, XML, or XLSX statement export and create a new
                        account from it.
                      </span>
                    </div>
                    <span className="text-white/35">→</span>
                  </Button>

                  <Button
                    className={cn(
                      TRADE_SURFACE_CARD_CLASS,
                      "h-auto w-full justify-between rounded-sm px-4 py-4 text-left hover:bg-white/[0.05]"
                    )}
                    onClick={() => {
                      setForm({ ...form, method: "manual" });
                      setStep(2);
                    }}
                  >
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-sm font-medium text-white">
                        Manual account
                      </span>
                      <span className="text-xs text-white/45">
                        Create an account first, then add trades manually from
                        inside the platform.
                      </span>
                    </div>
                    <span
                      className={cn(
                        TRADE_IDENTIFIER_PILL_CLASS,
                        TRADE_IDENTIFIER_TONES.neutral,
                        "min-h-6 px-2 py-0.5 text-[10px]"
                      )}
                    >
                      Manual entry
                    </span>
                  </Button>

                  <Button
                    className={cn(
                      TRADE_SURFACE_CARD_CLASS,
                      "h-auto w-full justify-between rounded-sm px-4 py-4 text-left hover:bg-white/[0.05]"
                    )}
                    onClick={() => {
                      setForm({ ...form, method: "broker" });
                      setStep(2);
                    }}
                  >
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-sm font-medium text-white">
                        Broker sync
                      </span>
                      <span className="text-xs text-white/45">
                        Connect through the Connections page for direct broker
                        and platform sync.
                      </span>
                    </div>
                    <span
                      className={cn(
                        TRADE_IDENTIFIER_PILL_CLASS,
                        TRADE_IDENTIFIER_TONES.info,
                        "min-h-6 px-2 py-0.5 text-[10px]"
                      )}
                    >
                      Recommended
                    </span>
                  </Button>

                  <Button
                    className={cn(
                      TRADE_SURFACE_CARD_CLASS,
                      "h-auto w-full justify-between rounded-sm px-4 py-4 text-left hover:bg-white/[0.05]"
                    )}
                    onClick={() => {
                      setForm({ ...form, method: "ea" });
                      setStep(2);
                    }}
                  >
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-sm font-medium text-white">
                        EA sync
                      </span>
                      <span className="text-xs text-white/45">
                        Use the MT5 EA bridge for terminal-side sync and
                        advanced intratrade metrics.
                      </span>
                    </div>
                    <span
                      className={cn(
                        TRADE_IDENTIFIER_PILL_CLASS,
                        TRADE_IDENTIFIER_TONES.live,
                        "min-h-6 px-2 py-0.5 text-[10px]"
                      )}
                    >
                      MT5 only
                    </span>
                  </Button>
                </div>
              </div>

              <Separator />
              <div className="px-6 py-3">
                <h3 className={sectionTitleClass}>Demo workspace</h3>
              </div>
              <Separator />
              <div className="px-6 py-5">
                <div className={cn(TRADE_SURFACE_CARD_CLASS, "space-y-4 p-4")}>
                  <div className="flex items-start gap-3">
                    <Sparkles className="mt-0.5 size-4 text-amber-300" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-white">
                        Explore with demo data
                      </p>
                      <p className="text-xs leading-relaxed text-white/45">
                        {demoAccounts.length > 0
                          ? `Replace ${
                              demoAccounts.length
                            } seeded demo workspace${
                              demoAccounts.length === 1 ? "" : "s"
                            } with a fresh fully-populated trading environment.`
                          : "Create a fully-seeded demo account with historical trades and live positions."}
                      </p>
                    </div>
                  </div>
                  <Button
                    className={cn(
                      TRADE_ACTION_BUTTON_PRIMARY_CLASS,
                      "h-9 w-full ring-1 ring-amber-400/20 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15"
                    )}
                    onClick={handleDemoWorkspace}
                    disabled={submitting}
                  >
                    <Sparkles className="size-3.5" />
                    {submitting
                      ? demoAccounts.length > 0
                        ? "Regenerating..."
                        : "Creating..."
                      : demoAccounts.length > 0
                      ? "Regenerate demo workspace"
                      : "Try with demo data"}
                  </Button>
                </div>
              </div>

              <Separator />
              <div className="px-6 py-5">
                <SheetClose asChild>
                  <Button
                    className={cn(TRADE_ACTION_BUTTON_CLASS, "h-9 w-full")}
                  >
                    Cancel
                  </Button>
                </SheetClose>
              </div>
            </>
          )}

          {step === 2 && form.method === "csv" && (
            <>
              <Separator />
              <div className="px-6 py-3">
                <h3 className={sectionTitleClass}>Account details</h3>
              </div>
              <Separator />
              <div className="px-6 py-5">
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label className={fieldLabelClass}>Account name</Label>
                    <Input
                      placeholder="e.g. FTMO 100k Live"
                      className={fieldInputClass}
                      value={form.name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, name: e.target.value }))
                      }
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label className={fieldLabelClass}>Broker</Label>
                    <Select
                      value={form.broker}
                      onValueChange={(v) => {
                        setPendingCsvImportResolution(null);
                        setForm((f) => ({
                          ...f,
                          broker: v,
                          files: brokerSupportsMultiCsvImport(v)
                            ? f.files
                            : f.files.slice(0, 1),
                        }));
                      }}
                    >
                      <SelectTrigger className={fieldSelectTriggerClass}>
                        <SelectValue placeholder="Select a broker" />
                      </SelectTrigger>

                      <SelectContent className={fieldSelectContentClass}>
                        {BROKER_OPTIONS.map((b) => (
                          <SelectItem
                            key={b.value}
                            value={b.value}
                            className={fieldSelectItemClass}
                          >
                            <div className="flex items-center gap-2.5">
                              <img
                                src={b.image}
                                alt={b.label}
                                className="h-4 w-4 object-contain"
                              />
                              {b.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.broker === "tradovate" ? (
                      <p className="text-xs leading-relaxed text-white/40">
                        Tradovate CSV import currently supports bundle uploads.
                        Start with{" "}
                        <span className="text-white/65">Performance</span> or{" "}
                        <span className="text-white/65">Position History</span>{" "}
                        as the base report, then add{" "}
                        <span className="text-white/65">
                          {selectedBrokerSupplementalReports
                            .filter(
                              (report) =>
                                report !== "Performance" &&
                                report !== "Position History"
                            )
                            .join(", ")}
                        </span>{" "}
                        in the same import for richer metadata.
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-2">
                    <Label className={fieldLabelClass}>
                      Initial account balance
                    </Label>
                    <div className="flex items-center gap-0">
                      <Select
                        value={form.initialCurrency}
                        onValueChange={(v: "$" | "£" | "€") =>
                          setForm((f) => ({ ...f, initialCurrency: v }))
                        }
                      >
                        <SelectTrigger
                          className={cn(
                            fieldSelectTriggerClass,
                            "w-16 rounded-r-none"
                          )}
                          style={{ borderRightWidth: 0 }}
                        >
                          <SelectValue placeholder="$" />
                        </SelectTrigger>
                        <SelectContent className={fieldSelectContentClass}>
                          {(["$", "£", "€"] as const).map((c) => (
                            <SelectItem
                              key={c}
                              value={c}
                              className={fieldSelectItemClass}
                            >
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="$100,000"
                        className={cn(fieldInputClass, "flex-1 rounded-l-none")}
                        style={{ borderLeftWidth: 0 }}
                        value={form.initialBalance}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            initialBalance: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Separator />
              <div className="px-6 py-3">
                <h3 className={sectionTitleClass}>Upload file</h3>
              </div>
              <Separator />
              <div className="px-6 py-5">
                <CsvUpload
                  multiple={canQueueMultipleCsvFiles}
                  onFilesChange={(files) => {
                    setPendingCsvImportResolution(null);
                    setForm((prev) => ({ ...prev, files }));
                  }}
                />
                {!form.broker ? (
                  <p className="mt-3 text-xs leading-relaxed text-white/40">
                    You can queue multiple files before choosing a broker. If
                    you later pick a broker that does not support bundle
                    imports, only the first file will be kept.
                  </p>
                ) : null}
              </div>

              <Separator />
              <div className="px-6 py-5">
                {pendingCsvImportResolution ? (
                  <div className="mb-4 rounded-sm ring-1 ring-amber-400/20 bg-amber-400/5 p-4">
                    <p className="text-sm font-medium text-white">
                      This Tradovate CSV bundle matches an existing imported
                      account.
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-white/55">
                      Matched account:{" "}
                      <span className="text-white/80">
                        {pendingCsvImportResolution.matchedAccount.name}
                      </span>
                      {pendingCsvImportResolution.matchedAccount.accountNumber
                        ? ` (${pendingCsvImportResolution.matchedAccount.accountNumber})`
                        : ""}
                      . Choose whether to enrich that account or create a new
                      duplicate account intentionally.
                    </p>
                    {pendingCsvImportResolution.warnings.length > 0 ? (
                      <p className="mt-2 text-xs leading-relaxed text-white/40">
                        {pendingCsvImportResolution.warnings[0]}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        className={cn(
                          TRADE_ACTION_BUTTON_PRIMARY_CLASS,
                          "h-8 px-3"
                        )}
                        disabled={submitting}
                        onClick={() =>
                          handleSubmitCSV({
                            existingAccountAction: "enrich",
                            existingAccountId:
                              pendingCsvImportResolution.matchedAccount.id,
                          })
                        }
                      >
                        Enrich existing account
                      </Button>
                      <Button
                        type="button"
                        className={cn(TRADE_ACTION_BUTTON_CLASS, "h-8 px-3")}
                        disabled={submitting}
                        onClick={() =>
                          handleSubmitCSV({
                            existingAccountAction: "create_duplicate",
                            existingAccountId:
                              pendingCsvImportResolution.matchedAccount.id,
                          })
                        }
                      >
                        Create duplicate account
                      </Button>
                    </div>
                  </div>
                ) : null}
                <div className="flex w-full gap-2">
                  <Button
                    className={cn(TRADE_ACTION_BUTTON_CLASS, "h-9 flex-1")}
                    onClick={() => setStep(1)}
                  >
                    Back
                  </Button>

                  <Button
                    className={cn(
                      TRADE_ACTION_BUTTON_PRIMARY_CLASS,
                      "h-9 flex-1",
                      !canSubmit && "opacity-60"
                    )}
                    disabled={!canSubmit || submitting}
                    onClick={() => handleSubmitCSV()}
                  >
                    {submitting ? "Uploading..." : "Upload"}
                  </Button>
                </div>
              </div>
            </>
          )}

          {step === 2 && form.method === "manual" && (
            <>
              <Separator />
              <div className="px-6 py-3">
                <h3 className={sectionTitleClass}>Account details</h3>
              </div>
              <Separator />
              <div className="px-6 py-5">
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label className={fieldLabelClass}>Account name</Label>
                    <Input
                      placeholder="e.g. Personal journal account"
                      className={fieldInputClass}
                      value={form.name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, name: e.target.value }))
                      }
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label className={fieldLabelClass}>
                      Broker or prop firm
                    </Label>
                    <Input
                      placeholder="e.g. FTMO, IC Markets, Tradovate"
                      className={fieldInputClass}
                      value={form.broker}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, broker: e.target.value }))
                      }
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label className={fieldLabelClass}>Platform type</Label>
                    <Select
                      value={form.brokerType}
                      onValueChange={(value: ManualAccountBrokerType) =>
                        setForm((f) => ({
                          ...f,
                          brokerType: value,
                          brokerServer:
                            value === "mt4" || value === "mt5"
                              ? f.brokerServer
                              : "",
                        }))
                      }
                    >
                      <SelectTrigger className={fieldSelectTriggerClass}>
                        <SelectValue placeholder="Select a platform" />
                      </SelectTrigger>
                      <SelectContent className={fieldSelectContentClass}>
                        {MANUAL_ACCOUNT_BROKER_TYPE_OPTIONS.map((option) => (
                          <SelectItem
                            key={option.value}
                            value={option.value}
                            className={fieldSelectItemClass}
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {(form.brokerType === "mt4" || form.brokerType === "mt5") && (
                    <div className="grid gap-2">
                      <Label className={fieldLabelClass}>Broker server</Label>
                      <Input
                        placeholder="e.g. FTMO-Demo or ICMarketsSC-Live07"
                        className={fieldInputClass}
                        value={form.brokerServer}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            brokerServer: e.target.value,
                          }))
                        }
                      />
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Label className={fieldLabelClass}>
                      Account number or login
                    </Label>
                    <Input
                      placeholder="Optional"
                      className={fieldInputClass}
                      value={form.accountNumber}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          accountNumber: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label className={fieldLabelClass}>
                      Starting account balance
                    </Label>
                    <div className="flex items-center gap-0">
                      <Select
                        value={form.initialCurrency}
                        onValueChange={(v: "$" | "£" | "€") =>
                          setForm((f) => ({ ...f, initialCurrency: v }))
                        }
                      >
                        <SelectTrigger
                          className={cn(
                            fieldSelectTriggerClass,
                            "w-20 rounded-r-none"
                          )}
                          style={{ borderRightWidth: 0 }}
                        >
                          <SelectValue placeholder="$" />
                        </SelectTrigger>
                        <SelectContent className={fieldSelectContentClass}>
                          {(["$", "£", "€"] as const).map((c) => (
                            <SelectItem
                              key={c}
                              value={c}
                              className={fieldSelectItemClass}
                            >
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="$100,000"
                        className={cn(fieldInputClass, "flex-1 rounded-l-none")}
                        style={{ borderLeftWidth: 0 }}
                        value={form.initialBalance}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            initialBalance: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Separator />
              <div className="px-6 py-3">
                <h3 className={sectionTitleClass}>Manual trade entry</h3>
              </div>
              <Separator />
              <div className="px-6 py-5">
                <div className={cn(TRADE_SURFACE_CARD_CLASS, "space-y-3 p-4")}>
                  <p className="text-sm font-medium text-white">
                    Log trades directly in ProfitEdge
                  </p>
                  <p className="text-xs leading-relaxed text-white/45">
                    After creating the account, use the manual trade entry flow
                    from your trades view or account widgets to add closed
                    trades one by one.
                  </p>
                </div>
              </div>

              <Separator />
              <div className="px-6 py-5">
                <div className="flex w-full gap-2">
                  <Button
                    className={cn(TRADE_ACTION_BUTTON_CLASS, "h-9 flex-1")}
                    onClick={() => setStep(1)}
                  >
                    Back
                  </Button>

                  <Button
                    className={cn(
                      TRADE_ACTION_BUTTON_PRIMARY_CLASS,
                      "h-9 flex-1",
                      !canSubmit && "opacity-60"
                    )}
                    disabled={!canSubmit || submitting}
                    onClick={handleManualAccountCreate}
                  >
                    {submitting ? "Creating..." : "Create account"}
                  </Button>
                </div>
              </div>
            </>
          )}

          {step === 2 && form.method === "broker" && (
            <>
              <Separator />
              <div className="px-6 py-3">
                <h3 className={sectionTitleClass}>Connections</h3>
              </div>
              <Separator />
              <div className="px-6 py-5">
                <div className={cn(TRADE_SURFACE_CARD_CLASS, "space-y-4 p-4")}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Plug className="size-4 text-blue-300" />
                        <p className="text-sm font-medium text-white">
                          Direct platform sync
                        </p>
                      </div>
                      <p className="text-xs leading-relaxed text-white/45">
                        Connect MetaTrader 5, cTrader, Match-Trader, or
                        TradeLocker from the Connections page. ProfitEdge
                        handles the sync workflow from there.
                      </p>
                    </div>
                    <span
                      className={cn(
                        TRADE_IDENTIFIER_PILL_CLASS,
                        TRADE_IDENTIFIER_TONES.info,
                        "min-h-6 px-2 py-0.5 text-[10px]"
                      )}
                    >
                      Recommended
                    </span>
                  </div>

                  <Button
                    asChild
                    className={cn(
                      TRADE_ACTION_BUTTON_PRIMARY_CLASS,
                      "h-9 w-full"
                    )}
                  >
                    <Link
                      href="/dashboard/settings/connections"
                      onClick={() => setSheetOpen(false)}
                    >
                      <ExternalLink className="size-3.5" />
                      Go to Connections
                    </Link>
                  </Button>
                </div>
              </div>

              <Separator />
              <div className="px-6 py-3">
                <h3 className={sectionTitleClass}>What to expect</h3>
              </div>
              <Separator />
              <div className="px-6 py-5">
                <div className={cn(TRADE_SURFACE_CARD_CLASS, "space-y-3 p-4")}>
                  <ol className="space-y-2 text-sm text-white/70">
                    <li>1. Open Connections.</li>
                    <li>2. Choose the provider you want to link.</li>
                    <li>
                      3. Complete the connection and let sync create or link the
                      account.
                    </li>
                  </ol>
                  <p className="text-xs leading-relaxed text-white/40">
                    Use this flow for supported direct platform and broker sync.
                    It is the main path for non-EA account connections.
                  </p>
                </div>
              </div>

              <Separator />
              <div className="px-6 py-5">
                <Button
                  className={cn(TRADE_ACTION_BUTTON_CLASS, "h-9 w-full")}
                  onClick={() => setStep(1)}
                >
                  Back
                </Button>
              </div>
            </>
          )}

          {step === 2 && form.method === "ea" && (
            <>
              <Separator />
              <div className="px-6 py-3">
                <h3 className={sectionTitleClass}>MT5 EA bridge</h3>
              </div>
              <Separator />
              <div className="px-6 py-5">
                <div className={cn(TRADE_SURFACE_CARD_CLASS, "space-y-4 p-4")}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Cpu className="size-4 text-teal-300" />
                        <p className="text-sm font-medium text-white">
                          Terminal-side MT5 sync
                        </p>
                      </div>
                      <p className="text-xs leading-relaxed text-white/45">
                        Use the EA bridge when you want MT5 terminal sync plus
                        the advanced intratrade metrics the API path cannot
                        capture.
                      </p>
                    </div>
                    <span
                      className={cn(
                        TRADE_IDENTIFIER_PILL_CLASS,
                        TRADE_IDENTIFIER_TONES.live,
                        "min-h-6 px-2 py-0.5 text-[10px]"
                      )}
                    >
                      MT5 only
                    </span>
                  </div>

                  <Button
                    asChild
                    className={cn(
                      TRADE_ACTION_BUTTON_PRIMARY_CLASS,
                      "h-9 w-full"
                    )}
                  >
                    <Link
                      href="/dashboard/settings/ea-setup"
                      onClick={() => setSheetOpen(false)}
                    >
                      <ExternalLink className="size-3.5" />
                      Go to EA Setup
                    </Link>
                  </Button>
                </div>
              </div>

              <Separator />
              <div className="px-6 py-3">
                <h3 className={sectionTitleClass}>What to expect</h3>
              </div>
              <Separator />
              <div className="px-6 py-5">
                <div className={cn(TRADE_SURFACE_CARD_CLASS, "space-y-3 p-4")}>
                  <ol className="space-y-2 text-sm text-white/70">
                    <li>1. Open EA Setup.</li>
                    <li>2. Generate the key and install the EA in MT5.</li>
                    <li>
                      3. Attach the EA and let the first sync register the
                      account.
                    </li>
                  </ol>
                  <p className="text-xs leading-relaxed text-white/40">
                    Use this flow when you specifically want MT5 terminal-side
                    sync and the richer analytics captured by the EA bridge.
                  </p>
                </div>
              </div>

              <Separator />
              <div className="px-6 py-5">
                <Button
                  className={cn(TRADE_ACTION_BUTTON_CLASS, "h-9 w-full")}
                  onClick={() => setStep(1)}
                >
                  Back
                </Button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <Separator />
              <div className="px-6 py-3">
                <h3 className={sectionTitleClass}>Account ready</h3>
              </div>
              <Separator />
              <div className="px-6 py-5">
                <div className={cn(TRADE_SURFACE_CARD_CLASS, "space-y-2 p-4")}>
                  <p className="text-sm font-medium text-white">
                    Your account has been added successfully.
                  </p>
                  <p className="text-xs leading-relaxed text-white/45">
                    {form.method === "manual"
                      ? "It is now available in the account switcher and ready for manual trade entry across the dashboard."
                      : "It is now available in the account switcher and ready to use across the dashboard."}
                  </p>
                </div>
              </div>

              <Separator />
              <div className="px-6 py-5">
                <SheetClose asChild>
                  <Button
                    className={cn(
                      TRADE_ACTION_BUTTON_PRIMARY_CLASS,
                      "h-9 w-full"
                    )}
                    onClick={() => setSheetOpen(false)}
                  >
                    Done
                  </Button>
                </SheetClose>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
