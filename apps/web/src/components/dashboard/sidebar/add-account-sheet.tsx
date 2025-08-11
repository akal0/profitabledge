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

export type AddAccountForm = {
  method: "csv" | "broker" | null;
  name: string;
  broker: string;
  file: File | null;
};

export type NewAccount = {
  id: string;
  name: string;
  image: string;
};

const BROKERS: { value: string; label: string; image: string }[] = [
  { value: "ftmo", label: "FTMO", image: "/FTMO.png" },
  { value: "myforexfunds", label: "MyForexFunds", image: "/FTMO.png" },
  { value: "fundingpips", label: "FundingPips", image: "/FTMO.png" },
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
    setForm({ method: null, name: "", broker: "", file: null });
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetAll();
  }

  async function handleSubmitCSV() {
    if (!canSubmit || !form.file) return;
    setSubmitting(true);

    try {
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
    } catch (e) {
      console.error(e);
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button variant="secondary" size="sm" className="w-full gap-2">
          <Plus className="size-3" /> Add an account
        </Button>
      </SheetTrigger>

      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>
            {step === 1
              ? "Add an account"
              : step === 2
              ? form.method === "csv"
                ? "Import via CSV"
                : "Sync via Broker"
              : "Account added"}
          </SheetTitle>
          <SheetDescription>
            {step === 1 && "Choose how you want to add your trading account."}
            {step === 2 &&
              form.method === "csv" &&
              "Upload your CSV and enter basic details."}
            {step === 2 &&
              form.method === "broker" &&
              "Enter broker credentials to sync (coming soon)."}
            {step === 3 && "Your account has been added to the switcher."}
          </SheetDescription>
        </SheetHeader>

        {step === 1 && (
          <div className="flex flex-col gap-3 p-4">
            <Button
              className="justify-start"
              onClick={() => {
                setForm({ ...form, method: "csv" });
                setStep(2);
              }}
            >
              Import account via CSV
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => {
                setForm({ ...form, method: "broker" });
                setStep(2);
              }}
            >
              Automatically sync via broker
            </Button>
          </div>
        )}

        {step === 2 && form.method === "csv" && (
          <div className="flex flex-col gap-4 p-4">
            <div className="grid gap-2">
              <label className="text-xs font-medium">CSV file</label>
              <Input
                type="file"
                accept=".csv"
                onChange={(e) =>
                  setForm((f) => ({ ...f, file: e.target.files?.[0] || null }))
                }
              />
            </div>

            <div className="grid gap-2">
              <label className="text-xs font-medium">Account name</label>
              <Input
                placeholder="e.g., FTMO 100k Live"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <label className="text-xs font-medium">Broker</label>
              <Select
                value={form.broker}
                onValueChange={(v) => setForm((f) => ({ ...f, broker: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a broker" />
                </SelectTrigger>
                <SelectContent>
                  {BROKERS.map((b) => (
                    <SelectItem key={b.value} value={b.value}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 2 && form.method === "broker" && (
          <div className="p-4 text-xs text-secondary">
            Broker sync setup coming soon.
          </div>
        )}

        <SheetFooter>
          {step === 1 && (
            <SheetClose asChild>
              <Button variant="outline">Cancel</Button>
            </SheetClose>
          )}

          {step === 2 && form.method === "csv" && (
            <div className="flex w-full gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep(1)}
              >
                Back
              </Button>
              <Button
                className="flex-1"
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
                variant="outline"
                className="flex-1"
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
