"use client";

import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  CreditCard,
  LogOut,
  Sparkles,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { writeDesktopSessionBootstrap } from "@/lib/desktop-session-bootstrap";
import { trpcOptions } from "@/utils/trpc";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Separator } from "./ui/separator";
import { Button } from "./ui/button";

import AccountSwitch from "@/public/graphics/profile/account-switch.svg";

import Cmd from "@/public/graphics/cmd.svg";
import type { PlanKey } from "@/features/navigation/config/nav-sections";

type Me = {
  name: string;
  email: string;
  image: string | null;
  createdAt: string;
  updatedAt: string;
  emailVerified: boolean;
  username: string | null;
};

function getPlanTitle(planKey: PlanKey) {
  switch (planKey) {
    case "professional":
      return "Professional";
    case "institutional":
      return "Institutional";
    default:
      return "Student";
  }
}

function getNextPlanKey(planKey: PlanKey): PlanKey | null {
  switch (planKey) {
    case "student":
      return "professional";
    case "professional":
      return "institutional";
    default:
      return null;
  }
}

function getUpgradeOfferLabel(planKey: PlanKey | null) {
  switch (planKey) {
    case "professional":
      return "10% off";
    case "institutional":
      return "15% off";
    default:
      return null;
  }
}

function getPlanBadgeClassName(planKey: PlanKey) {
  switch (planKey) {
    case "professional":
      return "ring ring-blue-500/20 bg-blue-500/10 text-blue-300";
    case "institutional":
      return "ring ring-emerald-500/20 bg-emerald-500/10 text-emerald-300";
    default:
      return "ring ring-white/10 bg-white/5 text-white/70";
  }
}

const NavUser: React.FC<{ user: Me }> = ({ user }) => {
  const { isMobile, state } = useSidebar();
  const isCollapsed = state === "collapsed" && !isMobile;
  const router = useRouter();
  const { data: billingState } = useQuery(
    trpcOptions.billing.getState.queryOptions()
  );
  const currentPlan = (billingState?.billing?.activePlanKey ??
    "student") as PlanKey;
  const nextPlan = getNextPlanKey(currentPlan);
  const currentPlanTitle = getPlanTitle(currentPlan);
  const nextPlanTitle = nextPlan ? getPlanTitle(nextPlan) : null;
  const upgradeOfferLabel = getUpgradeOfferLabel(nextPlan);
  const currentPlanBadgeClassName = getPlanBadgeClassName(currentPlan);
  const nextPlanBadgeClassName = nextPlan
    ? getPlanBadgeClassName(nextPlan)
    : null;

  const handleSignOut = () => {
    authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          writeDesktopSessionBootstrap({
            authenticated: false,
            pending: false,
            user: null,
          });
          router.push("/login");
        },
      },
    });
  };

  return (
    <SidebarMenu className={cn(isCollapsed && "items-center")}>
      <SidebarMenuItem className={cn("w-full", isCollapsed && "flex justify-center")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              className={cn(
                "!h-auto cursor-pointer items-center gap-2.5 shadow-primary-button shadow-sm ring-1! ring-white/5",
                isCollapsed
                  ? "!size-auto !w-auto rounded-full !bg-transparent !p-0 shadow-none ring-0 hover:!bg-transparent focus:!bg-transparent dark:!bg-transparent dark:hover:!bg-transparent dark:focus:!bg-transparent"
                  : "rounded-lg bg-white px-2 py-1.5 hover:bg-white focus:bg-white dark:bg-sidebar dark:hover:bg-sidebar dark:hover:brightness-110 dark:focus:bg-sidebar"
              )}
            >
              <Avatar
                className={cn(
                  "rounded-full shrink-0 shadow-secondary",
                  isCollapsed ? "size-8" : "size-7"
                )}
              >
                {user.image ? (
                  <AvatarImage
                    src={user.image}
                    alt={user.name}
                    className="object-cover"
                  />
                ) : null}
                <AvatarFallback
                  className="rounded-full text-[10px] bg-sidebar-accent text-foreground font-semibold"
                  delayMs={0}
                >
                  {user.name?.charAt(0)?.toUpperCase() ?? "U"}
                </AvatarFallback>
              </Avatar>

              <div className="flex flex-col min-w-0 group-data-[collapsible=icon]:hidden">
                <span className="text-xs font-semibold truncate text-foreground">
                  {user.name}
                </span>
                <span className="text-[10px] truncate text-muted-foreground">
                  {user.email}
                </span>
              </div>

              <ChevronsUpDown className="ml-auto size-3.5 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) bg-sidebar-accent/10 min-w-80 rounded-lg p-1 flex flex-col gap-2 ring ring-white/5 border-none! backdrop-blur-xl"
            side={isMobile ? "bottom" : "right"}
            align="start"
            sideOffset={24}
          >
            <div className="flex-1 flex flex-col rounded-sm bg-sidebar-accent brightness-110 ring ring-white/5 pb-1">
              <DropdownMenuLabel className="p-3 font-normal flex justify-between items-start">
                <div className="flex items-center gap-3  text-left text-sm h-full">
                  <Avatar className="size-10 rounded-full shadow-secondary-button">
                    {user.image ? (
                      <AvatarImage
                        src={user.image}
                        alt={user.name}
                        className="object-cover"
                      />
                    ) : null}
                    <AvatarFallback
                      className="rounded-lg bg-sidebar text-foreground font-semibold"
                      delayMs={0}
                    >
                      {user.name?.charAt(0)?.toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>

                  <div className="grid text-left text-xs leading-tight gap-0.5">
                    <span className="truncate font-semibold text-sm">
                      {user.name}
                    </span>

                    <span className="truncate font-medium text-secondary">
                      {user.email}
                    </span>
                  </div>
                </div>

                <Badge
                  className={cn(
                    "rounded px-2 py-1 text-[10px] font-medium",
                    currentPlanBadgeClassName
                  )}
                >
                  {currentPlanTitle}
                </Badge>
              </DropdownMenuLabel>

              <div className="my-1">
                <Separator />
              </div>

              <DropdownMenuGroup className="px-1">
                <DropdownMenuItem
                  asChild
                  className="text-xs px-2 pl-4 cursor-pointer focus:bg-sidebar-accent focus:brightness-120 flex items-center gap-3"
                >
                  <Link href="/dashboard/settings/profile">
                    <BadgeCheck className="size-3" />
                    <p> Account </p>
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem
                  asChild
                  className="text-xs px-2 pl-4 cursor-pointer focus:bg-sidebar-accent focus:brightness-120 flex items-center gap-3"
                >
                  <Link href="/dashboard/settings/billing">
                    <CreditCard className="size-3" />
                    <p> Billing </p>
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem
                  asChild
                  className="text-xs px-2 pl-4 cursor-pointer focus:bg-sidebar-accent focus:brightness-120 flex items-center gap-3"
                >
                  <Link href="/dashboard/settings/notifications">
                    <Bell className="size-3" />
                    <p> Notifications </p>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>

              <div className="my-1">
                <Separator />
              </div>

              {nextPlanTitle && upgradeOfferLabel && nextPlanBadgeClassName ? (
                <>
                  <DropdownMenuGroup className="px-1">
                    <DropdownMenuItem
                      asChild
                      className="justify-between px-2 pl-4 cursor-pointer focus:bg-sidebar-accent focus:brightness-120"
                    >
                      <Link href="/dashboard/settings/billing">
                        <div className="flex items-center gap-3 text-xs">
                          <Sparkles className="size-3" />
                          {`Upgrade to ${nextPlanTitle}`}
                        </div>

                        <Badge
                          className={cn(
                            "rounded px-2 py-1 text-[10px] font-medium",
                            nextPlanBadgeClassName
                          )}
                        >
                          {upgradeOfferLabel}
                        </Badge>
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>

                  <div className="my-1">
                    <Separator />
                  </div>
                </>
              ) : null}

              <DropdownMenuGroup className="px-1">
                <DropdownMenuItem className="justify-between px-2 pl-4 cursor-pointer focus:bg-sidebar-accent focus:brightness-120 rounded-sm">
                  <div className="flex items-center gap-3 text-xs">
                    <AccountSwitch className="size-3.5 stroke-white" />
                    Switch trading account
                  </div>

                  <Button className="cursor-pointer shadow-primary-button rounded-[6px] gap-1 h-max py-2 transition-all active:scale-95 bg-sidebar-accent hover:bg-sidebar-accent text-white w-max text-[10px] hover:!brightness-110 duration-250">
                    <Cmd className="size-2 stroke-white fill-transparent" />
                    <span className=""> O </span>
                  </Button>
                </DropdownMenuItem>
              </DropdownMenuGroup>

              <div className="my-1">
                <Separator />
              </div>

              <DropdownMenuGroup className="px-1">
                <DropdownMenuItem
                  className="text-xs px-2 pl-4 cursor-pointer focus:bg-sidebar-accent focus:brightness-120 flex items-center gap-3 py-3"
                  onSelect={handleSignOut}
                >
                  <LogOut className="size-3" />
                  <p> Sign out </p>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};

export default NavUser;
