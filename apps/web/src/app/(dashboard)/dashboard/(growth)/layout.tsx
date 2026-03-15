"use client";

import { useSelectedLayoutSegment } from "next/navigation";

import { Separator } from "@/components/ui/separator";
import { GrowthRouteTabs } from "@/features/growth/components/growth-route-tabs";
import { trpc } from "@/utils/trpc";

export default function GrowthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const segment = useSelectedLayoutSegment();
  const billingStateQuery = trpc.billing.getState.useQuery();
  const isAdmin = billingStateQuery.data?.admin?.isAdmin === true;

  return (
    <div className="flex w-full flex-col">
      {isAdmin ? (
        <>
          <GrowthRouteTabs
            activeTab={segment === "growth-admin" ? "growth-admin" : "growth"}
          />
          <Separator />
        </>
      ) : null}
      {children}
    </div>
  );
}
