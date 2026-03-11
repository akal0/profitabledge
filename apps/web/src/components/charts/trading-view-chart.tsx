"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  createSeriesMarkers,
} from "lightweight-charts";
import type {
  IChartApi,
  ISeriesApi,
  CandlestickData,
  HistogramData,
  LineData,
  Time,
  SeriesMarker,
  IPriceLine,
  UTCTimestamp,
  LineWidth,
  ISeriesMarkersPluginApi,
} from "lightweight-charts";
import { cn } from "@/lib/utils";

// Types for candle data
export interface CandleData {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

// Trade marker for entry/exit points
export interface TradeMarker {
  time: Time;
  position: "aboveBar" | "belowBar";
  color: string;
  shape: "arrowUp" | "arrowDown" | "circle" | "square";
  text?: string;
  size?: number;
}

// Horizontal line for SL/TP/Entry
export interface PriceLine {
  price: number;
  color: string;
  lineWidth?: LineWidth;
  lineStyle?: "solid" | "dashed" | "dotted";
  title?: string;
  axisLabelVisible?: boolean;
}

// Indicator line series (overlaid on main chart)
export interface IndicatorLine {
  id: string;
  data: { time: Time; value: number }[];
  color: string;
  lineWidth?: number;
  lineStyle?: "solid" | "dashed" | "dotted";
  title?: string;
  priceScaleId?: string; // Use '' for overlay on main chart
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

type AnnotationDragMode = "move" | "start" | "end" | "point";

type ExecutionDragState = {
  overlayId: string;
  levelKey: ExecutionOverlayLevelKey;
  lastPrice: number;
};

function getRayProjection(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  height: number
) {
  const dx = x2 - x1;
  const dy = y2 - y1;

  if (Math.abs(dx) < 0.0001) {
    return {
      x: x2,
      y: dy >= 0 ? height : 0,
    };
  }

  const targetX = dx >= 0 ? width : 0;
  const ratio = (targetX - x1) / dx;
  const projectedY = y1 + dy * ratio;

  if (projectedY >= 0 && projectedY <= height) {
    return { x: targetX, y: projectedY };
  }

  const targetY = dy >= 0 ? height : 0;
  const yRatio = (targetY - y1) / dy;

  return {
    x: x1 + dx * yRatio,
    y: targetY,
  };
}

function getArrowHeadPoints(x1: number, y1: number, x2: number, y2: number) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLength = 10;
  const leftX = x2 - headLength * Math.cos(angle - Math.PI / 7);
  const leftY = y2 - headLength * Math.sin(angle - Math.PI / 7);
  const rightX = x2 - headLength * Math.cos(angle + Math.PI / 7);
  const rightY = y2 - headLength * Math.sin(angle + Math.PI / 7);

  return `${x2},${y2} ${leftX},${leftY} ${rightX},${rightY}`;
}

function getExtendedLineProjection(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  height: number
) {
  const forward = getRayProjection(x1, y1, x2, y2, width, height);
  const backward = getRayProjection(x2, y2, x1, y1, width, height);

  return {
    start: backward,
    end: forward,
  };
}

type AnnotationDragState = {
  annotationId: string;
  mode: AnnotationDragMode;
  startPoint: { time: Time; price: number };
  initialAnnotation: ChartAnnotation;
};

interface TradingViewChartProps {
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
  // For replay mode
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

export function TradingViewChart({
  data,
  markers = [],
  priceLines = [],
  indicatorLines = [],
  width = "100%",
  height = 400,
  className,
  autosize = true,
  theme = "dark",
  showVolume = false,
  onCrosshairMove,
  onTimeRangeChange,
  onChartClick,
  executionOverlays = [],
  selectedExecutionOverlayId = null,
  onSelectedExecutionOverlayChange,
  onExecutionOverlayChange,
  onExecutionOverlayCommit,
  visibleRange,
  fitContent = true,
  annotations = [],
  activeAnnotationTool = "none",
  annotationColor = "#FACC15",
  annotationLabel = "Note",
  pricePrecision = 5,
  selectedAnnotationId = null,
  onSelectedAnnotationChange,
  onAnnotationsChange,
}: TradingViewChartProps) {
  const chartWrapperRef = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const lastFittedDatasetRef = useRef<{ startTime: string; length: number } | null>(null);
  const drawingStartRef = useRef<{ x: number; y: number; time: Time; price: number } | null>(null);
  const annotationDragRef = useRef<AnnotationDragState | null>(null);
  const executionDragRef = useRef<ExecutionDragState | null>(null);
  const viewportInteractionRef = useRef(false);
  const viewportAnimationFrameRef = useRef<number | null>(null);
  const [overlaySize, setOverlaySize] = useState({ width: 0, height: 0 });
  const [draftAnnotation, setDraftAnnotation] = useState<ChartAnnotation | null>(null);
  const [, setViewportRevision] = useState(0);

  // Theme colors
  const colors = useMemo(() => {
    if (theme === "dark") {
      return {
        background: "transparent",
        textColor: "rgba(255, 255, 255, 0.5)",
        gridColor: "rgba(255, 255, 255, 0.05)",
        borderColor: "rgba(255, 255, 255, 0.1)",
        upColor: "#00E0C8",
        downColor: "#F76290",
        wickUpColor: "#00E0C8",
        wickDownColor: "#F76290",
        volumeUp: "rgba(0, 224, 200, 0.3)",
        volumeDown: "rgba(247, 98, 144, 0.3)",
        crosshairColor: "rgba(255, 255, 255, 0.3)",
      };
    }
    return {
      background: "transparent",
      textColor: "rgba(0, 0, 0, 0.5)",
      gridColor: "rgba(0, 0, 0, 0.05)",
      borderColor: "rgba(0, 0, 0, 0.1)",
      upColor: "#26a69a",
      downColor: "#ef5350",
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
      volumeUp: "rgba(38, 166, 154, 0.3)",
      volumeDown: "rgba(239, 83, 80, 0.3)",
      crosshairColor: "rgba(0, 0, 0, 0.3)",
    };
  }, [theme]);

  const scheduleViewportSync = useCallback(() => {
    if (typeof window === "undefined") return;
    if (viewportAnimationFrameRef.current !== null) return;

    viewportAnimationFrameRef.current = window.requestAnimationFrame(() => {
      viewportAnimationFrameRef.current = null;
      setViewportRevision((value) => value + 1);
    });
  }, []);

  const zoomTimeScale = useCallback(
    (direction: "in" | "out") => {
      const timeScale = chartRef.current?.timeScale();
      const logicalRange = timeScale?.getVisibleLogicalRange();
      if (!timeScale || !logicalRange) return;

      const span = Math.max(logicalRange.to - logicalRange.from, 5);
      const center = (logicalRange.from + logicalRange.to) / 2;
      const nextSpan = direction === "in" ? span * 0.85 : span * 1.15;
      const boundedSpan = Math.max(5, Math.min(data.length + 200, nextSpan));

      timeScale.setVisibleLogicalRange({
        from: center - boundedSpan / 2,
        to: center + boundedSpan / 2,
      });
      scheduleViewportSync();
    },
    [data.length, scheduleViewportSync]
  );

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current || !chartWrapperRef.current) return;

    const containerWidth =
      typeof width === "number" && width > 0 ? width : chartWrapperRef.current.clientWidth;
    const containerHeight =
      height > 0 ? height : chartWrapperRef.current.clientHeight || 400;

    const chart = createChart(chartContainerRef.current, {
      width: containerWidth,
      height: containerHeight,
      layout: {
        background: { type: ColorType.Solid, color: colors.background },
        textColor: colors.textColor,
      },
      grid: {
        vertLines: { color: colors.gridColor },
        horzLines: { color: colors.gridColor },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: colors.crosshairColor,
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: theme === "dark" ? "#1a1a2e" : "#ffffff",
        },
        horzLine: {
          color: colors.crosshairColor,
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: theme === "dark" ? "#1a1a2e" : "#ffffff",
        },
      },
      rightPriceScale: {
        borderColor: colors.borderColor,
        scaleMargins: {
          top: 0.1,
          bottom: showVolume ? 0.2 : 0.1,
        },
      },
      timeScale: {
        borderColor: colors.borderColor,
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: {
        vertTouchDrag: false,
      },
    });

    chartRef.current = chart;

    // Add candlestick series using v5 API
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: colors.upColor,
      downColor: colors.downColor,
      borderVisible: false,
      wickUpColor: colors.wickUpColor,
      wickDownColor: colors.wickDownColor,
    });
    candleSeriesRef.current = candleSeries;

    // Create markers plugin for the candlestick series
    const markersPlugin = createSeriesMarkers(candleSeries);
    markersPluginRef.current = markersPlugin;

    // Add volume series if enabled
    if (showVolume) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: colors.volumeUp,
        priceFormat: {
          type: "volume",
        },
        priceScaleId: "",
      });
      volumeSeries.priceScale().applyOptions({
        scaleMargins: {
          top: 0.85,
          bottom: 0,
        },
      });
      volumeSeriesRef.current = volumeSeries;
    }

    // Handle crosshair move
    if (onCrosshairMove) {
      chart.subscribeCrosshairMove((param) => {
        if (!param.time || !param.point) {
          onCrosshairMove(null, null);
          return;
        }
        const data = param.seriesData.get(candleSeries) as CandlestickData<Time> | undefined;
        onCrosshairMove(data?.close ?? null, param.time);
      });
    }

    // Handle time range change
    if (onTimeRangeChange) {
      chart.timeScale().subscribeVisibleTimeRangeChange((range) => {
        if (range) {
          onTimeRangeChange(range.from as Time, range.to as Time);
        }
        scheduleViewportSync();
      });
    } else {
      chart.timeScale().subscribeVisibleTimeRangeChange(() => {
        scheduleViewportSync();
      });
    }

    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      scheduleViewportSync();
    });

    // Handle resize with ResizeObserver for both width and height
    let resizeObserver: ResizeObserver | null = null;
    setOverlaySize({ width: containerWidth, height: containerHeight });

    if (autosize && chartWrapperRef.current) {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width: w, height: h } = entry.contentRect;
          if (w > 0 && h > 0) {
            chart.applyOptions({ width: w, height: h });
            setOverlaySize({ width: w, height: h });
          }
        }
      });
      resizeObserver.observe(chartWrapperRef.current);
    }

    return () => {
      if (viewportAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(viewportAnimationFrameRef.current);
        viewportAnimationFrameRef.current = null;
      }
      resizeObserver?.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      indicatorSeriesRef.current.clear();
      markersPluginRef.current = null;
    };
  }, [height, autosize, theme, showVolume, colors, onTimeRangeChange, scheduleViewportSync]);

  const normalizeTime = useCallback(
    (value: Time | null | undefined, x?: number) => {
      if (typeof value === "number") return value as Time;
      if (value && typeof value === "object" && "timestamp" in value) {
        return (value as { timestamp: number }).timestamp as Time;
      }

      if (typeof x === "number" && overlaySize.width > 0 && data.length > 0) {
        const index = Math.min(
          data.length - 1,
          Math.max(0, Math.round((x / overlaySize.width) * (data.length - 1)))
        );
        return data[index]?.time ?? null;
      }

      return null;
    },
    [data, overlaySize.width]
  );

  const getChartPoint = useCallback(
    (clientX: number, clientY: number) => {
      const rect = chartWrapperRef.current?.getBoundingClientRect();
      if (!rect || !chartRef.current || !candleSeriesRef.current) return null;

      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const y = Math.max(0, Math.min(clientY - rect.top, rect.height));
      const time = normalizeTime(chartRef.current.timeScale().coordinateToTime(x) as Time | null, x);
      const priceValue = candleSeriesRef.current.coordinateToPrice(y);

      if (time == null || priceValue == null) return null;

      return {
        x,
        y,
        time,
        price: Number(priceValue),
      };
    },
    [normalizeTime]
  );

  const getPointFromCoordinates = useCallback(
    (x: number, y: number) => {
      if (!chartRef.current || !candleSeriesRef.current) return null;

      const normalizedX = Math.max(0, Math.min(x, overlaySize.width));
      const normalizedY = Math.max(0, Math.min(y, overlaySize.height));
      const time = normalizeTime(chartRef.current.timeScale().coordinateToTime(normalizedX) as Time | null, normalizedX);
      const priceValue = candleSeriesRef.current.coordinateToPrice(normalizedY);

      if (time == null || priceValue == null) return null;

      return {
        x: normalizedX,
        y: normalizedY,
        time,
        price: Number(priceValue),
      };
    },
    [normalizeTime, overlaySize.height, overlaySize.width]
  );

  const getXForTime = useCallback((time: Time) => {
    const x = chartRef.current?.timeScale().timeToCoordinate(time);
    return typeof x === "number" ? x : null;
  }, []);

  const getYForPrice = useCallback((price: number) => {
    const y = candleSeriesRef.current?.priceToCoordinate(price);
    return typeof y === "number" ? y : null;
  }, []);

  const timeIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach((candle, index) => {
      map.set(serializeTime(candle.time), index);
    });
    return map;
  }, [data]);

  const magnetizePoint = useCallback(
    (point: { x: number; y: number; time: Time; price: number }) => {
      const exactIndex = timeIndexMap.get(serializeTime(point.time));
      const fallbackIndex =
        exactIndex ??
        (typeof point.x === "number" && overlaySize.width > 0 && data.length > 0
          ? Math.min(data.length - 1, Math.max(0, Math.round((point.x / overlaySize.width) * (data.length - 1))))
          : null);

      if (fallbackIndex == null) return point;

      const candle = data[fallbackIndex];
      if (!candle) return point;

      const levels = [candle.open, candle.high, candle.low, candle.close];
      const snappedPrice = levels.reduce((closest, candidate) =>
        Math.abs(candidate - point.price) < Math.abs(closest - point.price) ? candidate : closest
      );
      const snappedY = candleSeriesRef.current?.priceToCoordinate(snappedPrice);

      return {
        ...point,
        time: candle.time,
        price: snappedPrice,
        y: typeof snappedY === "number" ? snappedY : point.y,
      };
    },
    [data, overlaySize.width, timeIndexMap]
  );

  const constrainDrawingPoint = useCallback(
    (
      start: { x: number; y: number; time: Time; price: number },
      point: { x: number; y: number; time: Time; price: number }
    ) => {
      const dx = point.x - start.x;
      const dy = point.y - start.y;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      let targetX = point.x;
      let targetY = point.y;

      if (absDx > absDy * 1.6) {
        targetY = start.y;
      } else if (absDy > absDx * 1.6) {
        targetX = start.x;
      } else {
        const length = Math.max(absDx, absDy);
        targetX = start.x + Math.sign(dx || 1) * length;
        targetY = start.y + Math.sign(dy || 1) * length;
      }

      return getPointFromCoordinates(targetX, targetY) ?? point;
    },
    [getPointFromCoordinates]
  );

  const applyPointerModifiers = useCallback(
    (
      point: { x: number; y: number; time: Time; price: number },
      event: Pick<React.PointerEvent, "ctrlKey" | "metaKey" | "shiftKey">,
      options?: {
        start?: { x: number; y: number; time: Time; price: number } | null;
        constrain?: boolean;
      }
    ) => {
      let nextPoint = point;

      if (event.ctrlKey || event.metaKey) {
        nextPoint = magnetizePoint(nextPoint);
      }

      if (event.shiftKey && options?.constrain && options.start) {
        nextPoint = constrainDrawingPoint(options.start, nextPoint);
      }

      return nextPoint;
    },
    [constrainDrawingPoint, magnetizePoint]
  );

  const shiftTimeByIndex = useCallback(
    (time: Time, delta: number) => {
      const index = timeIndexMap.get(serializeTime(time));
      if (index == null || data.length === 0) return time;

      const nextIndex = Math.max(0, Math.min(data.length - 1, index + delta));
      return data[nextIndex]?.time ?? time;
    },
    [data, timeIndexMap]
  );

  const commitAnnotation = useCallback(
    (annotation: ChartAnnotation) => {
      onAnnotationsChange?.([...annotations, annotation]);
      onSelectedAnnotationChange?.(annotation.id);
    },
    [annotations, onAnnotationsChange, onSelectedAnnotationChange]
  );

  const createDraftAnnotation = useCallback(
    (
      tool: Exclude<AnnotationTool, "none" | "horizontal" | "vertical" | "note">,
      start: { time: Time; price: number },
      end: { time: Time; price: number }
    ): ChartAnnotation => ({
      id: "draft",
      type: tool,
      color: annotationColor,
      label:
        tool === "trendline"
          ? "Trend line"
          : tool === "extended"
          ? "Extended line"
          : tool === "ray"
          ? "Ray"
          : tool === "arrow"
          ? "Arrow"
          : tool === "rectangle"
          ? "Zone"
          : tool === "measure"
          ? "Measure"
          : tool === "anchored-vwap"
          ? "Anchored VWAP"
          : "Fib",
      startTime: start.time,
      startPrice: start.price,
      endTime: end.time,
      endPrice: end.price,
    }),
    [annotationColor]
  );

  const beginAnnotationDrag = useCallback(
    (
      event: React.PointerEvent<SVGGElement | SVGCircleElement | SVGRectElement>,
      annotation: ChartAnnotation,
      mode: AnnotationDragMode
    ) => {
      if (activeAnnotationTool !== "none" || annotation.id === "draft") return;

      const rawPoint = getChartPoint(event.clientX, event.clientY);
      const point = rawPoint ? applyPointerModifiers(rawPoint, event) : null;
      if (!point) return;

      event.stopPropagation();
      onSelectedAnnotationChange?.(annotation.id);
      onSelectedExecutionOverlayChange?.(null);
      annotationDragRef.current = {
        annotationId: annotation.id,
        mode,
        startPoint: { time: point.time, price: point.price },
        initialAnnotation: annotation,
      };
    },
    [activeAnnotationTool, applyPointerModifiers, getChartPoint, onSelectedAnnotationChange, onSelectedExecutionOverlayChange]
  );

  const handleAnnotationDragMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!annotationDragRef.current) return;

      const rawPoint = getChartPoint(event.clientX, event.clientY);
      const point = rawPoint ? applyPointerModifiers(rawPoint, event) : null;
      if (!point) return;

      const drag = annotationDragRef.current;
      const startIndex = timeIndexMap.get(serializeTime(drag.startPoint.time));
      const currentIndex = timeIndexMap.get(serializeTime(point.time));
      const timeDelta =
        startIndex != null && currentIndex != null ? currentIndex - startIndex : 0;
      const priceDelta = point.price - drag.startPoint.price;

      onAnnotationsChange?.(
        annotations.map((annotation) => {
          if (annotation.id !== drag.annotationId) return annotation;

          const base = drag.initialAnnotation;

          if (
            base.type === "trendline" ||
            base.type === "extended" ||
            base.type === "ray" ||
            base.type === "arrow" ||
            base.type === "anchored-vwap"
          ) {
            if (drag.mode === "start") {
              return {
                ...base,
                startTime: shiftTimeByIndex(base.startTime, timeDelta),
                startPrice: base.startPrice + priceDelta,
              };
            }

            if (drag.mode === "end") {
              return {
                ...base,
                endTime: shiftTimeByIndex(base.endTime, timeDelta),
                endPrice: base.endPrice + priceDelta,
              };
            }

            return {
              ...base,
              startTime: shiftTimeByIndex(base.startTime, timeDelta),
              endTime: shiftTimeByIndex(base.endTime, timeDelta),
              startPrice: base.startPrice + priceDelta,
              endPrice: base.endPrice + priceDelta,
            };
          }

          if (base.type === "horizontal") {
            return {
              ...base,
              price: base.price + priceDelta,
            };
          }

          if (base.type === "vertical") {
            return {
              ...base,
              time: shiftTimeByIndex(base.time, timeDelta),
            };
          }

          if (base.type === "rectangle" || base.type === "fib" || base.type === "measure") {
            if (drag.mode === "start") {
              return {
                ...base,
                startTime: shiftTimeByIndex(base.startTime, timeDelta),
                startPrice: base.startPrice + priceDelta,
              };
            }

            if (drag.mode === "end") {
              return {
                ...base,
                endTime: shiftTimeByIndex(base.endTime, timeDelta),
                endPrice: base.endPrice + priceDelta,
              };
            }

            return {
              ...base,
              startTime: shiftTimeByIndex(base.startTime, timeDelta),
              endTime: shiftTimeByIndex(base.endTime, timeDelta),
              startPrice: base.startPrice + priceDelta,
              endPrice: base.endPrice + priceDelta,
            };
          }

          return {
            ...base,
            time: shiftTimeByIndex(base.time, timeDelta),
            price: base.price + priceDelta,
          };
        })
      );
    },
    [annotations, applyPointerModifiers, getChartPoint, onAnnotationsChange, shiftTimeByIndex, timeIndexMap]
  );

  const endAnnotationDrag = useCallback(() => {
    annotationDragRef.current = null;
  }, []);

  const beginExecutionDrag = useCallback(
    (
      event: React.PointerEvent<SVGGElement | SVGCircleElement | SVGRectElement>,
      overlayId: string,
      levelKey: ExecutionOverlayLevelKey
    ) => {
      if (activeAnnotationTool !== "none") return;

      const rawPoint = getChartPoint(event.clientX, event.clientY);
      const point = rawPoint ? applyPointerModifiers(rawPoint, event) : null;
      if (!point) return;

      event.stopPropagation();
      onSelectedAnnotationChange?.(null);
      onSelectedExecutionOverlayChange?.(overlayId);
      executionDragRef.current = {
        overlayId,
        levelKey,
        lastPrice: point.price,
      };
    },
    [activeAnnotationTool, applyPointerModifiers, getChartPoint, onSelectedAnnotationChange, onSelectedExecutionOverlayChange]
  );

  const handleExecutionDragMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!executionDragRef.current) return;

      const rawPoint = getChartPoint(event.clientX, event.clientY);
      const point = rawPoint ? applyPointerModifiers(rawPoint, event) : null;
      if (!point) return;

      executionDragRef.current.lastPrice = point.price;
      onExecutionOverlayChange?.(
        executionDragRef.current.overlayId,
        executionDragRef.current.levelKey,
        point.price
      );
    },
    [applyPointerModifiers, getChartPoint, onExecutionOverlayChange]
  );

  const endExecutionDrag = useCallback(() => {
    if (!executionDragRef.current) return;

    const { overlayId, levelKey, lastPrice } = executionDragRef.current;
    executionDragRef.current = null;
    onExecutionOverlayCommit?.(overlayId, levelKey, lastPrice);
  }, [onExecutionOverlayCommit]);

  const handleOverlayPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      handleAnnotationDragMove(event);
      handleExecutionDragMove(event);
    },
    [handleAnnotationDragMove, handleExecutionDragMove]
  );

  const handleOverlayPointerUp = useCallback(() => {
    endAnnotationDrag();
    endExecutionDrag();
    viewportInteractionRef.current = false;
    scheduleViewportSync();
  }, [endAnnotationDrag, endExecutionDrag]);

  const handleViewportPointerDownCapture = useCallback(() => {
    viewportInteractionRef.current = true;
  }, []);

  const handleViewportPointerMoveCapture = useCallback(() => {
    if (!viewportInteractionRef.current) return;
    scheduleViewportSync();
  }, [scheduleViewportSync]);

  const handleViewportWheelCapture = useCallback(() => {
    scheduleViewportSync();
  }, [scheduleViewportSync]);

  const handleChartKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const hasZoomModifier = event.ctrlKey || event.metaKey;
      if (!hasZoomModifier) return;

      if (event.key === "=" || event.key === "+" || event.key === "Add") {
        event.preventDefault();
        zoomTimeScale("in");
        return;
      }

      if (event.key === "-" || event.key === "_" || event.key === "Subtract") {
        event.preventDefault();
        zoomTimeScale("out");
      }
    },
    [zoomTimeScale]
  );

  const focusChartWrapper = useCallback(() => {
    chartWrapperRef.current?.focus();
  }, []);

  useEffect(() => {
    const stopViewportInteraction = () => {
      if (!viewportInteractionRef.current) return;
      viewportInteractionRef.current = false;
      scheduleViewportSync();
    };

    window.addEventListener("pointerup", stopViewportInteraction);
    window.addEventListener("pointercancel", stopViewportInteraction);

    return () => {
      window.removeEventListener("pointerup", stopViewportInteraction);
      window.removeEventListener("pointercancel", stopViewportInteraction);
    };
  }, [scheduleViewportSync]);

  const handleDrawingPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (activeAnnotationTool === "none") return;
      const rawPoint = getChartPoint(event.clientX, event.clientY);
      const point = rawPoint ? applyPointerModifiers(rawPoint, event) : null;
      if (!point) return;

      onSelectedAnnotationChange?.(null);
      onSelectedExecutionOverlayChange?.(null);

      if (activeAnnotationTool === "horizontal") {
        commitAnnotation({
          id: crypto.randomUUID(),
          type: "horizontal",
          color: annotationColor,
          price: point.price,
          label: annotationLabel || "Level",
        });
        return;
      }

      if (activeAnnotationTool === "vertical") {
        commitAnnotation({
          id: crypto.randomUUID(),
          type: "vertical",
          color: annotationColor,
          time: point.time,
          label: annotationLabel || "Time marker",
        });
        return;
      }

      if (activeAnnotationTool === "note") {
        commitAnnotation({
          id: crypto.randomUUID(),
          type: "note",
          color: annotationColor,
          time: point.time,
          price: point.price,
          label: annotationLabel || "Note",
        });
        return;
      }

      drawingStartRef.current = point;
      setDraftAnnotation(createDraftAnnotation(activeAnnotationTool, point, point));
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [
      activeAnnotationTool,
      annotationColor,
      annotationLabel,
      commitAnnotation,
      createDraftAnnotation,
      getChartPoint,
      applyPointerModifiers,
      onSelectedAnnotationChange,
      onSelectedExecutionOverlayChange,
    ]
  );

  const handleDrawingPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!drawingStartRef.current || activeAnnotationTool === "none") return;
      const rawPoint = getChartPoint(event.clientX, event.clientY);
      const point = rawPoint
        ? applyPointerModifiers(rawPoint, event, {
            start: drawingStartRef.current,
            constrain:
              activeAnnotationTool === "trendline" ||
              activeAnnotationTool === "extended" ||
              activeAnnotationTool === "ray" ||
              activeAnnotationTool === "arrow" ||
              activeAnnotationTool === "measure",
          })
        : null;
      if (!point) return;
      setDraftAnnotation(
        createDraftAnnotation(
          activeAnnotationTool as
            | "trendline"
            | "extended"
            | "ray"
            | "arrow"
            | "rectangle"
            | "fib"
            | "measure"
            | "anchored-vwap",
          drawingStartRef.current,
          point
        )
      );
    },
    [activeAnnotationTool, applyPointerModifiers, createDraftAnnotation, getChartPoint]
  );

  const handleDrawingPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!drawingStartRef.current || !draftAnnotation) return;
      const rawPoint = getChartPoint(event.clientX, event.clientY);
      const point = rawPoint
        ? applyPointerModifiers(rawPoint, event, {
            start: drawingStartRef.current,
            constrain:
              activeAnnotationTool === "trendline" ||
              activeAnnotationTool === "extended" ||
              activeAnnotationTool === "ray" ||
              activeAnnotationTool === "arrow" ||
              activeAnnotationTool === "measure",
          })
        : null;
      if (point) {
        const finalAnnotation = createDraftAnnotation(
          activeAnnotationTool as
            | "trendline"
            | "extended"
            | "ray"
            | "arrow"
            | "rectangle"
            | "fib"
            | "measure"
            | "anchored-vwap",
          drawingStartRef.current,
          point
        );
        const distance = Math.abs(point.x - drawingStartRef.current.x) + Math.abs(point.y - drawingStartRef.current.y);
        if (distance > 6) {
          commitAnnotation({
            ...finalAnnotation,
            id: crypto.randomUUID(),
          });
        }
      }

      drawingStartRef.current = null;
      setDraftAnnotation(null);
    },
    [activeAnnotationTool, applyPointerModifiers, commitAnnotation, createDraftAnnotation, draftAnnotation, getChartPoint]
  );

  const handleChartClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      onSelectedExecutionOverlayChange?.(null);
      if (!onChartClick || activeAnnotationTool !== "none") return;
      if (drawingStartRef.current || annotationDragRef.current) return;
      const point = getChartPoint(event.clientX, event.clientY);
      if (!point) return;
      onChartClick({ time: point.time, price: point.price });
    },
    [activeAnnotationTool, getChartPoint, onChartClick, onSelectedExecutionOverlayChange]
  );

  // Update data
  useEffect(() => {
    if (!candleSeriesRef.current || !data.length) return;

    // Convert to candlestick format
    const candleData: CandlestickData<Time>[] = data.map((d) => ({
      time: d.time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    candleSeriesRef.current.setData(candleData);

    // Update volume if enabled
    if (volumeSeriesRef.current && showVolume) {
      const volumeData: HistogramData<Time>[] = data.map((d) => ({
        time: d.time,
        value: d.volume || 0,
        color: d.close >= d.open ? colors.volumeUp : colors.volumeDown,
      }));
      volumeSeriesRef.current.setData(volumeData);
    }

    // Preserve manual zoom during replay. Only auto-fit on the first load
    // or when the dataset itself resets to a different range.
    if (fitContent && chartRef.current) {
      const nextDataset = {
        startTime: serializeTime(data[0].time),
        length: data.length,
      };
      const lastDataset = lastFittedDatasetRef.current;
      const shouldFit =
        lastDataset === null ||
        lastDataset.startTime !== nextDataset.startTime ||
        nextDataset.length < lastDataset.length;

      if (shouldFit) {
        chartRef.current.timeScale().fitContent();
      }

      lastFittedDatasetRef.current = nextDataset;
    }
  }, [data, showVolume, colors, fitContent]);

  // Update markers using v5 markers plugin
  useEffect(() => {
    if (!markersPluginRef.current) return;

    const chartMarkers: SeriesMarker<Time>[] = markers.map((m) => ({
      time: m.time,
      position: m.position,
      color: m.color,
      shape: m.shape,
      text: m.text,
      size: m.size || 1,
    }));

    markersPluginRef.current.setMarkers(chartMarkers);
  }, [markers]);

  // Update price lines
  useEffect(() => {
    if (!candleSeriesRef.current) return;

    // Remove existing price lines
    priceLinesRef.current.forEach((line) => {
      candleSeriesRef.current?.removePriceLine(line);
    });
    priceLinesRef.current = [];

    // Add new price lines
    priceLines.forEach((pl) => {
      const lineStyle =
        pl.lineStyle === "dashed"
          ? LineStyle.Dashed
          : pl.lineStyle === "dotted"
          ? LineStyle.Dotted
          : LineStyle.Solid;

      const priceLine = candleSeriesRef.current?.createPriceLine({
        price: pl.price,
        color: pl.color,
        lineWidth: pl.lineWidth || 1,
        lineStyle,
        title: pl.title || "",
        axisLabelVisible: pl.axisLabelVisible ?? true,
      });

      if (priceLine) {
        priceLinesRef.current.push(priceLine);
      }
    });
  }, [priceLines]);

  // Update indicator lines
  useEffect(() => {
    if (!chartRef.current) return;

    const chart = chartRef.current;
    const currentSeriesMap = indicatorSeriesRef.current;
    const newIds = new Set(indicatorLines.map((il) => il.id));

    // Remove series that are no longer in the list
    currentSeriesMap.forEach((series, id) => {
      if (!newIds.has(id)) {
        chart.removeSeries(series);
        currentSeriesMap.delete(id);
      }
    });

    // Add or update series
    indicatorLines.forEach((il) => {
      if (il.data.length === 0) return;

      let series = currentSeriesMap.get(il.id);

      if (!series) {
        // Create new line series
        const lineStyle =
          il.lineStyle === "dashed"
            ? LineStyle.Dashed
            : il.lineStyle === "dotted"
            ? LineStyle.Dotted
            : LineStyle.Solid;

        series = chart.addSeries(LineSeries, {
          color: il.color,
          lineWidth: (il.lineWidth || 2) as LineWidth,
          lineStyle,
          priceScaleId: il.priceScaleId ?? "right",
          title: il.title || "",
          lastValueVisible: false,
          priceLineVisible: false,
        });
        currentSeriesMap.set(il.id, series);
      }

      // Update data
      const lineData: LineData<Time>[] = il.data.map((d) => ({
        time: d.time,
        value: d.value,
      }));
      series.setData(lineData);
    });
  }, [indicatorLines]);

  // Update visible range for replay mode
  useEffect(() => {
    if (!chartRef.current || !visibleRange) return;
    chartRef.current.timeScale().setVisibleRange(visibleRange);
  }, [visibleRange]);

  const renderedAnnotations = useMemo(() => {
    return draftAnnotation ? [...annotations, draftAnnotation] : annotations;
  }, [annotations, draftAnnotation]);

  const renderAnnotationLabel = useCallback(
    (key: string, x: number, y: number, label: string, color: string) => {
      const text = label.trim();
      if (!text) return null;

      const labelX = Math.max(8, Math.min(x + 10, Math.max(8, overlaySize.width - 120)));
      const labelY = Math.max(18, Math.min(y - 10, Math.max(18, overlaySize.height - 10)));
      const pillWidth = Math.max(54, text.length * 7 + 18);

      return (
        <g key={key}>
          <rect
            x={labelX}
            y={labelY - 18}
            width={pillWidth}
            height={18}
            rx={6}
            fill="rgba(2, 6, 23, 0.88)"
            stroke={color}
            strokeWidth={1}
          />
          <text
            x={labelX + 8}
            y={labelY - 6}
            fill="white"
            fontSize="10"
            fontFamily="var(--font-geist-mono), monospace"
          >
            {text}
          </text>
        </g>
      );
    },
    [overlaySize.height, overlaySize.width]
  );

  const renderSelectionHandle = useCallback(
    (
      key: string,
      x: number,
      y: number,
      color: string,
      annotation: ChartAnnotation,
      mode: AnnotationDragMode
    ) => (
      <circle
        key={key}
        cx={x}
        cy={y}
        r={5}
        fill={theme === "dark" ? "#020617" : "#ffffff"}
        stroke={color}
        strokeWidth={1.5}
        className="pointer-events-auto cursor-pointer"
        onPointerDown={(event) => beginAnnotationDrag(event, annotation, mode)}
      />
    ),
    [beginAnnotationDrag, theme]
  );

  return (
    <div
      ref={chartWrapperRef}
      className={cn("relative", className)}
      tabIndex={0}
      style={{
        width: typeof width === "string" ? width : undefined,
        height: height > 0 ? height : undefined,
      }}
      onClick={handleChartClick}
      onKeyDown={handleChartKeyDown}
      onPointerDown={focusChartWrapper}
      onPointerDownCapture={handleViewportPointerDownCapture}
      onPointerMove={handleOverlayPointerMove}
      onPointerMoveCapture={handleViewportPointerMoveCapture}
      onPointerUp={handleOverlayPointerUp}
      onPointerCancel={handleOverlayPointerUp}
      onWheelCapture={handleViewportWheelCapture}
    >
      <div ref={chartContainerRef} className="absolute inset-0" />

      <svg className="pointer-events-none absolute inset-0 z-20 size-full overflow-visible">
        {executionOverlays.map((overlay) => {
          const rawStartX = getXForTime(overlay.startTime);
          const rawEndX = overlay.endTime ? getXForTime(overlay.endTime) : null;
          const anchorX =
            getXForTime(overlay.labelTime ?? overlay.startTime) ?? rawStartX ?? rawEndX;

          if (rawStartX == null && rawEndX == null && anchorX == null) return null;

          const startX = rawStartX ?? anchorX ?? 0;
          const endX = rawEndX ?? startX;
          const baseLeft = Math.max(0, Math.min(startX, endX));
          const baseRight = Math.min(overlaySize.width - 14, Math.max(startX, endX));
          const left = baseLeft;
          const right = Math.min(overlaySize.width - 14, Math.max(left + 96, baseRight));
          const entryLevel = overlay.levels.entry;
          const stopLevel = overlay.levels.sl;
          const targetLevel = overlay.levels.tp;
          const triggerLevel = overlay.levels.trigger;
          const entryY = entryLevel ? getYForPrice(entryLevel.price) : null;
          const stopY = stopLevel ? getYForPrice(stopLevel.price) : null;
          const targetY = targetLevel ? getYForPrice(targetLevel.price) : null;
          const triggerY = triggerLevel ? getYForPrice(triggerLevel.price) : null;
          const isSelected = overlay.id === selectedExecutionOverlayId;

          const renderExecutionTag = (
            levelKey: ExecutionOverlayLevelKey,
            level: ExecutionOverlayLevel,
            y: number | null,
            x: number
          ) => {
            if (y == null) return null;

            const pillWidth = Math.max(66, level.label.length * 7 + 18);
            const labelAnchorX = anchorX ?? x;
            const pillX = Math.max(
              10,
              Math.min(labelAnchorX + 12, overlaySize.width - pillWidth - 10)
            );
            const pillY = Math.max(16, Math.min(y - 10, overlaySize.height - 20));
            const connectorX = Math.max(10, Math.min(labelAnchorX, pillX - 8));

            return (
              <g
                key={`${overlay.id}-${levelKey}`}
                className={cn(
                  "pointer-events-auto",
                  level.draggable ? "cursor-row-resize" : "cursor-pointer"
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectedAnnotationChange?.(null);
                  onSelectedExecutionOverlayChange?.(overlay.id);
                }}
                onPointerDown={
                  level.draggable
                    ? (event) => beginExecutionDrag(event, overlay.id, levelKey)
                    : undefined
                }
              >
                <line
                  x1={Math.min(x, connectorX)}
                  y1={y}
                  x2={connectorX}
                  y2={y}
                  stroke={level.color}
                  strokeWidth={1}
                  opacity={0.75}
                />
                <rect
                  x={pillX}
                  y={pillY - 8}
                  width={pillWidth}
                  height={18}
                  rx={6}
                  fill="rgba(2, 6, 23, 0.92)"
                  stroke={level.color}
                  strokeWidth={1}
                />
                <text
                  x={pillX + 8}
                  y={pillY + 4}
                  fill="white"
                  fontSize="10"
                    fontFamily="var(--font-geist-mono), monospace"
                >
                  {level.label}
                </text>
                {level.draggable ? (
                  <circle
                    cx={connectorX}
                    cy={y}
                    r={5}
                    fill={theme === "dark" ? "#020617" : "#ffffff"}
                    stroke={level.color}
                    strokeWidth={1.5}
                    className="pointer-events-auto cursor-row-resize"
                    onPointerDown={(event) => beginExecutionDrag(event, overlay.id, levelKey)}
                  />
                ) : null}
                {isSelected ? (
                  <rect
                    x={pillX - 2}
                    y={pillY - 10}
                    width={pillWidth + 4}
                    height={22}
                    rx={8}
                    fill="none"
                    stroke={level.color}
                    strokeWidth={1}
                    opacity={0.65}
                  />
                ) : null}
              </g>
            );
          };

          return (
            <g key={overlay.id}>
              {entryY != null && stopY != null ? (
                <rect
                  x={left}
                  y={Math.min(entryY, stopY)}
                  width={Math.max(24, right - left)}
                  height={Math.max(2, Math.abs(entryY - stopY))}
                  fill="rgba(244, 63, 94, 0.12)"
                  stroke="none"
                />
              ) : null}
              {entryY != null && targetY != null ? (
                <rect
                  x={left}
                  y={Math.min(entryY, targetY)}
                  width={Math.max(24, right - left)}
                  height={Math.max(2, Math.abs(entryY - targetY))}
                  fill="rgba(20, 184, 166, 0.12)"
                  stroke="none"
                />
              ) : null}
              {entryLevel ? renderExecutionTag("entry", entryLevel, entryY, right) : null}
              {triggerLevel ? renderExecutionTag("trigger", triggerLevel, triggerY, right - 26) : null}
              {stopLevel ? renderExecutionTag("sl", stopLevel, stopY, right) : null}
              {targetLevel ? renderExecutionTag("tp", targetLevel, targetY, right) : null}
            </g>
          );
        })}

        {renderedAnnotations.map((annotation) => {
          const isSelected =
            annotation.id === selectedAnnotationId && annotation.id !== "draft";
          const strokeWidth = isSelected ? 2.5 : 1.5;

          if (
            annotation.type === "trendline" ||
            annotation.type === "extended" ||
            annotation.type === "ray" ||
            annotation.type === "arrow"
          ) {
            const x1 = getXForTime(annotation.startTime);
            const y1 = getYForPrice(annotation.startPrice);
            const x2 = getXForTime(annotation.endTime);
            const y2 = getYForPrice(annotation.endPrice);
            if ([x1, y1, x2, y2].some((value) => value == null)) return null;
            const isRay = annotation.type === "ray";
            const isExtended = annotation.type === "extended";
            const isArrow = annotation.type === "arrow";
            const rayProjection = isRay
              ? getRayProjection(
                  x1!,
                  y1!,
                  x2!,
                  y2!,
                  overlaySize.width,
                  overlaySize.height
                )
              : null;
            const extendedProjection = isExtended
              ? getExtendedLineProjection(
                  x1!,
                  y1!,
                  x2!,
                  y2!,
                  overlaySize.width,
                  overlaySize.height
                )
              : null;
            const renderX1 = extendedProjection?.start.x ?? x1!;
            const renderY1 = extendedProjection?.start.y ?? y1!;
            const renderX2 = extendedProjection?.end.x ?? rayProjection?.x ?? x2!;
            const renderY2 = extendedProjection?.end.y ?? rayProjection?.y ?? y2!;

            return (
              <g
                key={annotation.id}
                className={cn(
                  "pointer-events-auto",
                  activeAnnotationTool === "none" ? "cursor-move" : "cursor-pointer"
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectedAnnotationChange?.(annotation.id);
                }}
                onPointerDown={(event) => beginAnnotationDrag(event, annotation, "move")}
              >
                <line
                  x1={renderX1}
                  y1={renderY1}
                  x2={renderX2}
                  y2={renderY2}
                  stroke={annotation.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={annotation.id === "draft" ? "6 4" : undefined}
                />
                {isArrow ? (
                  <polygon
                    points={getArrowHeadPoints(x1!, y1!, x2!, y2!)}
                    fill={annotation.color}
                    opacity={annotation.id === "draft" ? 0.75 : 1}
                  />
                ) : null}
                {annotation.label &&
                  renderAnnotationLabel(
                    `${annotation.id}-label`,
                    isRay ? renderX2 : x2!,
                    isRay ? renderY2 : y2!,
                    annotation.label,
                    annotation.color
                  )}
                {isSelected &&
                  renderSelectionHandle(
                    `${annotation.id}-start-handle`,
                    x1!,
                    y1!,
                    annotation.color,
                    annotation,
                    "start"
                  )}
                {isSelected &&
                  renderSelectionHandle(
                    `${annotation.id}-end-handle`,
                    x2!,
                    y2!,
                    annotation.color,
                    annotation,
                    "end"
                  )}
              </g>
            );
          }

          if (annotation.type === "horizontal") {
            const y = getYForPrice(annotation.price);
            if (y == null) return null;
            return (
              <g
                key={annotation.id}
                className={cn(
                  "pointer-events-auto",
                  activeAnnotationTool === "none" ? "cursor-row-resize" : "cursor-pointer"
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectedAnnotationChange?.(annotation.id);
                }}
                onPointerDown={(event) => beginAnnotationDrag(event, annotation, "move")}
              >
                <line
                  x1={0}
                  y1={y}
                  x2={overlaySize.width}
                  y2={y}
                  stroke={annotation.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray="8 6"
                />
                {annotation.label &&
                  renderAnnotationLabel(
                    `${annotation.id}-label`,
                    overlaySize.width - 130,
                    y,
                    annotation.label,
                    annotation.color
                  )}
                {isSelected &&
                  renderSelectionHandle(
                    `${annotation.id}-price-handle`,
                    Math.max(24, overlaySize.width - 32),
                    y,
                    annotation.color,
                    annotation,
                    "move"
                  )}
              </g>
            );
          }

          if (annotation.type === "vertical") {
            const x = getXForTime(annotation.time);
            if (x == null) return null;
            return (
              <g
                key={annotation.id}
                className={cn(
                  "pointer-events-auto",
                  activeAnnotationTool === "none" ? "cursor-col-resize" : "cursor-pointer"
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectedAnnotationChange?.(annotation.id);
                }}
                onPointerDown={(event) => beginAnnotationDrag(event, annotation, "move")}
              >
                <line
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={overlaySize.height}
                  stroke={annotation.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray="8 6"
                />
                {annotation.label &&
                  renderAnnotationLabel(
                    `${annotation.id}-label`,
                    x,
                    28,
                    annotation.label,
                    annotation.color
                  )}
                {isSelected &&
                  renderSelectionHandle(
                    `${annotation.id}-time-handle`,
                    x,
                    28,
                    annotation.color,
                    annotation,
                    "move"
                  )}
              </g>
            );
          }

          if (annotation.type === "rectangle") {
            const x1 = getXForTime(annotation.startTime);
            const y1 = getYForPrice(annotation.startPrice);
            const x2 = getXForTime(annotation.endTime);
            const y2 = getYForPrice(annotation.endPrice);
            if ([x1, y1, x2, y2].some((value) => value == null)) return null;

            const left = Math.min(x1!, x2!);
            const top = Math.min(y1!, y2!);
            const rectWidth = Math.max(2, Math.abs(x2! - x1!));
            const rectHeight = Math.max(2, Math.abs(y2! - y1!));

            return (
              <g
                key={annotation.id}
                className={cn(
                  "pointer-events-auto",
                  activeAnnotationTool === "none" ? "cursor-move" : "cursor-pointer"
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectedAnnotationChange?.(annotation.id);
                }}
                onPointerDown={(event) => beginAnnotationDrag(event, annotation, "move")}
              >
                <rect
                  x={left}
                  y={top}
                  width={rectWidth}
                  height={rectHeight}
                  fill={annotation.color}
                  fillOpacity={0.12}
                  stroke={annotation.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={annotation.id === "draft" ? "6 4" : undefined}
                />
                {annotation.label &&
                  renderAnnotationLabel(
                    `${annotation.id}-label`,
                    left,
                    top,
                    annotation.label,
                    annotation.color
                  )}
                {isSelected &&
                  renderSelectionHandle(
                    `${annotation.id}-start-handle`,
                    x1!,
                    y1!,
                    annotation.color,
                    annotation,
                    "start"
                  )}
                {isSelected &&
                  renderSelectionHandle(
                    `${annotation.id}-end-handle`,
                    x2!,
                    y2!,
                    annotation.color,
                    annotation,
                    "end"
                  )}
              </g>
            );
          }

          if (annotation.type === "fib") {
            const x1 = getXForTime(annotation.startTime);
            const y1 = getYForPrice(annotation.startPrice);
            const x2 = getXForTime(annotation.endTime);
            const y2 = getYForPrice(annotation.endPrice);
            if ([x1, y1, x2, y2].some((value) => value == null)) return null;

            const left = Math.min(x1!, x2!);
            const right = Math.max(x1!, x2!);
            const topPrice = Math.max(annotation.startPrice, annotation.endPrice);
            const bottomPrice = Math.min(annotation.startPrice, annotation.endPrice);
            const fibLevels = [
              { ratio: 0, price: topPrice },
              { ratio: 0.5, price: topPrice - (topPrice - bottomPrice) * 0.5 },
              { ratio: 1, price: bottomPrice },
            ];

            return (
              <g
                key={annotation.id}
                className={cn(
                  "pointer-events-auto",
                  activeAnnotationTool === "none" ? "cursor-move" : "cursor-pointer"
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectedAnnotationChange?.(annotation.id);
                }}
                onPointerDown={(event) => beginAnnotationDrag(event, annotation, "move")}
              >
                <rect
                  x={left}
                  y={Math.min(y1!, y2!)}
                  width={Math.max(2, Math.abs(x2! - x1!))}
                  height={Math.max(2, Math.abs(y2! - y1!))}
                  fill={annotation.color}
                  fillOpacity={0.05}
                  stroke={annotation.color}
                  strokeWidth={isSelected ? 1.5 : 1}
                  strokeDasharray={annotation.id === "draft" ? "6 4" : "3 5"}
                />
                {fibLevels.map((level) => {
                  const y = getYForPrice(level.price);
                  if (y == null) return null;

                  return (
                    <g key={`${annotation.id}-${level.ratio}`}>
                      <line
                        x1={left}
                        y1={y}
                        x2={right}
                        y2={y}
                        stroke={annotation.color}
                        strokeWidth={strokeWidth}
                        strokeDasharray={level.ratio === 0.5 ? "5 4" : undefined}
                      />
                      <text
                        x={Math.max(12, left - 68)}
                        y={y - 4}
                        fill={annotation.color}
                        fontSize="10"
                        fontFamily="var(--font-geist-mono), monospace"
                      >
                        {level.ratio} ({level.price.toFixed(pricePrecision)})
                      </text>
                    </g>
                  );
                })}
                {annotation.label &&
                  renderAnnotationLabel(
                    `${annotation.id}-label`,
                    right,
                    Math.min(y1!, y2!),
                    annotation.label,
                    annotation.color
                  )}
                {isSelected &&
                  renderSelectionHandle(
                    `${annotation.id}-start-handle`,
                    x1!,
                    y1!,
                    annotation.color,
                    annotation,
                    "start"
                  )}
                {isSelected &&
                  renderSelectionHandle(
                    `${annotation.id}-end-handle`,
                    x2!,
                    y2!,
                    annotation.color,
                    annotation,
                    "end"
                  )}
              </g>
            );
          }

          if (annotation.type === "measure") {
            const x1 = getXForTime(annotation.startTime);
            const y1 = getYForPrice(annotation.startPrice);
            const x2 = getXForTime(annotation.endTime);
            const y2 = getYForPrice(annotation.endPrice);
            if ([x1, y1, x2, y2].some((value) => value == null)) return null;

            const left = Math.min(x1!, x2!);
            const top = Math.min(y1!, y2!);
            const rectWidth = Math.max(2, Math.abs(x2! - x1!));
            const rectHeight = Math.max(2, Math.abs(y2! - y1!));
            const startIndex = timeIndexMap.get(serializeTime(annotation.startTime)) ?? 0;
            const endIndex = timeIndexMap.get(serializeTime(annotation.endTime)) ?? startIndex;
            const bars = Math.abs(endIndex - startIndex) + 1;
            const pipSize = pricePrecision >= 3 ? 1 / 10 ** (pricePrecision - 1) : 0.01;
            const priceDelta = annotation.endPrice - annotation.startPrice;
            const pips = priceDelta / pipSize;

            return (
              <g
                key={annotation.id}
                className={cn(
                  "pointer-events-auto",
                  activeAnnotationTool === "none" ? "cursor-move" : "cursor-pointer"
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectedAnnotationChange?.(annotation.id);
                }}
                onPointerDown={(event) => beginAnnotationDrag(event, annotation, "move")}
              >
                <rect
                  x={left}
                  y={top}
                  width={rectWidth}
                  height={rectHeight}
                  fill={annotation.color}
                  fillOpacity={0.08}
                  stroke={annotation.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={annotation.id === "draft" ? "6 4" : "4 4"}
                />
                {renderAnnotationLabel(
                  `${annotation.id}-label`,
                  left,
                  top,
                  `${pips >= 0 ? "+" : ""}${pips.toFixed(1)} pips · ${bars} bars`,
                  annotation.color
                )}
                {isSelected &&
                  renderSelectionHandle(
                    `${annotation.id}-start-handle`,
                    x1!,
                    y1!,
                    annotation.color,
                    annotation,
                    "start"
                  )}
                {isSelected &&
                  renderSelectionHandle(
                    `${annotation.id}-end-handle`,
                    x2!,
                    y2!,
                    annotation.color,
                    annotation,
                    "end"
                  )}
              </g>
            );
          }

          if (annotation.type === "anchored-vwap") {
            const anchorIndex = timeIndexMap.get(serializeTime(annotation.startTime));
            const endIndex = timeIndexMap.get(serializeTime(annotation.endTime));
            if (anchorIndex == null) return null;

            const slice = data.slice(
              anchorIndex,
              Math.max(anchorIndex + 1, (endIndex ?? data.length - 1) + 1)
            );
            let cumulativeVolume = 0;
            let cumulativeValue = 0;
            const points = slice
              .map((candle) => {
                const volume = candle.volume && candle.volume > 0 ? candle.volume : 1;
                const typicalPrice = (candle.high + candle.low + candle.close) / 3;
                cumulativeVolume += volume;
                cumulativeValue += typicalPrice * volume;
                const vwap = cumulativeVolume > 0 ? cumulativeValue / cumulativeVolume : typicalPrice;
                const x = getXForTime(candle.time);
                const y = getYForPrice(vwap);
                if (x == null || y == null) return null;
                return `${x},${y}`;
              })
              .filter((point): point is string => Boolean(point));

            const anchorX = getXForTime(annotation.startTime);
            const anchorY = getYForPrice(annotation.startPrice);
            if (!points.length || anchorX == null || anchorY == null) return null;

            return (
              <g
                key={annotation.id}
                className={cn(
                  "pointer-events-auto",
                  activeAnnotationTool === "none" ? "cursor-move" : "cursor-pointer"
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectedAnnotationChange?.(annotation.id);
                }}
                onPointerDown={(event) => beginAnnotationDrag(event, annotation, "move")}
              >
                <polyline
                  points={points.join(" ")}
                  fill="none"
                  stroke={annotation.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={annotation.id === "draft" ? "6 4" : undefined}
                />
                {annotation.label &&
                  renderAnnotationLabel(
                    `${annotation.id}-label`,
                    getXForTime(slice[slice.length - 1]?.time ?? annotation.endTime) ?? anchorX,
                    getYForPrice(
                      cumulativeVolume > 0 ? cumulativeValue / cumulativeVolume : annotation.startPrice
                    ) ?? anchorY,
                    annotation.label,
                    annotation.color
                  )}
                {isSelected &&
                  renderSelectionHandle(
                    `${annotation.id}-start-handle`,
                    anchorX,
                    anchorY,
                    annotation.color,
                    annotation,
                    "start"
                  )}
              </g>
            );
          }

          if (annotation.type === "note") {
            const x = getXForTime(annotation.time);
            const y = getYForPrice(annotation.price);
            if (x == null || y == null) return null;
            const text = annotation.label || "Note";
            const boxWidth = Math.max(72, text.length * 7 + 20);

            return (
              <g
                key={annotation.id}
                className={cn(
                  "pointer-events-auto",
                  activeAnnotationTool === "none" ? "cursor-move" : "cursor-pointer"
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectedAnnotationChange?.(annotation.id);
                }}
                onPointerDown={(event) => beginAnnotationDrag(event, annotation, "point")}
              >
                <circle cx={x} cy={y} r={4} fill={annotation.color} />
                <rect
                  x={x + 10}
                  y={y - 24}
                  width={boxWidth}
                  height={24}
                  rx={8}
                  fill="rgba(2,6,23,0.92)"
                  stroke={annotation.color}
                  strokeWidth={strokeWidth}
                />
                <text
                  x={x + 20}
                  y={y - 8}
                  fill="white"
                  fontSize="11"
                  fontFamily="var(--font-geist-mono), monospace"
                >
                  {text}
                </text>
                {isSelected &&
                  renderSelectionHandle(
                    `${annotation.id}-point-handle`,
                    x,
                    y,
                    annotation.color,
                    annotation,
                    "point"
                  )}
              </g>
            );
          }

          return null;
        })}
      </svg>

      {activeAnnotationTool !== "none" && (
        <div
          className="absolute inset-0 z-30 cursor-crosshair"
          onPointerDown={handleDrawingPointerDown}
          onPointerMove={handleDrawingPointerMove}
          onPointerUp={handleDrawingPointerUp}
          onPointerLeave={() => {
            if (!drawingStartRef.current) return;
            drawingStartRef.current = null;
            setDraftAnnotation(null);
          }}
        />
      )}
    </div>
  );
}

function serializeTime(time: Time): string {
  if (typeof time === "number" || typeof time === "string") {
    return String(time);
  }

  return `${time.year}-${time.month}-${time.day}`;
}

// Utility to convert Date to lightweight-charts Time format (UTCTimestamp)
export function dateToChartTime(date: Date | string | number): UTCTimestamp {
  const d = new Date(date);
  return Math.floor(d.getTime() / 1000) as UTCTimestamp;
}

// Utility to generate sample candle data for testing/simulation
export function generateSampleCandles(
  startDate: Date,
  endDate: Date,
  openPrice: number,
  closePrice: number,
  options?: {
    volatility?: number;
    intervalMinutes?: number;
    mfePips?: number;
    maePips?: number;
    pipSize?: number;
  }
): CandleData[] {
  const {
    volatility = 0.001,
    intervalMinutes = 5,
    mfePips,
    maePips,
    pipSize = 0.0001,
  } = options || {};

  const candles: CandleData[] = [];
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();
  const intervalMs = intervalMinutes * 60 * 1000;
  const numCandles = Math.ceil((endTime - startTime) / intervalMs);
  
  if (numCandles <= 0) return [];

  // Calculate peak and trough based on MFE/MAE
  const isLong = closePrice > openPrice;
  const peakPrice = mfePips 
    ? (isLong ? openPrice + mfePips * pipSize : openPrice - mfePips * pipSize)
    : closePrice + (isLong ? 1 : -1) * Math.abs(closePrice - openPrice) * 0.3;
  const troughPrice = maePips
    ? (isLong ? openPrice - maePips * pipSize : openPrice + maePips * pipSize)
    : openPrice + (isLong ? -1 : 1) * Math.abs(closePrice - openPrice) * 0.2;

  let currentPrice = openPrice;

  for (let i = 0; i <= numCandles; i++) {
    const progress = i / numCandles;
    const time = new Date(startTime + i * intervalMs);
    
    // Simulate price path: drawdown first, then move to peak, then to close
    let targetPrice: number;
    if (progress < 0.2) {
      // Initial adverse movement (drawdown)
      const drawdownProgress = progress / 0.2;
      targetPrice = openPrice + (troughPrice - openPrice) * drawdownProgress;
    } else if (progress < 0.6) {
      // Move towards peak
      const peakProgress = (progress - 0.2) / 0.4;
      targetPrice = troughPrice + (peakPrice - troughPrice) * peakProgress;
    } else {
      // Move from peak to close
      const closeProgress = (progress - 0.6) / 0.4;
      targetPrice = peakPrice + (closePrice - peakPrice) * closeProgress;
    }

    // Add some randomness
    const noise = (Math.random() - 0.5) * 2 * volatility * openPrice;
    const candleOpen = currentPrice;
    const candleClose = targetPrice + noise;
    const high = Math.max(candleOpen, candleClose) + Math.random() * volatility * openPrice;
    const low = Math.min(candleOpen, candleClose) - Math.random() * volatility * openPrice;

    candles.push({
      time: dateToChartTime(time),
      open: candleOpen,
      high,
      low,
      close: candleClose,
      volume: Math.floor(Math.random() * 1000) + 100,
    });

    currentPrice = candleClose;
  }

  return candles;
}

export default TradingViewChart;
