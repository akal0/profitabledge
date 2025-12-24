import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    // Path to EA file (relative to project root)
    const eaPath = path.join(
      process.cwd(),
      "../../EA/profitabledge_data_bridge.mq5"
    );

    // Check if file exists
    if (!fs.existsSync(eaPath)) {
      return NextResponse.json({ error: "EA file not found" }, { status: 404 });
    }

    // Read file content
    const content = fs.readFileSync(eaPath, "utf-8");

    // Return file as download
    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="profitabledge_data_bridge.mq5"',
      },
    });
  } catch (error: any) {
    console.error("Error serving EA file:", error);
    return NextResponse.json(
      { error: "Failed to download EA file", details: error.message },
      { status: 500 }
    );
  }
}
