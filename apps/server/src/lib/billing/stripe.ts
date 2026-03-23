import Stripe from "stripe";
import { TRPCError } from "@trpc/server";

import { getServerEnv } from "../env";
import {
  getBillingPlanDefinition,
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

export function getStripePriceIdForPlan(planKey: BillingPlanKey) {
  const plan = getBillingPlanDefinition(planKey);
  if (!plan?.stripePriceId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `Plan ${planKey} is not configured in Stripe`,
    });
  }

  return plan.stripePriceId;
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
  successUrl: string;
  cancelUrl: string;
  couponId?: string | null;
  metadata?: Record<string, string>;
}) {
  const stripe = getStripeClient();
  return stripe.checkout.sessions.create({
    mode: "subscription",
    customer: input.customerId ?? undefined,
    customer_email: input.customerId ? undefined : input.customerEmail ?? undefined,
    client_reference_id: input.clientReferenceId,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    line_items: [
      {
        price: getStripePriceIdForPlan(input.planKey),
        quantity: 1,
      },
    ],
    metadata: input.metadata,
    subscription_data: {
      metadata: input.metadata,
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
}) {
  const stripe = getStripeClient();
  const configuration = getStripeBillingPortalConfigurationId();
  return stripe.billingPortal.sessions.create({
    customer: input.customerId,
    return_url: input.returnUrl,
    configuration: configuration ?? undefined,
  });
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
