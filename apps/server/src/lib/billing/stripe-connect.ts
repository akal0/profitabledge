import { TRPCError } from "@trpc/server";

import { getServerEnv } from "../env";

const STRIPE_API_BASE = "https://api.stripe.com/v1";

type StripeAccountResponse = {
  id: string;
  email?: string | null;
  country?: string | null;
  default_currency?: string | null;
  details_submitted?: boolean;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  metadata?: Record<string, string>;
  requirements?: {
    currently_due?: string[];
    eventually_due?: string[];
    pending_verification?: string[];
  } | null;
};

type StripeTransferResponse = {
  id: string;
  amount: number;
  currency: string;
  destination?: string | null;
};

function getStripeSecretKey() {
  const env = getServerEnv();
  if (!env.STRIPE_SECRET_KEY) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Stripe Connect is not configured",
    });
  }

  if (env.STRIPE_SECRET_KEY.startsWith("rk_")) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Stripe Connect requires a standard Stripe secret key (sk_test_ or sk_live_), not a restricted key",
    });
  }

  return env.STRIPE_SECRET_KEY;
}

function appendFormValue(
  params: URLSearchParams,
  key: string,
  value: unknown
): void {
  if (value === null || value === undefined || value === "") {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      appendFormValue(params, `${key}[]`, item);
    }
    return;
  }

  if (typeof value === "object") {
    for (const [nestedKey, nestedValue] of Object.entries(
      value as Record<string, unknown>
    )) {
      appendFormValue(params, `${key}[${nestedKey}]`, nestedValue);
    }
    return;
  }

  params.append(key, String(value));
}

async function stripeRequest<T>(input: {
  path: string;
  method?: "GET" | "POST" | "DELETE";
  body?: Record<string, unknown>;
}) {
  const secretKey = getStripeSecretKey();
  const method = input.method ?? "POST";
  const url = new URL(`${STRIPE_API_BASE}${input.path}`);
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${secretKey}`);

  let body: string | undefined;
  if (input.body && method !== "GET") {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(input.body)) {
      appendFormValue(params, key, value);
    }
    body = params.toString();
    headers.set("Content-Type", "application/x-www-form-urlencoded");
  }

  const response = await fetch(url.toString(), {
    method,
    headers,
    body,
  });

  if (!response.ok) {
    let message = "Stripe request failed";
    try {
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      message = payload.error?.message ?? message;
    } catch {
      // Ignore parse failures and keep the generic error.
    }

    throw new TRPCError({
      code: "BAD_REQUEST",
      message,
    });
  }

  return (await response.json()) as T;
}

export function getStripeConnectCountry() {
  return getServerEnv().STRIPE_CONNECT_COUNTRY ?? "US";
}

export function resolveStripeOnboardingStatus(account: StripeAccountResponse) {
  if (account.payouts_enabled) {
    return "enabled";
  }

  if (account.details_submitted) {
    return "pending_review";
  }

  return "pending";
}

export async function createStripeConnectedAccount(input: {
  affiliateUserId: string;
  email?: string | null;
  country?: string | null;
}) {
  return stripeRequest<StripeAccountResponse>({
    path: "/accounts",
    body: {
      type: "express",
      country: input.country ?? getStripeConnectCountry(),
      email: input.email ?? undefined,
      capabilities: {
        transfers: {
          requested: true,
        },
      },
      metadata: {
        affiliate_user_id: input.affiliateUserId,
      },
    },
  });
}

export async function retrieveStripeConnectedAccount(accountId: string) {
  return stripeRequest<StripeAccountResponse>({
    path: `/accounts/${accountId}`,
    method: "GET",
  });
}

export async function createStripeOnboardingLink(input: {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
}) {
  return stripeRequest<{ url: string }>({
    path: "/account_links",
    body: {
      account: input.accountId,
      refresh_url: input.refreshUrl,
      return_url: input.returnUrl,
      type: "account_onboarding",
    },
  });
}

export async function createStripeLoginLink(accountId: string) {
  return stripeRequest<{ url: string }>({
    path: `/accounts/${accountId}/login_links`,
    body: {},
  });
}

export async function deleteStripeConnectedAccount(accountId: string) {
  return stripeRequest<{ deleted: boolean; id: string }>({
    path: `/accounts/${accountId}`,
    method: "DELETE",
  });
}

export async function createStripeTransfer(input: {
  accountId: string;
  amount: number;
  currency: string;
  description?: string | null;
  metadata?: Record<string, string>;
}) {
  return stripeRequest<StripeTransferResponse>({
    path: "/transfers",
    body: {
      amount: input.amount,
      currency: input.currency.toLowerCase(),
      destination: input.accountId,
      description: input.description ?? undefined,
      metadata: input.metadata ?? undefined,
    },
  });
}
