import { AppSidebar } from "@/components/app-sidebar";
import { NavUser } from "@/components/nav-user";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import { TopWidgets, type WidgetType } from "@/components/dashboard/TopWidgets";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import Image from "next/image";

import { DashboardActionButtons } from "@/components/dashboard/dashboard-action-buttons";

import { Separator } from "@/components/ui/separator";
import ThemeSwitcher from "@/components/ThemeSwitch";

const data = {
  user: {
    name: "kalcryptev",
    email: "kalcryptev@gmail.com",
    avatar: "/avatars/pfp.jpg",
  },
};

// User's selected top 4 widgets - replace with database/API call later
const userEnabledWidgets: WidgetType[] = [
  "account-balance",
  "win-rate",
  "profit-factor",
  "win-streak",
];

export default function Page() {
  return (
    <SidebarProvider className="h-[200vh] relative">
      <AppSidebar />
      <SidebarInset className=" bg-white dark:bg-dashboard-background py-2 h-full flex flex-col gap-4 border-[0.5px] border-black/10 dark:border-white/10">
        <div className="flex flex-col">
          <header className="flex h-[3.725rem] shrink-0 items-center gap-2 bg-white dark:bg-dashboard-background rounded-t-[8px] px-8">
            <div className="flex items-center gap-2 w-full">
              <SidebarTrigger className=" -ml-1 cursor-pointer" />

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

            <div className="flex gap-2 items-center">
              <ThemeSwitcher />

              <NavUser user={data.user} />
            </div>
          </header>

          <Separator />
        </div>

        {/* Dashboard overview */}

        <div className="flex flex-col w-full h-full gap-4 px-8">
          {/* Welcome message + buttons  */}
          <div className="w-full flex shrink-0 items-center justify-between">
            {/* Welcome message */}
            <div className="flex w-full items-center gap-2 text-xl tracking-tight text-secondary dark:text-neutral-200">
              <h1 className="text-secondary font-medium"> Welcome back, </h1>

              <h1 className="flex items-center gap-1.5">
                <div className="size-7 relative">
                  <Image
                    src={data.user.avatar}
                    alt={data.user.avatar}
                    fill
                    className="rounded-full"
                  />
                </div>

                <span className="font-semibold text-black dark:text-white">
                  {" "}
                  {data.user.name}{" "}
                </span>
              </h1>
            </div>

            {/*  */}

            <DashboardActionButtons />
          </div>

          {/* Widgets */}

          <div className="flex flex-1 flex-col gap-4 pt-0">
            {/* Top widgets */}
            <TopWidgets enabledWidgets={userEnabledWidgets} />

            <div className="bg-muted/50 dark:bg-neutral-900 min-h-[100vh] flex-1 rounded-xl md:min-h-min" />
          </div>
        </div>

        {/* Example sections */}
      </SidebarInset>
    </SidebarProvider>
  );
}
