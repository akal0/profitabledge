import { betterAuth, type BetterAuthOptions } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-call";
import { db } from "../db";
import * as schema from "../db/schema/auth";
import {
  isPrivateBetaAdminEmail,
  isPrivateBetaRequired,
} from "./billing/config";
import { validatePrivateBetaCodeInput } from "./billing/private-beta";
import { getAllowedWebOrigins } from "./origins";
import { getServerEnv } from "./env";

const serverEnv = getServerEnv();
const socialProviders = {
  ...(serverEnv.GOOGLE_CLIENT_ID && serverEnv.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          accessType: "offline" as const,
          prompt: "select_account+consent" as const,
          clientId: serverEnv.GOOGLE_CLIENT_ID,
          clientSecret: serverEnv.GOOGLE_CLIENT_SECRET,
        },
      }
    : {}),
  ...(serverEnv.TWITTER_CLIENT_ID && serverEnv.TWITTER_CLIENT_SECRET
    ? {
        twitter: {
          clientId: serverEnv.TWITTER_CLIENT_ID,
          clientSecret: serverEnv.TWITTER_CLIENT_SECRET,
        },
      }
    : {}),
};

const authOptions = {
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: schema,
  }),
  trustedOrigins: getAllowedWebOrigins(),
  emailAndPassword: {
    enabled: true,
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email" || !isPrivateBetaRequired()) {
        return;
      }

      const email =
        typeof ctx.body?.email === "string" ? ctx.body.email : undefined;

      if (isPrivateBetaAdminEmail(email)) {
        return;
      }

      const betaCode =
        typeof ctx.body?.betaCode === "string" ? ctx.body.betaCode : "";
      const validation = await validatePrivateBetaCodeInput(betaCode);

      if (!validation.valid) {
        throw new APIError("BAD_REQUEST", {
          message: validation.message,
        });
      }
    }),
  },
  socialProviders,
  secret: serverEnv.BETTER_AUTH_SECRET,
  baseURL:
    serverEnv.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_SERVER_URL ||
    "http://localhost:3000",
} satisfies BetterAuthOptions;

// Type annotation to avoid TS2742 error with project references
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const auth: ReturnType<typeof betterAuth> = betterAuth(authOptions) as any;
