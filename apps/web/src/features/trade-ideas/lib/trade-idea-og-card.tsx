import React from "react";

import {
  buildTradeIdeaFieldRows,
  formatPrice,
  getIdeaAuthorHandle,
  getIdeaAuthorName,
  getIdeaInitials,
  getTradeIdeaPhase,
  getTradeIdeaPhaseLabel,
  type TradeIdeaPresentation,
} from "./trade-idea-utils";

const BASE_WIDTH = 1200;
const BASE_HEIGHT = 630;

type TradeIdeaOgCardProps = {
  idea: TradeIdeaPresentation;
  width?: number;
  height?: number;
};

function scaleValue(value: number, scale: number) {
  return Math.round(value * scale * 100) / 100;
}

function priceDisplay(value: string | null | undefined, hidden?: boolean) {
  return hidden ? "Hidden" : formatPrice(value);
}

function metricValueColor(label: string, hidden: boolean) {
  if (hidden) {
    return "rgba(255,255,255,0.92)";
  }

  if (label === "Stop loss") {
    return "#fb7185";
  }

  if (label === "Take profit" || label === "Exit") {
    return "#5eead4";
  }

  return "#ffffff";
}

export function TradeIdeaOgCard({
  idea,
  width = BASE_WIDTH,
  height = BASE_HEIGHT,
}: TradeIdeaOgCardProps) {
  const scale = width / BASE_WIDTH;
  const radius = scaleValue(28, scale);
  const shellRadius = scaleValue(22, scale);
  const panelRadius = scaleValue(16, scale);
  const shellPadding = scaleValue(12, scale);
  const contentPadding = scaleValue(20, scale);
  const gap = scaleValue(14, scale);
  const subtleBorder = `${Math.max(1, scaleValue(1, scale))}px solid rgba(255,255,255,0.06)`;
  const separator = `${Math.max(1, scaleValue(1, scale))}px solid rgba(255,255,255,0.06)`;
  const authorName = getIdeaAuthorName(idea);
  const authorHandle = getIdeaAuthorHandle(idea);
  const phaseLabel = getTradeIdeaPhaseLabel(getTradeIdeaPhase(idea));
  const pricesHidden = idea.showPrices === false;
  const fieldRows = buildTradeIdeaFieldRows(idea);
  const infoChips = [idea.session, idea.timeframe, idea.strategyName].filter(Boolean);

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width,
        height,
        overflow: "hidden",
        borderRadius: radius,
        border: subtleBorder,
        background: "#1d2028",
        color: "#ffffff",
        fontFamily: "Geist, Inter, ui-sans-serif, system-ui, sans-serif",
        padding: shellPadding,
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          flex: 1,
          flexDirection: "column",
          borderRadius: shellRadius,
          border: subtleBorder,
          background: "rgba(33,36,46,0.92)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "relative",
            height: scaleValue(136, scale),
            overflow: "hidden",
            borderBottom: separator,
            background:
              "linear-gradient(135deg, rgba(26,29,38,0.96), rgba(17,19,26,0.94))",
          }}
        >
          {idea.authorBannerUrl ? (
            <img
              src={idea.authorBannerUrl}
              alt=""
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : null}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(15,17,24,0.12), rgba(15,17,24,0.64)), radial-gradient(circle at top left, rgba(20,184,166,0.18), transparent 34%)",
            }}
          />
        </div>

        <div
          style={{
            position: "relative",
            display: "flex",
            flex: 1,
            flexDirection: "column",
            padding: contentPadding,
            paddingTop: scaleValue(18, scale),
            gap,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: scaleValue(16, scale),
              marginTop: scaleValue(-58, scale),
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: scaleValue(14, scale), minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: scaleValue(8, scale),
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: scaleValue(74, scale),
                    height: scaleValue(74, scale),
                    overflow: "hidden",
                    borderRadius: 999,
                    border: `${Math.max(2, scaleValue(4, scale))}px solid rgba(33,36,46,0.96)`,
                    background: "rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.82)",
                    fontSize: scaleValue(24, scale),
                    fontWeight: 700,
                  }}
                >
                  {idea.authorAvatarUrl ? (
                    <img
                      src={idea.authorAvatarUrl}
                      alt={authorName}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <span>{getIdeaInitials(authorName)}</span>
                  )}
                </div>

                <div
                  style={{
                    fontSize: scaleValue(14, scale),
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.84)",
                    maxWidth: scaleValue(110, scale),
                    textAlign: "center",
                    lineHeight: 1.35,
                  }}
                >
                  {idea.showUsername === false ? authorName : authorHandle}
                </div>
                <div style={{ fontSize: scaleValue(13, scale), color: "rgba(255,255,255,0.5)" }}>
                  {phaseLabel}
                </div>
                <div
                  style={{
                    fontSize: scaleValue(18, scale),
                    lineHeight: 1.2,
                    fontWeight: 700,
                    color: "#ffffff",
                    textAlign: "center",
                  }}
                >
                  {idea.symbol}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: scaleValue(8, scale), flexWrap: "wrap" }}>
            {infoChips.map((label) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: `${scaleValue(6, scale)}px ${scaleValue(10, scale)}px`,
                  borderRadius: 999,
                  border: subtleBorder,
                  background: "rgba(255,255,255,0.05)",
                  fontSize: scaleValue(13, scale),
                  color: "rgba(255,255,255,0.76)",
                }}
              >
                {label}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: scaleValue(18, scale) }}>
            {fieldRows.map((row) => (
              <div key={row.label} style={{ display: "flex", alignItems: "center", gap: scaleValue(8, scale) }}>
                <span style={{ fontSize: scaleValue(14, scale), color: "rgba(255,255,255,0.46)" }}>
                  {row.label}
                </span>
                <span
                  style={{
                    fontSize: scaleValue(15, scale),
                    fontWeight: 600,
                    color: metricValueColor(row.label, pricesHidden),
                  }}
                >
                  {priceDisplay(row.value, pricesHidden)}
                </span>
              </div>
            ))}
          </div>

          <div
            style={{
              position: "relative",
              display: "flex",
              flex: 1,
              minHeight: 0,
              overflow: "hidden",
              borderRadius: panelRadius,
              border: subtleBorder,
              background: "rgba(11,13,18,0.66)",
            }}
          >
            {idea.chartImageUrl ? (
              <img
                src={idea.chartImageUrl}
                alt={`${idea.symbol} chart`}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : null}

            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(180deg, rgba(15,17,24,0.1), rgba(15,17,24,0.36)), linear-gradient(90deg, rgba(15,17,24,0.2), transparent 18%, transparent 82%, rgba(15,17,24,0.2))",
              }}
            />

            {!idea.chartImageUrl ? (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "rgba(255,255,255,0.56)",
                  fontSize: scaleValue(22, scale),
                  fontWeight: 600,
                }}
              >
                Chart preview
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
