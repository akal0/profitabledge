export function exportTradesToCSV(
  trades: any[],
  visibleColumns: string[],
  columnLabels: Record<string, string>
) {
  if (trades.length === 0) {
    return;
  }

  // Create header row
  const headers = visibleColumns.map(
    (col) => columnLabels[col] || col
  );

  // Create data rows
  const rows = trades.map((trade) => {
    return visibleColumns.map((col) => {
      const value = trade[col];

      // Handle different value types
      if (value === null || value === undefined) {
        return "";
      }

      if (typeof value === "boolean") {
        return value ? "Yes" : "No";
      }

      if (value instanceof Date) {
        return value.toISOString();
      }

      if (typeof value === "number") {
        return value;
      }

      // Escape commas and quotes in string values
      if (typeof value === "string") {
        if (value.includes(",") || value.includes('"') || value.includes("\n")) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }

      return String(value);
    });
  });

  // Combine into CSV string
  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.join(",")),
  ].join("\n");

  // Create and trigger download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  const timestamp = new Date().toISOString().split("T")[0];
  link.setAttribute("href", url);
  link.setAttribute("download", `trades-export-${timestamp}.csv`);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportTradesToExcel(
  trades: any[],
  visibleColumns: string[],
  columnLabels: Record<string, string>
) {
  // For now, we'll create a more formatted CSV that Excel can import
  // In the future, we could use a library like xlsx to create true Excel files

  if (trades.length === 0) {
    return;
  }

  // Create header row with styling hints (bold)
  const headers = visibleColumns.map(
    (col) => columnLabels[col] || col
  );

  // Create data rows with proper formatting
  const rows = trades.map((trade) => {
    return visibleColumns.map((col) => {
      const value = trade[col];

      if (value === null || value === undefined) {
        return "";
      }

      if (typeof value === "boolean") {
        return value ? "Yes" : "No";
      }

      if (value instanceof Date) {
        return value.toLocaleDateString() + " " + value.toLocaleTimeString();
      }

      if (typeof value === "number") {
        // Format numbers with appropriate decimals
        if (col.includes("Price") || col.includes("price")) {
          return value.toFixed(5);
        }
        if (col.includes("Pips") || col.includes("pips")) {
          return value.toFixed(1);
        }
        if (col.includes("profit") || col.includes("Profit") || col === "commissions" || col === "swap") {
          return value.toFixed(2);
        }
        if (col.includes("RR") || col.includes("Efficiency")) {
          return value.toFixed(2);
        }
        return value;
      }

      if (typeof value === "string") {
        if (value.includes(",") || value.includes('"') || value.includes("\n")) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }

      return String(value);
    });
  });

  // Add summary row at the end
  const summaryRow = visibleColumns.map((col) => {
    if (col === "symbol") {
      return "SUMMARY";
    }

    if (col === "profit") {
      const total = trades.reduce((sum, t) => sum + (Number(t.profit) || 0), 0);
      return total.toFixed(2);
    }

    if (col === "volume") {
      const total = trades.reduce((sum, t) => sum + (Number(t.volume) || 0), 0);
      return total.toFixed(2);
    }

    if (col === "commissions") {
      const total = trades.reduce((sum, t) => sum + (Number(t.commissions) || 0), 0);
      return total.toFixed(2);
    }

    if (col === "swap") {
      const total = trades.reduce((sum, t) => sum + (Number(t.swap) || 0), 0);
      return total.toFixed(2);
    }

    return "";
  });

  // Combine into CSV string
  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.join(",")),
    "", // Empty row before summary
    summaryRow.join(","),
  ].join("\n");

  // Create and trigger download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  const timestamp = new Date().toISOString().split("T")[0];
  link.setAttribute("href", url);
  link.setAttribute("download", `trades-export-${timestamp}.csv`);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function copyTradesToClipboard(
  trades: any[],
  visibleColumns: string[],
  columnLabels: Record<string, string>
) {
  if (trades.length === 0) {
    return;
  }

  // Create tab-separated values for easy pasting into spreadsheets
  const headers = visibleColumns.map(
    (col) => columnLabels[col] || col
  );

  const rows = trades.map((trade) => {
    return visibleColumns.map((col) => {
      const value = trade[col];
      if (value === null || value === undefined) return "";
      if (typeof value === "boolean") return value ? "Yes" : "No";
      if (value instanceof Date) return value.toISOString();
      return String(value);
    });
  });

  const tsvContent = [
    headers.join("\t"),
    ...rows.map((row) => row.join("\t")),
  ].join("\n");

  navigator.clipboard.writeText(tsvContent);
}
