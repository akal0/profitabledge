"use client";

import type * as React from "react";
import type { Time } from "lightweight-charts";
import { cn } from "@/lib/utils";
import {
  getArrowHeadPoints,
  getExtendedLineProjection,
  getRayProjection,
} from "@/features/charts/trading-view/lib/trading-view-geometry";
import { serializeTime } from "@/features/charts/trading-view/lib/trading-view-utils";
import type {
  AnnotationDragMode,
  AnnotationTool,
  CandleData,
  ChartAnnotation,
  ExecutionOverlay,
  ExecutionOverlayLevel,
  ExecutionOverlayLevelKey,
} from "@/features/charts/trading-view/lib/trading-view-types";

type OverlaySize = {
  width: number;
  height: number;
};

type TradingViewChartOverlayProps = {
  overlaySize: OverlaySize;
  executionOverlays: ExecutionOverlay[];
  selectedExecutionOverlayId: string | null;
  renderedAnnotations: ChartAnnotation[];
  selectedAnnotationId: string | null;
  activeAnnotationTool: AnnotationTool;
  theme: "dark" | "light";
  pricePrecision: number;
  timeIndexMap: Map<string, number>;
  data: CandleData[];
  getXForTime: (time: Time) => number | null;
  getYForPrice: (price: number) => number | null;
  onSelectedAnnotationChange?: (id: string | null) => void;
  onSelectedExecutionOverlayChange?: (id: string | null) => void;
  beginAnnotationDrag: (
    event: React.PointerEvent<SVGGElement | SVGCircleElement | SVGRectElement>,
    annotation: ChartAnnotation,
    mode: AnnotationDragMode
  ) => void;
  beginExecutionDrag: (
    event: React.PointerEvent<SVGGElement | SVGCircleElement | SVGRectElement>,
    overlayId: string,
    levelKey: ExecutionOverlayLevelKey
  ) => void;
};

export function TradingViewChartOverlay({
  overlaySize,
  executionOverlays,
  selectedExecutionOverlayId,
  renderedAnnotations,
  selectedAnnotationId,
  activeAnnotationTool,
  theme,
  pricePrecision,
  timeIndexMap,
  data,
  getXForTime,
  getYForPrice,
  onSelectedAnnotationChange,
  onSelectedExecutionOverlayChange,
  beginAnnotationDrag,
  beginExecutionDrag,
}: TradingViewChartOverlayProps) {
  const renderAnnotationLabel = (
    key: string,
    x: number,
    y: number,
    label: string,
    color: string
  ) => {
    const text = label.trim();
    if (!text) return null;

    const labelX = Math.max(
      8,
      Math.min(x + 10, Math.max(8, overlaySize.width - 120))
    );
    const labelY = Math.max(
      18,
      Math.min(y - 10, Math.max(18, overlaySize.height - 10))
    );
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
  };

  const renderSelectionHandle = (
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
  );

  return (
    <svg className="pointer-events-none absolute inset-0 z-20 size-full overflow-visible">
      {executionOverlays.map((overlay) => {
        const rawStartX = getXForTime(overlay.startTime);
        const rawEndX = overlay.endTime ? getXForTime(overlay.endTime) : null;
        const anchorX =
          getXForTime(overlay.labelTime ?? overlay.startTime) ??
          rawStartX ??
          rawEndX;

        if (rawStartX == null && rawEndX == null && anchorX == null) return null;

        const startX = rawStartX ?? anchorX ?? 0;
        const endX = rawEndX ?? startX;
        const left = Math.max(0, Math.min(startX, endX));
        const right = Math.min(
          overlaySize.width - 14,
          Math.max(left + 96, Math.max(startX, endX))
        );
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
          const pillY = Math.max(
            16,
            Math.min(y - 10, overlaySize.height - 20)
          );
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
                  onPointerDown={(event) =>
                    beginExecutionDrag(event, overlay.id, levelKey)
                  }
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
            {triggerLevel
              ? renderExecutionTag("trigger", triggerLevel, triggerY, right - 26)
              : null}
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
              {annotation.label
                ? renderAnnotationLabel(
                    `${annotation.id}-label`,
                    isRay ? renderX2 : x2!,
                    isRay ? renderY2 : y2!,
                    annotation.label,
                    annotation.color
                  )
                : null}
              {isSelected
                ? renderSelectionHandle(
                    `${annotation.id}-start-handle`,
                    x1!,
                    y1!,
                    annotation.color,
                    annotation,
                    "start"
                  )
                : null}
              {isSelected
                ? renderSelectionHandle(
                    `${annotation.id}-end-handle`,
                    x2!,
                    y2!,
                    annotation.color,
                    annotation,
                    "end"
                  )
                : null}
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
              {annotation.label
                ? renderAnnotationLabel(
                    `${annotation.id}-label`,
                    overlaySize.width - 130,
                    y,
                    annotation.label,
                    annotation.color
                  )
                : null}
              {isSelected
                ? renderSelectionHandle(
                    `${annotation.id}-price-handle`,
                    Math.max(24, overlaySize.width - 32),
                    y,
                    annotation.color,
                    annotation,
                    "move"
                  )
                : null}
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
              {annotation.label
                ? renderAnnotationLabel(
                    `${annotation.id}-label`,
                    x,
                    28,
                    annotation.label,
                    annotation.color
                  )
                : null}
              {isSelected
                ? renderSelectionHandle(
                    `${annotation.id}-time-handle`,
                    x,
                    28,
                    annotation.color,
                    annotation,
                    "move"
                  )
                : null}
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
          const width = Math.max(2, Math.abs(x2! - x1!));
          const height = Math.max(2, Math.abs(y2! - y1!));

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
                width={width}
                height={height}
                fill={annotation.color}
                fillOpacity={0.12}
                stroke={annotation.color}
                strokeWidth={strokeWidth}
                strokeDasharray={annotation.id === "draft" ? "6 4" : undefined}
              />
              {annotation.label
                ? renderAnnotationLabel(
                    `${annotation.id}-label`,
                    left,
                    top,
                    annotation.label,
                    annotation.color
                  )
                : null}
              {isSelected
                ? renderSelectionHandle(
                    `${annotation.id}-start-handle`,
                    x1!,
                    y1!,
                    annotation.color,
                    annotation,
                    "start"
                  )
                : null}
              {isSelected
                ? renderSelectionHandle(
                    `${annotation.id}-end-handle`,
                    x2!,
                    y2!,
                    annotation.color,
                    annotation,
                    "end"
                  )
                : null}
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
              {annotation.label
                ? renderAnnotationLabel(
                    `${annotation.id}-label`,
                    right,
                    Math.min(y1!, y2!),
                    annotation.label,
                    annotation.color
                  )
                : null}
              {isSelected
                ? renderSelectionHandle(
                    `${annotation.id}-start-handle`,
                    x1!,
                    y1!,
                    annotation.color,
                    annotation,
                    "start"
                  )
                : null}
              {isSelected
                ? renderSelectionHandle(
                    `${annotation.id}-end-handle`,
                    x2!,
                    y2!,
                    annotation.color,
                    annotation,
                    "end"
                  )
                : null}
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
          const width = Math.max(2, Math.abs(x2! - x1!));
          const height = Math.max(2, Math.abs(y2! - y1!));
          const startIndex = timeIndexMap.get(serializeTime(annotation.startTime)) ?? 0;
          const endIndex = timeIndexMap.get(serializeTime(annotation.endTime)) ?? startIndex;
          const bars = Math.abs(endIndex - startIndex) + 1;
          const pipSize =
            pricePrecision >= 3 ? 1 / 10 ** (pricePrecision - 1) : 0.01;
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
                width={width}
                height={height}
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
              {isSelected
                ? renderSelectionHandle(
                    `${annotation.id}-start-handle`,
                    x1!,
                    y1!,
                    annotation.color,
                    annotation,
                    "start"
                  )
                : null}
              {isSelected
                ? renderSelectionHandle(
                    `${annotation.id}-end-handle`,
                    x2!,
                    y2!,
                    annotation.color,
                    annotation,
                    "end"
                  )
                : null}
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
              const vwap =
                cumulativeVolume > 0
                  ? cumulativeValue / cumulativeVolume
                  : typicalPrice;
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
              {annotation.label
                ? renderAnnotationLabel(
                    `${annotation.id}-label`,
                    getXForTime(slice[slice.length - 1]?.time ?? annotation.endTime) ??
                      anchorX,
                    getYForPrice(
                      cumulativeVolume > 0
                        ? cumulativeValue / cumulativeVolume
                        : annotation.startPrice
                    ) ?? anchorY,
                    annotation.label,
                    annotation.color
                  )
                : null}
              {isSelected
                ? renderSelectionHandle(
                    `${annotation.id}-start-handle`,
                    anchorX,
                    anchorY,
                    annotation.color,
                    annotation,
                    "start"
                  )
                : null}
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
              {isSelected
                ? renderSelectionHandle(
                    `${annotation.id}-point-handle`,
                    x,
                    y,
                    annotation.color,
                    annotation,
                    "point"
                  )
                : null}
            </g>
          );
        }

        return null;
      })}
    </svg>
  );
}
