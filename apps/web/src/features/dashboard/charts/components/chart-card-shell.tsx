"use client";

import { useRef, type ReactNode, type SyntheticEvent } from "react";

import { WidgetWrapper } from "@/components/dashboard/widget-wrapper";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { WidgetShareButton } from "@/features/dashboard/widgets/components/widget-share-button";
import { ChevronDown } from "lucide-react";

export type ChartWidgetCardProps = {
  accountId?: string;
  currencyCode?: string | null;
  isEditing?: boolean;
  className?: string;
  hideComparison?: boolean;
};

export type ChartHeaderMenuSection = {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  items: Array<{ label: string; value: string }>;
};

export function ChartWidgetFrame({
  title,
  headerRight,
  isEditing = false,
  showShareButton = true,
  className,
  contentClassName,
  children,
}: {
  title: string;
  headerRight?: ReactNode;
  isEditing?: boolean;
  showShareButton?: boolean;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const stopHeaderInteraction = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  return (
    <WidgetWrapper
      rootRef={widgetRef}
      isEditing={isEditing}
      className={cn("h-full p-1 cursor-pointer", className)}
      header={
        <div className="widget-header flex h-[66px] w-full items-center gap-3 px-3.5 py-3.5">
          <h2 className="flex min-w-0 flex-1 items-center gap-2 text-xs font-medium text-white/50 transition-all duration-250 group-hover:text-white">
            <span className="truncate">{title}</span>
          </h2>
          {headerRight || !isEditing ? (
            <div
              className="ml-auto shrink-0 pl-2"
              data-widget-share-ignore="true"
              onPointerDown={stopHeaderInteraction}
              onClick={stopHeaderInteraction}
            >
              <div className="-m-1 flex items-center justify-end gap-2 overflow-visible p-1">
                {!isEditing && showShareButton ? (
                  <WidgetShareButton targetRef={widgetRef} title={title} />
                ) : null}
                {headerRight}
              </div>
            </div>
          ) : null}
        </div>
      }
      contentClassName={cn(
        "flex h-full min-h-0 w-full rounded-sm",
        contentClassName ?? "flex-col"
      )}
    >
      {children}
    </WidgetWrapper>
  );
}

export function ChartHeaderMenu({
  label = "Options",
  sections,
}: {
  label?: string;
  sections: ChartHeaderMenuSection[];
}) {
  const stopHeaderInteraction = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          className="h-7 w-max max-w-[9rem] shrink-0 justify-start rounded-sm border border-white/5 bg-sidebar px-1.5 text-xs text-white/70 hover:bg-sidebar-accent"
        >
          <span className="max-w-[5rem] truncate text-left">{label}</span>
          <ChevronDown className="size-3.5 text-white/40" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-max min-w-[12rem] max-w-[16rem] rounded-sm border border-white/5 bg-sidebar p-1 text-white"
        onClick={stopHeaderInteraction}
        onPointerDown={stopHeaderInteraction}
      >
        <DropdownMenuLabel className="px-4 py-2.5 text-xs font-normal text-white/60">
          Options
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/5" />
        {sections.length === 1 ? (
          <div className="p-1">
            <div className="px-4 pb-1 text-[11px] text-white/40">
              {sections[0].label}
            </div>
            <DropdownMenuRadioGroup
              value={sections[0].value}
              onValueChange={sections[0].onValueChange}
            >
              {sections[0].items.map((item) => (
                <DropdownMenuRadioItem
                  key={item.value}
                  value={item.value}
                  className="px-4 py-2.5 text-xs text-white/75 focus:bg-sidebar-accent focus:text-white"
                >
                  {item.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </div>
        ) : (
          sections.map((section) => (
            <DropdownMenuSub key={section.label}>
              <DropdownMenuSubTrigger className="rounded-sm px-4 py-2.5 text-xs text-white/75 focus:bg-sidebar-accent focus:text-white data-[state=open]:bg-sidebar-accent data-[state=open]:text-white">
                <span>{section.label}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-max min-w-[12rem] max-w-[16rem] rounded-sm border border-white/5 bg-sidebar p-1 text-white">
                <DropdownMenuRadioGroup
                  value={section.value}
                  onValueChange={section.onValueChange}
                >
                  {section.items.map((item) => (
                    <DropdownMenuRadioItem
                      key={item.value}
                      value={item.value}
                      className="px-4 py-2.5 text-xs text-white/75 focus:bg-sidebar-accent focus:text-white"
                    >
                      {item.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
