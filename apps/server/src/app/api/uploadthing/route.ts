import { createRouteHandler } from "uploadthing/next";

import { ourFileRouter } from "@profitabledge/contracts/uploadthing";
import { getServerEnv } from "@/lib/env";

const serverEnv = getServerEnv();

// Export routes for Next App Router
export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
  config: {
    token: serverEnv.UPLOADTHING_TOKEN,
  },
});

export const runtime = "nodejs";
