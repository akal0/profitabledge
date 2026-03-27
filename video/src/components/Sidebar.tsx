import React from "react";
import { interpolate } from "remotion";
import { colors } from "../design-tokens";

interface NavItem {
  label: string;
  active?: boolean;
  icon?: string;
}

interface SidebarProps {
  activeItem: string;
  frame: number;
  startFrame?: number;
}

const navSections: { title: string; items: NavItem[] }[] = [
  {
    title: "Analysis",
    items: [
      { label: "Dashboard", icon: "grid" },
      { label: "Reports", icon: "chart" },
      { label: "Trades", icon: "list" },
      { label: "Journal", icon: "book" },
      { label: "Edges", icon: "layers" },
      { label: "Goals", icon: "target" },
      { label: "Calendar", icon: "calendar" },
    ],
  },
  {
    title: "Accounts",
    items: [
      { label: "Trading accounts", icon: "building" },
      { label: "Prop tracker", icon: "trophy" },
    ],
  },
  {
    title: "Tools",
    items: [{ label: "AI Assistant", icon: "sparkles" }],
  },
];

const iconPaths: Record<string, React.ReactNode> = {
  grid: (
    <path
      d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"
      stroke="currentColor"
      strokeWidth={1.5}
      fill="none"
    />
  ),
  chart: (
    <path
      d="M3 3v18h18M7 16l4-4 4 4 5-5"
      stroke="currentColor"
      strokeWidth={1.5}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  list: (
    <path
      d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
      stroke="currentColor"
      strokeWidth={1.5}
      fill="none"
      strokeLinecap="round"
    />
  ),
  book: (
    <path
      d="M4 19.5A2.5 2.5 0 016.5 17H20M4 4.5A2.5 2.5 0 016.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15z"
      stroke="currentColor"
      strokeWidth={1.5}
      fill="none"
    />
  ),
  layers: (
    <path
      d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
      stroke="currentColor"
      strokeWidth={1.5}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  target: (
    <>
      <circle
        cx={12}
        cy={12}
        r={10}
        stroke="currentColor"
        strokeWidth={1.5}
        fill="none"
      />
      <circle
        cx={12}
        cy={12}
        r={6}
        stroke="currentColor"
        strokeWidth={1.5}
        fill="none"
      />
      <circle
        cx={12}
        cy={12}
        r={2}
        stroke="currentColor"
        strokeWidth={1.5}
        fill="none"
      />
    </>
  ),
  calendar: (
    <path
      d="M12 8v4l3 3M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      stroke="currentColor"
      strokeWidth={1.5}
      fill="none"
      strokeLinecap="round"
    />
  ),
  building: (
    <path
      d="M6 22V4a2 2 0 012-2h8a2 2 0 012 2v18M2 22h20M10 6h.01M14 6h.01M10 10h.01M14 10h.01M10 14h.01M14 14h.01"
      stroke="currentColor"
      strokeWidth={1.5}
      fill="none"
      strokeLinecap="round"
    />
  ),
  trophy: (
    <path
      d="M6 9H4.5a2.5 2.5 0 010-5H6M18 9h1.5a2.5 2.5 0 000-5H18M8 22h8M12 17v5M7 4h10v5a5 5 0 01-10 0V4z"
      stroke="currentColor"
      strokeWidth={1.5}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  sparkles: (
    <path
      d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3zM5 19l.5 1.5L7 21l-1.5.5L5 23l-.5-1.5L3 21l1.5-.5L5 19z"
      stroke="currentColor"
      strokeWidth={1.5}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
};

export const Sidebar: React.FC<SidebarProps> = ({
  activeItem,
  frame,
  startFrame = 0,
}) => {
  let itemIndex = 0;

  return (
    <div
      style={{
        width: 200,
        background: colors.sidebar,
        borderRight: `1px solid ${colors.border}`,
        display: "flex",
        flexDirection: "column",
        padding: "12px 8px",
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      {/* Account selector */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 10px",
          marginBottom: 12,
          borderRadius: 6,
          background: "rgba(255,255,255,0.04)",
          opacity: interpolate(frame - startFrame, [0, 12], [0, 1], {
            extrapolateRight: "clamp",
          }),
          transform: `translateX(${interpolate(
            frame - startFrame,
            [0, 15],
            [-20, 0],
            { extrapolateRight: "clamp" }
          )}px)`,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: colors.teal,
          }}
        />
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "rgba(255,255,255,0.85)",
            fontFamily: "Geist, Inter, sans-serif",
          }}
        >
          FTMO Challenge
        </span>
      </div>

      {navSections.map((section) => (
        <div key={section.title} style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: "rgba(255,255,255,0.35)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              padding: "4px 10px",
              marginBottom: 2,
              opacity: interpolate(
                frame - startFrame,
                [4 + itemIndex * 3, 12 + itemIndex * 3],
                [0, 1],
                { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
              ),
            }}
          >
            {section.title}
          </div>
          {section.items.map((item) => {
            const isActive = item.label === activeItem;
            const idx = itemIndex++;
            const delay = 6 + idx * 4;
            const progress = interpolate(
              frame - startFrame,
              [delay, delay + 10],
              [0, 1],
              { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
            );

            return (
              <div
                key={item.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: isActive ? 500 : 400,
                  color: isActive
                    ? "rgba(255,255,255,0.95)"
                    : "rgba(255,255,255,0.55)",
                  background: isActive
                    ? "rgba(255,255,255,0.06)"
                    : "transparent",
                  fontFamily: "Geist, Inter, sans-serif",
                  opacity: progress,
                  transform: `translateX(${(1 - progress) * -16}px)`,
                  position: "relative",
                }}
              >
                {isActive && (
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 3,
                      height: 16,
                      borderRadius: 2,
                      background: colors.teal,
                    }}
                  />
                )}
                <svg
                  width={16}
                  height={16}
                  viewBox="0 0 24 24"
                  style={{
                    color: isActive
                      ? colors.teal
                      : "rgba(255,255,255,0.45)",
                    flexShrink: 0,
                  }}
                >
                  {item.icon && iconPaths[item.icon]}
                </svg>
                {item.label}
                {item.label === "AI Assistant" && (
                  <span
                    style={{
                      fontSize: 9,
                      padding: "1px 5px",
                      borderRadius: 4,
                      background: "rgba(167,139,250,0.15)",
                      color: "#ddd6fe",
                      marginLeft: "auto",
                    }}
                  >
                    PRO
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};
