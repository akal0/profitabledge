"use client";

import type { ReactNode } from "react";

import { formatSignedCurrencyValue } from "@/features/dashboard/widgets/lib/widget-shared";
import { Separator } from "@/components/ui/separator";
import { APP_TOOLTIP_SURFACE_CLASS } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type DashboardTooltipTone =
  | "default"
  | "positive"
  | "negative"
  | "accent";

export function getDashboardTooltipToneClass(tone: DashboardTooltipTone) {
  switch (tone) {
    case "positive":
      return "text-teal-400";
    case "negative":
      return "text-rose-400";
    case "accent":
      return "text-[#FCA070]";
    default:
      return "text-white";
  }
}

export function DashboardChartTooltipFrame({
  title,
  children,
  className,
}: {
  title: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        APP_TOOLTIP_SURFACE_CLASS,
        "grid min-w-[16rem] gap-2 px-0 py-3 text-xs",
        className
      )}
    >
      <div className="px-3 text-[11px] font-medium leading-none text-white">
        {title}
      </div>
      <Separator />
      <div className="grid gap-2 px-3">{children}</div>
    </div>
  );
}

export function DashboardChartTooltipRow({
  label,
  value,
  tone = "default",
  dimmed = false,
  indicatorColor,
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: DashboardTooltipTone;
  dimmed?: boolean;
  indicatorColor?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-full items-center gap-2 font-semibold",
        dimmed && "opacity-50"
      )}
    >
      {indicatorColor ? (
        <span
          className="size-2.5 shrink-0 rounded-[2px]"
          style={{ backgroundColor: indicatorColor }}
        />
      ) : null}
      <div className="flex min-w-0 flex-1 items-center justify-between gap-6">
        <span className="text-white/80">{label}</span>
        <span className={getDashboardTooltipToneClass(tone)}>{value}</span>
      </div>
    </div>
  );
}

export function formatSignedCurrency(
  value: number,
  digits = 0,
  currencyCode?: string | null
) {
  return formatSignedCurrencyValue(value, currencyCode, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatSignedPercent(value: number, digits = 2) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${Math.abs(value).toFixed(digits)}%`;
}
