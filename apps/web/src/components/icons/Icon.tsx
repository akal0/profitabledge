"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface IconProps {
  icon: string;
  className?: string;
  isActive?: boolean;
  isHovered?: boolean;
  activeColor?: string;
  inactiveColor?: string;
  hoverColor?: string;
  activeFillColor?: string;
  inactiveFillColor?: string;
  hoverFillColor?: string;
  activeStrokeColor?: string;
  inactiveStrokeColor?: string;
  hoverStrokeColor?: string;
  size?: number;
  dropShadow?: string;
}

// Available icons based on your public/icons folder
const availableIcons = [
  "account",
  "calendar",
  "dashboard",
  "edgebot",
  "journal",
  "reports",
  "selector",
  "lightning",
  "clock",
  "edit-widgets",
  "balance",
  "winrate",
  "winstreak",
  "profit-factor",
  "arrow-up-right",
  "resync",
];

export const Icon = ({
  icon,
  className,
  isActive = false,
  isHovered = false,
  activeColor = "#1E88E5",
  inactiveColor = "#8B8B97",
  hoverColor = "#1E88E5",
  activeFillColor,
  inactiveFillColor,
  hoverFillColor,
  activeStrokeColor,
  inactiveStrokeColor,
  hoverStrokeColor,
  size = 12,
  dropShadow,
}: IconProps) => {
  const [svgContent, setSvgContent] = React.useState<string>("");

  React.useEffect(() => {
    if (!availableIcons.includes(icon)) {
      console.warn(
        `Icon "${icon}" not found. Available icons: ${availableIcons.join(
          ", "
        )}`
      );
      return;
    }

    fetch(`/icons/${icon}.svg`)
      .then((response) => response.text())
      .then((svg) => {
        // Determine fill color with fallback to main color
        const currentFillColor = isActive
          ? activeFillColor || activeColor
          : isHovered
          ? hoverFillColor || hoverColor
          : inactiveFillColor || inactiveColor;

        // Determine stroke color with fallback to main color
        const currentStrokeColor = isActive
          ? activeStrokeColor || activeColor
          : isHovered
          ? hoverStrokeColor || hoverColor
          : inactiveStrokeColor || inactiveColor;

        // Update fill and stroke attributes separately
        let colorizedSvg = svg.replace(
          /fill="[^"]*"/g,
          `fill="${currentFillColor}"`
        );
        colorizedSvg = colorizedSvg.replace(
          /stroke="[^"]*"/g,
          `stroke="${currentStrokeColor}"`
        );

        // Update width and height attributes to match our size
        colorizedSvg = colorizedSvg.replace(
          /width="[^"]*"/g,
          `width="${size}"`
        );
        colorizedSvg = colorizedSvg.replace(
          /height="[^"]*"/g,
          `height="${size}"`
        );

        setSvgContent(colorizedSvg);
      })
      .catch((err) => console.error(`Failed to load icon ${icon}:`, err));
  }, [
    icon,
    isActive,
    isHovered,
    activeColor,
    inactiveColor,
    hoverColor,
    activeFillColor,
    inactiveFillColor,
    hoverFillColor,
    activeStrokeColor,
    inactiveStrokeColor,
    hoverStrokeColor,
    size,
  ]);

  if (!availableIcons.includes(icon)) {
    return null;
  }

  return (
    <div
      className={cn("shrink-0", className)}
      style={{
        width: size,
        height: size,
        filter: dropShadow ? `drop-shadow(${dropShadow})` : undefined,
      }}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
};
