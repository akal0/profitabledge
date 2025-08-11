import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icons/Icon";

// Helper function to convert hex to rgba
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

interface VariantButtonProps {
  // Content
  children?: React.ReactNode;
  href: string;
  icon?: string;
  iconPosition?: "left" | "right"; // Position of icon relative to text

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
  textShadow?: boolean | number; // false to disable, number for custom opacity
  iconShadow?: boolean | number; // false to disable, number for custom opacity

  // Sizing
  size?: "sm" | "md" | "lg";
  iconSize?: number;

  // Additional props
  className?: string;
  onClick?: () => void;
}

const sizeVariants = {
  sm: {
    padding: "px-3 py-2.5",
    text: "text-xs",
    iconSize: 12,
  },
  md: {
    padding: "px-3 py-3",
    text: "text-[13px]",
    iconSize: 13,
  },
  lg: {
    padding: "px-6 py-4",
    text: "text-base",
    iconSize: 20,
  },
};

export const VariantButton = ({
  children,
  href,
  icon,
  iconPosition = "left",
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
  onClick,
}: VariantButtonProps) => {
  const sizeConfig = sizeVariants[size];
  const finalIconSize = iconSize || sizeConfig.iconSize;

  // Generate shadow values
  const dropShadowRgba = hexToRgba("#000000", dropShadowOpacity);

  // Build shadow class conditionally
  let shadowParts = [];
  if (innerShadowColor) {
    const innerShadowRgba = hexToRgba(innerShadowColor, innerShadowOpacity);
    shadowParts.push(`inset 0 2px 4px 0 ${innerShadowRgba}`);
  }
  shadowParts.push(`0 2px 4px 0 ${dropShadowRgba}`);
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

  const iconElement = icon && (
    <Icon
      icon={icon}
      size={finalIconSize}
      inactiveColor={iconColor || textColor}
      inactiveFillColor={iconFillColor}
      inactiveStrokeColor={iconStrokeColor}
      dropShadow={getIconDropShadow()}
    />
  );

  const textElement = children && (
    <span className={cn("font-semibold", getTextShadowClass())}>
      {children}
    </span>
  );

  const buttonContent = (
    <>
      {iconPosition === "left" ? (
        <>
          {iconElement}
          {textElement}
        </>
      ) : (
        <>
          {textElement}
          {iconElement}
        </>
      )}
    </>
  );

  const buttonClasses = cn(
    "rounded-[8px]",
    sizeConfig.text,
    sizeConfig.padding,
    "font-medium leading-none antialiased",
    "transition-all duration-500",
    "hover:brightness-110",
    "flex items-center justify-center gap-1.5",
    shadowClass,
    className
  );

  const buttonStyle = {
    background: `linear-gradient(to bottom, ${gradientFrom}, ${gradientTo})`,
    borderColor: borderColor
      ? hexToRgba(borderColor, borderOpacity)
      : hexToRgba(gradientTo, borderOpacity),
    color: textColor,
  } as React.CSSProperties;

  if (onClick) {
    return (
      <button
        className={cn(buttonClasses, "border cursor-pointer")}
        style={buttonStyle}
        onClick={onClick}
      >
        {buttonContent}
      </button>
    );
  }

  return (
    <Link
      href={href}
      className={cn(buttonClasses, "border")}
      style={buttonStyle}
    >
      {buttonContent}
    </Link>
  );
};
