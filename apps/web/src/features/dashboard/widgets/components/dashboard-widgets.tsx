"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { WidgetLoadingCard } from "@/features/dashboard/widgets/components/widget-loading-card";
import { DashboardWidgetTile } from "@/features/dashboard/widgets/components/dashboard-widget-tile";
import { WidgetCatalogTile } from "@/features/dashboard/widgets/components/widget-catalog-tile";
import { dashboardWidgetCardComponents } from "@/features/dashboard/widgets/lib/widget-card-registry";
import {
  ALL_WIDGET_TYPES,
  DEFAULT_WIDGET_SPANS,
  MAX_DASHBOARD_WIDGETS,
  type WidgetType,
} from "@/features/dashboard/widgets/lib/widget-config";
import type { WidgetValueMode } from "@/features/dashboard/widgets/lib/widget-shared";
import { useDashboardAssistantContextStore } from "@/stores/dashboard-assistant-context";

export interface TopWidgetsProps {
  enabledWidgets: WidgetType[];
  accountId?: string;
  isEditing?: boolean;
  valueMode?: WidgetValueMode;
  currencyCode?: string;
  onToggleWidget?: (type: WidgetType) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onEnterEdit?: () => void;
  widgetSpans?: Partial<Record<WidgetType, number>>;
  onResizeWidget?: (type: WidgetType, span: number) => void;
  maxWidgets?: number;
  supportsLiveWidgets?: boolean;
}

const LIVE_ONLY_WIDGETS = new Set<WidgetType>([
  "account-equity",
  "open-trades",
]);

export function DashboardWidgets({
  enabledWidgets,
  accountId,
  isEditing = false,
  valueMode = "usd",
  currencyCode,
  onToggleWidget,
  onReorder,
  onEnterEdit,
  widgetSpans,
  onResizeWidget,
  maxWidgets = MAX_DASHBOARD_WIDGETS,
  supportsLiveWidgets = true,
}: TopWidgetsProps) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const isResizingRef = useRef(false);
  const justResizedRef = useRef(false);
  const setFocusedWidgetId = useDashboardAssistantContextStore(
    (state) => state.setFocusedWidgetId
  );

  const [maxCols, setMaxCols] = useState(4);
  const [resizePreview, setResizePreview] = useState<{
    type: WidgetType;
    span: number;
  } | null>(null);

  const visibleEnabledWidgets = enabledWidgets.filter(
    (widget) => supportsLiveWidgets || !LIVE_ONLY_WIDGETS.has(widget)
  );
  const displayWidgets = visibleEnabledWidgets.slice(0, maxWidgets);

  const availableWidgets = useMemo(
    () =>
      ALL_WIDGET_TYPES.filter(
        (widget) =>
          (supportsLiveWidgets || !LIVE_ONLY_WIDGETS.has(widget)) &&
          !displayWidgets.includes(widget)
      ),
    [displayWidgets, supportsLiveWidgets]
  );

  // Fill the last partial row after ALL widgets (active + catalog tiles)
  const emptySlots = (() => {
    let colPosition = 0;
    const allShown = [...displayWidgets, ...availableWidgets];
    for (const widget of allShown) {
      const raw = Number(widgetSpans?.[widget] ?? DEFAULT_WIDGET_SPANS[widget] ?? 1);
      const span = Math.min(Math.max(Math.round(Number.isFinite(raw) ? raw : 1), 1), maxCols);
      if (colPosition + span > maxCols) colPosition = 0;
      colPosition = (colPosition + span) % maxCols;
    }
    return colPosition === 0 ? 0 : maxCols - colPosition;
  })();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
        delay: 100,
        tolerance: 5,
      },
    })
  );

  useEffect(() => {
    const update = () => {
      const grid = gridRef.current;
      if (grid) {
        const cols = getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length;
        setMaxCols(cols > 0 ? cols : 4);
      }
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));
  const snapSpan = (value: number, max: number) => clamp(Math.round(value), 1, max);
  const getRawSpan = (type: WidgetType) => {
    const raw = Number(widgetSpans?.[type] ?? DEFAULT_WIDGET_SPANS[type] ?? 1);
    return Number.isFinite(raw) ? raw : 1;
  };
  const getDisplaySpan = (type: WidgetType) => snapSpan(getRawSpan(type), maxCols);

  const getColumnMetrics = () => {
    const grid = gridRef.current;
    if (!grid) return null;

    const styles = window.getComputedStyle(grid);
    const gap = Number.parseFloat(styles.columnGap || styles.gap || "0");
    const width = grid.clientWidth;
    if (!width || maxCols <= 0) return null;

    return {
      colWidth: (width - gap * (maxCols - 1)) / maxCols,
      gap,
    };
  };

  const startResize = (type: WidgetType, startX: number) => {
    const metrics = getColumnMetrics();
    if (!metrics || metrics.colWidth <= 0) return;

    const initialSpan = getDisplaySpan(type);
    const startSpan = initialSpan;
    let lastSpan = initialSpan;

    isResizingRef.current = true;
    setResizePreview({ type, span: initialSpan });

    const handleMove = (event: PointerEvent) => {
      const delta = event.clientX - startX;
      const step = metrics.colWidth + metrics.gap;
      const desired = startSpan + delta / (step > 0 ? step : metrics.colWidth);
      const nextSpan = snapSpan(desired, maxCols);
      if (nextSpan !== lastSpan) {
        lastSpan = nextSpan;
        setResizePreview({ type, span: nextSpan });
      }
    };

    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      setResizePreview(null);

      if (lastSpan !== getRawSpan(type)) {
        onResizeWidget?.(type, lastSpan);
      }

      justResizedRef.current = true;
      window.setTimeout(() => {
        isResizingRef.current = false;
        justResizedRef.current = false;
      }, 150);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (!isEditing) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = displayWidgets.indexOf(active.id as WidgetType);
    const newIndex = displayWidgets.indexOf(over.id as WidgetType);
    if (oldIndex === -1 || newIndex === -1) return;

    onReorder?.(oldIndex, newIndex);
  };

  const handleDoubleClick = () => {
    if (isEditing) return;
    onEnterEdit?.();
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <SortableContext items={displayWidgets} strategy={rectSortingStrategy}>
        <div
          ref={gridRef}
          className="grid auto-rows-[18rem] gap-1.5 md:grid-cols-4 2xl:grid-cols-4 3xl:grid-cols-5"
        >
          {accountId ? (
            <>
              {displayWidgets.map((widgetType) => {
                const CardComponent = dashboardWidgetCardComponents[widgetType];
                const activeSpan =
                  resizePreview?.type === widgetType
                    ? resizePreview.span
                    : getDisplaySpan(widgetType);

                return (
                  <DashboardWidgetTile
                    key={widgetType}
                    widgetType={widgetType}
                    activeSpan={activeSpan}
                    rawSpan={getRawSpan(widgetType)}
                    maxCols={maxCols}
                    accountId={accountId}
                    isEditing={isEditing}
                    valueMode={valueMode}
                    currencyCode={currencyCode}
                    isPreviewingResize={resizePreview?.type === widgetType}
                    isResizingRef={isResizingRef}
                    justResizedRef={justResizedRef}
                    cardComponent={CardComponent}
                    onFocusWidget={setFocusedWidgetId}
                    onToggleWidget={onToggleWidget}
                    onResizeWidget={onResizeWidget}
                    onDoubleClick={handleDoubleClick}
                    onStartResize={startResize}
                  />
                );
              })}
            </>
          ) : (
            <Fragment>
              {Array.from({ length: 5 }).map((_, index) => (
                <WidgetLoadingCard key={`loading-${index}`} />
              ))}
            </Fragment>
          )}

          {isEditing
            ? availableWidgets.map((widgetType) => (
                <WidgetCatalogTile
                  key={`available-${widgetType}`}
                  widgetType={widgetType}
                  span={getDisplaySpan(widgetType)}
                  isAtMaxLimit={displayWidgets.length >= maxWidgets}
                  maxWidgets={maxWidgets}
                  accountId={accountId}
                  valueMode={valueMode}
                  currencyCode={currencyCode}
                  cardComponent={dashboardWidgetCardComponents[widgetType]}
                  onToggleWidget={onToggleWidget}
                />
              ))
            : null}

          {isEditing
            ? Array.from({ length: emptySlots }).map((_, index) => (
                <WidgetLoadingCard key={`empty-${index}`} compact />
              ))
            : null}
        </div>
      </SortableContext>
    </DndContext>
  );
}
