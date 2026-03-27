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

const journalText = `## Weekly Reflection

This week's focus was execution quality on the London session.
The Silver Bullet entries on EU and GU continued to show edge —
4/5 wins with clean displacement entries.

### Key Observations
- XAUUSD order block sweeps delivered the highest R:R (3.2R average)
- New York session showed improved patience after Monday's loss
- Asian range plays need more work — 0/2 this week`;

const aiGeneratedText = `Based on your trading data this week, your London session entries show a clear pattern of improvement. The Silver Bullet setup on EU has a 78% hit rate over the last 14 entries. Consider increasing position size on these setups while maintaining your current risk parameters.`;

const slashMenuItems = [
  { label: "Heading", icon: "H" },
  { label: "Bullet List", icon: "•" },
  { label: "Chart", icon: "📊" },
  { label: "Trade", icon: "📈" },
  { label: "Image", icon: "🖼" },
  { label: "AI Capture", icon: "✨", highlighted: true },
];

export const Scene4Journal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const windowSpring = spring({
    frame,
    fps,
    config: springs.windowEntrance,
  });
  const windowScale = interpolate(windowSpring, [0, 1], [0.92, 1]);
  const windowOpacity = interpolate(windowSpring, [0, 1], [0, 1]);

  // Typing animation (3 chars per frame)
  const charsPerFrame = 3;
  const typingStartFrame = 20;
  const typingEndFrame = typingStartFrame + Math.ceil(journalText.length / charsPerFrame);
  const visibleChars = Math.max(
    0,
    Math.min(journalText.length, (frame - typingStartFrame) * charsPerFrame)
  );
  const typedText = journalText.substring(0, visibleChars);

  // Blinking cursor
  const showCursor = frame < typingEndFrame + 15 && Math.floor(frame / 8) % 2 === 0;

  // Slash command dropdown
  const slashFrame = typingEndFrame + 10;
  const showSlash = frame >= slashFrame;
  const slashSpring = spring({
    frame: frame - slashFrame,
    fps,
    config: springs.menuDropdown,
  });
  const slashScale = interpolate(slashSpring, [0, 1], [0.95, 1]);
  const slashOpacity = interpolate(slashSpring, [0, 1], [0, 1]);

  // AI Capture dialog
  const aiFrame = slashFrame + 25;
  const showAI = frame >= aiFrame;
  const aiSpring = spring({
    frame: frame - aiFrame,
    fps,
    config: springs.elementReveal,
  });
  const aiScale = interpolate(aiSpring, [0, 1], [0.95, 1]);
  const aiOpacity = interpolate(aiSpring, [0, 1], [0, 1]);

  // AI text streaming
  const aiTextStart = aiFrame + 20;
  const aiVisibleChars = Math.max(
    0,
    Math.min(
      aiGeneratedText.length,
      (frame - aiTextStart) * 4
    )
  );
  const aiTypedText = aiGeneratedText.substring(0, aiVisibleChars);

  // Loading shimmer
  const showShimmer = frame >= aiFrame + 5 && frame < aiTextStart;

  // Fade out
  const fadeOut = interpolate(frame, [175, 195], [1, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // Render markdown-ish text
  const renderJournalText = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, i) => {
      if (line.startsWith("### ")) {
        return (
          <div
            key={i}
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: colors.foreground,
              marginTop: 12,
              marginBottom: 4,
            }}
          >
            {line.replace("### ", "")}
          </div>
        );
      }
      if (line.startsWith("## ")) {
        return (
          <div
            key={i}
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: colors.foreground,
              marginBottom: 6,
            }}
          >
            {line.replace("## ", "")}
          </div>
        );
      }
      if (line.startsWith("- ")) {
        return (
          <div
            key={i}
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.7)",
              lineHeight: 1.6,
              paddingLeft: 16,
              position: "relative",
            }}
          >
            <span
              style={{
                position: "absolute",
                left: 4,
                color: "rgba(255,255,255,0.3)",
              }}
            >
              •
            </span>
            {line.replace("- ", "")}
          </div>
        );
      }
      if (line === "") return <div key={i} style={{ height: 8 }} />;
      return (
        <div
          key={i}
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.7)",
            lineHeight: 1.6,
          }}
        >
          {line}
        </div>
      );
    });
  };

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
          <Sidebar activeItem="Journal" frame={frame} startFrame={5} />
          <div
            style={{
              flex: 1,
              padding: 20,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              position: "relative",
            }}
          >
            {/* Title bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: colors.foreground,
                  opacity: interpolate(frame, [8, 18], [0, 1], {
                    extrapolateRight: "clamp",
                    extrapolateLeft: "clamp",
                  }),
                }}
              >
                Weekly Review — March W4
              </div>
              <div
                style={{
                  fontSize: 10,
                  padding: "2px 8px",
                  borderRadius: 4,
                  background: colors.pillVioletBg,
                  border: `1px solid ${colors.pillVioletRing}`,
                  color: colors.pillVioletText,
                  opacity: interpolate(frame, [12, 20], [0, 1], {
                    extrapolateRight: "clamp",
                    extrapolateLeft: "clamp",
                  }),
                }}
              >
                weekly
              </div>
            </div>

            {/* Tabs */}
            <div
              style={{
                display: "flex",
                gap: 20,
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                paddingBottom: 8,
                opacity: interpolate(frame, [10, 20], [0, 1], {
                  extrapolateRight: "clamp",
                  extrapolateLeft: "clamp",
                }),
              }}
            >
              {["Entries", "Insights", "Calendar", "Shares"].map((tab, i) => (
                <div
                  key={tab}
                  style={{
                    fontSize: 12,
                    color: i === 0 ? colors.teal : "rgba(255,255,255,0.45)",
                    fontWeight: i === 0 ? 500 : 400,
                    paddingBottom: 4,
                    borderBottom:
                      i === 0 ? `2px solid ${colors.teal}` : "2px solid transparent",
                  }}
                >
                  {tab}
                </div>
              ))}
            </div>

            {/* Editor content */}
            <div
              style={{
                flex: 1,
                padding: "8px 0",
                position: "relative",
              }}
            >
              {renderJournalText(typedText)}
              {showCursor && visibleChars < journalText.length && (
                <span
                  style={{
                    display: "inline-block",
                    width: 2,
                    height: 14,
                    background: colors.teal,
                    marginLeft: 1,
                    verticalAlign: "text-bottom",
                  }}
                />
              )}

              {/* Slash typed indicator */}
              {showSlash && !showAI && (
                <div style={{ display: "inline", fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                  /
                </div>
              )}
            </div>

            {/* Slash command dropdown */}
            {showSlash && !showAI && (
              <div
                style={{
                  position: "absolute",
                  left: 230,
                  bottom: 100,
                  width: 200,
                  background: colors.sidebar,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 8,
                  padding: 4,
                  opacity: slashOpacity,
                  transform: `scale(${slashScale})`,
                  transformOrigin: "top left",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                  zIndex: 20,
                }}
              >
                {slashMenuItems.map((item, i) => {
                  const itemDelay = slashFrame + 3 + i * 2;
                  const itemOpacity = interpolate(
                    frame,
                    [itemDelay, itemDelay + 6],
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
                        borderRadius: 4,
                        fontSize: 12,
                        color: item.highlighted
                          ? colors.foreground
                          : "rgba(255,255,255,0.7)",
                        background: item.highlighted
                          ? "rgba(20,184,166,0.12)"
                          : "transparent",
                        fontWeight: item.highlighted ? 500 : 400,
                        opacity: itemOpacity,
                      }}
                    >
                      <span style={{ width: 16, textAlign: "center", fontSize: 12 }}>
                        {item.icon}
                      </span>
                      {item.label}
                      {item.highlighted && (
                        <span
                          style={{
                            marginLeft: "auto",
                            fontSize: 9,
                            color: colors.teal,
                          }}
                        >
                          AI
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* AI Capture dialog */}
            {showAI && (
              <div
                style={{
                  position: "absolute",
                  left: 220,
                  top: 180,
                  width: 380,
                  background: colors.sidebar,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 10,
                  padding: 16,
                  opacity: aiOpacity,
                  transform: `scale(${aiScale})`,
                  transformOrigin: "top left",
                  boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
                  zIndex: 20,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 12,
                  }}
                >
                  <span style={{ fontSize: 14 }}>✨</span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: colors.foreground,
                    }}
                  >
                    AI Capture
                  </span>
                  <div
                    style={{
                      marginLeft: "auto",
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: colors.teal,
                      animation: showShimmer ? undefined : undefined,
                      opacity: showShimmer ? 0.6 : 1,
                    }}
                  />
                </div>

                {/* Loading shimmer */}
                {showShimmer && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[0.9, 0.75, 0.6, 0.45].map((width, i) => (
                      <div
                        key={i}
                        style={{
                          height: 10,
                          borderRadius: 4,
                          background: `linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) ${
                            50 + ((frame * 3 + i * 20) % 100) * 0.5
                          }%, rgba(255,255,255,0.04) 100%)`,
                          width: `${width * 100}%`,
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* AI generated text */}
                {frame >= aiTextStart && (
                  <div
                    style={{
                      fontSize: 11,
                      lineHeight: 1.6,
                      color: "rgba(255,255,255,0.7)",
                    }}
                  >
                    {aiTypedText}
                    {aiVisibleChars < aiGeneratedText.length && (
                      <span
                        style={{
                          display: "inline-block",
                          width: 2,
                          height: 12,
                          background: colors.teal,
                          marginLeft: 1,
                          verticalAlign: "text-bottom",
                          opacity: Math.floor(frame / 6) % 2 === 0 ? 1 : 0,
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </AppWindow>
      </div>
    </div>
  );
};
