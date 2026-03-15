"use client";

import type { ComponentType, MutableRefObject } from "react";
import { GripVertical } from "lucide-react";
import type { WidgetType } from "@/features/dashboard/widgets/lib/widget-config";
import type { WidgetCardComponentProps } from "@/features/dashboard/widgets/lib/widget-card-registry";
import { SortableWidget } from "@/features/dashboard/widgets/components/sortable-widget";
import type { WidgetValueMode } from "@/features/dashboard/widgets/lib/widget-shared";

export function DashboardWidgetTile({
  widgetType,
  activeSpan,
  rawSpan,
  maxCols,
  accountId,
  isEditing,
  valueMode,
  currencyCode,
  isPreviewingResize,
  isResizingRef,
  justResizedRef,
  cardComponent: CardComponent,
  onFocusWidget,
  onToggleWidget,
  onResizeWidget,
  onDoubleClick,
  onStartResize,
}: {
  widgetType: WidgetType;
  activeSpan: number;
  rawSpan: number;
  maxCols: number;
  accountId?: string;
  isEditing: boolean;
  valueMode: WidgetValueMode;
  currencyCode?: string;
  isPreviewingResize: boolean;
  isResizingRef: MutableRefObject<boolean>;
  justResizedRef: MutableRefObject<boolean>;
  cardComponent: ComponentType<WidgetCardComponentProps>;
  onFocusWidget: (widgetId: WidgetType) => void;
  onToggleWidget?: (type: WidgetType) => void;
  onResizeWidget?: (type: WidgetType, span: number) => void;
  onDoubleClick: () => void;
  onStartResize: (type: WidgetType, startX: number) => void;
}) {
  const canShrink = rawSpan > 1;
  const canGrow = rawSpan < maxCols;

  return (
    <SortableWidget
      id={widgetType}
      disabled={!isEditing}
      style={{
        gridColumn: `span ${activeSpan} / span ${activeSpan}`,
      }}
    >
      <div
        className="relative h-72 w-full cursor-pointer"
        onPointerEnter={() => onFocusWidget(widgetType)}
        onFocusCapture={() => onFocusWidget(widgetType)}
        onDoubleClick={onDoubleClick}
        onClick={(event) => {
          if (!isEditing) return;
          if (isResizingRef.current || justResizedRef.current) return;
          event.stopPropagation();
          onToggleWidget?.(widgetType);
        }}
      >
        {isEditing ? (
          <div className="absolute right-5 top-5 z-10 flex items-center gap-2">
            <div className="pointer-events-none flex items-center gap-2">
              <div className="flex size-4 items-center justify-center border border-white/5">
                <svg viewBox="0 0 24 24" className="size-3 fill-white">
                  <path d="M20.285 6.708a1 1 0 0 1 0 1.414l-9 9a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 1.414-1.414L10.5 14.5l8.293-8.293a1 1 0 0 1 1.492.5z" />
                </svg>
              </div>
              <GripVertical className="size-3.5 text-white/30" />
            </div>

            <div
              className="flex items-center gap-1 border border-white/5 bg-sidebar/90"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="px-2 py-1 text-[10px] text-white/60 hover:text-white/90 disabled:opacity-40"
                disabled={!canShrink}
                onClick={() => onResizeWidget?.(widgetType, Math.max(rawSpan - 1, 1))}
              >
                -
              </button>
              <span className="px-1 text-[10px] text-white/50">{activeSpan}x</span>
              <button
                type="button"
                className="px-2 py-1 text-[10px] text-white/60 hover:text-white/90 disabled:opacity-40"
                disabled={!canGrow}
                onClick={() => onResizeWidget?.(widgetType, Math.min(rawSpan + 1, maxCols))}
              >
                +
              </button>
            </div>
          </div>
        ) : null}

        <CardComponent
          accountId={accountId}
          isEditing={isEditing}
          valueMode={valueMode}
          currencyCode={currencyCode}
          className="h-full w-full"
        />

        {isEditing ? (
          <>
            {isPreviewingResize ? (
              <div className="pointer-events-none absolute inset-0 border border-white/20 bg-white/5" />
            ) : null}
            <div
              className="absolute right-0 top-0 h-full w-3 cursor-ew-resize"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onStartResize(widgetType, event.clientX);
              }}
              onClick={(event) => event.stopPropagation()}
            />
          </>
        ) : null}
      </div>
    </SortableWidget>
  );
}
