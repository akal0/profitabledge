import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ackCopySignalExecution } from "@/lib/copy-signal-queue";
import { assertWorkerRequest } from "../../_utils";

const requestSchema = z.object({
  signalId: z.string().min(1),
  success: z.boolean(),
  slaveTicket: z.string().nullable().optional(),
  executedPrice: z.number().nullable().optional(),
  slippagePips: z.number().nullable().optional(),
  profit: z.number().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    assertWorkerRequest(request);
    const body = requestSchema.parse(await request.json());
    const result = await ackCopySignalExecution(body);

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
