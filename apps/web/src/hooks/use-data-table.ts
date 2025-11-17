"use client";

import * as React from "react";
import {
  type ColumnDef,
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
import { trpc, trpcClient, queryClient } from "@/utils/trpc";

export interface UseDataTableOptions<TData> {
  data: TData[];
  columns: ColumnDef<TData, any>[];
  pageCount?: number;
  tableId?: string;
  initialVisibility?: VisibilityState;
}

export function useDataTable<TData>({
  data,
  columns,
  tableId,
  initialVisibility,
}: UseDataTableOptions<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(() => initialVisibility ?? {});
  const [globalFilter, setGlobalFilter] = React.useState<string>("");
  const [rowSelection, setRowSelection] = React.useState({});

  const [didLoadPrefs, setDidLoadPrefs] = React.useState(false);

  // After mount: load from DB
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!tableId) return;
      try {
        const prefs = await queryClient.fetchQuery(
          trpc.users.getTablePreferences.queryOptions({ tableId })
        );
        if (cancelled) return;
        if (prefs && typeof prefs === "object") {
          const anyPref = prefs as any;
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
      } catch {}
      if (!cancelled) setDidLoadPrefs(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [tableId]);

  // DB sync will be triggered by an explicit Save call from UI
  // Persisting handled by toolbar toggles to avoid duplicate requests

  // Cross-device consistency: always refetch DB and reconcile
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!tableId) return;
      try {
        const dbPref = await queryClient.fetchQuery(
          trpc.users.getTablePreferences.queryOptions({ tableId })
        );
        if (cancelled) return;
        const dbVis = (dbPref as any)?.columnVisibility as
          | VisibilityState
          | undefined;
        if (!dbVis) return;
        const stringify = (v: any) => JSON.stringify(v || {});
        if (stringify(columnVisibility) !== stringify(dbVis)) {
          setColumnVisibility(dbVis);
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [tableId]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
      rowSelection,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
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
    globalFilter,
    setGlobalFilter,
    rowSelection,
    setRowSelection,
  };
}
