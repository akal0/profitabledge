"use client";

import { useRouter } from "next/navigation";

import {
  Tabs,
  TabsListUnderlined,
  TabsTriggerUnderlined,
} from "@/components/ui/tabs";

type GrowthRouteTab = "growth" | "growth-admin";

const GROWTH_ROUTE_TABS: Record<
  GrowthRouteTab,
  { label: string; href: string }
> = {
  growth: {
    label: "Growth",
    href: "/dashboard/growth",
  },
  "growth-admin": {
    label: "Growth admin",
    href: "/dashboard/growth-admin",
  },
};

export function GrowthRouteTabs({
  activeTab,
}: {
  activeTab: GrowthRouteTab;
}) {
  const router = useRouter();

  return (
    <div className="overflow-x-auto px-6 sm:px-8">
      <Tabs
        value={activeTab}
        onValueChange={(value) =>
          router.push(
            GROWTH_ROUTE_TABS[value as GrowthRouteTab]?.href ??
              GROWTH_ROUTE_TABS.growth.href
          )
        }
      >
        <TabsListUnderlined className="flex h-auto min-w-full items-stretch gap-5 border-b-0">
          {(
            Object.entries(GROWTH_ROUTE_TABS) as Array<
              [GrowthRouteTab, (typeof GROWTH_ROUTE_TABS)[GrowthRouteTab]]
            >
          ).map(([value, tab]) => (
            <TabsTriggerUnderlined
              key={value}
              value={value}
              className="h-10 pb-0 pt-0 text-xs font-medium text-white/40 hover:text-white/75 data-[state=active]:border-white data-[state=active]:text-white"
            >
              {tab.label}
            </TabsTriggerUnderlined>
          ))}
        </TabsListUnderlined>
      </Tabs>
    </div>
  );
}
