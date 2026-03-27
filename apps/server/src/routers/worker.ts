import { z } from "zod";
import { mt5SyncFrameSchema, ingestMt5SyncFrame } from "../lib/mt5/ingestion";
import { assertWorkerSecret } from "../lib/mt5/worker-control";
import { publicProcedure, router } from "../lib/trpc";

export const workerRouter = router({
  ping: publicProcedure
    .input(z.object({ workerSecret: z.string().min(1) }))
    .query(({ input }) => {
      assertWorkerSecret(input.workerSecret);

      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    }),

  ingestMt5Sync: publicProcedure
    .input(
      z.object({
        workerSecret: z.string().min(1),
        frame: mt5SyncFrameSchema,
      })
    )
    .mutation(async ({ input }) => {
      assertWorkerSecret(input.workerSecret);
      return ingestMt5SyncFrame(input.frame);
    }),
});
