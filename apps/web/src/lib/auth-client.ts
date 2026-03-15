import { createAuthClient } from "better-auth/react";
import {
  fetchFirstAvailable,
  getOriginCandidates,
  rewriteRequestToBase,
} from "@profitabledge/platform";

function inferAuthBases(): string[] {
  return getOriginCandidates({
    envUrl: process.env.NEXT_PUBLIC_SERVER_URL,
    fallbackPort: 3000,
    location: typeof window !== "undefined" ? window.location : undefined,
  });
}

const bases = inferAuthBases();

function buildTarget(
  input: RequestInfo | URL,
  base: string,
  primary: string
): RequestInfo | URL {
  return rewriteRequestToBase(input, base, primary);
}

export const authClient = createAuthClient({
  baseURL: bases[0],
  async fetch(input: RequestInfo | URL, init?: RequestInit) {
    const targets = bases.map((base) => buildTarget(input, base, bases[0]));
    return fetchFirstAvailable(targets, {
      ...(init || {}),
      credentials: "include",
    });
  },
});
