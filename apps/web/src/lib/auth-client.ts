import { createAuthClient } from "better-auth/react";
import { getOriginCandidates, rewriteRequestToBase } from "@profitabledge/platform";

function inferAuthBases(): string[] {
  if (typeof window !== "undefined") {
    return [window.location.origin];
  }

  const bases = getOriginCandidates({
    envUrl: process.env.NEXT_PUBLIC_SERVER_URL,
    fallbackPort: 3000,
  });

  if (bases.length === 0) {
    throw new Error(
      "NEXT_PUBLIC_SERVER_URL must be set to your server origin for non-local auth flows"
    );
  }

  return bases;
}

const bases = inferAuthBases();

export const authClient = createAuthClient({
  baseURL: bases[0],
  async fetch(input: RequestInfo | URL, init?: RequestInit) {
    for (let i = 0; i < bases.length; i++) {
      const target = rewriteRequestToBase(input, bases[i], bases[0]);
      try {
        const res = await fetch(target as any, {
          ...(init || {}),
          credentials: "include",
        });
        return res;
      } catch (e) {
        if (i === bases.length - 1) throw e;
      }
    }
    return fetch(input as any, init);
  },
});
