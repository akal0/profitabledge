import type { trpcClient } from "@/utils/trpc";

export type Me = Awaited<ReturnType<typeof trpcClient.users.me.query>>;
