"use client";

import React from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { PsychologySnapshot } from "@/components/journal/types";
import { cn } from "@/lib/utils";

interface PsychologyTrackerProps {
  value: PsychologySnapshot;
  onChange: (value: PsychologySnapshot) => void;
  className?: string;
}

interface SliderFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  lowLabel: string;
  highLabel: string;
  tone?: "teal" | "rose" | "amber";
}

function SliderField({
  label,
  value,
  onChange,
  lowLabel,
  highLabel,
  tone = "teal",
}: SliderFieldProps) {
  const toneClasses = {
    teal:
      "[&_[data-slot=slider-range]]:bg-teal-400/80 [&_[data-slot=slider-thumb]]:border-teal-400/35 [&_[data-slot=slider-thumb]]:bg-sidebar-accent",
    rose:
      "[&_[data-slot=slider-range]]:bg-rose-400/80 [&_[data-slot=slider-thumb]]:border-rose-400/35 [&_[data-slot=slider-thumb]]:bg-sidebar-accent",
    amber:
      "[&_[data-slot=slider-range]]:bg-amber-300/80 [&_[data-slot=slider-thumb]]:border-amber-300/35 [&_[data-slot=slider-thumb]]:bg-sidebar-accent",
  } satisfies Record<NonNullable<SliderFieldProps["tone"]>, string>;

  return (
    <div className="rounded-sm border border-white/5 bg-sidebar/45 px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-xs font-medium text-white/52">
          {label}
        </Label>
        <span className="rounded-full border border-white/8 bg-sidebar-accent px-2.5 py-1 text-[11px] font-medium text-white/72">
          {value}/10
        </span>
      </div>
      <div className="mt-3 grid grid-cols-[minmax(0,64px)_1fr_minmax(0,64px)] items-center gap-3">
        <span className="text-[10px] text-white/32">{lowLabel}</span>
        <Slider
          min={1}
          max={10}
          step={1}
          value={[value]}
          onValueChange={(values) => onChange(values[0] ?? value)}
          className={cn(
            "[&_[data-slot=slider-track]]:h-2 [&_[data-slot=slider-track]]:rounded-full [&_[data-slot=slider-track]]:bg-white/8 [&_[data-slot=slider-thumb]]:size-4 [&_[data-slot=slider-thumb]]:rounded-full [&_[data-slot=slider-thumb]]:shadow-none [&_[data-slot=slider-thumb]]:ring-0 [&_[data-slot=slider-thumb]]:hover:ring-4 [&_[data-slot=slider-thumb]]:hover:ring-white/8 [&_[data-slot=slider-thumb]]:focus-visible:ring-4 [&_[data-slot=slider-thumb]]:focus-visible:ring-white/8 [&_[data-slot=slider-thumb]]:transition-colors",
            toneClasses[tone]
          )}
        />
        <span className="text-right text-[10px] text-white/32">{highLabel}</span>
      </div>
    </div>
  );
}

export function PsychologyTracker({
  value,
  onChange,
  className,
}: PsychologyTrackerProps) {
  const updateField = <K extends keyof PsychologySnapshot>(
    field: K,
    fieldValue: PsychologySnapshot[K]
  ) => {
    onChange({ ...value, [field]: fieldValue });
  };

  const emotionalStates: PsychologySnapshot["emotionalState"][] = [
    "calm",
    "confident",
    "neutral",
    "excited",
    "anxious",
    "stressed",
    "frustrated",
    "angry",
    "confused",
    "discouraged",
    "overwhelmed",
    "regretful",
    "impatient",
  ];

  const marketConditions: PsychologySnapshot["marketCondition"][] = [
    "trending",
    "ranging",
    "volatile",
    "quiet",
    "unsure",
  ];

  const environments: PsychologySnapshot["tradingEnvironment"][] = [
    "home",
    "office",
    "traveling",
    "mobile",
  ];

  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid gap-3 xl:grid-cols-2">
        <SliderField
          label="Mood"
          value={value.mood}
          onChange={(nextValue) => updateField("mood", nextValue)}
          lowLabel="Low"
          highLabel="High"
          tone="teal"
        />
        <SliderField
          label="Confidence"
          value={value.confidence}
          onChange={(nextValue) => updateField("confidence", nextValue)}
          lowLabel="Doubt"
          highLabel="Certain"
          tone="teal"
        />
        <SliderField
          label="Energy"
          value={value.energy}
          onChange={(nextValue) => updateField("energy", nextValue)}
          lowLabel="Flat"
          highLabel="Sharp"
          tone="teal"
        />
        <SliderField
          label="Focus"
          value={value.focus}
          onChange={(nextValue) => updateField("focus", nextValue)}
          lowLabel="Scattered"
          highLabel="Locked in"
          tone="teal"
        />
        <SliderField
          label="Fear"
          value={value.fear}
          onChange={(nextValue) => updateField("fear", nextValue)}
          lowLabel="Calm"
          highLabel="High"
          tone="rose"
        />
        <SliderField
          label="Greed / FOMO"
          value={value.greed}
          onChange={(nextValue) => updateField("greed", nextValue)}
          lowLabel="Patient"
          highLabel="Impulsive"
          tone="amber"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-sm border border-white/5 bg-sidebar/45 p-3">
          <Label className="text-xs font-medium text-white/52">
            Emotional state
          </Label>
          <Select
            value={value.emotionalState}
            onValueChange={(nextValue) =>
              updateField(
                "emotionalState",
                nextValue as PsychologySnapshot["emotionalState"]
              )
            }
          >
            <SelectTrigger className="mt-2 h-10 w-full">
              <SelectValue placeholder="Select state" />
            </SelectTrigger>
            <SelectContent>
              {emotionalStates.map((state) => (
                <SelectItem key={state} value={state}>
                  <span className="capitalize">{state}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-sm border border-white/5 bg-sidebar/45 p-3">
          <Label className="text-xs font-medium text-white/52">
            Market condition
          </Label>
          <Select
            value={value.marketCondition || ""}
            onValueChange={(nextValue) =>
              updateField(
                "marketCondition",
                (nextValue || undefined) as PsychologySnapshot["marketCondition"]
              )
            }
          >
            <SelectTrigger className="mt-2 h-10 w-full">
              <SelectValue placeholder="Select condition" />
            </SelectTrigger>
            <SelectContent>
              {marketConditions.map((condition) => (
                <SelectItem key={condition} value={condition || "unsure"}>
                  <span className="capitalize">{condition}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-sm border border-white/5 bg-sidebar/45 p-3">
          <Label className="text-xs font-medium text-white/52">
            Environment
          </Label>
          <Select
            value={value.tradingEnvironment || ""}
            onValueChange={(nextValue) =>
              updateField(
                "tradingEnvironment",
                (nextValue || undefined) as PsychologySnapshot["tradingEnvironment"]
              )
            }
          >
            <SelectTrigger className="mt-2 h-10 w-full">
              <SelectValue placeholder="Select environment" />
            </SelectTrigger>
            <SelectContent>
              {environments.map((environment) => (
                <SelectItem key={environment} value={environment || "home"}>
                  <span className="capitalize">{environment}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <SliderField
          label="Sleep quality"
          value={value.sleepQuality || 5}
          onChange={(nextValue) => updateField("sleepQuality", nextValue)}
          lowLabel="Poor"
          highLabel="Great"
          tone="teal"
        />
      </div>

      <div className="flex items-center justify-between rounded-sm border border-white/5 bg-sidebar/45 px-3 py-3">
        <div className="space-y-1">
          <Label className="text-xs font-medium text-white/52">
            Distractions
          </Label>
          <p className="text-[11px] text-white/34">
            Note whether anything external affected your focus.
          </p>
        </div>
        <Switch
          checked={value.distractions || false}
          onCheckedChange={(nextValue) => updateField("distractions", nextValue)}
        />
      </div>

      <div className="rounded-sm border border-white/5 bg-sidebar/45 p-3">
        <Label className="text-xs font-medium text-white/52">
          Mental state notes
        </Label>
        <Textarea
          value={value.notes || ""}
          onChange={(event) => updateField("notes", event.target.value)}
          placeholder="Capture anything specific about your mental state here..."
          className="mt-2 min-h-[96px] resize-none border-white/8 bg-sidebar/70 text-sm text-white placeholder:text-white/20 focus-visible:ring-1 focus-visible:ring-teal-400/25"
        />
      </div>
    </div>
  );
}

export function PsychologySummary({
  psychology,
  compact = false,
  className,
}: {
  psychology: PsychologySnapshot;
  compact?: boolean;
  className?: string;
}) {
  const getEmotionalColor = (state: PsychologySnapshot["emotionalState"]) => {
    const colors: Record<PsychologySnapshot["emotionalState"], string> = {
      calm: "text-teal-300",
      confident: "text-teal-300",
      neutral: "text-white/70",
      excited: "text-sky-300",
      anxious: "text-amber-300",
      stressed: "text-orange-300",
      frustrated: "text-rose-300",
      angry: "text-rose-300",
      confused: "text-amber-200",
      discouraged: "text-rose-200",
      overwhelmed: "text-orange-200",
      regretful: "text-amber-200",
      impatient: "text-amber-300",
    };
    return colors[state];
  };

  if (compact) {
    return (
      <div className={cn("flex flex-wrap items-center gap-3 text-xs", className)}>
        <span className={cn("capitalize font-medium", getEmotionalColor(psychology.emotionalState))}>
          {psychology.emotionalState}
        </span>
        <span className="text-white/16">•</span>
        <span className="text-white/42">Mood {psychology.mood}/10</span>
        <span className="text-white/16">•</span>
        <span className="text-white/42">Focus {psychology.focus}/10</span>
      </div>
    );
  }

  return (
    <div className={cn("rounded-sm border border-white/5 bg-sidebar/45 p-4", className)}>
      <h4 className="text-xs font-medium text-white">Psychology snapshot</h4>
      <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
        <div>
          <span className="text-white/40">Mood</span>
          <p className="font-medium text-white">{psychology.mood}/10</p>
        </div>
        <div>
          <span className="text-white/40">Confidence</span>
          <p className="font-medium text-white">{psychology.confidence}/10</p>
        </div>
        <div>
          <span className="text-white/40">Focus</span>
          <p className="font-medium text-white">{psychology.focus}/10</p>
        </div>
        <div>
          <span className="text-white/40">Energy</span>
          <p className="font-medium text-white">{psychology.energy}/10</p>
        </div>
        <div>
          <span className="text-white/40">Fear</span>
          <p className="font-medium text-white">{psychology.fear}/10</p>
        </div>
        <div>
          <span className="text-white/40">Greed</span>
          <p className="font-medium text-white">{psychology.greed}/10</p>
        </div>
      </div>
      <div className="mt-3 border-t border-white/5 pt-3 text-xs">
        <span className={cn("capitalize font-medium", getEmotionalColor(psychology.emotionalState))}>
          {psychology.emotionalState}
        </span>
        {psychology.marketCondition && (
          <>
            <span className="mx-2 text-white/18">•</span>
            <span className="capitalize text-white/42">
              {psychology.marketCondition} market
            </span>
          </>
        )}
        {psychology.distractions && (
          <>
            <span className="mx-2 text-white/18">•</span>
            <span className="text-amber-300">Distractions present</span>
          </>
        )}
      </div>
    </div>
  );
}
