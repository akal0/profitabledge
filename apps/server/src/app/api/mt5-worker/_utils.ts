import { NextRequest } from "next/server";
import { assertWorkerSecret } from "@/lib/mt5/worker-control";

export function assertWorkerRequest(request: NextRequest) {
  const secret =
    request.headers.get("x-worker-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    null;

  assertWorkerSecret(secret);
}
