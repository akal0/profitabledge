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
import {
  Tabs,
  TabsContent,
  TabsListUnderlined,
  TabsTriggerUnderlined,
} from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

export default function AccountsPage() {
  const { data: accounts, isLoading } = useQuery(
    trpcOptions.accounts.list.queryOptions()
  );
  const { data: archivedData } = useQuery(
    trpcOptions.accounts.getArchivedIds.queryOptions()
  );
  const [showArchivedBroker, setShowArchivedBroker] = useState(false);
  const [showArchivedProp, setShowArchivedProp] = useState(false);
  const [activeTab, setActiveTab] = useState("broker");

  const archivedIds = new Set<string>(archivedData?.archivedAccounts || []);

  const brokerAccounts =
    accounts?.filter(
      (a: AccountRecord) => !a.isPropAccount && !archivedIds.has(a.id)
    ) || [];
  const propAccounts =
    accounts?.filter(
      (a: AccountRecord) =>
        isCurrentPropStageAccount(a) && !archivedIds.has(a.id)
    ) || [];
  const archivedBrokerAccounts =
    accounts?.filter(
      (a: AccountRecord) => !a.isPropAccount && archivedIds.has(a.id)
    ) || [];
  const archivedPropAccounts =
    accounts?.filter(
      (a: AccountRecord) => a.isPropAccount && archivedIds.has(a.id)
    ) || [];

  const handleAccountCreated = () => {
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
  };

  if (isLoading) {
    return (
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((key) => (
            <WidgetLoading key={key} />
          ))}
        </div>
      </main>
    );
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="flex min-h-screen flex-1 flex-col"
    >
      <div className="shrink-0 bg-sidebar! dark:bg-sidebar!">
        <div className="overflow-x-auto px-4 sm:px-6 lg:px-8">
          <TabsListUnderlined className="flex h-auto min-w-full items-stretch gap-5 border-b-0">
            <TabsTriggerUnderlined
              value="broker"
              className="h-10 pb-0 pt-0 text-xs font-medium text-secondary dark:text-neutral-400 hover:text-secondary dark:hover:text-neutral-200 data-[state=active]:border-teal-400 data-[state=active]:text-teal-400"
            >
              Broker accounts
            </TabsTriggerUnderlined>
            <TabsTriggerUnderlined
              value="prop"
              className="h-10 pb-0 pt-0 text-xs font-medium text-secondary dark:text-neutral-400 hover:text-secondary dark:hover:text-neutral-200 data-[state=active]:border-teal-400 data-[state=active]:text-teal-400"
            >
              Prop accounts
            </TabsTriggerUnderlined>
          </TabsListUnderlined>
        </div>
        <Separator />
      </div>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <TabsContent
          value="broker"
          className="mt-0 min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8"
        >
          <div className="space-y-5">
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

            {archivedBrokerAccounts.length > 0 ? (
              <section className="space-y-3">
                <SectionHeader
                  icon={Archive}
                  label="Archived"
                  count={archivedBrokerAccounts.length}
                  action={
                    <button
                      type="button"
                      onClick={() =>
                        setShowArchivedBroker((current) => !current)
                      }
                      className="text-[11px] text-white/35 transition-colors hover:text-white/70"
                    >
                      {showArchivedBroker ? "Hide" : "Show"}
                    </button>
                  }
                />
                {showArchivedBroker ? (
                  <div className="grid gap-3 opacity-70 md:grid-cols-2 xl:grid-cols-3">
                    {archivedBrokerAccounts.map((account: AccountRecord) => (
                      <ArchivedAccountCard key={account.id} account={account} />
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent
          value="prop"
          className="mt-0 min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8"
        >
          <div className="space-y-5">
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

            {archivedPropAccounts.length > 0 ? (
              <section className="space-y-3">
                <SectionHeader
                  icon={Archive}
                  label="Archived"
                  count={archivedPropAccounts.length}
                  action={
                    <button
                      type="button"
                      onClick={() => setShowArchivedProp((current) => !current)}
                      className="text-[11px] text-white/35 transition-colors hover:text-white/70"
                    >
                      {showArchivedProp ? "Hide" : "Show"}
                    </button>
                  }
                />
                {showArchivedProp ? (
                  <div className="grid gap-3 opacity-70 md:grid-cols-2 xl:grid-cols-3">
                    {archivedPropAccounts.map((account: AccountRecord) => (
                      <ArchivedAccountCard key={account.id} account={account} />
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>
        </TabsContent>
      </main>
    </Tabs>
  );
}
