import type { Step } from "onborda";

export const TOUR_ID = "dashboard-tour";

/** Step index for the "Add an account" trigger step */
export const ADD_ACCOUNT_TRIGGER_TOUR_STEP = 0;

/** First step index for the add-account sheet steps */
export const ADD_ACCOUNT_SHEET_FIRST_STEP = 1;

/** Last step index for the add-account sheet steps */
export const ADD_ACCOUNT_SHEET_LAST_STEP = 5;

/** Buffer to keep the sheet-tour suppression active until the close animation finishes */
export const ADD_ACCOUNT_SHEET_CLOSE_DURATION_MS = 320;

/** Maps each sheet step index to its option key */
export const SHEET_OPTION_BY_STEP: Record<number, string> = {
  1: "csv",
  2: "manual",
  3: "broker",
  4: "ea",
  5: "demo",
};

/** Maps each step index to the nav URL it highlights */
export const TOUR_STEP_URLS: string[] = [
  "/dashboard",           // 0: add-account trigger
  "/dashboard",           // 1: import via file
  "/dashboard",           // 2: manual account
  "/dashboard",           // 3: broker sync
  "/dashboard",           // 4: ea sync
  "/dashboard",           // 5: demo data
  "/dashboard",           // 6: dashboard nav
  "/dashboard/reports",
  "/dashboard/trades",
  "/dashboard/journal",
  "/dashboard/goals",
  "/dashboard/accounts",
  "/dashboard/prop-tracker",
  "/assistant",
];

interface Tour {
  tour: string;
  steps: Step[];
}

export const DASHBOARD_TOURS: Tour[] = [
  {
    tour: TOUR_ID,
    steps: [
      {
        icon: "",
        title: "Add an account",
        content:
          "Start here to connect your first trading account. You can import statements, connect a broker, set up the MT5 EA bridge, or create a manual account.",
        selector: '[data-onborda="add-account-trigger"]',
        side: "right-top",
        showControls: true,
        pointerPadding: 6,
        pointerRadius: 8,
      },
      {
        icon: "",
        title: "Import via file",
        content:
          "Upload a CSV, XML, or XLSX statement export from your broker and we'll create an account from it automatically.",
        selector: '[data-onborda="sheet-option-csv"]',
        side: "right-top",
        showControls: true,
        pointerPadding: 6,
        pointerRadius: 8,
      },
      {
        icon: "",
        title: "Manual account",
        content:
          "Create a blank account first, then log your trades by hand directly inside the platform — full control, zero automation required.",
        selector: '[data-onborda="sheet-option-manual"]',
        side: "right-top",
        showControls: true,
        pointerPadding: 6,
        pointerRadius: 8,
      },
      {
        icon: "",
        title: "Broker sync",
        content:
          "Connect via the Connections page and your trades sync automatically whenever you open or close a position — nothing to import manually.",
        selector: '[data-onborda="sheet-option-broker"]',
        side: "right-top",
        showControls: true,
        pointerPadding: 6,
        pointerRadius: 8,
      },
      {
        icon: "",
        title: "EA sync",
        content:
          "Install the MT5 EA bridge on your terminal for real-time sync with richer intra-trade metrics like MAE, MFE and partial fill tracking.",
        selector: '[data-onborda="sheet-option-ea"]',
        side: "right-top",
        showControls: true,
        pointerPadding: 6,
        pointerRadius: 8,
      },
      {
        icon: "",
        title: "Explore with demo data",
        content:
          "Not ready to connect a live account? Spin up a fully-seeded demo workspace with historical trades and live positions so you can explore every feature straight away.",
        selector: '[data-onborda="sheet-option-demo"]',
        side: "right-top",
        showControls: true,
        pointerPadding: 6,
        pointerRadius: 8,
      },
      {
        icon: "",
        title: "Your trading dashboard",
        content:
          "Get a bird's eye view of your performance. Need to know the average hold time for this month? The calendar's got you. Need to know what session you perform the best? We've got a widget for that!",
        selector: '[data-onborda="nav-dashboard"]',
        side: "right",
        showControls: true,
        pointerPadding: 6,
        pointerRadius: 6,
      },
      {
        icon: "",
        title: "Reports & analytics",
        content:
          "Dig deeper with advanced charts. Equity curve, drawdown, performance heatmap, R-multiple distribution and more — giving you the data to understand exactly where your edge lives.",
        selector: '[data-onborda="nav-dashboard-reports"]',
        side: "right",
        showControls: true,
        pointerPadding: 6,
        pointerRadius: 6,
      },
      {
        icon: "",
        title: "Everything's recorded in this table",
        content:
          "Every trade you've ever taken, in one place. See pips you're leaving on the table (MAE/MFE), your realised R:R, entry and exit times, hold duration, and every metric that matters for reviewing your execution.",
        selector: '[data-onborda="nav-dashboard-trades"]',
        side: "right",
        showControls: true,
        pointerPadding: 6,
        pointerRadius: 6,
      },
      {
        icon: "",
        title: "Where the note taking really happens",
        content:
          "Document your sessions in rich text. Record your pre-trade mindset, post-trade reflections, and anything that shapes your edge. Entries are linked to your trading days so you can look back at any moment.",
        selector: '[data-onborda="nav-dashboard-journal"]',
        side: "right",
        showControls: true,
        pointerPadding: 6,
        pointerRadius: 6,
      },
      {
        icon: "",
        title: "Set your sights on a target",
        content:
          "Set targets that keep you accountable. Define monthly profit goals, win rate benchmarks, max drawdown limits and more. Check in daily to see where you stand against what you set out to achieve.",
        selector: '[data-onborda="nav-dashboard-goals"]',
        side: "right",
        showControls: true,
        pointerPadding: 6,
        pointerRadius: 6,
      },
      {
        icon: "",
        title: "All your accounts, in one place",
        content:
          "Manage all your connected broker accounts here. Import trades via EA, CSV, or manual entry. Switch between accounts at any time using the account selector at the top of the sidebar.",
        selector: '[data-onborda="nav-dashboard-accounts"]',
        side: "right",
        showControls: true,
        pointerPadding: 6,
        pointerRadius: 6,
      },
      {
        icon: "",
        title: "Never blow a prop rule again",
        content:
          "Running a funded challenge or already passed one? Track your daily loss limit, max drawdown, profit target and consistency score across every firm in real time — so you always know exactly where you stand before you click buy or sell.",
        selector: '[data-onborda="nav-dashboard-prop-tracker"]',
        side: "right",
        showControls: true,
        pointerPadding: 6,
        pointerRadius: 6,
      },
      {
        icon: "",
        title: "Your trades tell a story",
        content:
          "The AI Assistant reads it. Sync your account and get a breakdown of what's costing you money, what's working, and exactly what to tighten up — all in plain language, without leaving the platform.",
        selector: '[data-onborda="nav-assistant"]',
        side: "right",
        showControls: true,
        pointerPadding: 6,
        pointerRadius: 6,
      },
    ],
  },
];
