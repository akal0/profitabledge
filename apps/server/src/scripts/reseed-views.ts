#!/usr/bin/env bun
/**
 * Script to reseed default views for all existing users
 *
 * Usage:
 *   bun run src/scripts/reseed-views.ts
 */

import { resetViewsForAllUsers } from '../lib/seed-views';

async function main() {
  console.log('Starting default view reset for all users...\n');

  try {
    await resetViewsForAllUsers();
    console.log('\n✅ View reset completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error reseeding views:', error);
    process.exit(1);
  }
}

main();
