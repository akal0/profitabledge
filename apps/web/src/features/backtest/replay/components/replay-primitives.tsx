"use client";

import React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[20px] border border-white/5 bg-sidebar-accent/50 p-4">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex size-9 items-center justify-center rounded-xl border border-white/5 bg-sidebar">
          <Icon className="size-4 text-white/65" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          <p className="mt-0.5 text-xs text-white/45">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function ReplayHeaderMetric({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: string;
  helper: string;
  tone: "positive" | "negative" | "neutral";
}) {
  return (
    <div className="min-w-[122px] rounded-xl border border-white/5 bg-sidebar-accent/50 px-3 py-2">
      <p className="text-[9px] uppercase tracking-[0.18em] text-white/30">{label}</p>
      <p
        className={cn(
          "mt-1 text-sm font-semibold",
          tone === "positive"
            ? "text-teal-300"
            : tone === "negative"
              ? "text-rose-300"
              : "text-white"
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[10px] text-white/45">{helper}</p>
    </div>
  );
}

export function DeskMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-[132px] rounded-xl border border-white/5 bg-sidebar-accent/50 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

export function MetricChip({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-sidebar-accent/50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">{label}</p>
      <p className="mt-1 text-sm font-medium text-white">{value}</p>
    </div>
  );
}

export function PlaybackButton({
  icon: Icon,
  label,
  onClick,
  active = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
        active
          ? "bg-teal-400 text-slate-950"
          : "text-white/60 hover:bg-sidebar hover:text-white"
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}

export function DrawingToolButton({
  icon: Icon,
  label,
  onClick,
  active,
  disabled = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  active: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={cn(
        "pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-xl transition",
        active
          ? "bg-teal-400 text-slate-950"
          : "text-white/55 hover:bg-sidebar-accent hover:text-white",
        disabled && "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-white/55"
      )}
    >
      <Icon className="size-3.5" />
    </button>
  );
}

export function ShortcutPill({
  label,
  description,
}: {
  label: string;
  description: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/5 bg-sidebar-accent/50 px-2 py-1 text-[11px] text-white/55">
      <span className="rounded-md bg-sidebar px-1.5 py-0.5 font-mono text-white/75">{label}</span>
      {description}
    </span>
  );
}

export function IndicatorBadge({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/5 bg-sidebar-accent px-2 py-1">
      <span className="text-white/35">{label}</span>
      <span className="font-medium text-white/80">{value}</span>
    </span>
  );
}

export function IndicatorToggle({
  label,
  checked,
  value,
  onToggle,
  onValueChange,
}: {
  label: string;
  checked: boolean;
  value: number;
  onToggle: (enabled: boolean) => void;
  onValueChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-sidebar-accent/50 px-3 py-2">
      <Switch checked={checked} onCheckedChange={onToggle} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white">{label}</p>
      </div>
      <Input
        type="number"
        value={value}
        onChange={(event) => onValueChange(Number(event.target.value))}
        disabled={!checked}
        className="h-8 w-20 border-white/5 bg-sidebar text-xs"
      />
    </div>
  );
}

export function RuleProgress({
  label,
  current,
  target,
  helper,
  positive = false,
}: {
  label: string;
  current: number;
  target: number;
  helper: string;
  positive?: boolean;
}) {
  const rawProgress = target > 0 ? (current / target) * 100 : positive ? 100 : 0;
  const progress = Math.min(100, Math.max(0, rawProgress));

  return (
    <div className="mb-3 rounded-xl border border-white/5 bg-sidebar-accent/50 p-3 last:mb-0">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium text-white">{label}</span>
        <span className="text-xs text-white/50">{helper}</span>
      </div>
      <Progress
        value={progress}
        className={cn(
          "h-2 bg-white/8",
          positive
            ? "[&_[data-slot=progress-indicator]]:bg-teal-400"
            : "[&_[data-slot=progress-indicator]]:bg-amber-400"
        )}
      />
    </div>
  );
}

export function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/5 bg-sidebar-accent/50 px-4 py-6 text-center text-sm text-white/45">
      {label}
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-[11px] uppercase tracking-[0.18em] text-white/35">
        {label}
      </Label>
      {children}
    </div>
  );
}
