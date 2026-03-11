"use client";

import * as React from "react";
import type { Table } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import { cn } from "@/lib/utils";

export function DataTable<TData>({
  table,
  children,
  onRowClick,
  onRowMouseDown,
  onRowMouseEnter,
  containerRef,
  className,
}: {
  table: Table<TData>;
  children?: React.ReactNode;
  onRowClick?: (row: any) => void;
  onRowMouseDown?: (e: React.MouseEvent, rowId: string) => void;
  onRowMouseEnter?: (rowId: string) => void;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  className?: string;
}) {
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const resizeGuideRef = React.useRef<HTMLDivElement | null>(null);
  const measuredColumnMinWidthsRef = React.useRef<Record<string, number>>({});
  const resizeSessionRef = React.useRef<{
    columnId: string;
    startX: number;
    startWidth: number;
    minWidth: number;
    maxWidth: number;
    baseLineX: number;
  } | null>(null);

  const visibleColumnIds = React.useMemo(
    () =>
      table
        .getVisibleLeafColumns()
        .map((column) => column.id)
        .join("|"),
    [table, table.getState().columnVisibility]
  );
  const rowCount = table.getPrePaginationRowModel().rows.length;

  const hideResizeGuide = React.useCallback(() => {
    const guide = resizeGuideRef.current;
    if (!guide) return;
    guide.style.opacity = "0";
    guide.style.transform = "translateX(0px)";
  }, []);

  const updateResizeGuide = React.useCallback((offsetX: number) => {
    const guide = resizeGuideRef.current;
    if (!guide) return;
    guide.style.opacity = "1";
    guide.style.transform = `translateX(${offsetX}px)`;
  }, []);

  const stopColumnResize = React.useCallback(() => {
    window.removeEventListener("pointermove", handleResizePointerMove);
    window.removeEventListener("pointerup", handleResizePointerUp);
    window.removeEventListener("pointercancel", handleResizePointerUp);
    resizeSessionRef.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    hideResizeGuide();
  }, [hideResizeGuide]);

  const commitColumnWidth = React.useCallback(
    (columnId: string, width: number) => {
      table.setColumnSizing((current) => {
        const nextWidth = Math.round(width);
        if (current[columnId] === nextWidth) {
          return current;
        }
        return {
          ...current,
          [columnId]: nextWidth,
        };
      });
    },
    [table]
  );

  const handleResizePointerMove = React.useCallback(
    (event: PointerEvent) => {
      const session = resizeSessionRef.current;
      if (!session) return;

      const delta = event.clientX - session.startX;
      const nextWidth = Math.min(
        session.maxWidth,
        Math.max(session.minWidth, session.startWidth + delta)
      );
      updateResizeGuide(session.baseLineX + (nextWidth - session.startWidth));
    },
    [updateResizeGuide]
  );

  const handleResizePointerUp = React.useCallback(
    (event: PointerEvent) => {
      const session = resizeSessionRef.current;
      if (!session) return;

      const delta = event.clientX - session.startX;
      const nextWidth = Math.min(
        session.maxWidth,
        Math.max(session.minWidth, session.startWidth + delta)
      );
      commitColumnWidth(session.columnId, nextWidth);
      stopColumnResize();
    },
    [commitColumnWidth, stopColumnResize]
  );

  const startColumnResize = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>, columnId: string) => {
      const scrollContainer = scrollContainerRef.current;
      const headerEl = event.currentTarget.closest("th");
      const column = table.getColumn(columnId);

      if (!scrollContainer || !headerEl || !column) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const headerRect = headerEl.getBoundingClientRect();
      const containerRect = scrollContainer.getBoundingClientRect();
      const measuredMinWidth =
        measuredColumnMinWidthsRef.current[columnId] ?? 0;
      const configuredMinWidth =
        typeof column.columnDef.minSize === "number"
          ? column.columnDef.minSize
          : 0;
      const configuredMaxWidth =
        typeof column.columnDef.maxSize === "number"
          ? column.columnDef.maxSize
          : Number.POSITIVE_INFINITY;

      resizeSessionRef.current = {
        columnId,
        startX: event.clientX,
        startWidth: column.getSize(),
        minWidth: Math.max(measuredMinWidth, configuredMinWidth),
        maxWidth: configuredMaxWidth,
        baseLineX: headerRect.right - containerRect.left,
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      updateResizeGuide(headerRect.right - containerRect.left);

      window.addEventListener("pointermove", handleResizePointerMove);
      window.addEventListener("pointerup", handleResizePointerUp);
      window.addEventListener("pointercancel", handleResizePointerUp);
    },
    [handleResizePointerMove, handleResizePointerUp, table, updateResizeGuide]
  );

  const resetColumnWidth = React.useCallback(
    (columnId: string) => {
      const column = table.getColumn(columnId);
      if (!column) return;

      const measuredMinWidth =
        measuredColumnMinWidthsRef.current[columnId] ?? 0;
      const defaultWidth =
        typeof column.columnDef.size === "number" ? column.columnDef.size : 140;
      const configuredMinWidth =
        typeof column.columnDef.minSize === "number"
          ? column.columnDef.minSize
          : 0;

      commitColumnWidth(
        columnId,
        Math.max(defaultWidth, configuredMinWidth, measuredMinWidth)
      );
    },
    [commitColumnWidth, table]
  );

  React.useLayoutEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const root = scrollContainerRef.current;
      if (!root) return;

      const nextMinWidths: Record<string, number> = {};
      root
        .querySelectorAll<HTMLElement>("[data-column-content]")
        .forEach((contentEl) => {
          const cellEl = contentEl.parentElement as HTMLElement | null;
          const columnId = cellEl?.dataset.columnId;
          if (!columnId) return;

          const styles = window.getComputedStyle(cellEl);
          const paddingX =
            parseFloat(styles.paddingLeft || "0") +
            parseFloat(styles.paddingRight || "0");
          const intrinsicWidth = Math.ceil(contentEl.scrollWidth + paddingX);

          nextMinWidths[columnId] = Math.max(
            nextMinWidths[columnId] || 0,
            intrinsicWidth
          );
        });

      measuredColumnMinWidthsRef.current = nextMinWidths;

      const clampedSizing: Record<string, number> = {};
      let hasClampUpdate = false;

      table.getVisibleLeafColumns().forEach((column) => {
        const minWidth = nextMinWidths[column.id];
        if (!minWidth) return;
        const currentWidth = column.getSize();
        if (currentWidth < minWidth) {
          clampedSizing[column.id] = minWidth;
          hasClampUpdate = true;
        }
      });

      if (hasClampUpdate) {
        table.setColumnSizing((current) => ({
          ...current,
          ...clampedSizing,
        }));
      }
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [rowCount, table, visibleColumnIds]);

  React.useEffect(() => stopColumnResize, [stopColumnResize]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "w-full border border-white/5 overflow-hidden rounded-b-sm",
        className
      )}
    >
      <div ref={scrollContainerRef} className="relative overflow-x-auto">
        <div
          ref={resizeGuideRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-20 w-px bg-white/20 opacity-0 transition-opacity"
        />
        <table
          className="min-w-full table-fixed text-xs"
          style={{ width: table.getTotalSize() }}
        >
          <colgroup>
            {table.getVisibleLeafColumns().map((column) => (
              <col key={column.id} style={{ width: column.getSize() }} />
            ))}
          </colgroup>
          <thead className="border-b border-white/5">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="bg-sidebar">
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    data-column-id={h.column.id}
                    className="group relative border-r border-white/5 px-6 py-4 text-left font-medium whitespace-nowrap text-white/70 bg-sidebar-accent last:border-r-0"
                    style={{ width: h.getSize() }}
                  >
                    <div
                      data-column-content
                      className="inline-flex min-w-max items-center"
                    >
                      {h.isPlaceholder
                        ? null
                        : flexRender(h.column.columnDef.header, h.getContext())}
                    </div>
                    {h.column.getCanResize() ? (
                      <div
                        onDoubleClick={() => resetColumnWidth(h.column.id)}
                        onPointerDown={(event) =>
                          startColumnResize(event, h.column.id)
                        }
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          "absolute -right-1.5 top-0 z-10 h-full w-3 cursor-col-resize select-none touch-none",
                          "after:absolute after:left-1/2 after:top-0 after:bottom-0 after:w-px after:-translate-x-1/2 after:bg-white/3 hover:after:bg-white/20"
                        )}
                      />
                    ) : null}
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          <tbody>
            {table.getPrePaginationRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  "border-b border-white/5 transition duration-250 cursor-pointer",
                  row.getIsSelected()
                    ? "bg-sidebar-accent"
                    : "hover:bg-sidebar-accent"
                )}
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest('[data-slot="checkbox"]')) return;
                  onRowClick?.(row.original);
                }}
                onMouseDown={(e) => {
                  onRowMouseDown?.(e, row.id);
                }}
                onMouseEnter={() => {
                  onRowMouseEnter?.(row.id);
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    data-column-id={cell.column.id}
                    className="px-6 py-6 select-none whitespace-nowrap"
                    style={{ width: cell.column.getSize() }}
                  >
                    <div
                      data-column-content
                      className="inline-flex min-w-max items-center"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {children ? (
        <div className="border-t border-white/5 p-2">{children}</div>
      ) : null}
    </div>
  );
}
