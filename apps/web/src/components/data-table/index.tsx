"use client";

import * as React from "react";
import type { Table } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import { cn } from "@/lib/utils";

export function DataTable<TData>({
  table,
  children,
  onRowClick,
}: {
  table: Table<TData>;
  children?: React.ReactNode;
  onRowClick?: (row: any) => void;
}) {
  return (
    <div className="w-full border border-white/5">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="border-b border-white/5">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="bg-sidebar">
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className="text-left font-medium px-3 py-4 text-white/70 pl-8 bg-sidebar-accent"
                  >
                    {h.isPlaceholder
                      ? null
                      : flexRender(h.column.columnDef.header, h.getContext())}
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
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-6 pl-8 select-none">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
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
