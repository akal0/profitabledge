export type DashboardBreadcrumbItem = {
  label: string;
  href?: string;
};

export type DashboardBreadcrumbs = {
  items: DashboardBreadcrumbItem[];
};

function formatDashboardLabel(segment: string) {
  return segment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getDashboardBreadcrumbs(
  pathname: string
): DashboardBreadcrumbs {
  const paths = pathname.split("/").filter(Boolean);

  if (paths.length === 1 && paths[0] === "assistant") {
    return {
      items: [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Assistant" },
      ],
    };
  }

  if (paths.length === 1 && paths[0] === "dashboard") {
    return {
      items: [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Overview" },
      ],
    };
  }

  if (paths.length >= 3 && paths[1] === "settings") {
    const subPage = formatDashboardLabel(paths[2]);
    return {
      items: [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Settings", href: "/dashboard/settings" },
        { label: subPage },
      ],
    };
  }

  if (paths.length === 2 && paths[1] === "settings") {
    return {
      items: [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Settings" },
      ],
    };
  }

  if (paths.length >= 3 && paths[1] === "backtest") {
    const subPage = formatDashboardLabel(paths[2]);
    return {
      items: [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Backtesting", href: "/dashboard/backtest" },
        { label: subPage },
      ],
    };
  }

  if (paths.length === 2 && paths[1] === "backtest") {
    return {
      items: [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Backtesting" },
      ],
    };
  }

  if (paths.length >= 3 && paths[1] === "prop-tracker") {
    return {
      items: [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Prop tracker", href: "/dashboard/prop-tracker" },
        { label: "Account details" },
      ],
    };
  }

  if (paths[1]) {
    const current = formatDashboardLabel(paths[1]);
    return {
      items: [{ label: "Dashboard", href: "/dashboard" }, { label: current }],
    };
  }

  return {
    items: [{ label: "Dashboard", href: "/dashboard" }, { label: "Overview" }],
  };
}
