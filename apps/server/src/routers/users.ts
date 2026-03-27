import { router, protectedProcedure } from "../lib/trpc";
import { db } from "../db";
import { user as userTable } from "../db/schema/auth";
import { tradingAccount, trade } from "../db/schema/trading";
import { and, eq, ne, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  REPORT_CHART_TYPES,
  REPORT_DIMENSION_IDS,
  REPORT_LENS_IDS,
  REPORT_METRIC_IDS,
  REPORT_PANEL_IDS,
} from "@profitabledge/contracts/reports";
import { createNotification } from "../lib/notifications";

const DASHBOARD_WIDGET_IDS = [
  "account-balance",
  "account-contribution",
  "account-equity",
  "win-rate",
  "profit-factor",
  "win-streak",
  "hold-time",
  "average-rr",
  "asset-profitability",
  "trade-counts",
  "profit-expectancy",
  "total-losses",
  "consistency-score",
  "open-trades",
  "risk-calculator",
  "execution-scorecard",
  "money-left-on-table",
  "watchlist",
  "session-performance",
  "streak-calendar",
  "tiltmeter",
  "daily-briefing",
  "session-coach",
  "risk-intelligence",
  "rule-compliance",
  "edge-summary",
  "edge-coach",
  "what-if",
  "benchmark",
] as const;

const CALENDAR_WIDGET_IDS = [
  "net-pl",
  "win-rate",
  "largest-trade",
  "largest-loss",
  "hold-time",
  "avg-trade",
  "weekly-breakdown",
  "active-days",
  "avg-active-day",
  "best-day",
  "worst-day",
] as const;

const CHART_WIDGET_IDS = [
  "daily-net",
  "performance-weekday",
  "performing-assets",
  "equity-curve",
  "drawdown-chart",
  "performance-heatmap",
  "streak-distribution",
  "r-multiple-distribution",
  "mae-mfe-scatter",
  "entry-exit-time",
  "hold-time-scatter",
  "monte-carlo",
  "rolling-performance",
  "correlation-matrix",
  "radar-comparison",
  "risk-adjusted",
  "bell-curve",
] as const;

type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number];
type CalendarWidgetId = (typeof CALENDAR_WIDGET_IDS)[number];
type ChartWidgetId = (typeof CHART_WIDGET_IDS)[number];

const isDashboardWidgetId = (value: string): value is DashboardWidgetId =>
  DASHBOARD_WIDGET_IDS.includes(value as DashboardWidgetId);

const isCalendarWidgetId = (value: string): value is CalendarWidgetId =>
  CALENDAR_WIDGET_IDS.includes(value as CalendarWidgetId);

const isChartWidgetId = (value: string): value is ChartWidgetId =>
  CHART_WIDGET_IDS.includes(value as ChartWidgetId);

const manualTradeSizingProfileSchema = z.object({
  defaultVolume: z.number().positive().optional(),
  minVolume: z.number().positive().optional(),
  volumeStep: z.number().positive().optional(),
  contractSize: z.number().positive().optional(),
});

const manualTradeSizingSchema = z
  .object({
    forex: manualTradeSizingProfileSchema.optional(),
    indices: manualTradeSizingProfileSchema.optional(),
    metals: manualTradeSizingProfileSchema.optional(),
    energy: manualTradeSizingProfileSchema.optional(),
    crypto: manualTradeSizingProfileSchema.optional(),
    rates: manualTradeSizingProfileSchema.optional(),
    agriculture: manualTradeSizingProfileSchema.optional(),
    other: manualTradeSizingProfileSchema.optional(),
  })
  .partial();

export const usersRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const rows = await db
      .select({
        id: userTable.id,
        name: userTable.name,
        username: userTable.username,
        email: userTable.email,
        emailVerified: userTable.emailVerified,
        image: userTable.image,
        twitter: userTable.twitter,
        discord: userTable.discord,
        displayName: userTable.displayName,
        bio: userTable.bio,
        location: userTable.location,
        website: userTable.website,
        profileBannerUrl: userTable.profileBannerUrl,
        profileBannerPosition: userTable.profileBannerPosition,
        widgetPreferences: userTable.widgetPreferences,
        chartWidgetPreferences: userTable.chartWidgetPreferences,
        tablePreferences: userTable.tablePreferences,
        advancedMetricsPreferences: userTable.advancedMetricsPreferences,
        notificationPreferences: userTable.notificationPreferences,
        profileEffects: userTable.profileEffects,
        hasSeenTour: userTable.hasSeenTour,
        createdAt: userTable.createdAt,
        updatedAt: userTable.updatedAt,
      })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);

    const currentUser = rows[0];
    if (!currentUser) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    // Initialize default widgets on first read if missing
    const defaultWidgets = [
      "account-balance",
      "win-rate",
      "win-streak",
      "profit-factor",
      "account-contribution",
    ] as const satisfies readonly DashboardWidgetId[];
    const defaultWidgetSpans = {
      "account-contribution": 2,
      "asset-profitability": 2,
    } as const satisfies Partial<Record<DashboardWidgetId, number>>;

    const defaultCalendarWidgets = [
      "net-pl",
      "win-rate",
      "largest-trade",
      "largest-loss",
      "hold-time",
      "avg-trade",
    ] as const satisfies readonly CalendarWidgetId[];

    const defaultCalendarSpans = {} as const;

    const defaultChartWidgets = [
      "daily-net",
      "performance-weekday",
      "performing-assets",
    ] as const satisfies readonly ChartWidgetId[];

    const currentWidgetPrefs = (currentUser as any)?.widgetPreferences || {};
    let nextWidgetPrefs = currentWidgetPrefs;
    let shouldUpdateWidgets = false;

    const widgetsFromDb = currentWidgetPrefs?.widgets as string[] | undefined;
    const spansFromDb = (currentWidgetPrefs?.spans ?? {}) as Record<
      string,
      number
    >;
    if (!Array.isArray(widgetsFromDb) || widgetsFromDb.length === 0) {
      nextWidgetPrefs = {
        ...nextWidgetPrefs,
        widgets: defaultWidgets,
        spans: defaultWidgetSpans,
        accountContributionManaged: true,
      };
      shouldUpdateWidgets = true;
    } else {
      const filteredWidgets = Array.from(
        new Set(widgetsFromDb.filter(isDashboardWidgetId))
      ).slice(0, 15);
      const cleanedSpans = Object.fromEntries(
        Object.entries(spansFromDb).filter(
          ([key, value]) =>
            isDashboardWidgetId(key) &&
            typeof value === "number" &&
            Number.isFinite(value)
        )
      );

      const needsWidgetCleanup =
        filteredWidgets.length !== widgetsFromDb.length ||
        Object.keys(cleanedSpans).length !== Object.keys(spansFromDb).length;
      const accountContributionManaged =
        currentWidgetPrefs?.accountContributionManaged === true;
      const nextFilteredWidgets =
        !accountContributionManaged &&
        !filteredWidgets.includes("account-contribution")
          ? ([
              ...filteredWidgets,
              "account-contribution",
            ] as DashboardWidgetId[]).slice(0, 15)
          : filteredWidgets;
      const nextCleanedSpans =
        !accountContributionManaged &&
        nextFilteredWidgets.includes("account-contribution")
          ? {
              ...cleanedSpans,
              "account-contribution":
                cleanedSpans["account-contribution"] ?? 2,
            }
          : cleanedSpans;
      const needsAccountContributionMigration =
        !accountContributionManaged ||
        nextFilteredWidgets.length !== filteredWidgets.length ||
        Object.keys(nextCleanedSpans).length !== Object.keys(cleanedSpans).length;

      if (needsWidgetCleanup || needsAccountContributionMigration) {
        nextWidgetPrefs = {
          ...nextWidgetPrefs,
          widgets:
            nextFilteredWidgets.length > 0 ? nextFilteredWidgets : defaultWidgets,
          spans: nextCleanedSpans,
          accountContributionManaged: true,
        };
        shouldUpdateWidgets = true;
      }
    }

    const calendarFromDb = currentWidgetPrefs?.calendar?.widgets as
      | string[]
      | undefined;
    const calendarSpansFromDb = (currentWidgetPrefs?.calendar?.spans ??
      {}) as Record<string, number>;
    if (!Array.isArray(calendarFromDb) || calendarFromDb.length === 0) {
      // Only set defaults if calendar widgets don't exist at all
      nextWidgetPrefs = {
        ...nextWidgetPrefs,
        calendar: {
          widgets: defaultCalendarWidgets,
          spans: defaultCalendarSpans,
        },
      };
      shouldUpdateWidgets = true;
    } else {
      // User has calendar widgets - just validate them, don't add missing ones
      const filtered = Array.from(
        new Set(calendarFromDb.filter(isCalendarWidgetId))
      ).slice(0, 6);
      const cleanedSpans = Object.fromEntries(
        Object.entries(calendarSpansFromDb).filter(
          ([key, value]) =>
            isCalendarWidgetId(key) &&
            typeof value === "number" &&
            Number.isFinite(value)
        )
      );
      const needsCalendarCleanup =
        filtered.length !== calendarFromDb.length ||
        Object.keys(cleanedSpans).length !==
          Object.keys(calendarSpansFromDb).length;

      if (needsCalendarCleanup) {
        nextWidgetPrefs = {
          ...nextWidgetPrefs,
          calendar: {
            widgets: filtered,
            spans: cleanedSpans,
          },
        };
        shouldUpdateWidgets = true;
      }
    }

    // Initialize default chart widgets if missing
    const chartFromDb = (currentUser as any)?.chartWidgetPreferences
      ?.widgets as string[] | undefined;
    let nextChartPrefs = (currentUser as any)?.chartWidgetPreferences;
    let shouldUpdateCharts = false;
    if (!Array.isArray(chartFromDb) || chartFromDb.length === 0) {
      nextChartPrefs = { widgets: defaultChartWidgets };
      shouldUpdateCharts = true;
    } else {
      const filteredCharts = Array.from(
        new Set(chartFromDb.filter(isChartWidgetId))
      ).slice(0, 25);
      if (filteredCharts.length !== chartFromDb.length) {
        nextChartPrefs = {
          widgets:
            filteredCharts.length > 0 ? filteredCharts : defaultChartWidgets,
        };
        shouldUpdateCharts = true;
      }
    }

    if (shouldUpdateWidgets || shouldUpdateCharts) {
      await db
        .update(userTable)
        .set({
          ...(shouldUpdateWidgets
            ? { widgetPreferences: nextWidgetPrefs }
            : {}),
          ...(shouldUpdateCharts
            ? { chartWidgetPreferences: nextChartPrefs }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(userTable.id, userId));
      return {
        ...currentUser,
        ...(shouldUpdateWidgets ? { widgetPreferences: nextWidgetPrefs } : {}),
        ...(shouldUpdateCharts
          ? { chartWidgetPreferences: nextChartPrefs }
          : {}),
      };
    }

    return currentUser;
  }),

  getTablePreferences: protectedProcedure
    .input(
      z.object({
        tableId: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const rows = await db
        .select({
          tablePreferences: userTable.tablePreferences,
        })
        .from(userTable)
        .where(eq(userTable.id, userId))
        .limit(1);
      const pref = (rows[0]?.tablePreferences as any) || {};
      return pref[input.tableId] || null;
    }),

  updateTablePreferences: protectedProcedure
    .input(
      z.object({
        tableId: z.string().min(1),
        preferences: z.any(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const rows = await db
        .select({ tablePreferences: userTable.tablePreferences })
        .from(userTable)
        .where(eq(userTable.id, userId))
        .limit(1);
      const curr = (rows[0]?.tablePreferences as any) || {};
      const currentTablePreferences =
        curr[input.tableId] &&
        typeof curr[input.tableId] === "object" &&
        !Array.isArray(curr[input.tableId])
          ? curr[input.tableId]
          : {};
      const nextTablePreferences =
        input.preferences &&
        typeof input.preferences === "object" &&
        !Array.isArray(input.preferences)
          ? { ...currentTablePreferences, ...input.preferences }
          : input.preferences;
      const next = { ...curr, [input.tableId]: nextTablePreferences };
      await db
        .update(userTable)
        .set({ tablePreferences: next, updatedAt: new Date() })
        .where(eq(userTable.id, userId));
      return { ok: true } as const;
    }),

  updateWidgetPreferences: protectedProcedure
    .input(
      z.object({
        widgets: z.array(z.enum(DASHBOARD_WIDGET_IDS)).max(15).default([]),
        spans: z
          .record(
            z.enum(DASHBOARD_WIDGET_IDS),
            z.number().int().min(1).max(5).optional()
          )
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const cleanedSpans = Object.fromEntries(
        Object.entries(input.spans ?? {}).filter(
          ([, value]) => typeof value === "number" && Number.isFinite(value)
        )
      );
      const rows = await db
        .select({ widgetPreferences: userTable.widgetPreferences })
        .from(userTable)
        .where(eq(userTable.id, userId))
        .limit(1);
      const current = (rows[0]?.widgetPreferences as any) || {};
      const next = { ...current, widgets: input.widgets, spans: cleanedSpans };
      await db
        .update(userTable)
        .set({
          widgetPreferences: next,
          updatedAt: new Date(),
        })
        .where(eq(userTable.id, userId));
      return { ok: true } as const;
    }),

  updateCalendarWidgetPreferences: protectedProcedure
    .input(
      z.object({
        widgets: z.array(z.enum(CALENDAR_WIDGET_IDS)).max(6).default([]),
        spans: z
          .record(
            z.enum(CALENDAR_WIDGET_IDS),
            z.number().int().min(1).max(2).optional()
          )
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const cleanedSpans = Object.fromEntries(
        Object.entries(input.spans ?? {}).filter(
          ([, value]) => typeof value === "number" && Number.isFinite(value)
        )
      );
      const rows = await db
        .select({ widgetPreferences: userTable.widgetPreferences })
        .from(userTable)
        .where(eq(userTable.id, userId))
        .limit(1);
      const current = (rows[0]?.widgetPreferences as any) || {};

      const next = {
        ...current,
        calendar: {
          widgets: input.widgets,
          spans: cleanedSpans,
        },
      };
      await db
        .update(userTable)
        .set({
          widgetPreferences: next,
          updatedAt: new Date(),
        })
        .where(eq(userTable.id, userId));

      return { ok: true } as const;
    }),

  updateChartWidgetPreferences: protectedProcedure
    .input(
      z.object({
        widgets: z.array(z.enum(CHART_WIDGET_IDS)).max(25).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await db
        .update(userTable)
        .set({
          chartWidgetPreferences: { widgets: input.widgets },
          updatedAt: new Date(),
        })
        .where(eq(userTable.id, userId));
      return { ok: true } as const;
    }),

  updateAllWidgetPreferences: protectedProcedure
    .input(
      z.object({
        widgets: z.array(z.enum(DASHBOARD_WIDGET_IDS)).max(15).optional(),
        spans: z
          .record(
            z.enum(DASHBOARD_WIDGET_IDS),
            z.number().int().min(1).max(5).optional()
          )
          .optional(),
        calendarWidgets: z.array(z.enum(CALENDAR_WIDGET_IDS)).max(6).optional(),
        calendarSpans: z
          .record(
            z.enum(CALENDAR_WIDGET_IDS),
            z.number().int().min(1).max(2).optional()
          )
          .optional(),
        chartWidgets: z.array(z.enum(CHART_WIDGET_IDS)).max(25).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Read current preferences once
      const rows = await db
        .select({
          widgetPreferences: userTable.widgetPreferences,
          chartWidgetPreferences: userTable.chartWidgetPreferences,
        })
        .from(userTable)
        .where(eq(userTable.id, userId))
        .limit(1);

      const currentWidgetPrefs = (rows[0]?.widgetPreferences as any) || {};
      const currentChartPrefs = (rows[0]?.chartWidgetPreferences as any) || {};

      // Build new widgetPreferences
      const nextWidgetPrefs = { ...currentWidgetPrefs };

      // Update main widgets if provided
      if (input.widgets !== undefined) {
        nextWidgetPrefs.widgets = input.widgets;
      }
      if (input.spans !== undefined) {
        const cleanedSpans = Object.fromEntries(
          Object.entries(input.spans).filter(
            ([, value]) => typeof value === "number" && Number.isFinite(value)
          )
        );
        nextWidgetPrefs.spans = cleanedSpans;
      }

      // Update calendar widgets if provided
      // IMPORTANT: Only update if calendarWidgets is explicitly provided (not just spans)
      if (input.calendarWidgets !== undefined) {
        const cleanedCalendarSpans = input.calendarSpans
          ? Object.fromEntries(
              Object.entries(input.calendarSpans).filter(
                ([, value]) =>
                  typeof value === "number" && Number.isFinite(value)
              )
            )
          : {};

        nextWidgetPrefs.calendar = {
          widgets: input.calendarWidgets,
          spans: cleanedCalendarSpans,
        };
      }

      // Build new chartWidgetPreferences
      const nextChartPrefs =
        input.chartWidgets !== undefined
          ? { widgets: input.chartWidgets }
          : currentChartPrefs;

      // Single atomic update
      await db
        .update(userTable)
        .set({
          widgetPreferences: nextWidgetPrefs,
          chartWidgetPreferences: nextChartPrefs,
          updatedAt: new Date(),
        })
        .where(eq(userTable.id, userId));

      return { ok: true } as const;
    }),

  updateReportsPreferences: protectedProcedure
    .input(
      z.object({
        lens: z.enum(REPORT_LENS_IDS),
        activePanels: z.array(z.enum(REPORT_PANEL_IDS)).max(8).optional(),
        panelSpans: z
          .record(
            z.enum(REPORT_PANEL_IDS),
            z.number().int().min(1).max(2).optional()
          )
          .optional(),
        heroDimension: z.enum(REPORT_DIMENSION_IDS).optional(),
        heroMetrics: z.array(z.enum(REPORT_METRIC_IDS)).max(3).optional(),
        heroChartType: z.enum(REPORT_CHART_TYPES).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const rows = await db
        .select({ widgetPreferences: userTable.widgetPreferences })
        .from(userTable)
        .where(eq(userTable.id, userId))
        .limit(1);

      const current = (rows[0]?.widgetPreferences as any) || {};
      const currentReports = current.reportsV1 && typeof current.reportsV1 === "object"
        ? current.reportsV1
        : {};
      const currentLensPrefs =
        currentReports[input.lens] && typeof currentReports[input.lens] === "object"
          ? currentReports[input.lens]
          : {};

      const nextLensPrefs = { ...currentLensPrefs };

      if (input.activePanels !== undefined) {
        nextLensPrefs.activePanels = Array.from(new Set(input.activePanels));
      }

      if (input.panelSpans !== undefined) {
        nextLensPrefs.panelSpans = Object.fromEntries(
          Object.entries(input.panelSpans).filter(
            ([, value]) => typeof value === "number" && Number.isFinite(value)
          )
        );
      }

      if (input.heroDimension !== undefined) {
        nextLensPrefs.heroDimension = input.heroDimension;
      }

      if (input.heroMetrics !== undefined) {
        nextLensPrefs.heroMetrics = Array.from(new Set(input.heroMetrics)).slice(
          0,
          3
        );
      }

      if (input.heroChartType !== undefined) {
        nextLensPrefs.heroChartType = input.heroChartType;
      }

      const next = {
        ...current,
        reportsV1: {
          ...currentReports,
          [input.lens]: nextLensPrefs,
        },
      };

      await db
        .update(userTable)
        .set({
          widgetPreferences: next,
          updatedAt: new Date(),
        })
        .where(eq(userTable.id, userId));

      return { ok: true } as const;
    }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        fullName: z.string().min(2),
        username: z.string().min(2),
        email: z.email().optional(),
        image: z.url().optional(),
        twitter: z.string().optional().nullable(),
        discord: z.string().optional().nullable(),
        displayName: z.string().max(50).optional().nullable(),
        bio: z.string().max(500).optional().nullable(),
        location: z.string().max(100).optional().nullable(),
        website: z.string().max(200).optional().nullable(),
        profileBannerUrl: z.string().optional().nullable(),
        profileBannerPosition: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Ensure username uniqueness (if provided)
      if (input.username) {
        const existing = await db
          .select({ id: userTable.id })
          .from(userTable)
          .where(
            and(
              eq(userTable.username, input.username),
              ne(userTable.id, userId)
            )
          )
          .limit(1);
        if (existing[0]) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Username is taken",
          });
        }
      }

      // Ensure email uniqueness (if updating email)
      if (input.email) {
        const existingEmail = await db
          .select({ id: userTable.id })
          .from(userTable)
          .where(
            and(eq(userTable.email, input.email), ne(userTable.id, userId))
          )
          .limit(1);
        if (existingEmail[0]) {
          throw new TRPCError({ code: "CONFLICT", message: "Email is taken" });
        }
      }

      const updates: Partial<{
        name: string;
        username: string | null;
        email: string;
        image: string | null;
        twitter: string | null;
        discord: string | null;
        displayName: string | null;
        bio: string | null;
        location: string | null;
        website: string | null;
        profileBannerUrl: string | null;
        profileBannerPosition: string | null;
        updatedAt: Date;
      }> = {
        name: input.fullName,
        username: input.username,
        updatedAt: new Date(),
      };

      if (input.email) updates.email = input.email;
      if (input.image) updates.image = input.image;
      if (input.twitter !== undefined) updates.twitter = input.twitter;
      if (input.discord !== undefined) updates.discord = input.discord;
      if (input.displayName !== undefined) updates.displayName = input.displayName;
      if (input.bio !== undefined) updates.bio = input.bio;
      if (input.location !== undefined) updates.location = input.location;
      if (input.website !== undefined) updates.website = input.website;
      if (input.profileBannerUrl !== undefined) updates.profileBannerUrl = input.profileBannerUrl;
      if (input.profileBannerPosition !== undefined) updates.profileBannerPosition = input.profileBannerPosition;

      await db.update(userTable).set(updates).where(eq(userTable.id, userId));

      return { ok: true } as const;
    }),

  updateProfileEffects: protectedProcedure
    .input(
      z.object({
        pfpEffect: z
          .enum(["none", "gold_glow", "emerald_pulse", "rainbow_ring", "frost_aura", "shadow_pulse", "electric_spark", "sakura_ring", "neon_pulse", "hearts", "custom"])
          .optional(),
        customRingFrom: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        customRingTo: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        customRingEffect: z.enum(["none", "pulse", "electric", "sakura", "heartbeat"]).optional(),
        nameEffect: z.enum(["none", "sparkle", "glow", "shimmer", "gradient_shift", "breathe"]).optional(),
        nameFont: z
          .enum(["default", "serif", "mono", "display", "handwriting", "gothic", "thin", "rounded"])
          .optional(),
        nameColor: z
          .enum(["default", "gold", "emerald", "ocean", "sunset", "rose", "aurora", "ice", "midnight", "fire", "neon", "custom"])
          .optional(),
        customGradientFrom: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        customGradientTo: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const [row] = await db
        .select({ profileEffects: userTable.profileEffects })
        .from(userTable)
        .where(eq(userTable.id, userId))
        .limit(1);

      const existing = row?.profileEffects ?? {};
      const updated = { ...existing };
      if (input.pfpEffect !== undefined) updated.pfpEffect = input.pfpEffect;
      if (input.nameEffect !== undefined) updated.nameEffect = input.nameEffect;
      if (input.nameFont !== undefined) updated.nameFont = input.nameFont;
      if (input.nameColor !== undefined) updated.nameColor = input.nameColor;
      if (input.customGradientFrom !== undefined) (updated as any).customGradientFrom = input.customGradientFrom;
      if (input.customGradientTo !== undefined) (updated as any).customGradientTo = input.customGradientTo;
      if (input.customRingFrom !== undefined) (updated as any).customRingFrom = input.customRingFrom;
      if (input.customRingTo !== undefined) (updated as any).customRingTo = input.customRingTo;
      if (input.customRingEffect !== undefined) (updated as any).customRingEffect = input.customRingEffect;

      await db
        .update(userTable)
        .set({ profileEffects: updated, updatedAt: new Date() })
        .where(eq(userTable.id, userId));

      return { ok: true, profileEffects: updated } as const;
    }),

  clearImage: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    await db
      .update(userTable)
      .set({ image: "", updatedAt: new Date() })
      .where(eq(userTable.id, userId));
    return { ok: true } as const;
  }),

  getAdvancedMetricsPreferences: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const rows = await db
      .select({
        advancedMetricsPreferences: userTable.advancedMetricsPreferences,
      })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);

    const prefs = rows[0]?.advancedMetricsPreferences as any;

    return {
      disableSampleGating: prefs?.disableSampleGating ?? false,
      alphaWeightedMpe: prefs?.alphaWeightedMpe ?? 0.3,
      manualTradeSizing: prefs?.manualTradeSizing ?? {},
    };
  }),

  getCompliancePreferences: protectedProcedure
    .input(z.object({ accountId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const rows = await db
        .select({
          advancedMetricsPreferences: userTable.advancedMetricsPreferences,
        })
        .from(userTable)
        .where(eq(userTable.id, userId))
        .limit(1);

      const prefs = (rows[0]?.advancedMetricsPreferences as any) || {};
      const rulesByAccount = (prefs.complianceRulesByAccount as any) || {};
      return {
        rules: rulesByAccount[input.accountId] || {},
      };
    }),

  updateAdvancedMetricsPreferences: protectedProcedure
    .input(
      z.object({
        disableSampleGating: z.boolean().optional(),
        alphaWeightedMpe: z.number().min(0.2).max(0.4).optional(),
        manualTradeSizing: manualTradeSizingSchema.optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      // Get current preferences
      const rows = await db
        .select({
          advancedMetricsPreferences: userTable.advancedMetricsPreferences,
        })
        .from(userTable)
        .where(eq(userTable.id, userId))
        .limit(1);

      const currentPrefs = (rows[0]?.advancedMetricsPreferences as any) || {};
      const currentManualTradeSizing =
        (currentPrefs.manualTradeSizing as Record<string, unknown>) || {};
      const nextManualTradeSizing =
        input.manualTradeSizing === undefined
          ? currentManualTradeSizing
          : Object.fromEntries(
              Object.entries(input.manualTradeSizing).map(
                ([assetClass, nextProfile]) => [
                  assetClass,
                  {
                    ...((currentManualTradeSizing[assetClass] as object) || {}),
                    ...(nextProfile || {}),
                  },
                ]
              )
            );

      // Merge with new values
      const updatedPrefs = {
        ...currentPrefs,
        ...(input.disableSampleGating !== undefined && {
          disableSampleGating: input.disableSampleGating,
        }),
        ...(input.alphaWeightedMpe !== undefined && {
          alphaWeightedMpe: input.alphaWeightedMpe,
        }),
        ...(input.manualTradeSizing !== undefined && {
          manualTradeSizing: nextManualTradeSizing,
        }),
      };

      await db
        .update(userTable)
        .set({
          advancedMetricsPreferences: updatedPrefs,
          updatedAt: new Date(),
        })
        .where(eq(userTable.id, userId));

      await createNotification({
        userId,
        type: "settings_updated",
        title: "Advanced metrics updated",
        body: "Advanced metrics preferences have been updated.",
        metadata: {
          updatedFields: Object.keys(input),
        },
      });

      return { ok: true } as const;
    }),

  updateCompliancePreferences: protectedProcedure
    .input(
      z.object({
        accountId: z.string().min(1),
        rules: z.record(z.string(), z.unknown()).default({}),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;
      const rows = await db
        .select({
          advancedMetricsPreferences: userTable.advancedMetricsPreferences,
        })
        .from(userTable)
        .where(eq(userTable.id, userId))
        .limit(1);

      const currentPrefs = (rows[0]?.advancedMetricsPreferences as any) || {};
      const currentRulesByAccount =
        (currentPrefs.complianceRulesByAccount as any) || {};

      const updatedPrefs = {
        ...currentPrefs,
        complianceRulesByAccount: {
          ...currentRulesByAccount,
          [input.accountId]: input.rules || {},
        },
      };

      await db
        .update(userTable)
        .set({
          advancedMetricsPreferences: updatedPrefs,
          updatedAt: new Date(),
        })
        .where(eq(userTable.id, userId));

      await createNotification({
        userId,
        accountId: input.accountId,
        type: "settings_updated",
        title: "Compliance rules updated",
        body: `Compliance rules updated for account ${input.accountId}.`,
        metadata: {
          accountId: input.accountId,
          ruleCount: Object.keys(input.rules || {}).length,
        },
      });

      return { ok: true } as const;
    }),

  /**
   * Achievement System
   * Check and return earned achievements based on trading milestones
   */
  getAchievements: protectedProcedure
    .input(z.object({ accountId: z.string() }).optional())
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Get all user accounts if no specific one
      const accounts = await db
        .select({ id: tradingAccount.id })
        .from(tradingAccount)
        .where(eq(tradingAccount.userId, userId));

      const accountIds = input?.accountId
        ? [input.accountId]
        : accounts.map((a) => a.id);

      if (accountIds.length === 0) {
        return { achievements: [], earned: 0, total: 0, score: 0 };
      }

      // Get all trades across accounts
      const trades = await db
        .select()
        .from(trade)
        .where(inArray(trade.accountId, accountIds));

      const pnls = trades.map((t) => parseFloat(t.profit?.toString() || "0"));
      const totalTrades = trades.length;
      const totalPnl = pnls.reduce((s, p) => s + p, 0);
      const wins = pnls.filter((p) => p > 0).length;
      const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
      const grossWin = pnls.filter((p) => p > 0).reduce((s, p) => s + p, 0);
      const grossLoss = Math.abs(
        pnls.filter((p) => p < 0).reduce((s, p) => s + p, 0)
      );
      const pf = grossLoss > 0 ? grossWin / grossLoss : 0;

      // Streak calculations
      let maxWinStreak = 0;
      let currentWinStreak = 0;
      const sortedPnls = [...trades]
        .sort(
          (a, b) =>
            new Date(a.openTime!).getTime() - new Date(b.openTime!).getTime()
        )
        .map((t) => parseFloat(t.profit?.toString() || "0"));
      for (const p of sortedPnls) {
        if (p > 0) {
          currentWinStreak++;
          maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
        } else currentWinStreak = 0;
      }

      // Daily profits
      const dailyPnls: Record<string, number> = {};
      for (const t of trades) {
        if (!t.openTime) continue;
        const d = new Date(t.openTime).toISOString().split("T")[0];
        dailyPnls[d] =
          (dailyPnls[d] || 0) + parseFloat(t.profit?.toString() || "0");
      }
      let maxGreenStreak = 0;
      let currentGreenStreak = 0;
      const sortedDays = Object.entries(dailyPnls).sort((a, b) =>
        a[0].localeCompare(b[0])
      );
      for (const [, pnl] of sortedDays) {
        if (pnl > 0) {
          currentGreenStreak++;
          maxGreenStreak = Math.max(maxGreenStreak, currentGreenStreak);
        } else currentGreenStreak = 0;
      }

      // Define achievements
      const allAchievements = [
        {
          id: "first_trade",
          name: "First Trade",
          description: "Complete your first trade",
          icon: "🏁",
          check: () => totalTrades >= 1,
        },
        {
          id: "ten_trades",
          name: "Getting Started",
          description: "Complete 10 trades",
          icon: "📊",
          check: () => totalTrades >= 10,
        },
        {
          id: "fifty_trades",
          name: "Committed Trader",
          description: "Complete 50 trades",
          icon: "💪",
          check: () => totalTrades >= 50,
        },
        {
          id: "hundred_trades",
          name: "Centurion",
          description: "Complete 100 trades",
          icon: "🎯",
          check: () => totalTrades >= 100,
        },
        {
          id: "five_hundred_trades",
          name: "Veteran",
          description: "Complete 500 trades",
          icon: "⭐",
          check: () => totalTrades >= 500,
        },
        {
          id: "first_profit",
          name: "In the Green",
          description: "Achieve overall positive P&L",
          icon: "💚",
          check: () => totalPnl > 0,
        },
        {
          id: "fifty_win_rate",
          name: "Edge Found",
          description: "Maintain 50%+ win rate (50+ trades)",
          icon: "📈",
          check: () => winRate >= 50 && totalTrades >= 50,
        },
        {
          id: "sixty_win_rate",
          name: "Sharp Shooter",
          description: "Maintain 60%+ win rate (100+ trades)",
          icon: "🎯",
          check: () => winRate >= 60 && totalTrades >= 100,
        },
        {
          id: "profit_factor_2",
          name: "Double Edge",
          description: "Achieve profit factor above 2.0",
          icon: "💎",
          check: () => pf >= 2 && totalTrades >= 30,
        },
        {
          id: "win_streak_5",
          name: "Hot Streak",
          description: "Win 5 trades in a row",
          icon: "🔥",
          check: () => maxWinStreak >= 5,
        },
        {
          id: "win_streak_10",
          name: "Unstoppable",
          description: "Win 10 trades in a row",
          icon: "🏆",
          check: () => maxWinStreak >= 10,
        },
        {
          id: "green_week",
          name: "Green Week",
          description: "5 consecutive profitable days",
          icon: "📅",
          check: () => maxGreenStreak >= 5,
        },
        {
          id: "green_month",
          name: "Green Month",
          description: "20 consecutive profitable days",
          icon: "🗓️",
          check: () => maxGreenStreak >= 20,
        },
        {
          id: "thousand_pnl",
          name: "First Grand",
          description: "Earn $1,000 in total profit",
          icon: "💰",
          check: () => totalPnl >= 1000,
        },
        {
          id: "ten_k_pnl",
          name: "Five Figures",
          description: "Earn $10,000 in total profit",
          icon: "🤑",
          check: () => totalPnl >= 10000,
        },
      ];

      const earned = allAchievements.filter((a) => a.check());
      const score = earned.length;

      return {
        achievements: allAchievements.map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description,
          icon: a.icon,
          earned: a.check(),
        })),
        earned: earned.length,
        total: allAchievements.length,
        score,
      };
    }),

  // ============== TIMEZONE MANAGEMENT ==============

  updateTimezone: protectedProcedure
    .input(z.object({ timezone: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const rows = await db
        .select({ widgetPreferences: userTable.widgetPreferences })
        .from(userTable)
        .where(eq(userTable.id, userId))
        .limit(1);
      const current = (rows[0]?.widgetPreferences as any) || {};
      await db
        .update(userTable)
        .set({
          widgetPreferences: { ...current, timezone: input.timezone },
          updatedAt: new Date(),
        })
        .where(eq(userTable.id, userId));
      return { ok: true } as const;
    }),

  completeTour: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    await db
      .update(userTable)
      .set({ hasSeenTour: true, updatedAt: new Date() })
      .where(eq(userTable.id, userId));
    return { ok: true } as const;
  }),
});
