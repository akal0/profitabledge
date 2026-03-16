import type { NextRequest } from "next/server";
import { normalizeOriginUrl } from "@profitabledge/platform";

const SERVER_URL =
  normalizeOriginUrl(process.env.NEXT_PUBLIC_SERVER_URL) ||
  "http://localhost:3000";

function buildTargetUrl(request: NextRequest, path: string) {
  const url = new URL(request.url);
  return `${SERVER_URL}${path}${url.search}`;
}

function buildForwardHeaders(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("content-length");
  return headers;
}

async function buildRequestBody(request: NextRequest) {
  if (request.method === "GET" || request.method === "HEAD") {
    return undefined;
  }

  const body = await request.arrayBuffer();
  return body.byteLength > 0 ? body : undefined;
}

function buildResponseHeaders(
  response: Response,
  preserveSetCookie: boolean
) {
  const headers = new Headers();

  response.headers.forEach((value, key) => {
    const normalizedKey = key.toLowerCase();

    // `fetch` may transparently decode upstream responses, so forwarding the
    // original compression and transfer headers can make the browser try to
    // decode an already-decoded body.
    if (
      normalizedKey === "set-cookie" ||
      normalizedKey === "content-encoding" ||
      normalizedKey === "content-length" ||
      normalizedKey === "transfer-encoding"
    ) {
      return;
    }
    headers.append(key, value);
  });

  if (!preserveSetCookie) {
    return headers;
  }

  // Prefer getSetCookie() which correctly returns individual Set-Cookie
  // values. Falls back to raw() (undici) then get() as last resort.
  const rawHeaders = response.headers as Headers & {
    getSetCookie?: () => string[];
    raw?: () => Record<string, string[]>;
  };

  if (typeof rawHeaders.getSetCookie === "function") {
    for (const cookie of rawHeaders.getSetCookie()) {
      headers.append("set-cookie", cookie);
    }
    return headers;
  }

  // undici exposes raw() which preserves individual header values
  if (typeof rawHeaders.raw === "function") {
    const raw = rawHeaders.raw();
    if (raw["set-cookie"]) {
      for (const cookie of raw["set-cookie"]) {
        headers.append("set-cookie", cookie);
      }
      return headers;
    }
  }

  // Last resort: headers.get() merges multiple Set-Cookie values with ", "
  // which can corrupt cookies containing commas (e.g. Expires dates).
  // Still better than dropping them entirely.
  const fallbackCookie = response.headers.get("set-cookie");
  if (fallbackCookie) {
    headers.append("set-cookie", fallbackCookie);
  }

  return headers;
}

export async function proxyToServer(
  request: NextRequest,
  path: string,
  { preserveSetCookie = false }: { preserveSetCookie?: boolean } = {}
) {
  const response = await fetch(buildTargetUrl(request, path), {
    method: request.method,
    headers: buildForwardHeaders(request),
    body: await buildRequestBody(request),
    redirect: "manual",
    cache: "no-store",
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: buildResponseHeaders(response, preserveSetCookie),
  });
}
