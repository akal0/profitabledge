"use client";

import type { NotificationPresentationBrandKey } from "@profitabledge/platform";
import { PROFITABLEDGE_FAVICON_PATH } from "@/lib/brand-assets";

export type NotificationBrandAsset = {
  src: string;
  alt: string;
};

const NOTIFICATION_BRAND_ASSETS: Record<
  NotificationPresentationBrandKey,
  NotificationBrandAsset
> = {
  profitabledge: {
    src: PROFITABLEDGE_FAVICON_PATH,
    alt: "Profitabledge",
  },
  ftmo: {
    src: "/brokers/FTMO.png",
    alt: "FTMO",
  },
  mt5: {
    src: "/brokers/mt5.png",
    alt: "MetaTrader",
  },
  ctrader: {
    src: PROFITABLEDGE_FAVICON_PATH,
    alt: "cTrader",
  },
  tradovate: {
    src: "/brokers/tradovate.png",
    alt: "Broker",
  },
};

export function getNotificationBrandAsset(
  brandKey?: NotificationPresentationBrandKey | null
): NotificationBrandAsset {
  return NOTIFICATION_BRAND_ASSETS[brandKey ?? "profitabledge"];
}
