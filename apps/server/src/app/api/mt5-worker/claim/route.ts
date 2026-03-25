import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { mt5ClaimHostSchema } from "@/lib/mt5/hosting-policy";
import { claimMtConnections } from "@/lib/mt5/worker-control";
import { assertWorkerRequest } from "../_utils";

const requestSchema = z.object({
  workerHostId: z.string().min(1).optional(),
  workerId: z.string().min(1).optional(),
  hostId: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(100).default(10),
  host: mt5ClaimHostSchema.optional(),
}).superRefine((value, ctx) => {
  if (!value.workerHostId && !value.workerId && !value.hostId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "workerId or hostId is required",
    });
  }
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
