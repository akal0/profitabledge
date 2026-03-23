"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { trackAlphaMilestone } from "@/lib/alpha-analytics";
import {
  AuthSplitShell,
  type AffiliateInfo,
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
import { storeAffiliateIntent } from "@/features/growth/lib/access-intent";
import {
  buildLoginPath,
  buildPostAuthContinuePath,
  resolvePostAuthPath,
} from "@/lib/post-auth-paths";
import { trpcClient } from "@/utils/trpc";
import Google from "@/public/icons/social-media/google.svg";
import X from "@/public/icons/social-media/x.svg";
import PasswordInput from "../../sign-up/components/password-input";

const SOCIAL_BUTTON_CLASS =
  "group h-max w-full justify-center rounded-sm ring ring-white/10 bg-sidebar px-4 text-sm font-medium text-white shadow-none transition-colors hover:bg-sidebar-accent hover:brightness-120 hover:text-white";

const PRIMARY_BUTTON_CLASS =
  "h-max py-3  w-full rounded-sm bg-sidebar text-xs font-medium text-white shadow-none transition-colors hover:bg-sidebar-accent hover:brightness-120 hover:text-white ring ring-white/10";

const INPUT_CLASS =
  "h-max rounded-2xl ring! ring-white/10! bg-sidebar! px-4 py-3 rounded-sm text-sm text-white shadow-none placeholder:text-white/28 hover:bg-sidebar-accent hover:brightness-120 focus-visible:ring-2 focus-visible:ring-white/15 border-none";

const FIELD_LABEL_CLASS =
  "text-xs font-medium tracking-[-0.01em] text-white/42";

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

function deriveSignupName(email: string) {
  const localPart = email.split("@")[0]?.trim() ?? "";
  const normalized = localPart
    .replace(/^[^a-zA-Z0-9]+/, "")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 40);

  return normalized || "trader";
}

export default function InvitePage() {
  const params = useParams<{ username: string }>();
  const username = decodeURIComponent(params?.username ?? "");
  const initialAffiliate: AffiliateInfo | null = username
    ? {
        name: username,
        username,
        image: null,
      }
    : null;
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedReturnTo = resolvePostAuthPath(searchParams?.get("returnTo"));
  const postAuthContinuePath = buildPostAuthContinuePath(requestedReturnTo);
  const loginPath = buildLoginPath(requestedReturnTo);
  const [socialProviderLoading, setSocialProviderLoading] = useState<
    "google" | "twitter" | null
  >(null);
  const [affiliate, setAffiliate] = useState<AffiliateInfo | null>(
    initialAffiliate
  );
  const channel = searchParams?.get("channel") ?? null;
  const inviterLabel = affiliate?.username || affiliate?.name || username;

  useEffect(() => {
    storeAffiliateIntent(username, channel);

    trpcClient.billing.getAffiliatePublicProfile
      .query({ code: username })
      .then((profile) => {
        if (profile) {
          setAffiliate(profile);
        }
      })
      .catch(() => {
        // Silently ignore — affiliate badge is optional
      });
  }, [username, channel]);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });
  const isSubmitting = form.formState.isSubmitting;

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
    await authClient.signUp.email(
      {
        email: data.email,
        name: deriveSignupName(data.email),
        password: data.password,
      },
      {
        onSuccess: async () => {
          void trackAlphaMilestone("sign_up_completed", {
            pagePath: `/invite/${username}`,
          });

          toast.success("Account successfully created!", {
            description: "Redirecting you to onboarding.",
          });

          await waitForConfirmedSession();
          router.push(postAuthContinuePath);
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

  async function handleSocialSignUp(provider: "google" | "twitter") {
    const providerLabel =
      provider === "google" ? "Google sign up" : "X sign up";
    setSocialProviderLoading(provider);

    try {
      await authClient.signIn.social({
        provider,
        callbackURL: `${window.location.origin}${postAuthContinuePath}`,
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
    <AuthSplitShell
      heroTitle="Build the review process before the account pressure compounds."
      heroDescription="One workspace for journaling, trade analysis, and prop-account discipline so the edge gets sharper as the data grows."
      affiliate={affiliate}
      hideAffiliateDescription
    >
      <div className="space-y-8">
        <div className="space-y-3 text-center">
          <p className="text-3xl font-medium tracking-[-0.05em] text-white/50">
            You&apos;ve been invited by {inviterLabel}
          </p>
          <p className="text-sm leading-6 text-white/56">
            You've come to the right place. All roads lead back to{" "}
            <span className="text-white font-semibold">profitabledge...</span>
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

          <Button
            type="button"
            variant="ghost"
            disabled={socialProviderLoading !== null}
            onClick={() => void handleSocialSignUp("twitter")}
            className={SOCIAL_BUTTON_CLASS}
          >
            <X className="size-4 stroke-none fill-white/68 transition-colors group-hover:fill-white" />
            <span>
              {socialProviderLoading === "twitter"
                ? "Redirecting..."
                : "Sign up with X"}
            </span>
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs font-medium tracking-[-0.04em] text-white/32">
            Or sign in with your credentials
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
}
