"use client";

import Link from "next/link";
import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import {
  ArrowLeft,
  BadgePercent,
  Globe,
  MapPin,
  Send,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { AuthHeroArtwork } from "@/components/auth/auth-hero-artwork";
import { Badge } from "@/components/ui/badge";
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
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { queryClient, trpcOptions } from "@/utils/trpc";

const INPUT_CLASS =
  "min-h-11 rounded-sm border-none bg-sidebar px-4 py-3 text-sm text-white ring ring-white/10 shadow-none placeholder:text-white/28 hover:bg-sidebar-accent hover:brightness-120 focus-visible:ring-2 focus-visible:ring-white/15";
const TEXTAREA_CLASS =
  "min-h-[132px] rounded-sm border-none bg-sidebar px-4 py-3 text-sm text-white ring ring-white/10 shadow-none placeholder:text-white/28 hover:bg-sidebar-accent hover:brightness-120 focus-visible:ring-2 focus-visible:ring-white/15";
const PRIMARY_BUTTON_CLASS =
  "h-11 rounded-sm bg-sidebar px-4 text-sm font-medium text-white ring ring-white/10 shadow-none transition-colors hover:bg-sidebar-accent hover:brightness-120";
const SECONDARY_BUTTON_CLASS =
  "h-11 rounded-sm bg-transparent px-4 text-sm font-medium text-white ring ring-white/10 shadow-none transition-colors hover:bg-sidebar-accent hover:brightness-120";

function isNonNegativeIntegerString(value: string) {
  return /^\d+$/.test(value.trim());
}

const AffiliateApplicationFormSchema = z.object({
  whyApply: z.string().trim().min(24, {
    message: "Tell us a bit more about why you want affiliate access.",
  }).max(1200),
  promotionPlan: z.string().trim().min(16, {
    message: "Tell us how you plan to bring the right traders in.",
  }).max(1200),
  estimatedMonthlyReferrals: z.string().trim().min(1, {
    message: "Enter an estimate for monthly referrals.",
  }).refine(isNonNegativeIntegerString, {
    message: "Use a whole number.",
  }),
  audienceSize: z.string().trim().optional().refine(
    (value) => !value || isNonNegativeIntegerString(value),
    { message: "Use a whole number." }
  ),
  twitter: z.string().max(200).optional(),
  discord: z.string().max(200).optional(),
  website: z.string().max(200).optional(),
  location: z.string().max(100).optional(),
  otherSocials: z.string().max(500).optional(),
});

function formatStatusLabel(status?: string | null) {
  if (!status) return "Pending";
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatCompactNumber(value?: number | null) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value ?? 0);
}

type AffiliateApplicationFormValues = z.infer<
  typeof AffiliateApplicationFormSchema
>;

export function AffiliateApplicationPage() {
  const billingStateQuery = useQuery(
    trpcOptions.billing.getState.queryOptions()
  );
  const meQuery = useQuery(trpcOptions.users.me.queryOptions());
  const applyForAffiliate = useMutation({
    ...trpcOptions.billing.applyForAffiliate.mutationOptions(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: trpcOptions.billing.getState.queryOptions().queryKey,
      });
      toast.success("Affiliate application submitted");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to submit affiliate application"
      );
    },
  });

  const form = useForm<AffiliateApplicationFormValues>({
    resolver: zodResolver(AffiliateApplicationFormSchema),
    defaultValues: {
      whyApply: "",
      promotionPlan: "",
      estimatedMonthlyReferrals: "",
      audienceSize: "",
      twitter: "",
      discord: "",
      website: "",
      location: "",
      otherSocials: "",
    },
  });

  const affiliate = billingStateQuery.data?.affiliate;
  const application = affiliate?.application;
  const referral = billingStateQuery.data?.referral;
  const me = meQuery.data;
  const applicationDetails =
    application?.details && typeof application.details === "object"
      ? application.details
      : null;

  useEffect(() => {
    if (!billingStateQuery.data || !me) {
      return;
    }

    form.reset({
      whyApply:
        applicationDetails?.whyApply ??
        application?.message ??
        "",
      promotionPlan: applicationDetails?.promotionPlan ?? "",
      estimatedMonthlyReferrals:
        applicationDetails?.estimatedMonthlyReferrals != null
          ? String(applicationDetails.estimatedMonthlyReferrals)
          : "",
      audienceSize:
        applicationDetails?.audienceSize != null
          ? String(applicationDetails.audienceSize)
          : "",
      twitter: applicationDetails?.twitter ?? me.twitter ?? "",
      discord: applicationDetails?.discord ?? me.discord ?? "",
      website: applicationDetails?.website ?? me.website ?? "",
      location: applicationDetails?.location ?? me.location ?? "",
      otherSocials: applicationDetails?.otherSocials ?? "",
    });
  }, [
    application?.message,
    applicationDetails,
    billingStateQuery.data,
    form,
    me,
  ]);

  if (billingStateQuery.isLoading) {
    return (
      <RouteLoadingFallback
        route="referrals"
        className="min-h-[calc(100vh-10rem)]"
      />
    );
  }

  if (affiliate?.isAffiliate) {
    return (
      <main className="p-6 py-4">
        <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#050505]">
          <AuthHeroArtwork className="opacity-70" />
          <div className="relative z-10 flex min-h-[420px] flex-col justify-between gap-10 p-6 sm:p-8">
            <div className="max-w-2xl space-y-4">
              <Badge className="h-7 rounded-sm bg-emerald-400/10 px-2.5 text-[11px] text-emerald-200 ring ring-emerald-300/20">
                Affiliate approved
              </Badge>
              <div className="space-y-3">
                <h1 className="text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl">
                  This account already has affiliate access.
                </h1>
                <p className="max-w-xl text-sm leading-6 text-white/58">
                  Your application flow is complete. Use the affiliate dashboard
                  to manage offers, links, commissions, and payouts.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild className={PRIMARY_BUTTON_CLASS}>
                <Link href="/dashboard/affiliate">Open affiliate dashboard</Link>
              </Button>
              <Button asChild variant="ghost" className={SECONDARY_BUTTON_CLASS}>
                <Link href="/dashboard/referrals">Back to referrals</Link>
              </Button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const currentSignups = referral?.stats.signups ?? 0;
  const currentPaidConversions = referral?.stats.paidConversions ?? 0;
  const applicationStatus = application?.status ?? null;
  const isSubmitting = applyForAffiliate.isPending;

  const handleSubmit = form.handleSubmit(async (values) => {
    await applyForAffiliate.mutateAsync({
      whyApply: values.whyApply.trim(),
      promotionPlan: values.promotionPlan.trim(),
      estimatedMonthlyReferrals: Number(values.estimatedMonthlyReferrals),
      audienceSize: values.audienceSize?.trim()
        ? Number(values.audienceSize)
        : null,
      twitter: values.twitter?.trim() || null,
      discord: values.discord?.trim() || null,
      website: values.website?.trim() || null,
      location: values.location?.trim() || null,
      otherSocials: values.otherSocials?.trim() || null,
    });
  });

  return (
    <main className="p-6 py-4">
      <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#050505] shadow-[0_24px_120px_rgba(0,0,0,0.45)]">
        <AuthHeroArtwork className="opacity-70" />
        <div className="relative z-10 grid min-h-[760px] lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
          <section className="flex flex-col justify-between gap-10 p-6 sm:p-8 lg:p-10">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild variant="ghost" className={SECONDARY_BUTTON_CLASS}>
                  <Link href="/dashboard/referrals">
                    <ArrowLeft className="size-4" />
                    Back to referrals
                  </Link>
                </Button>
                {applicationStatus ? (
                  <Badge className="h-7 rounded-sm bg-white/8 px-2.5 text-[11px] text-white/72 ring ring-white/10">
                    {formatStatusLabel(applicationStatus)}
                  </Badge>
                ) : null}
              </div>

              <div className="max-w-2xl space-y-4">
                <Badge className="h-7 rounded-sm bg-white/8 px-2.5 text-[11px] text-white/72 ring ring-white/10">
                  Affiliate application
                </Badge>
                <h1 className="text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl lg:text-[3.25rem] lg:leading-[0.96]">
                  Apply with the context we actually need to review you.
                </h1>
                <p className="max-w-xl text-sm leading-6 text-white/58 sm:text-[15px] sm:leading-7">
                  This is separate from the member referral ladder. We review
                  your current referral traction, your promotion plan, and the
                  social surfaces you already use to decide whether to unlock
                  affiliate access.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  label: "Referral signups",
                  value: String(currentSignups),
                  icon: UserPlus,
                },
                {
                  label: "Paid referrals",
                  value: String(currentPaidConversions),
                  icon: Users,
                },
                {
                  label: "Audience signal",
                  value: formatCompactNumber(applicationDetails?.audienceSize ?? 0),
                  icon: TrendingUp,
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-white/10 bg-black/35 p-4 backdrop-blur-sm"
                  >
                    <div className="flex items-center gap-2 text-white/45">
                      <Icon className="size-4 text-amber-300" />
                      <span className="text-xs">{item.label}</span>
                    </div>
                    <p className="mt-4 text-2xl font-semibold text-white">
                      {item.value}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="border-t border-white/10 bg-black/52 backdrop-blur-md lg:border-l lg:border-t-0">
            <div className="flex h-full flex-col p-6 sm:p-8">
              <div className="space-y-2">
                <p className="text-sm font-medium text-white">
                  Review form
                </p>
                <p className="text-sm leading-6 text-white/52">
                  Social fields are prefilled from your profile when available.
                  Update them here if this application should use different
                  links.
                </p>
              </div>

              <Separator className="my-6 bg-white/8" />

              <Form {...form}>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <FormField
                    control={form.control}
                    name="whyApply"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-white/58">
                          Why do you want affiliate access?
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            className={TEXTAREA_CLASS}
                            placeholder="Tell us why you're applying, what kind of traders you reach, and why you'd be a strong fit for the program."
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="promotionPlan"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-white/58">
                          How will you promote Profitabledge?
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            className={TEXTAREA_CLASS}
                            placeholder="Explain the channels, communities, content formats, or mentorship workflows you plan to use."
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="estimatedMonthlyReferrals"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-white/58">
                            Estimated referrals per month
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              min={0}
                              step={1}
                              value={field.value ?? ""}
                              className={INPUT_CLASS}
                              placeholder="25"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="audienceSize"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-white/58">
                            Audience size
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              min={0}
                              step={1}
                              value={field.value ?? ""}
                              className={INPUT_CLASS}
                              placeholder="2500"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-center gap-2">
                      <BadgePercent className="size-4 text-amber-300" />
                      <p className="text-sm font-medium text-white">
                        Current referral history
                      </p>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-white/48">
                      We use your actual member referral stats automatically, so
                      you do not need to re-enter them manually.
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-white/8 bg-black/25 p-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/32">
                          Signups
                        </p>
                        <p className="mt-2 text-xl font-semibold text-white">
                          {currentSignups}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/8 bg-black/25 p-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/32">
                          Paid referrals
                        </p>
                        <p className="mt-2 text-xl font-semibold text-white">
                          {currentPaidConversions}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="twitter"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-white/58">
                            X / Twitter
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value ?? ""}
                              className={INPUT_CLASS}
                              placeholder="@yourhandle"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="discord"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-white/58">
                            Discord
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value ?? ""}
                              className={INPUT_CLASS}
                              placeholder="yourserver / yourhandle"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="website"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-white/58">
                            Website
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Globe className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/28" />
                              <Input
                                {...field}
                                value={field.value ?? ""}
                                className={cn(INPUT_CLASS, "pl-10")}
                                placeholder="https://your-site.com"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs text-white/58">
                            Location
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/28" />
                              <Input
                                {...field}
                                value={field.value ?? ""}
                                className={cn(INPUT_CLASS, "pl-10")}
                                placeholder="London, UK"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="otherSocials"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-white/58">
                          Other socials or communities
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            value={field.value ?? ""}
                            className={TEXTAREA_CLASS}
                            placeholder="Share any Telegram groups, YouTube channels, newsletters, mentorship communities, or other places you plan to promote from."
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex flex-wrap gap-3 pt-2">
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className={PRIMARY_BUTTON_CLASS}
                    >
                      <Send className="size-4" />
                      {isSubmitting
                        ? "Submitting..."
                        : application
                        ? "Update application"
                        : "Submit application"}
                    </Button>
                    <Button asChild variant="ghost" className={SECONDARY_BUTTON_CLASS}>
                      <Link href="/dashboard/referrals">Cancel</Link>
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
