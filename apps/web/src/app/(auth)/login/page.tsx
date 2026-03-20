"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { AuthSplitShell } from "@/components/auth/auth-split-shell";
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
import {
  buildSignUpPath,
  buildPostAuthContinuePath,
  resolvePostAuthPath,
} from "@/lib/post-auth-paths";
import { waitForConfirmedSession } from "@/lib/session-confirmation";
import Google from "@/public/icons/social-media/google.svg";
import X from "@/public/icons/social-media/x.svg";

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
  password: z.string().min(8, {
    message: "Password must be at least 8 characters.",
  }),
});

const LoginPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedReturnTo = resolvePostAuthPath(searchParams?.get("returnTo"));
  const postAuthContinuePath = buildPostAuthContinuePath(requestedReturnTo);
  const signUpPath = buildSignUpPath(requestedReturnTo);
  const [socialProviderLoading, setSocialProviderLoading] = useState<
    "google" | "twitter" | null
  >(null);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });
  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    await authClient.signIn.email(
      {
        email: data.email,
        password: data.password,
      },
      {
        onSuccess: async () => {
          toast.success("Login successful", { id: "auth-login-status" });
          await waitForConfirmedSession();
          router.replace(postAuthContinuePath);
        },
        onError: (error) => {
          toast.error(error.error.message || "Unable to sign in", {
            id: "auth-login-status",
          });
        },
      }
    );
  }

  async function handleSocialLogin(provider: "google" | "twitter") {
    const providerLabel = provider === "google" ? "Google login" : "X login";
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
    <AuthSplitShell>
      <div className="space-y-8">
        <div className="space-y-3 text-center">
          <p className="text-3xl font-medium tracking-[-0.05em] text-white/50">
            Welcome back to profitabledge
          </p>
          <p className="text-sm leading-6 text-white/56">
            Are you ready to dive back into your profitable edge?
          </p>
        </div>

        <div className="space-y-3">
          <Button
            type="button"
            variant="ghost"
            disabled={socialProviderLoading !== null}
            onClick={() => void handleSocialLogin("google")}
            className={SOCIAL_BUTTON_CLASS}
          >
            <Google className="size-4 stroke-none fill-white/68 transition-colors group-hover:fill-white" />
            <span>
              {socialProviderLoading === "google"
                ? "Redirecting..."
                : "Log in with Google"}
            </span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            disabled={socialProviderLoading !== null}
            onClick={() => void handleSocialLogin("twitter")}
            className={SOCIAL_BUTTON_CLASS}
          >
            <X className="size-4 stroke-none fill-white/68 transition-colors group-hover:fill-white" />
            <span>
              {socialProviderLoading === "twitter"
                ? "Redirecting..."
                : "Log in with X"}
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
                  <FormItem className="space-y-1">
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
              disabled={isSubmitting || socialProviderLoading !== null}
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
