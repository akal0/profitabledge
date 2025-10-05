"use client";

import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer data-[state=checked]:bg-teal-500 data-[state=unchecked]:bg-[#29292D] focus-visible:ring-ring/50 inline-flex h-4 w-8 shrink-0 items-center rounded-full border-2 border-transparent transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 duration-500 cursor-pointer",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "bg-sidebar pointer-events-none block size-3 rounded-full shadow-xs ring-0 transition-transform data-[state=checked]:bg-sidebar-accent data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0 data-[state=checked]:rtl:-translate-x-4 duration-500"
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
