import { z } from "zod";

import { protectedProcedure } from "../../lib/trpc";

import {
  getArchivedAccountIds,
  getOwnedAccount,
  getUserWidgetPreferences,
  setArchivedAccountIds,
  updateUserWidgetPreferences,
} from "./shared";

export const toggleArchiveProcedure = protectedProcedure
  .input(
    z.object({
      accountId: z.string().min(1),
      archive: z.boolean(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    await getOwnedAccount(ctx.session.user.id, input.accountId);

    const currentPreferences = await getUserWidgetPreferences(ctx.session.user.id);
    const archivedAccountIds = new Set(getArchivedAccountIds(currentPreferences));

    if (input.archive) {
      archivedAccountIds.add(input.accountId);
    } else {
      archivedAccountIds.delete(input.accountId);
    }

    await updateUserWidgetPreferences(
      ctx.session.user.id,
      setArchivedAccountIds(currentPreferences, [...archivedAccountIds])
    );

    return {
      archivedAccounts: [...archivedAccountIds],
    };
  });

export const getArchivedIdsProcedure = protectedProcedure.query(async ({ ctx }) => {
  const currentPreferences = await getUserWidgetPreferences(ctx.session.user.id);
  return {
    archivedAccounts: getArchivedAccountIds(currentPreferences),
  };
});
