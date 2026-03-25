import { NextRequest, NextResponse } from "next/server";

import { listPendingMt5CopySignals } from "@/lib/mt5/copy-signals";
import { assertWorkerRequest } from "../../../_utils";

interface Params {
  params: Promise<{
    connectionId: string;
  }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    assertWorkerRequest(request);
    const { connectionId } = await params;
    const signals = await listPendingMt5CopySignals(connectionId);

    return NextResponse.json({
      success: true,
      signals,
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
