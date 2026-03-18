"use client";

import React from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useOnborda } from "onborda";
import type { CardComponentProps } from "onborda";
import { Button } from "@/components/ui/button";
import confetti from "canvas-confetti";
import { toast } from "sonner";

function fireConfetti() {
  confetti({
    particleCount: 120,
    spread: 70,
    origin: { y: 0.6 },
    colors: ["#6366f1", "#8b5cf6", "#a78bfa", "#ffffff", "#c4b5fd"],
  });
  toast(
    <span className="">
      Congratulations! Now, go find your profitable edge 🎉
    </span>,
    { className: "min-w-[370px]" }
  );
}

export function TourCard({
  step,
  currentStep,
  totalSteps,
  nextStep,
  prevStep,
  arrow,
}: CardComponentProps) {
  const { closeOnborda } = useOnborda();
  const isLast = currentStep === totalSteps - 1;

  const arrowEl = arrow as React.ReactElement<{ style?: React.CSSProperties }>;
  const arrowBehind = React.cloneElement(arrowEl, {
    style: {
      ...arrowEl.props.style,
      zIndex: 999,
      transform: `${arrowEl.props.style?.transform ?? ""} scale(0.6)`,
    },
  });

  return (
    <div>
      {/*{arrowBehind}*/}
      <div className="bg-sidebar ring ring-white/15 rounded-lg shadow-2xl w-80 relative isolate">
        <div className="p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                {step.title}
              </h3>
            </div>

            <button
              type="button"
              onClick={closeOnborda}
              className="text-muted-foreground hover:text-foreground transition-colors -mt-0.5 -mr-0.5 p-0.5 rounded"
            >
              <X className="size-3.5" />
            </button>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed mb-4">
            {step.content}
          </p>

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground/50 tabular-nums">
              {currentStep + 1} / {totalSteps}
            </span>
            <div className="flex gap-1.5">
              {currentStep > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={prevStep}
                  className="h-6 w-6 p-0"
                >
                  <ChevronLeft className="size-3.5" />
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => {
                  if (isLast) {
                    fireConfetti();
                    closeOnborda();
                  } else {
                    nextStep();
                  }
                }}
                className="h-6 px-3 text-xs"
              >
                {isLast ? (
                  "Done"
                ) : (
                  <>
                    Next <ChevronRight className="size-3" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
