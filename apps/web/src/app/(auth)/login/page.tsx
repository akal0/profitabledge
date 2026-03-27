"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Fingerprint } from "lucide-react";

import {
  AuthSplitShell,
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
import { getErrorMessage } from "@/lib/error-message";
import { markLoginOnboardingBypass } from "@/lib/login-onboarding-bypass";
import { signInWithPasskey } from "@/lib/passkey-sign-in";
import {
  buildPostLoginPath,
  buildSignUpPath,
  buildTwoFactorPath,
  resolvePostAuthPath,
} from "@/lib/post-auth-paths";
import { waitForConfirmedSession } from "@/lib/session-confirmation";
import Google from "@/public/icons/social-media/google.svg";

const SOCIAL_BUTTON_CLASS =
  "group h-max w-full justify-center rounded-sm ring ring-white/10 bg-sidebar px-4 text-sm font-medium text-white shadow-none transition-colors hover:bg-sidebar-accent hover:brightness-120 hover:text-white gap-1";

const PRIMARY_BUTTON_CLASS =
  "h-max py-3  w-full rounded-sm bg-sidebar text-xs font-medium text-white shadow-none transition-colors hover:bg-sidebar-accent hover:brightness-120 hover:text-white ring ring-white/10";

const INPUT_CLASS =
  "h-max rounded-2xl ring! ring-white/10! bg-sidebar! px-4 py-3 rounded-sm text-sm text-white shadow-none placeholder:text-white/28 hover:bg-sidebar-accent hover:brightness-120 focus-visible:ring-2 focus-visible:ring-white/15 border-none";

const FIELD_LABEL_CLASS =
  "text-xs font-medium tracking-[-0.01em] text-white/42";

const LOGIN_HERO_SLIDES: AuthHeroSlide[] = [
  {
    title: "See the edge before the same mistake repeats.",
    description:
      "Turn raw fills, edge reviews, and prop-account pressure into a proof-first loop that sharpens your next session.",
  },
  {
    title: "Your cleanest trades already told you what to scale.",
    description:
      "Review execution, timing, and context in one workspace instead of piecing the lesson together after the damage is done.",
  },
  {
    title: "Prop pressure feels smaller when the process is visible.",
    description:
      "Track discipline, rule risk, and recurring leaks before one emotional trade distorts the whole month.",
  },
];

const FormSchema = z.object({
  identifier: z.string().trim().min(2, {
    message: "Enter your email address or username.",
  }),
  password: z.string().min(8, {
    message: "Password must be at least 8 characters.",
  }),
});

const LoginPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedReturnTo = resolvePostAuthPath(searchParams?.get("returnTo"));
  const postLoginPath = buildPostLoginPath(requestedReturnTo);
  const twoFactorPath = buildTwoFactorPath(requestedReturnTo);
  const signUpPath = buildSignUpPath(requestedReturnTo);
  const [socialProviderLoading, setSocialProviderLoading] = useState<
    "google" | null
  >(null);
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      identifier: "",
      password: "",
    },
  });
  const isSubmitting = form.formState.isSubmitting;
  const isBusy =
    isSubmitting || socialProviderLoading !== null || passkeyLoading;

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    const identifier = data.identifier.trim();
    const result = identifier.includes("@")
      ? await authClient.signIn.email({
          email: identifier,
          password: data.password,
        })
      : await authClient.signIn.username({
          username: identifier,
          password: data.password,
        });

    if (result.error) {
      toast.error(getErrorMessage(result.error, "Unable to sign in"), {
        id: "auth-login-status",
      });
      return;
    }

    if (result.data?.twoFactorRedirect) {
      markLoginOnboardingBypass();
      router.replace(twoFactorPath);
      return;
    }

    toast.success("Login successful", { id: "auth-login-status" });
    await waitForConfirmedSession();
    markLoginOnboardingBypass();
    router.replace(postLoginPath);
  }

  async function handleSocialLogin(provider: "google") {
    setSocialProviderLoading(provider);

    try {
      markLoginOnboardingBypass();
      await authClient.signIn.social({
        provider,
        callbackURL: `${window.location.origin}${postLoginPath}`,
      });
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Unable to continue with Google login")
      );
      setSocialProviderLoading(null);
    }
  }

  async function handlePasskeyLogin() {
    setPasskeyLoading(true);

    try {
      const result = await signInWithPasskey();
      if (result.error) {
        toast.error(result.error.message);
        return;
      }

      toast.success("Login successful", { id: "auth-login-status" });
      await waitForConfirmedSession();
      markLoginOnboardingBypass();
      router.replace(postLoginPath);
    } finally {
      setPasskeyLoading(false);
    }
  }

  return (
    <AuthSplitShell heroSlides={LOGIN_HERO_SLIDES} showFormGlow>
      <div className="space-y-8">
        <div className="space-y-3 text-center">
          <p className="text-3xl font-medium tracking-[-0.05em] text-white sm:text-[2.15rem] sm:leading-[1.02] lg:text-[2.3rem]">
            Welcome back to profitabledge
          </p>
          <p className="mx-auto max-w-md text-sm leading-6 text-white/56 sm:text-[15px] lg:text-base lg:leading-7">
            Are you ready to dive back into your profitable edge?
          </p>
        </div>

        <div className="space-y-3">
          <Button
            type="button"
            variant="ghost"
            disabled={isBusy}
            onClick={() => void handleSocialLogin("google")}
            className={SOCIAL_BUTTON_CLASS}
          >
            <Google className="size-4 stroke-none fill-white/68 transition-colors group-hover:fill-white" />
            <span>
              {socialProviderLoading === "google"
                ? "Redirecting..."
                : "Login with Google"}
            </span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            disabled={isBusy}
            onClick={() => void handlePasskeyLogin()}
            className={SOCIAL_BUTTON_CLASS}
          >
            <Fingerprint className="size-4 text-white/68 transition-colors group-hover:text-white" />
            <span>
              {passkeyLoading ? "Checking..." : "Sign in with passkey"}
            </span>
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs font-semibold tracking-[-0.04em] text-white/75">
            Or sign in with your credentials
          </span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-5">
              <FormField
                control={form.control}
                name="identifier"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className={FIELD_LABEL_CLASS}>
                      Email address or username
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="you@profitabledge.com or @kalcryptev"
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
                  <FormItem className="space-y-1">
                    <FormLabel className={FIELD_LABEL_CLASS}>
                      Password
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Enter your password"
                        className={INPUT_CLASS}
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
              disabled={isBusy}
              className={PRIMARY_BUTTON_CLASS}
            >
              {isSubmitting ? "Logging in..." : "Log in"}
            </Button>
          </form>
        </Form>

        <p className="text-sm text-white/46 text-center">
          Don&apos;t have an account?{" "}
          <Link
            href={signUpPath}
            className="font-medium text-white transition-colors hover:text-white/72"
          >
            Sign up
          </Link>
        </p>
      </div>
    </AuthSplitShell>
  );
};

export default LoginPage;
