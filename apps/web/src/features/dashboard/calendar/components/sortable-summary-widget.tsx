"use client";

import type { CSSProperties, ReactNode } from "react";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type SortableSummaryWidgetProps = {
  id: string;
  disabled?: boolean;
  style?: CSSProperties;
  children: ReactNode;
};

export function SortableSummaryWidget({
  id,
  disabled,
  style,
  children,
}: SortableSummaryWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const mergedStyle: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : undefined,
    ...style,
  };

  return (
    <div
      ref={setNodeRef}
      style={mergedStyle}
      className="h-full"
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}
