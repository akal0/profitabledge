import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { platformConnection } from "../db/schema/connections";
import { ingestMt5SyncFrame } from "../lib/mt5/ingestion";

async function ensureTestConnection(userId: string) {
  const existing = await db.query.platformConnection.findFirst({
    where: and(
      eq(platformConnection.userId, userId),
      eq(platformConnection.provider, "mt5-terminal")
    ),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(platformConnection)
    .values({
      id: crypto.randomUUID(),
      userId,
      provider: "mt5-terminal",
      displayName: "Local MT5 Terminal Test",
      status: "pending",
      meta: {
        localTest: true,
      },
      syncIntervalMinutes: 0,
      isPaused: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return created;
}

async function main() {
  const userId = process.env.MT5_TEST_USER_ID;

  if (!userId) {
    throw new Error(
      "MT5_TEST_USER_ID is required to run the local MT5 mock sync script."
    );
  }

  const connection = await ensureTestConnection(userId);
  const now = new Date();
  const openedAt = new Date(now.getTime() - 75 * 60 * 1000);
  const closedAt = new Date(now.getTime() - 20 * 60 * 1000);

  const result = await ingestMt5SyncFrame({
    connectionId: connection.id,
    session: {
      workerHostId: "local-dev-worker",
      sessionKey: `local-${connection.id}`,
      status: "syncing",
      heartbeatAt: now.toISOString(),
      lastLoginAt: new Date(now.getTime() - 80 * 60 * 1000).toISOString(),
      meta: {
        mode: "mock",
      },
    },
    account: {
      login: "12345678",
      serverName: "ICMarketsSC-Demo",
      brokerName: "IC Markets",
      currency: "USD",
      leverage: 100,
      balance: 10245.5,
      equity: 10302.1,
      margin: 245.33,
      freeMargin: 10056.77,
      marginLevel: 4198.4,
      snapshotTime: now.toISOString(),
      rawPayload: {
        source: "mock-script",
      },
    },
    positions: [
      {
        remotePositionId: "91002",
        side: "sell",
        symbol: "GBPUSD",
        volume: 0.5,
        openPrice: 1.2674,
        currentPrice: 1.2649,
        profit: 125,
        swap: -0.5,
        commission: -3.5,
        sl: 1.2705,
        tp: 1.2605,
        comment: "mock open position",
        magicNumber: 0,
        openTime: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
        snapshotTime: now.toISOString(),
        rawPayload: {
          source: "mock-script",
        },
      },
    ],
    deals: [
      {
        remoteDealId: "81001",
        remoteOrderId: "71001",
        positionId: "91001",
        entryType: "in",
        side: "buy",
        symbol: "EURUSD",
        volume: 1,
        price: 1.082,
        profit: 0,
        commission: -3.5,
        swap: 0,
        fee: 0,
        sl: 1.079,
        tp: 1.088,
        comment: "mock entry",
        eventTime: openedAt.toISOString(),
        rawPayload: {
          source: "mock-script",
        },
      },
      {
        remoteDealId: "81002",
        remoteOrderId: "71001",
        positionId: "91001",
        entryType: "out",
        side: "sell",
        symbol: "EURUSD",
        volume: 1,
        price: 1.0846,
        profit: 260,
        commission: -3.5,
        swap: -0.7,
        fee: 0,
        sl: 1.079,
        tp: 1.088,
        comment: "mock exit",
        eventTime: closedAt.toISOString(),
        rawPayload: {
          source: "mock-script",
        },
      },
    ],
    orders: [
      {
        eventKey: "71001-created",
        remoteOrderId: "71001",
        positionId: "91001",
        side: "buy",
        orderType: "market",
        state: "filled",
        symbol: "EURUSD",
        requestedVolume: 1,
        filledVolume: 1,
        price: 1.082,
        sl: 1.079,
        tp: 1.088,
        comment: "mock order",
        eventTime: openedAt.toISOString(),
        rawPayload: {
          source: "mock-script",
        },
      },
    ],
    checkpoint: {
      lastDealTime: closedAt.toISOString(),
      lastDealId: "81002",
      lastOrderTime: openedAt.toISOString(),
      lastPositionPollAt: now.toISOString(),
      lastAccountPollAt: now.toISOString(),
    },
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("[mock-mt5-worker-sync] failed");
  console.error(error);
  process.exit(1);
});
