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
  if (typeof window !== "undefined") {
    return [window.location.origin];
  }

  const candidates = getOriginCandidates({
    envUrl: process.env.NEXT_PUBLIC_SERVER_URL,
    fallbackPort: 3000,
  });

  if (candidates.length === 0) {
    throw new Error(
      "NEXT_PUBLIC_SERVER_URL must be set to your server origin for non-local web sessions"
    );
  }

  return candidates;
}

const DEFAULT_QUERY_STALE_TIME = 10_000;
const DEFAULT_QUERY_GC_TIME = 30 * 60_000;
const NOTIFICATIONS_LIST_QUERY_KEY_PREFIX = [["notifications", "list"]];

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: DEFAULT_QUERY_STALE_TIME,
      gcTime: DEFAULT_QUERY_GC_TIME,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
  queryCache: new QueryCache({
    onError: (error) => {
      if (showAIErrorToast(error)) {
        return;
      }

      const isAuthError =
        error.message === "Please login to access the platform." ||
        error.message === "Authentication required" ||
        error.message === "UNAUTHORIZED";

      toast.error(error.message, {
        ...(isAuthError ? { id: "auth-required" } : {}),
      });
    },
  }),
  mutationCache: new MutationCache({
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: NOTIFICATIONS_LIST_QUERY_KEY_PREFIX,
        refetchType: "active",
      });
    },
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

// Stable identity/config queries should stay hot across route transitions.
queryClient.setQueryDefaults(trpcOptions.users.me.queryOptions().queryKey, {
  staleTime: 5 * 60_000,
  gcTime: 60 * 60_000,
});
queryClient.setQueryDefaults(
  trpcOptions.billing.getState.queryOptions().queryKey,
  {
    staleTime: 60_000,
    gcTime: 15 * 60_000,
  }
);
queryClient.setQueryDefaults(
  trpcOptions.billing.getPublicConfig.queryOptions().queryKey,
  {
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  }
);
queryClient.setQueryDefaults(
  trpcOptions.accounts.list.queryOptions().queryKey,
  {
    staleTime: 30_000,
    gcTime: 15 * 60_000,
  }
);
queryClient.setQueryDefaults(
  trpcOptions.connections.list.queryOptions().queryKey,
  {
    staleTime: 15_000,
    gcTime: 10 * 60_000,
  }
);
queryClient.setQueryDefaults(
  trpcOptions.notifications.getPreferences.queryOptions().queryKey,
  {
    staleTime: 60_000,
    gcTime: 15 * 60_000,
  }
);
queryClient.setQueryDefaults(trpcOptions.views.list.queryOptions().queryKey, {
  staleTime: 60_000,
  gcTime: 15 * 60_000,
});
queryClient.setQueryDefaults(
  trpcOptions.views.getDefault.queryOptions().queryKey,
  {
    staleTime: 60_000,
    gcTime: 15 * 60_000,
  }
);
queryClient.setQueryDefaults(
  trpcOptions.operations.getSupportSnapshot.queryOptions().queryKey,
  {
    staleTime: 30_000,
    gcTime: 10 * 60_000,
  }
);
queryClient.setQueryDefaults(trpcOptions.aiKeys.list.queryOptions().queryKey, {
  staleTime: 60_000,
  gcTime: 15 * 60_000,
});
queryClient.setQueryDefaults(
  trpcOptions.aiKeys.usage.queryOptions({ days: 30 }).queryKey,
  {
    staleTime: 60_000,
    gcTime: 15 * 60_000,
  }
);

// Export for React components - use trpc.useQuery(), trpc.useMutation(), etc.
export const useTRPC = () => trpc;
