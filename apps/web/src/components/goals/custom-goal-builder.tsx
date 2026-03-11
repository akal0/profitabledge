"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, X, Sparkles, TrendingUp, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Types matching backend
export type FilterType =
  | "session"
  | "model"
  | "symbol"
  | "day"
  | "direction"
  | "rr"
  | "duration"
  | "timeRange";

export type ComparatorType =
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "eq"
  | "increase"
  | "decrease";

export type MetricType =
  | "winRate"
  | "profit"
  | "avgRR"
  | "consistency"
  | "tradeCount"
  | "profitFactor"
  | "avgProfit"
  | "avgLoss";

export interface GoalFilter {
  type: FilterType;
  value: string | number | string[];
  operator?: "is" | "isNot" | "in" | "notIn" | "between";
  range?: [number, number];
}

export interface CustomGoalCriteria {
  filters: GoalFilter[];
  metric: MetricType;
  comparator: ComparatorType;
  baselineValue?: number;
  targetValue: number;
  description?: string;
}

interface CustomGoalBuilderProps {
  onSubmit: (criteria: CustomGoalCriteria, title: string, type: string) => void;
  onCancel: () => void;
  accountId: string;
}

const filterTypeLabels: Record<FilterType, string> = {
  session: "Trading Session",
  model: "Model Tag",
  symbol: "Symbol",
  day: "Day of Week",
  direction: "Direction",
  rr: "Risk/Reward",
  duration: "Duration",
  timeRange: "Time Range",
};

const metricLabels: Record<MetricType, string> = {
  winRate: "Win Rate",
  profit: "Total Profit",
  avgRR: "Avg Risk/Reward",
  consistency: "Consistency",
  tradeCount: "Trade Count",
  profitFactor: "Profit Factor",
  avgProfit: "Avg Profit",
  avgLoss: "Avg Loss",
};

const comparatorLabels: Record<ComparatorType, string> = {
  gt: "Greater than",
  gte: "Greater than or equal to",
  lt: "Less than",
  lte: "Less than or equal to",
  eq: "Equal to",
  increase: "Increase from baseline",
  decrease: "Decrease from baseline",
};

const sessionOptions = ["asia", "london", "newyork"];
const dayOptions = ["monday", "tuesday", "wednesday", "thursday", "friday"];
const directionOptions = ["long", "short"];

export function CustomGoalBuilder({
  onSubmit,
  onCancel,
  accountId,
}: CustomGoalBuilderProps) {
  const [filters, setFilters] = useState<GoalFilter[]>([]);
  const [metric, setMetric] = useState<MetricType>("winRate");
  const [comparator, setComparator] = useState<ComparatorType>("gte");
  const [baselineValue, setBaselineValue] = useState<string>("");
  const [targetValue, setTargetValue] = useState<string>("");
  const [goalType, setGoalType] = useState<string>("weekly");
  const [customTitle, setCustomTitle] = useState<string>("");

  // Add a new filter
  const addFilter = () => {
    setFilters([
      ...filters,
      { type: "session", value: "asia", operator: "is" },
    ]);
  };

  // Remove a filter
  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  // Update filter
  const updateFilter = (
    index: number,
    field: keyof GoalFilter,
    value: any
  ) => {
    const newFilters = [...filters];
    newFilters[index] = { ...newFilters[index], [field]: value };
    setFilters(newFilters);
  };

  // Generate human-readable description
  const generateDescription = (): string => {
    let desc = "";

    // Metric part
    if (comparator === "increase") {
      desc = `Increase ${metricLabels[metric].toLowerCase()} from ${baselineValue} to ${targetValue}`;
    } else if (comparator === "decrease") {
      desc = `Decrease ${metricLabels[metric].toLowerCase()} from ${baselineValue} to ${targetValue}`;
    } else {
      desc = `Achieve ${metricLabels[metric].toLowerCase()} ${comparatorLabels[comparator].toLowerCase()} ${targetValue}`;
    }

    // Add filters
    if (filters.length > 0) {
      const filterDescs = filters.map((f) => {
        if (f.type === "session") return `${f.value} session`;
        if (f.type === "model") return `${f.value} model`;
        if (f.type === "symbol") return `${f.value}`;
        if (f.type === "day") return `on ${f.value}s`;
        if (f.type === "direction") return `${f.value} trades`;
        return f.value.toString();
      });

      desc += ` in ${filterDescs.join(", ")}`;
    }

    return desc;
  };

  const handleSubmit = () => {
    const criteria: CustomGoalCriteria = {
      filters,
      metric,
      comparator,
      baselineValue: baselineValue ? parseFloat(baselineValue) : undefined,
      targetValue: parseFloat(targetValue),
      description: generateDescription(),
    };

    const title = customTitle || generateDescription();
    onSubmit(criteria, title, goalType);
  };

  const isValid =
    targetValue &&
    (comparator === "increase" || comparator === "decrease"
      ? baselineValue
      : true);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20">
          <Sparkles className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">
            Custom Goal Builder
          </h3>
          <p className="text-sm text-white/60">
            Create data-driven goals with specific filters
          </p>
        </div>
      </div>

      {/* Filters Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-white/80">
            Filters (optional)
          </label>
          <Button
            onClick={addFilter}
            variant="outline"
            size="sm"
            className="h-8 text-xs"
          >
            <Plus className="w-3 h-3 mr-1" />
            Add Filter
          </Button>
        </div>

        <AnimatePresence>
          {filters.map((filter, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2 p-3 rounded-lg border border-white/10 bg-white/5"
            >
              {/* Filter Type */}
              <Select
                value={filter.type}
                onValueChange={(value) =>
                  updateFilter(index, "type", value as FilterType)
                }
              >
                <SelectTrigger className="w-[180px] bg-white/5 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(filterTypeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Operator */}
              <Select
                value={filter.operator || "is"}
                onValueChange={(value) => updateFilter(index, "operator", value)}
              >
                <SelectTrigger className="w-[120px] bg-white/5 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="is">is</SelectItem>
                  <SelectItem value="isNot">is not</SelectItem>
                  <SelectItem value="in">in</SelectItem>
                  <SelectItem value="notIn">not in</SelectItem>
                </SelectContent>
              </Select>

              {/* Value (conditional based on filter type) */}
              {filter.type === "session" && (
                <Select
                  value={filter.value as string}
                  onValueChange={(value) => updateFilter(index, "value", value)}
                >
                  <SelectTrigger className="flex-1 bg-white/5 border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sessionOptions.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {filter.type === "day" && (
                <Select
                  value={filter.value as string}
                  onValueChange={(value) => updateFilter(index, "value", value)}
                >
                  <SelectTrigger className="flex-1 bg-white/5 border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dayOptions.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {filter.type === "direction" && (
                <Select
                  value={filter.value as string}
                  onValueChange={(value) => updateFilter(index, "value", value)}
                >
                  <SelectTrigger className="flex-1 bg-white/5 border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {directionOptions.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {(filter.type === "model" || filter.type === "symbol") && (
                <Input
                  value={filter.value as string}
                  onChange={(e) => updateFilter(index, "value", e.target.value)}
                  placeholder={`Enter ${filter.type}...`}
                  className="flex-1 bg-white/5 border-white/10 text-white"
                />
              )}

              {/* Remove button */}
              <button
                onClick={() => removeFilter(index)}
                className="p-2 rounded hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {filters.length === 0 && (
          <div className="p-4 rounded-lg border border-dashed border-white/10 text-center">
            <p className="text-sm text-white/40">
              No filters added. Goal will track all trades.
            </p>
          </div>
        )}
      </div>

      {/* Metric Selection */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-white/80">
          What metric do you want to track?
        </label>
        <Select value={metric} onValueChange={(v) => setMetric(v as MetricType)}>
          <SelectTrigger className="bg-white/5 border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(metricLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Comparator Selection */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-white/80">
          How do you want to compare?
        </label>
        <Select
          value={comparator}
          onValueChange={(v) => setComparator(v as ComparatorType)}
        >
          <SelectTrigger className="bg-white/5 border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(comparatorLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Baseline Value (if increase/decrease) */}
      {(comparator === "increase" || comparator === "decrease") && (
        <div className="space-y-3">
          <label className="text-sm font-medium text-white/80">
            Current/Baseline Value
          </label>
          <Input
            type="number"
            value={baselineValue}
            onChange={(e) => setBaselineValue(e.target.value)}
            placeholder="Enter current value..."
            className="bg-white/5 border-white/10 text-white"
          />
        </div>
      )}

      {/* Target Value */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-white/80">
          Target Value
        </label>
        <Input
          type="number"
          value={targetValue}
          onChange={(e) => setTargetValue(e.target.value)}
          placeholder="Enter target value..."
          className="bg-white/5 border-white/10 text-white"
        />
      </div>

      {/* Goal Type */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-white/80">
          Goal Timeframe
        </label>
        <Select value={goalType} onValueChange={setGoalType}>
          <SelectTrigger className="bg-white/5 border-white/10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="milestone">Milestone (no deadline)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Custom Title (optional) */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-white/80">
          Custom Title (optional)
        </label>
        <Input
          value={customTitle}
          onChange={(e) => setCustomTitle(e.target.value)}
          placeholder={generateDescription()}
          className="bg-white/5 border-white/10 text-white"
        />
      </div>

      {/* Preview */}
      <div className="p-4 rounded-lg border border-white/10 bg-white/5">
        <p className="text-xs text-white/50 mb-1">Preview:</p>
        <p className="text-sm text-white/80">{generateDescription()}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button onClick={onCancel} variant="outline" className="flex-1">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!isValid}
          className="flex-1"
        >
          <Target className="w-4 h-4 mr-2" />
          Create Custom Goal
        </Button>
      </div>
    </div>
  );
}
