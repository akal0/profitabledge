import { eq, isNotNull } from "drizzle-orm";

import { db } from "../db";
import { aiProviderKey } from "../db/schema/ai";
import { platformConnection } from "../db/schema/connections";
import {
  decryptCredentials,
  encryptCredentials,
} from "../lib/providers/credential-cipher";

async function reencryptPlatformConnections() {
  const rows = await db
    .select({
      id: platformConnection.id,
      encryptedCredentials: platformConnection.encryptedCredentials,
      credentialIv: platformConnection.credentialIv,
    })
    .from(platformConnection)
    .where(
      isNotNull(platformConnection.encryptedCredentials)
    );

  let updatedCount = 0;

  for (const row of rows) {
    if (!row.encryptedCredentials || !row.credentialIv) {
      continue;
    }

    const decrypted = decryptCredentials(
      row.encryptedCredentials,
      row.credentialIv
    );
    const next = encryptCredentials(decrypted);

    await db
      .update(platformConnection)
      .set({
        encryptedCredentials: next.encrypted,
        credentialIv: next.iv,
        updatedAt: new Date(),
      })
      .where(eq(platformConnection.id, row.id));

    updatedCount += 1;
  }

  return updatedCount;
}

async function reencryptAiProviderKeys() {
  const rows = await db
    .select({
      id: aiProviderKey.id,
      encryptedApiKey: aiProviderKey.encryptedApiKey,
      credentialIv: aiProviderKey.credentialIv,
    })
    .from(aiProviderKey);

  let updatedCount = 0;

  for (const row of rows) {
    const decrypted = decryptCredentials(
      row.encryptedApiKey,
      row.credentialIv
    );
    const next = encryptCredentials(decrypted);

    await db
      .update(aiProviderKey)
      .set({
        encryptedApiKey: next.encrypted,
        credentialIv: next.iv,
        updatedAt: new Date(),
      })
      .where(eq(aiProviderKey.id, row.id));

    updatedCount += 1;
  }

  return updatedCount;
}

async function main() {
  const [platformConnectionsUpdated, aiKeysUpdated] = await Promise.all([
    reencryptPlatformConnections(),
    reencryptAiProviderKeys(),
  ]);

  console.log(
    JSON.stringify(
      {
        ok: true,
        platformConnectionsUpdated,
        aiKeysUpdated,
      },
      null,
      2
    )
  );
}

await main();
