import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { z } from "zod";

const stripeSecretKeySchema = z
  .string()
  .regex(
    /^(?:sk|rk)_(?:test|live)_/,
    "Stripe secret keys must start with sk_test_, sk_live_, rk_test_, or rk_live_"
  );

const stripeWebhookSecretSchema = z
  .string()
  .regex(/^whsec_/, "Stripe webhook secrets must start with whsec_");

const stripePriceIdSchema = z
  .string()
  .regex(/^price_/, "Stripe price IDs must start with price_");

const stripeBillingPortalConfigurationSchema = z
  .string()
  .regex(/^bpc_/, "Stripe portal configuration IDs must start with bpc_");

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  BETTER_AUTH_SECRET: z.string().min(1).optional(),
  SHARE_VERIFICATION_SECRET: z.string().min(1).optional(),
  BETTER_AUTH_URL: z.string().min(1).optional(),
  CREDENTIAL_ENCRYPTION_KEY: z.string().min(1).optional(),
  CREDENTIAL_ENCRYPTION_PREVIOUS_KEYS: z.string().min(1).optional(),
  BROKER_WORKER_SECRET: z.string().min(1).optional(),
  CORS_ORIGIN: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1).optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  TWITTER_CLIENT_ID: z.string().min(1).optional(),
  TWITTER_CLIENT_SECRET: z.string().min(1).optional(),
  CTRADER_CLIENT_ID: z.string().min(1).optional(),
  CTRADER_CLIENT_SECRET: z.string().min(1).optional(),
  CTRADER_REDIRECT_URI: z.string().url().optional(),
  TRADOVATE_CLIENT_ID: z.string().min(1).optional(),
  TRADOVATE_CLIENT_SECRET: z.string().min(1).optional(),
  TRADOVATE_REDIRECT_URI: z.string().url().optional(),
  TRADOVATE_OAUTH_URL: z.string().url().optional(),
  TRADOVATE_API_BASE_URL: z.string().url().optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),
  UPLOADTHING_TOKEN: z.string().min(1).optional(),
  WEB_URL: z.string().url().optional(),
  WEB_PUSH_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  WEB_PUSH_VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  WEB_PUSH_SUBJECT: z.string().min(1).optional(),
  BILLING_PROVIDER: z.enum(["stripe"]).optional(),
  STRIPE_SECRET_KEY: stripeSecretKeySchema.optional(),
  STRIPE_WEBHOOK_SECRET: stripeWebhookSecretSchema.optional(),
  STRIPE_PRICE_PROFESSIONAL_MONTHLY_ID: stripePriceIdSchema.optional(),
  STRIPE_PRICE_INSTITUTIONAL_MONTHLY_ID: stripePriceIdSchema.optional(),
  STRIPE_BILLING_PORTAL_CONFIGURATION_ID:
    stripeBillingPortalConfigurationSchema.optional(),
  STRIPE_CONNECT_COUNTRY: z.string().min(2).max(2).optional(),
  GITHUB_FEATURE_REQUEST_TOKEN: z.string().min(1).optional(),
  GITHUB_FEATURE_REQUEST_OWNER: z.string().min(1).optional(),
  GITHUB_FEATURE_REQUEST_REPO: z.string().min(1).optional(),
  AFFILIATE_COMMISSION_BPS: z.coerce.number().int().min(0).max(10000).optional(),
  ALPHA_SUPPORT_EMAIL: z.string().email().optional(),
});

let envLoaded = false;
let cachedEnv: z.infer<typeof serverEnvSchema> | null = null;

function resolveEnvDirectories() {
  const cwd = path.resolve(process.cwd());
  const marker = `${path.sep}apps${path.sep}server`;
  const markerIndex = cwd.indexOf(marker);

  if (markerIndex >= 0) {
    const repoRoot = cwd.slice(0, markerIndex) || path.sep;
    const serverRoot = cwd.slice(0, markerIndex + marker.length);

    return {
      repoRoot,
      serverRoot,
    };
  }

  return {
    repoRoot: cwd,
    serverRoot: path.resolve(cwd, "apps/server"),
  };
}

function candidateEnvPaths(): string[] {
  const { repoRoot, serverRoot } = resolveEnvDirectories();

  return [
    path.resolve(serverRoot, ".env.local"),
    path.resolve(repoRoot, ".env.local"),
    path.resolve(serverRoot, ".env"),
    path.resolve(repoRoot, ".env"),
  ];
}

function ensureServerEnvLoaded() {
  if (envLoaded) return;

  for (const candidate of candidateEnvPaths()) {
    if (fs.existsSync(candidate)) {
      dotenv.config({ path: candidate, override: false });
    }
  }

  envLoaded = true;
}

export function getServerEnv() {
  if (cachedEnv) return cachedEnv;

  ensureServerEnvLoaded();
  cachedEnv = serverEnvSchema.parse(process.env);
  return cachedEnv;
}

export function resetServerEnvForTests() {
  envLoaded = false;
  cachedEnv = null;
}
