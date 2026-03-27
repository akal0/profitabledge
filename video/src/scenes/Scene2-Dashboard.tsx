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

// Mini sparkline component
const Sparkline: React.FC<{
  data: number[];
  color: string;
  width: number;
  height: number;
  progress: number;
}> = ({ data, color, width, height, progress }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height * 0.8) - height * 0.1;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={width * 3}
        strokeDashoffset={width * 3 * (1 - progress)}
      />
    </svg>
  );
};

// Mini donut chart
const DonutChart: React.FC<{
  values: number[];
  chartColors: string[];
  size: number;
  progress: number;
}> = ({ values, chartColors, size, progress }) => {
  const total = values.reduce((a, b) => a + b, 0);
  const r = size / 2 - 4;
  const circumference = 2 * Math.PI * r;
  let cumulative = 0;

  return (
    <svg width={size} height={size}>
      {values.map((v, i) => {
        const pct = v / total;
        const dashLen = circumference * pct * progress;
        const dashGap = circumference - dashLen;
        const offset = -circumference * (cumulative / total) * progress;
        cumulative += v;
        return (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={chartColors[i]}
            strokeWidth={5}
            strokeDasharray={`${dashLen} ${dashGap}`}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
      })}
    </svg>
  );
};

// Calendar heatmap
const CalendarHeatmap: React.FC<{ frame: number; startFrame: number }> = ({
  frame,
  startFrame,
}) => {
  const days = [
    [1, 0, 1, 1, -1, 0, 0],
    [1, 1, -1, 1, 1, 0, 0],
    [1, -1, 1, 1, 1, 0, 0],
    [-1, 1, 1, 0, 0, 0, 0],
  ];

  return (
    <div style={{ display: "flex", gap: 3 }}>
      {days.map((week, wi) => (
        <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {week.map((day, di) => {
            const idx = wi * 7 + di;
            const delay = startFrame + idx * 1.5;
            const opacity = interpolate(frame, [delay, delay + 10], [0, 1], {
              extrapolateRight: "clamp",
              extrapolateLeft: "clamp",
            });
            return (
              <div
                key={di}
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 2,
                  background:
                    day === 1
                      ? colors.teal
                      : day === -1
                        ? colors.danger
                        : "rgba(255,255,255,0.06)",
                  opacity: day === 0 ? 0.3 * opacity : opacity,
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
};

const widgets = [
  {
    title: "Account Balance",
    value: "$127,482.50",
    change: "+$2,847.30 today",
    changeColor: colors.teal,
    type: "sparkline" as const,
  },
  {
    title: "Win Rate",
    value: "62.4%",
    change: "+3.2% this week",
    changeColor: colors.teal,
    type: "donut" as const,
  },
  {
    title: "Profit Factor",
    value: "1.87",
    change: "Target: 2.0",
    changeColor: "rgba(255,255,255,0.45)",
    type: "bars" as const,
  },
  {
    title: "Win Streak",
    value: "W7",
    change: "Best: W12",
    changeColor: "rgba(255,255,255,0.45)",
    type: "streak" as const,
  },
];

export const Scene2Dashboard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Window entrance
  const windowSpring = spring({
    frame,
    fps,
    config: springs.windowEntrance,
  });
  const windowScale = interpolate(windowSpring, [0, 1], [0.92, 1]);
  const windowOpacity = interpolate(windowSpring, [0, 1], [0, 1]);

  // Greeting
  const greetingOpacity = interpolate(frame, [30, 45], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // Scene fade out
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
          <Sidebar activeItem="Dashboard" frame={frame} startFrame={8} />
          <div
            style={{
              flex: 1,
              padding: 20,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                opacity: greetingOpacity,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    color: colors.foreground,
                  }}
                >
                  Good morning, Marcus
                </div>
                <div
                  style={{
                    fontSize: 11,
                    padding: "3px 10px",
                    borderRadius: 20,
                    background: colors.pillInfoBg,
                    border: `1px solid ${colors.pillInfoRing}`,
                    color: colors.pillInfoText,
                  }}
                >
                  New York session
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {["Filter", "USD", "Edit widgets", "Export"].map((btn) => (
                  <div
                    key={btn}
                    style={{
                      fontSize: 11,
                      padding: "4px 10px",
                      borderRadius: 6,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.55)",
                    }}
                  >
                    {btn}
                  </div>
                ))}
              </div>
            </div>

            {/* Widget Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 10,
              }}
            >
              {widgets.map((w, i) => {
                const delay = 45 + i * 8;
                const cardSpring = spring({
                  frame: frame - delay,
                  fps,
                  config: springs.elementReveal,
                });
                const cardY = interpolate(cardSpring, [0, 1], [24, 0]);
                const cardOpacity = interpolate(cardSpring, [0, 1], [0, 1]);

                // Counter animation
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

                const chartProgress = interpolate(
                  frame,
                  [delay + 15, delay + 55],
                  [0, 1],
                  {
                    extrapolateRight: "clamp",
                    extrapolateLeft: "clamp",
                    easing: Easing.out(Easing.cubic),
                  }
                );

                return (
                  <div
                    key={w.title}
                    style={{
                      background: colors.sidebar,
                      border: `1px solid ${colors.borderSubtle}`,
                      borderRadius: 8,
                      padding: 14,
                      opacity: cardOpacity,
                      transform: `translateY(${cardY}px)`,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: "rgba(255,255,255,0.5)",
                        fontWeight: 500,
                      }}
                    >
                      {w.title}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 22,
                            fontWeight: 600,
                            color: colors.foreground,
                            letterSpacing: "-0.02em",
                          }}
                        >
                          {w.value}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: w.changeColor,
                            marginTop: 2,
                          }}
                        >
                          {w.change}
                        </div>
                      </div>
                      <div>
                        {w.type === "sparkline" && (
                          <Sparkline
                            data={[100, 102, 98, 105, 108, 103, 112, 118, 115, 122, 127]}
                            color={colors.teal}
                            width={70}
                            height={32}
                            progress={chartProgress}
                          />
                        )}
                        {w.type === "donut" && (
                          <DonutChart
                            values={[62, 32, 6]}
                            chartColors={[colors.teal, colors.danger, "rgba(255,255,255,0.15)"]}
                            size={40}
                            progress={chartProgress}
                          />
                        )}
                        {w.type === "bars" && (
                          <svg width={50} height={32}>
                            {[0.6, 0.85, 0.4, 0.92, 0.7, 0.55, 0.87].map(
                              (v, bi) => (
                                <rect
                                  key={bi}
                                  x={bi * 7}
                                  y={32 - v * 28 * chartProgress}
                                  width={5}
                                  height={v * 28 * chartProgress}
                                  rx={1}
                                  fill={v > 0.5 ? colors.teal : colors.danger}
                                  opacity={0.7}
                                />
                              )
                            )}
                          </svg>
                        )}
                        {w.type === "streak" && (
                          <div
                            style={{
                              display: "flex",
                              gap: 2,
                              alignItems: "flex-end",
                            }}
                          >
                            {[1, 1, 1, 1, 1, 1, 1].map((_, si) => (
                              <div
                                key={si}
                                style={{
                                  width: 5,
                                  height: 8 + si * 2.5,
                                  borderRadius: 1,
                                  background: colors.teal,
                                  opacity: chartProgress,
                                  transform: `scaleY(${chartProgress})`,
                                  transformOrigin: "bottom",
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Calendar heatmap */}
            <div
              style={{
                background: colors.sidebar,
                border: `1px solid ${colors.borderSubtle}`,
                borderRadius: 8,
                padding: 14,
                opacity: interpolate(frame, [100, 115], [0, 1], {
                  extrapolateRight: "clamp",
                  extrapolateLeft: "clamp",
                }),
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.5)",
                  fontWeight: 500,
                  marginBottom: 10,
                }}
              >
                March 2026
              </div>
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <div>
                  <div
                    style={{
                      display: "flex",
                      gap: 3,
                      marginBottom: 4,
                      fontSize: 9,
                      color: "rgba(255,255,255,0.3)",
                    }}
                  >
                    {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                      <div
                        key={i}
                        style={{
                          width: 12,
                          textAlign: "center",
                        }}
                      >
                        {d}
                      </div>
                    ))}
                  </div>
                  <CalendarHeatmap frame={frame} startFrame={110} />
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    fontSize: 10,
                    color: "rgba(255,255,255,0.4)",
                    alignItems: "center",
                    marginLeft: "auto",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        background: colors.teal,
                      }}
                    />
                    Profitable
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        background: colors.danger,
                      }}
                    />
                    Loss
                  </div>
                </div>
              </div>
            </div>
          </div>
        </AppWindow>
      </div>
    </div>
  );
};
