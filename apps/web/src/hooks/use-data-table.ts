"use client";

import * as React from "react";
import {
  type ColumnDef,
  type ColumnSizingState,
  type ColumnOrderState,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  flexRender,
  useReactTable,
} from "@tanstack/react-table";
import { trpcClient, trpcOptions, queryClient } from "@/utils/trpc";

export interface UseDataTableOptions<TData> {
  data: TData[];
  columns: ColumnDef<TData, any>[];
  pageCount?: number;
  tableId?: string;
  initialVisibility?: VisibilityState;
  initialSizing?: ColumnSizingState;
  meta?: any;
  disablePreferences?: boolean;
  getRowId?: (row: TData, index: number) => string;
}

function getColumnIdFromDef<TData>(
  column: ColumnDef<TData, any>,
  index: number
) {
  return (
    ("id" in column && typeof column.id === "string" && column.id) ||
    ("accessorKey" in column &&
      typeof column.accessorKey === "string" &&
      column.accessorKey) ||
    `col_${index}`
  );
}

function buildDefaultColumnOrder<TData>(columns: ColumnDef<TData, any>[]) {
  return columns.map((column, index) => getColumnIdFromDef(column, index));
}

function mergeColumnOrder(
  savedOrder: string[] | undefined,
  defaultOrder: string[]
): ColumnOrderState {
  if (!savedOrder?.length) {
    return defaultOrder;
  }

  const allowed = new Set(defaultOrder);
  const filteredSavedOrder = savedOrder.filter((id) => allowed.has(id));
  const missing = defaultOrder.filter((id) => !filteredSavedOrder.includes(id));

  return [...filteredSavedOrder, ...missing];
}

export function useDataTable<TData>({
  data,
  columns,
  tableId,
  initialVisibility,
  initialSizing,
  meta,
  disablePreferences,
  getRowId,
}: UseDataTableOptions<TData>) {
  const defaultColumnOrder = React.useMemo(
    () => buildDefaultColumnOrder(columns),
    [columns]
  );
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(() => initialVisibility ?? {});
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>(
    () => initialSizing ?? {}
  );
  const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>(
    () => defaultColumnOrder
  );
  const [globalFilter, setGlobalFilter] = React.useState<string>("");
  const [rowSelection, setRowSelection] = React.useState({});

  const [didLoadPrefs, setDidLoadPrefs] = React.useState(false);
  const lastPersistedVisibilityRef = React.useRef(
    JSON.stringify(initialVisibility ?? {})
  );
  const lastPersistedSizingRef = React.useRef(
    JSON.stringify(initialSizing ?? {})
  );
  const lastPersistedOrderRef = React.useRef(
    JSON.stringify(defaultColumnOrder)
  );
  const persistSizingTimeoutRef = React.useRef<number | null>(null);
  const persistVisibilityTimeoutRef = React.useRef<number | null>(null);
  const persistOrderTimeoutRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    setColumnOrder((current) => mergeColumnOrder(current, defaultColumnOrder));
  }, [defaultColumnOrder]);

  // After mount: load from DB
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!tableId) {
        if (!cancelled) setDidLoadPrefs(true);
        return;
      }
      try {
        const prefs = await queryClient.fetchQuery(
          trpcOptions.users.getTablePreferences.queryOptions({ tableId })
        );
        if (cancelled) return;
        if (prefs && typeof prefs === "object") {
          const anyPref = prefs as any;
          if (!disablePreferences) {
            let nextVis: VisibilityState | undefined = undefined;
            if (
              anyPref.columnVisibility &&
              typeof anyPref.columnVisibility === "object"
            ) {
              nextVis = anyPref.columnVisibility as VisibilityState;
            } else if (
              Array.isArray(anyPref.visible) ||
              Array.isArray(anyPref.visibleColumns)
            ) {
              const list: string[] = (anyPref.visible ||
                anyPref.visibleColumns) as string[];
              const visibleSet = new Set(list);
              const mapping: VisibilityState = {};
              (columns as any[]).forEach((def: any, idx: number) => {
                const id: string = def?.id || def?.accessorKey || `col_${idx}`;
                if (def?.enableHiding === false) return;
                mapping[id] = visibleSet.has(id);
              });
              nextVis = mapping;
            }
            if (nextVis) {
              setColumnVisibility(nextVis);
              lastPersistedVisibilityRef.current = JSON.stringify(nextVis);
            }
          }

          if (
            anyPref.columnSizing &&
            typeof anyPref.columnSizing === "object" &&
            !Array.isArray(anyPref.columnSizing)
          ) {
            const nextSizing = {
              ...(initialSizing ?? {}),
              ...(anyPref.columnSizing as ColumnSizingState),
            };
            setColumnSizing(nextSizing);
            lastPersistedSizingRef.current = JSON.stringify(nextSizing);
          }

          if (Array.isArray(anyPref.columnOrder)) {
            const nextOrder = mergeColumnOrder(
              anyPref.columnOrder as string[],
              defaultColumnOrder
            );
            setColumnOrder(nextOrder);
            lastPersistedOrderRef.current = JSON.stringify(nextOrder);
          }
        } else {
          lastPersistedVisibilityRef.current = JSON.stringify(
            initialVisibility ?? {}
          );
          lastPersistedSizingRef.current = JSON.stringify(initialSizing ?? {});
          lastPersistedOrderRef.current = JSON.stringify(defaultColumnOrder);
        }
      } catch {}
      if (!cancelled) setDidLoadPrefs(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    tableId,
    disablePreferences,
    columns,
    defaultColumnOrder,
    initialSizing,
    initialVisibility,
  ]);

  React.useEffect(() => {
    if (!didLoadPrefs || !tableId || disablePreferences) {
      return;
    }

    const serializedVisibility = JSON.stringify(columnVisibility || {});
    if (serializedVisibility === lastPersistedVisibilityRef.current) {
      return;
    }

    if (persistVisibilityTimeoutRef.current) {
      window.clearTimeout(persistVisibilityTimeoutRef.current);
    }

    persistVisibilityTimeoutRef.current = window.setTimeout(async () => {
      try {
        await trpcClient.users.updateTablePreferences.mutate({
          tableId,
          preferences: { columnVisibility },
        });
        lastPersistedVisibilityRef.current = serializedVisibility;
      } catch {}
    }, 400);

    return () => {
      if (persistVisibilityTimeoutRef.current) {
        window.clearTimeout(persistVisibilityTimeoutRef.current);
      }
    };
  }, [columnVisibility, didLoadPrefs, disablePreferences, tableId]);

  React.useEffect(() => {
    if (!didLoadPrefs || !tableId) {
      return;
    }

    const serializedSizing = JSON.stringify(columnSizing || {});
    if (serializedSizing === lastPersistedSizingRef.current) {
      return;
    }

    if (persistSizingTimeoutRef.current) {
      window.clearTimeout(persistSizingTimeoutRef.current);
    }

    persistSizingTimeoutRef.current = window.setTimeout(async () => {
      try {
        const sanitizedSizing = Object.fromEntries(
          Object.entries(columnSizing || {}).filter(
            ([, value]) => typeof value === "number" && Number.isFinite(value)
          )
        );
        await trpcClient.users.updateTablePreferences.mutate({
          tableId,
          preferences: { columnSizing: sanitizedSizing },
        });
        lastPersistedSizingRef.current = JSON.stringify(sanitizedSizing);
      } catch {}
    }, 400);

    return () => {
      if (persistSizingTimeoutRef.current) {
        window.clearTimeout(persistSizingTimeoutRef.current);
      }
    };
  }, [columnSizing, didLoadPrefs, tableId]);

  React.useEffect(() => {
    if (!didLoadPrefs || !tableId) {
      return;
    }

    const serializedOrder = JSON.stringify(columnOrder || []);
    if (serializedOrder === lastPersistedOrderRef.current) {
      return;
    }

    if (persistOrderTimeoutRef.current) {
      window.clearTimeout(persistOrderTimeoutRef.current);
    }

    persistOrderTimeoutRef.current = window.setTimeout(async () => {
      try {
        const nextOrder = mergeColumnOrder(columnOrder, defaultColumnOrder);
        await trpcClient.users.updateTablePreferences.mutate({
          tableId,
          preferences: { columnOrder: nextOrder },
        });
        lastPersistedOrderRef.current = JSON.stringify(nextOrder);
      } catch {}
    }, 400);

    return () => {
      if (persistOrderTimeoutRef.current) {
        window.clearTimeout(persistOrderTimeoutRef.current);
      }
    };
  }, [columnOrder, defaultColumnOrder, didLoadPrefs, tableId]);

  const table = useReactTable({
    data,
    columns,
    meta,
    getRowId,
    defaultColumn: {
      size: 140,
      minSize: 60,
      maxSize: 500,
    },
    enableColumnResizing: true,
    columnResizeMode: "onEnd",
    // These tables render the full row model, so auto-resetting pagination
    // can schedule unnecessary state updates during mount in React dev.
    autoResetPageIndex: false,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      columnSizing,
      columnOrder,
      globalFilter,
      rowSelection,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    onColumnOrderChange: setColumnOrder,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return {
    table,
    sorting,
    setSorting,
    columnFilters,
    setColumnFilters,
    columnVisibility,
    setColumnVisibility,
    columnSizing,
    setColumnSizing,
    columnOrder,
    setColumnOrder,
    globalFilter,
    setGlobalFilter,
    rowSelection,
    setRowSelection,
  };
}
