"use client";

import { DataTable } from "@/components/data-table/index";
import { useDataTable } from "../../../../../hooks/use-data-table";
import type { ColumnDef } from "@tanstack/react-table";

type TradeRow = {
  open: string;
  symbol: string;
  tradeDirection: "long" | "short";
  volume: number;
  profit: number;
  commissions?: number | null;
  swap?: number | null;
};

const columns: ColumnDef<TradeRow, any>[] = [
  {
    accessorKey: "open",
    header: "Open",
    cell: ({ getValue }) => {
      const d = new Date(getValue<string>());
      const day = d.getDate();
      const j = day % 10;
      const k = day % 100;
      const suf =
        j === 1 && k !== 11
          ? "st"
          : j === 2 && k !== 12
          ? "nd"
          : j === 3 && k !== 13
          ? "rd"
          : "th";
      const month = d.toLocaleString("en-GB", { month: "short" });
      const year = d.getFullYear();
      const datePart = `${day}${suf} ${month}' ${year}`;
      const timePart = d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      return `${datePart} ${timePart}`;
    },
  },
  { accessorKey: "symbol", header: "Symbol" },
  {
    accessorKey: "tradeDirection",
    header: "Direction",
    cell: ({ getValue }) => {
      const v = getValue<string>();
      const label = v === "long" ? "Long" : "Short";

      return (
        <span className={v === "long" ? "text-teal-400" : "text-rose-400"}>
          {label}
        </span>
      );
    },
  },
  { accessorKey: "volume", header: "Volume" },
  {
    accessorKey: "profit",
    header: "P/L",
    cell: ({ getValue }) => {
      const v = Number(getValue<number>() || 0);
      const neg = v < 0;
      return (
        <span className={neg ? "text-rose-400" : "text-teal-400"}>
          {(neg ? "-" : "") + "$" + Math.abs(v).toLocaleString()}
        </span>
      );
    },
  },
  {
    accessorKey: "commissions",
    header: "Commissions",
    cell: ({ getValue }) => {
      const v = Number(getValue<number>() || 0);
      const neg = v < 0;
      return (
        <span className={neg ? "text-rose-400" : "text-teal-400"}>
          {(neg ? "-" : "") + "$" + Math.abs(v).toLocaleString()}
        </span>
      );
    },
  },
  {
    accessorKey: "swap",
    header: "Swap",
    cell: ({ getValue }) => {
      const v = Number(getValue<number>() || 0);
      const neg = v < 0;
      return (
        <span className={neg ? "text-rose-400" : "text-teal-400"}>
          {(neg ? "-" : "") + "$" + Math.abs(v).toLocaleString()}
        </span>
      );
    },
  },
];

const data: TradeRow[] = [];
const pageCount = 1;

const TradeTable = () => {
  const { table } = useDataTable({
    data,
    columns,
    pageCount,
  });

  return <DataTable table={table} />;
};

export default TradeTable;
