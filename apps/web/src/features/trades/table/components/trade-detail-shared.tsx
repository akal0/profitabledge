"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export function TradeDetailSection({
  title,
  actions,
  children,
  bodyClassName,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  bodyClassName?: string;
}) {
  return (
    <>
      <Separator />
      <div className="flex items-center justify-between gap-3 px-6 py-3">
        <h3 className="text-xs font-semibold tracking-wide text-white/70">
          {title}
        </h3>
        {actions}
      </div>
      <Separator />
      <div className={cn("px-6 py-5", bodyClassName)}>{children}</div>
    </>
  );
}

export function TradeDetailSectionActions({
  canSave,
  isEditing,
  isSaving,
  onCancel,
  onEdit,
  onSave,
}: {
  canSave: boolean;
  isEditing: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onEdit: () => void;
  onSave: () => void;
}) {
  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-8 rounded-sm ring-white/8! px-3 text-[11px] text-white/70 hover:bg-sidebar-accent"
          onClick={onCancel}
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className="h-8 rounded-sm px-3 text-[11px]"
          onClick={onSave}
          disabled={!canSave || isSaving}
        >
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="h-8 rounded-sm ring-white/8! bg-transparent! px-3 text-[11px] text-white/70 hover:bg-sidebar-accent"
      onClick={onEdit}
    >
      Edit
    </Button>
  );
}

export function TradeDetailFieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-[11px] text-rose-300/90">{message}</p>;
}

export function TradeDetailStaticRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-white/50">{label}</span>
      <span className={cn("font-medium text-right", valueClassName)}>{value}</span>
    </div>
  );
}
