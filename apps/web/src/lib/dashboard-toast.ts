import type { ToasterProps } from "sonner";

const AUTH_ONBOARDING_TOAST_PATHS = new Set([
  "/login",
  "/onboarding",
  "/sign-up",
]);

export const DASHBOARD_TOAST_CLASSNAMES: NonNullable<
  NonNullable<ToasterProps["toastOptions"]>["classNames"]
> = {
  toast: "bg-sidebar ring-white/10 text-white !min-w-[300px] !max-w-[500px]",
  title: "text-white font-medium",
  description: "text-white/70",
  actionButton:
    "bg-teal-500/20 text-teal-400 hover:bg-teal-500/30 ring-teal-500/30",
};

export function shouldUseDashboardToastTheme(
  pathname: string | null | undefined
) {
  return Boolean(pathname && AUTH_ONBOARDING_TOAST_PATHS.has(pathname));
}
