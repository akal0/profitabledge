"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "react-qr-code";
import { Copy, Fingerprint, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import {
  GoalContentSeparator,
  GoalSurface,
} from "@/components/goals/goal-surface";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth-client";
import { getErrorMessage } from "@/lib/error-message";

function formatLoginMethod(method?: string | null) {
  switch (method) {
    case "email":
      return "Email and password";
    case "username":
      return "Username and password";
    case "google":
      return "Google";
    case "twitter":
      return "X";
    case "passkey":
      return "Passkey";
    default:
      return "Not recorded yet";
  }
}

function formatPasskeyDate(value?: string | Date | null) {
  if (!value) {
    return "Recently added";
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "Recently added" : date.toLocaleString();
}

function isTauriDesktop() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export default function SecuritySettingsPage() {
  const router = useRouter();
  const session = authClient.useSession();
  const passkeys = authClient.useListPasskeys();
  const sessionUser = (session.data?.user ?? null) as
    | {
        twoFactorEnabled?: boolean;
        lastLoginMethod?: string | null;
      }
    | null;
  const [twoFactorPassword, setTwoFactorPassword] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [passkeyName, setPasskeyName] = useState("");
  const [setupState, setSetupState] = useState<{
    totpURI: string;
    backupCodes: string[];
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<null | "enable" | "verify" | "disable" | "passkey" | `delete:${string}`>(null);

  const passkeyRows = (passkeys.data ?? []) as Array<{
    id: string;
    name?: string | null;
    createdAt?: string | Date | null;
  }>;
  const isTwoFactorEnabled = sessionUser?.twoFactorEnabled === true;
  const lastLoginMethod = useMemo(
    () => formatLoginMethod(sessionUser?.lastLoginMethod),
    [sessionUser?.lastLoginMethod]
  );

  useEffect(() => {
    if (!isTauriDesktop()) {
      return;
    }

    router.replace("/dashboard/settings/profile");
  }, [router]);

  if (isTauriDesktop()) {
    return <RouteLoadingFallback route="settings" className="min-h-[calc(100vh-10rem)]" />;
  }

  async function handleEnableTwoFactor() {
    if (!twoFactorPassword.trim()) {
      toast.error("Enter your current password first.");
      return;
    }

    setIsSubmitting("enable");
    try {
      const result = await authClient.twoFactor.enable({
        password: twoFactorPassword,
      });

      if (result.error) {
        toast.error(
          getErrorMessage(result.error, "Unable to start two-factor setup")
        );
        return;
      }

      if (result.data?.totpURI && result.data?.backupCodes) {
        setSetupState({
          totpURI: result.data.totpURI,
          backupCodes: result.data.backupCodes,
        });
        toast.success("Authenticator setup started");
      }
    } finally {
      setIsSubmitting(null);
    }
  }

  async function handleVerifyTwoFactor() {
    if (!verificationCode.trim()) {
      toast.error("Enter the code from your authenticator app.");
      return;
    }

    setIsSubmitting("verify");
    try {
      const result = await authClient.twoFactor.verifyTotp({
        code: verificationCode.trim(),
      });

      if (result.error) {
        toast.error(getErrorMessage(result.error, "Unable to verify your code"));
        return;
      }

      setSetupState(null);
      setTwoFactorPassword("");
      setVerificationCode("");
      toast.success("Two-factor authentication is now enabled");
      await session.refetch();
    } finally {
      setIsSubmitting(null);
    }
  }

  async function handleDisableTwoFactor() {
    if (!disablePassword.trim()) {
      toast.error("Enter your current password first.");
      return;
    }

    setIsSubmitting("disable");
    try {
      const result = await authClient.twoFactor.disable({
        password: disablePassword,
      });

      if (result.error) {
        toast.error(
          getErrorMessage(result.error, "Unable to disable two-factor")
        );
        return;
      }

      setDisablePassword("");
      toast.success("Two-factor authentication has been disabled");
      await session.refetch();
    } finally {
      setIsSubmitting(null);
    }
  }

  async function handleAddPasskey() {
    setIsSubmitting("passkey");
    try {
      const result = await authClient.passkey.addPasskey({
        name: passkeyName.trim() || undefined,
      });

      if (result.error) {
        toast.error(getErrorMessage(result.error, "Unable to add a passkey"));
        return;
      }

      setPasskeyName("");
      toast.success("Passkey added");
      await passkeys.refetch();
    } finally {
      setIsSubmitting(null);
    }
  }

  async function handleDeletePasskey(passkeyId: string) {
    setIsSubmitting(`delete:${passkeyId}`);
    try {
      const result = await authClient.passkey.deletePasskey({
        id: passkeyId,
      });

      if (result.error) {
        toast.error(
          getErrorMessage(result.error, "Unable to remove that passkey")
        );
        return;
      }

      toast.success("Passkey removed");
      await passkeys.refetch();
    } finally {
      setIsSubmitting(null);
    }
  }

  async function copyBackupCodes() {
    if (!setupState?.backupCodes?.length) {
      return;
    }

    await navigator.clipboard.writeText(setupState.backupCodes.join("\n"));
    toast.success("Backup codes copied");
  }

  if (session.isPending) {
    return <RouteLoadingFallback route="settings" className="min-h-[calc(100vh-10rem)]" />;
  }

  return (
    <div className="flex w-full flex-col">
      <div className="grid grid-cols-1 items-start gap-2 px-6 py-5 sm:grid-cols-[220px_1fr] sm:gap-6 sm:px-8">
        <div>
          <Label className="text-sm font-medium text-white/80">Security</Label>
          <p className="mt-0.5 text-xs text-white/40">
            Add a passkey, turn on two-factor verification, and review the last
            method used to access this account.
          </p>
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:px-8 xl:grid-cols-2">
        <GoalSurface>
          <div className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-300 ring ring-emerald-500/20">
                <ShieldCheck className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Account protection</p>
                <p className="text-xs text-white/45">
                  Last sign-in method: {lastLoginMethod}
                </p>
              </div>
            </div>

            <GoalContentSeparator className="mb-4 mt-4" />

            {!isTwoFactorEnabled ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label className="text-xs text-white/60">Current password</Label>
                  <Input
                    type="password"
                    value={twoFactorPassword}
                    onChange={(event) => setTwoFactorPassword(event.target.value)}
                    placeholder="Enter your current password"
                    className="border-none bg-sidebar text-white ring ring-white/10"
                  />
                </div>

                <Button
                  type="button"
                  onClick={() => void handleEnableTwoFactor()}
                  disabled={isSubmitting !== null}
                  className="h-10 rounded-sm bg-sidebar text-xs text-white ring ring-white/10 hover:bg-sidebar-accent"
                >
                  {isSubmitting === "enable" ? "Preparing..." : "Set up two-factor"}
                </Button>

                {setupState ? (
                  <div className="space-y-4 rounded-md bg-sidebar/50 p-4 ring ring-white/10">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-white">
                        Scan this QR code
                      </p>
                      <p className="text-xs leading-5 text-white/50">
                        Add the account to your authenticator app, then enter the
                        current code below to finish enabling two-factor.
                      </p>
                    </div>

                    <div className="inline-flex rounded-md bg-white p-3">
                      <QRCode value={setupState.totpURI} size={168} />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-white">Backup codes</p>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => void copyBackupCodes()}
                          className="h-8 rounded-sm px-2 text-xs text-white/70 hover:bg-sidebar-accent hover:text-white"
                        >
                          <Copy className="mr-2 size-3.5" />
                          Copy
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {setupState.backupCodes.map((backupCode) => (
                          <code
                            key={backupCode}
                            className="rounded-sm bg-black/25 px-3 py-2 text-xs text-white/75 ring ring-white/10"
                          >
                            {backupCode}
                          </code>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-white/60">
                        Authenticator code
                      </Label>
                      <Input
                        value={verificationCode}
                        onChange={(event) => setVerificationCode(event.target.value)}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="Enter the 6-digit code"
                        className="border-none bg-sidebar text-white ring ring-white/10"
                      />
                    </div>

                    <Button
                      type="button"
                      onClick={() => void handleVerifyTwoFactor()}
                      disabled={isSubmitting !== null}
                      className="h-10 rounded-sm bg-emerald-500/20 text-xs text-emerald-200 ring ring-emerald-500/25 hover:bg-emerald-500/30"
                    >
                      {isSubmitting === "verify" ? "Verifying..." : "Enable two-factor"}
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-md bg-emerald-500/10 px-3 py-3 text-sm text-emerald-200 ring ring-emerald-500/20">
                  Two-factor authentication is active for this account.
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-white/60">Current password</Label>
                  <Input
                    type="password"
                    value={disablePassword}
                    onChange={(event) => setDisablePassword(event.target.value)}
                    placeholder="Enter your current password"
                    className="border-none bg-sidebar text-white ring ring-white/10"
                  />
                </div>

                <Button
                  type="button"
                  onClick={() => void handleDisableTwoFactor()}
                  disabled={isSubmitting !== null}
                  className="h-10 rounded-sm bg-rose-500/15 text-xs text-rose-200 ring ring-rose-500/25 hover:bg-rose-500/25"
                >
                  {isSubmitting === "disable" ? "Turning off..." : "Disable two-factor"}
                </Button>
              </div>
            )}
          </div>
        </GoalSurface>

        <GoalSurface>
          <div className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-md bg-sky-500/15 text-sky-300 ring ring-sky-500/20">
                <Fingerprint className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Passkeys</p>
                <p className="text-xs text-white/45">
                  Add device-backed sign-ins for faster, phishing-resistant access.
                </p>
              </div>
            </div>

            <GoalContentSeparator className="mb-4 mt-4" />

            <div className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs text-white/60">Optional device label</Label>
                <Input
                  value={passkeyName}
                  onChange={(event) => setPasskeyName(event.target.value)}
                  placeholder="MacBook Air, iPhone, Password Manager"
                  className="border-none bg-sidebar text-white ring ring-white/10"
                />
              </div>

              <Button
                type="button"
                onClick={() => void handleAddPasskey()}
                disabled={isSubmitting !== null}
                className="h-10 rounded-sm bg-sidebar text-xs text-white ring ring-white/10 hover:bg-sidebar-accent"
              >
                {isSubmitting === "passkey" ? "Waiting for device..." : "Add a passkey"}
              </Button>

              <div className="space-y-2">
                {passkeys.isPending ? (
                  <p className="text-sm text-white/45">Loading passkeys...</p>
                ) : passkeyRows.length === 0 ? (
                  <p className="text-sm text-white/45">
                    No passkeys registered yet.
                  </p>
                ) : (
                  passkeyRows.map((row) => (
                    <div
                      key={row.id}
                      className="flex items-center justify-between gap-3 rounded-md bg-sidebar/50 px-3 py-3 ring ring-white/10"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">
                          {row.name || "Unnamed passkey"}
                        </p>
                        <p className="text-xs text-white/45">
                          Added {formatPasskeyDate(row.createdAt)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => void handleDeletePasskey(row.id)}
                        disabled={isSubmitting !== null}
                        className="h-8 rounded-sm px-2 text-rose-200 hover:bg-rose-500/15 hover:text-rose-100"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </GoalSurface>
      </div>
    </div>
  );
}
