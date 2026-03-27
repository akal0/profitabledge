// Design tokens from profitabledge codebase
// Colors sourced from apps/web/src/index.css dark theme

export const colors = {
  background: "oklch(0.145 0 0)",
  dashboardBackground: "oklch(0.232 0.0057 285.95)",
  sidebar: "oklch(0.2011 0.0039 286.04)",
  sidebarAccent: "oklch(0.232 0.0057 285.95)",
  card: "oklch(0.2739 0.0055 286.03)",
  foreground: "oklch(0.985 0 0)",
  border: "rgba(255,255,255,0.1)",
  borderSubtle: "rgba(255,255,255,0.05)",
  muted: "rgba(255,255,255,0.5)",
  mutedForeground: "rgba(255,255,255,0.45)",

  // Brand
  teal: "#14b8a6",
  tealLight: "#2dd4bf",
  tealDark: "#0d9488",

  // Semantic
  success: "#34d399",
  danger: "#fb7185",
  warning: "#fbbf24",
  info: "#60a5fa",

  // Pill tones
  pillWinRing: "rgba(45,212,191,0.2)",
  pillWinBg: "rgba(45,212,191,0.12)",
  pillWinText: "#99f6e4",
  pillLossRing: "rgba(251,113,133,0.2)",
  pillLossBg: "rgba(251,113,133,0.12)",
  pillLossText: "#fecdd3",
  pillNeutralRing: "rgba(255,255,255,0.1)",
  pillNeutralBg: "rgba(255,255,255,0.035)",
  pillNeutralText: "rgba(255,255,255,0.65)",
  pillInfoRing: "rgba(96,165,250,0.2)",
  pillInfoBg: "rgba(96,165,250,0.12)",
  pillInfoText: "#bfdbfe",
  pillVioletRing: "rgba(167,139,250,0.2)",
  pillVioletBg: "rgba(167,139,250,0.12)",
  pillVioletText: "#ddd6fe",
  pillAmberRing: "rgba(251,191,36,0.2)",
  pillAmberBg: "rgba(251,191,36,0.12)",
  pillAmberText: "#fde68a",
  pillWarningRing: "rgba(251,191,36,0.2)",
  pillWarningBg: "rgba(251,191,36,0.12)",
  pillWarningText: "#fde68a",

  // Traffic lights
  trafficRed: "#FF5F56",
  trafficYellow: "#FFBD2E",
  trafficGreen: "#27C93F",

  // Chart palette
  chart1: "#14b8a6",
  chart2: "#fb7185",
  chart3: "#60a5fa",
  chart4: "#a78bfa",
  chart5: "#fbbf24",
} as const;

// Spring configurations for Remotion
export const springs = {
  elementReveal: { stiffness: 160, damping: 20, mass: 1 },
  windowEntrance: { stiffness: 200, damping: 22, mass: 1 },
  menuDropdown: { stiffness: 300, damping: 25, mass: 0.8 },
} as const;

// Video dimensions
export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 700;
export const VIDEO_FPS = 30;

// Scene frame counts
export const SCENE_FRAMES = {
  brandReveal: 120,
  dashboard: 210,
  trades: 210,
  journal: 195,
  aiAssistant: 210,
  edges: 180,
  goals: 180,
  reports: 195,
  closing: 150,
} as const;

export const TOTAL_FRAMES = Object.values(SCENE_FRAMES).reduce((a, b) => a + b, 0);

// Scene start frames (cumulative)
export const SCENE_STARTS = {
  brandReveal: 0,
  dashboard: 120,
  trades: 330,
  journal: 540,
  aiAssistant: 735,
  edges: 945,
  goals: 1125,
  reports: 1305,
  closing: 1500,
} as const;
