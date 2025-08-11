import React from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icons/Icon";

// Helper function to convert hex to rgba
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

interface VariantBadgeProps {
  // Content
  children?: React.ReactNode;
  icon?: string;

  // Styling
  gradientFrom: string;
  gradientTo: string;
  borderColor?: string;
  borderOpacity?: number;
  textColor?: string;
  iconColor?: string;
  iconFillColor?: string;
  iconStrokeColor?: string;

  // Shadows
  innerShadowColor?: string;
  innerShadowOpacity?: number;
  dropShadowOpacity?: number;
  textShadow?: boolean | number;
  iconShadow?: boolean | number;

  // Sizing
  size?: "sm" | "md" | "lg" | "card" | "streak";
  iconSize?: number;

  // Additional props
  className?: string;
}

const sizeVariants = {
  sm: {
    padding: "px-2 py-1",
    text: "text-xs",
    iconSize: 10,
  },
  md: {
    padding: "px-4 py-1.5",
    text: "text-xs",
    iconSize: 12,
  },
  lg: {
    padding: "px-6 py-2",
    text: "text-sm",
    iconSize: 14,
  },
  card: {
    padding: "p-1",
    text: "text-xs",
    iconSize: 16,
  },
  streak: {
    padding: "px-2 py-1.5",
    text: "text-xs",
    iconSize: 12,
  },
};

export const VariantBadge = ({
  children,
  icon,
  gradientFrom,
  gradientTo,
  borderColor,
  borderOpacity = 1,
  textColor = "#ffffff",
  iconColor,
  iconFillColor,
  iconStrokeColor,
  innerShadowColor,
  innerShadowOpacity = 0.8,
  dropShadowOpacity = 0.15,
  textShadow = 0.3,
  iconShadow = 0.3,
  size = "md",
  iconSize,
  className,
}: VariantBadgeProps) => {
  const sizeConfig = sizeVariants[size];
  const finalIconSize = iconSize || sizeConfig.iconSize;

  // Generate shadow values
  const dropShadowRgba = hexToRgba("#000000", dropShadowOpacity);

  // Build shadow class conditionally
  let shadowParts = [];
  if (innerShadowColor) {
    const innerShadowRgba = hexToRgba(innerShadowColor, innerShadowOpacity);
    shadowParts.push(`inset_0_2px_4px_0_${innerShadowRgba}`);
  }
  shadowParts.push(`0_2px_4px_0_${dropShadowRgba}`);
  const shadowClass = `shadow-[${shadowParts.join(",")}]`;

  // Text shadow handling
  const getTextShadowClass = () => {
    if (textShadow === false) return "text-shadow-none";
    const opacity = typeof textShadow === "number" ? textShadow : 0.3;
    if (opacity <= 0.35) return "text-shadow-sm";
    return "text-shadow-md";
  };

  // Icon shadow handling
  const getIconDropShadow = () => {
    if (iconShadow === false) return undefined;
    const opacity = typeof iconShadow === "number" ? iconShadow : 0.3;
    const iconDropShadowRgba = hexToRgba("#000000", opacity);
    return `0 1px 2px ${iconDropShadowRgba}`;
  };

  const badgeContent = (
    <>
      {icon && (
        <Icon
          icon={icon}
          size={finalIconSize}
          inactiveColor={iconColor || textColor}
          inactiveFillColor={iconFillColor}
          inactiveStrokeColor={iconStrokeColor}
          dropShadow={getIconDropShadow()}
        />
      )}
      {children && (
        <span className={cn("font-semibold", getTextShadowClass())}>
          {children}
        </span>
      )}
    </>
  );

  const badgeClasses = cn(
    "rounded-[6px]",
    "inline-flex items-center justify-center gap-1.5",
    sizeConfig.text,
    sizeConfig.padding,
    "font-medium leading-none antialiased",
    "border",
    shadowClass,
    className
  );

  const badgeStyle = {
    background: `linear-gradient(to bottom, ${gradientFrom}, ${gradientTo})`,
    borderColor: borderColor
      ? hexToRgba(borderColor, borderOpacity)
      : hexToRgba(gradientTo, borderOpacity),
    color: textColor,
  } as React.CSSProperties;

  return (
    <div className={badgeClasses} style={badgeStyle}>
      {badgeContent}
    </div>
  );
};
