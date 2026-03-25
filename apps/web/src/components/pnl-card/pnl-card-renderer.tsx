"use client";

import React, { forwardRef } from "react";
import { formatDistance } from "date-fns";
import QRCode from "react-qr-code";

export interface PnlCardData {
  symbol: string;
  tradeType: "long" | "short" | "buy" | "sell";
  profit: number;
  openPrice: number;
  closePrice: number;
  volume: number;
  openTime: string;
  closeTime: string;
  realisedRR: number;
  outcome: "Win" | "Loss" | "BE" | "PW" | null;
  duration: string | number;
}

export interface PnlCardConfig {
  backgroundType: "gradient" | "image" | "solid";
  backgroundValue: string;
  backgroundImageUrl?: string;
  imageOpacity?: number;
  imageBlur?: number;
  layout: {
    font: string;
    fontSize: {
      title: number;
      stat: number;
      label: number;
    };
    colors: {
      primary: string;
      secondary: string;
      accent: string;
      negative: string;
    };
    elements: string[];
    logoPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  };
  customText?: string;
  showBranding: boolean;
}

interface PnlCardRendererProps {
  data: PnlCardData;
  config: PnlCardConfig;
  className?: string;
  verification?: {
    url: string;
    code: string;
  } | null;
}

export const PnlCardRenderer = forwardRef<HTMLDivElement, PnlCardRendererProps>(
  ({ data, config, className, verification }, ref) => {
    const { layout } = config;

    // Determine background style
    const getBackgroundStyle = () => {
      if (config.backgroundType === "gradient") {
        return { background: config.backgroundValue };
      } else if (
        config.backgroundType === "image" &&
        config.backgroundImageUrl
      ) {
        const opacity = (config.imageOpacity ?? 100) / 100;
        const blur = config.imageBlur ?? 0;
        return {
          backgroundImage: `url(${config.backgroundImageUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: opacity,
          filter: blur > 0 ? `blur(${blur}px)` : undefined,
        };
      } else if (config.backgroundType === "solid") {
        return { backgroundColor: config.backgroundValue };
      }
      return {};
    };

    // Format currency
    const formatCurrency = (value: number) => {
      const sign = value >= 0 ? "+" : "";
      return `${sign}$${value.toFixed(2)}`;
    };

    // Format R:R
    const formatRR = (rr: number) => {
      return rr >= 0 ? `+${rr.toFixed(2)}R` : `${rr.toFixed(2)}R`;
    };

    // Format duration
    const formatDuration = (duration: string | number) => {
      if (typeof duration === "number") {
        const hours = Math.floor(duration / 3600);
        const minutes = Math.floor((duration % 3600) / 60);
        return `${hours}h ${minutes}m`;
      }
      return duration;
    };

    // Calculate pips
    const calculatePips = () => {
      const diff = Math.abs(data.closePrice - data.openPrice);
      const pipSize = data.symbol.includes("JPY") ? 0.01 : 0.0001;
      return (diff / pipSize).toFixed(1);
    };

    // Determine text color based on profit
    const profitColor =
      data.profit >= 0 ? layout.colors.accent : layout.colors.negative;

    // Logo position mapping
    const logoPositionClass = {
      "top-left": "top-4 left-4",
      "top-right": "top-4 right-4",
      "bottom-left": "bottom-4 left-4",
      "bottom-right": "bottom-4 right-4",
    }[layout.logoPosition];

    return (
      <div
        ref={ref}
        className={`relative w-[600px] h-[800px] rounded-2xl overflow-hidden shadow-2xl ${className}`}
        style={{
          fontFamily: layout.font,
        }}
      >
        {/* Background Layer */}
        <div
          className="absolute inset-0"
          style={{
            ...getBackgroundStyle(),
          }}
        />

        {/* Overlay for better text readability */}
        <div className="absolute inset-0 bg-black/20" />

        {/* Content */}
        <div className="relative z-10 h-full flex flex-col justify-between p-12">
          {/* Header */}
          <div className="space-y-2">
            <div
              className="flex items-center gap-3"
              style={{ color: layout.colors.primary }}
            >
              <span
                style={{ fontSize: `${layout.fontSize.title}px` }}
                className="font-bold"
              >
                {data.symbol}
              </span>
              <span
                className={`px-3 py-1 rounded-full text-sm font-semibold uppercase ${
                  data.tradeType === "long" || data.tradeType === "buy"
                    ? "bg-green-500/20 text-green-300"
                    : "bg-red-500/20 text-red-300"
                }`}
              >
                {data.tradeType === "long" || data.tradeType === "buy"
                  ? "LONG"
                  : "SHORT"}
              </span>
            </div>
            {config.customText && (
              <p
                style={{
                  fontSize: `${layout.fontSize.label}px`,
                  color: layout.colors.secondary,
                }}
                className="italic"
              >
                {config.customText}
              </p>
            )}
          </div>

          {/* Main Stats */}
          <div className="space-y-8">
            {/* Profit */}
            {layout.elements.includes("profit") && (
              <div className="space-y-1">
                <p
                  style={{
                    fontSize: `${layout.fontSize.label}px`,
                    color: layout.colors.secondary,
                  }}
                  className="uppercase tracking-wide font-medium"
                >
                  Net Profit
                </p>
                <p
                  style={{
                    fontSize: `${layout.fontSize.stat * 1.5}px`,
                    color: profitColor,
                  }}
                  className="font-bold"
                >
                  {formatCurrency(data.profit)}
                </p>
              </div>
            )}

            {/* Grid of secondary stats */}
            <div className="grid grid-cols-2 gap-6">
              {/* R:R */}
              {layout.elements.includes("rr") && (
                <div className="space-y-1">
                  <p
                    style={{
                      fontSize: `${layout.fontSize.label}px`,
                      color: layout.colors.secondary,
                    }}
                    className="uppercase tracking-wide font-medium"
                  >
                    R:R
                  </p>
                  <p
                    style={{
                      fontSize: `${layout.fontSize.stat}px`,
                      color: layout.colors.primary,
                    }}
                    className="font-semibold"
                  >
                    {formatRR(data.realisedRR)}
                  </p>
                </div>
              )}

              {/* Pips */}
              {layout.elements.includes("pips") && (
                <div className="space-y-1">
                  <p
                    style={{
                      fontSize: `${layout.fontSize.label}px`,
                      color: layout.colors.secondary,
                    }}
                    className="uppercase tracking-wide font-medium"
                  >
                    Pips
                  </p>
                  <p
                    style={{
                      fontSize: `${layout.fontSize.stat}px`,
                      color: layout.colors.primary,
                    }}
                    className="font-semibold"
                  >
                    {calculatePips()}
                  </p>
                </div>
              )}

              {/* Duration */}
              {layout.elements.includes("duration") && (
                <div className="space-y-1">
                  <p
                    style={{
                      fontSize: `${layout.fontSize.label}px`,
                      color: layout.colors.secondary,
                    }}
                    className="uppercase tracking-wide font-medium"
                  >
                    Duration
                  </p>
                  <p
                    style={{
                      fontSize: `${layout.fontSize.stat}px`,
                      color: layout.colors.primary,
                    }}
                    className="font-semibold"
                  >
                    {formatDuration(data.duration)}
                  </p>
                </div>
              )}

              {/* Volume */}
              {layout.elements.includes("volume") && (
                <div className="space-y-1">
                  <p
                    style={{
                      fontSize: `${layout.fontSize.label}px`,
                      color: layout.colors.secondary,
                    }}
                    className="uppercase tracking-wide font-medium"
                  >
                    Volume
                  </p>
                  <p
                    style={{
                      fontSize: `${layout.fontSize.stat}px`,
                      color: layout.colors.primary,
                    }}
                    className="font-semibold"
                  >
                    {data.volume} lots
                  </p>
                </div>
              )}
            </div>

            {/* Entry/Exit Prices */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <p
                  style={{
                    fontSize: `${layout.fontSize.label}px`,
                    color: layout.colors.secondary,
                  }}
                  className="uppercase tracking-wide font-medium"
                >
                  Entry
                </p>
                <p
                  style={{
                    fontSize: `${layout.fontSize.stat * 0.8}px`,
                    color: layout.colors.primary,
                  }}
                  className="font-semibold"
                >
                  {data.openPrice.toFixed(5)}
                </p>
              </div>
              <div className="space-y-1">
                <p
                  style={{
                    fontSize: `${layout.fontSize.label}px`,
                    color: layout.colors.secondary,
                  }}
                  className="uppercase tracking-wide font-medium"
                >
                  Exit
                </p>
                <p
                  style={{
                    fontSize: `${layout.fontSize.stat * 0.8}px`,
                    color: layout.colors.primary,
                  }}
                  className="font-semibold"
                >
                  {data.closePrice.toFixed(5)}
                </p>
              </div>
            </div>

            {/* Outcome Badge */}
            {data.outcome && (
              <div className="flex items-center gap-2">
                <div
                  className={`px-4 py-2 rounded-lg font-semibold ${
                    data.outcome === "Win"
                      ? "bg-green-500/20 text-green-300"
                      : data.outcome === "Loss"
                      ? "bg-red-500/20 text-red-300"
                      : "bg-yellow-500/20 text-yellow-300"
                  }`}
                  style={{ fontSize: `${layout.fontSize.label}px` }}
                >
                  {data.outcome}
                </div>
              </div>
            )}
          </div>

          {/* Footer - Branding */}
          {config.showBranding && (
            <div className={`absolute ${logoPositionClass}`}>
              <div
                style={{
                  fontSize: `${layout.fontSize.label}px`,
                  color: layout.colors.primary,
                }}
                className="font-bold flex items-center gap-2"
              >
                <span>profitabledge</span>
              </div>
            </div>
          )}

          {verification ? (
            <div className="absolute bottom-4 right-4">
              <div className="rounded-2xl border border-white/12 bg-black/45 p-2.5 shadow-2xl backdrop-blur-md">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-xl bg-white p-1.5 shadow-lg">
                    <QRCode
                      value={verification.url}
                      size={52}
                      bgColor="#ffffff"
                      fgColor="#0a0e14"
                    />
                  </div>
                  <div className="max-w-[126px]">
                    <p
                      className="uppercase tracking-[0.2em] text-white/52"
                      style={{ fontSize: `${Math.max(9, layout.fontSize.label - 2)}px` }}
                    >
                      Verified by
                    </p>
                    <p
                      className="mt-1 font-bold text-white"
                      style={{ fontSize: `${Math.max(12, layout.fontSize.label)}px` }}
                    >
                      profitabledge
                    </p>
                    <p
                      className="mt-1 text-white/62"
                      style={{ fontSize: `${Math.max(9, layout.fontSize.label - 2)}px` }}
                    >
                      Scan to verify
                    </p>
                    <p
                      className="mt-1 font-mono text-white/52"
                      style={{ fontSize: `${Math.max(8, layout.fontSize.label - 3)}px` }}
                    >
                      {verification.code}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }
);

PnlCardRenderer.displayName = "PnlCardRenderer";
