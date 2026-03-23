"use client";

import * as React from "react";
import {
  type ColumnDef,
  type ColumnSizingState,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
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
  enableFilteringRowModel?: boolean;
  enablePaginationRowModel?: boolean;
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
  enableFilteringRowModel = true,
  enablePaginationRowModel = true,
}: UseDataTableOptions<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(() => initialVisibility ?? {});
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>(
    () => initialSizing ?? {}
  );
  const [globalFilter, setGlobalFilter] = React.useState<string>("");
  const [rowSelection, setRowSelection] = React.useState({});

  const [didLoadPrefs, setDidLoadPrefs] = React.useState(false);
  const lastPersistedSizingRef = React.useRef(
    JSON.stringify(initialSizing ?? {})
  );
  const persistSizingTimeoutRef = React.useRef<number | null>(null);

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
        } else {
          lastPersistedSizingRef.current = JSON.stringify(initialSizing ?? {});
        }
      } catch {}
      if (!cancelled) setDidLoadPrefs(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [tableId, disablePreferences, columns, initialSizing]);

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
    manualFiltering: !enableFilteringRowModel,
    manualPagination: !enablePaginationRowModel,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      columnSizing,
      globalFilter,
      rowSelection,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: enableFilteringRowModel
      ? getFilteredRowModel()
      : undefined,
    getPaginationRowModel: enablePaginationRowModel
      ? getPaginationRowModel()
      : undefined,
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
    globalFilter,
    setGlobalFilter,
    rowSelection,
    setRowSelection,
  };
}
