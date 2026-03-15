import { useQuery } from "@tanstack/react-query";
import { trpcOptions } from "@/utils/trpc";

export type AccountCatalogItem = {
  id: string;
  name: string;
  broker: string;
  brokerType?: string | null;
  brokerServer?: string | null;
  accountNumber?: string | null;
  initialCurrency?: string | null;
  isPropAccount?: boolean;
  isVerified?: number | boolean | null;
  verificationLevel?: string | null;
  lastSyncedAt?: string | Date | null;
  lastImportedAt?: string | Date | null;
  createdAt?: string | Date;
};

type UseAccountCatalogOptions = {
  enabled?: boolean;
  staleTime?: number;
};

export function useAccountCatalog({
  enabled,
  staleTime = 30_000,
}: UseAccountCatalogOptions = {}) {
  const query = useQuery({
    ...trpcOptions.accounts.list.queryOptions(),
    enabled,
    staleTime,
  });

  return {
    ...query,
    accounts: (query.data as AccountCatalogItem[] | undefined) ?? [],
  };
}
