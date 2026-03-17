"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AvatarUpload from "@/components/upload/AvatarUpload";

import { OverlapSeparator, Separator } from "@/components/ui/separator";
import Link from "next/link";

import Google from "@/public/icons/social-media/google.svg";
import X from "@/public/icons/social-media/x.svg";
import Discord from "@/public/icons/social-media/discord.svg";
import { cn } from "@/lib/utils";
import PasswordInput from "./components/password-input";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { trackAlphaMilestone } from "@/lib/alpha-analytics";
import { trpcClient } from "@/utils/trpc";
import {
  getStoredGrowthIntent,
  storeAffiliateIntent,
  storeBetaCode,
  storeReferralIntent,
} from "@/features/growth/lib/access-intent";

const FormSchema = z.object({
  email: z.string().email({
    message: "Invalid email address.",
  }),
  password: z
    .string()
    .min(8, {
      message: "Password must be at least 8 characters.",
    })
    .regex(/[a-z]/, {
      message: "Password must contain at least 1 lowercase letter.",
    })
    .regex(/[A-Z]/, {
      message: "Password must contain at least 1 uppercase letter.",
    })
    .regex(/[0-9]/, {
      message: "Password must contain at least 1 number.",
    }),
});

const SESSION_CONFIRM_RETRY_DELAYS_MS = [0, 150, 350, 750] as const;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const SignupPage = () => {
  const router = useRouter();
  const [privateBetaRequired, setPrivateBetaRequired] = useState(false);
  const [publicConfigResolved, setPublicConfigResolved] = useState(false);
  const [betaCode, setBetaCode] = useState("");
  const [betaMessage, setBetaMessage] = useState<string | null>(null);
  const [betaValid, setBetaValid] = useState<boolean | null>(null);
  const [betaChecking, setBetaChecking] = useState(false);
  const [socialProviderLoading, setSocialProviderLoading] = useState<
    "google" | "twitter" | null
  >(null);
  const betaCodeInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const config = await trpcClient.billing.getPublicConfig.query();
      if (cancelled) return;

      setPrivateBetaRequired(config.privateBetaRequired);
      setPublicConfigResolved(true);
      const storedIntent = getStoredGrowthIntent();
      if (storedIntent.betaCode) {
        setBetaCode(storedIntent.betaCode);
      }

      const params = new URLSearchParams(window.location.search);
      const referralCode = params.get("ref");
      const affiliateCode = params.get("aff");
      const affiliateGroupSlug = params.get("group");

      if (affiliateCode) {
        storeAffiliateIntent(affiliateCode, affiliateGroupSlug);
      } else if (referralCode) {
        storeReferralIntent(referralCode);
      }
    })().catch(() => {
      if (!cancelled) {
        setPrivateBetaRequired(false);
        setPublicConfigResolved(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function validateBetaCode(value: string) {
    const normalized = value.trim().toUpperCase();
    if (!normalized) {
      setBetaValid(null);
      setBetaMessage(null);
      return null;
    }

    setBetaChecking(true);

    try {
      const result = await trpcClient.billing.validatePrivateBetaCode.query({
        code: normalized,
      });
      const label = "label" in result ? result.label : null;
      const message = "message" in result ? result.message : null;

      setBetaValid(result.valid);
      setBetaMessage(
        result.valid
          ? label
            ? `${label} access unlocked`
            : "Code accepted"
          : message
      );

      return result;
    } finally {
      setBetaChecking(false);
    }
  }

  async function waitForConfirmedSession() {
    for (const delay of SESSION_CONFIRM_RETRY_DELAYS_MS) {
      if (delay > 0) {
        await sleep(delay);
      }

      const result = await authClient.getSession();
      if (result.data) {
        return true;
      }
    }

    return false;
  }

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    if (!publicConfigResolved) {
      setBetaMessage("Checking invite access requirements...");
      betaCodeInputRef.current?.focus();
      toast.message("Checking invite access requirements...");
      return;
    }

    const normalizedBetaCode = betaCode.trim().toUpperCase();

    if (privateBetaRequired) {
      if (!normalizedBetaCode) {
        setBetaValid(false);
        setBetaMessage("A private beta code is required");
        toast.error("A private beta code is required");
        return;
      }

      const result = await validateBetaCode(normalizedBetaCode);
      if (!result?.valid) {
        toast.error(
          (result && "message" in result ? result.message : null) ||
            "Invalid private beta code"
        );
        return;
      }
    } else if (normalizedBetaCode) {
      await validateBetaCode(normalizedBetaCode);
    }

    storeBetaCode(normalizedBetaCode);

    await authClient.signUp.email(
      {
        email: data.email,
        name: "placeholder",
        password: data.password,
      },
      {
        body: normalizedBetaCode
          ? {
              betaCode: normalizedBetaCode,
            }
          : undefined,
        onSuccess: async () => {
          void trackAlphaMilestone("sign_up_completed", {
            pagePath: "/sign-up",
          });

          toast.success("Account successfully created!", {
            description: "Redirecting you to onboarding.",
          });

          await waitForConfirmedSession();
          router.push("/onboarding");
        },
        onError: (error) => {
          const message =
            error.error.message || "There was a problem creating your account.";

          toast.error("Unable to create account", {
            description: message,
          });
        },
      }
    );
  }

  async function ensureProviderBetaAccess(providerLabel: string) {
    if (!publicConfigResolved) {
      setBetaValid(null);
      setBetaMessage("Checking invite access requirements...");
      betaCodeInputRef.current?.focus();
      toast.message("Checking invite access requirements...");
      return null;
    }

    const normalizedBetaCode = betaCode.trim().toUpperCase();

    if (privateBetaRequired) {
      if (!normalizedBetaCode) {
        setBetaValid(false);
        setBetaMessage(
          `Enter your private beta code to continue with ${providerLabel}`
        );
        betaCodeInputRef.current?.focus();
        toast.error("A private beta code is required");
        return null;
      }

      const result = await validateBetaCode(normalizedBetaCode);
      if (!result?.valid) {
        setBetaValid(false);
        setBetaMessage(
          (result && "message" in result ? result.message : null) ||
            `Enter a valid private beta code to continue with ${providerLabel}`
        );
        betaCodeInputRef.current?.focus();
        toast.error(
          (result && "message" in result ? result.message : null) ||
            "Invalid private beta code"
        );
        return null;
      }
    } else if (normalizedBetaCode) {
      await validateBetaCode(normalizedBetaCode);
    }

    storeBetaCode(normalizedBetaCode);
    return normalizedBetaCode;
  }

  async function handleSocialSignUp(provider: "google" | "twitter") {
    const providerLabel =
      provider === "google" ? "Google sign up" : "X sign up";
    const normalizedBetaCode = await ensureProviderBetaAccess(providerLabel);
    if (normalizedBetaCode === null) {
      return;
    }

    setSocialProviderLoading(provider);

    try {
      await authClient.signIn.social({
        provider,
        callbackURL: `${window.location.origin}/onboarding`,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Unable to continue with ${providerLabel}`
      );
      setSocialProviderLoading(null);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen relative bg-sidebar">
      <div
        className={cn(
          "z-99 opacity-25 absolute size-106 rotate-45 shadow-upload-button overflow-hidden rounded-3xl",
          "before:content-[''] before:absolute before:-top-24 before:-left-24 before:size-[150%] before:rounded-full before:bg-[conic-gradient(rgba(255,255,255,0),rgba(255,255,255,0.35)_5%,rgba(229,231,235,0.3)_10%,#e5e7eb_15%,rgba(0,0,0,0)_15%)] before:animate-spin before:[animation-duration:10s] before:[animation-timing-function:cubic-bezier(0.95, 0.05, 0.795, 0.035)]",
          "after:content-[''] after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:w-[calc(100%-2px)] after:h-[calc(100%-2px)] after:rounded-3xl after:bg-sidebar"
        )}
      ></div>

      <div
        className={cn(
          "z-98 opacity-25 absolute size-116 rotate-45 shadow-upload-button overflow-hidden rounded-3xl",
          "before:content-[''] before:absolute before:-top-24 before:-left-24 before:size-[140%] before:rounded-full before:bg-[conic-gradient(rgba(255,255,255,0),rgba(255,255,255,0.35)_5%,rgba(229,231,235,0.3)_10%,#e5e7eb_15%,rgba(0,0,0,0)_15%)] before:animate-spin before:[animation-duration:30s] before:[animation-timing-function:cubic-bezier(0.95, 0.05, 0.795, 0.035)]",
          "after:content-[''] after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:w-[calc(100%-2px)] after:h-[calc(100%-2px)] after:rounded-3xl after:bg-sidebar"
        )}
      ></div>

      <div
        className={cn(
          "z-97 opacity-25 absolute size-126 rotate-45 shadow-upload-button overflow-hidden rounded-3xl",
          "before:content-[''] before:absolute before:-top-24 before:-left-24 before:size-[140%] before:rounded-full before:bg-[conic-gradient(rgba(255,255,255,0),rgba(255,255,255,0.35)_5%,rgba(229,231,235,0.3)_10%,#e5e7eb_15%,rgba(0,0,0,0)_15%)] before:animate-spin before:[animation-duration:35s] before:[animation-timing-function:cubic-bezier(0.95, 0.05, 0.795, 0.035)]",
          "after:content-[''] after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:w-[calc(100%-2px)] after:h-[calc(100%-2px)] after:rounded-3xl after:bg-sidebar"
        )}
      ></div>

      <div
        className={cn(
          "z-96 opacity-25 absolute size-136 rotate-45 shadow-upload-button overflow-hidden rounded-3xl",
          "before:content-[''] before:absolute before:-top-28 before:-left-28 before:size-[150%] before:rounded-full before:bg-[conic-gradient(rgba(255,255,255,0),rgba(255,255,255,0.35)_5%,rgba(229,231,235,0.3)_10%,#e5e7eb_15%,rgba(0,0,0,0)_15%)] before:animate-spin before:[animation-duration:30s] before:[animation-timing-function:cubic-bezier(0.95, 0.05, 0.795, 0.035)]",
          "after:content-[''] after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:w-[calc(100%-3px)] after:h-[calc(100%-3px)] after:rounded-3xl after:bg-sidebar"
        )}
      ></div>

      <div
        className={cn(
          "z-95 opacity-25 absolute size-146 rotate-45 shadow-upload-button overflow-hidden rounded-3xl",
          "before:content-[''] before:absolute before:-top-32 before:-left-32 before:size-[150%] before:rounded-full before:bg-[conic-gradient(rgba(255,255,255,0),rgba(255,255,255,0.35)_5%,rgba(229,231,235,0.3)_10%,#e5e7eb_15%,rgba(0,0,0,0)_15%)] before:animate-spin before:[animation-duration:10s] before:[animation-timing-function:cubic-bezier(0.95, 0.05, 0.795, 0.035)]",
          "after:content-[''] after:absolute after:top-1/2 after:left-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:w-[calc(100%-2px)] after:h-[calc(100%-2px)] after:rounded-3xl after:bg-sidebar"
        )}
      ></div>

      <div className="flex flex-col items-center justify-center gap-8 h-full w-full relative z-100">
        {/* Form */}
        <div className="w-full max-w-md bg-sidebar rounded-3xl shadow-sidebar-button">
          <div className="flex flex-col items-center justify-center gap-1 py-6">
            <h1 className="text-lg font-medium"> Sign up</h1>
            <p className="text-xs text-secondary">
              Take the first step to profitability.
            </p>
          </div>

          <Separator />

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="w-full space-y-6 py-6"
            >
              {/* Existing fields */}
              <div className="p-10 py-0 space-y-5">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs">Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="profitabletrader@gmail.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <div className="space-y-8 flex flex-col items-end">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem className="space-y-1 w-full">
                        <FormLabel className="text-xs">Password</FormLabel>
                        <FormControl>
                          <PasswordInput {...field} />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  <div className="w-full space-y-1">
                    <label className="text-xs text-white/80">
                      Private beta code
                    </label>

                    <Input
                      ref={betaCodeInputRef}
                      value={betaCode}
                      onChange={(event) => {
                        setBetaCode(event.target.value.toUpperCase());
                        if (!event.target.value.trim()) {
                          setBetaValid(null);
                          setBetaMessage(null);
                        }
                      }}
                      onBlur={() => {
                        if (betaCode.trim()) {
                          void validateBetaCode(betaCode);
                        }
                      }}
                      placeholder={
                        privateBetaRequired ? "BETA1234" : "Optional"
                      }
                      aria-invalid={betaValid === false}
                      className={cn(
                        "mt-1",
                        betaValid === false &&
                          "border-red-500/60 focus-visible:ring-red-500"
                      )}
                    />
                    <p
                      className={cn(
                        "text-[11px]",
                        betaValid === true
                          ? "text-emerald-400"
                          : betaValid === false
                          ? "text-red-400"
                          : "text-secondary"
                      )}
                    >
                      {betaChecking
                        ? "Checking code..."
                        : betaMessage ||
                          (privateBetaRequired
                            ? "Enter your invite code to unlock the beta."
                            : "Optional if you were invited into the beta.")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-10 my-6 space-y-2">
                <Button
                  className="shadow-sidebar-button rounded-[6px] gap-2.5 h-max transition-all active:scale-95 bg-sidebar-accent hover:bg-sidebar-accent cursor-pointer text-white flex-1 text-xs hover:!brightness-120 duration-250 flex  items-center justify-center w-full"
                  type="submit"
                >
                  Sign up
                </Button>

                <Link
                  href="/"
                  className="text-xs underline underline-offset-2 text-secondary hover:text-white transition-colors duration-250"
                >
                  Forgot your password?
                </Link>
              </div>

              <OverlapSeparator> Or sign up with </OverlapSeparator>

              <div className="flex items-center justify-center gap-2 px-10 py-2 pb-0">
                <Button
                  type="button"
                  disabled={socialProviderLoading !== null}
                  onClick={() => void handleSocialSignUp("google")}
                  className="shadow-sidebar-button rounded-[6px] gap-2 h-max transition-all active:scale-95 bg-sidebar-accent hover:bg-sidebar-accent cursor-pointer text-white flex-1 text-xs hover:!brightness-120 duration-250 flex  items-center justify-center w-full group"
                >
                  <Google className="stroke-none fill-muted-foreground group-hover:stroke-white group-hover:fill-white transition-colors duration-250" />
                  <p className="text-xs text-muted-foreground group-hover:text-white duration-250">
                    {socialProviderLoading === "google"
                      ? "Redirecting..."
                      : "Sign up with Google"}
                  </p>
                </Button>

                <Button
                  type="button"
                  disabled={socialProviderLoading !== null}
                  onClick={() => void handleSocialSignUp("twitter")}
                  className="shadow-sidebar-button rounded-[6px] gap-2 h-max transition-all active:scale-95 bg-sidebar-accent hover:bg-sidebar-accent cursor-pointer text-white flex-1 text-xs hover:!brightness-120 duration-250 flex  items-center justify-center w-full group"
                >
                  <X className="stroke-none fill-muted-foreground group-hover:stroke-white group-hover:fill-white transition-colors duration-250" />
                  <p className="text-xs text-muted-foreground group-hover:text-white duration-250">
                    {socialProviderLoading === "twitter"
                      ? "Redirecting..."
                      : "Sign up with X"}
                  </p>
                </Button>
              </div>

              <Separator />

              <p className="text-xs text-center text-muted-foreground font-medium">
                Already have an account?{" "}
                <Link href="/login" className="text-white font-medium">
                  Login
                </Link>
              </p>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
