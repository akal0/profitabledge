"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { BadgePercent, Check } from "lucide-react";

import { trackAlphaMilestone } from "@/lib/alpha-analytics";
import {
  AuthSplitShell,
  type AffiliateInfo,
  type AuthHeroSlide,
} from "@/components/auth/auth-split-shell";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { startDesktopSocialAuth } from "@/lib/desktop-social-auth";
import { getErrorMessage } from "@/lib/error-message";
import { clearLoginOnboardingBypass } from "@/lib/login-onboarding-bypass";
import {
  storeAffiliateIntent,
  storeReferralIntent,
} from "@/features/growth/lib/access-intent";
import {
  buildLoginPath,
  buildPostAuthContinuePath,
  resolvePostAuthPath,
} from "@/lib/post-auth-paths";
import { waitForConfirmedSession } from "@/lib/session-confirmation";
import { trpcClient } from "@/utils/trpc";
import Google from "@/public/icons/social-media/google.svg";

import PasswordInput from "./components/password-input";

const SOCIAL_BUTTON_CLASS =
  "group h-max w-full justify-center rounded-sm ring ring-white/10 bg-sidebar px-4 text-sm font-medium text-white shadow-none transition-colors hover:bg-sidebar-accent hover:brightness-120 hover:text-white";

const PRIMARY_BUTTON_CLASS =
  "h-max py-3  w-full rounded-sm bg-sidebar text-xs font-medium text-white shadow-none transition-colors hover:bg-sidebar-accent hover:brightness-120 hover:text-white ring ring-white/10";

const INPUT_CLASS =
  "h-max rounded-2xl ring! ring-white/10! bg-sidebar! px-4 py-3 rounded-sm text-sm text-white shadow-none placeholder:text-white/28 hover:bg-sidebar-accent hover:brightness-120 focus-visible:ring-2 focus-visible:ring-white/15 border-none";

const FIELD_LABEL_CLASS =
  "text-xs font-medium tracking-[-0.01em] text-white/42";
const AFFILIATE_CODE_TOAST_ID = "affiliate-code-status";

const SIGN_UP_HERO_SLIDES: AuthHeroSlide[] = [
  {
    title: "Build the review process before the account pressure compounds.",
    description:
      "One workspace for journaling, trade analysis, and prop-account discipline so the edge gets sharper as the data grows.",
  },
  {
    title: "Turn every session into data you can actually trust.",
    description:
      "Capture fills, notes, and routines in one place so your review process compounds instead of resetting every week.",
  },
  {
    title: "Build a system that survives volatility, tilt, and prop rules.",
    description:
      "Spot the setups worth repeating and the habits that keep leaking edge before they cost another reset.",
  },
];

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

function deriveSignupName(email: string) {
  const localPart = email.split("@")[0]?.trim() ?? "";
  const normalized = localPart
    .replace(/^[^a-zA-Z0-9]+/, "")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 40);

  return normalized || "trader";
}

const SignupPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedReturnTo = resolvePostAuthPath(searchParams?.get("returnTo"));
  const postAuthContinuePath = buildPostAuthContinuePath(requestedReturnTo);
  const loginPath = buildLoginPath(requestedReturnTo);
  const [socialProviderLoading, setSocialProviderLoading] = useState<
    "google" | null
  >(null);
  const [affiliate, setAffiliate] = useState<AffiliateInfo | null>(null);
  const [cameFromLink, setCameFromLink] = useState(false);
  const [showAffiliateInput, setShowAffiliateInput] = useState(false);
  const [affiliateCodeInput, setAffiliateCodeInput] = useState("");
  const [affiliateCodeResolved, setAffiliateCodeResolved] = useState(false);
  const resolveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestAffiliateCodeRequestRef = useRef<string | null>(null);

  useEffect(() => {
    clearLoginOnboardingBypass();

    const params = new URLSearchParams(window.location.search);
    const referralCode = params.get("ref");
    const affiliateCode = params.get("aff");

    if (affiliateCode) {
      setCameFromLink(true);
      storeAffiliateIntent(affiliateCode);

      trpcClient.billing.getAffiliatePublicProfile
        .query({ code: affiliateCode })
        .then((profile) => {
          if (profile) {
            setAffiliate(profile);
          }
        })
        .catch(() => {
          // Silently ignore — affiliate badge is optional
        });
    } else if (referralCode) {
      storeReferralIntent(referralCode);
    }
  }, []);

  const resolveAffiliateCode = useCallback((code: string) => {
    const trimmed = code.trim();
    if (!trimmed) {
      latestAffiliateCodeRequestRef.current = null;
      setAffiliate(null);
      setAffiliateCodeResolved(false);
      storeAffiliateIntent("");
      toast.dismiss(AFFILIATE_CODE_TOAST_ID);
      return;
    }

    latestAffiliateCodeRequestRef.current = trimmed;

    trpcClient.billing.getAffiliatePublicProfile
      .query({ code: trimmed })
      .then((profile) => {
        if (latestAffiliateCodeRequestRef.current !== trimmed) {
          return;
        }

        if (profile) {
          storeAffiliateIntent(trimmed);
          setAffiliate(profile);
          setAffiliateCodeResolved(true);
          toast.success("Affiliate code will be applied at checkout.", {
            id: AFFILIATE_CODE_TOAST_ID,
          });
        } else {
          storeAffiliateIntent("");
          setAffiliate(null);
          setAffiliateCodeResolved(false);
          toast.error("Affiliate code doesn't exist.", {
            id: AFFILIATE_CODE_TOAST_ID,
          });
        }
      })
      .catch(() => {
        if (latestAffiliateCodeRequestRef.current !== trimmed) {
          return;
        }

        storeAffiliateIntent("");
        setAffiliate(null);
        setAffiliateCodeResolved(false);
        toast.error("Affiliate code doesn't exist.", {
          id: AFFILIATE_CODE_TOAST_ID,
        });
      });
  }, []);

  const handleAffiliateCodeChange = useCallback(
    (value: string) => {
      setAffiliateCodeInput(value);
      setAffiliateCodeResolved(false);

      if (resolveTimerRef.current) {
        clearTimeout(resolveTimerRef.current);
      }

      const trimmed = value.trim();
      if (!trimmed) {
        latestAffiliateCodeRequestRef.current = null;
        setAffiliate(null);
        storeAffiliateIntent("");
        toast.dismiss(AFFILIATE_CODE_TOAST_ID);
        return;
      }

      resolveTimerRef.current = setTimeout(() => {
        resolveAffiliateCode(trimmed);
      }, 500);
    },
    [resolveAffiliateCode]
  );

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });
  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    await authClient.signUp.email(
      {
        email: data.email,
        name: deriveSignupName(data.email),
        password: data.password,
      },
      {
        onSuccess: async () => {
          void trackAlphaMilestone("sign_up_completed", {
            pagePath: "/sign-up",
          });

          toast.success("Account successfully created!", {
            description: "Redirecting you to onboarding.",
          });

          await waitForConfirmedSession();
          router.push(postAuthContinuePath);
        },
        onError: (error: any) => {
          const message = getErrorMessage(
            error,
            "There was a problem creating your account."
          );

          toast.error("Unable to create account", {
            description: message,
          });
        },
      }
    );
  }

  async function handleSocialSignUp(provider: "google") {
    setSocialProviderLoading(provider);

    try {
      const startedDesktopFlow = await startDesktopSocialAuth({
        provider,
        path: postAuthContinuePath,
      });
      if (startedDesktopFlow) {
        setSocialProviderLoading(null);
        return;
      }

      await authClient.signIn.social({
        provider,
        callbackURL: `${window.location.origin}${postAuthContinuePath}`,
      });
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Unable to continue with Google sign up")
      );
      setSocialProviderLoading(null);
    }
  }

  return (
    <AuthSplitShell
      heroSlides={SIGN_UP_HERO_SLIDES}
      affiliate={affiliate}
    >
      <div className="space-y-8">
        <div className="space-y-3 text-center">
          <p className="text-3xl font-medium tracking-[-0.05em] text-white sm:text-[2.15rem] sm:leading-[1.02] lg:text-[2.3rem]">
            First time here?
          </p>
          <p className="mx-auto max-w-md text-sm leading-6 text-white/56 sm:text-[15px] lg:text-base lg:leading-7">
            You've come to the right place. <br /> Build your workspace and start strong.
          </p>
        </div>

        <div className="space-y-3">
          <Button
            type="button"
            variant="ghost"
            disabled={socialProviderLoading !== null}
            onClick={() => void handleSocialSignUp("google")}
            className={SOCIAL_BUTTON_CLASS}
          >
            <Google className="size-4 stroke-none fill-white/68 transition-colors group-hover:fill-white" />
            <span>
              {socialProviderLoading === "google"
                ? "Redirecting..."
                : "Sign up with Google"}
            </span>
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs font-medium tracking-[-0.04em] text-white/32">
            Or sign up with your credentials
          </span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-5">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className={FIELD_LABEL_CLASS}>
                      Email address
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@profitabledge.com"
                        className={INPUT_CLASS}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs text-rose-200/80" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className={FIELD_LABEL_CLASS}>
                      Password
                    </FormLabel>
                    <FormControl>
                      <PasswordInput
                        className={INPUT_CLASS}
                        placeholder="Create a password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs text-rose-200/80" />
                  </FormItem>
                )}
              />
            </div>

            <Button
              type="submit"
              variant="ghost"
              disabled={isSubmitting || socialProviderLoading !== null}
              className={PRIMARY_BUTTON_CLASS}
            >
              {isSubmitting ? "Creating account..." : "Sign up"}
            </Button>
          </form>
        </Form>

        {!cameFromLink && (
          <div className="space-y-3">
            {!showAffiliateInput ? (
              <button
                type="button"
                onClick={() => setShowAffiliateInput(true)}
                className="mx-auto flex items-center gap-1.5 text-xs text-white/35 transition-colors hover:text-white/55 cursor-pointer"
              >
                <BadgePercent className="size-3" />
                Have an affiliate code?
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-white/30 text-xs">Affiliate code</p>
                <div className="relative">
                  <Input
                    value={affiliateCodeInput}
                    onChange={(e) => handleAffiliateCodeChange(e.target.value)}
                    placeholder="Enter username or code"
                    className={INPUT_CLASS}
                  />
                  {affiliateCodeResolved && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Check className="size-3.5 text-emerald-400" />
                    </div>
                  )}
                </div>
                {affiliateCodeResolved && affiliate && (
                  <p className="text-center text-xs text-white/40">
                    Referred by{" "}
                    <span className="text-white/60">
                      {affiliate.username || affiliate.name}
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <p className="text-sm text-white/46 text-center">
          Already have an account?{" "}
          <Link
            href={loginPath}
            className="font-medium text-white transition-colors hover:text-white/72"
          >
            Log in
          </Link>
        </p>
      </div>
    </AuthSplitShell>
  );
};

export default SignupPage;
