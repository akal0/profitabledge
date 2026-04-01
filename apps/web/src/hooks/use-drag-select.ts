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
  const activePointerIdRef = useRef<number | null>(null);
  const longPressTimeoutRef = useRef<number | null>(null);
  const suppressClickUntilRef = useRef(0);

  // Track which IDs we've encountered during this drag session
  const dragSessionIdsRef = useRef<Set<string>>(new Set());

  const beginDragSelection = useCallback(
    (rowId: string) => {
      setIsDragging(true);
      setDragStartId(rowId);
      dragSessionIdsRef.current = new Set([rowId]);
      lastHoveredRef.current = rowId;
      suppressClickUntilRef.current = Date.now() + 400;

      const newSelection = new Set<string>([rowId]);
      setSelectedIds(newSelection);
      onSelectionChange?.(newSelection);
    },
    [onSelectionChange]
  );

  const clearPendingLongPress = useCallback(() => {
    if (longPressTimeoutRef.current != null) {
      window.clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, rowId: string) => {
      if (disabled) return;

      const target = e.target as HTMLElement;
      if (
        target.closest("button") ||
        target.closest("input") ||
        target.closest("select") ||
        target.closest("a") ||
        target.closest('[role="button"]')
      ) {
        return;
      }

      if (e.pointerType === "mouse") {
        if (e.button !== 0) return;
        e.preventDefault();
        beginDragSelection(rowId);
        return;
      }

      activePointerIdRef.current = e.pointerId;
      clearPendingLongPress();
      longPressTimeoutRef.current = window.setTimeout(() => {
        beginDragSelection(rowId);
        longPressTimeoutRef.current = null;
      }, 280);
    },
    [beginDragSelection, clearPendingLongPress, disabled]
  );

  const handlePointerEnter = useCallback(
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

  const handlePointerUp = useCallback((pointerId?: number) => {
    if (pointerId != null && activePointerIdRef.current != null) {
      if (pointerId !== activePointerIdRef.current) {
        return;
      }
    }

    clearPendingLongPress();
    activePointerIdRef.current = null;

    if (isDragging) {
      setIsDragging(false);
      setDragStartId(null);
      lastHoveredRef.current = null;
    }
  }, [clearPendingLongPress, isDragging]);

  const clearSelection = useCallback(() => {
    clearPendingLongPress();
    setSelectedIds(new Set());
    setIsDragging(false);
    setDragStartId(null);
    lastHoveredRef.current = null;
    dragSessionIdsRef.current.clear();
    activePointerIdRef.current = null;
    onSelectionChange?.(new Set());
  }, [clearPendingLongPress, onSelectionChange]);

  const shouldSuppressClick = useCallback(() => {
    if (Date.now() <= suppressClickUntilRef.current) {
      suppressClickUntilRef.current = 0;
      return true;
    }

    return false;
  }, []);

  useEffect(() => {
    const handleGlobalPointerUp = (event: PointerEvent) => {
      handlePointerUp(event.pointerId);
    };

    document.addEventListener("pointerup", handleGlobalPointerUp);
    document.addEventListener("pointercancel", handleGlobalPointerUp);
    return () => {
      document.removeEventListener("pointerup", handleGlobalPointerUp);
      document.removeEventListener("pointercancel", handleGlobalPointerUp);
      clearPendingLongPress();
    };
  }, [clearPendingLongPress, handlePointerUp]);

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
    handleMouseDown: handlePointerDown,
    handleMouseEnter: handlePointerEnter,
    handleMouseUp: () => handlePointerUp(),
    handlePointerDown,
    handlePointerEnter,
    handlePointerUp,
    clearSelection,
    shouldSuppressClick,
    containerRef,
    isRowSelected: (rowId: string) => selectedIds.has(rowId),
    selectedCount: selectedIds.size,
  };
}
