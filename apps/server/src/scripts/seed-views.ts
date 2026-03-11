#!/usr/bin/env bun
/**
 * Script to seed default views for all existing users
 *
 * Usage:
 *   bun run src/scripts/seed-views.ts
 */

import { seedDefaultViewsForAllUsers } from '../lib/seed-views';

async function main() {
  console.log('Starting default view seeding for all users...\n');

  try {
    await seedDefaultViewsForAllUsers();
    console.log('\n✅ View seeding completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error seeding views:', error);
    process.exit(1);
  }
}

main();
