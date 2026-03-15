"use client";

import { Target, X } from "lucide-react";
import { AIGoalGenerator } from "@/components/goals/ai-goal-generator";
import type { CustomGoalCriteria } from "@/components/goals/custom-goal-builder";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

export function PremiumAssistantGoalDialog({
  open,
  onOpenChange,
  onGoalGenerated,
  accountId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGoalGenerated: (
    criteria: CustomGoalCriteria,
    title: string,
    type: string
  ) => Promise<void>;
  accountId: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex flex-col gap-0 overflow-hidden rounded-md border border-white/5 bg-sidebar/5 p-2 shadow-2xl backdrop-blur-lg max-w-3xl"
      >
        <div className="flex flex-col gap-0 overflow-hidden rounded-sm border border-white/5 bg-sidebar-accent/80 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-start gap-3 px-5 py-4 sticky top-0 bg-sidebar-accent/80 z-10">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-white/5 bg-sidebar-accent">
              <Target className="h-3.5 w-3.5 text-purple-400" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-white">Create Trading Goal</div>
              <p className="mt-1 text-xs leading-relaxed text-white/40">Use AI to generate a goal based on your trading history</p>
            </div>
            <DialogClose asChild>
              <button type="button" className="ml-auto flex size-8 cursor-pointer items-center justify-center rounded-sm border border-white/5 bg-sidebar-accent text-white/50 transition-colors hover:bg-sidebar-accent hover:brightness-110 hover:text-white">
                <X className="h-3.5 w-3.5" />
                <span className="sr-only">Close</span>
              </button>
            </DialogClose>
          </div>
          <Separator />

          {/* Body */}
          <div className="px-5 py-4">
            <AIGoalGenerator
              onGoalGenerated={onGoalGenerated}
              onCancel={() => onOpenChange(false)}
              accountId={accountId}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
