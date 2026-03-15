import { NextRequest } from "next/server";
import { assertWorkerSecret } from "@/lib/mt5/worker-control";
import { getAlphaFeatureDisabledMessage } from "@profitabledge/platform";
import { getServerAlphaFlags } from "@/lib/ops/alpha-runtime";

export function assertWorkerRequest(request: NextRequest) {
  if (!getServerAlphaFlags().mt5Ingestion) {
    throw new Error(getAlphaFeatureDisabledMessage("mt5Ingestion"));
  }

  const secret =
    request.headers.get("x-worker-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    null;

  assertWorkerSecret(secret);
}
