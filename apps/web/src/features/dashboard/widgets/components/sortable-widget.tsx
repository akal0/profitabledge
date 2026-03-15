"use client";

import type React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export function SortableWidget({
  id,
  disabled,
  children,
  style: itemStyle,
}: {
  id: string;
  disabled?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, ...itemStyle }}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}
