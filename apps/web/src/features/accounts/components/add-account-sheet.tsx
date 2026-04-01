"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { Plus, ExternalLink, Sparkles, Plug, Cpu, Loader2 } from "lucide-react";
import { trpcClient, trpcOptions } from "@/utils/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useOnborda } from "onborda";
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
import { showAppNotificationToast } from "@/components/notifications/notification-toast";
import { getCsvImportFeedbackMessage } from "@/features/accounts/lib/csv-import-feedback";
import { useAccountCatalog } from "@/features/accounts/hooks/use-account-catalog";
import { useTourStore } from "@/features/onboarding-tour/tour-store";
import {
  TOUR_ID,
  ADD_ACCOUNT_SHEET_LAST_STEP,
} from "@/features/onboarding-tour/tour-steps";
import {
  fileToBase64,
  MANUAL_ACCOUNT_BROKER_TYPE_OPTIONS,
  normalizeBalanceInput,
  type ManualAccountBrokerType,
} from "@/features/accounts/lib/manual-account";
import { useAccountStore } from "@/stores/account";
import { startTabAttentionActivity } from "@/stores/tab-attention";

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
  isHydrating?: boolean;
  account?: {
    id: string;
    name: string;
    broker?: string | null;
    brokerType?: string | null;
  };
};

type CacheableAccount = {
  id: string;
  name: string;
  broker?: string | null;
  brokerType?: string | null;
  accountNumber?: string | null;
};

function waitForElement(selector: string, onReady: () => void) {
  const existing = document.querySelector(selector);
  if (existing) {
    onReady();
    return;
  }

  const observer = new MutationObserver(() => {
    const element = document.querySelector(selector);
    if (!element) return;
    window.clearTimeout(timeout);
    observer.disconnect();
    onReady();
  });

  const timeout = window.setTimeout(() => {
    observer.disconnect();
    onReady();
  }, 2000);

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

type WorkspaceRefreshScope =
  | "account-created"
  | "trade-imported"
  | "demo-provisioned"
  | "demo-hydrated";

export function AddAccountSheet({
  onAccountCreated,
  trigger,
  open: controlledOpen,
  onOpenChange: onControlledOpenChange,
  noTrigger,
  contentClassName,
  highlightedOption,
}: {
  onAccountCreated: (account: NewAccount) => void;
  trigger?: React.ReactNode;
  /** When provided, overrides internal open state (e.g. for tour) */
  open?: boolean;
  /** Called when the sheet opens or closes (for external state sync) */
  onOpenChange?: (open: boolean) => void;
  /** When true, no SheetTrigger is rendered — sheet is fully controlled via `open` */
  noTrigger?: boolean;
  /** Extra className applied to SheetContent (e.g. z-index override for tour) */
  contentClassName?: string;
  /** Highlights the given option button (e.g. "csv", "manual", "broker", "ea", "demo") during the tour */
  highlightedOption?: string;
}) {
  const queryClient = useQueryClient();
  const setSelectedAccountId = useAccountStore(
    (state) => state.setSelectedAccountId
  );
  const { currentTour, currentStep, setCurrentStep } = useOnborda();
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
  const [demoWorkspaceStatus, setDemoWorkspaceStatus] = useState<
    "idle" | "creating"
  >("idle");
  const [pendingCsvImportResolution, setPendingCsvImportResolution] =
    useState<PendingCsvImportResolution | null>(null);
  const { accounts } = useAccountCatalog();
  const demoCreated = useTourStore((s) => s.demoCreated);
  const setDemoCreated = useTourStore((s) => s.setDemoCreated);
  const addAccountSheetCompleted = useTourStore(
    (s) => s.addAccountSheetCompleted
  );
  const setAddAccountSheetCompleted = useTourStore(
    (s) => s.setAddAccountSheetCompleted
  );
  const setDisablePointerTransition = useTourStore(
    (s) => s.setDisablePointerTransition
  );
  const setRequestedAddAccountSheetOpen = useTourStore(
    (s) => s.setRequestedAddAccountSheetOpen
  );
  const lockGuidedSheetTransition = useTourStore(
    (s) => s.lockGuidedSheetTransition
  );

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

  const resetAll = useCallback(() => {
    setStep(1);
    setDemoWorkspaceStatus("idle");
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
  }, []);

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
  }, [controlledOpen, resetAll]);

  function handleOpenChange(next: boolean) {
    setSheetOpen(next);
    if (!next) resetAll();
    onControlledOpenChange?.(next);
  }

  async function handleSubmitCSV(input?: {
    existingAccountAction?: "enrich" | "create_duplicate";
    existingAccountId?: string;
  }) {
    if (!canSubmit || form.files.length === 0) return;
    setSubmitting(true);
    const notificationsQueryKey = trpcOptions.notifications.list.queryOptions({
      limit: 25,
    }).queryKey;
    const importProcessingToastId = showAppNotificationToast({
      title: "Importing account file",
      body: form.name.trim()
        ? `Importing files for ${form.name.trim()}.`
        : "Importing your account file.",
      type: "trade_imported",
      metadata: {
        kind: "trade_import_processing",
        status: "processing",
        accountName: form.name.trim() || null,
        broker: form.broker || null,
      },
      action: {
        kind: "progress",
        label: "Trade import is in progress",
      },
    });

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
        if (importProcessingToastId) {
          toast.dismiss(importProcessingToastId);
        }
        setPendingCsvImportResolution({
          matchedAccount: res.matchedExistingAccount,
          warnings: res.warnings,
        });
        setSubmitting(false);
        return;
      }

      setPendingCsvImportResolution(null);

      if (res.status === "enriched_existing") {
        if (importProcessingToastId) {
          toast.dismiss(importProcessingToastId);
        }
        setSelectedAccountId(res.matchedExistingAccount.id);
        void refreshWorkspaceQueries("trade-imported");
        void queryClient.invalidateQueries({
          queryKey: notificationsQueryKey,
          refetchType: "active",
        });
        showAppNotificationToast({
          title: "Trade enrichment complete",
          body: getCsvImportFeedbackMessage(res, {
            accountName: res.matchedExistingAccount.name,
          }),
          type: "trade_imported",
          metadata: {
            accountId: res.matchedExistingAccount.id,
            accountName: res.matchedExistingAccount.name,
            broker: res.matchedExistingAccount.broker,
            tradesUpdated: "tradesUpdated" in res ? res.tradesUpdated : null,
            tradesCreated: "tradesCreated" in res ? res.tradesCreated : null,
            parserId: "parserId" in res ? res.parserId : null,
            reportType: "reportType" in res ? res.reportType : null,
          },
        });
        setSubmitting(false);
        handleOpenChange(false);
        resetAll();
        return;
      }

      onAccountCreated({
        id: res.accountId,
        name: form.name,
        image: getAccountImage({ broker: form.broker }),
      });
      upsertAccountInCache({
        id: res.accountId,
        name: form.name,
        broker: form.broker,
      });
      setSelectedAccountId(res.accountId);
      void refreshWorkspaceQueries("trade-imported");
      void queryClient.invalidateQueries({
        queryKey: notificationsQueryKey,
        refetchType: "active",
      });
      if (importProcessingToastId) {
        toast.dismiss(importProcessingToastId);
      }
      showAppNotificationToast({
        title: "Trade import complete",
        body: `${res.tradesImported} trades imported into ${form.name}.`,
        type: "trade_imported",
        metadata: {
          accountId: res.accountId,
          accountName: form.name,
          broker: form.broker,
          tradesImported: res.tradesImported,
          parserId: res.parserId,
          reportType: res.reportType,
        },
      });
      setSubmitting(false);
      setStep(3);
    } catch (error: any) {
      if (importProcessingToastId) {
        toast.dismiss(importProcessingToastId);
      }
      toast.error(error?.message || "Failed to import CSV");
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

      upsertAccountInCache({
        id: account.id,
        name: account.name,
        broker: account.broker,
        brokerType: account.brokerType,
        accountNumber: account.accountNumber ?? null,
      });
      setSelectedAccountId(account.id);
      void refreshWorkspaceQueries("account-created");
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

  async function refreshWorkspaceQueries(scope: WorkspaceRefreshScope) {
    const invalidations = [
      queryClient.invalidateQueries({
        queryKey: [["accounts"]],
        refetchType: "active",
      }),
    ];

    if (
      scope === "trade-imported" ||
      scope === "demo-provisioned" ||
      scope === "demo-hydrated"
    ) {
      invalidations.push(
        queryClient.invalidateQueries({
          queryKey: [["trades"]],
          refetchType: "active",
        })
      );
    }

    if (scope === "demo-hydrated") {
      invalidations.push(
        queryClient.invalidateQueries({
          queryKey: [["goals"]],
          refetchType: "active",
        }),
        queryClient.invalidateQueries({
          queryKey: [["journal"]],
          refetchType: "active",
        })
      );
    }

    await Promise.all(invalidations);
  }

  function upsertAccountInCache(account: CacheableAccount) {
    queryClient.setQueryData(
      trpcOptions.accounts.list.queryOptions().queryKey,
      (current: unknown) => {
        const existing = Array.isArray(current) ? current : [];
        const nextAccount = {
          id: account.id,
          name: account.name,
          broker: account.broker ?? "",
          brokerType: account.brokerType ?? null,
          brokerServer: null,
          accountNumber: account.accountNumber ?? null,
          createdAt: new Date().toISOString(),
        };

        return [
          ...existing.filter(
            (row) =>
              typeof row !== "object" ||
              row === null ||
              !("id" in row) ||
              (row as { id?: string }).id !== account.id
          ),
          nextAccount,
        ];
      }
    );
  }

  async function handleDemoWorkspace() {
    const previousDemoCreated = useTourStore.getState().demoCreated;
    const isGuidedDemoTourStep =
      currentTour === TOUR_ID && currentStep === ADD_ACCOUNT_SHEET_LAST_STEP;
    const releaseTabAttention = startTabAttentionActivity("demo-workspace");
    const notificationsQueryKey = trpcOptions.notifications.list.queryOptions({
      limit: 25,
    }).queryKey;
    let hydrationStarted = false;
    const demoProgressToastId = showAppNotificationToast({
      title: "Preparing demo workspace",
      body:
        demoAccounts.length > 0
          ? "Refreshing Profitabledge demo workspace."
          : "Preparing Profitabledge demo workspace.",
      type: "system_update",
      metadata: {
        kind: "demo_workspace_generating",
        status: "processing",
        accountName: "Profitabledge demo",
        broker: "Profitabledge",
      },
      action: {
        kind: "progress",
        label: "Demo workspace is being prepared",
      },
    });

    try {
      setSubmitting(true);
      setDemoWorkspaceStatus("creating");

      const result = (await (demoAccounts.length > 0
        ? trpcClient.accounts.resetDemoWorkspace.mutate()
        : trpcClient.accounts.createSampleAccount.mutate())) as DemoWorkspaceResult;

      const createdAccount = result.account;
      if (!createdAccount) {
        setDemoCreated(previousDemoCreated);
        if (demoProgressToastId) {
          toast.dismiss(demoProgressToastId);
        }
        toast.error("Demo account was created without account metadata");
        return;
      }

      setDemoCreated(true);
      upsertAccountInCache(createdAccount);
      setSelectedAccountId(createdAccount.id);
      void refreshWorkspaceQueries("demo-provisioned");
      void queryClient.invalidateQueries({
        queryKey: notificationsQueryKey,
        refetchType: "active",
      });
      showAppNotificationToast({
        title: "Preparing demo workspace",
        body:
          demoAccounts.length > 0
            ? `${createdAccount.name} is being refreshed in the background.`
            : `${createdAccount.name} is being prepared in the background.`,
        type: "system_update",
        metadata: {
          kind: "demo_workspace_generating",
          status: "processing",
          accountId: createdAccount.id,
          accountName: createdAccount.name,
          broker: createdAccount.broker ?? "Profitabledge",
        },
        action: {
          kind: "progress",
          label: "Demo workspace is being prepared",
        },
      });

      if (isGuidedDemoTourStep) {
        setAddAccountSheetCompleted(true);
        setRequestedAddAccountSheetOpen(false);
        lockGuidedSheetTransition();
        setDisablePointerTransition(true);
        handleOpenChange(false);
        waitForElement('[data-onborda="nav-dashboard"]', () => {
          setCurrentStep(ADD_ACCOUNT_SHEET_LAST_STEP + 1);
          window.setTimeout(() => {
            useTourStore.getState().setDisablePointerTransition(false);
          }, 80);
        });
      }

      if (!isGuidedDemoTourStep) {
        onAccountCreated({
          id: createdAccount.id,
          name: createdAccount.name,
          image: getAccountImage({
            broker: createdAccount.broker,
            brokerType: createdAccount.brokerType,
          }),
        });
        handleOpenChange(false);
      }

      hydrationStarted = true;
      void trpcClient.accounts.hydrateDemoWorkspace
        .mutate({ accountId: createdAccount.id })
        .then(async () => {
          if (demoProgressToastId) {
            toast.dismiss(demoProgressToastId);
          }
          showAppNotificationToast({
            title: "Demo workspace ready",
            body: `${createdAccount.name} is ready.`,
            type: "system_update",
            metadata: {
              kind: "demo_workspace_ready",
              accountId: createdAccount.id,
              accountName: createdAccount.name,
              broker: createdAccount.broker ?? "Profitabledge",
            },
          });
          void refreshWorkspaceQueries("demo-hydrated");
          void queryClient.invalidateQueries({
            queryKey: notificationsQueryKey,
            refetchType: "active",
          });
        })
        .catch(async (error: any) => {
          if (demoProgressToastId) {
            toast.dismiss(demoProgressToastId);
          }
          showAppNotificationToast({
            title: "Demo workspace failed",
            body:
              error?.message ||
              "Demo workspace is taking longer than expected. You can keep using the platform and refresh shortly.",
            type: "system_update",
            metadata: {
              kind: "demo_workspace_failed",
              accountId: createdAccount.id,
              accountName: createdAccount.name,
              broker: createdAccount.broker ?? "Profitabledge",
            },
          });
          void queryClient.invalidateQueries({
            queryKey: notificationsQueryKey,
            refetchType: "active",
          });
          toast.error(
            error?.message ||
              "Demo workspace is taking longer than expected. You can keep using the platform and refresh shortly."
          );
        })
        .finally(() => {
          releaseTabAttention();
        });
    } catch (e: any) {
      setDemoWorkspaceStatus("idle");
      setDemoCreated(previousDemoCreated);
      if (demoProgressToastId) {
        toast.dismiss(demoProgressToastId);
      }
      toast.error(
        e.message ||
          (demoAccounts.length > 0
            ? "Failed to regenerate demo workspace"
            : "Failed to create demo account")
      );
    } finally {
      if (!hydrationStarted) {
        releaseTabAttention();
      }
      setDemoWorkspaceStatus("idle");
      setSubmitting(false);
    }
  }

  const isPreparingDemoWorkspace = demoWorkspaceStatus === "creating";
  const hasDemoWorkspace =
    demoAccounts.length > 0 || demoCreated || addAccountSheetCompleted;
  const demoWorkspaceDescription = hasDemoWorkspace
    ? demoAccounts.length > 0
      ? `Replace ${demoAccounts.length} seeded demo workspace${
          demoAccounts.length === 1 ? "" : "s"
        } with a fresh demo environment. The account is available immediately while the new trades and stats finish loading in the background.`
      : "Regenerate the seeded demo workspace with a fresh demo environment. The account is available immediately while the new trades and stats finish loading in the background."
    : "Create a demo account instantly, then let the historical trades, live positions, and review data continue populating in the background.";

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
      : isPreparingDemoWorkspace
      ? "Preparing demo workspace"
      : "Account ready";

  const sheetDescription =
    step === 1
      ? "Choose how you want to add your trading account."
      : step === 2 && form.method === "csv"
      ? "Upload your CSV, XML, or XLSX file and enter the details for this trading account."
      : step === 2 && form.method === "manual"
      ? "Create a blank account and log trades manually inside Profitabledge."
      : step === 2 && form.method === "broker"
      ? "Use Connections to sync supported broker and platform accounts directly."
      : step === 2 && form.method === "ea"
      ? "Use the MT5 EA bridge for terminal-based sync and richer trade analytics."
      : isPreparingDemoWorkspace
      ? "We're building a seeded workspace with historical trades, live positions, and supporting data."
      : "Your account has been added to the account switcher.";

  const sectionTitleClass = "text-xs font-semibold text-white/70 tracking-wide";
  const fieldLabelClass = "text-xs text-white/50";
  const fieldInputClass =
    "rounded-sm ring-1 ring-white/8 bg-white/[0.03] px-4 text-xs text-white/80 placeholder:text-white/25 hover:brightness-100 border-none";
  const fieldSelectTriggerClass =
    "h-9 w-full px-4 text-xs bg-transparent! cursor-pointer ring-white/5 hover:bg-sidebar-accent! transition duration-250";
  const fieldSelectContentClass = "";
  const fieldSelectItemClass = "whitespace-normal cursor-pointer";
  const shouldLockSheetForTour = Boolean(highlightedOption);
  const optionTransitionClass = shouldLockSheetForTour
    ? "transition-none"
    : "transition-all duration-300";

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      {!noTrigger && (
        <SheetTrigger asChild>
          {trigger || (
            <Button
              data-onborda="add-account-trigger"
              className="ring-1 ring-white/5 cursor-pointer flex transform items-center justify-center gap-2 rounded-md py-3 transition-all active:scale-95 bg-sidebar-accent text-white w-full text-xs hover:bg-[#222225] hover:!brightness-120 hover:text-white duration-250"
            >
              <div className="flex items-center gap-2 truncate">
                <Plus className="size-3.5" />
                <span className=" truncate">Add an account</span>
              </div>
            </Button>
          )}
        </SheetTrigger>
      )}

      <SheetContent
        side="right"
        overlayClassName={
          shouldLockSheetForTour
            ? "bg-transparent backdrop-blur-none data-[state=open]:animate-none data-[state=closed]:animate-none"
            : undefined
        }
        className={cn(
          "isolate w-full sm:max-w-2xl overflow-y-auto rounded-md p-0",
          contentClassName
        )}
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
                    data-onborda="sheet-option-csv"
                    className={cn(
                      TRADE_SURFACE_CARD_CLASS,
                      optionTransitionClass,
                      "h-auto w-full justify-between rounded-sm px-4 py-4 text-left hover:bg-sidebar-accent hover:brightness-120",
                      highlightedOption === "csv" && "relative z-[2]",
                      highlightedOption === "csv"
                        ? "transition-none ring-2 ring-teal-400 bg-teal-400/5 shadow-[0_0_12px_rgba(45,212,191,0.2)]"
                        : highlightedOption
                        ? "opacity-40"
                        : ""
                    )}
                    onClick={() => {
                      if (highlightedOption) return;
                      setForm({ ...form, method: "csv" });
                      setStep(2);
                    }}
                  >
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-sm font-medium text-white">
                        Import account via file
                      </span>
                      <span className="text-xs text-white/45">
                        Upload a CSV, XML, or XLSX statement export and create a
                        new account from it.
                      </span>
                    </div>
                    <span className="text-white/35">→</span>
                  </Button>

                  <Button
                    data-onborda="sheet-option-manual"
                    className={cn(
                      TRADE_SURFACE_CARD_CLASS,
                      optionTransitionClass,
                      "h-auto w-full justify-between rounded-sm px-4 py-4 text-left hover:bg-sidebar-accent hover:brightness-120",
                      highlightedOption === "manual" && "relative z-[2]",
                      highlightedOption === "manual"
                        ? "transition-none ring-2 ring-teal-400 bg-teal-400/5 shadow-[0_0_12px_rgba(45,212,191,0.2)]"
                        : highlightedOption
                        ? "opacity-40"
                        : ""
                    )}
                    onClick={() => {
                      if (highlightedOption) return;
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
                    data-onborda="sheet-option-broker"
                    className={cn(
                      TRADE_SURFACE_CARD_CLASS,
                      optionTransitionClass,
                      "h-auto w-full justify-between rounded-sm px-4 py-4 text-left hover:bg-sidebar-accent hover:brightness-120",
                      highlightedOption === "broker" && "relative z-[2]",
                      highlightedOption === "broker"
                        ? "transition-none ring-2 ring-teal-400 bg-teal-400/5 shadow-[0_0_12px_rgba(45,212,191,0.2)]"
                        : highlightedOption
                        ? "opacity-40"
                        : ""
                    )}
                    onClick={() => {
                      if (highlightedOption) return;
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
                    data-onborda="sheet-option-ea"
                    className={cn(
                      TRADE_SURFACE_CARD_CLASS,
                      optionTransitionClass,
                      "h-auto w-full justify-between rounded-sm px-4 py-4 text-left hover:bg-sidebar-accent hover:brightness-120",
                      highlightedOption === "ea" && "relative z-[2]",
                      highlightedOption === "ea"
                        ? "transition-none ring-2 ring-teal-400 bg-teal-400/5 shadow-[0_0_12px_rgba(45,212,191,0.2)]"
                        : highlightedOption
                        ? "opacity-40"
                        : ""
                    )}
                    onClick={() => {
                      if (highlightedOption) return;
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
                <div
                  data-onborda="sheet-option-demo"
                  className={cn(
                    TRADE_SURFACE_CARD_CLASS,
                    optionTransitionClass,
                    "space-y-4 p-4",
                    highlightedOption === "demo" && "relative z-[2]",
                    highlightedOption === "demo"
                      ? "transition-none ring-2 ring-teal-400 bg-teal-400/5 shadow-[0_0_12px_rgba(45,212,191,0.2)]"
                      : highlightedOption
                      ? "opacity-40"
                      : ""
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Sparkles className="mt-0.5 size-4 text-amber-300" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-white">
                        Explore with demo data
                      </p>
                      <p className="text-xs leading-relaxed text-white/45">
                        {demoWorkspaceDescription}
                      </p>
                    </div>
                  </div>
                  <Button
                    className={cn(
                      TRADE_ACTION_BUTTON_PRIMARY_CLASS,
                      "h-9 w-full ring-1 ring-amber-400/20 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15"
                    )}
                    onClick={
                      highlightedOption && highlightedOption !== "demo"
                        ? undefined
                        : handleDemoWorkspace
                    }
                    disabled={
                      submitting ||
                      (!!highlightedOption && highlightedOption !== "demo")
                    }
                  >
                    <Sparkles className="size-3.5" />
                    {submitting
                      ? hasDemoWorkspace
                        ? "Regenerating..."
                        : "Creating..."
                      : hasDemoWorkspace
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
                    disabled={shouldLockSheetForTour}
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
                    Log trades directly in Profitabledge
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
                        TradeLocker from the Connections page. Profitabledge
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
                      onClick={() => handleOpenChange(false)}
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
                      onClick={() => handleOpenChange(false)}
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
                <h3 className={sectionTitleClass}>
                  {isPreparingDemoWorkspace
                    ? "Preparing demo workspace"
                    : "Account ready"}
                </h3>
              </div>
              <Separator />
              <div className="px-6 py-5">
                <div className={cn(TRADE_SURFACE_CARD_CLASS, "space-y-2 p-4")}>
                  {isPreparingDemoWorkspace ? (
                    <>
                      <div className="flex items-center gap-2 text-sm font-medium text-white">
                        <Loader2 className="size-4 animate-spin text-amber-300" />
                        Building your demo workspace
                      </div>
                      <p className="text-xs leading-relaxed text-white/45">
                        We're seeding the account, trades, open positions, and
                        supporting review data now. This can take a moment, but
                        you don't need to restart the flow.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-white">
                        Your account has been added successfully.
                      </p>
                      <p className="text-xs leading-relaxed text-white/45">
                        {form.method === "manual"
                          ? "It is now available in the account switcher and ready for manual trade entry across the dashboard."
                          : "It is now available in the account switcher and ready to use across the dashboard."}
                      </p>
                    </>
                  )}
                </div>
              </div>

              <Separator />
              <div className="px-6 py-5">
                <Button
                  className={cn(
                    TRADE_ACTION_BUTTON_PRIMARY_CLASS,
                    "h-9 w-full"
                  )}
                  disabled={isPreparingDemoWorkspace}
                  onClick={() => handleOpenChange(false)}
                >
                  {isPreparingDemoWorkspace ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Preparing demo workspace...
                    </>
                  ) : (
                    "Done"
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
