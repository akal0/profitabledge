"use client";

import type { LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import {
  GoalContentSeparator,
  GoalPanel,
  GoalSurface,
} from "@/components/goals/goal-surface";
import { cn } from "@/lib/utils";

export const EDGE_PAGE_SHELL_CLASS = "space-y-6 p-6 py-4";
export const EDGE_ACTION_BUTTON_CLASSNAME =
  "cursor-pointer flex items-center justify-center gap-2 py-2 h-[38px] transition-all active:scale-95 text-white w-max text-xs hover:brightness-110 duration-250 ring ring-white/5 bg-sidebar rounded-sm hover:bg-sidebar-accent px-3";

export function EdgePageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-2">
        {eyebrow ? (
          <p className="text-[11px] font-medium text-teal-400/78">
            {eyebrow}
          </p>
        ) : null}
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-white md:text-3xl">
            {title}
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-white/52 md:text-[15px]">
            {description}
          </p>
        </div>
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}

export function EdgeMetricCard({
  icon: Icon,
  label,
  value,
  detail,
  iconClassName,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  detail?: string;
  iconClassName?: string;
}) {
  return (
    <GoalSurface className="w-full">
      <div className="p-3.5 text-xs">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4 text-teal-300", iconClassName)} />
          <span className="text-xs text-white/50">{label}</span>
        </div>
        <GoalContentSeparator className="mb-3.5 mt-3.5" />
        <div className="flex items-end justify-between gap-3">
          <div className="text-xl font-semibold text-white">{value}</div>
          {detail ? (
            <div className="text-right text-xs leading-4 text-white/38">
              {detail}
            </div>
          ) : null}
        </div>
      </div>
    </GoalSurface>
  );
}

export function EdgePanel({
  bodyClassName,
  ...props
}: ComponentProps<typeof GoalPanel>) {
  return (
    <div className="w-full">
      <GoalPanel {...props} bodyClassName={cn("text-xs", bodyClassName)} />
    </div>
  );
}
