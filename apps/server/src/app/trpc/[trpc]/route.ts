import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/routers";
import { createContext } from "@/lib/context";
import { NextRequest } from "next/server";

function handler(req: NextRequest) {
  return fetchRequestHandler({
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
}
export { handler as GET, handler as POST };
