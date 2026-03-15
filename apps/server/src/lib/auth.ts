import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db";
import * as schema from "../db/schema/auth";
import { getAllowedWebOrigins } from "./origins";
import {
  getAuthCookieSettings,
  resolveAuthBaseUrl,
} from "./auth-cookie-settings";

const trustedOrigins = getAllowedWebOrigins();
const baseURL = resolveAuthBaseUrl();

const authOptions = {
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: schema,
  }),
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      accessType: "offline",
      prompt: "select_account+consent",
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
    twitter: {
      clientId: process.env.TWITTER_CLIENT_ID as string,
      clientSecret: process.env.TWITTER_CLIENT_SECRET as string,
    },
  },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL,
  advanced: getAuthCookieSettings({
    baseUrl: baseURL,
    allowedWebOrigins: trustedOrigins,
  }),
} satisfies BetterAuthOptions;

// Type annotation to avoid TS2742 error with project references
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const auth: ReturnType<typeof betterAuth> = betterAuth(authOptions) as any;
