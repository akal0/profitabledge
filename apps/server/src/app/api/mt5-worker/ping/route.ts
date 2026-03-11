import { NextRequest, NextResponse } from "next/server";
import { assertWorkerRequest } from "../_utils";

export async function GET(request: NextRequest) {
  try {
    assertWorkerRequest(request);
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
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
