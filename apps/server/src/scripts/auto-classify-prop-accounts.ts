import { db } from "../db";
import { tradingAccount } from "../db/schema/trading";
import { buildAutoPropAccountFields } from "../lib/prop-firm-detection";
import { eq } from "drizzle-orm";

/**
 * Auto-classify existing accounts as prop accounts based on broker detection
 * Run: bun src/scripts/auto-classify-prop-accounts.ts
 */

async function autoClassifyPropAccounts() {
  console.log("🔍 Starting auto-classification of prop accounts...\n");

  try {
    // Fetch all accounts that are NOT already prop accounts
    const accounts = await db.query.tradingAccount.findMany({
      where: eq(tradingAccount.isPropAccount, false),
    });

    console.log(`Found ${accounts.length} accounts to check\n`);

    let classifiedCount = 0;
    let activatedCount = 0;

    for (const account of accounts) {
      const { detection, updates, activated } =
        await buildAutoPropAccountFields({
          broker: account.broker,
          brokerServer: account.brokerServer,
          initialBalance: account.initialBalance,
          liveBalance: account.liveBalance,
          liveEquity: account.liveEquity,
        });

      if (detection.detected && detection.propFirmId) {
        console.log(`✅ Detected: ${account.name}`);
        console.log(`   Broker: ${account.broker}`);
        console.log(`   Server: ${account.brokerServer}`);
        console.log(
          `   Prop Firm: ${detection.propFirmName} (${detection.confidence} confidence)`
        );

        await db
          .update(tradingAccount)
          .set(updates)
          .where(eq(tradingAccount.id, account.id));

        if (activated) {
          activatedCount++;
          const startBalance = Number(updates.propPhaseStartBalance || 0);
          console.log(`   ✨ AUTO-ACTIVATED prop tracking!`);
          console.log(`   → Challenge Rule: ${updates.propChallengeRuleId}`);
          console.log(`   → Phase: ${updates.propCurrentPhase}`);
          console.log(
            `   → Start Balance: $${startBalance.toLocaleString()}\n`
          );
        } else {
          console.log(
            `   → Marked for user review (${detection.confidence} confidence)\n`
          );
        }

        classifiedCount++;
      } else {
        console.log(
          `ℹ️  No prop firm detected for: ${account.name} (${account.broker})`
        );
      }
    }

    console.log(`\n🎉 Auto-classification complete!`);
    console.log(`   Detected: ${classifiedCount} prop accounts`);
    console.log(`   Auto-activated: ${activatedCount} accounts`);
    console.log(
      `   Needs review: ${classifiedCount - activatedCount} accounts`
    );
    console.log(`   Non-prop: ${accounts.length - classifiedCount} accounts`);

    if (activatedCount > 0) {
      console.log(`\n✨ ${activatedCount} prop account(s) auto-activated!`);
      console.log(`   Go to /dashboard/prop-tracker to view them`);
    }

    if (classifiedCount - activatedCount > 0) {
      console.log(
        `\n💡 ${classifiedCount - activatedCount} account(s) need review:`
      );
      console.log(`   1. Go to /dashboard/accounts`);
      console.log(`   2. Look for "Prop Firm Detected" indicators`);
      console.log(`   3. Click "Enable Prop Tracking" to activate`);
    }
  } catch (error) {
    console.error("❌ Error during auto-classification:", error);
    throw error;
  } finally {
    process.exit(0);
  }
}

// Run the auto-classification
autoClassifyPropAccounts();
