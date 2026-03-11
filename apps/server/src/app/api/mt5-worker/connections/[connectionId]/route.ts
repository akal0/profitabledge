import { NextRequest, NextResponse } from "next/server";
import { getMtConnectionBootstrap } from "@/lib/mt5/worker-control";
import { assertWorkerRequest } from "../../_utils";

interface Params {
  params: Promise<{
    connectionId: string;
  }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    assertWorkerRequest(request);
    const { connectionId } = await params;
    const connection = await getMtConnectionBootstrap(connectionId);

    return NextResponse.json({
      success: true,
      connection,
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
