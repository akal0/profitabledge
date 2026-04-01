"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { Building2, Trophy, type LucideIcon } from "lucide-react";

import { AddAccountSheet } from "@/features/accounts/components/add-account-sheet";
import { WidgetWrapper } from "@/components/dashboard/widget-wrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { APP_TOOLTIP_SURFACE_CLASS } from "@/components/ui/tooltip";
import { TRADE_SURFACE_CARD_CLASS } from "@/components/trades/trade-identifier-pill";
import { cn } from "@/lib/utils";

export type AccountRecord = any;
export type PropFirmOption = {
  id: string;
  createdByUserId?: string | null;
  displayName?: string | null;
  description?: string | null;
  logo?: string | null;
};

export const HEADER_CONTROL_HEIGHT = "h-7";
export const HEADER_ICON_BUTTON_CLASS = `${HEADER_CONTROL_HEIGHT} rounded-sm ring-white/10 bg-sidebar px-2 text-xs text-white/35 hover:bg-sidebar`;
export const HEADER_BADGE_CLASS = `${HEADER_CONTROL_HEIGHT} rounded-sm px-1.5 text-[10px] font-medium`;
export const FTMO_PROP_FIRM_ID = "ftmo";
export const FTMO_IMAGE_SRC = "/brokers/FTMO.png";
export const FALLBACK_FTMO_PROP_FIRM: PropFirmOption = {
  id: FTMO_PROP_FIRM_ID,
  displayName: "FTMO",
  description:
    "One of the world's leading prop trading firms with a proven track record since 2015.",
};
export const PROP_ASSIGN_SELECT_SURFACE_CLASS = cn(
  APP_TOOLTIP_SURFACE_CLASS,
  "z-[70] ring-white/6 bg-sidebar/95 text-white/80 shadow-[0_18px_40px_rgba(0,0,0,0.42)] backdrop-blur-xl"
);

export function toFiniteNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isFtmoFirm(
  firm?: Pick<PropFirmOption, "id" | "displayName"> | null
) {
  const id = String(firm?.id || "").toLowerCase();
  const displayName = String(firm?.displayName || "").toLowerCase();
  return id === FTMO_PROP_FIRM_ID || displayName === "ftmo";
}

export function PropFirmAvatar({
  firm,
  className,
}: {
  firm?: PropFirmOption | null;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      {firm?.logo || isFtmoFirm(firm) ? (
        <Image
          src={firm?.logo || FTMO_IMAGE_SRC}
          alt={firm?.displayName || "Prop firm"}
          fill
          sizes="64px"
          className="object-contain p-2"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Trophy className="size-5 text-white/55" />
        </div>
      )}
    </div>
  );
}

export function BrokerAccountAvatar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-sm ring-1 ring-white/10 bg-white/[0.04]",
        className
      )}
    >
      <Building2 className="size-5 text-white/55" />
    </div>
  );
}

export function formatUsd(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

export function getAccountBalance(account: AccountRecord) {
  return parseFloat(account.liveBalance || account.initialBalance || "0");
}

export function getAccountEquity(account: AccountRecord) {
  return account.liveEquity ? parseFloat(account.liveEquity) : null;
}

export function SectionHeader({
  icon: Icon,
  label,
  count,
  action,
}: {
  icon: LucideIcon;
  label: string;
  count: number;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-1">
      <Icon className="size-3.5 text-white/45" />
      <h2 className="text-xs font-semibold text-white/45">{label}</h2>
      <Badge
        variant="outline"
        className="h-5 rounded-sm ring-white/10 px-1.5 text-[10px] text-white/55"
      >
        {count}
      </Badge>
      {action ? <div className="ml-auto">{action}</div> : null}
    </div>
  );
}

export function AccountsEmptyState({
  icon: Icon,
  title,
  description,
  ctaLabel,
  onAccountCreated,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel: string;
  onAccountCreated: () => void;
}) {
  return (
    <WidgetWrapper
      icon={Icon}
      title={title}
      showHeader
      className="h-auto"
      contentClassName="h-auto flex-col items-center justify-center px-6 py-10 text-center"
    >
      <Icon className="mb-2 size-8 text-white/60" />
      <p className="max-w-sm text-xs font-medium text-white/60">
        {description}
      </p>
      <div className="mt-4">
        <AddAccountSheet
          onAccountCreated={onAccountCreated}
          trigger={
            <Button className="h-8 rounded-sm ring-1 ring-white/5 bg-sidebar text-xs text-white hover:bg-sidebar-accent hover:brightness-110">
              {ctaLabel}
            </Button>
          }
        />
      </div>
    </WidgetWrapper>
  );
}

export function AccountWidgetFrame({
  icon,
  title,
  headerRight,
  className,
  contentClassName,
  children,
}: {
  icon: LucideIcon;
  title: string;
  headerRight?: ReactNode;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <WidgetWrapper
      icon={icon}
      title={title}
      headerRight={headerRight}
      showHeader
      className={cn("h-auto", className)}
      contentClassName={cn("h-auto flex-col p-6 py-3.5", contentClassName)}
    >
      {children}
    </WidgetWrapper>
  );
}

export { TRADE_SURFACE_CARD_CLASS };
