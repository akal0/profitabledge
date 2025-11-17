"use client";

import React, { useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
  SheetFooter,
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
import { Plus } from "lucide-react";
import { trpcClient } from "@/utils/trpc";
import { cn } from "@/lib/utils";
import CsvUpload from "@/components/upload/CsvUpload";
import { Label } from "@/components/ui/label";

export type AddAccountForm = {
  method: "csv" | "broker" | null;
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

export function AddAccountSheet({
  onAccountCreated,
}: {
  onAccountCreated: (account: NewAccount) => void;
}) {
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

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button className="border border-white/5 cursor-pointer flex transform items-center justify-center gap-2 rounded-none py-3 transition-all active:scale-95 bg-sidebar-accent text-white w-full text-xs hover:bg-[#222225] hover:!brightness-120 hover:text-white duration-250">
          <div className="flex items-center gap-2 truncate">
            <Plus className="size-3.5" />
            <span className=" truncate">Add an account</span>
          </div>
        </Button>
      </SheetTrigger>

      <SheetContent side="right">
        <SheetHeader className="gap-1 px-8 py-8 pb-2">
          <SheetTitle className="tracking-tight">
            {step === 1
              ? "Connect your account"
              : step === 2
              ? form.method === "csv"
                ? "Import account with CSV upload"
                : "Sync via Broker"
              : "Account connected successfully."}
          </SheetTitle>

          <SheetDescription className="text-[#A0A0A6] text-xs tracking-wide leading-relaxed">
            {step === 1 && "Choose how you want to add your trading account."}
            {step === 2 &&
              form.method === "csv" &&
              "Upload your CSV and enter details relating to your trading account."}
            {step === 2 &&
              form.method === "broker" &&
              "Enter broker credentials to sync (coming soon)."}
            {step === 3 && "Your account has been added to the switcher."}
          </SheetDescription>
        </SheetHeader>

        <div className="w-full h-[2px] bg-[#000]/30 border-b border-[#222225]" />

        <div className="px-4">
          {step === 1 && (
            <div className="flex flex-col gap-2 px-4">
              <Button
                className="border border-white/5 cursor-pointer flex transform items-center justify-center gap-2 rounded-none transition-all active:scale-95 bg-transparent hover:bg-sidebar-accent text-white w-full text-xs hover:!brightness-110 hover:text-white duration-250"
                onClick={() => {
                  setForm({ ...form, method: "csv" });
                  setStep(2);
                }}
              >
                Import account via CSV
              </Button>

              <Button
                className="border border-white/5 cursor-pointer flex transform items-center justify-center gap-2 rounded-none transition-all active:scale-95 bg-[#222225] text-[#A0A0A6] w-full text-xs hover:bg-[#222225] hover:!brightness-120 hover:text-white duration-250 "
                disabled
                onClick={() => {
                  setForm({ ...form, method: "broker" });
                  setStep(2);
                }}
              >
                Broker sync
              </Button>
            </div>
          )}

          {step === 2 && form.method === "csv" && (
            <div className="flex flex-col gap-5 px-4 mt-2">
              <CsvUpload
                onFileChange={(f) => setForm((prev) => ({ ...prev, file: f }))}
              />

              <div className="grid gap-2">
                <label className="text-xs font-medium">Account name</label>

                <Input
                  placeholder="e.g. FTMO 100k Live"
                  className="rounded-none px-4 dark:bg-sidebar-accent"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label className="text-xs font-medium">Broker</Label>

                <Select
                  value={form.broker}
                  onValueChange={(v) => setForm((f) => ({ ...f, broker: v }))}
                >
                  <SelectTrigger className="w-full px-4">
                    <SelectValue placeholder="Select a broker" />
                  </SelectTrigger>

                  <SelectContent className="rounded-none mt-0.5 bg-sidebar-accent border border-white/5">
                    {BROKERS.map((b) => (
                      <SelectItem key={b.value} value={b.value}>
                        <div className="flex items-center gap-2.5">
                          <img
                            src={b.image}
                            alt={b.label}
                            className="w-4 h-4 object-contain"
                          />
                          {b.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label className="text-xs font-medium">
                  Initial account balance
                </Label>
                <div className="flex items-center gap-0">
                  <Select
                    value={form.initialCurrency}
                    onValueChange={(v: "$" | "£" | "€") =>
                      setForm((f) => ({ ...f, initialCurrency: v }))
                    }
                  >
                    <SelectTrigger className="w-20 px-4 border-r-0">
                      <SelectValue placeholder="$" />
                    </SelectTrigger>
                    <SelectContent className="rounded-none mt-0.5 bg-sidebar-accent border border-white/5">
                      {(["$", "£", "€"] as const).map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="$100,000"
                    className="rounded-none px-4 dark:bg-sidebar-accent flex-1"
                    value={form.initialBalance}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, initialBalance: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && form.method === "broker" && (
            <div className="p-4 text-xs text-secondary">
              Broker sync setup coming soon.
            </div>
          )}
        </div>

        <SheetFooter>
          {step === 1 && (
            <SheetClose asChild>
              <Button className="border-[0.5px] border-white/5 cursor-pointer flex transform items-center justify-center gap-2 rounded-none py-3 transition-all active:scale-95 bg-[#222225] text-[#A0A0A6] w-full text-xs hover:bg-[#222225] hover:!brightness-120 hover:text-white duration-250">
                Cancel
              </Button>
            </SheetClose>
          )}

          {step === 2 && form.method === "csv" && (
            <div className="flex w-full gap-2">
              <Button
                className="border border-white/5 cursor-pointer flex transform items-center justify-center gap-2 rounded-none py-3 transition-all active:scale-95 bg-[#222225] text-[#A0A0A6] flex-1 text-xs hover:bg-[#222225] hover:!brightness-120 hover:text-white duration-250"
                onClick={() => setStep(1)}
              >
                Back
              </Button>

              <Button
                className={cn(
                  canSubmit &&
                    "!bg-emerald-600 hover:bg-emerald-500 !text-white",
                  "border border-white/5 cursor-pointer flex transform items-center justify-center gap-2 rounded-none py-3 bg-[#222225] transition-all active:scale-95 text-[#A0A0A6] flex-1 text-xs hover:!brightness-120 hover:text-white duration-250"
                )}
                disabled={!canSubmit || submitting}
                onClick={handleSubmitCSV}
              >
                {submitting ? "Uploading..." : "Upload"}
              </Button>
            </div>
          )}

          {step === 2 && form.method === "broker" && (
            <div className="flex w-full gap-2">
              <Button
                className="shadow-primary-button cursor-pointer flex transform items-center justify-center gap-2 rounded-[6px] py-1 transition-all active:scale-95 bg-[#222225] text-[#A0A0A6] w-full text-xs hover:bg-[#222225] hover:!brightness-120 hover:text-white duration-250"
                onClick={() => setStep(1)}
              >
                Back
              </Button>
              <Button className="flex-1" disabled>
                Continue
              </Button>
            </div>
          )}

          {step === 3 && (
            <SheetClose asChild>
              <Button className="w-full" onClick={() => setOpen(false)}>
                Done
              </Button>
            </SheetClose>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
