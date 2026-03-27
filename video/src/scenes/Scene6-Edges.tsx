import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { colors, springs } from "../design-tokens";
import { AppWindow } from "../components/AppWindow";
import { Sidebar } from "../components/Sidebar";

const metrics = [
  { label: "Avg win rate", value: "64.2%", icon: "target", color: colors.teal },
  { label: "Tagged trades", value: "284", icon: "tag", color: colors.info },
  { label: "Net P&L", value: "$8,420", icon: "dollar", color: colors.success },
  { label: "Ready edges", value: "3", icon: "check", color: colors.tealLight },
];

const edges = [
  {
    name: "ICT Silver Bullet",
    dot: colors.teal,
    status: "Public",
    trades: 87,
    winRate: "68.2%",
    pnl: "$4,280",
    pnlColor: colors.teal,
    ready: true,
  },
  {
    name: "Order Block Sweep",
    dot: colors.info,
    status: "Private",
    trades: 52,
    winRate: "61.5%",
    pnl: "$2,890",
    pnlColor: colors.teal,
    ready: true,
  },
  {
    name: "Displacement Entry",
    dot: "#a78bfa",
    status: "Fork",
    trades: 63,
    winRate: "58.7%",
    pnl: "$1,420",
    pnlColor: colors.teal,
    ready: true,
  },
  {
    name: "Asian Range Play",
    dot: colors.warning,
    status: "Private",
    trades: 34,
    winRate: "41.2%",
    pnl: "-$340",
    pnlColor: colors.danger,
    ready: false,
  },
  {
    name: "Breaker Block",
    dot: colors.danger,
    status: "Private",
    trades: 48,
    winRate: "56.3%",
    pnl: "$170",
    pnlColor: colors.teal,
    ready: false,
  },
];

export const Scene6Edges: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const windowSpring = spring({ frame, fps, config: springs.windowEntrance });
  const windowScale = interpolate(windowSpring, [0, 1], [0.92, 1]);
  const windowOpacity = interpolate(windowSpring, [0, 1], [0, 1]);

  // Fade out
  const fadeOut = interpolate(frame, [160, 180], [1, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // Hover highlight
  const hoverRow = frame > 130 && frame < 160 ? 0 : -1;

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
          <Sidebar activeItem="Edges" frame={frame} startFrame={5} />
          <div
            style={{
              flex: 1,
              padding: 20,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            {/* Header */}
            <div
              style={{
                opacity: interpolate(frame, [8, 20], [0, 1], {
                  extrapolateRight: "clamp",
                  extrapolateLeft: "clamp",
                }),
                transform: `translateY(${interpolate(frame, [8, 20], [12, 0], {
                  extrapolateRight: "clamp",
                  extrapolateLeft: "clamp",
                })}px)`,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: colors.teal,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 4,
                }}
              >
                Your Edge library
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: colors.foreground,
                  marginBottom: 4,
                }}
              >
                Edges
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.5)",
                  marginBottom: 10,
                }}
              >
                Track, measure, and validate your trading setups.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div
                  style={{
                    fontSize: 11,
                    padding: "6px 14px",
                    borderRadius: 6,
                    background: colors.teal,
                    color: "#000",
                    fontWeight: 600,
                  }}
                >
                  Create Edge
                </div>
                <div
                  style={{
                    fontSize: 11,
                    padding: "6px 14px",
                    borderRadius: 6,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.7)",
                    fontWeight: 500,
                  }}
                >
                  Browse Library
                </div>
              </div>
            </div>

            {/* Metric cards - GoalSurface style */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 8,
              }}
            >
              {metrics.map((m, i) => {
                const delay = 25 + i * 8;
                const cardSpring = spring({
                  frame: frame - delay,
                  fps,
                  config: springs.elementReveal,
                });
                const cardY = interpolate(cardSpring, [0, 1], [24, 0]);
                const cardOpacity = interpolate(cardSpring, [0, 1], [0, 1]);
                const counterProgress = interpolate(
                  frame,
                  [delay + 10, delay + 50],
                  [0, 1],
                  {
                    extrapolateRight: "clamp",
                    extrapolateLeft: "clamp",
                    easing: Easing.out(Easing.cubic),
                  }
                );

                return (
                  <div
                    key={m.label}
                    style={{
                      borderRadius: 8,
                      border: `1px solid ${colors.borderSubtle}`,
                      background: colors.sidebar,
                      padding: 3,
                      opacity: cardOpacity,
                      transform: `translateY(${cardY}px)`,
                    }}
                  >
                    <div
                      style={{
                        borderRadius: 5,
                        background: colors.sidebarAccent,
                        border: `1px solid ${colors.borderSubtle}`,
                        padding: "10px 12px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          color: "rgba(255,255,255,0.45)",
                          fontWeight: 500,
                          marginBottom: 6,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <div
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: 3,
                            background: `${m.color}20`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <div
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: 1,
                              background: m.color,
                            }}
                          />
                        </div>
                        {m.label}
                      </div>
                      <div
                        style={{
                          fontSize: 20,
                          fontWeight: 700,
                          color: colors.foreground,
                          letterSpacing: "-0.02em",
                        }}
                      >
                        {m.value}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Edge table */}
            <div
              style={{
                background: colors.sidebar,
                border: `1px solid ${colors.borderSubtle}`,
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              {/* Table header */}
              <div
                style={{
                  display: "flex",
                  padding: "8px 14px",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                  opacity: interpolate(frame, [60, 70], [0, 1], {
                    extrapolateRight: "clamp",
                    extrapolateLeft: "clamp",
                  }),
                }}
              >
                {["Edge", "Status", "Trades", "Win rate", "Net P&L"].map(
                  (col, ci) => (
                    <div
                      key={col}
                      style={{
                        flex: ci === 0 ? 2 : 1,
                        fontSize: 10,
                        fontWeight: 600,
                        color: "rgba(255,255,255,0.3)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        textAlign: ci >= 2 ? "right" : "left",
                      }}
                    >
                      {col}
                    </div>
                  )
                )}
              </div>

              {/* Rows */}
              {edges.map((edge, i) => {
                const delay = 70 + i * 6;
                const rowSpring = spring({
                  frame: frame - delay,
                  fps,
                  config: springs.elementReveal,
                });
                const rowOpacity = interpolate(rowSpring, [0, 1], [0, 1]);
                const rowY = interpolate(rowSpring, [0, 1], [10, 0]);
                const isHovered = i === hoverRow;

                return (
                  <div
                    key={edge.name}
                    style={{
                      display: "flex",
                      padding: "9px 14px",
                      alignItems: "center",
                      borderBottom: "1px solid rgba(255,255,255,0.03)",
                      opacity: rowOpacity,
                      transform: `translateY(${rowY}px)`,
                      background: isHovered
                        ? "rgba(255,255,255,0.03)"
                        : "transparent",
                    }}
                  >
                    <div
                      style={{
                        flex: 2,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          background: edge.dot,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          color: colors.foreground,
                        }}
                      >
                        {edge.name}
                      </span>
                      {edge.ready && isHovered && (
                        <span
                          style={{
                            fontSize: 9,
                            padding: "1px 6px",
                            borderRadius: 4,
                            background: "rgba(20,184,166,0.15)",
                            border: "1px solid rgba(20,184,166,0.25)",
                            color: colors.teal,
                            boxShadow: `0 0 8px rgba(20,184,166,0.2)`,
                          }}
                        >
                          Ready
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        flex: 1,
                        fontSize: 10,
                        padding: "2px 8px",
                      }}
                    >
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 4,
                          background:
                            edge.status === "Public"
                              ? "rgba(20,184,166,0.1)"
                              : edge.status === "Fork"
                                ? "rgba(167,139,250,0.1)"
                                : "rgba(255,255,255,0.04)",
                          color:
                            edge.status === "Public"
                              ? colors.teal
                              : edge.status === "Fork"
                                ? "#a78bfa"
                                : "rgba(255,255,255,0.5)",
                          fontSize: 10,
                          fontWeight: 500,
                        }}
                      >
                        {edge.status}
                      </span>
                    </div>
                    <div
                      style={{
                        flex: 1,
                        fontSize: 12,
                        color: "rgba(255,255,255,0.6)",
                        textAlign: "right",
                      }}
                    >
                      {edge.trades}
                    </div>
                    <div
                      style={{
                        flex: 1,
                        fontSize: 12,
                        color: colors.foreground,
                        fontWeight: 500,
                        textAlign: "right",
                      }}
                    >
                      {edge.winRate}
                    </div>
                    <div
                      style={{
                        flex: 1,
                        fontSize: 12,
                        fontWeight: 600,
                        color: edge.pnlColor,
                        textAlign: "right",
                      }}
                    >
                      {edge.pnl}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </AppWindow>
      </div>
    </div>
  );
};
