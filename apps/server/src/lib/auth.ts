import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
  adminAc,
  defaultAc as defaultAdminAc,
  userAc,
} from "better-auth/plugins/admin/access";
import {
  admin,
  lastLoginMethod,
  oneTimeToken,
  organization,
  twoFactor,
  username,
} from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { db } from "../db";
import * as schema from "../db/schema/auth";
import { getAllowedWebOrigins } from "./origins";
import {
  getAuthCookieSettings,
  resolveAuthBaseUrl,
} from "./auth-cookie-settings";
import {
  isValidNormalizedAuthUsername,
  normalizeAuthUsername,
} from "./auth-usernames";

type XUserLookupResponse = {
  data?: {
    id?: string;
    name?: string;
    username?: string;
    profile_image_url?: string;
    confirmed_email?: string;
  };
};

async function readJsonSafely<T>(response: Response) {
  const text = await response.text();

  if (!text) {
    return { data: null as T | null, text };
  }

  try {
    return { data: JSON.parse(text) as T, text };
  } catch {
    return { data: null as T | null, text };
  }
}

async function getXUserInfo(accessToken: string | undefined) {
  if (!accessToken) {
    console.error("[auth/twitter] Missing X access token during user lookup");
    return null;
  }

  const profileResponse = await fetch(
    "https://api.x.com/2/users/me?user.fields=profile_image_url",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    }
  );
  const { data: profileData, text: profileText } =
    await readJsonSafely<XUserLookupResponse>(profileResponse);

  if (!profileResponse.ok || !profileData?.data?.id) {
    console.error("[auth/twitter] Failed to fetch X profile", {
      status: profileResponse.status,
      statusText: profileResponse.statusText,
      body: profileText,
    });
    return null;
  }

  let confirmedEmail: string | null = null;

  const emailResponse = await fetch(
    "https://api.x.com/2/users/me?user.fields=confirmed_email",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    }
  );
  const { data: emailData, text: emailText } =
    await readJsonSafely<XUserLookupResponse>(emailResponse);

  if (emailResponse.ok) {
    confirmedEmail = emailData?.data?.confirmed_email ?? null;
  } else {
    console.warn("[auth/twitter] Failed to fetch X confirmed email", {
      status: emailResponse.status,
      statusText: emailResponse.statusText,
      body: emailText,
    });
  }

  const profile = profileData.data;

  return {
    user: {
      id: profile.id ?? "",
      name: profile.name ?? profile.username ?? "X User",
      email: confirmedEmail || profile.username || null,
      image: profile.profile_image_url ?? undefined,
      emailVerified: Boolean(confirmedEmail),
    },
    data: profileData,
  };
}

const trustedOrigins = getAllowedWebOrigins();
const baseUrlFallback = resolveAuthBaseUrl();
const moderatorAc = defaultAdminAc.newRole({
  user: ["list", "ban", "get", "update"],
  session: ["list", "revoke"],
});

function getDynamicAuthBaseHosts(origins: string[]) {
  const hosts = new Set<string>();

  for (const origin of origins) {
    try {
      const url = new URL(origin);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        continue;
      }
      hosts.add(url.host);
    } catch {
      // Ignore malformed origins and non-URL desktop schemes.
    }
  }

  return [...hosts];
}

const baseURL = {
  allowedHosts: getDynamicAuthBaseHosts(trustedOrigins),
  fallback: baseUrlFallback,
  protocol: process.env.NODE_ENV === "development" ? "http" : "https",
} satisfies BetterAuthOptions["baseURL"];

const authOptions = {
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: schema,
  }),
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
  },
  account: {
    encryptOAuthTokens: true,
  },
  plugins: [
    username({
      minUsernameLength: 2,
      maxUsernameLength: 30,
      usernameNormalization: normalizeAuthUsername,
      usernameValidator: isValidNormalizedAuthUsername,
      validationOrder: {
        username: "post-normalization",
      },
    }),
    twoFactor({
      issuer: "profitabledge",
    }),
    oneTimeToken(),
    passkey(),
    lastLoginMethod({
      storeInDatabase: true,
    }),
    admin({
      adminRoles: ["admin"],
      roles: {
        admin: adminAc,
        moderator: moderatorAc,
        user: userAc,
      },
    }),
    organization(),
  ],
  socialProviders: {
    google: {
      accessType: "offline",
      prompt: "select_account consent",
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
    twitter: {
      clientId: process.env.TWITTER_CLIENT_ID as string,
      clientSecret: process.env.TWITTER_CLIENT_SECRET as string,
      getUserInfo(token) {
        return getXUserInfo(token.accessToken);
      },
    },
  },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL,
  advanced: getAuthCookieSettings({
    baseUrl: baseUrlFallback,
    allowedWebOrigins: trustedOrigins,
  }),
} satisfies BetterAuthOptions;

// Type annotation to avoid TS2742 error with project references
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const auth: ReturnType<typeof betterAuth> = betterAuth(authOptions) as any;
