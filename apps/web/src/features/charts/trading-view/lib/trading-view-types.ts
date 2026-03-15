"use client";

import type { LineWidth, Time } from "lightweight-charts";

export interface CandleData {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface TradeMarker {
  time: Time;
  position: "aboveBar" | "belowBar";
  color: string;
  shape: "arrowUp" | "arrowDown" | "circle" | "square";
  text?: string;
  size?: number;
}

export interface PriceLine {
  price: number;
  color: string;
  lineWidth?: LineWidth;
  lineStyle?: "solid" | "dashed" | "dotted";
  title?: string;
  axisLabelVisible?: boolean;
}

export interface IndicatorLine {
  id: string;
  data: { time: Time; value: number }[];
  color: string;
  lineWidth?: number;
  lineStyle?: "solid" | "dashed" | "dotted";
  title?: string;
  priceScaleId?: string;
}

export type AnnotationTool =
  | "none"
  | "trendline"
  | "extended"
  | "ray"
  | "arrow"
  | "horizontal"
  | "vertical"
  | "rectangle"
  | "fib"
  | "measure"
  | "anchored-vwap"
  | "note";

type AnnotationBase = {
  id: string;
  color: string;
  label?: string;
};

export type ChartAnnotation =
  | (AnnotationBase & {
      type: "trendline";
      startTime: Time;
      startPrice: number;
      endTime: Time;
      endPrice: number;
    })
  | (AnnotationBase & {
      type: "extended";
      startTime: Time;
      startPrice: number;
      endTime: Time;
      endPrice: number;
    })
  | (AnnotationBase & {
      type: "ray";
      startTime: Time;
      startPrice: number;
      endTime: Time;
      endPrice: number;
    })
  | (AnnotationBase & {
      type: "arrow";
      startTime: Time;
      startPrice: number;
      endTime: Time;
      endPrice: number;
    })
  | (AnnotationBase & {
      type: "horizontal";
      price: number;
    })
  | (AnnotationBase & {
      type: "vertical";
      time: Time;
    })
  | (AnnotationBase & {
      type: "rectangle";
      startTime: Time;
      startPrice: number;
      endTime: Time;
      endPrice: number;
    })
  | (AnnotationBase & {
      type: "fib";
      startTime: Time;
      startPrice: number;
      endTime: Time;
      endPrice: number;
    })
  | (AnnotationBase & {
      type: "measure";
      startTime: Time;
      startPrice: number;
      endTime: Time;
      endPrice: number;
    })
  | (AnnotationBase & {
      type: "anchored-vwap";
      startTime: Time;
      startPrice: number;
      endTime: Time;
      endPrice: number;
    })
  | (AnnotationBase & {
      type: "note";
      time: Time;
      price: number;
      label: string;
    });

export type ExecutionOverlayLevelKey = "entry" | "trigger" | "sl" | "tp";

export interface ExecutionOverlayLevel {
  price: number;
  color: string;
  label: string;
  draggable?: boolean;
}

export interface ExecutionOverlay {
  id: string;
  startTime: Time;
  endTime?: Time;
  labelTime?: Time;
  direction: "long" | "short";
  pending?: boolean;
  levels: Partial<Record<ExecutionOverlayLevelKey, ExecutionOverlayLevel>>;
}

export type AnnotationDragMode = "move" | "start" | "end" | "point";

export interface TradingViewChartProps {
  data: CandleData[];
  markers?: TradeMarker[];
  priceLines?: PriceLine[];
  indicatorLines?: IndicatorLine[];
  width?: number | string;
  height?: number;
  className?: string;
  autosize?: boolean;
  theme?: "dark" | "light";
  showVolume?: boolean;
  onCrosshairMove?: (price: number | null, time: Time | null) => void;
  onTimeRangeChange?: (from: Time, to: Time) => void;
  onChartClick?: (point: { time: Time; price: number }) => void;
  executionOverlays?: ExecutionOverlay[];
  selectedExecutionOverlayId?: string | null;
  onSelectedExecutionOverlayChange?: (id: string | null) => void;
  onExecutionOverlayChange?: (
    overlayId: string,
    levelKey: ExecutionOverlayLevelKey,
    price: number
  ) => void;
  onExecutionOverlayCommit?: (
    overlayId: string,
    levelKey: ExecutionOverlayLevelKey,
    price: number
  ) => void;
  visibleRange?: { from: Time; to: Time };
  fitContent?: boolean;
  annotations?: ChartAnnotation[];
  activeAnnotationTool?: AnnotationTool;
  annotationColor?: string;
  annotationLabel?: string;
  pricePrecision?: number;
  selectedAnnotationId?: string | null;
  onSelectedAnnotationChange?: (id: string | null) => void;
  onAnnotationsChange?: (annotations: ChartAnnotation[]) => void;
}
