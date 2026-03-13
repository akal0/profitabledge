import { useQuery } from "@tanstack/react-query";
import { trpcOptions } from "@/utils/trpc";

export type AccountCatalogItem = {
  id: string;
  name: string;
  broker: string;
  brokerServer?: string | null;
  accountNumber?: string | null;
  isPropAccount?: boolean;
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
