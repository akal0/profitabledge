import React from "react";
import { colors } from "../design-tokens";

interface AppWindowProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export const AppWindow: React.FC<AppWindowProps> = ({ children, style }) => {
  return (
    <div
      style={{
        position: "absolute",
        top: 40,
        left: 40,
        width: 1000,
        height: 620,
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.4)",
        border: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
    >
      {/* Chrome bar */}
      <div
        style={{
          height: 40,
          background: colors.sidebar,
          display: "flex",
          alignItems: "center",
          paddingLeft: 16,
          gap: 8,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: colors.trafficRed,
          }}
        />
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: colors.trafficYellow,
          }}
        />
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: colors.trafficGreen,
          }}
        />
      </div>
      {/* Body */}
      <div
        style={{
          flex: 1,
          background: colors.sidebarAccent,
          display: "flex",
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
};
