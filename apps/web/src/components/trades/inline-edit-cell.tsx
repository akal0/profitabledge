"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Check, X, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InlineEditCellProps {
  value: string | null | undefined;
  onSave: (newValue: string) => Promise<void>;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
}

export function InlineEditCell({
  value,
  onSave,
  placeholder = "Click to edit",
  className,
  multiline = false,
}: InlineEditCellProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(value || "");
  const [isSaving, setIsSaving] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (isEditing) {
      if (multiline) {
        textareaRef.current?.focus();
        textareaRef.current?.select();
      } else {
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
  }, [isEditing, multiline]);

  const handleSave = async () => {
    if (editValue === (value || "")) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      await onSave(editValue);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value || "");
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (!isEditing) {
    return (
      <div
        className={cn(
          "group relative flex items-center gap-2 cursor-pointer hover:bg-white/5 px-2 py-1 rounded-xs transition-colors",
          className
        )}
        onClick={() => setIsEditing(true)}
      >
        <span className={cn("text-sm", !value && "text-white/40")}>
          {value || placeholder}
        </span>
        <Pencil className="size-3 opacity-0 group-hover:opacity-40 transition-opacity" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {multiline ? (
        <textarea
          ref={textareaRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          className={cn(
            "flex-1 min-h-[60px] w-full rounded-xs border border-white/10 bg-sidebar-accent px-2 py-1 text-sm text-white resize-none",
            "focus:outline-none focus:ring-1 focus:ring-teal-500/50",
            isSaving && "opacity-50 cursor-not-allowed",
            className
          )}
          rows={3}
        />
      ) : (
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          className={cn(
            "h-8 text-sm",
            isSaving && "opacity-50 cursor-not-allowed",
            className
          )}
        />
      )}
      <Button
        size="sm"
        variant="ghost"
        className="h-8 w-8 p-0 hover:bg-teal-500/20"
        onClick={handleSave}
        disabled={isSaving}
      >
        <Check className="h-4 w-4 text-teal-400" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-8 w-8 p-0 hover:bg-rose-500/20"
        onClick={handleCancel}
        disabled={isSaving}
      >
        <X className="h-4 w-4 text-rose-400" />
      </Button>
    </div>
  );
}
