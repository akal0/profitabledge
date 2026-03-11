import * as React from "react";

export interface TradeKeyboardShortcuts {
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  onDelete?: () => void;
  onOpenDetails?: () => void;
  onNavigateUp?: () => void;
  onNavigateDown?: () => void;
  onToggleSelection?: () => void;
  onCopy?: () => void;
  onExport?: () => void;
  onCompare?: () => void;
}

export function useTradeKeyboardShortcuts(
  shortcuts: TradeKeyboardShortcuts,
  enabled = true
) {
  React.useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputField =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // Don't handle shortcuts when typing in input fields
      if (isInputField && e.key !== "Escape") {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Select all visible trades (Cmd/Ctrl + Shift + A)
      // Using Shift to avoid conflict with browser's native "select all"
      if (cmdOrCtrl && e.shiftKey && e.key === "A") {
        e.preventDefault();
        shortcuts.onSelectAll?.();
        return;
      }

      // Deselect all (Escape)
      if (e.key === "Escape") {
        e.preventDefault();
        shortcuts.onDeselectAll?.();
        return;
      }

      // Delete selected trades (Delete/Backspace)
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        !isInputField
      ) {
        e.preventDefault();
        shortcuts.onDelete?.();
        return;
      }

      // Open details for selected trade (Enter)
      if (e.key === "Enter" && !cmdOrCtrl && !isInputField) {
        e.preventDefault();
        shortcuts.onOpenDetails?.();
        return;
      }

      // Navigate up (Arrow Up)
      if (e.key === "ArrowUp" && !isInputField) {
        e.preventDefault();
        shortcuts.onNavigateUp?.();
        return;
      }

      // Navigate down (Arrow Down)
      if (e.key === "ArrowDown" && !isInputField) {
        e.preventDefault();
        shortcuts.onNavigateDown?.();
        return;
      }

      // Toggle selection (Space)
      if (e.key === " " && !isInputField) {
        e.preventDefault();
        shortcuts.onToggleSelection?.();
        return;
      }

      // Copy (Cmd/Ctrl + C)
      if (cmdOrCtrl && e.key === "c" && !isInputField) {
        e.preventDefault();
        shortcuts.onCopy?.();
        return;
      }

      // Export (Cmd/Ctrl + E)
      if (cmdOrCtrl && e.key === "e") {
        e.preventDefault();
        shortcuts.onExport?.();
        return;
      }

      // Compare (Cmd/Ctrl + Shift + C)
      if (cmdOrCtrl && e.shiftKey && e.key === "C") {
        e.preventDefault();
        shortcuts.onCompare?.();
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [shortcuts, enabled]);
}
