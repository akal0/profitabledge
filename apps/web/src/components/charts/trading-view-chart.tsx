"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LineStyle,
} from "lightweight-charts";
import type {
  IChartApi,
  ISeriesApi,
  Time,
  IPriceLine,
  ISeriesMarkersPluginApi,
} from "lightweight-charts";
import { cn } from "@/lib/utils";
import { TradingViewChartOverlay } from "@/features/charts/trading-view/components/trading-view-chart-overlay";
import { useTradingViewChartCore } from "@/features/charts/trading-view/hooks/use-trading-view-chart-core";
import { serializeTime } from "@/features/charts/trading-view/lib/trading-view-utils";
import type {
  AnnotationDragMode,
  AnnotationTool,
  CandleData,
  ChartAnnotation,
  ExecutionOverlay,
  ExecutionOverlayLevelKey,
  IndicatorLine,
  PriceLine,
  TradeMarker,
  TradingViewChartProps,
} from "@/features/charts/trading-view/lib/trading-view-types";

export type {
  AnnotationTool,
  CandleData,
  ChartAnnotation,
  ExecutionOverlay,
  ExecutionOverlayLevelKey,
  IndicatorLine,
  PriceLine,
  TradeMarker,
  TradingViewChartProps,
} from "@/features/charts/trading-view/lib/trading-view-types";
export { dateToChartTime, generateSampleCandles } from "@/features/charts/trading-view/lib/trading-view-utils";

type ExecutionDragState = {
  overlayId: string;
  levelKey: ExecutionOverlayLevelKey;
  lastPrice: number;
};

type AnnotationDragState = {
  annotationId: string;
  mode: AnnotationDragMode;
  startPoint: { time: Time; price: number };
  initialAnnotation: ChartAnnotation;
};

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

  useTradingViewChartCore({
    data,
    markers,
    priceLines,
    indicatorLines,
    width,
    height,
    autosize,
    theme,
    showVolume,
    fitContent,
    visibleRange,
    onCrosshairMove,
    onTimeRangeChange,
    scheduleViewportSync,
    chartWrapperRef,
    chartContainerRef,
    chartRef,
    candleSeriesRef,
    volumeSeriesRef,
    indicatorSeriesRef,
    priceLinesRef,
    markersPluginRef,
    lastFittedDatasetRef,
    setOverlaySize,
  });

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
  }, [endAnnotationDrag, endExecutionDrag, scheduleViewportSync]);

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
    return () => {
      if (viewportAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(viewportAnimationFrameRef.current);
        viewportAnimationFrameRef.current = null;
      }
    };
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

  const renderedAnnotations = useMemo(() => {
    return draftAnnotation ? [...annotations, draftAnnotation] : annotations;
  }, [annotations, draftAnnotation]);

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

      <TradingViewChartOverlay
        overlaySize={overlaySize}
        executionOverlays={executionOverlays}
        selectedExecutionOverlayId={selectedExecutionOverlayId}
        renderedAnnotations={renderedAnnotations}
        selectedAnnotationId={selectedAnnotationId}
        activeAnnotationTool={activeAnnotationTool}
        theme={theme}
        pricePrecision={pricePrecision}
        timeIndexMap={timeIndexMap}
        data={data}
        getXForTime={getXForTime}
        getYForPrice={getYForPrice}
        onSelectedAnnotationChange={onSelectedAnnotationChange}
        onSelectedExecutionOverlayChange={onSelectedExecutionOverlayChange}
        beginAnnotationDrag={beginAnnotationDrag}
        beginExecutionDrag={beginExecutionDrag}
      />

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

export default TradingViewChart;
