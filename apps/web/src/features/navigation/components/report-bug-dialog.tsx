"use client";

import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Bug, ImagePlus, Loader2, Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { getPropAssignActionButtonClassName } from "@/features/accounts/lib/prop-assign-action-button";
import { isMissingTrpcProcedureError } from "@/features/navigation/lib/support-feedback-fallback";
import { useUploadThing } from "@/utils/uploadthing";
import { trpcOptions } from "@/utils/trpc";

const MAX_SCREENSHOT_SIZE_BYTES = 4 * 1024 * 1024;

function deriveSummaryFromDetails(details: string) {
  const normalized = details.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "";
  }

  const sentence = normalized.match(/.+?[.!?](?:\s|$)/)?.[0]?.trim();
  const candidate = sentence || normalized;

  return candidate.slice(0, 160).trim();
}

function resolveBugReportSummary(summary: string, details: string) {
  const normalizedSummary = summary.replace(/\s+/g, " ").trim();

  if (normalizedSummary.length >= 4) {
    return normalizedSummary.slice(0, 160);
  }

  const derivedSummary = deriveSummaryFromDetails(details);

  if (derivedSummary.length >= 4) {
    return derivedSummary;
  }

  return "Bug report";
}

function formatFileSize(sizeInBytes: number) {
  if (sizeInBytes >= 1024 * 1024) {
    return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(sizeInBytes / 1024))} KB`;
}

export function ReportBugDialog({
  open,
  onOpenChange,
  pagePath,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pagePath: string;
}) {
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);

  const submitBugReport = useMutation(
    trpcOptions.operations.submitBugReport.mutationOptions()
  );
  const submitFallbackFeedback = useMutation(
    trpcOptions.operations.submitFeedback.mutationOptions()
  );
  const {
    startUpload: startScreenshotUpload,
    isUploading: isScreenshotUploading,
  } = useUploadThing((routeRegistry) => routeRegistry.imageUploader);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSummary("");
    setDetails("");
    setScreenshotFile(null);

    if (screenshotInputRef.current) {
      screenshotInputRef.current.value = "";
    }
  }, [open]);

  const trimmedDetails = details.trim();
  const minimumDetailsLength = 10;
  const remainingDetailsCharacters = Math.max(
    0,
    minimumDetailsLength - trimmedDetails.length
  );
  const hasRequiredDetails = remainingDetailsCharacters === 0;
  const isSubmitting =
    submitBugReport.isPending ||
    submitFallbackFeedback.isPending ||
    isScreenshotUploading;

  const clearScreenshot = () => {
    setScreenshotFile(null);

    if (screenshotInputRef.current) {
      screenshotInputRef.current.value = "";
    }
  };

  const handleScreenshotChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file for the bug screenshot.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_SCREENSHOT_SIZE_BYTES) {
      toast.error("Screenshot must be 4MB or smaller.");
      event.target.value = "";
      return;
    }

    setScreenshotFile(file);
  };

  const handleSubmit = async () => {
    if (!hasRequiredDetails) {
      toast.error("Add a bit more detail before sending it.");
      return;
    }

    const resolvedSummary = resolveBugReportSummary(summary, trimmedDetails);

    let screenshotUrl: string | null = null;

    if (screenshotFile) {
      try {
        const uploadResult = await startScreenshotUpload([screenshotFile]);
        screenshotUrl = uploadResult?.[0]?.ufsUrl ?? uploadResult?.[0]?.url ?? null;

        if (!screenshotUrl) {
          throw new Error("Missing screenshot URL");
        }
      } catch {
        toast.error("Failed to upload screenshot. Remove it or try again.");
        return;
      }
    }

    try {
      const result = await submitBugReport.mutateAsync({
        subject: resolvedSummary,
        message: trimmedDetails,
        pagePath,
        screenshotUrl,
      });

      if (result.deliveryStatus === "created") {
        toast.success("Bug report submitted to GitHub issues.");
      } else if (result.deliveryStatus === "stored_only") {
        toast.success(
          "Bug report saved internally. GitHub forwarding isn't configured yet."
        );
      } else {
        toast.error("Bug report was saved internally, but GitHub forwarding failed.");
      }

      onOpenChange(false);
    } catch (error) {
      if (isMissingTrpcProcedureError(error, "operations.submitBugReport")) {
        try {
          await submitFallbackFeedback.mutateAsync({
            category: "bug",
            priority: "normal",
            subject: resolvedSummary,
            message: trimmedDetails,
            pagePath,
            metadata: {
              origin: "sidebar-report-bug",
              requestType: "bug-report",
              screenshotUrl,
            },
          });

          toast.success(
            "Bug report saved internally. GitHub forwarding isn't available on this server yet."
          );
          onOpenChange(false);
          return;
        } catch (fallbackError) {
          toast.error(
            fallbackError instanceof Error
              ? fallbackError.message
              : "Failed to submit bug report"
          );
          return;
        }
      }

      toast.error(
        error instanceof Error ? error.message : "Failed to submit bug report"
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex flex-col gap-0 overflow-hidden rounded-md border border-white/5 bg-sidebar/5 p-2 shadow-2xl backdrop-blur-lg sm:max-w-2xl"
      >
        <div className="flex max-h-[90vh] flex-col overflow-hidden rounded-sm border border-white/5 bg-sidebar-accent/80">
          <div className="sticky top-0 z-10 flex items-start gap-3 bg-sidebar-accent/80 px-5 py-4">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-white/5 bg-sidebar-accent">
              <Bug className="h-3.5 w-3.5 text-amber-300" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-sm font-medium text-white">
                Report a bug
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs leading-relaxed text-white/40">
                Reports are sent privately to the Profitabledge team, stored
                internally, and forwarded into GitHub issues when the integration
                is configured. Attach a screenshot and we'll include it in the
                issue body.
              </DialogDescription>
            </div>
            <DialogClose asChild>
              <button
                type="button"
                className={getPropAssignActionButtonClassName({
                  tone: "neutral",
                  size: "sm",
                  className: "ml-auto w-8 px-0",
                })}
              >
                <X className="h-3.5 w-3.5" />
                <span className="sr-only">Close</span>
              </button>
            </DialogClose>
          </div>
          <Separator />

          <div className="space-y-4 overflow-y-auto px-5 py-4">
            <div className="space-y-2">
              <Label className="text-xs text-white/60">
                What broke? (optional)
              </Label>
              <Input
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                placeholder="Short summary of the bug, or leave blank and we'll derive it from the details"
                className="border-white/10 bg-white/[0.03] text-white placeholder:text-white/25"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-white/60">Details</Label>
              <Textarea
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                placeholder="Explain what happened, what you expected instead, and how we can reproduce it."
                className="min-h-32 border-white/10 bg-white/[0.03] text-white placeholder:text-white/25"
              />
              <p className="text-[11px] leading-relaxed text-white/35">
                {hasRequiredDetails
                  ? "Leave the summary blank if you want. We'll generate it from the details."
                  : `Add ${remainingDetailsCharacters} more ${
                      remainingDetailsCharacters === 1 ? "character" : "characters"
                    } so we have enough detail to reproduce it.`}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-white/60">
                Screenshot (optional)
              </Label>
              <input
                ref={screenshotInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleScreenshotChange}
              />

              <div className="rounded-sm border border-white/8 bg-white/[0.03] px-3 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => screenshotInputRef.current?.click()}
                    className={getPropAssignActionButtonClassName({
                      tone: "neutral",
                    })}
                  >
                    <ImagePlus className="size-3.5" />
                    {screenshotFile ? "Replace screenshot" : "Choose screenshot"}
                  </Button>

                  {screenshotFile ? (
                    <Button
                      type="button"
                      onClick={clearScreenshot}
                      className={getPropAssignActionButtonClassName({
                        tone: "ghost",
                      })}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>

                <div className="mt-3 rounded-sm border border-white/8 bg-sidebar/40 px-3 py-2">
                  {screenshotFile ? (
                    <div className="flex items-center gap-2 text-xs text-white/65">
                      <Paperclip className="size-3.5 text-white/40" />
                      <span className="truncate">{screenshotFile.name}</span>
                      <span className="text-white/30">
                        {formatFileSize(screenshotFile.size)}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-white/40">
                      PNG, JPG, or WebP up to 4MB. If GitHub forwarding is
                      enabled, the uploaded image link is added to the issue.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-sm border border-white/8 bg-white/[0.03] px-3 py-2">
                <p className="text-xs text-white/40">
                  Current page: <span className="text-white/65">{pagePath}</span>
                </p>
              </div>

              <div className="rounded-sm border border-white/8 bg-white/[0.03] px-3 py-2">
                <p className="text-xs text-white/40">
                  Screenshot:{" "}
                  <span className="text-white/65">
                    {screenshotFile ? "Attached" : "Not attached"}
                  </span>
                </p>
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex flex-col-reverse gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-relaxed text-white/40">
              Reports stay private to the team. We only add the screenshot link
              to the GitHub issue we create for you.
            </p>

            <div className="flex items-center gap-2">
              <DialogClose asChild>
                <Button
                  type="button"
                  className={getPropAssignActionButtonClassName({
                    tone: "neutral",
                  })}
                >
                  Cancel
                </Button>
              </DialogClose>

              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || !hasRequiredDetails}
                className={getPropAssignActionButtonClassName({
                  tone: "teal",
                })}
              >
                {isScreenshotUploading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
                {isSubmitting ? "Submitting..." : "Submit report"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
