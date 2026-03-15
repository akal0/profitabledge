import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import type { AppRouter } from "@profitabledge/contracts/trpc";
import {
  fetchFirstAvailable,
  getOriginCandidates,
  rewriteRequestToBase,
} from "@profitabledge/platform";
import { toast } from "sonner";
import { showAIErrorToast } from "@/lib/ai-error-toast";

function getCandidateBases(): string[] {
  const candidates = getOriginCandidates({
    envUrl: process.env.NEXT_PUBLIC_SERVER_URL,
    fallbackPort: 3000,
    location: typeof window !== "undefined" ? window.location : undefined,
  });

  if (candidates.length === 0) {
    throw new Error(
      "NEXT_PUBLIC_SERVER_URL must be set to your server origin for non-local web sessions"
    );
  }

  return candidates;
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (showAIErrorToast(error)) {
        return;
      }

      toast.error(error.message, {
        action: {
          label: "retry",
          onClick: () => {
            queryClient.invalidateQueries();
          },
        },
      });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      showAIErrorToast(error);
    },
  }),
});

const candidates = getCandidateBases();
const primaryBase = `${candidates[0]}/trpc`;

function toUrlString(url: RequestInfo | URL): string {
  if (typeof url === "string") return url;
  if (url instanceof URL) return url.toString();
  if (url instanceof Request) return url.url;
  return String(url);
}

function getTrpcTargets(url: RequestInfo | URL): string[] {
  return candidates.map((base) =>
    toUrlString(rewriteRequestToBase(url, `${base}/trpc`, primaryBase))
  );
}

// Vanilla tRPC client for non-React contexts (server-side, effects, etc.)
export const trpcClient = createTRPCClient<AppRouter>({
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

// Create tRPC React hooks
export const trpc = createTRPCReact<AppRouter>();

// Create the tRPC client for the Provider
export const trpcReactClient = trpc.createClient({
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

// Create the tRPC options proxy for tanstack react-query helpers
export const trpcOptions = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
});

// Export for React components - use trpc.useQuery(), trpc.useMutation(), etc.
export const useTRPC = () => trpc;
