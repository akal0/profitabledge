"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, X } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import {
  TRADE_IDENTIFIER_PILL_CLASS,
  TRADE_IDENTIFIER_TONES,
} from "@/components/trades/trade-identifier-pill";
import { cn } from "@/lib/utils";
import type { InlineTradeUpdateInput } from "@/features/trades/table/lib/trade-table-types";

const INVALID_VALUE = Symbol("INVALID_VALUE");
const LIVE_TRADE_EDIT_BLOCK_MESSAGE = "You can't edit a live trade.";

const EDITABLE_DISPLAY_CLASS =
  "max-w-full cursor-text rounded-sm px-1.5 py-1 text-left transition-colors hover:bg-white/[0.05]";
const EDITABLE_INPUT_CLASS =
  "h-8 w-full max-w-full min-w-0 rounded-sm bg-sidebar-accent! px-2 text-xs text-white/90 placeholder:text-white/25 ring ring-white/8! focus-visible:border-none! focus-visible:ring-[1px] focus-visible:ring-white/16";
const DIRECTION_BUTTON_CLASS =
  "min-h-6 cursor-pointer px-2 py-0.5 text-[10px] font-semibold";

type EditableTradeInputCellProps<TValue> = {
  value: TValue;
  displayValue: React.ReactNode;
  formatForDraft: (value: TValue) => string;
  parseDraft: (draft: string) => TValue | typeof INVALID_VALUE;
  onSave: (value: TValue) => Promise<void>;
  areEqual?: (next: TValue, current: TValue) => boolean;
  placeholder?: string;
  inputType?: "text" | "number" | "datetime-local";
  step?: string;
  activateOn?: "click" | "doubleClick";
  align?: "left" | "right";
  blockedReason?: string;
};

function useEditableCellActivation(
  activateOn: "click" | "doubleClick",
  onActivate: () => void
) {
  return React.useMemo(
    () =>
      activateOn === "doubleClick"
        ? {
            onClick: (event: React.MouseEvent) => {
              event.preventDefault();
              event.stopPropagation();
            },
            onDoubleClick: (event: React.MouseEvent) => {
              event.preventDefault();
              event.stopPropagation();
              onActivate();
            },
          }
        : {
            onClick: (event: React.MouseEvent) => {
              event.preventDefault();
              event.stopPropagation();
              onActivate();
            },
          },
    [activateOn, onActivate]
  );
}

function EditableTradeInputCell<TValue>({
  value,
  displayValue,
  formatForDraft,
  parseDraft,
  onSave,
  areEqual = Object.is,
  placeholder,
  inputType = "text",
  step,
  activateOn = "click",
  align = "left",
  blockedReason,
}: EditableTradeInputCellProps<TValue>) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(() => formatForDraft(value));
  const [isSaving, setIsSaving] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (!editing) {
      setDraft(formatForDraft(value));
    }
  }, [editing, formatForDraft, value]);

  React.useEffect(() => {
    if (!editing) return;

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [editing]);

  const closeEditor = React.useCallback(() => {
    setDraft(formatForDraft(value));
    setEditing(false);
  }, [formatForDraft, value]);

  const handleSave = React.useCallback(async () => {
    const parsed = parseDraft(draft);
    if (parsed === INVALID_VALUE) {
      toast.error("Enter a valid value.");
      closeEditor();
      return;
    }

    if (areEqual(parsed, value)) {
      setEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(parsed);
      setEditing(false);
    } finally {
      setIsSaving(false);
    }
  }, [areEqual, closeEditor, draft, onSave, parseDraft, value]);

  const activationHandlers = useEditableCellActivation(activateOn, () => {
    if (blockedReason) {
      toast.error(blockedReason);
      return;
    }

    setDraft(formatForDraft(value));
    setEditing(true);
  });

  if (editing) {
    return (
      <div
        data-cell-interactive="true"
        className="flex w-full max-w-full min-w-0 items-center gap-1"
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <Input
          ref={inputRef}
          value={draft}
          type={inputType}
          step={step}
          placeholder={placeholder}
          disabled={isSaving}
          className={cn(
            EDITABLE_INPUT_CLASS,
            align === "right" ? "text-right" : "text-left"
          )}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => void handleSave()}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void handleSave();
            }

            if (event.key === "Escape") {
              event.preventDefault();
              closeEditor();
            }
          }}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      data-cell-interactive="true"
      className={cn(
        "inline-flex max-w-full min-w-0 items-center overflow-hidden",
        EDITABLE_DISPLAY_CLASS,
        align === "right" ? "justify-end" : "justify-start"
      )}
      title={
        activateOn === "doubleClick" ? "Double-click to edit" : "Click to edit"
      }
      onPointerDown={(event) => event.stopPropagation()}
      {...activationHandlers}
    >
      {displayValue}
    </button>
  );
}

type EditableTradeTextCellProps = {
  value: string | null | undefined;
  displayValue?: React.ReactNode;
  placeholder?: string;
  onSave: (value: string) => Promise<void>;
  blockedReason?: string;
};

export function EditableTradeTextCell({
  value,
  displayValue,
  placeholder,
  onSave,
  blockedReason,
}: EditableTradeTextCellProps) {
  const currentValue = value ?? "";

  return (
    <EditableTradeInputCell
      value={currentValue}
      displayValue={displayValue ?? (currentValue || "—")}
      placeholder={placeholder}
      formatForDraft={(next) => next}
      parseDraft={(draft) => {
        const trimmed = draft.trim();
        return trimmed ? trimmed : INVALID_VALUE;
      }}
      areEqual={(next, current) => next.trim() === current.trim()}
      onSave={onSave}
      blockedReason={blockedReason}
    />
  );
}

type EditableTradeNumberCellProps = {
  value: number | null | undefined;
  displayValue: React.ReactNode;
  placeholder?: string;
  nullable?: boolean;
  onSave: (value: number | null) => Promise<void>;
  blockedReason?: string;
};

export function EditableTradeNumberCell({
  value,
  displayValue,
  placeholder,
  nullable = false,
  onSave,
  blockedReason,
}: EditableTradeNumberCellProps) {
  const currentValue = value ?? null;

  return (
    <EditableTradeInputCell
      value={currentValue}
      displayValue={displayValue}
      placeholder={placeholder}
      inputType="number"
      step="any"
      align="right"
      formatForDraft={(next) => (next == null ? "" : String(next))}
      parseDraft={(draft) => {
        const trimmed = draft.trim();
        if (!trimmed) {
          return nullable ? null : INVALID_VALUE;
        }

        const numericValue = Number(trimmed);
        return Number.isFinite(numericValue) ? numericValue : INVALID_VALUE;
      }}
      areEqual={(next, current) => next === current}
      onSave={onSave}
      blockedReason={blockedReason}
    />
  );
}

type EditableTradeDateTimeCellProps = {
  value: string;
  displayValue: React.ReactNode;
  onSave: (value: string) => Promise<void>;
  blockedReason?: string;
};

function formatDateTimeLocalValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const offsetMilliseconds = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMilliseconds)
    .toISOString()
    .slice(0, 16);
}

export function EditableTradeDateTimeCell({
  value,
  displayValue,
  onSave,
  blockedReason,
}: EditableTradeDateTimeCellProps) {
  return (
    <EditableTradeInputCell
      value={value}
      displayValue={displayValue}
      inputType="datetime-local"
      formatForDraft={formatDateTimeLocalValue}
      parseDraft={(draft) => {
        const trimmed = draft.trim();
        if (!trimmed) return INVALID_VALUE;

        const date = new Date(trimmed);
        return Number.isNaN(date.getTime())
          ? INVALID_VALUE
          : date.toISOString();
      }}
      areEqual={(next, current) => next === current}
      onSave={onSave}
      blockedReason={blockedReason}
    />
  );
}

type EditableTradeDirectionCellProps = {
  value: "long" | "short";
  onSave: (value: InlineTradeUpdateInput["tradeType"]) => Promise<void>;
  blockedReason?: string;
};

export function EditableTradeDirectionCell({
  value,
  onSave,
  blockedReason,
}: EditableTradeDirectionCellProps) {
  const [editing, setEditing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!editing) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setEditing(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [editing]);

  const saveDirection = React.useCallback(
    async (nextValue: InlineTradeUpdateInput["tradeType"]) => {
      if (!nextValue || nextValue === value) {
        setEditing(false);
        return;
      }

      setIsSaving(true);
      try {
        await onSave(nextValue);
        setEditing(false);
      } finally {
        setIsSaving(false);
      }
    },
    [onSave, value]
  );

  const tone =
    value === "long"
      ? TRADE_IDENTIFIER_TONES.positive
      : TRADE_IDENTIFIER_TONES.negative;

  if (editing) {
    return (
      <div
        ref={containerRef}
        data-cell-interactive="true"
        className="inline-flex items-center gap-1 rounded-sm border border-white/8 bg-black/20 p-1"
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          disabled={isSaving}
          className={cn(
            TRADE_IDENTIFIER_PILL_CLASS,
            DIRECTION_BUTTON_CLASS,
            value === "long"
              ? TRADE_IDENTIFIER_TONES.positive
              : "ring-white/8 bg-white/[0.03] text-white/65 hover:bg-white/[0.06]"
          )}
          onClick={() => void saveDirection("long")}
        >
          Long
        </button>
        <button
          type="button"
          disabled={isSaving}
          className={cn(
            TRADE_IDENTIFIER_PILL_CLASS,
            DIRECTION_BUTTON_CLASS,
            value === "short"
              ? TRADE_IDENTIFIER_TONES.negative
              : "ring-white/8 bg-white/[0.03] text-white/65 hover:bg-white/[0.06]"
          )}
          onClick={() => void saveDirection("short")}
        >
          Short
        </button>
        <button
          type="button"
          disabled={isSaving}
          className="rounded-sm p-1 text-white/45 transition-colors hover:bg-white/[0.05] hover:text-white/80"
          onClick={() => setEditing(false)}
        >
          <X className="size-3" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      data-cell-interactive="true"
      className="inline-flex items-center rounded-sm p-1 transition-colors hover:bg-white/[0.05]"
      title="Double-click to edit"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (blockedReason) {
          toast.error(blockedReason);
          return;
        }
        setEditing(true);
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <span className={cn(TRADE_IDENTIFIER_PILL_CLASS, "gap-1 pr-2", tone)}>
        {value === "long" ? "Long" : "Short"}
        {value === "long" ? (
          <ArrowUpRight className="size-3 stroke-3" />
        ) : (
          <ArrowDownRight className="size-3 stroke-3" />
        )}
      </span>
    </button>
  );
}

export { LIVE_TRADE_EDIT_BLOCK_MESSAGE };
