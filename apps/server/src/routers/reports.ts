import {
  REPORT_DIMENSION_IDS,
  REPORT_LENS_CONFIG,
  REPORT_LENS_IDS,
  REPORT_PANEL_IDS,
} from "@profitabledge/contracts/reports";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { protectedProcedure, router } from "../lib/trpc";
import {
  getReportsBreakdownTable,
  getReportsHeroChart,
  getReportsLensOverview,
  getReportsPanelData,
} from "../lib/reports/engine";

const reportLensSchema = z.enum(REPORT_LENS_IDS);
const reportDimensionSchema = z.enum(REPORT_DIMENSION_IDS);
const reportPanelSchema = z.enum(REPORT_PANEL_IDS);

const reportFilterInputSchema = z.object({
  accountId: z.string().min(1),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  symbols: z.array(z.string()).optional(),
  sessionTags: z.array(z.string()).optional(),
  modelTags: z.array(z.string()).optional(),
  customTags: z.array(z.string()).optional(),
  accountTags: z.array(z.string()).optional(),
  currencyCode: z.string().nullable().optional(),
  timezone: z.string().nullable().optional(),
});

const reportDrilldownSchema = z
  .object({
    dimension: reportDimensionSchema,
    value: z.string().min(1),
  })
  .nullable();

function assertLensDimension(lens: z.infer<typeof reportLensSchema>, dimension: z.infer<typeof reportDimensionSchema>) {
  if (!REPORT_LENS_CONFIG[lens].allowedDimensions.some((item) => item === dimension)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Dimension ${dimension} is not allowed for ${lens}`,
    });
  }
}

export const reportsRouter = router({
  getLensOverview: protectedProcedure
    .input(
      reportFilterInputSchema.extend({
        lens: reportLensSchema,
        dimension: reportDimensionSchema,
        drilldown: reportDrilldownSchema.default(null),
      })
    )
    .query(async ({ ctx, input }) => {
      assertLensDimension(input.lens, input.dimension);
      return getReportsLensOverview(ctx.session.user.id, input);
    }),

  getHeroChart: protectedProcedure
    .input(
      reportFilterInputSchema.extend({
        lens: reportLensSchema,
        dimension: reportDimensionSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      assertLensDimension(input.lens, input.dimension);
      return getReportsHeroChart(ctx.session.user.id, input);
    }),

  getBreakdownTable: protectedProcedure
    .input(
      reportFilterInputSchema.extend({
        lens: reportLensSchema,
        dimension: reportDimensionSchema,
      })
    )
    .query(async ({ ctx, input }) => {
      assertLensDimension(input.lens, input.dimension);
      return getReportsBreakdownTable(ctx.session.user.id, input);
    }),

  getPanelData: protectedProcedure
    .input(
      reportFilterInputSchema.extend({
        lens: reportLensSchema,
        panelId: reportPanelSchema,
        drilldown: reportDrilldownSchema.default(null),
      })
    )
    .query(async ({ ctx, input }) => {
      return getReportsPanelData(ctx.session.user.id, input);
    }),
});
