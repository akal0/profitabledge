"use client";

import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  DASHBOARD_TOAST_CLASSNAMES,
  shouldUseDashboardToastTheme,
} from "@/lib/dashboard-toast";

const Toaster = ({ toastOptions, ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const pathname = usePathname();
  const resolvedToastOptions = shouldUseDashboardToastTheme(pathname)
    ? {
        ...toastOptions,
        classNames: {
          ...DASHBOARD_TOAST_CLASSNAMES,
          ...toastOptions?.classNames,
        },
      }
    : toastOptions;

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      toastOptions={resolvedToastOptions}
      {...props}
    />
  );
};

export { Toaster };
