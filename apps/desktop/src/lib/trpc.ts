import { QueryClient } from "@tanstack/react-query";
import {
  createTRPCProxyClient,
  httpBatchLink,
  loggerLink,
} from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@profitabledge/contracts/trpc";
import { env } from "./env";

const links = [
  loggerLink({
    enabled: (options) =>
      import.meta.env.DEV || (options.direction === "down" && options.result instanceof Error),
  }),
  httpBatchLink({
    url: `${env.serverUrl}/trpc`,
    fetch(url, options) {
      return fetch(url, {
        ...(options || {}),
        credentials: "include",
        headers: {
          ...(options?.headers || {}),
          "x-client-version": "profitabledge-desktop-v1",
        },
      });
    },
  }),
];

export const trpc = createTRPCReact<AppRouter>();

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 20_000,
    },
  },
});

export const trpcReactClient = trpc.createClient({
  links,
});

export const trpcProxyClient = createTRPCProxyClient<AppRouter>({
  links,
});

