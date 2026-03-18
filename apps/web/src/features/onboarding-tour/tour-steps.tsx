import type { Step } from "onborda";

export const TOUR_ID = "dashboard-tour";

/** Step index for the account-selector step (used to auto-open the dropdown) */
export const ACCOUNT_SELECTOR_TOUR_STEP = 0;

/** Step index for the add-account step (used to auto-open the add-account sheet) */
export const ADD_ACCOUNT_TOUR_STEP = 1;

/** Maps each step index to the nav URL it highlights */
export const TOUR_STEP_URLS: string[] = [
  "/dashboard",           // account-selector step — keep dashboard nav active
  "/dashboard",           // add-account step
  "/dashboard",
  "/dashboard/reports",
  "/dashboard/trades",
  "/dashboard/journal",
  "/dashboard/psychology",
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
        title: "Switch between accounts",
        content:
          "All your connected trading accounts live here. Click to switch between them, or select 'All accounts' to see your combined performance across every account at once.",
        selector: '[data-onborda="account-selector"]',
        side: "right-top",
        showControls: true,
        pointerPadding: 6,
        pointerRadius: 8,
      },
      {
        icon: "",
        title: "Connect your trading account",
        content:
          "Import via CSV, XML or XLSX file, create a manual account and enter trades yourself, or sync directly with your broker for live automatic trade tracking.",
        selector: '[data-onborda="account-selector"]',
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
        title: "Emotions affect the way you trade",
        content:
          "Your head is as important as your setup. Track emotional patterns, your tilt meter, and behavioural tendencies across sessions — so you can spot when you're trading your best, and when to step back.",
        selector: '[data-onborda="nav-dashboard-psychology"]',
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
