"use client";

import { useState, type MouseEvent, type RefObject } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { exportWidgetAsPng } from "@/features/dashboard/widgets/lib/widget-share";

export function WidgetShareButton({
  targetRef,
  title,
  className,
  successMessage = "Widget PNG downloaded",
  errorMessage = "Failed to export widget PNG",
  tooltipLabel = "Download PNG",
  buttonLabel,
}: {
  targetRef: RefObject<HTMLElement | null>;
  title: string;
  className?: string;
  successMessage?: string;
  errorMessage?: string;
  tooltipLabel?: string;
  buttonLabel?: string;
}) {
  const [isExporting, setIsExporting] = useState(false);

  const handleClick = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();

    const target = targetRef.current;
    if (!target || isExporting) {
      return;
    }

    try {
      setIsExporting(true);
      await exportWidgetAsPng({
        node: target,
        title,
      });
      toast.success(successMessage);
    } catch (error) {
      console.error(error);
      toast.error(errorMessage);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size={buttonLabel ? "default" : "icon"}
          data-widget-share-ignore="true"
          className={cn(
            buttonLabel
              ? "h-9 w-max shrink-0 gap-2 rounded-sm border border-white/5 bg-sidebar px-4 text-xs text-white/70 transition-all duration-250 hover:bg-sidebar-accent hover:text-white"
              : "size-7 shrink-0 rounded-sm border border-white/5 bg-sidebar/85 text-white/65 backdrop-blur-sm transition-all duration-250 hover:bg-sidebar-accent hover:text-white",
            className
          )}
          disabled={isExporting}
          onClick={handleClick}
        >
          <Download className="size-3.5" />
          {buttonLabel ? <span>{buttonLabel}</span> : null}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8}>
        <p>{tooltipLabel}</p>
      </TooltipContent>
    </Tooltip>
  );
}
