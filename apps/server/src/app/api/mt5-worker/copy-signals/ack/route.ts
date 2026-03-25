import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ackMt5CopySignal } from "@/lib/mt5/copy-signals";
import { assertWorkerRequest } from "../../_utils";

const requestSchema = z.object({
  signalId: z.string().min(1),
  success: z.boolean(),
  slaveTicket: z.string().min(1).nullish(),
  executedPrice: z.number().finite().nullish(),
  slippagePips: z.number().finite().nullish(),
  profit: z.number().finite().nullish(),
  errorMessage: z.string().max(4_000).nullish(),
});

export async function POST(request: NextRequest) {
  try {
    assertWorkerRequest(request);
    const body = requestSchema.parse(await request.json());
    const result = await ackMt5CopySignal(body);

    return NextResponse.json({
      ...result,
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
