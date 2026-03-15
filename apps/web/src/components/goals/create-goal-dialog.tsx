"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { goalTemplates, type GoalTemplate } from "./goal-templates";
import { AIGoalGenerator } from "./ai-goal-generator";
import type { CustomGoalCriteria } from "./custom-goal-builder";
import { trpcClient } from "@/utils/trpc";
import { useQueryClient } from "@tanstack/react-query";

interface CreateGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId?: string;
}

type GoalType = "daily" | "weekly" | "monthly" | "milestone";
type GoalTargetType =
  | "profit"
  | "winRate"
  | "consistency"
  | "rr"
  | "trades"
  | "streak"
  | "journalRate"
  | "ruleCompliance"
  | "edgeTradeRate"
  | "maxRiskPerTrade"
  | "breakAfterLoss"
  | "checklistCompletion";

function mapCustomMetricToTargetType(metric: CustomGoalCriteria["metric"]): GoalTargetType {
  switch (metric) {
    case "avgRR":
      return "rr";
    case "tradeCount":
      return "trades";
    case "profitFactor":
      return "consistency";
    case "avgProfit":
      return "profit";
    case "avgLoss":
      return "maxRiskPerTrade";
    default:
      return metric;
  }
}

export function CreateGoalDialog({
  open,
  onOpenChange,
  accountId,
}: CreateGoalDialogProps) {
  const [mode, setMode] = useState<"template" | "custom">("template");
  const [selectedTemplate, setSelectedTemplate] = useState<GoalTemplate | null>(
    null
  );
  const [customTitle, setCustomTitle] = useState("");
  const [customValue, setCustomValue] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const queryClient = useQueryClient();

  const handleSelectTemplate = (template: GoalTemplate) => {
    setSelectedTemplate(template);
    setCustomTitle(template.title);
    setCustomValue(template.targetValue.toString());
  };

  const handleCreateGoal = async () => {
    if (!selectedTemplate) return;

    setIsCreating(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      let deadline: string | null = null;

      // Calculate deadline based on type
      const now = new Date();
      if (selectedTemplate.type === "daily") {
        deadline = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + 1
        )
          .toISOString()
          .split("T")[0];
      } else if (selectedTemplate.type === "weekly") {
        deadline = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + 7
        )
          .toISOString()
          .split("T")[0];
      } else if (selectedTemplate.type === "monthly") {
        deadline = new Date(now.getFullYear(), now.getMonth() + 1, 0)
          .toISOString()
          .split("T")[0];
      }

      await trpcClient.goals.create.mutate({
        accountId: accountId || null,
        type: selectedTemplate.type,
        targetType: selectedTemplate.targetType,
        targetValue: parseFloat(customValue),
        startDate: today,
        deadline,
        title: customTitle,
        description: selectedTemplate.description,
      });

      // Invalidate all goals-related queries
      await queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('goals.');
        }
      });

      // Reset and close
      setSelectedTemplate(null);
      setCustomTitle("");
      setCustomValue("");
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create goal:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateCustomGoal = async (
    criteria: CustomGoalCriteria,
    title: string,
    type: string
  ) => {
    setIsCreating(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      let deadline: string | null = null;
      const normalizedType: GoalType =
        type === "daily" ||
        type === "weekly" ||
        type === "monthly" ||
        type === "milestone"
          ? type
          : "weekly";

      // Calculate deadline based on type
      const now = new Date();
      if (normalizedType === "daily") {
        deadline = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + 1
        )
          .toISOString()
          .split("T")[0];
      } else if (normalizedType === "weekly") {
        deadline = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + 7
        )
          .toISOString()
          .split("T")[0];
      } else if (normalizedType === "monthly") {
        deadline = new Date(now.getFullYear(), now.getMonth() + 1, 0)
          .toISOString()
          .split("T")[0];
      }

      await trpcClient.goals.create.mutate({
        accountId: accountId || null,
        type: normalizedType,
        targetType: mapCustomMetricToTargetType(criteria.metric),
        targetValue: criteria.targetValue,
        startDate: today,
        deadline,
        title,
        description: criteria.description,
        isCustom: true,
        customCriteria: criteria as any,
      });

      // Invalidate all goals-related queries
      await queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('goals.');
        }
      });

      // Reset and close
      setMode("template");
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create custom goal:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const groupedTemplates = {
    daily: goalTemplates.filter((t) => t.type === "daily"),
    weekly: goalTemplates.filter((t) => t.type === "weekly"),
    monthly: goalTemplates.filter((t) => t.type === "monthly"),
    milestone: goalTemplates.filter((t) => t.type === "milestone"),
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
          />

          {/* Dialog */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-sm border border-white/5 bg-sidebar shadow-2xl"
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            >
              {/* Header */}
              <div className="sticky top-0 z-10 border-b border-white/5 bg-sidebar/95 px-5 py-4 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium text-white">New Goal</h2>
                  <button
                    onClick={() => onOpenChange(false)}
                    className="rounded-sm p-1.5 text-white/40 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Mode Toggle */}
                {!selectedTemplate && mode === "template" && (
                  <div className="mt-3 flex items-center gap-1 rounded-sm bg-white/[0.03] p-0.5">
                    <button
                      onClick={() => setMode("template")}
                      className={`flex-1 rounded-sm px-3 py-1.5 text-xs font-medium transition-all ${
                        mode === "template"
                          ? "bg-sidebar-accent text-white"
                          : "text-white/40 hover:text-white/70"
                      }`}
                    >
                      Templates
                    </button>
                    <button
                      onClick={() => {
                        if (accountId) setMode("custom");
                      }}
                      disabled={!accountId}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-medium transition-all text-white/40 hover:text-white/70 disabled:text-white/20 disabled:cursor-not-allowed"
                    >
                      <Sparkles className="h-3 w-3" />
                      Custom
                    </button>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-5">
                {mode === "custom" ? (
                  accountId ? (
                    <AIGoalGenerator
                      onGoalGenerated={handleCreateCustomGoal}
                      onCancel={() => setMode("template")}
                      accountId={accountId}
                    />
                  ) : (
                    <div className="rounded-sm border border-white/5 bg-sidebar p-5 text-sm text-white/50">
                      AI-generated goals currently need a specific account selected so the model can anchor targets to one trade history. Template goals still work across all accounts.
                    </div>
                  )
                ) : !selectedTemplate ? (
                  <>
                    {/* Template selection */}
                    {Object.entries(groupedTemplates).map(([type, templates]) => (
                      <div key={type} className="mb-6">
                        <h3 className="mb-3 text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">
                          {type} Goals
                        </h3>
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                          {templates.map((template) => {
                            const Icon = template.icon;
                            return (
                              <motion.button
                                key={template.id}
                                onClick={() => handleSelectTemplate(template)}
                                className="group relative rounded-sm border border-white/5 bg-sidebar p-4 text-left transition-all hover:brightness-120"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                              >
                                <div
                                  className="absolute inset-0 opacity-0 group-hover:opacity-10 rounded-sm transition-opacity"
                                  style={{
                                    background: `linear-gradient(135deg, ${template.color}, transparent)`,
                                  }}
                                />
                                <div className="relative z-10">
                                  <div className="flex items-start gap-3 mb-2">
                                    <div
                                      className="rounded-sm p-1.5"
                                      style={{ backgroundColor: `${template.color}20` }}
                                    >
                                      <Icon
                                        className="w-4 h-4"
                                        style={{ color: template.color }}
                                      />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h4 className="text-sm font-semibold text-white mb-1">
                                        {template.title}
                                      </h4>
                                      <p className="text-xs text-white/50 line-clamp-2">
                                        {template.description}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    {/* Customize selected template */}
                    <div className="space-y-6">
                      {/* Selected template preview */}
                      <div className="rounded-sm border border-white/5 bg-sidebar-accent p-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="rounded-sm p-2"
                            style={{
                              backgroundColor: `${selectedTemplate.color}15`,
                            }}
                          >
                            <selectedTemplate.icon
                              className="h-4 w-4"
                              style={{ color: selectedTemplate.color }}
                            />
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                              {selectedTemplate.type} goal
                            </p>
                            <p className="text-xs text-white/65">
                              {selectedTemplate.description}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Customize fields */}
                      <div className="space-y-4">
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-white/50">
                            Goal Title
                          </label>
                          <Input
                            value={customTitle}
                            onChange={(e) => setCustomTitle(e.target.value)}
                            placeholder="Enter goal title"
                            className="border-white/5 bg-sidebar-accent text-white text-sm"
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-white/50">
                            Target Value
                          </label>
                          <Input
                            type="number"
                            value={customValue}
                            onChange={(e) => setCustomValue(e.target.value)}
                            placeholder="Enter target value"
                            className="border-white/5 bg-sidebar-accent text-white text-sm"
                          />
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3">
                        <Button
                          onClick={() => setSelectedTemplate(null)}
                          className="flex-1 cursor-pointer flex items-center justify-center gap-2 rounded-sm border border-white/5 bg-sidebar px-3 py-2 h-9 text-xs text-white/70 transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 shadow-none"
                        >
                          Back
                        </Button>
                        <Button
                          onClick={handleCreateGoal}
                          disabled={!customTitle || !customValue || isCreating}
                          className="flex-1 cursor-pointer flex items-center justify-center gap-2 rounded-sm border border-white/5 bg-sidebar px-3 py-2 h-9 text-xs text-white transition-all duration-250 active:scale-95 hover:bg-sidebar-accent hover:brightness-110 shadow-none"
                        >
                          {isCreating ? "Creating..." : "Create Goal"}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
