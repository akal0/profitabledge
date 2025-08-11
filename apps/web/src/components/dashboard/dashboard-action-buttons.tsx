"use client";

import { GradientButton } from "@/components/ui/gradient-button";
import EditWidgets from "../../../public/icons/edit-widgets.svg";
import Resync from "../../../public/icons/resync.svg";

export function DashboardActionButtons() {
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

  return (
    <div className="flex gap-2 bg-muted/25 p-1 rounded-xl border-[0.5px] border-black/5">
      {/* USD or Return */}
      <div className="bg-white w-max flex items-center rounded-lg pr-4 gap-3 border-[0.5px] border-black/10">
        <GradientButton
          className="rounded-md border-[0.5px]"
          variant="cyan"
          size="sm"
          onClick={handleUSDClick}
        >
          USD
        </GradientButton>

        <p className="text-secondary text-xs font-semibold">Return (%)</p>
      </div>

      {/* Sync */}
      <div className="bg-white w-max flex items-center rounded-lg pl-4 gap-4 border-[0.5px] border-black/10 ">
        <p className="text-secondary text-xs font-semibold">
          Last synced: 26th July, 2025
        </p>

        <GradientButton
          className="rounded-md border-[0.5px]"
          variant="indigo"
          size="sm"
          icon={<Resync className="size-3" />}
          onClick={handleResyncClick}
        >
          Resync
        </GradientButton>
      </div>

      {/* Edit widgets */}
      <GradientButton
        className="rounded-md border-[0.5px]"
        variant="indigo"
        icon={<EditWidgets className="size-3" />}
        onClick={handleEditWidgetsClick}
      >
        Edit widgets
      </GradientButton>
    </div>
  );
}
