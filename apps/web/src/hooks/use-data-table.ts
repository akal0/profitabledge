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

const TABLE_PREFERENCES_VERSION = 1;

function getColumnId<TData>(column: ColumnDef<TData, any>, index: number) {
  return (column.id || (column as any).accessorKey || `col_${index}`) as string;
}

function buildValidatedColumnVisibility<TData>({
  columns,
  initialVisibility,
  savedVisibility,
}: {
  columns: ColumnDef<TData, any>[];
  initialVisibility?: VisibilityState;
  savedVisibility?: VisibilityState;
}) {
  const nextVisibility: VisibilityState = {};

  columns.forEach((column, index) => {
    const id = getColumnId(column, index);

    if ((column as any)?.enableHiding === false) {
      nextVisibility[id] = true;
      return;
    }

    if (savedVisibility && typeof savedVisibility[id] === "boolean") {
      nextVisibility[id] = savedVisibility[id] as boolean;
      return;
    }

    if (initialVisibility && typeof initialVisibility[id] === "boolean") {
      nextVisibility[id] = initialVisibility[id] as boolean;
      return;
    }

    nextVisibility[id] = true;
  });

  return nextVisibility;
}

function sanitizeSortingState(
  sorting: SortingState,
  validColumnIds: Set<string>
) {
  return sorting.filter((item) => validColumnIds.has(item.id));
}

function sanitizeColumnSizing(
  sizing: ColumnSizingState,
  validColumnIds: Set<string>
) {
  return Object.fromEntries(
    Object.entries(sizing).filter(
      ([columnId, value]) =>
        validColumnIds.has(columnId) &&
        typeof value === "number" &&
        Number.isFinite(value)
    )
  );
}

export interface UseDataTableOptions<TData> {
  data: TData[];
  columns: ColumnDef<TData, any>[];
  pageCount?: number;
  tableId?: string;
  initialPageIndex?: number;
  initialPageSize?: number;
  initialVisibility?: VisibilityState;
  initialSizing?: ColumnSizingState;
  meta?: any;
  disablePreferences?: boolean;
  getRowId?: (row: TData, index: number) => string;
  enableFilteringRowModel?: boolean;
  enablePaginationRowModel?: boolean;
  enableColumnResizing?: boolean;
}

export function useDataTable<TData>({
  data,
  columns,
  tableId,
  initialPageIndex,
  initialPageSize,
  initialVisibility,
  initialSizing,
  meta,
  disablePreferences,
  getRowId,
  enableFilteringRowModel = true,
  enablePaginationRowModel = true,
  enableColumnResizing = true,
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
  const lastPersistedSortingRef = React.useRef(JSON.stringify([]));
  const lastPersistedVisibilityRef = React.useRef(
    JSON.stringify(initialVisibility ?? {})
  );
  const persistSizingTimeoutRef = React.useRef<number | null>(null);
  const persistSortingTimeoutRef = React.useRef<number | null>(null);
  const persistVisibilityTimeoutRef = React.useRef<number | null>(null);
  const validColumnIds = React.useMemo(
    () => new Set(columns.map((column, index) => getColumnId(column, index))),
    [columns]
  );

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
          const normalizedVisibility = buildValidatedColumnVisibility({
            columns,
            initialVisibility,
            savedVisibility:
              anyPref.columnVisibility &&
              typeof anyPref.columnVisibility === "object" &&
              !Array.isArray(anyPref.columnVisibility)
                ? (anyPref.columnVisibility as VisibilityState)
                : undefined,
          });

          if (!disablePreferences) {
            if (
              Array.isArray(anyPref.visible) ||
              Array.isArray(anyPref.visibleColumns)
            ) {
              const list: string[] = (anyPref.visible ||
                anyPref.visibleColumns) as string[];
              const visibleSet = new Set(list);
              setColumnVisibility(
                buildValidatedColumnVisibility({
                  columns,
                  initialVisibility,
                  savedVisibility: Object.fromEntries(
                    columns.map((column, index) => {
                      const id = getColumnId(column, index);
                      return [id, visibleSet.has(id)];
                    })
                  ),
                })
              );
            } else {
              setColumnVisibility(normalizedVisibility);
            }

            lastPersistedVisibilityRef.current = JSON.stringify(
              normalizedVisibility
            );
          }

          if (
            Array.isArray(anyPref.sorting) &&
            anyPref.sorting.every(
              (item: unknown) =>
                item &&
                typeof item === "object" &&
                "id" in item &&
                typeof (item as { id?: unknown }).id === "string" &&
                "desc" in item &&
              typeof (item as { desc?: unknown }).desc === "boolean"
             )
           ) {
            const nextSorting = sanitizeSortingState(
              anyPref.sorting as SortingState,
              validColumnIds
            );
            setSorting(nextSorting);
            lastPersistedSortingRef.current = JSON.stringify(nextSorting);
          }

          if (
            enableColumnResizing &&
            anyPref.columnSizing &&
            typeof anyPref.columnSizing === "object" &&
              !Array.isArray(anyPref.columnSizing)
          ) {
            const nextSizing = {
              ...(initialSizing ?? {}),
              ...sanitizeColumnSizing(
                anyPref.columnSizing as ColumnSizingState,
                validColumnIds
              ),
            };
            setColumnSizing(nextSizing);
            lastPersistedSizingRef.current = JSON.stringify(nextSizing);
          }
        } else {
          lastPersistedSizingRef.current = JSON.stringify(initialSizing ?? {});
          lastPersistedSortingRef.current = JSON.stringify([]);
          lastPersistedVisibilityRef.current = JSON.stringify(
            initialVisibility ?? {}
          );
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
    initialSizing,
    initialVisibility,
    enableColumnResizing,
    validColumnIds,
  ]);

  React.useEffect(() => {
    if (!didLoadPrefs || !tableId) {
      return;
    }

    const serializedSorting = JSON.stringify(sorting || []);
    if (serializedSorting === lastPersistedSortingRef.current) {
      return;
    }

    if (persistSortingTimeoutRef.current) {
      window.clearTimeout(persistSortingTimeoutRef.current);
    }

    persistSortingTimeoutRef.current = window.setTimeout(async () => {
      try {
        await trpcClient.users.updateTablePreferences.mutate({
          tableId,
          preferences: { sorting, version: TABLE_PREFERENCES_VERSION },
        });
        lastPersistedSortingRef.current = JSON.stringify(sorting || []);
      } catch {}
    }, 250);

    return () => {
      if (persistSortingTimeoutRef.current) {
        window.clearTimeout(persistSortingTimeoutRef.current);
      }
    };
  }, [didLoadPrefs, sorting, tableId]);

  React.useEffect(() => {
    if (!didLoadPrefs || !tableId || disablePreferences) {
      return;
    }

    const normalizedVisibility = buildValidatedColumnVisibility({
      columns,
      initialVisibility,
      savedVisibility: columnVisibility,
    });
    const serializedVisibility = JSON.stringify(normalizedVisibility);
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
          preferences: {
            columnVisibility: normalizedVisibility,
            version: TABLE_PREFERENCES_VERSION,
          },
        });
        lastPersistedVisibilityRef.current = serializedVisibility;
      } catch {}
    }, 250);

    return () => {
      if (persistVisibilityTimeoutRef.current) {
        window.clearTimeout(persistVisibilityTimeoutRef.current);
      }
    };
  }, [
    columnVisibility,
    columns,
    didLoadPrefs,
    disablePreferences,
    initialVisibility,
    tableId,
  ]);

  React.useEffect(() => {
    if (!didLoadPrefs || !tableId || !enableColumnResizing) {
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
          preferences: {
            columnSizing: sanitizedSizing,
            version: TABLE_PREFERENCES_VERSION,
          },
        });
        lastPersistedSizingRef.current = JSON.stringify(sanitizedSizing);
      } catch {}
    }, 400);

    return () => {
      if (persistSizingTimeoutRef.current) {
        window.clearTimeout(persistSizingTimeoutRef.current);
      }
    };
  }, [columnSizing, didLoadPrefs, tableId, enableColumnResizing]);

  React.useEffect(() => {
    if (!didLoadPrefs || !tableId) {
      return;
    }

    const flushPreferences = () => {
      if (persistSortingTimeoutRef.current) {
        window.clearTimeout(persistSortingTimeoutRef.current);
        persistSortingTimeoutRef.current = null;
      }

      if (persistSizingTimeoutRef.current) {
        window.clearTimeout(persistSizingTimeoutRef.current);
        persistSizingTimeoutRef.current = null;
      }

      if (persistVisibilityTimeoutRef.current) {
        window.clearTimeout(persistVisibilityTimeoutRef.current);
        persistVisibilityTimeoutRef.current = null;
      }

      void trpcClient.users.updateTablePreferences.mutate({
        tableId,
        preferences: {
          columnSizing: sanitizeColumnSizing(columnSizing || {}, validColumnIds),
          columnVisibility: disablePreferences
            ? undefined
            : buildValidatedColumnVisibility({
                columns,
                initialVisibility,
                savedVisibility: columnVisibility,
              }),
          sorting: sanitizeSortingState(sorting || [], validColumnIds),
          version: TABLE_PREFERENCES_VERSION,
        },
      });
    };

    window.addEventListener("beforeunload", flushPreferences);
    return () => window.removeEventListener("beforeunload", flushPreferences);
  }, [
    columnSizing,
    columnVisibility,
    columns,
    didLoadPrefs,
    disablePreferences,
    initialVisibility,
    sorting,
    tableId,
    validColumnIds,
  ]);

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
    enableColumnResizing,
    columnResizeMode: "onEnd",
    // These tables render the full row model, so auto-resetting pagination
    // can schedule unnecessary state updates during mount in React dev.
    autoResetPageIndex: false,
    manualFiltering: !enableFilteringRowModel,
    manualPagination: !enablePaginationRowModel,
    initialState:
      initialPageIndex != null || initialPageSize != null
        ? {
            pagination: {
              pageIndex: initialPageIndex ?? 0,
              pageSize: initialPageSize ?? 10,
            },
          }
        : undefined,
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
