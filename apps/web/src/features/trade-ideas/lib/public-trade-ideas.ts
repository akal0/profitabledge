import "server-only";

import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@profitabledge/contracts/trpc";
import {
  fetchFirstAvailable,
  getOriginCandidates,
  rewriteRequestToBase,
} from "@profitabledge/platform";

function getCandidateBases() {
  const candidates = getOriginCandidates({
    envUrl: process.env.NEXT_PUBLIC_SERVER_URL,
    fallbackPort: 3000,
  });

  if (candidates.length === 0) {
    throw new Error("NEXT_PUBLIC_SERVER_URL must be configured for public trade ideas.");
  }

  return candidates;
}

const candidates = getCandidateBases();
const primaryBase = `${candidates[0]}/trpc`;

function toUrlString(url: RequestInfo | URL) {
  if (typeof url === "string") return url;
  if (url instanceof URL) return url.toString();
  if (url instanceof Request) return url.url;
  return String(url);
}

function getTrpcTargets(url: RequestInfo | URL) {
  return candidates.map((base) =>
    toUrlString(rewriteRequestToBase(url, `${base}/trpc`, primaryBase))
  );
}

function createServerTrpcClient() {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: primaryBase,
        async fetch(url, options) {
          return fetchFirstAvailable(getTrpcTargets(url), {
            ...(options || {}),
            credentials: "include",
          });
        },
      }),
    ],
  });
}

export async function fetchPublicTradeIdea(token: string) {
  const client = createServerTrpcClient();
  return client.tradeIdeas.getByToken.query({ token });
}
