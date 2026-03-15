"use client";

import React, { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileUp, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

import CsvUpload from "@/components/upload/CsvUpload";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { trpcClient } from "@/utils/trpc";
import {
  getBrokerLabel,
  getBrokerSupplementalCsvReports,
} from "@/features/accounts/lib/account-metadata";
import { getCsvImportFeedbackMessage } from "@/features/accounts/lib/csv-import-feedback";

type CsvAccountEnrichmentSheetProps = {
  accountId: string;
  accountName: string;
  broker: string;
  trigger?: React.ReactNode;
};

export function CsvAccountEnrichmentSheet({
  accountId,
  accountName,
  broker,
  trigger,
}: CsvAccountEnrichmentSheetProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const brokerLabel = useMemo(() => getBrokerLabel(broker), [broker]);
  const supportedReports = useMemo(
    () => getBrokerSupplementalCsvReports(broker),
    [broker]
  );

  const canSubmit = files.length > 0 && !submitting;

  function resetState() {
    setFiles([]);
    setSubmitting(false);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      resetState();
    }
  }

  async function fileToBase64(file: File): Promise<string> {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1] || "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleSubmit() {
    if (!canSubmit) {
      return;
    }

    setSubmitting(true);

    try {
      const encodedFiles = await Promise.all(
        files.map(async (file) => ({
          fileName: file.name,
          csvBase64: await fileToBase64(file),
        }))
      );

      const result = await trpcClient.upload.enrichCsvAccount.mutate({
        accountId,
        files: encodedFiles,
      });

      await queryClient.invalidateQueries();

      if (result.noNewData) {
        toast.info(getCsvImportFeedbackMessage(result));
        if (result.warnings.length > 0) {
          toast.info(result.warnings[0]);
        }
        setSubmitting(false);
        setOpen(false);
        resetState();
        return;
      }

      if (
        result.tradesCreated === 0 &&
        result.tradesUpdated === 0 &&
        result.accountMetadataUpdated
      ) {
        toast.success(getCsvImportFeedbackMessage(result));
        setSubmitting(false);
        setOpen(false);
        resetState();
        return;
      }

      toast.success(getCsvImportFeedbackMessage(result));

      if (result.warnings.length > 0) {
        toast.info(result.warnings[0]);
      }

      setOpen(false);
      resetState();
    } catch (error: any) {
      toast.error(
        error?.message || `Failed to enrich ${brokerLabel} account import`
      );
      setSubmitting(false);
    }
  }

  const fieldLabelClass = "text-xs text-white/50";
  const helperTextClass = "text-xs leading-relaxed text-white/40";

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button
            className="cursor-pointer flex items-center justify-center gap-2 py-2 h-9 transition-all active:scale-95 text-white text-xs hover:brightness-110 duration-250 border border-white/5 bg-sidebar rounded-sm hover:bg-sidebar-accent px-3"
            type="button"
          >
            <FileUp className="size-3.5" />
            <span className="hidden lg:inline">Import additional CSVs</span>
            <span className="lg:hidden">CSVs</span>
          </Button>
        )}
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-full max-w-xl border-white/10 bg-sidebar px-0 text-white sm:max-w-xl"
      >
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-white/10 px-6 py-5 text-left">
            <SheetTitle className="text-base font-semibold text-white">
              Enrich {brokerLabel} import
            </SheetTitle>
            <SheetDescription className="text-sm text-white/50">
              Upload additional {brokerLabel} CSV reports to enrich{" "}
              <span className="text-white/70">{accountName}</span> without
              creating a new account.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
            <div className="rounded-sm border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
                <RefreshCcw className="size-4 text-teal-300" />
                Supported reports
              </div>
              <p className={helperTextClass}>
                Re-uploading a base report can repair existing trade rows. Extra
                reports add commissions, order metadata, and other broker-native
                details when available.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {supportedReports.map((report) => (
                  <span
                    key={report}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/65"
                  >
                    {report}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <Label className={fieldLabelClass}>CSV files</Label>
              <CsvUpload
                multiple
                disabled={submitting}
                maxSize={25 * 1024 * 1024}
                onFilesChange={setFiles}
                className={cn(
                  "rounded-sm border border-dashed border-white/10 bg-white/[0.02]"
                )}
              />
              <p className={helperTextClass}>
                Upload one or more reports from the same Tradovate export set.
                Performance or Position History can be used as the base trade
                source, and the other files will be merged where possible.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-white/10 px-6 py-4">
            <Button
              type="button"
              variant="ghost"
              className="text-white/60 hover:bg-white/5 hover:text-white"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="cursor-pointer bg-teal-600 text-white hover:bg-teal-500"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {submitting ? "Uploading..." : "Enrich account"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
