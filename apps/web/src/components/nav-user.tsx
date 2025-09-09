"use client";

import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  CreditCard,
  DoorClosedLocked,
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
import { Skeleton } from "./ui/skeleton";

type Me = {
  name: string;
  email: string;
  image: string | null;
  createdAt: string;
  updatedAt: string;
  emailVerified: boolean;
  username: string | null;
};

const NavUser: React.FC<{ user: Me }> = ({ user }) => {
  const { isMobile } = useSidebar();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton className="flex cursor-pointer bg-white dark:bg-sidebar hover:bg-white dark:hover:brightness-110 focus:bg-white dark:hover:bg-sidebar dark:focus:bg-sidebar rounded-xs items-center justify-center shadow-sidebar-button !w-max !h-max ">
              {/* <Avatar className="size-8 rounded-md shadow-secondary-button">
                <AvatarImage
                  src={user.image ?? undefined}
                  alt={user.name}
                  className=""
                />
                <AvatarFallback className="rounded-lg">User</AvatarFallback>
              </Avatar> */}

              <div className="size-8 rounded-xs shadow-secondary-button">
                <Image
                  src={user.image ?? ""}
                  alt="pfp"
                  fill
                  className="object-cover"
                />
              </div>
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) bg-sidebar-accent min-w-80 rounded-lg p-1 flex flex-col gap-2 border-[0.5px] border-white/0"
            side={isMobile ? "bottom" : "right"}
            align="start"
            sideOffset={24}
          >
            <div className="flex-1 flex flex-col rounded-sm bg-sidebar-accent brightness-120 border-white/10 pb-1">
              <DropdownMenuLabel className="p-3 font-normal flex justify-between items-start">
                <div className="flex items-center gap-3  text-left text-sm h-full">
                  <Avatar className="size-10 rounded-xs shadow-secondary-button">
                    <AvatarImage
                      src={user.image ?? undefined}
                      alt={user.name}
                      className="object-cover"
                    />
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
                    <span className=""> Student </span>
                  </Button>
                </div>
              </DropdownMenuLabel>

              <div className="my-1">
                <Separator />
              </div>

              <DropdownMenuGroup className="px-1">
                <DropdownMenuItem className="text-xs px-2 pl-4 cursor-pointer focus:bg-sidebar-accent focus:brightness-120 flex items-center gap-3">
                  <BadgeCheck className="size-3" />
                  <p> Account </p>
                </DropdownMenuItem>

                <DropdownMenuItem className="text-xs px-2 pl-4 cursor-pointer focus:bg-sidebar-accent focus:brightness-120 flex items-center gap-3">
                  <Settings2 className="size-3" />
                  <p> Settings </p>
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

                  <div className="cursor-pointer shadow-secondary-button rounded-[6px] gap-2 h-max py-1 px-3 transition-all active:scale-95 bg-emerald-700 text-white w-max text-[10px] duration-250">
                    <span className="font-medium"> 20% off </span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuGroup>

              <div className="my-1">
                <Separator />
              </div>

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
                <DropdownMenuItem className="text-xs px-2 pl-4 cursor-pointer focus:bg-sidebar-accent focus:brightness-120 flex items-center gap-3 py-3">
                  <DoorClosedLocked className="size-3" />
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
