/**
 * Trade Views Router
 *
 * Handles CRUD operations for trade views (saved filter/column configurations).
 * Views are lenses on trade data - they never mutate data or recalculate metrics.
 *
 * Philosophy: Views allow users to ask different questions of the same data.
 */

import { router, protectedProcedure } from '../lib/trpc';
import { db } from '../db';
import { tradeView } from '../db/schema/trading';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import type { TradeViewConfig } from '../types/trade-view';

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

const tradeViewConfigSchema = z.object({
  filters: z.object({
    sessionTags: z.array(z.string()).optional(),
    edgeIds: z.array(z.string()).optional(),
    modelTags: z.array(z.string()).optional(),
    protocolAlignment: z
      .array(z.enum(['aligned', 'against', 'discretionary']))
      .optional(),
    outcomes: z.array(z.enum(['Win', 'Loss', 'BE', 'PW', 'Live'])).optional(),
    symbols: z.array(z.string()).optional(),
    directions: z.array(z.enum(['long', 'short'])).optional(),
    dateRange: z
      .object({
        start: z.string().optional(),
        end: z.string().optional(),
      })
      .optional(),
    numericFilters: z.record(z.string(), z.object({
      min: z.number().optional(),
      max: z.number().optional(),
    })).optional(),
  }),
  visibleColumns: z.array(z.string()),
  hiddenColumns: z.array(z.string()).optional(),
  columnOrder: z.array(z.string()).optional(),
  sorting: z
    .array(
      z.object({
        columnId: z.string(),
        direction: z.enum(['asc', 'desc']),
      })
    )
    .optional(),
  emphasis: z
    .object({
      highlightedMetrics: z.array(z.string()).optional(),
      primaryMetric: z.string().optional(),
    })
    .optional(),
  disableSampleGating: z.boolean().optional(),
}) satisfies z.ZodType<TradeViewConfig>;

// ============================================================================
// Router Definition
// ============================================================================

export const viewsRouter = router({
  /**
   * List all views for the current user
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const views = await db
      .select()
      .from(tradeView)
      .where(eq(tradeView.userId, ctx.session.user.id))
      .orderBy(tradeView.sortOrder, desc(tradeView.createdAt));

    return views;
  }),

  /**
   * Get a single view by ID
   */
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const view = await db
        .select()
        .from(tradeView)
        .where(and(eq(tradeView.id, input.id), eq(tradeView.userId, ctx.session.user.id)))
        .limit(1);

      if (!view[0]) {
        throw new Error('View not found');
      }

      return view[0];
    }),

  /**
   * Get the default view for the current user
   */
  getDefault: protectedProcedure.query(async ({ ctx }) => {
    const view = await db
      .select()
      .from(tradeView)
      .where(
        and(eq(tradeView.userId, ctx.session.user.id), eq(tradeView.isDefault, true))
      )
      .limit(1);

    return view[0] ?? null;
  }),

  /**
   * Create a new view
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        icon: z.string().max(10).optional(),
        config: tradeViewConfigSchema,
        isDefault: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // If setting as default, clear existing default
      if (input.isDefault) {
        await db
          .update(tradeView)
          .set({ isDefault: false })
          .where(eq(tradeView.userId, ctx.session.user.id));
      }

      const [newView] = await db
        .insert(tradeView)
        .values({
          userId: ctx.session.user.id,
          name: input.name,
          description: input.description ?? null,
          icon: input.icon ?? null,
          config: input.config as any, // JSONB type
          isDefault: input.isDefault ?? false,
          sortOrder: 0, // New views at top
        })
        .returning();

      return newView;
    }),

  /**
   * Update an existing view
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional(),
        icon: z.string().max(10).optional(),
        config: tradeViewConfigSchema.optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...updates } = input;

      const [updatedView] = await db
        .update(tradeView)
        .set({
          ...updates,
          config: updates.config as any, // JSONB type
          updatedAt: new Date(),
        })
        .where(and(eq(tradeView.id, id), eq(tradeView.userId, ctx.session.user.id)))
        .returning();

      if (!updatedView) {
        throw new Error('View not found or unauthorized');
      }

      return updatedView;
    }),

  /**
   * Delete a view
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const result = await db
        .delete(tradeView)
        .where(and(eq(tradeView.id, input.id), eq(tradeView.userId, ctx.session.user.id)))
        .returning();

      if (!result[0]) {
        throw new Error('View not found or unauthorized');
      }

      return { success: true };
    }),

  /**
   * Set a view as the default
   */
  setDefault: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Clear existing default
      await db
        .update(tradeView)
        .set({ isDefault: false })
        .where(eq(tradeView.userId, ctx.session.user.id));

      // Set new default
      const [updatedView] = await db
        .update(tradeView)
        .set({ isDefault: true })
        .where(and(eq(tradeView.id, input.id), eq(tradeView.userId, ctx.session.user.id)))
        .returning();

      if (!updatedView) {
        throw new Error('View not found or unauthorized');
      }

      return updatedView;
    }),

  /**
   * Duplicate a view (create a copy)
   */
  duplicate: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(), // Optional custom name
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Get original view
      const [originalView] = await db
        .select()
        .from(tradeView)
        .where(and(eq(tradeView.id, input.id), eq(tradeView.userId, ctx.session.user.id)))
        .limit(1);

      if (!originalView) {
        throw new Error('View not found or unauthorized');
      }

      // Create duplicate
      const [duplicateView] = await db
        .insert(tradeView)
        .values({
          userId: ctx.session.user.id,
          name: input.name ?? `${originalView.name} (Copy)`,
          description: originalView.description,
          icon: originalView.icon,
          config: originalView.config,
          isDefault: false, // Never set duplicate as default
          sortOrder: 0,
        })
        .returning();

      return duplicateView;
    }),

  /**
   * Reorder views (update sortOrder for multiple views)
   */
  reorder: protectedProcedure
    .input(
      z.array(
        z.object({
          id: z.string(),
          sortOrder: z.number(),
        })
      )
    )
    .mutation(async ({ input, ctx }) => {
      // Update each view's sortOrder
      const updatePromises = input.map((item) =>
        db
          .update(tradeView)
          .set({ sortOrder: item.sortOrder })
          .where(
            and(eq(tradeView.id, item.id), eq(tradeView.userId, ctx.session.user.id))
          )
      );

      await Promise.all(updatePromises);

      return { success: true };
    }),
});
