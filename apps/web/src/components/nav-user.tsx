"use client";

import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  CreditCard,
  LogOut,
  Settings2,
  Sparkles,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import Image from "next/image";
import { Separator } from "./ui/separator";
import { Button } from "./ui/button";

import AccountSwitch from "@/public/graphics/profile/account-switch.svg";

import Cmd from "@/public/graphics/cmd.svg";

export function NavUser({
  user,
}: {
  user: {
    name: string;
    email: string;
    avatar: string;
  };
}) {
  const { isMobile } = useSidebar();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="p-1 flex gap-1 cursor-pointer bg-white dark:bg-sidebar shadow-sidebar-button hover:bg-white dark:hover:brightness-110 focus:bg-white dark:hover:bg-sidebar dark:focus:bg-sidebar rounded-full ml-auto size-9 items-center justify-center"
            >
              <Avatar className="size-7 relative rounded-full bg-white">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-full bg-white">
                  <Image src="/pfp.jpg" alt="fallback-avatar" fill />
                </AvatarFallback>
              </Avatar>
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) bg-sidebar-accent min-w-88 rounded-xl px-0 flex flex-col pt-0 gap-2 border-[0.5px] border-white/10"
            side={isMobile ? "bottom" : "bottom"}
            align="end"
            sideOffset={4}
          >
            <div className="flex-1 flex flex-col rounded-xl bg-sidebar-accent brightness-120 shadow-sidebar-button pb-1 border-b-[0.5px] border-white/10">
              <DropdownMenuLabel className="p-3 font-normal flex justify-between items-start">
                <div className="flex items-center gap-3  text-left text-sm h-full">
                  <Avatar className="size-10 rounded-full">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="rounded-lg">User</AvatarFallback>
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

                <div className="flex flex-col gap-1">
                  <Button className="cursor-pointer shadow-secondary-button rounded-[6px] gap-2 h-max py-1 px-4 transition-all active:scale-95 bg-indigo-700 hover:bg-indigo-700 text-white w-max text-[10px] hover:!brightness-110 duration-250">
                    <span className=""> Hobbyist </span>
                  </Button>
                </div>
              </DropdownMenuLabel>

              <div className="my-1">
                <Separator />
              </div>

              <DropdownMenuGroup className="px-1">
                <DropdownMenuItem className="text-xs px-2 pl-4 cursor-pointer focus:bg-sidebar-accent focus:brightness-120">
                  <BadgeCheck className="size-3" />
                  Account
                </DropdownMenuItem>

                <DropdownMenuItem className="text-xs px-2 pl-4 cursor-pointer focus:bg-sidebar-accent focus:brightness-120">
                  <Settings2 className="size-3" />
                  Settings
                </DropdownMenuItem>
              </DropdownMenuGroup>

              <div className="my-1">
                <Separator />
              </div>

              <DropdownMenuGroup className="px-1">
                <DropdownMenuItem className="justify-between px-2 pl-4 cursor-pointer focus:bg-sidebar-accent focus:brightness-120">
                  <div className="flex items-center gap-3 text-xs">
                    <Sparkles className="size-3" />
                    Upgrade to Pro
                  </div>

                  <Button className="cursor-pointer shadow-secondary-button rounded-[6px] gap-2 h-max py-1 px-4 transition-all active:scale-95 bg-emerald-800 hover:bg-emerald-800 text-white w-max text-[10px] duration-250">
                    <span className=""> 20% off </span>
                  </Button>
                </DropdownMenuItem>
              </DropdownMenuGroup>

              <div className="my-1">
                <Separator />
              </div>

              <DropdownMenuGroup className="px-1">
                <DropdownMenuItem className="justify-between px-2 pl-4 cursor-pointer focus:bg-sidebar-accent focus:brightness-120 rounded-b-xl">
                  <div className="flex items-center gap-3 text-xs">
                    <AccountSwitch className="size-3.5 stroke-white" />
                    Switch trading account
                  </div>

                  <Button className="cursor-pointer shadow-secondary-button rounded-[6px] gap-1 h-max py-2 transition-all active:scale-95 bg-sidebar-accent hover:bg-sidebar-accent text-white w-max text-[10px] hover:!brightness-110 duration-250">
                    <Cmd className="size-2 stroke-white fill-transparent" />
                    <span className=""> O </span>
                  </Button>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </div>

            <div className="px-2 py-1">
              <Button className="cursor-pointer shadow-sidebar-button rounded-[6px] gap-2 h-max transition-all active:scale-95 bg-rose-700 hover:bg-rose-700 text-white w-full text-xs hover:!brightness-110 duration-250 ">
                <LogOut className="size-3 text-white" />
                Log out
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
