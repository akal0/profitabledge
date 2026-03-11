import { create } from "zustand";

import type { ChartWidgetType } from "@/components/dashboard/chart-widgets";
import type { WidgetType } from "@/components/dashboard/widgets";

interface DashboardAssistantContextState {
  visibleWidgets: WidgetType[];
  visibleChartWidgets: ChartWidgetType[];
  focusedWidgetId: string | null;
  setVisibleWidgets: (
    visibleWidgets: WidgetType[],
    visibleChartWidgets: ChartWidgetType[]
  ) => void;
  setFocusedWidgetId: (widgetId: string | null) => void;
}

export const useDashboardAssistantContextStore =
  create<DashboardAssistantContextState>((set) => ({
    visibleWidgets: [],
    visibleChartWidgets: [],
    focusedWidgetId: null,
    setVisibleWidgets: (visibleWidgets, visibleChartWidgets) =>
      set({
        visibleWidgets,
        visibleChartWidgets,
      }),
    setFocusedWidgetId: (focusedWidgetId) => set({ focusedWidgetId }),
  }));
