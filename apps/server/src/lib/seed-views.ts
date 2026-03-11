/**
 * View Seeding Utility
 *
 * Seeds default views for users who don't have any views yet.
 * Can be called during user registration or as a one-time migration.
 */

import { db } from '../db';
import { tradeView } from '../db/schema/trading';
import { and, eq, inArray } from 'drizzle-orm';
import { DEFAULT_VIEW_TEMPLATES } from './default-view-templates';

/**
 * Seed default views for a user
 * Skips if user already has views
 */
export async function seedDefaultViewsForUser(userId: string): Promise<void> {
  // Check if user already has views
  const existingViews = await db
    .select({ id: tradeView.id })
    .from(tradeView)
    .where(eq(tradeView.userId, userId))
    .limit(1);

  if (existingViews.length > 0) {
    console.log(`[seed-views] User ${userId} already has views, skipping seed`);
    return;
  }

  // Insert all default view templates
  const viewsToInsert = DEFAULT_VIEW_TEMPLATES.map((template) => ({
    userId,
    name: template.name,
    description: template.description || null,
    icon: template.icon || null,
    config: template.config as any, // JSONB type
    isDefault: template.isDefault,
    sortOrder: template.sortOrder,
  }));

  await db.insert(tradeView).values(viewsToInsert);

  console.log(
    `[seed-views] Seeded ${viewsToInsert.length} default views for user ${userId}`
  );
}

/**
 * Seed default views for all users who don't have views yet
 * Useful for one-time migration
 */
export async function seedDefaultViewsForAllUsers(): Promise<void> {
  const { user } = await import('../db/schema/auth');

  // Get all users
  const users = await db.select({ id: user.id }).from(user);

  console.log(`[seed-views] Found ${users.length} users`);

  let seededCount = 0;
  let skippedCount = 0;

  for (const u of users) {
    const existingViews = await db
      .select({ id: tradeView.id })
      .from(tradeView)
      .where(eq(tradeView.userId, u.id))
      .limit(1);

    if (existingViews.length > 0) {
      skippedCount++;
      continue;
    }

    // Insert default views
    const viewsToInsert = DEFAULT_VIEW_TEMPLATES.map((template) => ({
      userId: u.id,
      name: template.name,
      description: template.description || null,
      icon: template.icon || null,
      config: template.config as any,
      isDefault: template.isDefault,
      sortOrder: template.sortOrder,
    }));

    await db.insert(tradeView).values(viewsToInsert);
    seededCount++;
  }

  console.log(
    `[seed-views] Migration complete: seeded ${seededCount} users, skipped ${skippedCount} users`
  );
}

/**
 * Reseed default views for all users.
 * Keeps custom views, replaces any existing defaults with current templates.
 */
export async function reseedDefaultViewsForAllUsers(): Promise<void> {
  const { user } = await import('../db/schema/auth');

  const users = await db.select({ id: user.id }).from(user);
  const templateNames = DEFAULT_VIEW_TEMPLATES.map((t) => t.name);

  console.log(`[seed-views] Found ${users.length} users`);

  let reseededCount = 0;

  for (const u of users) {
    // Ensure no existing default flag blocks the unique default constraint
    await db
      .update(tradeView)
      .set({ isDefault: false })
      .where(eq(tradeView.userId, u.id));

    if (templateNames.length > 0) {
      await db
        .delete(tradeView)
        .where(
          and(
            eq(tradeView.userId, u.id),
            inArray(tradeView.name, templateNames)
          )
        );
    }

    const viewsToInsert = DEFAULT_VIEW_TEMPLATES.map((template) => ({
      userId: u.id,
      name: template.name,
      description: template.description || null,
      icon: template.icon || null,
      config: template.config as any,
      isDefault: template.isDefault,
      sortOrder: template.sortOrder,
    }));

    await db.insert(tradeView).values(viewsToInsert);
    reseededCount++;
  }

  console.log(
    `[seed-views] Reseeded ${reseededCount} users with updated default views`
  );
}

/**
 * Reset views for all users.
 * Deletes all existing views and inserts the current default templates.
 */
export async function resetViewsForAllUsers(): Promise<void> {
  const { user } = await import('../db/schema/auth');

  const users = await db.select({ id: user.id }).from(user);
  console.log(`[seed-views] Found ${users.length} users`);

  let resetCount = 0;

  for (const u of users) {
    await db.delete(tradeView).where(eq(tradeView.userId, u.id));

    const viewsToInsert = DEFAULT_VIEW_TEMPLATES.map((template) => ({
      userId: u.id,
      name: template.name,
      description: template.description || null,
      icon: template.icon || null,
      config: template.config as any,
      isDefault: template.isDefault,
      sortOrder: template.sortOrder,
    }));

    await db.insert(tradeView).values(viewsToInsert);
    resetCount++;
  }

  console.log(
    `[seed-views] Reset ${resetCount} users with fresh default views`
  );
}
