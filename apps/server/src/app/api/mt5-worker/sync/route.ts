import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  ingestMt5SyncFrame,
  mt5SyncFrameSchema,
} from "@/lib/mt5/ingestion";
import { assertWorkerRequest } from "../_utils";

const requestSchema = z.object({
  frame: mt5SyncFrameSchema,
});

export async function POST(request: NextRequest) {
  try {
    assertWorkerRequest(request);
    const body = requestSchema.parse(await request.json());
    const result = await ingestMt5SyncFrame(body.frame);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error("[mt5-worker/sync] request failed", error);
    if (error instanceof Error && "cause" in error) {
      console.error("[mt5-worker/sync] cause", error.cause);
    }
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
