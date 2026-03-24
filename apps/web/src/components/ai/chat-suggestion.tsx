"use client";

import { ReactRenderer } from "@tiptap/react";
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import type { SuggestionItem } from "./types";
import { ChevronRight } from "lucide-react";

interface SuggestionListProps {
  items: SuggestionItem[];
  command: (item: { id: string; label: string; type: string }) => void;
}

function groupItemsByType(items: SuggestionItem[]) {
  const groups: Record<string, SuggestionItem[]> = {};

  for (const item of items) {
    const groupKey = item.category || item.type;
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(item);
  }

  return groups;
}

const typeLabels: Record<string, string> = {
  session: "Session tags",
  symbol: "Symbols",
  model: "Models",
  Core: "Core",
  Tags: "Tags",
  Outcome: "Outcome",
  Protocol: "Protocol alignment",
  Direction: "Trade direction",
  Overview: "Overview",
  Assets: "Assets",
  Activity: "Activity",
  Sessions: "Sessions",
  Costs: "Costs",
  Models: "Models",
  Execution: "Execution",
  Opportunity: "Opportunity",
  Efficiency: "Efficiency",
  Risk: "Risk",
  Timing: "Timing",
  Intent: "Intent",
  Temporal: "Temporal",
  States: "States",
  Persona: "Persona",
  Intersections: "Intersections",
  Journal: "Journal",
  Prop: "Prop",
  Coaching: "Coaching",
  metric: "Metrics",
  filter: "Filters",
};

const typeDescriptions: Record<string, string> = {
  session: "Filter by your saved session tags",
  symbol: "Filter by traded symbols",
  model: "Filter by model or strategy tags",
  Outcome: "Filter by trade outcome",
  Protocol: "Filter by protocol alignment",
  Direction: "Filter by trade direction",
  Overview: "Quick performance overviews",
  Assets: "Asset and symbol performance",
  Activity: "Recent trading activity",
  Sessions: "Session-based performance",
  Costs: "Commissions, swap, and cost breakdowns",
  Models: "Model and protocol performance",
  Execution: "Execution quality metrics",
  Opportunity: "MFE/MAE and missed opportunity metrics",
  Efficiency: "Capture and efficiency metrics",
  Risk: "Risk and drawdown metrics",
  Timing: "Time-based performance views",
  Temporal: "Pre/post cohort comparisons",
  States: "Hidden state clustering",
  Persona: "Longitudinal persona tracking",
  Intersections: "Cross-column and combo analysis",
  Journal: "Journal reflections and recurring themes",
  Prop: "Prop-firm survival and rule headroom",
  Coaching: "Action-oriented coaching prompts",
  Intent: "Common intent patterns",
};

const typeOrder = [
  "session",
  "symbol",
  "model",
  "Overview",
  "Assets",
  "Activity",
  "Sessions",
  "Costs",
  "Models",
  "Outcome",
  "Protocol",
  "Direction",
  "Temporal",
  "States",
  "Persona",
  "Intersections",
  "Journal",
  "Prop",
  "Coaching",
  "Intent",
  "Core",
  "Tags",
  "Execution",
  "Opportunity",
  "Efficiency",
  "Risk",
  "Timing",
];

export const ChatSuggestionList = forwardRef<
  { onKeyDown: (props: { event: KeyboardEvent }) => boolean },
  SuggestionListProps
>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const shouldGroup = props.items.some(
    (item) => Boolean(item.category) || item.type === "session"
  );
  const groupedItems = useMemo(
    () => (shouldGroup ? groupItemsByType(props.items) : null),
    [props.items, shouldGroup]
  );
  const sortedGroups = useMemo(
    () =>
      groupedItems
        ? typeOrder.filter((type) => groupedItems[type]?.length > 0)
        : [],
    [groupedItems]
  );
  const activeItems = useMemo(
    () =>
      expandedType && groupedItems ? groupedItems[expandedType] || [] : props.items,
    [expandedType, groupedItems, props.items]
  );

  useEffect(() => {
    setSelectedIndex(0);
    setExpandedType(null);
  }, [props.items]);

  useEffect(() => {
    const selectedElement = itemRefs.current[selectedIndex];
    if (selectedElement && containerRef.current) {
      selectedElement.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex]);

  const selectItem = useCallback(
    (index: number) => {
      const item = activeItems[index];
      if (!item) return;

      props.command({
        id: item.id,
        label: item.name,
        type: item.type,
      });
    },
    [activeItems, props]
  );

  const upHandler = useCallback(() => {
    setSelectedIndex((selectedIndex + activeItems.length - 1) % activeItems.length);
  }, [activeItems.length, selectedIndex]);

  const downHandler = useCallback(() => {
    setSelectedIndex((selectedIndex + 1) % activeItems.length);
  }, [activeItems.length, selectedIndex]);

  const enterHandler = useCallback(() => {
    if (shouldGroup && !expandedType) {
      const type = sortedGroups[selectedIndex];
      if (type) {
        setExpandedType(type);
        setSelectedIndex(0);
      }
    } else {
      selectItem(selectedIndex);
    }
  }, [selectItem, selectedIndex, shouldGroup, expandedType, sortedGroups]);

  const escapeHandler = useCallback(() => {
    if (expandedType) {
      setExpandedType(null);
      setSelectedIndex(sortedGroups.indexOf(expandedType) || 0);
      return true;
    }
    return false;
  }, [expandedType, sortedGroups]);

  useImperativeHandle(
    ref,
    () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === "ArrowUp") {
          upHandler();
          return true;
        }

        if (event.key === "ArrowDown") {
          downHandler();
          return true;
        }

        if (event.key === "Enter" || event.key === "Tab") {
          enterHandler();
          return true;
        }

        if (event.key === "Escape" || event.key === "ArrowLeft") {
          if (escapeHandler()) {
            event.preventDefault();
            return true;
          }
        }

        if (event.key === "ArrowRight" && shouldGroup && !expandedType) {
          enterHandler();
          return true;
        }

        return false;
      },
    }),
    [upHandler, downHandler, enterHandler, escapeHandler, shouldGroup, expandedType]
  );

  if (props.items.length === 0) {
    return null;
  }

  if (shouldGroup && groupedItems && !expandedType) {
    return (
      <div className="z-50 w-max whitespace-nowrap overflow-hidden rounded-md border border-white/10 bg-sidebar text-white shadow-lg pointer-events-auto">
        <div ref={containerRef} className="max-h-[260px] overflow-y-auto p-1">
          {sortedGroups.map((type, index) => (
            <button
              key={type}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              type="button"
              className={cn(
                "flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm outline-none",
                index === selectedIndex
                  ? "bg-sidebar-accent text-white"
                  : "hover:bg-sidebar-accent/70"
              )}
              title={typeDescriptions[type] || typeLabels[type] || type}
              onClick={() => {
                setExpandedType(type);
                setSelectedIndex(0);
              }}
            >
              <span className="flex items-center gap-2">
                <span className="font-medium w-max whitespace-nowrap">
                  {typeLabels[type] || type}
                </span>
                <span className="text-xs text-white/50">
                  ({groupedItems[type].length})
                </span>
              </span>
              <ChevronRight className="h-4 w-4 text-white/50" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  const items = expandedType && groupedItems
    ? groupedItems[expandedType] || []
    : props.items;

  return (
    <div className="z-50 w-max whitespace-nowrap overflow-hidden rounded-md border border-white/10 bg-sidebar text-white shadow-lg pointer-events-auto">
      {expandedType && (
        <div className="border-b border-white/10 px-2 py-1.5">
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-white/60 hover:text-white w-max"
            onClick={() => {
              setExpandedType(null);
              setSelectedIndex(sortedGroups.indexOf(expandedType) || 0);
            }}
          >
            ← {typeLabels[expandedType] || expandedType}
          </button>
        </div>
      )}
      <div ref={containerRef} className="max-h-[260px] overflow-y-auto p-1">
        {items.map((item, index) => (
          <button
            key={item.id}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            type="button"
            className={cn(
              "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none",
              index === selectedIndex
                ? "bg-sidebar-accent text-white"
                : "hover:bg-sidebar-accent/70"
            )}
            onClick={() => selectItem(index)}
          >
            {!expandedType && (
              <span className="text-[10px] text-white/50 uppercase w-16">
                {item.type}
              </span>
            )}
            <span className="w-max whitespace-nowrap">{item.name}</span>
            {item.description && (
              <span className="ml-auto text-xs text-white/40 w-max whitespace-nowrap">
                {item.description}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
});

ChatSuggestionList.displayName = "ChatSuggestionList";

export const createChatSuggestion = (
  fetchItems: (query: string) => Promise<SuggestionItem[]>,
  activeRef?: React.MutableRefObject<boolean>
) => ({
  items: async ({ query }: { query: string }) => {
    return await fetchItems(query);
  },

  render: () => {
    let component: ReactRenderer<any>;
    let popup: HTMLDivElement | null = null;

    return {
      onStart: (props: any) => {
        if (activeRef) activeRef.current = true;

        component = new ReactRenderer(ChatSuggestionList, {
          props,
          editor: props.editor,
        });

        if (!props.clientRect) {
          return;
        }

        popup = document.createElement("div");
        popup.style.position = "fixed";
        popup.style.zIndex = "9999";
        popup.style.maxWidth = "720px";
        document.body.appendChild(popup);
        popup.appendChild(component.element);

        const rect = props.clientRect();
        if (rect) {
          positionPopup(popup, rect);
        }
      },

      onUpdate(props: any) {
        component.updateProps(props);

        if (!props.clientRect || !popup) {
          return;
        }

        const rect = props.clientRect();
        if (rect) {
          positionPopup(popup, rect);
        }
      },

      onKeyDown(props: any) {
        if (props.event.key === "Escape") {
          const handled = component.ref?.onKeyDown(props);
          if (handled) return true;

          if (popup) {
            popup.remove();
          }
          return true;
        }

        return component.ref?.onKeyDown(props) || false;
      },

      onExit() {
        if (activeRef) activeRef.current = false;

        if (popup) {
          popup.remove();
        }
        component.destroy();
      },
    };
  },
});

function positionPopup(popup: HTMLDivElement, rect: DOMRect) {
  const gap = 8;
  const popupRect = popup.getBoundingClientRect();
  const popupHeight = popupRect.height || 220;
  const popupWidth = popupRect.width || 260;
  const spaceBelow = window.innerHeight - rect.bottom - gap;
  const spaceAbove = rect.top - gap;
  const placeAbove = spaceBelow < popupHeight && spaceAbove > spaceBelow;
  const top = placeAbove ? rect.top - popupHeight - gap : rect.bottom + gap;
  const maxLeft = window.innerWidth - popupWidth - gap;
  popup.style.top = `${Math.max(gap, top)}px`;
  popup.style.left = `${Math.max(gap, Math.min(rect.left, maxLeft))}px`;
}
