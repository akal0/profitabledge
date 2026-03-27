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

const stats = [
  { label: "Active", value: "4", color: colors.info },
  { label: "Achieved", value: "12", color: colors.teal },
  { label: "Total", value: "18", color: "#a78bfa" },
  { label: "Success rate", value: "67%", color: "#f97316" },
];

const streaks = [
  { label: "Win streak", value: "W7", sub: "Longest W12", color: colors.teal },
  { label: "Green days", value: "5 days", sub: "Longest 14 days", color: colors.success },
  { label: "Goal hit rate", value: "67%", sub: "", color: colors.teal, isRing: true },
];

const goals = [
  { label: "Hit $10K monthly profit", pct: 72, type: "Outcome" },
  { label: "Maintain 60% win rate", pct: 87, type: "Outcome" },
  { label: "Reach 2.0 profit factor", pct: 94, type: "Process", animateTo100: true },
  { label: "Journal 90% of trading days", pct: 78, type: "Process" },
  { label: "100% rule compliance", pct: 92, type: "Process" },
];

// Confetti particle
const ConfettiParticle: React.FC<{
  x: number;
  y: number;
  color: string;
  delay: number;
  frame: number;
}> = ({ x, y, color, delay, frame }) => {
  const age = frame - delay;
  if (age < 0) return null;
  const progress = Math.min(age / 30, 1);
  const spread = progress * 60;
  const fallY = progress * progress * 40;
  const opacity = 1 - progress;
  const rotation = age * 12;

  return (
    <div
      style={{
        position: "absolute",
        left: x + Math.cos(delay) * spread,
        top: y - 30 * progress + fallY,
        width: 4,
        height: 4,
        borderRadius: delay % 3 === 0 ? "50%" : 1,
        background: color,
        opacity,
        transform: `rotate(${rotation}deg)`,
      }}
    />
  );
};

export const Scene7Goals: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const windowSpring = spring({ frame, fps, config: springs.windowEntrance });
  const windowScale = interpolate(windowSpring, [0, 1], [0.92, 1]);
  const windowOpacity = interpolate(windowSpring, [0, 1], [0, 1]);

  // Ring draw progress for goal hit rate
  const ringProgress = interpolate(frame, [55, 95], [0, 0.67], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // PF goal animation frame
  const pfGoalFrame = 120;
  const confettiFrame = pfGoalFrame + 15;
  const showConfetti = frame >= confettiFrame && frame < confettiFrame + 40;

  // Fade out
  const fadeOut = interpolate(frame, [160, 180], [1, 0], {
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
          <Sidebar activeItem="Goals" frame={frame} startFrame={5} />
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
            {/* Stat cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 8,
              }}
            >
              {stats.map((s, i) => {
                const delay = 8 + i * 6;
                const statSpring = spring({
                  frame: frame - delay,
                  fps,
                  config: springs.elementReveal,
                });
                const opacity = interpolate(statSpring, [0, 1], [0, 1]);
                const y = interpolate(statSpring, [0, 1], [16, 0]);

                return (
                  <div
                    key={s.label}
                    style={{
                      background: colors.sidebar,
                      border: `1px solid ${colors.borderSubtle}`,
                      borderRadius: 8,
                      padding: 12,
                      opacity,
                      transform: `translateY(${y}px)`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: "rgba(255,255,255,0.45)",
                        fontWeight: 500,
                        marginBottom: 4,
                      }}
                    >
                      {s.label}
                    </div>
                    <div
                      style={{
                        fontSize: 22,
                        fontWeight: 700,
                        color: s.color,
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {s.value}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Streak trackers */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 8,
              }}
            >
              {streaks.map((s, i) => {
                const delay = 35 + i * 8;
                const streakSpring = spring({
                  frame: frame - delay,
                  fps,
                  config: springs.elementReveal,
                });
                const opacity = interpolate(streakSpring, [0, 1], [0, 1]);
                const scale = interpolate(streakSpring, [0, 1], [0.95, 1]);

                return (
                  <div
                    key={s.label}
                    style={{
                      background: colors.sidebar,
                      border: `1px solid ${colors.borderSubtle}`,
                      borderRadius: 8,
                      padding: 12,
                      opacity,
                      transform: `scale(${scale})`,
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    {s.isRing ? (
                      <svg width={44} height={44}>
                        <circle
                          cx={22}
                          cy={22}
                          r={18}
                          fill="none"
                          stroke="rgba(255,255,255,0.06)"
                          strokeWidth={3}
                        />
                        <circle
                          cx={22}
                          cy={22}
                          r={18}
                          fill="none"
                          stroke={s.color}
                          strokeWidth={3}
                          strokeLinecap="round"
                          strokeDasharray={`${2 * Math.PI * 18 * ringProgress} ${2 * Math.PI * 18}`}
                          transform="rotate(-90 22 22)"
                        />
                        <text
                          x={22}
                          y={24}
                          textAnchor="middle"
                          fontSize={10}
                          fontWeight={700}
                          fill={colors.foreground}
                        >
                          {Math.round(ringProgress * 100)}%
                        </text>
                      </svg>
                    ) : (
                      <div
                        style={{
                          fontSize: 24,
                          fontWeight: 700,
                          color: s.color,
                          letterSpacing: "-0.02em",
                          minWidth: 44,
                        }}
                      >
                        {s.value}
                      </div>
                    )}
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          color: "rgba(255,255,255,0.7)",
                        }}
                      >
                        {s.label}
                      </div>
                      {s.sub && (
                        <div
                          style={{
                            fontSize: 10,
                            color: "rgba(255,255,255,0.35)",
                          }}
                        >
                          {s.sub}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tabs */}
            <div
              style={{
                display: "flex",
                gap: 16,
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                paddingBottom: 6,
                opacity: interpolate(frame, [65, 75], [0, 1], {
                  extrapolateRight: "clamp",
                  extrapolateLeft: "clamp",
                }),
              }}
            >
              {[
                { label: "Active", count: 4, active: true },
                { label: "Paused", count: 1 },
                { label: "Achieved", count: 12 },
                { label: "Failed", count: 1 },
              ].map((tab) => (
                <div
                  key={tab.label}
                  style={{
                    fontSize: 11,
                    color: tab.active
                      ? colors.teal
                      : "rgba(255,255,255,0.45)",
                    fontWeight: tab.active ? 500 : 400,
                    borderBottom: tab.active
                      ? `2px solid ${colors.teal}`
                      : "2px solid transparent",
                    paddingBottom: 4,
                  }}
                >
                  {tab.label}
                  <span style={{ marginLeft: 4, opacity: 0.6 }}>
                    ({tab.count})
                  </span>
                </div>
              ))}
            </div>

            {/* Goal cards */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {goals.map((g, i) => {
                const delay = 80 + i * 6;
                const goalSpring = spring({
                  frame: frame - delay,
                  fps,
                  config: springs.elementReveal,
                });
                const opacity = interpolate(goalSpring, [0, 1], [0, 1]);
                const y = interpolate(goalSpring, [0, 1], [12, 0]);

                // Animate PF goal to 100%
                let barPct = g.pct;
                if (g.animateTo100) {
                  barPct = interpolate(
                    frame,
                    [delay + 15, pfGoalFrame],
                    [g.pct, 100],
                    {
                      extrapolateRight: "clamp",
                      extrapolateLeft: "clamp",
                      easing: Easing.out(Easing.cubic),
                    }
                  );
                } else {
                  barPct = interpolate(
                    frame,
                    [delay + 10, delay + 40],
                    [0, g.pct],
                    {
                      extrapolateRight: "clamp",
                      extrapolateLeft: "clamp",
                      easing: Easing.out(Easing.cubic),
                    }
                  );
                }

                const isComplete = g.animateTo100 && barPct >= 99.5;

                return (
                  <div
                    key={g.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "8px 12px",
                      borderRadius: 6,
                      background: colors.sidebar,
                      border: `1px solid ${isComplete ? "rgba(20,184,166,0.3)" : colors.borderSubtle}`,
                      opacity,
                      transform: `translateY(${y}px)`,
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        padding: "1px 6px",
                        borderRadius: 3,
                        background:
                          g.type === "Outcome"
                            ? "rgba(96,165,250,0.1)"
                            : "rgba(167,139,250,0.1)",
                        color:
                          g.type === "Outcome" ? colors.info : "#a78bfa",
                        fontWeight: 500,
                      }}
                    >
                      {g.type}
                    </div>
                    <div
                      style={{
                        flex: 1,
                        fontSize: 12,
                        color: colors.foreground,
                        fontWeight: 500,
                      }}
                    >
                      {g.label}
                    </div>
                    <div
                      style={{
                        width: 160,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          flex: 1,
                          height: 5,
                          borderRadius: 3,
                          background: "rgba(255,255,255,0.06)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${barPct}%`,
                            height: "100%",
                            borderRadius: 3,
                            background: isComplete
                              ? colors.teal
                              : colors.teal,
                            boxShadow: isComplete
                              ? `0 0 8px ${colors.teal}`
                              : "none",
                          }}
                        />
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: isComplete
                            ? colors.teal
                            : "rgba(255,255,255,0.6)",
                          minWidth: 32,
                          textAlign: "right",
                        }}
                      >
                        {Math.round(barPct)}%
                      </span>
                    </div>

                    {/* Confetti for PF goal */}
                    {g.animateTo100 && showConfetti && (
                      <>
                        {Array.from({ length: 20 }).map((_, ci) => (
                          <ConfettiParticle
                            key={ci}
                            x={120 + ci * 8}
                            y={12}
                            color={
                              ci % 3 === 0
                                ? colors.teal
                                : ci % 3 === 1
                                  ? "white"
                                  : colors.tealLight
                            }
                            delay={confettiFrame + ci * 0.8}
                            frame={frame}
                          />
                        ))}
                      </>
                    )}
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
