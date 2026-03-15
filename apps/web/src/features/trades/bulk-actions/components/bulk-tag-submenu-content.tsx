"use client";

import Color from "color";
import { CheckCircle2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ColorPicker,
  ColorPickerFormat,
  ColorPickerHue,
  ColorPickerOutput,
  ColorPickerSelection,
} from "@/components/ui/color-picker";
import { DropdownMenuSubContent } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import { bulkActionsStyles } from "../lib/bulk-actions-styles";
import type { BulkTagEditorProps } from "../lib/bulk-actions-types";

export function BulkTagSubmenuContent({
  title,
  inputId,
  inputLabel,
  placeholder,
  existingLabel,
  tagName,
  tagColor,
  showColorPicker,
  defaultColors,
  existingTags,
  selectedCount,
  isPending,
  onTagNameChange,
  onTagColorChange,
  onShowColorPickerChange,
  onApply,
}: BulkTagEditorProps) {
  return (
    <DropdownMenuSubContent
      className={cn(bulkActionsStyles.submenuPanelClass, "w-[390px] p-0")}
      onKeyDownCapture={(event) => event.stopPropagation()}
    >
      <div className={bulkActionsStyles.menuSectionClass}>
        <div className="space-y-0.5">
          <div className="text-xs font-medium text-white/45">{title}</div>
          <p className="text-xs text-white/60">
            Apply a shared tag to {selectedCount} selected trades.
          </p>
        </div>
      </div>

      <Separator className={bulkActionsStyles.menuSubSeparatorClass} />

      <div className={bulkActionsStyles.menuSectionClass}>
        <div className="space-y-3">
          <Label htmlFor={inputId} className="text-xs text-white/70">
            {inputLabel}
          </Label>

          <Input
            id={inputId}
            placeholder={placeholder}
            value={tagName}
            className={bulkActionsStyles.inputClass}
            onChange={(event) => onTagNameChange(event.target.value)}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Enter") {
                event.preventDefault();
                onApply();
              }
            }}
          />
        </div>
      </div>

      {existingTags && existingTags.length > 0 ? (
        <>
          <Separator className={bulkActionsStyles.menuSubSeparatorClass} />
          <div className={bulkActionsStyles.menuSectionClass}>
            <Label className="text-xs text-white/70">{existingLabel}</Label>
            <div className="flex flex-wrap gap-2">
              {existingTags.map((tag) => {
                const isActive =
                  tag.name.toLowerCase() === tagName.trim().toLowerCase();

                return (
                  <button
                    key={tag.name}
                    type="button"
                    className={cn(
                      bulkActionsStyles.tagChipClass,
                      isActive && bulkActionsStyles.tagChipActiveClass
                    )}
                    onClick={() => {
                      onTagNameChange(tag.name);
                      onTagColorChange(tag.color);
                      onShowColorPickerChange(false);
                    }}
                  >
                    <span
                      className={bulkActionsStyles.colorSwatchClass}
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : null}

      <Separator className={bulkActionsStyles.menuSubSeparatorClass} />

      <div className={bulkActionsStyles.menuSectionClass}>
        <div className="space-y-3">
          <Label className="text-xs text-white/70">Color</Label>
          <div className="flex flex-wrap gap-2">
            {defaultColors.map((color, index) => (
              <button
                key={`${color}-${index}`}
                type="button"
                className={cn(
                  bulkActionsStyles.colorButtonBaseClass,
                  tagColor === color
                    ? bulkActionsStyles.colorButtonActiveClass
                    : bulkActionsStyles.colorButtonInactiveClass
                )}
                style={{ backgroundColor: color }}
                onClick={() => {
                  onTagColorChange(color);
                  onShowColorPickerChange(false);
                }}
              />
            ))}
            <button
              type="button"
              className={cn(
                bulkActionsStyles.colorCustomButtonClass,
                showColorPicker &&
                  "border-white/15 bg-sidebar-accent/80 text-white"
              )}
              onClick={() => onShowColorPickerChange(!showColorPicker)}
            >
              <Plus size={16} />
            </button>
          </div>

          {showColorPicker ? (
            <div
              className={cn("mt-4 space-y-3 p-3", bulkActionsStyles.panelClass)}
            >
              <ColorPicker
                value={tagColor}
                onChange={(rgba) => {
                  if (!Array.isArray(rgba)) return;
                  const [r, g, b] = rgba;
                  onTagColorChange(Color.rgb(r, g, b).hex());
                }}
              >
                <div className="space-y-3">
                  <ColorPickerSelection className="h-32 w-full" />
                  <ColorPickerHue />
                  <div className="flex items-center gap-2">
                    <ColorPickerFormat className="flex-1" />
                    <ColorPickerOutput />
                  </div>
                </div>
              </ColorPicker>
            </div>
          ) : null}
        </div>
      </div>

      <Separator className={bulkActionsStyles.menuSubSeparatorClass} />

      <div className="px-4 py-4">
        <Button
          size="sm"
          onClick={onApply}
          disabled={isPending}
          className={cn("w-full", bulkActionsStyles.primaryActionButtonClass)}
        >
          {isPending ? (
            "Applying..."
          ) : (
            <>
              <CheckCircle2 className="size-3.5" />
              Apply to {selectedCount}
            </>
          )}
        </Button>
      </div>
    </DropdownMenuSubContent>
  );
}
