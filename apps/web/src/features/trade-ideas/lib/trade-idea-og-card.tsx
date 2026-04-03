import React from "react";

import {
  formatDirectionArrow,
  formatDirectionLabel,
  formatPrice,
  formatRiskReward,
  generateTradeIdeaTitle,
  getIdeaAuthorHandle,
  getIdeaAuthorName,
  getIdeaInitials,
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

export function TradeIdeaOgCard({
  idea,
  width = BASE_WIDTH,
  height = BASE_HEIGHT,
}: TradeIdeaOgCardProps) {
  const scale = width / BASE_WIDTH;
  const radius = scaleValue(28, scale);
  const softRadius = scaleValue(22, scale);
  const padding = scaleValue(30, scale);
  const gap = scaleValue(24, scale);
  const title = generateTradeIdeaTitle(idea);
  const authorName = getIdeaAuthorName(idea);
  const authorHandle = getIdeaAuthorHandle(idea);
  const directionLabel = formatDirectionLabel(idea.direction);
  const directionArrow = formatDirectionArrow(idea.direction);
  const pricesHidden = idea.showPrices === false;
  const showRR = idea.showRR !== false;

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width,
        height,
        overflow: "hidden",
        borderRadius: radius,
        border: `${Math.max(1, scaleValue(1, scale))}px solid rgba(255,255,255,0.08)`,
        background: "#0a0a0f",
        color: "#ffffff",
        fontFamily: "Manrope",
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
            opacity: 0.16,
          }}
        />
      ) : null}

      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at top left, rgba(46,188,161,0.18), transparent 44%), linear-gradient(180deg, rgba(6,9,16,0.26), rgba(6,9,16,0.9))",
        }}
      />

      <div
        style={{
          position: "relative",
          display: "flex",
          flex: 1,
          flexDirection: "column",
          padding,
          gap,
        }}
      >
        <div
          style={{
            display: "flex",
            flex: 1,
            gap,
            alignItems: "stretch",
          }}
        >
          <div
            style={{
              position: "relative",
              display: "flex",
              width: "60%",
              minWidth: 0,
              overflow: "hidden",
              borderRadius: softRadius,
              background:
                "linear-gradient(135deg, rgba(18,25,38,0.95), rgba(8,10,15,0.92))",
              border: `${Math.max(1, scaleValue(1, scale))}px solid rgba(255,255,255,0.06)`,
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
                  "linear-gradient(90deg, rgba(10,10,15,0.36), transparent 20%, transparent 80%, rgba(10,10,15,0.54)), linear-gradient(180deg, rgba(10,10,15,0.08), rgba(10,10,15,0.4))",
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
                  color: "rgba(255,255,255,0.72)",
                  fontSize: scaleValue(24, scale),
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Chart preview
              </div>
            ) : null}
          </div>

          <div
            style={{
              display: "flex",
              width: "40%",
              minWidth: 0,
              flexDirection: "column",
              justifyContent: "space-between",
              borderRadius: softRadius,
              border: `${Math.max(1, scaleValue(1, scale))}px solid rgba(255,255,255,0.08)`,
              background:
                "linear-gradient(180deg, rgba(15,18,28,0.96), rgba(10,12,18,0.92))",
              padding: scaleValue(26, scale),
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: scaleValue(16, scale) }}>
              <div style={{ display: "flex", flexDirection: "column", gap: scaleValue(8, scale) }}>
                <div
                  style={{
                    fontSize: scaleValue(18, scale),
                    lineHeight: 1.1,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.42)",
                  }}
                >
                  Trade idea
                </div>
                <div
                  style={{
                    fontSize: scaleValue(42, scale),
                    lineHeight: 1,
                    fontWeight: 800,
                  }}
                >
                  {idea.symbol}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: scaleValue(10, scale),
                    fontSize: scaleValue(20, scale),
                    fontWeight: 700,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: idea.direction === "short" ? "#ef4444" : "#2ed0a2",
                  }}
                >
                  <span>{directionArrow}</span>
                  <span>{directionLabel}</span>
                </div>
                <div
                  style={{
                    fontSize: scaleValue(15, scale),
                    lineHeight: 1.45,
                    color: "rgba(255,255,255,0.62)",
                  }}
                >
                  {title}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: scaleValue(10, scale),
                }}
              >
                {[
                  {
                    label: "Entry",
                    value: priceDisplay(idea.entryPrice, pricesHidden),
                    color: "#ffffff",
                  },
                  {
                    label: "SL",
                    value: priceDisplay(idea.stopLoss, pricesHidden),
                    color: pricesHidden ? "rgba(255,255,255,0.84)" : "#ef5f73",
                  },
                  {
                    label: "TP",
                    value: priceDisplay(idea.takeProfit, pricesHidden),
                    color: pricesHidden ? "rgba(255,255,255,0.84)" : "#2ed0a2",
                  },
                ].map((row) => (
                  <div
                    key={row.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: scaleValue(12, scale),
                      fontFamily: "JetBrains Mono",
                      fontSize: scaleValue(18, scale),
                    }}
                  >
                    <span style={{ color: "rgba(255,255,255,0.48)", letterSpacing: "0.08em" }}>
                      {row.label}
                    </span>
                    <span style={{ color: row.color, fontWeight: 700 }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: scaleValue(14, scale) }}>
              {showRR ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: scaleValue(6, scale),
                    paddingTop: scaleValue(14, scale),
                    borderTop: `${Math.max(1, scaleValue(1, scale))}px solid rgba(255,255,255,0.08)`,
                  }}
                >
                  <span
                    style={{
                      fontSize: scaleValue(14, scale),
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,0.42)",
                    }}
                  >
                    Risk to reward
                  </span>
                  <span
                    style={{
                      fontSize: scaleValue(34, scale),
                      lineHeight: 1,
                      fontWeight: 800,
                      color: "#46d6cf",
                    }}
                  >
                    {formatRiskReward(idea.riskReward)}
                  </span>
                </div>
              ) : null}

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: scaleValue(8, scale),
                }}
              >
                {[idea.session, idea.timeframe, idea.strategyName]
                  .filter(Boolean)
                  .map((label) => (
                    <div
                      key={label}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: `${scaleValue(7, scale)}px ${scaleValue(10, scale)}px`,
                        borderRadius: 999,
                        background: "rgba(255,255,255,0.06)",
                        border: `${Math.max(1, scaleValue(1, scale))}px solid rgba(255,255,255,0.06)`,
                        color: "rgba(255,255,255,0.76)",
                        fontSize: scaleValue(13, scale),
                      }}
                    >
                      {label}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: scaleValue(18, scale),
            padding: `${scaleValue(16, scale)}px ${scaleValue(18, scale)}px`,
            borderRadius: softRadius,
            border: `${Math.max(1, scaleValue(1, scale))}px solid rgba(255,255,255,0.06)`,
            background: "rgba(9,12,18,0.76)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: scaleValue(12, scale), minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: scaleValue(38, scale),
                height: scaleValue(38, scale),
                overflow: "hidden",
                borderRadius: 999,
                border: `${Math.max(1, scaleValue(1, scale))}px solid rgba(255,255,255,0.08)`,
                background: "rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.84)",
                fontSize: scaleValue(14, scale),
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

            <div style={{ display: "flex", flexDirection: "column", gap: scaleValue(2, scale), minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: scaleValue(8, scale),
                  minWidth: 0,
                }}
              >
                {idea.showUsername === false ? (
                  <span
                    style={{
                      fontSize: scaleValue(16, scale),
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.86)",
                    }}
                  >
                    {authorName}
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: scaleValue(16, scale),
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.86)",
                    }}
                  >
                    {authorHandle}
                  </span>
                )}
                <span style={{ color: "rgba(255,255,255,0.26)", fontSize: scaleValue(14, scale) }}>
                  ·
                </span>
                <span
                  style={{
                    fontSize: scaleValue(14, scale),
                    color: "rgba(255,255,255,0.54)",
                  }}
                >
                  Pre-trade analysis
                </span>
              </div>
            </div>
          </div>

          <div
            style={{
              fontSize: scaleValue(16, scale),
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.68)",
            }}
          >
            profitabledge
          </div>
        </div>
      </div>
    </div>
  );
}
