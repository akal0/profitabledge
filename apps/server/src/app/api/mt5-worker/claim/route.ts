import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { claimMtConnections } from "@/lib/mt5/worker-control";
import { assertWorkerRequest } from "../_utils";

const requestSchema = z.object({
  workerHostId: z.string().min(1),
  limit: z.number().int().min(1).max(100).default(10),
});

export async function POST(request: NextRequest) {
  try {
    assertWorkerRequest(request);
    const body = requestSchema.parse(await request.json());
    const connections = await claimMtConnections(body);

    return NextResponse.json({
      success: true,
      connections,
    });
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
