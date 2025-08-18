"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { cva, type VariantProps } from "class-variance-authority";

const gradientButtonVariants = cva(
  "rounded-md font-medium leading-none text-white antialiased shadow-md transition-all duration-500 hover:brightness-110 flex items-center justify-center gap-2 w-max cursor-pointer",
  {
    variants: {
      variant: {
        indigo:
          "border border-indigo-400/20 border-b-indigo-600/70 border-t-indigo-400/70 bg-gradient-to-b from-indigo-500 to-indigo-600 ring-1 ring-indigo-600",
        blue: "border border-blue-400/20 border-b-blue-600/70 border-t-blue-400/70 bg-gradient-to-b from-blue-500 to-blue-600 ring-1 ring-blue-600",
        emerald:
          "border border-emerald-400/20 border-b-emerald-600/70 border-t-emerald-400/70 bg-gradient-to-b from-emerald-500 to-emerald-800 ring-1 ring-emerald-800",
        red: "border border-red-400/20 border-b-red-600/70 border-t-red-400/70 bg-gradient-to-b from-red-500 to-red-600 ring-1 ring-red-600",
        purple:
          "border border-purple-400/20 border-b-purple-600/70 border-t-purple-400/70 bg-gradient-to-b from-purple-500 to-purple-600 ring-1 ring-purple-600",
        pink: "border border-pink-400/20 border-b-pink-600/70 border-t-pink-400/70 bg-gradient-to-b from-pink-500 to-pink-600 ring-1 ring-pink-600",
        orange:
          "border border-orange-400/20 border-b-orange-600/70 border-t-orange-400/70 bg-gradient-to-b from-orange-500 to-orange-600 ring-1 ring-orange-600",
        slate:
          "border border-slate-400/20 border-b-slate-600/70 border-t-slate-400/70 bg-gradient-to-b from-slate-500 to-slate-600 ring-1 ring-slate-600",
        cyan: "border border-sky-400/20 border-b-sky-600/70 border-t-sky-400/70 bg-gradient-to-b from-sky-500 to-sky-600 ring-1 ring-sky-600",
      },
      size: {
        sm: "px-2 py-1.5",
        md: "px-4 py-1.5",
      },
    },
    defaultVariants: {
      variant: "indigo",
      size: "md",
    },
  }
);

// Button component with onClick functionality
interface GradientButtonProps
  extends VariantProps<typeof gradientButtonVariants> {
  icon?: React.ReactNode;
  children?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

function GradientButton({
  className,
  variant,
  size,
  icon,
  children,
  onClick,
  ...props
}: GradientButtonProps) {
  const buttonClassName = cn(
    buttonVariants,
    gradientButtonVariants({ variant, size }),
    className
  );

  const content = (
    <>
      {icon && (
        <div className="drop-shadow-[0_2px_1px_rgba(0,0,0,0.3)] size-3 text-white flex items-center justify-center">
          {icon}
        </div>
      )}
      <span className="text-shadow-2xs text-xs font-semibold">{children}</span>
    </>
  );

  if (onClick) {
    return (
      <button className={buttonClassName} onClick={onClick} {...props}>
        {content}
      </button>
    );
  }

  return (
    <div className={buttonClassName} {...props}>
      {content}
    </div>
  );
}

// Link component for href navigation
interface GradientLinkProps
  extends React.ComponentProps<typeof Link>,
    VariantProps<typeof gradientButtonVariants> {
  icon?: React.ReactNode;
  children?: React.ReactNode;
  href: string;
}

const GradientLink = React.forwardRef<HTMLAnchorElement, GradientLinkProps>(
  ({ className, variant, size, icon, children, href, ...props }, ref) => {
    const linkClassName = cn(
      buttonVariants,
      gradientButtonVariants({ variant, size }),
      className,
      "h-max"
    );

    return (
      <Link ref={ref} href={href} className={linkClassName} {...props}>
        {icon && (
          <div className="drop-shadow-[0_2px_1px_rgba(0,0,0,0.3)] size-3 text-white flex items-center justify-center">
            {icon}
          </div>
        )}
        {children && (
          <span className="text-shadow-2xs text-xs font-semibold">
            {children}
          </span>
        )}
      </Link>
    );
  }
);

GradientLink.displayName = "GradientLink";

export { GradientButton, GradientLink, gradientButtonVariants };
export type { GradientButtonProps, GradientLinkProps };
