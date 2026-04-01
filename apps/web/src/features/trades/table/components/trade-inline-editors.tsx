"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Loader2, X } from "lucide-react";
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
  "field-sizing-content h-8 w-auto max-w-full min-w-0 rounded-sm bg-sidebar-accent! px-2 text-xs text-white/90 placeholder:text-white/25 ring ring-white/8! focus-visible:border-none! focus-visible:ring-[1px] focus-visible:ring-white/16";
const DIRECTION_BUTTON_CLASS =
  "min-h-6 cursor-pointer px-2 py-0.5 text-[10px] font-semibold";
const EDITABLE_INPUT_MIN_WIDTH_PX = 44;
const EDITABLE_INPUT_PADDING_PX = 10;

function estimateEditableInputWidth(value: string) {
  return Math.max(
    EDITABLE_INPUT_MIN_WIDTH_PX,
    Math.ceil(value.length * 7 + EDITABLE_INPUT_PADDING_PX)
  );
}

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
  isSaving?: boolean;
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
  isSaving = false,
}: EditableTradeInputCellProps<TValue>) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(() => formatForDraft(value));
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const sizerRef = React.useRef<HTMLSpanElement | null>(null);
  const [inputWidth, setInputWidth] = React.useState(() =>
    estimateEditableInputWidth(formatForDraft(value))
  );

  React.useEffect(() => {
    if (!editing) {
      setDraft(formatForDraft(value));
    }
  }, [editing, formatForDraft, value]);

  React.useLayoutEffect(() => {
    if (!editing) return;

    const nextWidth = Math.max(
      EDITABLE_INPUT_MIN_WIDTH_PX,
      Math.ceil(
        (sizerRef.current?.getBoundingClientRect().width ?? 0) +
          EDITABLE_INPUT_PADDING_PX
      )
    );

    setInputWidth((currentWidth) =>
      currentWidth === nextWidth ? currentWidth : nextWidth
    );
  }, [draft, editing]);

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

    setIsSubmitting(true);
    try {
      await onSave(parsed);
      setEditing(false);
    } finally {
      setIsSubmitting(false);
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
        className={cn(
          "relative flex w-full max-w-full min-w-0 items-center gap-1",
          align === "right" ? "justify-end" : "justify-start"
        )}
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <span
          ref={sizerRef}
          aria-hidden="true"
          className={cn(
            "pointer-events-none invisible absolute left-0 top-0 whitespace-pre px-2 text-xs",
            align === "right" ? "text-right" : "text-left"
          )}
        >
          {draft || " "}
        </span>
        <Input
          ref={inputRef}
          value={draft}
          type={inputType}
          step={step}
          placeholder={placeholder}
          disabled={isSubmitting}
          className={cn(
            EDITABLE_INPUT_CLASS,
            align === "right" ? "text-right" : "text-left"
          )}
          style={{
            width: `${inputWidth}px`,
            maxWidth: "100%",
          }}
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
        align === "right" ? "justify-end" : "justify-start",
        isSaving && "text-teal-300/80"
      )}
      title={
        activateOn === "doubleClick" ? "Double-click to edit" : "Click to edit"
      }
      onPointerDown={(event) => event.stopPropagation()}
      {...activationHandlers}
    >
      {isSaving ? <Loader2 className="mr-1 size-3 animate-spin text-teal-300" /> : null}
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
  isSaving?: boolean;
};

export function EditableTradeTextCell({
  value,
  displayValue,
  placeholder,
  onSave,
  blockedReason,
  isSaving,
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
      isSaving={isSaving}
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
  isSaving?: boolean;
};

export function EditableTradeNumberCell({
  value,
  displayValue,
  placeholder,
  nullable = false,
  onSave,
  blockedReason,
  isSaving,
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
      isSaving={isSaving}
    />
  );
}

type EditableTradeDateTimeCellProps = {
  value: string;
  displayValue: React.ReactNode;
  onSave: (value: string) => Promise<void>;
  blockedReason?: string;
  isSaving?: boolean;
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
  isSaving,
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
      isSaving={isSaving}
    />
  );
}

type EditableTradeDirectionCellProps = {
  value: "long" | "short";
  onSave: (value: InlineTradeUpdateInput["tradeType"]) => Promise<void>;
  blockedReason?: string;
  isSaving?: boolean;
};

export function EditableTradeDirectionCell({
  value,
  onSave,
  blockedReason,
  isSaving = false,
}: EditableTradeDirectionCellProps) {
  const [editing, setEditing] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
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

      setIsSubmitting(true);
      try {
        await onSave(nextValue);
        setEditing(false);
      } finally {
        setIsSubmitting(false);
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
          disabled={isSubmitting}
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
          disabled={isSubmitting}
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
          disabled={isSubmitting}
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
      {isSaving ? <Loader2 className="mr-1 size-3 animate-spin text-teal-300" /> : null}
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
