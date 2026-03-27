import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { colors, springs } from "../design-tokens";
import { AppWindow } from "../components/AppWindow";
import { Sidebar } from "../components/Sidebar";

interface Trade {
  symbol: string;
  direction: "Long" | "Short";
  session: string;
  sessionColor: { ring: string; bg: string; text: string };
  edge: string;
  outcome: string;
  outcomeColor: { ring: string; bg: string; text: string };
  profit: string;
  profitColor: string;
}

const trades: Trade[] = [
  {
    symbol: "EURUSD",
    direction: "Long",
    session: "London",
    sessionColor: { ring: colors.pillVioletRing, bg: colors.pillVioletBg, text: colors.pillVioletText },
    edge: "ICT Silver Bullet",
    outcome: "Win",
    outcomeColor: { ring: colors.pillWinRing, bg: colors.pillWinBg, text: colors.pillWinText },
    profit: "+$342.80",
    profitColor: colors.teal,
  },
  {
    symbol: "XAUUSD",
    direction: "Short",
    session: "New York",
    sessionColor: { ring: colors.pillInfoRing, bg: colors.pillInfoBg, text: colors.pillInfoText },
    edge: "Order Block Sweep",
    outcome: "Win",
    outcomeColor: { ring: colors.pillWinRing, bg: colors.pillWinBg, text: colors.pillWinText },
    profit: "+$1,247.50",
    profitColor: colors.teal,
  },
  {
    symbol: "NAS100",
    direction: "Long",
    session: "New York",
    sessionColor: { ring: colors.pillInfoRing, bg: colors.pillInfoBg, text: colors.pillInfoText },
    edge: "Displacement Entry",
    outcome: "Loss",
    outcomeColor: { ring: colors.pillLossRing, bg: colors.pillLossBg, text: colors.pillLossText },
    profit: "-$580.00",
    profitColor: colors.danger,
  },
  {
    symbol: "GBPUSD",
    direction: "Short",
    session: "London",
    sessionColor: { ring: colors.pillVioletRing, bg: colors.pillVioletBg, text: colors.pillVioletText },
    edge: "ICT Silver Bullet",
    outcome: "Win",
    outcomeColor: { ring: colors.pillWinRing, bg: colors.pillWinBg, text: colors.pillWinText },
    profit: "+$285.00",
    profitColor: colors.teal,
  },
  {
    symbol: "US30",
    direction: "Long",
    session: "New York",
    sessionColor: { ring: colors.pillInfoRing, bg: colors.pillInfoBg, text: colors.pillInfoText },
    edge: "Breaker Block",
    outcome: "BE",
    outcomeColor: { ring: colors.pillNeutralRing, bg: colors.pillNeutralBg, text: colors.pillNeutralText },
    profit: "+$0.00",
    profitColor: "rgba(255,255,255,0.5)",
  },
  {
    symbol: "EURUSD",
    direction: "Short",
    session: "Tokyo",
    sessionColor: { ring: colors.pillAmberRing, bg: colors.pillAmberBg, text: colors.pillAmberText },
    edge: "Asian Range Play",
    outcome: "Loss",
    outcomeColor: { ring: colors.pillLossRing, bg: colors.pillLossBg, text: colors.pillLossText },
    profit: "-$180.50",
    profitColor: colors.danger,
  },
  {
    symbol: "XAUUSD",
    direction: "Long",
    session: "London",
    sessionColor: { ring: colors.pillVioletRing, bg: colors.pillVioletBg, text: colors.pillVioletText },
    edge: "Order Block Sweep",
    outcome: "Win",
    outcomeColor: { ring: colors.pillWinRing, bg: colors.pillWinBg, text: colors.pillWinText },
    profit: "+$890.00",
    profitColor: colors.teal,
  },
  {
    symbol: "GBPUSD",
    direction: "Long",
    session: "New York",
    sessionColor: { ring: colors.pillInfoRing, bg: colors.pillInfoBg, text: colors.pillInfoText },
    edge: "Displacement Entry",
    outcome: "PW",
    outcomeColor: { ring: colors.pillWarningRing, bg: colors.pillWarningBg, text: colors.pillWarningText },
    profit: "+$124.60",
    profitColor: colors.warning,
  },
];

const Pill: React.FC<{
  text: string;
  ring: string;
  bg: string;
  textColor: string;
}> = ({ text, ring, bg, textColor }) => (
  <div
    style={{
      fontSize: 10,
      padding: "2px 8px",
      borderRadius: 20,
      background: bg,
      border: `1px solid ${ring}`,
      color: textColor,
      whiteSpace: "nowrap",
      fontWeight: 500,
    }}
  >
    {text}
  </div>
);

export const Scene3Trades: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const windowSpring = spring({
    frame,
    fps,
    config: springs.windowEntrance,
  });
  const windowScale = interpolate(windowSpring, [0, 1], [0.92, 1]);
  const windowOpacity = interpolate(windowSpring, [0, 1], [0, 1]);

  // Toolbar slide
  const toolbarY = interpolate(frame, [8, 22], [-16, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const toolbarOpacity = interpolate(frame, [8, 22], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // Header row
  const headerOpacity = interpolate(frame, [20, 30], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // Hover highlight row
  const hoverRow = frame > 140 && frame < 175 ? 1 : -1;

  // Detail sheet
  const detailSheetX = interpolate(frame, [155, 175], [200, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const detailSheetOpacity = interpolate(frame, [155, 175], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // Fade out
  const fadeOut = interpolate(frame, [190, 210], [1, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  const columns = ["Symbol", "Dir", "Session", "Edge", "Outcome", "Profit"];
  const colWidths = [72, 48, 80, 140, 64, 80];

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: colors.background,
        fontFamily: "Geist, Inter, sans-serif",
        opacity: fadeOut,
      }}
    >
      <div
        style={{
          transform: `scale(${windowScale})`,
          opacity: windowOpacity,
          transformOrigin: "center center",
          width: "100%",
          height: "100%",
        }}
      >
        <AppWindow>
          <Sidebar activeItem="Trades" frame={frame} startFrame={5} />
          <div
            style={{
              flex: 1,
              padding: 16,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              position: "relative",
            }}
          >
            {/* Toolbar */}
            <div
              style={{
                display: "flex",
                gap: 6,
                alignItems: "center",
                opacity: toolbarOpacity,
                transform: `translateY(${toolbarY}px)`,
              }}
            >
              {["Filter", "Search...", "Group by: Session", "Table view", "PnL"].map(
                (btn, i) => (
                  <div
                    key={btn}
                    style={{
                      fontSize: 11,
                      padding: "5px 10px",
                      borderRadius: 6,
                      background:
                        btn === "Group by: Session"
                          ? "rgba(20,184,166,0.1)"
                          : "rgba(255,255,255,0.04)",
                      border: `1px solid ${btn === "Group by: Session" ? "rgba(20,184,166,0.2)" : "rgba(255,255,255,0.08)"}`,
                      color:
                        btn === "Group by: Session"
                          ? colors.teal
                          : "rgba(255,255,255,0.55)",
                      fontWeight: btn === "Group by: Session" ? 500 : 400,
                    }}
                  >
                    {btn}
                  </div>
                )
              )}
            </div>

            {/* Date group header */}
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "rgba(255,255,255,0.7)",
                padding: "4px 0",
                opacity: headerOpacity,
              }}
            >
              Monday, March 25
            </div>

            {/* Table header */}
            <div
              style={{
                display: "flex",
                gap: 0,
                padding: "6px 12px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                opacity: headerOpacity,
              }}
            >
              {columns.map((col, ci) => (
                <div
                  key={col}
                  style={{
                    width: colWidths[ci],
                    fontSize: 10,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.35)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    textAlign: col === "Profit" ? "right" : "left",
                  }}
                >
                  {col}
                </div>
              ))}
            </div>

            {/* Table rows */}
            {trades.map((trade, i) => {
              const delay = 30 + i * 5;
              const rowSpring = spring({
                frame: frame - delay,
                fps,
                config: springs.elementReveal,
              });
              const rowOpacity = interpolate(rowSpring, [0, 1], [0, 1]);
              const rowY = interpolate(rowSpring, [0, 1], [12, 0]);

              // Profit pill flash
              const flashBrightness =
                frame > delay + 5 && frame < delay + 12
                  ? interpolate(frame, [delay + 5, delay + 8, delay + 12], [1, 1.8, 1], {
                      extrapolateRight: "clamp",
                      extrapolateLeft: "clamp",
                    })
                  : 1;

              const isHovered = i === hoverRow;

              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 0,
                    padding: "7px 12px",
                    alignItems: "center",
                    borderBottom: "1px solid rgba(255,255,255,0.03)",
                    opacity: rowOpacity,
                    transform: `translateY(${rowY}px)`,
                    background: isHovered
                      ? "rgba(255,255,255,0.04)"
                      : "transparent",
                    borderRadius: isHovered ? 6 : 0,
                    transition: "background 0.15s",
                  }}
                >
                  <div
                    style={{
                      width: colWidths[0],
                      fontSize: 12,
                      fontWeight: 600,
                      color: colors.foreground,
                    }}
                  >
                    {trade.symbol}
                  </div>
                  <div
                    style={{
                      width: colWidths[1],
                      fontSize: 11,
                      color:
                        trade.direction === "Long"
                          ? colors.teal
                          : colors.danger,
                    }}
                  >
                    {trade.direction}
                  </div>
                  <div style={{ width: colWidths[2] }}>
                    <Pill
                      text={trade.session}
                      ring={trade.sessionColor.ring}
                      bg={trade.sessionColor.bg}
                      textColor={trade.sessionColor.text}
                    />
                  </div>
                  <div
                    style={{
                      width: colWidths[3],
                      fontSize: 11,
                      color: "rgba(255,255,255,0.6)",
                    }}
                  >
                    {trade.edge}
                  </div>
                  <div style={{ width: colWidths[4] }}>
                    <Pill
                      text={trade.outcome}
                      ring={trade.outcomeColor.ring}
                      bg={trade.outcomeColor.bg}
                      textColor={trade.outcomeColor.text}
                    />
                  </div>
                  <div
                    style={{
                      width: colWidths[5],
                      fontSize: 12,
                      fontWeight: 600,
                      color: trade.profitColor,
                      textAlign: "right",
                      filter: `brightness(${flashBrightness})`,
                    }}
                  >
                    {trade.profit}
                  </div>
                </div>
              );
            })}

            {/* Detail sheet sliding in */}
            {frame > 150 && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: 220,
                  background: colors.sidebar,
                  borderLeft: `1px solid ${colors.border}`,
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  opacity: detailSheetOpacity,
                  transform: `translateX(${detailSheetX}px)`,
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: colors.foreground,
                  }}
                >
                  XAUUSD
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
                  Short · New York · Mar 25
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: colors.teal,
                  }}
                >
                  +$1,247.50
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    marginTop: 8,
                  }}
                >
                  {[
                    ["R:R", "3.2R"],
                    ["Edge", "Order Block Sweep"],
                    ["Duration", "47 min"],
                    ["Risk", "$389.84"],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 11,
                      }}
                    >
                      <span style={{ color: "rgba(255,255,255,0.4)" }}>
                        {label}
                      </span>
                      <span style={{ color: "rgba(255,255,255,0.8)", fontWeight: 500 }}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </AppWindow>
      </div>
    </div>
  );
};
