import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  mtWorkerHostSnapshotSchema,
  reportMtWorkerHostSnapshot,
} from "@/lib/mt5/host-status";
import { assertWorkerRequest } from "../_utils";

const requestSchema = z.object({
  workerHostId: z.string().min(1),
  snapshot: mtWorkerHostSnapshotSchema,
});

export async function POST(request: NextRequest) {
  try {
    assertWorkerRequest(request);
    const body = requestSchema.parse(await request.json());

    if (body.workerHostId !== body.snapshot.workerHostId) {
      return NextResponse.json(
        {
          success: false,
          error: "workerHostId mismatch",
        },
        { status: 400 }
      );
    }

    const result = await reportMtWorkerHostSnapshot(body.snapshot);
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
