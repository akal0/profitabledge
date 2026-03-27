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

const suggestions = [
  ["What's my best session?"],
  ["Compare my edges", "Show win rate by symbol"],
  ["Analyze last 30 days", "Find my biggest leaks", "Review risk management"],
  ["Suggest position sizing", "Weekly performance"],
  ["Pattern analysis"],
];

const sessionData = [
  { name: "London", pct: 68, color: colors.chart1 },
  { name: "New York", pct: 58, color: colors.chart3 },
  { name: "Tokyo", pct: 41, color: colors.chart5 },
];

export const Scene5AIAssistant: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const windowSpring = spring({
    frame,
    fps,
    config: springs.windowEntrance,
  });
  const windowScale = interpolate(windowSpring, [0, 1], [0.92, 1]);
  const windowOpacity = interpolate(windowSpring, [0, 1], [0, 1]);

  // Phase timing
  const emptyStateEnd = 75;
  const chatStart = emptyStateEnd + 5;
  const aiResponseStart = chatStart + 20;
  const panelSlideStart = aiResponseStart + 15;

  // Empty state visible
  const emptyOpacity = interpolate(frame, [0, 15, emptyStateEnd - 10, emptyStateEnd], [0, 1, 1, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // Chat phase
  const showChat = frame >= chatStart;

  // AI response streaming
  const aiText =
    "Based on your trading data, your London session is your strongest performer with a 68% win rate across 42 trades. Here's the full breakdown:";
  const aiTextStart = aiResponseStart + 10;
  const aiVisibleChars = Math.max(
    0,
    Math.min(aiText.length, (frame - aiTextStart) * 3)
  );

  // Analysis panel
  const showPanel = frame >= panelSlideStart;
  const panelSpring = spring({
    frame: frame - panelSlideStart,
    fps,
    config: springs.elementReveal,
  });
  const panelX = interpolate(panelSpring, [0, 1], [100, 0]);
  const panelOpacity = interpolate(panelSpring, [0, 1], [0, 1]);

  // Fade out
  const fadeOut = interpolate(frame, [190, 210], [1, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

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
          <Sidebar activeItem="AI Assistant" frame={frame} startFrame={5} />
          <div
            style={{
              flex: 1,
              display: "flex",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {/* Chat column */}
            <div
              style={{
                flex: 1,
                padding: 20,
                display: "flex",
                flexDirection: "column",
                justifyContent: showChat ? "flex-start" : "center",
                alignItems: showChat ? "stretch" : "center",
                overflow: "hidden",
              }}
            >
              {/* Empty state */}
              {!showChat && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 20,
                    opacity: emptyOpacity,
                    maxWidth: 440,
                  }}
                >
                  <div
                    style={{
                      fontSize: 26,
                      fontWeight: 500,
                      color: colors.foreground,
                      letterSpacing: "-0.04em",
                      textAlign: "center",
                    }}
                  >
                    Your edge assistant
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "rgba(255,255,255,0.56)",
                      textAlign: "center",
                      lineHeight: 1.5,
                    }}
                  >
                    Ask questions about your trading performance, patterns, and
                    areas for improvement.
                  </div>

                  {/* Diamond layout suggestions */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 8,
                      marginTop: 8,
                    }}
                  >
                    {suggestions.map((row, ri) => {
                      const rowDelay = 20 + ri * 6;
                      const rowOpacity = interpolate(
                        frame,
                        [rowDelay, rowDelay + 12],
                        [0, 1],
                        { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
                      );
                      const rowY = interpolate(
                        frame,
                        [rowDelay, rowDelay + 12],
                        [8, 0],
                        { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
                      );
                      return (
                        <div
                          key={ri}
                          style={{
                            display: "flex",
                            gap: 6,
                            opacity: rowOpacity,
                            transform: `translateY(${rowY}px)`,
                          }}
                        >
                          {row.map((pill) => {
                            const isClicked =
                              pill === "What's my best session?" &&
                              frame > emptyStateEnd - 15;
                            return (
                              <div
                                key={pill}
                                style={{
                                  fontSize: 11,
                                  padding: "6px 14px",
                                  borderRadius: 20,
                                  border: `1px solid ${isClicked ? colors.teal : "rgba(255,255,255,0.1)"}`,
                                  background: isClicked
                                    ? "rgba(20,184,166,0.15)"
                                    : "rgba(255,255,255,0.06)",
                                  color: isClicked
                                    ? colors.tealLight
                                    : "rgba(255,255,255,0.8)",
                                  fontWeight: 500,
                                  transform: isClicked ? "scale(0.97)" : "scale(1)",
                                }}
                              >
                                {pill}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Chat messages */}
              {showChat && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                    paddingTop: 8,
                  }}
                >
                  {/* User message */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      opacity: interpolate(
                        frame,
                        [chatStart, chatStart + 10],
                        [0, 1],
                        { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
                      ),
                      transform: `translateY(${interpolate(
                        frame,
                        [chatStart, chatStart + 10],
                        [12, 0],
                        { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
                      )}px)`,
                    }}
                  >
                    <div
                      style={{
                        background: "rgba(20,184,166,0.12)",
                        border: "1px solid rgba(20,184,166,0.2)",
                        borderRadius: 12,
                        borderBottomRightRadius: 4,
                        padding: "8px 14px",
                        fontSize: 12,
                        color: colors.foreground,
                        maxWidth: 300,
                      }}
                    >
                      What's my best session?
                    </div>
                  </div>

                  {/* AI response */}
                  {frame >= aiResponseStart && (
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        opacity: interpolate(
                          frame,
                          [aiResponseStart, aiResponseStart + 10],
                          [0, 1],
                          {
                            extrapolateRight: "clamp",
                            extrapolateLeft: "clamp",
                          }
                        ),
                      }}
                    >
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          background: "linear-gradient(135deg, #14b8a6, #0d9488)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          flexShrink: 0,
                        }}
                      >
                        ✦
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "rgba(255,255,255,0.75)",
                          lineHeight: 1.6,
                          maxWidth: 350,
                        }}
                      >
                        {aiText.substring(0, aiVisibleChars)}
                        {aiVisibleChars < aiText.length && (
                          <span
                            style={{
                              display: "inline-block",
                              width: 2,
                              height: 12,
                              background: colors.teal,
                              marginLeft: 1,
                              verticalAlign: "text-bottom",
                              opacity: Math.floor(frame / 6) % 2,
                            }}
                          />
                        )}

                        {/* Session breakdown inline */}
                        {aiVisibleChars >= aiText.length && (
                          <div
                            style={{
                              marginTop: 12,
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                            }}
                          >
                            {sessionData.map((s, i) => {
                              const barDelay = aiTextStart + Math.ceil(aiText.length / 3) + i * 6;
                              const barProgress = interpolate(
                                frame,
                                [barDelay, barDelay + 20],
                                [0, 1],
                                {
                                  extrapolateRight: "clamp",
                                  extrapolateLeft: "clamp",
                                  easing: Easing.out(Easing.cubic),
                                }
                              );
                              return (
                                <div
                                  key={s.name}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    fontSize: 11,
                                  }}
                                >
                                  <span
                                    style={{
                                      width: 56,
                                      color: "rgba(255,255,255,0.5)",
                                    }}
                                  >
                                    {s.name}
                                  </span>
                                  <div
                                    style={{
                                      flex: 1,
                                      height: 6,
                                      borderRadius: 3,
                                      background: "rgba(255,255,255,0.06)",
                                      overflow: "hidden",
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: `${s.pct * barProgress}%`,
                                        height: "100%",
                                        borderRadius: 3,
                                        background: s.color,
                                      }}
                                    />
                                  </div>
                                  <span
                                    style={{
                                      color: s.color,
                                      fontWeight: 600,
                                      width: 32,
                                      textAlign: "right",
                                    }}
                                  >
                                    {Math.round(s.pct * barProgress)}%
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Analysis panel */}
            {showPanel && (
              <div
                style={{
                  width: 230,
                  background: colors.sidebar,
                  borderLeft: `1px solid ${colors.border}`,
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  opacity: panelOpacity,
                  transform: `translateX(${panelX}px)`,
                  flexShrink: 0,
                }}
              >
                {/* Live badge */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: colors.teal,
                      boxShadow: `0 0 6px ${colors.teal}`,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 10,
                      color: colors.teal,
                      fontWeight: 500,
                    }}
                  >
                    Live analysis
                  </span>
                </div>

                {/* Bar chart */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.6)",
                      marginBottom: 4,
                    }}
                  >
                    Win Rate by Session
                  </div>
                  {sessionData.map((s, i) => {
                    const barDelay = panelSlideStart + 10 + i * 8;
                    const barProgress = interpolate(
                      frame,
                      [barDelay, barDelay + 25],
                      [0, 1],
                      {
                        extrapolateRight: "clamp",
                        extrapolateLeft: "clamp",
                        easing: Easing.out(Easing.cubic),
                      }
                    );
                    return (
                      <div key={s.name}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 10,
                            marginBottom: 3,
                          }}
                        >
                          <span style={{ color: "rgba(255,255,255,0.5)" }}>
                            {s.name}
                          </span>
                          <span style={{ color: s.color, fontWeight: 600 }}>
                            {Math.round(s.pct * barProgress)}%
                          </span>
                        </div>
                        <div
                          style={{
                            height: 20,
                            borderRadius: 4,
                            background: "rgba(255,255,255,0.04)",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${s.pct * barProgress}%`,
                              height: "100%",
                              borderRadius: 4,
                              background: s.color,
                              opacity: 0.7,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Coverage */}
                <div
                  style={{
                    padding: 10,
                    borderRadius: 6,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    opacity: interpolate(
                      frame,
                      [panelSlideStart + 30, panelSlideStart + 40],
                      [0, 1],
                      { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
                    ),
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "rgba(255,255,255,0.4)",
                      marginBottom: 4,
                    }}
                  >
                    Coverage
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
                    90 trades analyzed
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "rgba(255,255,255,0.35)",
                      marginTop: 2,
                    }}
                  >
                    Mar 1 – Mar 25
                  </div>
                </div>

                {/* Callout */}
                <div
                  style={{
                    padding: 10,
                    borderRadius: 6,
                    background: "rgba(20,184,166,0.08)",
                    border: "1px solid rgba(20,184,166,0.15)",
                    opacity: interpolate(
                      frame,
                      [panelSlideStart + 40, panelSlideStart + 55],
                      [0, 1],
                      { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
                    ),
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: colors.teal,
                      marginBottom: 4,
                    }}
                  >
                    Strong signal
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "rgba(255,255,255,0.6)",
                      lineHeight: 1.5,
                    }}
                  >
                    London + Silver Bullet has 2.1 profit factor over 42 trades
                  </div>
                </div>
              </div>
            )}
          </div>
        </AppWindow>
      </div>
    </div>
  );
};
