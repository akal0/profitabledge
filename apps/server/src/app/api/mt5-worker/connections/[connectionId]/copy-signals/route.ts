import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { platformConnection } from "@/db/schema/connections";
import { claimPendingCopySignalsForAccount } from "@/lib/copy-signal-queue";
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

    const [connection] = await db
      .select({
        accountId: platformConnection.accountId,
      })
      .from(platformConnection)
      .where(eq(platformConnection.id, connectionId))
      .limit(1);

    if (!connection?.accountId) {
      return NextResponse.json({
        success: true,
        signals: [],
      });
    }

    const signals = await claimPendingCopySignalsForAccount(connection.accountId);

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
