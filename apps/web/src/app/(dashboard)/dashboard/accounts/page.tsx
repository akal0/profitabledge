"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Archive, Building2, Trophy } from "lucide-react";

import {
  AccountsEmptyState,
  SectionHeader,
} from "@/features/accounts/components/account-section-shell";
import type { AccountRecord } from "@/features/accounts/components/account-section-shell";
import {
  ArchivedAccountCard,
  BrokerAccountCard,
  PropAccountCard,
  isCurrentPropStageAccount,
} from "@/features/accounts/components/account-cards";
import { WidgetLoading } from "@/components/dashboard/widget-wrapper";
import { queryClient, trpcOptions } from "@/utils/trpc";

export default function AccountsPage() {
  const { data: accounts, isLoading } = useQuery(
    trpcOptions.accounts.list.queryOptions()
  );
  const { data: archivedData } = useQuery(
    trpcOptions.accounts.getArchivedIds.queryOptions()
  );
  const [showArchived, setShowArchived] = useState(false);

  const archivedIds = new Set<string>(archivedData?.archivedAccounts || []);
  const allBrokerAccounts =
    accounts?.filter((account: AccountRecord) => !account.isPropAccount) || [];
  const allPropAccounts =
    accounts?.filter((account: AccountRecord) =>
      isCurrentPropStageAccount(account)
    ) || [];

  const brokerAccounts = allBrokerAccounts.filter(
    (account: AccountRecord) => !archivedIds.has(account.id)
  );
  const propAccounts = allPropAccounts.filter(
    (account: AccountRecord) => !archivedIds.has(account.id)
  );
  const archivedAccounts = (accounts || []).filter((account: AccountRecord) =>
    archivedIds.has(account.id)
  );

  const handleAccountCreated = () => {
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
  };

  if (isLoading) {
    return (
      <main className="space-y-5 p-6 py-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((key) => (
            <WidgetLoading key={key} />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-5 p-6 py-4">
      <section className="space-y-3">
        <SectionHeader
          icon={Building2}
          label="Broker accounts"
          count={brokerAccounts.length}
        />

        {brokerAccounts.length === 0 ? (
          <AccountsEmptyState
            icon={Building2}
            title="No broker accounts"
            description="Add your first broker account to start tracking balances, syncs, and trade history."
            ctaLabel="Add broker account"
            onAccountCreated={handleAccountCreated}
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {brokerAccounts.map((account: AccountRecord) => (
              <BrokerAccountCard key={account.id} account={account} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeader
          icon={Trophy}
          label="Prop accounts"
          count={propAccounts.length}
        />

        {propAccounts.length === 0 ? (
          <AccountsEmptyState
            icon={Trophy}
            title="No prop accounts"
            description="Recognized prop brokers now classify automatically. Add one to start challenge tracking."
            ctaLabel="Add prop account"
            onAccountCreated={handleAccountCreated}
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {propAccounts.map((account: AccountRecord) => (
              <PropAccountCard key={account.id} account={account} />
            ))}
          </div>
        )}
      </section>

      {archivedAccounts.length > 0 ? (
        <section className="space-y-3">
          <SectionHeader
            icon={Archive}
            label="Archived"
            count={archivedAccounts.length}
            action={
              <button
                type="button"
                onClick={() => setShowArchived((current) => !current)}
                className="text-[11px] text-white/35 transition-colors hover:text-white/70"
              >
                {showArchived ? "Hide" : "Show"}
              </button>
            }
          />

          {showArchived ? (
            <div className="grid gap-3 opacity-70 md:grid-cols-2 xl:grid-cols-3">
              {archivedAccounts.map((account: AccountRecord) => (
                <ArchivedAccountCard key={account.id} account={account} />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
