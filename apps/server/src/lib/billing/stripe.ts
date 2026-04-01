import Stripe from "stripe";
import { TRPCError } from "@trpc/server";

import { getServerEnv } from "../env";
import {
  DEFAULT_BILLING_INTERVAL,
  getBillingPlanDefinition,
  type BillingInterval,
  type BillingPlanKey,
} from "./config";

let cachedStripe: Stripe | null = null;

export function getStripeSecretKey() {
  const env = getServerEnv();
  if (!env.STRIPE_SECRET_KEY) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Stripe is not configured",
    });
  }

  if (env.STRIPE_SECRET_KEY.startsWith("rk_")) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "This app requires a standard Stripe secret key (sk_test_ or sk_live_), not a restricted key, for billing and Connect flows",
    });
  }

  return env.STRIPE_SECRET_KEY;
}

export function getStripeClient() {
  if (cachedStripe) {
    return cachedStripe;
  }

  cachedStripe = new Stripe(getStripeSecretKey());
  return cachedStripe;
}

export function getStripeWebhookSecret() {
  const env = getServerEnv();
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }

  return env.STRIPE_WEBHOOK_SECRET;
}

export function getStripeConnectCountry() {
  return getServerEnv().STRIPE_CONNECT_COUNTRY ?? "US";
}

export function getStripeBillingPortalConfigurationId() {
  return getServerEnv().STRIPE_BILLING_PORTAL_CONFIGURATION_ID ?? null;
}

export function clampStripeDisplayString(value: string, maxLength = 40) {
  const normalized = value.trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return normalized.slice(0, maxLength).trimEnd();
}

export function getStripePriceIdForPlan(
  planKey: BillingPlanKey,
  billingInterval: BillingInterval = DEFAULT_BILLING_INTERVAL
) {
  const plan = getBillingPlanDefinition(planKey);
  const priceId =
    billingInterval === "annual"
      ? plan?.stripeAnnualPriceId
      : plan?.stripePriceId;

  if (!priceId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `Plan ${planKey} is not configured in Stripe for ${billingInterval} billing`,
    });
  }

  return priceId;
}

export async function createStripeCustomer(input: {
  userId: string;
  email?: string | null;
  name?: string | null;
}) {
  const stripe = getStripeClient();
  return stripe.customers.create({
    email: input.email ?? undefined,
    name: input.name ?? undefined,
    metadata: {
      user_id: input.userId,
    },
  });
}

export async function retrieveStripeCustomer(customerId: string) {
  const stripe = getStripeClient();
  return stripe.customers.retrieve(customerId);
}

export async function createStripeCheckoutSession(input: {
  customerId?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  clientReferenceId: string;
  planKey: BillingPlanKey;
  billingInterval?: BillingInterval;
  successUrl: string;
  cancelUrl: string;
  couponId?: string | null;
  trialPeriodDays?: number | null;
  metadata?: Record<string, string>;
}) {
  const stripe = getStripeClient();
  const billingInterval = input.billingInterval ?? DEFAULT_BILLING_INTERVAL;
  return stripe.checkout.sessions.create({
    mode: "subscription",
    customer: input.customerId ?? undefined,
    customer_email: input.customerId ? undefined : input.customerEmail ?? undefined,
    client_reference_id: input.clientReferenceId,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    line_items: [
      {
        price: getStripePriceIdForPlan(input.planKey, billingInterval),
        quantity: 1,
      },
    ],
    metadata: input.metadata,
    subscription_data: {
      metadata: input.metadata,
      trial_period_days:
        input.trialPeriodDays && input.trialPeriodDays > 0
          ? input.trialPeriodDays
          : undefined,
    },
    discounts: input.couponId
      ? [
          {
            coupon: input.couponId,
          },
        ]
      : undefined,
    customer_update: input.customerId
      ? {
          address: "auto",
          name: "auto",
        }
      : undefined,
  });
}

export async function createStripeBillingPortalSession(input: {
  customerId: string;
  returnUrl: string;
  flow?: "manage" | "cancel" | "update_confirm";
  subscriptionId?: string | null;
  subscriptionItemId?: string | null;
  subscriptionItemQuantity?: number | null;
  priceId?: string | null;
}) {
  const stripe = getStripeClient();
  const configuration = getStripeBillingPortalConfigurationId();
  const afterCompletion = {
    type: "redirect" as const,
    redirect: {
      return_url: input.returnUrl,
    },
  };
  const flowData =
    input.flow === "cancel" && input.subscriptionId
      ? {
          type: "subscription_cancel" as const,
          after_completion: afterCompletion,
          subscription_cancel: {
            subscription: input.subscriptionId,
          },
        }
      : input.flow === "update_confirm" &&
          input.subscriptionId &&
          input.subscriptionItemId &&
          input.priceId
        ? {
            type: "subscription_update_confirm" as const,
            after_completion: afterCompletion,
            subscription_update_confirm: {
              subscription: input.subscriptionId,
              items: [
                {
                  id: input.subscriptionItemId,
                  price: input.priceId,
                  quantity: input.subscriptionItemQuantity ?? 1,
                },
              ],
            },
          }
        : undefined;

  const createSession = (configurationId?: string | null) =>
    stripe.billingPortal.sessions.create({
      customer: input.customerId,
      return_url: input.returnUrl,
      configuration: configurationId ?? undefined,
      flow_data: flowData,
    });

  try {
    return await createSession(configuration);
  } catch (error) {
    if (configuration && isStripeMissingBillingPortalConfigurationError(error)) {
      return createSession(null);
    }

    throw error;
  }
}

function isStripeMissingBillingPortalConfigurationError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as {
    code?: unknown;
    param?: unknown;
    message?: unknown;
  };

  if (
    candidate.code === "resource_missing" &&
    candidate.param === "configuration"
  ) {
    return true;
  }

  return (
    typeof candidate.message === "string" &&
    candidate.message.toLowerCase().includes("no such configuration")
  );
}

export function isStripeMissingCustomerError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as {
    code?: unknown;
    param?: unknown;
    message?: unknown;
  };

  if (candidate.code === "resource_missing" && candidate.param === "customer") {
    return true;
  }

  return (
    typeof candidate.message === "string" &&
    candidate.message.toLowerCase().includes("no such customer")
  );
}

export function resetStripeClientForTests() {
  cachedStripe = null;
}
