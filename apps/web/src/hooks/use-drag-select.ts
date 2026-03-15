"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export interface UseDragSelectOptions {
  onSelectionChange?: (selectedIds: Set<string>) => void;
  disabled?: boolean;
}

export function useDragSelect(options: UseDragSelectOptions = {}) {
  const { onSelectionChange, disabled = false } = options;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartId, setDragStartId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastHoveredRef = useRef<string | null>(null);

  // Track which IDs we've encountered during this drag session
  const dragSessionIdsRef = useRef<Set<string>>(new Set());

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, rowId: string) => {
      if (disabled) return;

      // Only start drag on left click, and not if clicking on interactive elements
      if (e.button !== 0) return;

      const target = e.target as HTMLElement;
      // Don't start drag if clicking on buttons, inputs, or other interactive elements
      if (
        target.closest('[data-cell-interactive="true"]') ||
        target.closest("button") ||
        target.closest("input") ||
        target.closest("select") ||
        target.closest("a") ||
        target.closest('[role="button"]')
      ) {
        return;
      }

      e.preventDefault();
      setIsDragging(true);
      setDragStartId(rowId);
      dragSessionIdsRef.current = new Set([rowId]);
      lastHoveredRef.current = rowId;

      // Start with this row selected
      const newSelection = new Set<string>([rowId]);
      setSelectedIds(newSelection);
      onSelectionChange?.(newSelection);
    },
    [disabled, onSelectionChange]
  );

  const handleMouseEnter = useCallback(
    (rowId: string) => {
      if (!isDragging || disabled || !dragStartId) return;

      // Only process if we haven't already processed this row in this drag
      if (lastHoveredRef.current === rowId) return;

      lastHoveredRef.current = rowId;
      dragSessionIdsRef.current.add(rowId);

      // Update selection to include all rows we've dragged over
      const newSelection = new Set(dragSessionIdsRef.current);
      setSelectedIds(newSelection);
      onSelectionChange?.(newSelection);
    },
    [isDragging, disabled, dragStartId, onSelectionChange]
  );

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      setDragStartId(null);
      lastHoveredRef.current = null;
    }
  }, [isDragging]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setIsDragging(false);
    setDragStartId(null);
    lastHoveredRef.current = null;
    dragSessionIdsRef.current.clear();
    onSelectionChange?.(new Set());
  }, [onSelectionChange]);

  // Handle global mouse up to end dragging
  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => {
        handleMouseUp();
      };

      document.addEventListener("mouseup", handleGlobalMouseUp);
      return () => {
        document.removeEventListener("mouseup", handleGlobalMouseUp);
      };
    }
  }, [isDragging, handleMouseUp]);

  // Handle escape key to cancel selection
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        clearSelection();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [clearSelection]);

  return {
    selectedIds,
    isDragging,
    handleMouseDown,
    handleMouseEnter,
    handleMouseUp,
    clearSelection,
    containerRef,
    isRowSelected: (rowId: string) => selectedIds.has(rowId),
    selectedCount: selectedIds.size,
  };
}
