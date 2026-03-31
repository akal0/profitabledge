import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { NextRequest, NextResponse } from "next/server";

const routeDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(routeDirectory, "../../../../../../");

const desktopPlatforms = {
  macos: {
    envUrlKeys: [
      "DESKTOP_MAC_DOWNLOAD_URL",
      "NEXT_PUBLIC_DESKTOP_MAC_DOWNLOAD_URL",
    ],
    envPathKeys: ["DESKTOP_MAC_DOWNLOAD_PATH"],
    searchDirs: [
      "apps/desktop/src-tauri/target/release/bundle/dmg",
      "apps/desktop/src-tauri/target/release/bundle/macos",
      "apps/desktop/dist/downloads/macos",
    ],
    extensions: [".dmg", ".app.tar.gz", ".zip"],
  },
  windows: {
    envUrlKeys: [
      "DESKTOP_WINDOWS_DOWNLOAD_URL",
      "NEXT_PUBLIC_DESKTOP_WINDOWS_DOWNLOAD_URL",
    ],
    envPathKeys: ["DESKTOP_WINDOWS_DOWNLOAD_PATH"],
    searchDirs: [
      "apps/desktop/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis",
      "apps/desktop/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi",
      "apps/desktop/dist/downloads/windows",
    ],
    extensions: [".exe", ".msi", ".zip"],
  },
} as const;

type DesktopPlatform = keyof typeof desktopPlatforms;

function isDesktopPlatform(value: string): value is DesktopPlatform {
  return value in desktopPlatforms;
}

function resolveDesktopDownloadTarget(platform: DesktopPlatform) {
  const config = desktopPlatforms[platform];

  for (const key of config.envUrlKeys) {
    const candidate = process.env[key]?.trim();
    if (candidate) {
      return candidate;
    }
  }

  return null;
}

function resolveDesktopDownloadFile(platform: DesktopPlatform) {
  const config = desktopPlatforms[platform];
  const explicitPath = config.envPathKeys
    .map((key) => process.env[key]?.trim())
    .find((candidate): candidate is string => Boolean(candidate));

  if (explicitPath) {
    const absolutePath = path.isAbsolute(explicitPath)
      ? explicitPath
      : path.join(repositoryRoot, explicitPath);
    if (fs.existsSync(absolutePath)) {
      return absolutePath;
    }
  }

  for (const relativeDir of config.searchDirs) {
    const absoluteDir = path.join(repositoryRoot, relativeDir);
    if (!fs.existsSync(absoluteDir)) {
      continue;
    }

    const candidate = fs
      .readdirSync(absoluteDir)
      .map((entry) => ({
        entry,
        extensionIndex: config.extensions.findIndex((extension) =>
          entry.endsWith(extension)
        ),
      }))
      .filter(({ extensionIndex }) => extensionIndex >= 0)
      .map((entry) => ({
        filePath: path.join(absoluteDir, entry.entry),
        modifiedAt: fs.statSync(path.join(absoluteDir, entry.entry)).mtimeMs,
        extensionIndex: entry.extensionIndex,
      }))
      .sort((left, right) => {
        if (left.extensionIndex !== right.extensionIndex) {
          return left.extensionIndex - right.extensionIndex;
        }

        return right.modifiedAt - left.modifiedAt;
      })[0];

    if (candidate) {
      return candidate.filePath;
    }
  }

  return null;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ platform: string }> }
) {
  const { platform } = await context.params;

  if (!isDesktopPlatform(platform)) {
    return NextResponse.json({ error: "Unknown desktop platform" }, { status: 404 });
  }

  const localFile = resolveDesktopDownloadFile(platform);
  if (localFile) {
    const file = await fs.promises.readFile(localFile);
    return new NextResponse(file, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${path.basename(localFile)}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const target = resolveDesktopDownloadTarget(platform);
  if (target) {
    return NextResponse.redirect(target, {
      status: 307,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json(
    {
      error: "Desktop installer is not published yet",
      platform,
      configureOneOf: [
        ...desktopPlatforms[platform].envUrlKeys,
        ...desktopPlatforms[platform].envPathKeys,
      ],
    },
    { status: 503 }
  );
}
