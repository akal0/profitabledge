import { QueryCache, QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import type { AppRouter } from "../../../server/src/routers";
import { toast } from "sonner";

function getCandidateBases(): string[] {
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    const env = process.env.NEXT_PUBLIC_SERVER_URL || "";
    const localhost = `${protocol}//localhost:3000`;
    const isLanIp = /^\d+\.\d+\.\d+\.\d+$/.test(hostname);
    const lan = isLanIp ? `${protocol}//${hostname}:3000` : "";
    // Prefer explicit env first if provided, then LAN/localhost fallbacks
    const ordered = isLanIp ? [env, lan, localhost] : [env, localhost, lan];
    return Array.from(new Set(ordered.filter(Boolean)));
  }
  return [process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000"];
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
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
});

const candidates = getCandidateBases();
const primaryBase = `${candidates[0]}/trpc`;

// Vanilla tRPC client for non-React contexts (server-side, effects, etc.)
export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: primaryBase,
      async fetch(url, options) {
        const bases = candidates.map((b) => `${b}/trpc`);
        for (let i = 0; i < bases.length; i++) {
          const target = url.toString().replace(primaryBase, bases[i]);
          try {
            const res = await fetch(target, {
              ...(options || {}),
              credentials: "include",
            });
            return res;
          } catch (_) {
            // try next base
          }
        }
        return fetch(url, { ...(options || {}), credentials: "include" });
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
        const bases = candidates.map((b) => `${b}/trpc`);
        for (let i = 0; i < bases.length; i++) {
          const target = url.toString().replace(primaryBase, bases[i]);
          try {
            const res = await fetch(target, {
              ...(options || {}),
              credentials: "include",
            });
            return res;
          } catch (_) {
            // try next base
          }
        }
        return fetch(url, { ...(options || {}), credentials: "include" });
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
