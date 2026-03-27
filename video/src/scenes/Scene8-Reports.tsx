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

// Daily P&L data
const dailyPnl = [
  420, -280, 1150, 680, -450, 890, 340, -180, 2100, 560, -620, 780, 1400,
  -340, 920, 1850, -580, 460, 1280, 720, -290, 1560, 940, -180, 2400,
];

// Win rate overlay
const winRateData = [
  58, 55, 62, 65, 60, 63, 59, 57, 68, 64, 56, 62, 67, 58, 63, 70, 55, 60,
  66, 63, 57, 69, 65, 59, 72,
];

// Equity curve
const equityData = [
  100000, 100420, 100140, 101290, 101970, 101520, 102410, 102750, 102570,
  104670, 105230, 104610, 105390, 106790, 106450, 107370, 109220, 108640,
  109100, 110380, 111100, 110810, 112370, 113310, 113130, 115530,
];

// Symbol breakdown
const symbols = [
  { name: "XAUUSD", value: 82 },
  { name: "EURUSD", value: 65 },
  { name: "GBPUSD", value: 54 },
  { name: "NAS100", value: 42 },
  { name: "US30", value: 28 },
];

// Radar data
const radarAxes = [
  { label: "Win Rate", value: 0.72 },
  { label: "Avg RR", value: 0.65 },
  { label: "PF", value: 0.78 },
  { label: "Expectancy", value: 0.6 },
  { label: "Consistency", value: 0.82 },
  { label: "Hold Quality", value: 0.7 },
];

export const Scene8Reports: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const windowSpring = spring({ frame, fps, config: springs.windowEntrance });
  const windowScale = interpolate(windowSpring, [0, 1], [0.92, 1]);
  const windowOpacity = interpolate(windowSpring, [0, 1], [0, 1]);

  // Fade out
  const fadeOut = interpolate(frame, [175, 195], [1, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // Chart animation
  const barGrowth = interpolate(frame, [30, 70], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Win rate line draw
  const lineProgress = interpolate(frame, [50, 90], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Equity line draw
  const equityProgress = interpolate(frame, [100, 140], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Panel cards
  const panelStart = 90;

  // Radar
  const radarProgress = interpolate(frame, [130, 165], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Chart dimensions
  const chartW = 530;
  const chartH = 120;
  const barW = chartW / dailyPnl.length - 2;
  const maxPnl = Math.max(...dailyPnl.map(Math.abs));

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
          <Sidebar activeItem="Reports" frame={frame} startFrame={5} />
          <div
            style={{
              flex: 1,
              padding: 14,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {/* Lens tabs */}
            <div
              style={{
                display: "flex",
                gap: 16,
                opacity: interpolate(frame, [8, 18], [0, 1], {
                  extrapolateRight: "clamp",
                  extrapolateLeft: "clamp",
                }),
              }}
            >
              {["Performance", "Time", "Setup", "Risk", "Execution"].map(
                (tab, i) => {
                  const delay = 10 + i * 4;
                  const tabOpacity = interpolate(
                    frame,
                    [delay, delay + 8],
                    [0, 1],
                    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
                  );
                  return (
                    <div
                      key={tab}
                      style={{
                        fontSize: 12,
                        color: i === 0 ? colors.teal : "rgba(255,255,255,0.45)",
                        fontWeight: i === 0 ? 500 : 400,
                        borderBottom:
                          i === 0
                            ? `2px solid ${colors.teal}`
                            : "2px solid transparent",
                        paddingBottom: 6,
                        opacity: tabOpacity,
                      }}
                    >
                      {tab}
                    </div>
                  );
                }
              )}
            </div>

            {/* Hero chart - Daily P&L with win rate overlay */}
            <div
              style={{
                background: colors.sidebar,
                border: `1px solid ${colors.borderSubtle}`,
                borderRadius: 8,
                padding: 12,
                opacity: interpolate(frame, [20, 30], [0, 1], {
                  extrapolateRight: "clamp",
                  extrapolateLeft: "clamp",
                }),
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.6)",
                  }}
                >
                  Daily Net P&L + Win Rate
                </div>
                <div style={{ display: "flex", gap: 12, fontSize: 9 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div
                      style={{
                        width: 8,
                        height: 3,
                        borderRadius: 1,
                        background: colors.teal,
                      }}
                    />
                    <span style={{ color: "rgba(255,255,255,0.4)" }}>Profit</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div
                      style={{
                        width: 8,
                        height: 3,
                        borderRadius: 1,
                        background: colors.danger,
                      }}
                    />
                    <span style={{ color: "rgba(255,255,255,0.4)" }}>Loss</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div
                      style={{
                        width: 8,
                        height: 1.5,
                        background: colors.info,
                      }}
                    />
                    <span style={{ color: "rgba(255,255,255,0.4)" }}>Win Rate</span>
                  </div>
                </div>
              </div>

              <svg width={chartW} height={chartH} style={{ overflow: "visible" }}>
                {/* Y axis labels */}
                <text
                  x={-4}
                  y={10}
                  textAnchor="end"
                  fontSize={8}
                  fill="rgba(255,255,255,0.2)"
                >
                  $3K
                </text>
                <text
                  x={-4}
                  y={chartH / 2}
                  textAnchor="end"
                  fontSize={8}
                  fill="rgba(255,255,255,0.2)"
                >
                  $0
                </text>
                <text
                  x={-4}
                  y={chartH - 4}
                  textAnchor="end"
                  fontSize={8}
                  fill="rgba(255,255,255,0.2)"
                >
                  -$1K
                </text>

                {/* Zero line */}
                <line
                  x1={0}
                  y1={chartH * 0.65}
                  x2={chartW}
                  y2={chartH * 0.65}
                  stroke="rgba(255,255,255,0.06)"
                  strokeDasharray="4 4"
                />

                {/* Bars */}
                {dailyPnl.map((pnl, i) => {
                  const barDelay = 30 + i * 1.2;
                  const barH =
                    (Math.abs(pnl) / maxPnl) * (chartH * 0.55) * barGrowth;
                  const x = i * (chartW / dailyPnl.length) + 1;
                  const isPositive = pnl >= 0;
                  const yBase = chartH * 0.65;

                  return (
                    <rect
                      key={i}
                      x={x}
                      y={isPositive ? yBase - barH : yBase}
                      width={barW}
                      height={Math.max(barH, 0.5)}
                      rx={1.5}
                      fill={isPositive ? colors.teal : colors.danger}
                      opacity={0.75}
                    />
                  );
                })}

                {/* Win rate line */}
                {(() => {
                  const visibleCount = Math.ceil(
                    winRateData.length * lineProgress
                  );
                  const points = winRateData
                    .slice(0, visibleCount)
                    .map((wr, i) => {
                      const x =
                        i * (chartW / (winRateData.length - 1));
                      const y =
                        chartH - (wr / 100) * chartH * 0.9 - chartH * 0.05;
                      return `${x},${y}`;
                    })
                    .join(" ");
                  return (
                    <polyline
                      points={points}
                      fill="none"
                      stroke={colors.info}
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={0.8}
                    />
                  );
                })()}
              </svg>
            </div>

            {/* Panel grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                flex: 1,
              }}
            >
              {/* Equity Curve - span 2 */}
              <div
                style={{
                  gridColumn: "1 / -1",
                  background: colors.sidebar,
                  border: `1px solid ${colors.borderSubtle}`,
                  borderRadius: 8,
                  padding: 10,
                  opacity: interpolate(frame, [panelStart, panelStart + 12], [0, 1], {
                    extrapolateRight: "clamp",
                    extrapolateLeft: "clamp",
                  }),
                  transform: `translateY(${interpolate(
                    frame,
                    [panelStart, panelStart + 12],
                    [12, 0],
                    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
                  )}px)`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.5)",
                    }}
                  >
                    Equity Curve
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: colors.teal,
                      fontWeight: 600,
                    }}
                  >
                    $127,482.50
                  </span>
                </div>
                <svg width={520} height={60}>
                  {/* Gradient fill */}
                  <defs>
                    <linearGradient
                      id="equityGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor={colors.teal} stopOpacity="0.3" />
                      <stop offset="100%" stopColor={colors.teal} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {(() => {
                    const maxE = Math.max(...equityData);
                    const minE = Math.min(...equityData);
                    const range = maxE - minE;
                    const visibleCount = Math.ceil(
                      equityData.length * equityProgress
                    );
                    const pts = equityData.slice(0, visibleCount).map((v, i) => {
                      const x = (i / (equityData.length - 1)) * 520;
                      const y = 55 - ((v - minE) / range) * 50;
                      return { x, y };
                    });
                    const linePoints = pts.map((p) => `${p.x},${p.y}`).join(" ");
                    const areaPoints =
                      linePoints +
                      ` ${pts[pts.length - 1]?.x ?? 0},60 0,60`;

                    return (
                      <>
                        <polygon
                          points={areaPoints}
                          fill="url(#equityGradient)"
                        />
                        <polyline
                          points={linePoints}
                          fill="none"
                          stroke={colors.teal}
                          strokeWidth={1.5}
                          strokeLinecap="round"
                        />
                      </>
                    );
                  })()}
                </svg>
              </div>

              {/* Symbol Breakdown */}
              <div
                style={{
                  background: colors.sidebar,
                  border: `1px solid ${colors.borderSubtle}`,
                  borderRadius: 8,
                  padding: 10,
                  opacity: interpolate(
                    frame,
                    [panelStart + 15, panelStart + 25],
                    [0, 1],
                    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
                  ),
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.5)",
                    marginBottom: 8,
                  }}
                >
                  Symbol Breakdown
                </div>
                {symbols.map((s, i) => {
                  const barDelay = panelStart + 20 + i * 4;
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
                        gap: 6,
                        marginBottom: 4,
                        fontSize: 10,
                      }}
                    >
                      <span
                        style={{
                          width: 44,
                          color: "rgba(255,255,255,0.5)",
                        }}
                      >
                        {s.name}
                      </span>
                      <div
                        style={{
                          flex: 1,
                          height: 8,
                          borderRadius: 2,
                          background: "rgba(255,255,255,0.04)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${s.value * barProgress}%`,
                            height: "100%",
                            borderRadius: 2,
                            background: colors.teal,
                            opacity: 0.7,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Radar Chart */}
              <div
                style={{
                  background: colors.sidebar,
                  border: `1px solid ${colors.borderSubtle}`,
                  borderRadius: 8,
                  padding: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: interpolate(
                    frame,
                    [panelStart + 20, panelStart + 30],
                    [0, 1],
                    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
                  ),
                }}
              >
                <svg width={130} height={120}>
                  {/* Grid rings */}
                  {[0.33, 0.66, 1].map((r, ri) => {
                    const radius = r * 48;
                    const pts = radarAxes
                      .map((_, i) => {
                        const angle = (i / radarAxes.length) * Math.PI * 2 - Math.PI / 2;
                        return `${65 + Math.cos(angle) * radius},${60 + Math.sin(angle) * radius}`;
                      })
                      .join(" ");
                    return (
                      <polygon
                        key={ri}
                        points={pts}
                        fill="none"
                        stroke="rgba(255,255,255,0.06)"
                        strokeWidth={0.5}
                      />
                    );
                  })}

                  {/* Axis lines */}
                  {radarAxes.map((_, i) => {
                    const angle = (i / radarAxes.length) * Math.PI * 2 - Math.PI / 2;
                    return (
                      <line
                        key={i}
                        x1={65}
                        y1={60}
                        x2={65 + Math.cos(angle) * 48}
                        y2={60 + Math.sin(angle) * 48}
                        stroke="rgba(255,255,255,0.04)"
                        strokeWidth={0.5}
                      />
                    );
                  })}

                  {/* Data polygon */}
                  {(() => {
                    const pts = radarAxes
                      .map((axis, i) => {
                        const angle =
                          (i / radarAxes.length) * Math.PI * 2 - Math.PI / 2;
                        const r = axis.value * 48 * radarProgress;
                        return `${65 + Math.cos(angle) * r},${60 + Math.sin(angle) * r}`;
                      })
                      .join(" ");
                    return (
                      <>
                        <polygon
                          points={pts}
                          fill={`${colors.teal}30`}
                          stroke={colors.teal}
                          strokeWidth={1.5}
                          strokeLinejoin="round"
                        />
                        {radarAxes.map((axis, i) => {
                          const angle =
                            (i / radarAxes.length) * Math.PI * 2 - Math.PI / 2;
                          const r = axis.value * 48 * radarProgress;
                          return (
                            <circle
                              key={i}
                              cx={65 + Math.cos(angle) * r}
                              cy={60 + Math.sin(angle) * r}
                              r={2}
                              fill={colors.teal}
                            />
                          );
                        })}
                      </>
                    );
                  })()}

                  {/* Labels */}
                  {radarAxes.map((axis, i) => {
                    const angle =
                      (i / radarAxes.length) * Math.PI * 2 - Math.PI / 2;
                    const lx = 65 + Math.cos(angle) * 56;
                    const ly = 60 + Math.sin(angle) * 56;
                    return (
                      <text
                        key={i}
                        x={lx}
                        y={ly + 3}
                        textAnchor="middle"
                        fontSize={7}
                        fill="rgba(255,255,255,0.35)"
                      >
                        {axis.label}
                      </text>
                    );
                  })}
                </svg>
              </div>
            </div>
          </div>
        </AppWindow>
      </div>
    </div>
  );
};
