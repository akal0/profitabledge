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
import {
  AuthSplitShell,
  type AffiliateInfo,
} from "@/components/auth/auth-split-shell";
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
import { Textarea } from "@/components/ui/textarea";
import { getPropAssignActionButtonClassName } from "@/features/accounts/lib/prop-assign-action-button";
import { cn } from "@/lib/utils";
import { queryClient, trpcOptions } from "@/utils/trpc";

const INPUT_CLASS =
  "h-max rounded-sm border-none bg-sidebar px-4 py-3 text-sm text-white ring ring-white/10 shadow-none placeholder:text-white/28 hover:bg-sidebar-accent hover:brightness-120 focus-visible:ring-2 focus-visible:ring-white/15";
const TEXTAREA_CLASS =
  "min-h-[132px] rounded-sm border-none bg-sidebar px-4 py-3 text-sm text-white ring ring-white/10 shadow-none placeholder:text-white/28 hover:bg-sidebar-accent hover:brightness-120 focus-visible:ring-2 focus-visible:ring-white/15";
const FIELD_LABEL_CLASS = "text-xs font-medium text-white/42";

function isNonNegativeIntegerString(value: string) {
  return /^\d+$/.test(value.trim());
}

const AffiliateApplicationFormSchema = z.object({
  whyApply: z
    .string()
    .trim()
    .min(24, {
      message: "Tell us a bit more about why you want affiliate access.",
    })
    .max(1200),
  promotionPlan: z
    .string()
    .trim()
    .min(16, {
      message: "Tell us how you plan to bring the right traders in.",
    })
    .max(1200),
  estimatedMonthlyReferrals: z
    .string()
    .trim()
    .min(1, {
      message: "Enter an estimate for monthly referrals.",
    })
    .refine(isNonNegativeIntegerString, {
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

function AffiliateApplicationHero({
  currentSignups,
  currentPaidConversions,
  audienceSignal,
  applicationStatus,
}: {
  currentSignups: number;
  currentPaidConversions: number;
  audienceSignal: string;
  applicationStatus?: string | null;
}) {
  return (
    <div className="relative z-10 flex w-full max-w-[34rem] flex-col items-center gap-6 text-center">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Badge className="h-7 rounded-sm bg-white/8 px-2.5 text-[11px] text-white/72 ring ring-white/10">
            Affiliate application
          </Badge>
          {applicationStatus ? (
            <Badge className="h-7 rounded-sm bg-white/8 px-2.5 text-[11px] text-white/72 ring ring-white/10">
              {formatStatusLabel(applicationStatus)}
            </Badge>
          ) : null}
        </div>
        <div className="space-y-3">
          <h2 className="mx-auto max-w-[32rem] text-4xl font-semibold leading-[1.02] text-white xl:text-[3rem] xl:leading-[0.98]">
            Apply with the context we actually need to review you.
          </h2>
          <p className="mx-auto max-w-[28rem] text-sm leading-6 text-white/58 xl:text-base xl:leading-7">
            This is separate from the member referral ladder. We review your
            current referral traction, your promotion plan, and the social
            surfaces you already use before affiliate access is unlocked.
          </p>
        </div>
      </div>

      <div className="grid w-full gap-3 sm:grid-cols-3">
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
            value: audienceSignal,
            icon: TrendingUp,
          },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.label}
              className="rounded-sm bg-sidebar/70 p-4 text-center ring ring-white/8 backdrop-blur-[2px]"
            >
              <div className="flex items-center justify-center gap-2 text-white/45">
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
    </div>
  );
}

function ApprovedAffiliateShell() {
  return (
    <AuthSplitShell
      className="max-w-[33rem]"
      heroArtwork={<AuthHeroArtwork />}
      heroContent={
        <div className="relative z-10 flex w-full max-w-[32rem] flex-col items-center gap-4 text-center">
          <Badge className="h-7 rounded-sm bg-emerald-400/10 px-2.5 text-[11px] text-emerald-200 ring ring-emerald-300/20">
            Affiliate approved
          </Badge>
          <h2 className="text-4xl font-semibold leading-[1.02] text-white xl:text-[3rem] xl:leading-[0.98]">
            This account already has affiliate access.
          </h2>
          <p className="mx-auto max-w-[28rem] text-sm leading-6 text-white/58 xl:text-base xl:leading-7">
            Your application flow is complete. Use the affiliate dashboard to
            manage offers, links, commissions, and payouts.
          </p>
        </div>
      }
    >
      <div className="space-y-8">
        <div className="space-y-3 text-center">
          <p className="text-3xl font-medium text-white/50 sm:text-[2.15rem] sm:leading-[1.02] lg:text-[2.3rem]">
            Affiliate access is already active
          </p>
          <p className="mx-auto max-w-md text-sm leading-6 text-white/56 sm:text-[15px] lg:text-base lg:leading-7">
            There&apos;s nothing left to submit for this account.
          </p>
        </div>

        <div className="space-y-3">
          <Button
            asChild
            className={getPropAssignActionButtonClassName({
              tone: "teal",
              className: "h-11 w-full justify-center text-sm",
            })}
          >
            <Link href="/dashboard/affiliate">Open affiliate dashboard</Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            className={getPropAssignActionButtonClassName({
              tone: "ghost",
              className: "h-11 w-full justify-center text-sm",
            })}
          >
            <Link href="/dashboard/referrals">Back to referrals</Link>
          </Button>
        </div>
      </div>
    </AuthSplitShell>
  );
}

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
  const applicantIdentity: AffiliateInfo | null = me
    ? {
        name: me.name ?? me.username ?? "Trader",
        username: me.username ?? null,
        image: me.image ?? null,
      }
    : null;
  const applicationDetails =
    application?.details && typeof application.details === "object"
      ? application.details
      : null;

  useEffect(() => {
    if (!billingStateQuery.data || !me) {
      return;
    }

    form.reset({
      whyApply: applicationDetails?.whyApply ?? application?.message ?? "",
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
  }, [application?.message, applicationDetails, billingStateQuery.data, form, me]);

  if (billingStateQuery.isLoading) {
    return <RouteLoadingFallback route="referrals" className="min-h-screen" />;
  }

  if (billingStateQuery.isError || meQuery.isError) {
    return (
      <AuthSplitShell className="max-w-[33rem]" heroArtwork={<AuthHeroArtwork />}>
        <div className="space-y-6 text-center">
          <p className="text-3xl font-medium text-white/50 sm:text-[2.15rem] sm:leading-[1.02] lg:text-[2.3rem]">
            Sign in to continue your affiliate application
          </p>
          <p className="mx-auto max-w-md text-sm leading-6 text-white/56 sm:text-[15px] lg:text-base lg:leading-7">
            This page is only available for a signed-in account with referral
            access.
          </p>
          <Button
            asChild
            className={getPropAssignActionButtonClassName({
              tone: "teal",
              className: "h-11 w-full justify-center text-sm",
            })}
          >
            <Link href="/login?returnTo=%2Fapply%2Faffiliate">Log in</Link>
          </Button>
        </div>
      </AuthSplitShell>
    );
  }

  if (affiliate?.isAffiliate) {
    return <ApprovedAffiliateShell />;
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
    <AuthSplitShell
      className="max-w-[34rem]"
      heroArtwork={<AuthHeroArtwork />}
      affiliate={applicantIdentity}
      hideAffiliateDescription
      heroContent={
        <AffiliateApplicationHero
          currentSignups={currentSignups}
          currentPaidConversions={currentPaidConversions}
          audienceSignal={formatCompactNumber(applicationDetails?.audienceSize ?? 0)}
          applicationStatus={applicationStatus}
        />
      }
    >
      <div className="space-y-8">
        <div className="space-y-4 text-center">
          <div className="flex justify-center">
            <Button
              asChild
              variant="ghost"
              className={getPropAssignActionButtonClassName({
                tone: "ghost",
                className: "h-11 px-4 text-sm",
              })}
            >
              <Link href="/dashboard/referrals">
                <ArrowLeft className="size-4" />
                Back to referrals
              </Link>
            </Button>
          </div>
          <div className="space-y-3">
            <p className="text-3xl font-medium text-white/50 sm:text-[2.15rem] sm:leading-[1.02] lg:text-[2.3rem]">
              Affiliate review form
            </p>
            <p className="mx-auto max-w-md text-sm leading-6 text-white/56 sm:text-[15px] lg:text-base lg:leading-7">
              Social fields are prefilled from your profile when available.
              Update them here if this application should use different links.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-sm bg-sidebar p-4 text-left ring ring-white/8">
            <p className="text-[10px] text-white/25">Partner tier</p>
            <p className="mt-2 text-sm font-medium text-white">20% recurring split</p>
            <p className="mt-1 text-xs leading-5 text-white/40">
              Unlock tracked links, offer codes, withdrawals, and premium access.
            </p>
          </div>
          <div className="rounded-sm bg-sidebar p-4 text-left ring ring-white/8">
            <p className="text-[10px] text-white/25">Pro tier</p>
            <p className="mt-2 text-sm font-medium text-white">25% split at $2.5k revenue</p>
            <p className="mt-1 text-xs leading-5 text-white/40">
              Level up into creator-kit perks, featured proof treatment, and priority support.
            </p>
          </div>
          <div className="rounded-sm bg-sidebar p-4 text-left ring ring-white/8">
            <p className="text-[10px] text-white/25">Review timeline</p>
            <p className="mt-2 text-sm font-medium text-white">Usually 24-72 hours</p>
            <p className="mt-1 text-xs leading-5 text-white/40">
              We review your referral traction, promotion plan, and audience fit before approval.
            </p>
          </div>
        </div>

        {applicationStatus === "rejected" ? (
          <div className="rounded-sm border border-rose-500/20 bg-rose-500/10 p-4 text-left">
            <p className="text-sm font-medium text-rose-100">
              This application was rejected, but you can update the form and resubmit.
            </p>
            <p className="mt-1 text-xs leading-5 text-rose-100/70">
              Strengthen your promotion plan, add clearer audience details, and include the channels where you already have traction.
            </p>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-sm bg-sidebar p-4 text-left ring ring-white/8">
            <div className="flex items-center gap-2 text-white/45">
              <UserPlus className="size-4 text-amber-300" />
              <span className="text-xs">Signups</span>
            </div>
            <p className="mt-3 text-2xl font-semibold text-white">
              {currentSignups}
            </p>
          </div>
          <div className="rounded-sm bg-sidebar p-4 text-left ring ring-white/8">
            <div className="flex items-center gap-2 text-white/45">
              <BadgePercent className="size-4 text-amber-300" />
              <span className="text-xs">Paid referrals</span>
            </div>
            <p className="mt-3 text-2xl font-semibold text-white">
              {currentPaidConversions}
            </p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <FormField
              control={form.control}
              name="whyApply"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={FIELD_LABEL_CLASS}>
                    Why do you want affiliate access?
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      className={TEXTAREA_CLASS}
                      placeholder="Tell us why you're applying, what kind of traders you reach, and why you'd be a strong fit for the program."
                    />
                  </FormControl>
                  <FormMessage className="text-xs text-rose-200/80" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="promotionPlan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={FIELD_LABEL_CLASS}>
                    How will you promote Profitabledge?
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      className={TEXTAREA_CLASS}
                      placeholder="Explain the channels, communities, content formats, or mentorship workflows you plan to use."
                    />
                  </FormControl>
                  <FormMessage className="text-xs text-rose-200/80" />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="estimatedMonthlyReferrals"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={FIELD_LABEL_CLASS}>
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
                    <FormMessage className="text-xs text-rose-200/80" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="audienceSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={FIELD_LABEL_CLASS}>
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
                    <FormMessage className="text-xs text-rose-200/80" />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="twitter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={FIELD_LABEL_CLASS}>
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
                    <FormMessage className="text-xs text-rose-200/80" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="discord"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={FIELD_LABEL_CLASS}>Discord</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        className={INPUT_CLASS}
                        placeholder="yourserver / yourhandle"
                      />
                    </FormControl>
                    <FormMessage className="text-xs text-rose-200/80" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={FIELD_LABEL_CLASS}>Website</FormLabel>
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
                    <FormMessage className="text-xs text-rose-200/80" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={FIELD_LABEL_CLASS}>Location</FormLabel>
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
                    <FormMessage className="text-xs text-rose-200/80" />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="otherSocials"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={FIELD_LABEL_CLASS}>
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
                  <FormMessage className="text-xs text-rose-200/80" />
                </FormItem>
              )}
            />

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="submit"
                disabled={isSubmitting}
                className={getPropAssignActionButtonClassName({
                  tone: "teal",
                  className: "h-11 flex-1 text-sm",
                })}
              >
                <Send className="size-4" />
                {isSubmitting
                  ? "Submitting..."
                  : application
                    ? "Update application"
                    : "Submit application"}
              </Button>
              <Button
                asChild
                variant="ghost"
                className={getPropAssignActionButtonClassName({
                  tone: "ghost",
                  className: "h-11 flex-1 text-sm",
                })}
              >
                <Link href="/dashboard/referrals">Cancel</Link>
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </AuthSplitShell>
  );
}
