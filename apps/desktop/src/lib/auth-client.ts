import { createAuthClient } from "better-auth/react";
import { env } from "./env";

type AuthFetchInput = RequestInfo | URL;

export const authClient = createAuthClient({
  baseURL: env.serverUrl,
  async fetch(input: AuthFetchInput, init?: RequestInit) {
    return fetch(input, {
      ...(init || {}),
      credentials: "include",
    });
  },
});
