"use client";

import EditWidgets from "@/public/icons/edit-widgets.svg";
import { Button } from "@/components/ui/button";

type Me = {
  name: string;
  email: string;
  image: string | null;
  createdAt: string;
  updatedAt: string;
  emailVerified: boolean;
  username: string | null;
};

type Props = {
  user: Me | null;
  isEditing?: boolean;
  onToggleEdit?: () => void;
};

import Resync from "@/public/icons/resync.svg";
import { Skeleton } from "../ui/skeleton";

const DashboardActionButtons: React.FC<Props> = ({
  user,
  isEditing = false,
  onToggleEdit,
}) => {
  const handleUSDClick = () => {
    console.log("USD clicked - toggle between USD and percentage view");
    // Add your USD toggle logic here
  };

  const handleResyncClick = () => {
    console.log("Resync clicked - triggering data resync");
    // Add your resync logic here
  };

  const handleEditWidgetsClick = () => {
    console.log("Edit widgets clicked - opening widget editor");
    // Add your edit widgets logic here
  };

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return iso;
    const day = date.getDate();
    const suffix = (n: number) => {
      const j = n % 10,
        k = n % 100;
      if (j === 1 && k !== 11) return "st";
      if (j === 2 && k !== 12) return "nd";
      if (j === 3 && k !== 13) return "rd";
      return "th";
    };
    const month = date.toLocaleString("en-US", { month: "long" });
    const year = date.getFullYear();
    return `${day}${suffix(day)} ${month}, ${year}`;
  };

  const formattedUpdatedAt = user ? formatDate(user.updatedAt) : "";

  return (
    <div className="flex gap-2 items-center">
      <div className="bg-white w-max h-max flex items-center gap-1 p-[3px] dark:bg-muted/25">
        <Button className=" cursor-pointer flex transform items-center justify-center gap-2 rounded-none py-2 h-max transition-all active:scale-95 bg-[#222225] text-white w-max text-xs hover:bg-[#222225] hover:!brightness-120 hover:text-white duration-250">
          <div className="contents">
            <span className="px-2">USD</span>
          </div>
        </Button>

        <Button className=" cursor-pointer flex transform items-center justify-center gap-2 rounded-none py-2 h-max transition-all active:scale-95 bg-[#222225]/25 text-white/25 w-max text-xs dark:hover:bg-[#222225] hover:!brightness-105 hover:text-white duration-250">
          <div className="contents">
            <span className="px-0">Return (%)</span>
          </div>
        </Button>
      </div>

      <div className="flex items-center overflow-hidden border border-white/5 bg-sidebar group">
        <Button className="rounded-none bg-sidebar hover:bg-sidebar-accent text-white/25 text-xs py-2 px-4 cursor-default">
          Last synced:{" "}
          {formattedUpdatedAt || (
            <Skeleton className="w-28 h-3.5 ml-1 rounded-none bg-sidebar-accent" />
          )}
        </Button>

        <div className="h-9 w-[2px] bg-white/5 mx-0" />

        <Button className="rounded-none bg-sidebar hover:bg-sidebar-accent text-white text-xs py-2">
          <Resync
            className="size-3.5 fill-white group-hover:animate-spin"
            style={{ animationDuration: "3s" }}
          />
          Update account
        </Button>
      </div>

      <div className="bg-white dark:bg-muted/0 w-max flex items-center rounded-md h-max p-[3px] gap-1.5">
        <Button
          onClick={onToggleEdit}
          className="cursor-pointer flex transform items-center justify-center py-2.5 h-full transition-all active:scale-95 text-white w-max text-xs hover:!brightness-110 hover:text-white duration-250  border-[0.5px] border-white/5 bg-sidebar rounded-none hover:bg-sidebar-accent"
        >
          <div className="flex items-center gap-1.5">
            <EditWidgets className="size-3 fill-white/75" />
            <span className="">{isEditing ? "Save" : "Customize widgets"}</span>
          </div>
        </Button>
      </div>
    </div>
  );
};

export default DashboardActionButtons;
