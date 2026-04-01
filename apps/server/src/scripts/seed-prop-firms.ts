import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../db";
import { propChallengeRule, propFirm } from "../db/schema/trading";
import {
  getBuiltinPropChallengeRuleSeeds,
  getBuiltinPropFirmSeeds,
} from "../lib/builtin-trading-firms";

/**
 * Seed the built-in prop firm registry from the shared trading catalog.
 * Run: bun run apps/server/src/scripts/seed-prop-firms.ts
 */

async function seedPropFirms() {
  const firmSeeds = getBuiltinPropFirmSeeds();
  const ruleSeeds = getBuiltinPropChallengeRuleSeeds();
  const activeFirmIds = new Set(firmSeeds.map((firm) => firm.id));
  const activeRuleIds = new Set(ruleSeeds.map((rule) => rule.id));

  console.log(`🌱 Seeding ${firmSeeds.length} prop firms...`);

  for (const firm of firmSeeds) {
    await db
      .insert(propFirm)
      .values(firm)
      .onConflictDoUpdate({
        target: propFirm.id,
        set: {
          name: firm.name,
          displayName: firm.displayName,
          description: firm.description,
          logo: firm.logo,
          website: firm.website,
          supportedPlatforms: firm.supportedPlatforms,
          brokerDetectionPatterns: firm.brokerDetectionPatterns,
          active: firm.active,
          updatedAt: new Date(),
        },
      });
  }

  console.log(`🌱 Seeding ${ruleSeeds.length} prop challenge rules...`);

  for (const rule of ruleSeeds) {
    await db
      .insert(propChallengeRule)
      .values(rule)
      .onConflictDoUpdate({
        target: propChallengeRule.id,
        set: {
          challengeType: rule.challengeType,
          displayName: rule.displayName,
          phases: rule.phases,
          active: rule.active,
          updatedAt: new Date(),
        },
      });
  }

  const [existingBuiltinFirms, existingBuiltinRules] = await Promise.all([
    db.query.propFirm.findMany({
      where: and(isNull(propFirm.createdByUserId), eq(propFirm.active, true)),
      columns: { id: true },
    }),
    db.query.propChallengeRule.findMany({
      where: and(
        isNull(propChallengeRule.createdByUserId),
        eq(propChallengeRule.active, true)
      ),
      columns: { id: true },
    }),
  ]);

  const retiredFirmIds = existingBuiltinFirms
    .map((firm) => firm.id)
    .filter((id) => !activeFirmIds.has(id));
  const retiredRuleIds = existingBuiltinRules
    .map((rule) => rule.id)
    .filter((id) => !activeRuleIds.has(id));

  if (retiredFirmIds.length) {
    await db
      .update(propFirm)
      .set({ active: false, updatedAt: new Date() })
      .where(
        and(
          isNull(propFirm.createdByUserId),
          inArray(propFirm.id, retiredFirmIds)
        )
      );

    await db
      .update(propChallengeRule)
      .set({ active: false, updatedAt: new Date() })
      .where(
        and(
          isNull(propChallengeRule.createdByUserId),
          inArray(propChallengeRule.propFirmId, retiredFirmIds)
        )
      );
  }

  if (retiredRuleIds.length) {
    await db
      .update(propChallengeRule)
      .set({ active: false, updatedAt: new Date() })
      .where(
        and(
          isNull(propChallengeRule.createdByUserId),
          inArray(propChallengeRule.id, retiredRuleIds)
        )
      );
  }

  console.log(
    `✅ Prop firm catalog seeded successfully. Retired ${retiredFirmIds.length} firms and ${retiredRuleIds.length} rules.`
  );
}

seedPropFirms()
  .catch((error) => {
    console.error("❌ Error seeding prop firms:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit();
  });
