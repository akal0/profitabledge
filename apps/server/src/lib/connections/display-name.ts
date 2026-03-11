import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { platformConnection } from "../../db/schema/connections";

const MAX_DISPLAY_NAME_SUFFIX = 1000;

export async function resolveUniqueConnectionDisplayName(input: {
  userId: string;
  provider: string;
  displayName: string;
  excludeConnectionId?: string;
}) {
  const baseName = input.displayName.trim();
  if (!baseName) {
    throw new Error("Connection display name cannot be empty");
  }

  const existingConnections = await db.query.platformConnection.findMany({
    where: and(
      eq(platformConnection.userId, input.userId),
      eq(platformConnection.provider, input.provider)
    ),
    columns: {
      id: true,
      displayName: true,
    },
  });

  const takenNames = new Set(
    existingConnections
      .filter((connection) => connection.id !== input.excludeConnectionId)
      .map((connection) => connection.displayName.toLowerCase())
  );

  if (!takenNames.has(baseName.toLowerCase())) {
    return baseName;
  }

  for (let suffix = 2; suffix <= MAX_DISPLAY_NAME_SUFFIX; suffix += 1) {
    const candidate = `${baseName} (${suffix})`;
    if (!takenNames.has(candidate.toLowerCase())) {
      return candidate;
    }
  }

  throw new Error(
    `Could not allocate a unique connection name for "${baseName}"`
  );
}
