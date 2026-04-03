import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type CustomColorEditorProps = {
  title: string;
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  accent?: string;
  onAccentChange?: (value: string) => void;
  extra?: ReactNode;
  className?: string;
};

function ColorSwatch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-[11px] text-white/55">
      <span>{label}</span>
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-10 cursor-pointer rounded-sm border border-white/10 bg-transparent p-1"
      />
      <span className="font-mono text-[10px] text-white/42">{value}</span>
    </label>
  );
}

export function CustomColorEditor({
  title,
  from,
  to,
  onFromChange,
  onToChange,
  accent,
  onAccentChange,
  extra,
  className,
}: CustomColorEditorProps) {
  return (
    <div
      className={cn(
        "space-y-4 rounded-md border border-white/8 bg-white/[0.03] p-4",
        className
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-white">{title}</p>
          <p className="text-xs text-white/42">Fine tune the palette live.</p>
        </div>
        <div
          className="h-8 w-full rounded-full border border-white/10 sm:w-28"
          style={{
            background: `linear-gradient(90deg, ${from} 0%, ${to} 100%)`,
          }}
        />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
        <ColorSwatch label="From" value={from} onChange={onFromChange} />
        <ColorSwatch label="To" value={to} onChange={onToChange} />
        {accent && onAccentChange ? (
          <ColorSwatch
            label="Accent"
            value={accent}
            onChange={onAccentChange}
          />
        ) : null}
      </div>

      {extra ? <div>{extra}</div> : null}
    </div>
  );
}
