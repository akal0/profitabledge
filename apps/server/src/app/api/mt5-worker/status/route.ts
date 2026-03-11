import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { reportMtConnectionStatus } from "@/lib/mt5/worker-control";
import { assertWorkerRequest } from "../_utils";

const requestSchema = z.object({
  connectionId: z.string().min(1),
  workerHostId: z.string().min(1),
  status: z.string().min(1),
  sessionKey: z.string().min(1).optional(),
  lastError: z.string().nullable().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    assertWorkerRequest(request);
    const body = requestSchema.parse(await request.json());
    const result = await reportMtConnectionStatus(body);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 400 }
    );
  }
}
