"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  KeyRound,
  Mail,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { storeBetaCode } from "@/features/growth/lib/access-intent";
import { trpcClient, trpcOptions } from "@/utils/trpc";

export default function HomePage() {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [betaCode, setBetaCode] = useState("");
  const [betaMessage, setBetaMessage] = useState<string | null>(null);
  const [betaValid, setBetaValid] = useState<boolean | null>(null);
  const [betaChecking, setBetaChecking] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);

  const billingConfigQuery = useQuery(
    trpcOptions.billing.getPublicConfig.queryOptions()
  );
  const joinWaitlist = useMutation({
    ...trpcOptions.billing.joinPrivateBetaWaitlist.mutationOptions(),
    onSuccess: () => {
      setWaitlistSubmitted(true);
      setWaitlistEmail("");
      toast.success("You have been added to the private beta waitlist");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to join the waitlist"
      );
    },
  });

  const privateBetaRequired = billingConfigQuery.data?.privateBetaRequired ?? true;
  const destination = session?.user ? "/onboarding" : "/sign-up";

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

  async function handleUnlock() {
    const normalizedCode = betaCode.trim().toUpperCase();

    if (!privateBetaRequired && !normalizedCode) {
      router.push(destination);
      return;
    }

    if (!normalizedCode) {
      setBetaValid(false);
      setBetaMessage("Enter your private beta code to continue");
      return;
    }

    const result = await validateBetaCode(normalizedCode);
    if (!result?.valid) {
      toast.error(
        (result && "message" in result ? result.message : null) ||
          "Invalid private beta code"
      );
      return;
    }

    storeBetaCode(normalizedCode);
    toast.success("Private beta access saved");
    router.push(destination);
  }

  async function handleWaitlistSubmit() {
    const normalizedEmail = waitlistEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      toast.error("Enter your email to join the waitlist");
      return;
    }

    await joinWaitlist.mutateAsync({
      email: normalizedEmail,
      source: "root",
    });
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.14),transparent_26%),linear-gradient(180deg,#101010_0%,#050505_100%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-[0_16px_40px_rgba(0,0,0,0.24)]">
              <Sparkles className="size-4 text-emerald-300" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-[0.18em] text-white/90 uppercase">
                Profitabledge
              </p>
              <p className="text-xs text-white/40">
                Private beta access and referral onboarding
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="ghost"
              className="h-9 rounded-full border border-white/10 bg-white/[0.03] px-4 text-xs text-white/70 hover:bg-white/10 hover:text-white"
            >
              <Link href="/login">Log in</Link>
            </Button>
            <Button
              asChild
              className="h-9 rounded-full bg-emerald-500 px-4 text-xs font-medium text-black hover:bg-emerald-400"
            >
              <Link href={destination}>
                {session?.user ? "Continue" : "Sign up"}
              </Link>
            </Button>
          </div>
        </header>

        <div className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(420px,520px)] lg:py-16">
          <section className="max-w-2xl">
            <Badge className="mb-5 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-200">
              <Shield className="mr-1 size-3" />
              {privateBetaRequired ? "Private beta is active" : "Launch access is open"}
            </Badge>

            <h1 className="max-w-xl text-4xl font-semibold tracking-[-0.06em] text-white sm:text-5xl lg:text-6xl">
              Enter the beta, test the full platform, or join the waitlist.
            </h1>

            <p className="mt-5 max-w-xl text-base leading-7 text-white/55 sm:text-lg">
              Private beta codes unlock the full onboarding flow. If you do not
              have one yet, join the waitlist and I will review invites
              manually before launch.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                {
                  icon: KeyRound,
                  title: "Private beta",
                  copy: "Use a beta code to unlock sign-up or continue onboarding.",
                },
                {
                  icon: Users,
                  title: "Referrals",
                  copy: "Members can invite others and earn lighter product rewards.",
                },
                {
                  icon: Sparkles,
                  title: "Affiliates",
                  copy: "Approved affiliates get commission tracking and a dedicated dashboard.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.22)]"
                >
                  <item.icon className="size-4 text-emerald-300" />
                  <p className="mt-4 text-sm font-medium text-white">
                    {item.title}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-white/45">
                    {item.copy}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[32px] border border-white/10 bg-white/[0.045] p-2 shadow-[0_32px_80px_rgba(0,0,0,0.32)] backdrop-blur">
            <div className="rounded-[28px] bg-[#0f0f10] p-6 sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-white">Unlock access</p>
                  <p className="mt-1 text-xs leading-5 text-white/45">
                    Validate your private beta code and continue into the app.
                  </p>
                </div>
                <Badge className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[10px] text-white/70">
                  {session?.user ? "Resume onboarding" : "Start sign-up"}
                </Badge>
              </div>

              <div className="mt-6 space-y-3">
                <div className="space-y-2">
                  <label className="text-[11px] uppercase tracking-[0.16em] text-white/35">
                    Private beta code
                  </label>
                  <Input
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
                    placeholder={privateBetaRequired ? "BETA1234" : "Optional"}
                    className="h-12 rounded-2xl border-white/10 bg-white/[0.04] px-4 text-sm"
                  />
                  <p
                    className={cn(
                      "text-xs",
                      betaValid === true
                        ? "text-emerald-300"
                        : betaValid === false
                        ? "text-rose-300"
                        : "text-white/40"
                    )}
                  >
                    {betaChecking
                      ? "Checking code..."
                      : betaMessage ||
                        (privateBetaRequired
                          ? "A valid beta code is required before continuing."
                          : "Optional while launch access is open.")}
                  </p>
                </div>

                <Button
                  onClick={handleUnlock}
                  disabled={betaChecking || sessionPending}
                  className="h-12 w-full rounded-2xl bg-emerald-500 text-sm font-medium text-black hover:bg-emerald-400"
                >
                  {betaChecking
                    ? "Checking access..."
                    : session?.user
                    ? "Continue to onboarding"
                    : "Continue to sign up"}
                  <ArrowRight className="ml-2 size-4" />
                </Button>
              </div>

              <div className="mt-6 flex items-center gap-3">
                <Separator className="flex-1 bg-white/10" />
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/30">
                  Or
                </p>
                <Separator className="flex-1 bg-white/10" />
              </div>

              <div className="mt-6">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl border border-blue-400/15 bg-blue-500/10">
                    <Mail className="size-4 text-blue-200" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      Join the waitlist
                    </p>
                    <p className="mt-1 text-xs leading-5 text-white/45">
                      No automated emails yet. Entries are reviewed manually.
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <Input
                    type="email"
                    value={waitlistEmail}
                    onChange={(event) => setWaitlistEmail(event.target.value)}
                    placeholder="you@desk.com"
                    className="h-12 flex-1 rounded-2xl border-white/10 bg-white/[0.04] px-4 text-sm"
                  />
                  <Button
                    onClick={handleWaitlistSubmit}
                    disabled={joinWaitlist.isPending}
                    className="h-12 rounded-2xl border border-white/10 bg-white/[0.06] px-5 text-sm text-white hover:bg-white/[0.12]"
                  >
                    {joinWaitlist.isPending ? "Submitting..." : "Join waitlist"}
                  </Button>
                </div>

                <p className="mt-3 text-xs text-white/40">
                  {waitlistSubmitted
                    ? "Your email is on the list. I’ll review it manually."
                    : "Use the waitlist if you do not have a beta code yet."}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
