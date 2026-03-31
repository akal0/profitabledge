import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/routers";
import { createContext } from "@/lib/context";
import { NextRequest } from "next/server";
import { startSyncScheduler } from "@/lib/providers/sync-scheduler";
import { buildCorsHeaders } from "@/lib/origins";

// Start sync scheduler once (module-level singleton)
let _schedulerStarted = false;
if (!_schedulerStarted && process.env.NODE_ENV !== "test") {
  _schedulerStarted = true;
  startSyncScheduler();
}

async function handler(req: NextRequest) {
  const response = await fetchRequestHandler({
    endpoint: "/trpc",
    req,
    router: appRouter,
    createContext: () => createContext(req),
    onError: ({ error, path }) => {
      console.error(`❌ tRPC Error on '${path}':`, error);
      if (error.cause) {
        console.error("Cause:", error.cause);
      }
    },
  });

  const headers = new Headers(response.headers);
  const corsHeaders = buildCorsHeaders(req.headers.get("origin"));
  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(headers),
  });
}

export function OPTIONS(req: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: new Headers(buildCorsHeaders(req.headers.get("origin"))),
  });
}

export { handler as GET, handler as POST };
