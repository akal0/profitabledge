"use client";

import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { trpcOptions } from "@/utils/trpc";
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

export type AddAccountForm = {
  method: "csv" | "broker" | "ea" | null;
  name: string;
  broker: string;
  initialCurrency: "$" | "£" | "€" | "";
  initialBalance: string;
  file: File | null;
};

export type NewAccount = {
  id: string;
  name: string;
  image: string;
};

const BROKERS: { value: string; label: string; image: string }[] = [
  { value: "ftmo", label: "FTMO", image: "/brokers/FTMO.png" },
  { value: "fundingpips", label: "FundingPips", image: "/brokers/FTMO.png" },
  {
    value: "alphacapitalgroup",
    label: "AlphaCapitalGroup",
    image: "/brokers/FTMO.png",
  },
  {
    value: "seacrestfunded",
    label: "SeacrestFunded",
    image: "/brokers/FTMO.png",
  },
];

const DEMO_ACCOUNT_NAME = "Demo Account";
const DEMO_BROKER = "ProfitEdge Demo";
const DEMO_BROKER_SERVER = "ProfitEdge-Demo01";
const DEMO_ACCOUNT_PREFIX = "DEMO-";

export function AddAccountSheet({
  onAccountCreated,
  trigger,
}: {
  onAccountCreated: (account: NewAccount) => void;
  trigger?: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<AddAccountForm>({
    method: null,
    name: "",
    broker: "",
    initialCurrency: "$",
    initialBalance: "",
    file: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const { data: rawAccounts } = useQuery(
    trpcOptions.accounts.list.queryOptions()
  );
  const accounts = (rawAccounts as any[] | undefined) ?? [];

  const demoAccounts = useMemo(
    () =>
      accounts.filter((account: any) => {
        const accountNumber = String(account.accountNumber || "");
        return (
          account.name === DEMO_ACCOUNT_NAME &&
          account.broker === DEMO_BROKER &&
          account.brokerServer === DEMO_BROKER_SERVER &&
          accountNumber.startsWith(DEMO_ACCOUNT_PREFIX)
        );
      }),
    [accounts]
  );

  const canSubmit = useMemo(() => {
    if (form.method === "csv") {
      return Boolean(form.file && form.name && form.broker);
    }
    return false;
  }, [form]);

  function resetAll() {
    setStep(1);
    setForm({
      method: null,
      name: "",
      broker: "",
      initialCurrency: "$",
      initialBalance: "",
      file: null,
    });
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetAll();
  }

  async function handleSubmitCSV() {
    if (!canSubmit || !form.file) return;
    setSubmitting(true);

    try {
      const normalizeBalance = (input: string): number | undefined => {
        const cleaned = String(input || "").replace(/[^0-9.\-]/g, "");
        if (!cleaned) return undefined;
        const n = Number(cleaned);
        return Number.isFinite(n) && n >= 0 ? n : undefined;
      };

      const fileAsBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(",")[1] || "";
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(form.file!);
      });

      const res = await trpcClient.upload.importCsv.mutate({
        name: form.name,
        broker: form.broker,
        initialBalance: normalizeBalance(form.initialBalance),
        initialCurrency: (form.initialCurrency || "$") as "$" | "£" | "€",
        csvBase64: fileAsBase64,
      });

      const brokerMeta = BROKERS.find((b) => b.value === form.broker);
      onAccountCreated({
        id: res.accountId,
        name: form.name,
        image: brokerMeta?.image || "/FTMO.png",
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

  async function refreshAccounts() {
    await queryClient.invalidateQueries({ queryKey: ["accounts"] });
  }

  async function handleDemoWorkspace() {
    try {
      setSubmitting(true);
      const result =
        demoAccounts.length > 0
          ? await trpcClient.accounts.resetDemoWorkspace.mutate()
          : await trpcClient.accounts.createSampleAccount.mutate();

      await refreshAccounts();

      const resetCount =
        typeof (result as any).resetCount === "number"
          ? (result as any).resetCount
          : 0;

      toast.success(
        demoAccounts.length > 0
          ? `Demo workspace regenerated. Replaced ${resetCount} seeded demo account${
              resetCount === 1 ? "" : "s"
            } with ${result.tradeCount} trades and ${
              result.openTradeCount
            } live positions.`
          : `Demo account created with ${result.tradeCount} trades and ${result.openTradeCount} live positions.`
      );

      onAccountCreated({
        id: result.account.id,
        name: result.account.name,
        image: "",
      });

      setOpen(false);
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
        ? "Import account with CSV upload"
        : form.method === "broker"
        ? "Broker sync"
        : "EA sync"
      : "Account ready";

  const sheetDescription =
    step === 1
      ? "Choose how you want to add your trading account."
      : step === 2 && form.method === "csv"
      ? "Upload your CSV and enter the details for this trading account."
      : step === 2 && form.method === "broker"
      ? "Use Connections to sync supported broker and platform accounts directly."
      : step === 2 && form.method === "ea"
      ? "Use the MT5 EA bridge for terminal-based sync and richer trade analytics."
      : "Your account has been added to the account switcher.";

  const sectionTitleClass =
    "text-xs font-semibold text-white/70 tracking-wide";
  const fieldLabelClass = "text-xs text-white/50";
  const fieldInputClass =
    "rounded-sm border-white/8 bg-white/[0.03] px-4 text-xs text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] placeholder:text-white/25 hover:brightness-100";
  const fieldSelectTriggerClass =
    "h-9 rounded-sm border-white/8 bg-white/[0.03] px-4 text-xs text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]";
  const fieldSelectContentClass =
    "rounded-sm border border-white/8 bg-sidebar p-1 text-white/80";
  const fieldSelectItemClass =
    "rounded-sm px-4 py-2.5 text-xs text-white/80 data-[highlighted]:bg-sidebar-accent/80";

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        {trigger || (
          <Button className="border border-white/5 cursor-pointer flex transform items-center justify-center gap-2 rounded-md py-3 transition-all active:scale-95 bg-sidebar-accent text-white w-full text-xs hover:bg-[#222225] hover:!brightness-120 hover:text-white duration-250">
            <div className="flex items-center gap-2 truncate">
              <Plus className="size-3.5" />
              <span className=" truncate">Add an account</span>
            </div>
          </Button>
        )}
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto rounded-md p-0"
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
                        Import account via CSV
                      </span>
                      <span className="text-xs text-white/45">
                        Upload a statement export and create a new account from
                        it.
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
                          ? `Replace ${demoAccounts.length} seeded demo workspace${
                              demoAccounts.length === 1 ? "" : "s"
                            } with a fresh fully-populated trading environment.`
                          : "Create a fully-seeded demo account with historical trades and live positions."}
                      </p>
                    </div>
                  </div>
                  <Button
                    className={cn(
                      TRADE_ACTION_BUTTON_PRIMARY_CLASS,
                      "h-9 w-full border-amber-400/20 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15"
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
                  <Button className={cn(TRADE_ACTION_BUTTON_CLASS, "h-9 w-full")}>
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
                <h3 className={sectionTitleClass}>Upload CSV</h3>
              </div>
              <Separator />
              <div className="px-6 py-5">
                <CsvUpload
                  onFileChange={(f) => setForm((prev) => ({ ...prev, file: f }))}
                />
              </div>

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
                      onValueChange={(v) => setForm((f) => ({ ...f, broker: v }))}
                    >
                      <SelectTrigger className={fieldSelectTriggerClass}>
                        <SelectValue placeholder="Select a broker" />
                      </SelectTrigger>

                      <SelectContent className={fieldSelectContentClass}>
                        {BROKERS.map((b) => (
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
                            "w-20 rounded-r-none border-r-0"
                          )}
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
                        className={cn(
                          fieldInputClass,
                          "flex-1 rounded-l-none border-l-0"
                        )}
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
                    onClick={handleSubmitCSV}
                  >
                    {submitting ? "Uploading..." : "Upload"}
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
                      onClick={() => setOpen(false)}
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
                    <li>3. Complete the connection and let sync create or link the account.</li>
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
                      onClick={() => setOpen(false)}
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
                    <li>3. Attach the EA and let the first sync register the account.</li>
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
                    It is now available in the account switcher and ready to use
                    across the dashboard.
                  </p>
                </div>
              </div>

              <Separator />
              <div className="px-6 py-5">
                <SheetClose asChild>
                  <Button
                    className={cn(TRADE_ACTION_BUTTON_PRIMARY_CLASS, "h-9 w-full")}
                    onClick={() => setOpen(false)}
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
