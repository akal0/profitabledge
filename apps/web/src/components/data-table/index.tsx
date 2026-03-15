"use client";

import * as React from "react";
import type { Row, Table } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import { cn } from "@/lib/utils";

const AUTO_COLUMN_CONTENT_BUFFER_PX = 8;

export function DataTable<TData>({
  table,
  children,
  emptyState,
  onRowClick,
  onRowDoubleClick,
  onRowMouseDown,
  onRowMouseEnter,
  containerRef,
  className,
  getRowGroupKey,
  renderRowGroupHeader,
}: {
  table: Table<TData>;
  children?: React.ReactNode;
  emptyState?: React.ReactNode;
  onRowClick?: (row: any) => void;
  onRowDoubleClick?: (row: any) => void;
  onRowMouseDown?: (e: React.MouseEvent, rowId: string) => void;
  onRowMouseEnter?: (rowId: string) => void;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  className?: string;
  getRowGroupKey?: (row: Row<TData>) => string | null;
  renderRowGroupHeader?: (group: {
    groupKey: string;
    rows: Row<TData>[];
    table: Table<TData>;
    isCollapsed: boolean;
    onToggleCollapsed: () => void;
  }) => React.ReactNode;
}) {
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const resizeGuideRef = React.useRef<HTMLDivElement | null>(null);
  const measurementSandboxRef = React.useRef<HTMLDivElement | null>(null);
  const measurementFrameRef = React.useRef<number | null>(null);
  const measuredColumnMinWidthsRef = React.useRef<Record<string, number>>({});
  const resizeSessionRef = React.useRef<{
    columnId: string;
    startX: number;
    startWidth: number;
    minWidth: number;
    maxWidth: number;
    baseLineX: number;
  } | null>(null);
  const visibleColumnIds = table
    .getVisibleLeafColumns()
    .map((column) => column.id)
    .join("|");
  const [draggedColumnId, setDraggedColumnId] = React.useState<string | null>(
    null
  );
  const [dragOverColumnId, setDragOverColumnId] = React.useState<string | null>(
    null
  );
  const [collapsedGroupKeys, setCollapsedGroupKeys] = React.useState<
    Set<string>
  >(new Set());
  const rowCount = table.getPrePaginationRowModel().rows.length;
  const tableRows = table.getPrePaginationRowModel().rows;
  const visibleColumnCount = Math.max(table.getVisibleLeafColumns().length, 1);
  const hasRowInteraction = Boolean(
    onRowClick || onRowDoubleClick || onRowMouseDown || onRowMouseEnter
  );

  const isInteractiveTarget = React.useCallback((target: HTMLElement) => {
    return Boolean(
      target.closest('[data-slot="checkbox"]') ||
        target.closest('[data-cell-interactive="true"]') ||
        target.closest("button") ||
        target.closest("input") ||
        target.closest("select") ||
        target.closest("a") ||
        target.closest('[role="button"]')
    );
  }, []);

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

  const measureIntrinsicContentWidth = React.useCallback(
    (contentEl: HTMLElement) => {
      const sandbox = measurementSandboxRef.current;
      if (!sandbox) {
        return Math.ceil(contentEl.scrollWidth);
      }

      const clone = contentEl.cloneNode(true) as HTMLElement;
      clone.removeAttribute("data-column-content");
      clone.style.position = "absolute";
      clone.style.inset = "0 auto auto 0";
      clone.style.visibility = "hidden";
      clone.style.pointerEvents = "none";
      clone.style.width = "max-content";
      clone.style.minWidth = "max-content";
      clone.style.maxWidth = "none";
      clone.style.overflow = "visible";

      sandbox.appendChild(clone);
      const intrinsicWidth = Math.ceil(clone.getBoundingClientRect().width);
      sandbox.removeChild(clone);

      return intrinsicWidth;
    },
    []
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
      window.removeEventListener("pointermove", handleResizePointerMove);
      window.removeEventListener("pointerup", handleResizePointerUp);
      window.removeEventListener("pointercancel", handleResizePointerUp);
      resizeSessionRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      hideResizeGuide();
    },
    [commitColumnWidth, handleResizePointerMove, hideResizeGuide]
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

  const syncMeasuredColumnWidths = React.useCallback(() => {
    const root = scrollContainerRef.current;
    const sandbox = measurementSandboxRef.current;
    if (!root || !sandbox) return;

    const nextMinWidths: Record<string, number> = {};
    root.querySelectorAll<HTMLElement>("[data-column-content]").forEach((contentEl) => {
      const cellEl = contentEl.parentElement as HTMLElement | null;
      const columnId = cellEl?.dataset.columnId;
      if (!columnId) return;

      const styles = window.getComputedStyle(cellEl);
      const paddingX =
        parseFloat(styles.paddingLeft || "0") +
        parseFloat(styles.paddingRight || "0");
      const intrinsicWidth =
        measureIntrinsicContentWidth(contentEl) +
        paddingX +
        AUTO_COLUMN_CONTENT_BUFFER_PX;

      nextMinWidths[columnId] = Math.max(
        nextMinWidths[columnId] || 0,
        Math.ceil(intrinsicWidth)
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
  }, [measureIntrinsicContentWidth, table]);

  const scheduleMeasuredColumnWidths = React.useCallback(() => {
    if (measurementFrameRef.current != null) {
      window.cancelAnimationFrame(measurementFrameRef.current);
    }

    measurementFrameRef.current = window.requestAnimationFrame(() => {
      measurementFrameRef.current = null;
      syncMeasuredColumnWidths();
    });
  }, [syncMeasuredColumnWidths]);

  React.useLayoutEffect(() => {
    scheduleMeasuredColumnWidths();

    const root = scrollContainerRef.current;
    if (!root) {
      return () => {
        if (measurementFrameRef.current != null) {
          window.cancelAnimationFrame(measurementFrameRef.current);
          measurementFrameRef.current = null;
        }
      };
    }

    // Re-measure when cell content mutates so chips like Swap / Protocol can
    // grow their columns after inline edits or refreshed trade data.
    const mutationObserver = new MutationObserver((records) => {
      const sandbox = measurementSandboxRef.current;
      const shouldRecalculate = records.some(
        (record) => !sandbox?.contains(record.target)
      );

      if (shouldRecalculate) {
        scheduleMeasuredColumnWidths();
      }
    });
    mutationObserver.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
    });

    return () => {
      mutationObserver.disconnect();
      if (measurementFrameRef.current != null) {
        window.cancelAnimationFrame(measurementFrameRef.current);
        measurementFrameRef.current = null;
      }
    };
  }, [rowCount, scheduleMeasuredColumnWidths, visibleColumnIds]);

  const reorderColumn = React.useCallback(
    (sourceColumnId: string, targetColumnId: string) => {
      if (sourceColumnId === targetColumnId) {
        return;
      }

      table.setColumnOrder((currentOrder) => {
        const fallbackOrder = table
          .getAllLeafColumns()
          .map((column) => column.id);
        const workingOrder =
          currentOrder && currentOrder.length > 0
            ? [...currentOrder]
            : fallbackOrder;
        const sourceIndex = workingOrder.indexOf(sourceColumnId);
        const targetIndex = workingOrder.indexOf(targetColumnId);

        if (sourceIndex === -1 || targetIndex === -1) {
          return workingOrder;
        }

        const [movedColumn] = workingOrder.splice(sourceIndex, 1);
        workingOrder.splice(targetIndex, 0, movedColumn);

        return workingOrder;
      });
    },
    [table]
  );

  const canReorderColumn = React.useCallback(
    (columnId: string) => {
      const column = table.getColumn(columnId);
      if (!column) {
        return false;
      }

      return column.getCanHide();
    },
    [table]
  );

  React.useEffect(
    () => () => {
      window.removeEventListener("pointermove", handleResizePointerMove);
      window.removeEventListener("pointerup", handleResizePointerUp);
      window.removeEventListener("pointercancel", handleResizePointerUp);
      resizeSessionRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      hideResizeGuide();
    },
    [handleResizePointerMove, handleResizePointerUp, hideResizeGuide]
  );

  const groupedRows = React.useMemo(() => {
    if (!getRowGroupKey || !renderRowGroupHeader) {
      return null;
    }

    const groups = new Map<string, Row<TData>[]>();

    tableRows.forEach((row) => {
      const groupKey = getRowGroupKey(row) || "Ungrouped";
      const existingRows = groups.get(groupKey);
      if (existingRows) {
        existingRows.push(row);
        return;
      }
      groups.set(groupKey, [row]);
    });

    return Array.from(groups.entries()).map(([groupKey, rows]) => ({
      groupKey,
      rows,
    }));
  }, [getRowGroupKey, renderRowGroupHeader, tableRows]);

  React.useEffect(() => {
    if (!groupedRows) {
      if (collapsedGroupKeys.size > 0) {
        setCollapsedGroupKeys(new Set());
      }
      return;
    }

    setCollapsedGroupKeys((current) => {
      const availableGroupKeys = new Set(
        groupedRows.map((group) => group.groupKey)
      );
      const next = new Set(
        Array.from(current).filter((groupKey) =>
          availableGroupKeys.has(groupKey)
        )
      );

      if (next.size !== current.size) {
        return next;
      }

      for (const groupKey of current) {
        if (!next.has(groupKey)) {
          return next;
        }
      }

      return current;
    });
  }, [collapsedGroupKeys.size, groupedRows]);

  const renderDataRow = React.useCallback(
    (row: Row<TData>, className?: string) => (
      <tr
        key={row.id}
        className={cn(
          "border-b border-white/5 transition duration-250",
          hasRowInteraction && "cursor-pointer",
          row.getIsSelected() ? "bg-sidebar-accent" : "hover:bg-sidebar-accent",
          className
        )}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (isInteractiveTarget(target)) {
            return;
          }
          onRowClick?.(row.original);
        }}
        onDoubleClick={(e) => {
          const target = e.target as HTMLElement;
          if (isInteractiveTarget(target)) {
            return;
          }
          onRowDoubleClick?.(row.original);
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
            className="overflow-hidden px-6 py-6 select-none whitespace-nowrap"
            style={{ width: cell.column.getSize() }}
          >
            <div
              data-column-content
              className="flex min-w-0 max-w-full items-center"
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </div>
          </td>
        ))}
      </tr>
    ),
    [
      isInteractiveTarget,
      onRowClick,
      onRowDoubleClick,
      onRowMouseDown,
      onRowMouseEnter,
    ]
  );

  return (
    <div
      ref={containerRef}
      className={cn("w-full border border-white/5 overflow-hidden", className)}
    >
      <div ref={scrollContainerRef} className="relative overflow-x-auto">
        <div
          ref={measurementSandboxRef}
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 -z-10 h-0 w-0 overflow-hidden opacity-0"
        />
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
                    draggable={canReorderColumn(h.column.id)}
                    className="group relative cursor-pointer border-r border-white/5 bg-sidebar-accent px-6 py-4 text-left font-medium whitespace-nowrap text-white/70 last:border-r-0"
                    style={{ width: h.getSize() }}
                    onDragStart={(event) => {
                      if (!canReorderColumn(h.column.id)) {
                        event.preventDefault();
                        return;
                      }

                      const target = event.target as HTMLElement;
                      if (target.closest('[data-column-resizer="true"]')) {
                        event.preventDefault();
                        return;
                      }

                      setDraggedColumnId(h.column.id);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", h.column.id);
                    }}
                    onDragOver={(event) => {
                      if (
                        !draggedColumnId ||
                        draggedColumnId === h.column.id ||
                        !canReorderColumn(h.column.id)
                      ) {
                        return;
                      }

                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      setDragOverColumnId(h.column.id);
                    }}
                    onDragLeave={() => {
                      setDragOverColumnId((current) =>
                        current === h.column.id ? null : current
                      );
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const sourceColumnId =
                        event.dataTransfer.getData("text/plain") ||
                        draggedColumnId;

                      if (
                        !sourceColumnId ||
                        !canReorderColumn(sourceColumnId) ||
                        !canReorderColumn(h.column.id)
                      ) {
                        setDraggedColumnId(null);
                        setDragOverColumnId(null);
                        return;
                      }

                      reorderColumn(sourceColumnId, h.column.id);
                      setDraggedColumnId(null);
                      setDragOverColumnId(null);
                    }}
                    onDragEnd={() => {
                      setDraggedColumnId(null);
                      setDragOverColumnId(null);
                    }}
                  >
                    <div
                      data-column-content
                      className={cn(
                        "relative inline-flex min-w-max items-center",
                        canReorderColumn(h.column.id) && "cursor-grab",
                        draggedColumnId === h.column.id && "opacity-50",
                        dragOverColumnId === h.column.id &&
                          "text-white after:absolute after:inset-x-3 after:bottom-1 after:h-px after:bg-teal-400"
                      )}
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
                        data-column-resizer="true"
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
            {rowCount === 0 ? (
              <tr>
                <td colSpan={visibleColumnCount} className="p-0">
                  {emptyState ?? (
                    <div className="px-6 py-14 text-center text-sm text-white/45">
                      No rows to display.
                    </div>
                  )}
                </td>
              </tr>
            ) : groupedRows ? (
              groupedRows.map((group) => (
                <React.Fragment key={group.groupKey}>
                  <tr className="border-b border-white/5 bg-sidebar">
                    <td colSpan={visibleColumnCount} className="p-0">
                      {renderRowGroupHeader?.({
                        groupKey: group.groupKey,
                        rows: group.rows,
                        table,
                        isCollapsed: collapsedGroupKeys.has(group.groupKey),
                        onToggleCollapsed: () => {
                          setCollapsedGroupKeys((current) => {
                            const next = new Set(current);
                            if (next.has(group.groupKey)) {
                              next.delete(group.groupKey);
                            } else {
                              next.add(group.groupKey);
                            }
                            return next;
                          });
                        },
                      })}
                    </td>
                  </tr>
                  {collapsedGroupKeys.has(group.groupKey)
                    ? null
                    : group.rows.map((row) =>
                        renderDataRow(
                          row,
                          "animate-in fade-in-0 slide-in-from-top-1 duration-200"
                        )
                      )}
                </React.Fragment>
              ))
            ) : (
              tableRows.map((row) => renderDataRow(row))
            )}
          </tbody>
        </table>
      </div>

      {children ? (
        <div className="border-t border-white/5 p-2">{children}</div>
      ) : null}
    </div>
  );
}
