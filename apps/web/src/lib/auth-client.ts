import { createAuthClient } from "better-auth/react";

function inferAuthBases(): string[] {
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    const env = process.env.NEXT_PUBLIC_SERVER_URL || "";
    const localhost = `${protocol}//localhost:3000`;
    const isLanIp = /^\d+\.\d+\.\d+\.\d+$/.test(hostname);
    const lan = isLanIp ? `${protocol}//${hostname}:3000` : "";
    const ordered = isLanIp ? [lan, localhost, env] : [localhost, lan, env];
    return Array.from(new Set(ordered.filter(Boolean)));
  }
  return [process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000"];
}

const bases = inferAuthBases();

function buildTarget(
  input: RequestInfo | URL,
  base: string,
  primary: string
): string | URL {
  if (typeof input === "string") {
    if (/^https?:\/\//i.test(input)) {
      if (primary && input.startsWith(primary))
        return input.replace(primary, base);
      return input;
    }
    return `${base}${input.startsWith("/") ? "" : "/"}${input}`;
  }
  return input;
}

export const authClient = createAuthClient({
  baseURL: bases[0],
  async fetch(input, init) {
    for (let i = 0; i < bases.length; i++) {
      const target = buildTarget(input, bases[i], bases[0]);
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
