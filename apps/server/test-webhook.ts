/**
 * Quick test script to verify webhook endpoints are responding correctly
 * Run with: bun run test-webhook.ts
 */

const SERVER_URL = process.env.TEST_TRPC_URL || "http://localhost:3000/trpc";
const API_KEY = "pe_live_RT7a43_0xBplM7NcQEuTwDyhqBVlzwro";
const ACCOUNT_NUMBER = process.env.TEST_ACCOUNT_NUMBER || "12345";

if (!API_KEY) {
  console.error("Missing TEST_API_KEY. Set it before running this script.");
  process.exit(1);
}

async function testMutation(endpoint: string, input: any) {
  const startTime = Date.now();

  try {
    const response = await fetch(`${SERVER_URL}/webhook.${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    const duration = Date.now() - startTime;
    const raw = await response.text();
    let data: any = raw;
    try {
      data = JSON.parse(raw);
    } catch (_) {
      // keep raw text for debugging
    }

    console.log(`\n✅ ${endpoint} - ${response.status} in ${duration}ms`);
    if (response.ok) {
      console.log(
        `   Response:`,
        JSON.stringify(data?.result?.data ?? data, null, 2)
      );
    } else {
      console.log(`   Error:`, data?.error ?? data);
    }

    return { success: response.ok, duration, data };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`\n❌ ${endpoint} - ERROR after ${duration}ms`);
    console.log(`   Error:`, error);
    return { success: false, duration, error };
  }
}

async function testQuery(endpoint: string, input: any) {
  const startTime = Date.now();
  const params = new URLSearchParams();
  params.set("input", JSON.stringify(input));

  try {
    const response = await fetch(
      `${SERVER_URL}/webhook.${endpoint}?${params.toString()}`,
      {
        method: "GET",
      }
    );

    const duration = Date.now() - startTime;
    const raw = await response.text();
    let data: any = raw;
    try {
      data = JSON.parse(raw);
    } catch (_) {
      // keep raw text for debugging
    }

    console.log(`\n✅ ${endpoint} - ${response.status} in ${duration}ms`);
    if (response.ok) {
      console.log(
        `   Response:`,
        JSON.stringify(data?.result?.data ?? data, null, 2)
      );
    } else {
      console.log(`   Error:`, data?.error ?? data);
    }

    return { success: response.ok, duration, data };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`\n❌ ${endpoint} - ERROR after ${duration}ms`);
    console.log(`   Error:`, error);
    return { success: false, duration, error };
  }
}

async function runTests() {
  console.log("🧪 Testing Webhook Endpoints\n");
  console.log("Server:", SERVER_URL);
  console.log("=" + "=".repeat(50));

  // Test 0: registerAccount (ensures account exists)
  await testMutation("registerAccount", {
    apiKey: API_KEY,
    accountNumber: ACCOUNT_NUMBER,
    accountName: `MT5 ${ACCOUNT_NUMBER}`,
    broker: "mt5",
    brokerServer: "test-broker",
    initialBalance: 10000,
    currency: "$",
  });

  // Test 1: priceUpdate (should be no-op now)
  await testMutation("priceUpdate", {
    apiKey: API_KEY,
    accountId: "test-account",
    prices: [
      {
        symbol: "EURUSD",
        bid: 1.05,
        ask: 1.0502,
        timestamp: new Date().toISOString(),
      },
    ],
  });

  // Test 2: updateAccountStatus
  await testMutation("updateAccountStatus", {
    apiKey: API_KEY,
    accountNumber: ACCOUNT_NUMBER,
    balance: 10000,
    equity: 10050,
    margin: 100,
    freeMargin: 9950,
  });

  // Test 3: syncOpenTrades
  await testMutation("syncOpenTrades", {
    apiKey: API_KEY,
    accountNumber: ACCOUNT_NUMBER,
    trades: [
      {
        ticket: "123456",
        symbol: "EURUSD",
        type: "buy",
        volume: 0.1,
        openPrice: 1.05,
        openTime: new Date().toISOString(),
        currentPrice: 1.051,
        profit: 10,
      },
    ],
  });

  // Test 4: syncClosedTrades (creates trade_closed notifications)
  await testMutation("syncClosedTrades", {
    apiKey: API_KEY,
    accountNumber: ACCOUNT_NUMBER,
    trades: [
      {
        ticket: "123456",
        symbol: "EURUSD",
        type: "buy",
        volume: 0.1,
        openPrice: 1.05,
        openTime: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        closePrice: 1.052,
        closeTime: new Date().toISOString(),
        profit: 12.5,
      },
    ],
  });

  // Test 5: ping (health check)
  await testQuery("ping", {
    apiKey: API_KEY,
  });

  console.log("\n" + "=".repeat(50));
  console.log("✨ Tests completed!\n");
}

// Run tests
runTests().catch(console.error);
