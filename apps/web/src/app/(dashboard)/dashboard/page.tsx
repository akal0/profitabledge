"use client";

import { AppSidebar } from "@/components/app-sidebar";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import { Widgets, type WidgetType } from "@/components/dashboard/TopWidgets";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import Image from "next/image";

import DashboardActionButtons from "@/components/dashboard/dashboard-action-buttons";

import { Separator, VerticalSeparator } from "@/components/ui/separator";
import ThemeSwitcher from "@/components/ThemeSwitch";
import { trpcClient } from "@/utils/trpc";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserIcon } from "lucide-react";
import { useAccountStore } from "@/stores/account";
import type { Me } from "@/types/user";
import { Skeleton } from "@/components/ui/skeleton";
import NavUser from "@/components/nav-user";
import Calendar from "@/components/dashboard/calendar/calendar";
import {
  ChartWidgets,
  type ChartWidgetType,
} from "@/components/dashboard/ChartWidgets";

// Default widgets (fallback)
const defaultWidgets: WidgetType[] = [
  "account-balance",
  "win-rate",
  "profit-factor",
  "win-streak",
];

const defaultChartWidgets: ChartWidgetType[] = ["daily", "performance"];

export default function Page() {
  const getInfo = async () => {
    const me = await trpcClient.users.me.query();

    return me;
  };

  const [me, setMe] = useState<Me | null>(null);
  const [widgets, setWidgets] = useState<WidgetType[]>(defaultWidgets);
  const [chartWidgets, setChartWidgets] =
    useState<ChartWidgetType[]>(defaultChartWidgets);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    (async () => {
      const data = await getInfo();
      setMe(data);
      const fromDb = (data as any)?.widgetPreferences?.widgets as
        | WidgetType[]
        | undefined;
      if (fromDb && Array.isArray(fromDb) && fromDb.length > 0) {
        setWidgets(fromDb.slice(0, 12));
      }
    })();
  }, []);
  const toggleWidget = (type: WidgetType) => {
    setWidgets((prev) => {
      const exists = prev.includes(type);
      if (exists) {
        return prev.filter((w) => w !== type);
      }
      if (prev.length >= 12) return prev; // cap 12
      return [...prev, type];
    });
  };

  const reorderWidgets = (fromIndex: number, toIndex: number) => {
    setWidgets((prev) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex >= prev.length
      )
        return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const toggleChartWidget = (type: ChartWidgetType) => {
    setChartWidgets((prev) => {
      const exists = prev.includes(type);
      if (exists) {
        return prev.filter((w) => w !== type);
      }
      if (prev.length >= 12) return prev;
      return [...prev, type];
    });
  };

  const reorderChartWidgets = (fromIndex: number, toIndex: number) => {
    setChartWidgets((prev) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex >= prev.length
      )
        return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const saveWidgets = async () => {
    try {
      await trpcClient.users.updateWidgetPreferences.mutate({ widgets });
    } catch (e) {
      console.error(e);
    }
  };

  const accountId = useAccountStore((s) => s.selectedAccountId);

  return (
    <SidebarProvider className="h-[200vh] relative">
      <AppSidebar />
      <VerticalSeparator />

      <SidebarInset className="bg-white dark:bg-sidebar py-2 h-full flex flex-col gap-6 ">
        <div className="flex flex-col">
          <header className="flex h-[3.725rem] shrink-0 items-center gap-2 bg-white dark:bg-sidebar rounded-t-[8px] px-8">
            <div className="flex items-center gap-2 w-full">
              {/* <SidebarTrigger className=" -ml-1 cursor-pointer" /> */}
            </div>

            <div className="flex gap-2 items-center">
              <ThemeSwitcher />
            </div>
          </header>

          <Separator />

          <div className="px-8 py-4">
            <Breadcrumb>
              <BreadcrumbList className="text-xs text-secondary dark:text-neutral-400">
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink className="hover:text-secondary text-secondary dark:text-neutral-300 font-medium">
                    Dashboard
                  </BreadcrumbLink>
                </BreadcrumbItem>

                <BreadcrumbSeparator className="hidden md:block" />

                <BreadcrumbItem>
                  <BreadcrumbPage className="font-medium text-secondary dark:text-neutral-200">
                    {" "}
                    Overview{" "}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          <Separator />
        </div>

        {/* Dashboard overview */}

        <div className="flex flex-col w-full h-full gap-4 px-8">
          {/* Welcome message + buttons  */}
          <div className="w-full flex shrink-0 items-center justify-between">
            {/* Welcome message */}
            <div className="flex w-full items-center gap-2 text-xl tracking-tight text-secondary dark:text-neutral-200">
              <h1 className="text-secondary font-medium"> Welcome back, </h1>

              <h1 className="flex items-center gap-2">
                <Avatar className="shadow-sidebar-button size-7">
                  <AvatarImage
                    src={me?.image ?? ""}
                    alt={me?.name ?? ""}
                    className="object-cover"
                  />
                  <AvatarFallback>
                    <Skeleton className="size-7 rounded-full" />
                  </AvatarFallback>
                </Avatar>

                <span className="font-semibold text-black dark:text-white">
                  {" "}
                  {me?.username ?? <Skeleton className="w-32 h-7" />}{" "}
                </span>
              </h1>
            </div>

            {/*  */}

            <DashboardActionButtons
              user={me ?? null}
              isEditing={isEditing}
              onToggleEdit={async () => {
                // if toggling off, persist
                setIsEditing((prev) => {
                  const next = !prev;
                  if (prev && !next) {
                    // exiting edit mode -> save
                    void saveWidgets();
                  }
                  return next;
                });
              }}
            />
          </div>

          {/* Widgets */}

          <div className="flex flex-1 flex-col gap-8">
            {/* Widgets */}
            <Widgets
              enabledWidgets={widgets}
              accountId={accountId}
              isEditing={isEditing}
              onToggleWidget={toggleWidget}
              onReorder={reorderWidgets}
              onEnterEdit={() => setIsEditing(true)}
            />

            {/* Calendar */}

            <Calendar accountId={accountId} />

            {/* Chart widgets */}

            <ChartWidgets
              accountId={accountId}
              enabledWidgets={chartWidgets}
              isEditing={isEditing}
              onToggleWidget={toggleChartWidget}
              onReorder={reorderChartWidgets}
              onEnterEdit={() => setIsEditing(true)}
            />
          </div>
        </div>

        {/* Example sections */}
      </SidebarInset>
    </SidebarProvider>
  );
}
