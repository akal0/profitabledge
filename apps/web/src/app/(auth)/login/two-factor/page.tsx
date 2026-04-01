"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import {
  AuthSplitShell,
  type AuthHeroSlide,
} from "@/components/auth/auth-split-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { getErrorMessage } from "@/lib/error-message";
import { markLoginOnboardingBypass } from "@/lib/login-onboarding-bypass";
import {
  buildPostLoginPath,
  resolvePostAuthPath,
} from "@/lib/post-auth-paths";
import { waitForConfirmedSession } from "@/lib/session-confirmation";

const METHOD_BUTTON_CLASS =
  "h-max rounded-sm px-3 py-2 text-xs ring ring-white/10 transition-colors";
const INPUT_CLASS =
  "h-max rounded-sm border-none bg-sidebar! px-4 py-3 text-sm text-white shadow-none ring! ring-white/10! placeholder:text-white/28 hover:bg-sidebar-accent hover:brightness-120 focus-visible:ring-2 focus-visible:ring-white/15";
const PRIMARY_BUTTON_CLASS =
  "h-max w-full rounded-sm bg-sidebar py-3 text-xs font-medium text-white shadow-none ring ring-white/10 transition-colors hover:bg-sidebar-accent hover:brightness-120";

const HERO_SLIDES: AuthHeroSlide[] = [
  {
    title: "One more check before the next session opens.",
    description:
      "Verify the sign-in with your authenticator app or one of your backup codes, then pick up exactly where you left off.",
  },
];

export default function TwoFactorLoginPage() {
  const searchParams = useSearchParams();
  const requestedReturnTo = resolvePostAuthPath(searchParams?.get("returnTo"));
  const postLoginPath = buildPostLoginPath(requestedReturnTo);
  const [method, setMethod] = useState<"totp" | "backup">("totp");
  const [code, setCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleVerify() {
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      toast.error("Enter your verification code.");
      return;
    }

    setIsSubmitting(true);

    try {
      const result =
        method === "totp"
          ? await authClient.twoFactor.verifyTotp({
              code: trimmedCode,
              trustDevice,
            })
          : await authClient.twoFactor.verifyBackupCode({
              code: trimmedCode,
              trustDevice,
            });

      if (result.error) {
        toast.error(
          getErrorMessage(result.error, "Unable to verify your sign-in")
        );
        return;
      }

      toast.success("Verification successful", {
        id: "auth-two-factor-status",
      });
      await waitForConfirmedSession();
      markLoginOnboardingBypass();
      window.location.replace(postLoginPath);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthSplitShell heroSlides={HERO_SLIDES}>
      <div className="space-y-8">
        <div className="space-y-3 text-center">
          <p className="text-3xl font-medium tracking-[-0.05em] text-white/50 sm:text-[2.15rem] sm:leading-[1.02] lg:text-[2.3rem]">
            Verify your sign-in
          </p>
          <p className="mx-auto max-w-md text-sm leading-6 text-white/56 sm:text-[15px] lg:text-base lg:leading-7">
            Use your authenticator app or a backup code to finish logging in.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setMethod("totp")}
            className={`${METHOD_BUTTON_CLASS} ${
              method === "totp"
                ? "bg-sidebar text-white"
                : "bg-sidebar/40 text-white/55 hover:bg-sidebar-accent hover:text-white"
            }`}
          >
            Authenticator
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setMethod("backup")}
            className={`${METHOD_BUTTON_CLASS} ${
              method === "backup"
                ? "bg-sidebar text-white"
                : "bg-sidebar/40 text-white/55 hover:bg-sidebar-accent hover:text-white"
            }`}
          >
            Backup code
          </Button>
        </div>

        <div className="space-y-5">
          <div className="space-y-1">
            <Label className="text-xs font-medium tracking-[-0.01em] text-white/42">
              {method === "totp" ? "Authenticator code" : "Backup code"}
            </Label>
            <Input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className={INPUT_CLASS}
              inputMode="text"
              autoComplete="one-time-code"
              placeholder={
                method === "totp" ? "Enter the 6-digit code" : "Enter a backup code"
              }
            />
          </div>

          <label className="flex items-center gap-3 rounded-sm bg-sidebar/40 px-3 py-3 text-sm text-white/70 ring ring-white/10">
            <Checkbox
              checked={trustDevice}
              onCheckedChange={(checked) => setTrustDevice(checked === true)}
            />
            <span>Trust this device for future sign-ins</span>
          </label>
        </div>

        <Button
          type="button"
          variant="ghost"
          disabled={isSubmitting}
          onClick={() => void handleVerify()}
          className={PRIMARY_BUTTON_CLASS}
        >
          {isSubmitting ? "Verifying..." : "Continue"}
        </Button>
      </div>
    </AuthSplitShell>
  );
}
