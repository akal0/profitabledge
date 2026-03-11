"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { PsychologySnapshot } from "@/components/journal/types";

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
  color?: "green" | "red" | "blue" | "yellow";
}

function SliderField({
  label,
  value,
  onChange,
  lowLabel,
  highLabel,
  color = "blue",
}: SliderFieldProps) {
  const colorClasses = {
    green: "accent-green-500",
    red: "accent-red-500",
    blue: "accent-blue-500",
    yellow: "accent-yellow-500",
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">{label}</Label>
        <span className="text-sm font-semibold text-primary">{value}/10</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-muted-foreground w-16 text-left">
          {lowLabel}
        </span>
        <input
          type="range"
          min="1"
          max="10"
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className={cn(
            "flex-1 h-2 rounded-full cursor-pointer",
            colorClasses[color]
          )}
        />
        <span className="text-[10px] text-muted-foreground w-16 text-right">
          {highLabel}
        </span>
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
    "anxious",
    "stressed",
    "frustrated",
    "excited",
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
    <div className={cn("space-y-6", className)}>
      <div className="space-y-4">
        <SliderField
          label="Mood"
          value={value.mood}
          onChange={(v) => updateField("mood", v)}
          lowLabel="Terrible"
          highLabel="Excellent"
          color="green"
        />

        <SliderField
          label="Confidence"
          value={value.confidence}
          onChange={(v) => updateField("confidence", v)}
          lowLabel="Doubtful"
          highLabel="Certain"
          color="blue"
        />

        <SliderField
          label="Energy"
          value={value.energy}
          onChange={(v) => updateField("energy", v)}
          lowLabel="Exhausted"
          highLabel="Energized"
          color="green"
        />

        <SliderField
          label="Focus"
          value={value.focus}
          onChange={(v) => updateField("focus", v)}
          lowLabel="Distracted"
          highLabel="Locked In"
          color="blue"
        />

        <SliderField
          label="Fear"
          value={value.fear}
          onChange={(v) => updateField("fear", v)}
          lowLabel="Fearless"
          highLabel="Terrified"
          color="red"
        />

        <SliderField
          label="Greed/FOMO"
          value={value.greed}
          onChange={(v) => updateField("greed", v)}
          lowLabel="Patient"
          highLabel="Impulsive"
          color="red"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs font-medium">Emotional State</Label>
          <Select
            value={value.emotionalState}
            onValueChange={(v) =>
              updateField("emotionalState", v as PsychologySnapshot["emotionalState"])
            }
          >
            <SelectTrigger className="h-9">
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

        <div className="space-y-2">
          <Label className="text-xs font-medium">Market Condition</Label>
          <Select
            value={value.marketCondition || ""}
            onValueChange={(v) =>
              updateField(
                "marketCondition",
                (v || undefined) as PsychologySnapshot["marketCondition"]
              )
            }
          >
            <SelectTrigger className="h-9">
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

        <div className="space-y-2">
          <Label className="text-xs font-medium">Environment</Label>
          <Select
            value={value.tradingEnvironment || ""}
            onValueChange={(v) =>
              updateField(
                "tradingEnvironment",
                (v || undefined) as PsychologySnapshot["tradingEnvironment"]
              )
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select environment" />
            </SelectTrigger>
            <SelectContent>
              {environments.map((env) => (
                <SelectItem key={env} value={env || "home"}>
                  <span className="capitalize">{env}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <SliderField
            label="Sleep Quality"
            value={value.sleepQuality || 5}
            onChange={(v) => updateField("sleepQuality", v)}
            lowLabel="Poor"
            highLabel="Great"
            color="blue"
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div className="space-y-0.5">
          <Label className="text-xs font-medium">Distractions</Label>
          <p className="text-[10px] text-muted-foreground">
            Any external distractions present?
          </p>
        </div>
        <Switch
          checked={value.distractions || false}
          onCheckedChange={(v) => updateField("distractions", v)}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium">Mental State Notes</Label>
        <Textarea
          value={value.notes || ""}
          onChange={(e) => updateField("notes", e.target.value)}
          placeholder="Any thoughts about your current mental state..."
          className="min-h-[80px] resize-none text-sm"
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
      calm: "text-green-500",
      confident: "text-green-500",
      neutral: "text-gray-500",
      anxious: "text-yellow-500",
      stressed: "text-orange-500",
      frustrated: "text-red-500",
      excited: "text-blue-500",
    };
    return colors[state];
  };

  if (compact) {
    return (
      <div className={cn("flex items-center gap-3 text-xs", className)}>
        <span className={cn("capitalize font-medium", getEmotionalColor(psychology.emotionalState))}>
          {psychology.emotionalState}
        </span>
        <span className="text-muted-foreground">|</span>
        <span className="text-muted-foreground">Mood: {psychology.mood}/10</span>
        <span className="text-muted-foreground">|</span>
        <span className="text-muted-foreground">Focus: {psychology.focus}/10</span>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border p-4 space-y-3", className)}>
      <h4 className="text-sm font-medium">Psychology Snapshot</h4>
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div>
          <span className="text-muted-foreground">Mood</span>
          <p className="font-medium">{psychology.mood}/10</p>
        </div>
        <div>
          <span className="text-muted-foreground">Confidence</span>
          <p className="font-medium">{psychology.confidence}/10</p>
        </div>
        <div>
          <span className="text-muted-foreground">Focus</span>
          <p className="font-medium">{psychology.focus}/10</p>
        </div>
        <div>
          <span className="text-muted-foreground">Energy</span>
          <p className="font-medium">{psychology.energy}/10</p>
        </div>
        <div>
          <span className="text-muted-foreground">Fear</span>
          <p className="font-medium">{psychology.fear}/10</p>
        </div>
        <div>
          <span className="text-muted-foreground">Greed</span>
          <p className="font-medium">{psychology.greed}/10</p>
        </div>
      </div>
      <div className="pt-2 border-t text-xs">
        <span className={cn("capitalize font-medium", getEmotionalColor(psychology.emotionalState))}>
          {psychology.emotionalState}
        </span>
        {psychology.marketCondition && (
          <>
            <span className="mx-2 text-muted-foreground">•</span>
            <span className="text-muted-foreground capitalize">
              {psychology.marketCondition} market
            </span>
          </>
        )}
        {psychology.distractions && (
          <>
            <span className="mx-2 text-muted-foreground">•</span>
            <span className="text-yellow-500">Distractions present</span>
          </>
        )}
      </div>
    </div>
  );
}
