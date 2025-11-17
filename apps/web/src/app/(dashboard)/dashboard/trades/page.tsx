import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Separator, VerticalSeparator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import TradeTableInfinite from "./components/trade-table-infinite";
import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const TradesPage = () => {
  return (
    <SidebarProvider className="min-h-[100vh] h-full relative">
      <AppSidebar />
      <VerticalSeparator />

      <SidebarInset className="bg-white dark:bg-sidebar py-2 h-full flex flex-col gap-6 ">
        <div className="flex flex-col">
          <header className="flex h-[3.725rem] shrink-0 items-center gap-2 bg-white dark:bg-sidebar rounded-t-[8px] px-8">
            <div className="flex items-center gap-3 w-full group transition-all duration-250">
              {/* <SidebarTrigger className=" -ml-1 cursor-pointer" /> */}
              <SearchIcon className="size-4 text-white/50 group-hover:text-white/75 transition-all duration-150" />

              <Input
                placeholder="Find your own profitable edge..."
                className="w-full focus-visible:scale-100 border-none pl-0 font-medium hover:bg-transparent hover:brightness-100 placeholder:text-muted-foreground/50 group-hover:placeholder:text-white/75 transition duration-250 placeholder:!text-sm !text-sm"
              />
            </div>

            <div>
              <Button className="cursor-pointer flex transform items-center justify-center py-2.5 h-full transition-all active:scale-95 text-white w-max text-xs hover:!brightness-110 hover:text-white duration-250  border-[0.5px] border-white/5 bg-sidebar rounded-none hover:bg-sidebar-accent">
                Non-verified manual account
              </Button>
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
                    All trades{" "}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          <Separator />
        </div>

        <div className="flex flex-col w-full h-max gap-4 px-8 pb-12 dark:bg-sidebar">
          <TradeTableInfinite />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default TradesPage;
