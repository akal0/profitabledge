"use client";

import React from "react";

type ChartRenderMode = "default" | "embedded";

const ChartRenderModeContext = React.createContext<ChartRenderMode>("default");

export function ChartRenderModeProvider({
  mode,
  children,
}: {
  mode: ChartRenderMode;
  children: React.ReactNode;
}) {
  return (
    <ChartRenderModeContext.Provider value={mode}>
      {children}
    </ChartRenderModeContext.Provider>
  );
}

export function useChartRenderMode() {
  return React.useContext(ChartRenderModeContext);
}
