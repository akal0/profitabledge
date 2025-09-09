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

const DashboardActionButtons: React.FC<{ user: Me }> = ({ user }) => {
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

  const formattedUpdatedAt = formatDate(user.updatedAt);

  return (
    <div className="flex gap-2">
      <div className="bg-white w-max h-max flex items-center rounded-md gap-1 p-0.5 border-[0.5px] border-black/10 dark:border-white/5 dark:bg-muted/10">
        <Button className="shadow-primary-button cursor-pointer flex transform items-center justify-center gap-2 rounded-[6px] py-2 h-max transition-all active:scale-95 bg-[#222225] text-[#A0A0A6] w-max text-xs hover:bg-[#222225] hover:!brightness-120 hover:text-white duration-250">
          <div className="contents">
            <span className="px-2">USD</span>
          </div>
        </Button>

        <Button className="shadow-primary-button cursor-pointer flex transform items-center justify-center gap-2 rounded-[6px] py-2 h-max transition-all active:scale-95 bg-[#222225]/25 text-[#A0A0A6]/25 w-max text-xs dark:hover:bg-[#222225] hover:!brightness-105 hover:text-[#A0A0A6]/75 duration-250">
          <div className="contents">
            <span className="px-0">Return (%)</span>
          </div>
        </Button>
      </div>

      <div className="bg-white dark:bg-muted/10 w-max flex items-center rounded-md border-[0.5px] border-black/10 dark:border-white/5 h-max p-0.5 gap-1.5">
        <p className="shadow-primary-button cursor-default rounded-[6px] py-2 px-4 h-max transition-all active:scale-95 bg-[#222225]/25 text-[#A0A0A6]/25 w-max text-xs dark:hover:bg-[#222225] hover:!brightness-105 hover:text-[#A0A0A6]/75 duration-250">
          <span className="px-0">Last synced: {formattedUpdatedAt} </span>
        </p>

        <Button className="shadow-secondary-button cursor-pointer flex transform items-center justify-center rounded-[6px] py-2 h-max transition-all active:translate-y-1 bg-amber-600 text-white w-max text-xs hover:bg-amber-600 hover:!brightness-110 hover:text-white duration-250 group">
          <div className="flex items-center gap-1.5">
            {/* <Resync
              className="size-3 fill-white/75 group-hover:animate-spin"
              style={{ animationDuration: ".75s" }}
            /> */}
            <span className="">Update account</span>
          </div>
        </Button>
      </div>

      <div className="bg-white dark:bg-muted/10 w-max flex items-center rounded-md border-[0.5px] border-black/10 dark:border-white/5 h-max p-0.5 gap-1.5">
        <Button className="shadow-secondary-button cursor-pointer flex transform items-center justify-center rounded-[6px] py-2 h-max transition-all active:translate-y-1 bg-emerald-700 text-white w-max text-xs hover:bg-emerald-600 hover:!brightness-110 hover:text-white duration-250">
          <div className="flex items-center gap-1.5">
            <EditWidgets className="size-3 fill-white/75" />
            <span className="">Edit widgets</span>
          </div>
        </Button>
      </div>
    </div>
  );
};

export default DashboardActionButtons;
