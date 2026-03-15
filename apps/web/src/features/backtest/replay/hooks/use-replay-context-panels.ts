"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  type Dispatch,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from "react";

import {
  CONTEXT_DOCK_SLOTS,
  DEFAULT_FAVORITE_TOOLS_BAR_OFFSET,
  type BacktestTimeframe,
  type ContextDockSlot,
  type ContextPaneMode,
  type ContextPanePosition,
  type ContextPaneSeriesItem,
  type FavoriteToolsBarOffset,
} from "../lib/replay-domain";
import {
  areContextDockAssignmentsEqual,
  buildContextDockAssignments,
  clamp,
  getDefaultContextPanePosition,
  getDefaultContextTimeframes,
  getNextContextPaneMode,
} from "../lib/replay-utils";

type DragState = {
  timeframe: BacktestTimeframe;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

type FavoriteToolsBarDragState = {
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

type UseReplayContextPanelsArgs = {
  timeframe: BacktestTimeframe;
  activeContextTimeframes: BacktestTimeframe[];
  contextVisibilityEnabled: boolean;
  contextPaneSeries: ContextPaneSeriesItem[];
  contextPanePositions: Partial<Record<BacktestTimeframe, ContextPanePosition>>;
  contextPaneModes: Partial<Record<BacktestTimeframe, ContextPaneMode>>;
  contextDockAssignments: Partial<Record<BacktestTimeframe, ContextDockSlot>>;
  draggingContextPane: BacktestTimeframe | null;
  draggingDockContextTimeframe: BacktestTimeframe | null;
  activeContextDockTarget: ContextDockSlot | null;
  favoriteToolsBarOffset: FavoriteToolsBarOffset;
  isDraggingFavoriteToolsBar: boolean;
  setSelectedContextTimeframes: Dispatch<SetStateAction<BacktestTimeframe[] | null>>;
  setContextPanePositions: Dispatch<
    SetStateAction<Partial<Record<BacktestTimeframe, ContextPanePosition>>>
  >;
  setContextPaneModes: Dispatch<
    SetStateAction<Partial<Record<BacktestTimeframe, ContextPaneMode>>>
  >;
  setContextDockAssignments: Dispatch<
    SetStateAction<Partial<Record<BacktestTimeframe, ContextDockSlot>>>
  >;
  setDraggingContextPane: Dispatch<SetStateAction<BacktestTimeframe | null>>;
  setDraggingDockContextTimeframe: Dispatch<
    SetStateAction<BacktestTimeframe | null>
  >;
  setActiveContextDockTarget: Dispatch<SetStateAction<ContextDockSlot | null>>;
  setFavoriteToolsBarOffset: Dispatch<SetStateAction<FavoriteToolsBarOffset>>;
  setIsDraggingFavoriteToolsBar: Dispatch<SetStateAction<boolean>>;
  chartWorkspaceRef: MutableRefObject<HTMLDivElement | null>;
  favoriteToolsBarRef: MutableRefObject<HTMLDivElement | null>;
  dockTargetRefs: MutableRefObject<
    Partial<Record<ContextDockSlot, HTMLDivElement | null>>
  >;
  contextPaneDragRef: MutableRefObject<DragState | null>;
  favoriteToolsBarDragRef: MutableRefObject<FavoriteToolsBarDragState | null>;
  contextDockDragRef: MutableRefObject<{ timeframe: BacktestTimeframe } | null>;
};

export function useReplayContextPanels({
  timeframe,
  activeContextTimeframes,
  contextVisibilityEnabled,
  contextPaneSeries,
  contextPanePositions,
  contextPaneModes,
  contextDockAssignments,
  draggingContextPane,
  draggingDockContextTimeframe,
  activeContextDockTarget,
  favoriteToolsBarOffset,
  isDraggingFavoriteToolsBar,
  setSelectedContextTimeframes,
  setContextPanePositions,
  setContextPaneModes,
  setContextDockAssignments,
  setDraggingContextPane,
  setDraggingDockContextTimeframe,
  setActiveContextDockTarget,
  setFavoriteToolsBarOffset,
  setIsDraggingFavoriteToolsBar,
  chartWorkspaceRef,
  favoriteToolsBarRef,
  dockTargetRefs,
  contextPaneDragRef,
  favoriteToolsBarDragRef,
  contextDockDragRef,
}: UseReplayContextPanelsArgs) {
  useEffect(() => {
    setContextDockAssignments((previous) => {
      const next = buildContextDockAssignments(activeContextTimeframes, previous);
      return areContextDockAssignmentsEqual(previous, next) ? previous : next;
    });
  }, [activeContextTimeframes, setContextDockAssignments]);

  const contextDockedPanes = useMemo(() => {
    const slotMap: Partial<Record<ContextDockSlot, ContextPaneSeriesItem>> = {};
    const undocked: ContextPaneSeriesItem[] = [];

    contextPaneSeries.forEach((pane) => {
      const slot = contextDockAssignments[pane.timeframe];
      if (!slot || slotMap[slot]) {
        undocked.push(pane);
        return;
      }

      slotMap[slot] = pane;
    });

    return {
      slots: slotMap,
      undocked,
    };
  }, [contextDockAssignments, contextPaneSeries]);

  const hasDockedContextPanes = useMemo(
    () =>
      activeContextTimeframes.some((contextTimeframe) =>
        Boolean(contextDockAssignments[contextTimeframe])
      ),
    [activeContextTimeframes, contextDockAssignments]
  );

  const showFloatingContextPanes =
    contextVisibilityEnabled &&
    !hasDockedContextPanes &&
    contextPaneSeries.length > 0;
  const showSplitContextPanes =
    contextVisibilityEnabled &&
    hasDockedContextPanes &&
    contextPaneSeries.length > 0;
  const showContextDockTargets =
    contextVisibilityEnabled &&
    Boolean(draggingContextPane || draggingDockContextTimeframe) &&
    contextPaneSeries.length > 0;

  const toggleContextTimeframe = useCallback(
    (contextTimeframe: BacktestTimeframe, checked: boolean) => {
      if (contextTimeframe === timeframe) return;

      setSelectedContextTimeframes((previous) => {
        const current = previous ?? getDefaultContextTimeframes(timeframe);
        if (checked) {
          return current.includes(contextTimeframe)
            ? current
            : [...current, contextTimeframe];
        }

        return current.filter((item) => item !== contextTimeframe);
      });
    },
    [setSelectedContextTimeframes, timeframe]
  );

  const closeContextTimeframe = useCallback(
    (contextTimeframe: BacktestTimeframe) => {
      setSelectedContextTimeframes((previous) => {
        const current = previous ?? getDefaultContextTimeframes(timeframe);
        return current.filter((item) => item !== contextTimeframe);
      });

      setContextPanePositions((previous) => {
        if (!(contextTimeframe in previous)) return previous;
        const next = { ...previous };
        delete next[contextTimeframe];
        return next;
      });

      setContextPaneModes((previous) => {
        if (!(contextTimeframe in previous)) return previous;
        const next = { ...previous };
        delete next[contextTimeframe];
        return next;
      });

      setContextDockAssignments((previous) => {
        if (!(contextTimeframe in previous)) return previous;
        const next = { ...previous };
        delete next[contextTimeframe];
        return next;
      });
    },
    [
      setContextDockAssignments,
      setContextPaneModes,
      setContextPanePositions,
      setSelectedContextTimeframes,
      timeframe,
    ]
  );

  const undockAllContextPanes = useCallback(() => {
    setContextDockAssignments({});
  }, [setContextDockAssignments]);

  const resetContextTimeframes = useCallback(() => {
    setSelectedContextTimeframes(getDefaultContextTimeframes(timeframe));
    setContextDockAssignments({});
  }, [setContextDockAssignments, setSelectedContextTimeframes, timeframe]);

  const cycleContextPaneMode = useCallback(
    (contextTimeframe: BacktestTimeframe) => {
      setContextPaneModes((previous) => ({
        ...previous,
        [contextTimeframe]: getNextContextPaneMode(
          previous[contextTimeframe] ?? "recent"
        ),
      }));
    },
    [setContextPaneModes]
  );

  const assignContextToDockSlot = useCallback(
    (contextTimeframe: BacktestTimeframe, targetSlot: ContextDockSlot) => {
      setContextDockAssignments((previous) => {
        const next = { ...previous };
        const currentSlot = next[contextTimeframe];
        const occupyingTimeframe = Object.entries(next).find(
          ([timeframeKey, slot]) =>
            timeframeKey !== contextTimeframe && slot === targetSlot
        )?.[0] as BacktestTimeframe | undefined;

        next[contextTimeframe] = targetSlot;

        if (occupyingTimeframe) {
          if (currentSlot) {
            next[occupyingTimeframe] = currentSlot;
          } else {
            delete next[occupyingTimeframe];
          }
        }

        return next;
      });
    },
    [setContextDockAssignments]
  );

  const handleContextDockDragStart = useCallback(
    (
      contextTimeframe: BacktestTimeframe,
      event: ReactPointerEvent<HTMLDivElement>
    ) => {
      event.preventDefault();
      event.stopPropagation();
      contextDockDragRef.current = { timeframe: contextTimeframe };
      setDraggingDockContextTimeframe(contextTimeframe);
      setActiveContextDockTarget(contextDockAssignments[contextTimeframe] ?? null);
    },
    [
      contextDockAssignments,
      contextDockDragRef,
      setActiveContextDockTarget,
      setDraggingDockContextTimeframe,
    ]
  );

  const handleContextPanePointerDown = useCallback(
    (
      timeframeToDrag: BacktestTimeframe,
      index: number,
      event: ReactPointerEvent<HTMLDivElement>
    ) => {
      event.preventDefault();
      event.stopPropagation();

      const fallbackPosition = getDefaultContextPanePosition(index);
      const currentPosition = contextPanePositions[timeframeToDrag] ?? fallbackPosition;

      contextPaneDragRef.current = {
        timeframe: timeframeToDrag,
        startX: event.clientX,
        startY: event.clientY,
        originX: currentPosition.x,
        originY: currentPosition.y,
      };
      setDraggingContextPane(timeframeToDrag);
    },
    [contextPaneDragRef, contextPanePositions, setDraggingContextPane]
  );

  const findDockTargetAtPoint = useCallback(
    (clientX: number, clientY: number) => {
      return (
        CONTEXT_DOCK_SLOTS.find((slot) => {
          const rect = dockTargetRefs.current[slot]?.getBoundingClientRect();
          if (!rect) return false;

          return (
            clientX >= rect.left &&
            clientX <= rect.right &&
            clientY >= rect.top &&
            clientY <= rect.bottom
          );
        }) ?? null
      );
    },
    [dockTargetRefs]
  );

  useEffect(() => {
    if (!draggingContextPane) return;

    const handlePointerMove = (event: PointerEvent) => {
      const dragState = contextPaneDragRef.current;
      if (!dragState) return;

      const nextX = dragState.originX + (event.clientX - dragState.startX);
      const nextY = dragState.originY + (event.clientY - dragState.startY);

      setContextPanePositions((previous) => {
        const currentPosition = previous[dragState.timeframe];
        if (currentPosition?.x === nextX && currentPosition?.y === nextY) {
          return previous;
        }

        return {
          ...previous,
          [dragState.timeframe]: {
            x: nextX,
            y: nextY,
          },
        };
      });

      const hoveredTarget = findDockTargetAtPoint(event.clientX, event.clientY);
      setActiveContextDockTarget((previous) =>
        previous === hoveredTarget ? previous : hoveredTarget
      );
    };

    const finishDrag = () => {
      const dragState = contextPaneDragRef.current;
      if (dragState && activeContextDockTarget) {
        assignContextToDockSlot(dragState.timeframe, activeContextDockTarget);
      }

      contextPaneDragRef.current = null;
      setDraggingContextPane(null);
      setActiveContextDockTarget(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
    };
  }, [
    activeContextDockTarget,
    assignContextToDockSlot,
    contextPaneDragRef,
    draggingContextPane,
    findDockTargetAtPoint,
    setActiveContextDockTarget,
    setContextPanePositions,
    setDraggingContextPane,
  ]);

  useEffect(() => {
    if (!draggingDockContextTimeframe) return;

    const handlePointerMove = (event: PointerEvent) => {
      const hoveredTarget = findDockTargetAtPoint(event.clientX, event.clientY);

      setActiveContextDockTarget((previous) =>
        previous === hoveredTarget ? previous : hoveredTarget
      );
    };

    const finishDrag = () => {
      const dragState = contextDockDragRef.current;
      if (dragState && activeContextDockTarget) {
        assignContextToDockSlot(dragState.timeframe, activeContextDockTarget);
      }

      contextDockDragRef.current = null;
      setDraggingDockContextTimeframe(null);
      setActiveContextDockTarget(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
    };
  }, [
    activeContextDockTarget,
    assignContextToDockSlot,
    contextDockDragRef,
    draggingDockContextTimeframe,
    findDockTargetAtPoint,
    setActiveContextDockTarget,
    setDraggingDockContextTimeframe,
  ]);

  const isDragExemptTarget = useCallback((target: EventTarget | null) => {
    return (
      target instanceof Element &&
      Boolean(
        target.closest(
          "button, input, label, select, textarea, a, [role='button'], [data-drag-exempt='true']"
        )
      )
    );
  }, []);

  const handleFavoriteToolsBarDragStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (isDragExemptTarget(event.target)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      favoriteToolsBarDragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        originX: favoriteToolsBarOffset.x,
        originY: favoriteToolsBarOffset.y,
      };
      setIsDraggingFavoriteToolsBar(true);
    },
    [
      favoriteToolsBarDragRef,
      favoriteToolsBarOffset,
      isDragExemptTarget,
      setIsDraggingFavoriteToolsBar,
    ]
  );

  const centerFavoriteToolsBar = useCallback(() => {
    setFavoriteToolsBarOffset({ ...DEFAULT_FAVORITE_TOOLS_BAR_OFFSET });
  }, [setFavoriteToolsBarOffset]);

  const isFavoriteToolsBarCentered =
    favoriteToolsBarOffset.x === DEFAULT_FAVORITE_TOOLS_BAR_OFFSET.x &&
    favoriteToolsBarOffset.y === DEFAULT_FAVORITE_TOOLS_BAR_OFFSET.y;

  useEffect(() => {
    if (!isDraggingFavoriteToolsBar) return;

    const handlePointerMove = (event: PointerEvent) => {
      const dragState = favoriteToolsBarDragRef.current;
      if (!dragState) return;

      let nextX = dragState.originX + (event.clientX - dragState.startX);
      let nextY = dragState.originY + (event.clientY - dragState.startY);
      const workspaceRect = chartWorkspaceRef.current?.getBoundingClientRect();
      const favoriteBarRect = favoriteToolsBarRef.current?.getBoundingClientRect();

      if (workspaceRect && favoriteBarRect) {
        const horizontalLimit = Math.max(
          0,
          workspaceRect.width / 2 - favoriteBarRect.width / 2 - 16
        );
        const verticalLimit = Math.max(
          0,
          workspaceRect.height - favoriteBarRect.height - 24
        );
        nextX = clamp(nextX, -horizontalLimit, horizontalLimit);
        nextY = clamp(nextY, 0, verticalLimit);
      }

      setFavoriteToolsBarOffset((previous) => {
        if (previous.x === nextX && previous.y === nextY) {
          return previous;
        }

        return {
          x: nextX,
          y: nextY,
        };
      });
    };

    const finishDrag = () => {
      favoriteToolsBarDragRef.current = null;
      setIsDraggingFavoriteToolsBar(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
    };
  }, [
    chartWorkspaceRef,
    favoriteToolsBarDragRef,
    favoriteToolsBarRef,
    isDraggingFavoriteToolsBar,
    setFavoriteToolsBarOffset,
    setIsDraggingFavoriteToolsBar,
  ]);

  return {
    contextDockedPanes,
    hasDockedContextPanes,
    showFloatingContextPanes,
    showSplitContextPanes,
    showContextDockTargets,
    toggleContextTimeframe,
    closeContextTimeframe,
    undockAllContextPanes,
    resetContextTimeframes,
    cycleContextPaneMode,
    handleContextDockDragStart,
    handleContextPanePointerDown,
    handleFavoriteToolsBarDragStart,
    centerFavoriteToolsBar,
    isFavoriteToolsBarCentered,
  };
}
