"use client";

import React, { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useOnborda } from "onborda";
import type { CardComponentProps } from "onborda";
import { Button } from "@/components/ui/button";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import {
  DASHBOARD_TOURS,
  TOUR_ID,
  ADD_ACCOUNT_TRIGGER_TOUR_STEP,
  ADD_ACCOUNT_SHEET_FIRST_STEP,
  ADD_ACCOUNT_SHEET_LAST_STEP,
} from "./tour-steps";
import { useTourStore } from "./tour-store";

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

function waitForElement(selector: string, onReady: () => void) {
  const existing = document.querySelector(selector);
  if (existing) {
    onReady();
    return;
  }

  const observer = new MutationObserver(() => {
    const element = document.querySelector(selector);
    if (!element) return;
    window.clearTimeout(timeout);
    observer.disconnect();
    onReady();
  });

  const timeout = window.setTimeout(() => {
    observer.disconnect();
  }, 2000);

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function scrollTourStepIntoView(stepIndex: number) {
  const selector = DASHBOARD_TOURS.find((tour) => tour.tour === TOUR_ID)?.steps[
    stepIndex
  ]?.selector;
  if (!selector) return;
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) return;

  const scrollContainer = element.closest<HTMLElement>(
    '[data-slot="sheet-content"]'
  );

  if (!scrollContainer) {
    element.scrollIntoView({ block: "nearest", inline: "nearest" });
    return;
  }

  const elementRect = element.getBoundingClientRect();
  const containerRect = scrollContainer.getBoundingClientRect();
  const pad = 20;
  const isFullyVisible =
    elementRect.top >= containerRect.top + pad &&
    elementRect.bottom <= containerRect.bottom - pad;

  if (isFullyVisible) {
    return;
  }

  element.scrollIntoView({ block: "nearest", inline: "nearest" });
}

export function TourCard({
  step,
  currentStep,
  totalSteps,
  nextStep,
  prevStep,
  arrow,
}: CardComponentProps) {
  const { closeOnborda, currentTour, setCurrentStep } = useOnborda();
  const demoCreated = useTourStore((s) => s.demoCreated);
  const addAccountSheetCompleted = useTourStore(
    (s) => s.addAccountSheetCompleted
  );
  const setRequestedAddAccountSheetOpen = useTourStore(
    (s) => s.setRequestedAddAccountSheetOpen
  );
  const lockGuidedSheetTransition = useTourStore(
    (s) => s.lockGuidedSheetTransition
  );
  const setDisablePointerTransition = useTourStore(
    (s) => s.setDisablePointerTransition
  );
  const setAddAccountSheetCompleted = useTourStore(
    (s) => s.setAddAccountSheetCompleted
  );
  const isLast = currentStep === totalSteps - 1;
  const isDemoStep =
    currentTour === TOUR_ID &&
    currentStep === ADD_ACCOUNT_SHEET_LAST_STEP;
  const isFirstPostSheetStep =
    currentTour === TOUR_ID &&
    currentStep === ADD_ACCOUNT_SHEET_LAST_STEP + 1;
  const canGoBack =
    currentStep > 0 &&
    !(addAccountSheetCompleted && isFirstPostSheetStep);

  const isSheetStep =
    currentTour === TOUR_ID &&
    currentStep >= ADD_ACCOUNT_SHEET_FIRST_STEP &&
    currentStep <= ADD_ACCOUNT_SHEET_LAST_STEP;

  // Track the vertical centre of the highlighted option element.
  // useLayoutEffect runs before paint, so the initial portal position is correct.
  const [cardCenterY, setCardCenterY] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!isSheetStep || !step.selector) {
      setCardCenterY(null);
      return;
    }
    const measure = () => {
      const el = document.querySelector<HTMLElement>(step.selector as string);
      if (el) {
        const r = el.getBoundingClientRect();
        setCardCenterY(r.top + r.height / 2);
      }
    };
    measure();
    // Retry in case the sheet DOM isn't fully ready on the first sync pass
    const timer = setTimeout(measure, 100);
    return () => clearTimeout(timer);
  }, [isSheetStep, step.selector]);

  const handleClose = () => {
    if (isSheetStep) {
      lockGuidedSheetTransition();
    }
    setRequestedAddAccountSheetOpen(false);
    setDisablePointerTransition(false);
    setAddAccountSheetCompleted(false);
    closeOnborda();
  };

  const runWithoutPointerTransition = (cb: () => void) => {
    setDisablePointerTransition(true);
    cb();
    window.setTimeout(() => {
      useTourStore.getState().setDisablePointerTransition(false);
    }, 80);
  };

  const cardContent = (
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
            onClick={handleClose}
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
            {canGoBack && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (currentStep === ADD_ACCOUNT_SHEET_FIRST_STEP) {
                    lockGuidedSheetTransition();
                    setRequestedAddAccountSheetOpen(false);
                    runWithoutPointerTransition(() => {
                      setCurrentStep(ADD_ACCOUNT_TRIGGER_TOUR_STEP);
                    });
                    return;
                  }
                  if (isSheetStep) {
                    runWithoutPointerTransition(() => {
                      setCurrentStep(currentStep - 1);
                    });
                    window.requestAnimationFrame(() => {
                      scrollTourStepIntoView(currentStep - 1);
                    });
                    return;
                  }
                  prevStep();
                }}
                className="h-6 w-6 p-0"
              >
                <ChevronLeft className="size-3.5" />
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => {
                if (
                  currentTour === TOUR_ID &&
                  currentStep === ADD_ACCOUNT_TRIGGER_TOUR_STEP
                ) {
                  setRequestedAddAccountSheetOpen(true);
                  waitForElement(
                    '[data-onborda="sheet-option-csv"]',
                    () => {
                      runWithoutPointerTransition(() => {
                        setCurrentStep(ADD_ACCOUNT_SHEET_FIRST_STEP);
                      });
                    }
                  );
                  return;
                }
                if (isDemoStep && !demoCreated) {
                  toast.error(
                    "You have to generate a demo account before continuing to the next step."
                  );
                  return;
                }
                if (isLast) {
                  fireConfetti();
                  handleClose();
                } else {
                  if (currentStep === ADD_ACCOUNT_SHEET_LAST_STEP) {
                    lockGuidedSheetTransition();
                    setRequestedAddAccountSheetOpen(false);
                    runWithoutPointerTransition(() => {
                      setCurrentStep(currentStep + 1);
                    });
                    return;
                  }
                  if (isSheetStep) {
                    runWithoutPointerTransition(() => {
                      setCurrentStep(currentStep + 1);
                    });
                    window.requestAnimationFrame(() => {
                      scrollTourStepIntoView(currentStep + 1);
                    });
                    return;
                  }
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
  );

  if (isSheetStep) {
    return createPortal(
      <motion.div
        className="pointer-events-auto"
        initial={false}
        style={{
          position: "fixed",
          top: cardCenterY !== null ? cardCenterY : "50%",
          right: `calc(min(672px, 100vw) + 48px)`,
          translateY: "-50%",
          zIndex: 9950,
          pointerEvents: "auto",
        }}
      >
        {cardContent}
      </motion.div>,
      document.body
    );
  }

  return (
    <div>
      <div className="ml-4">{cardContent}</div>
    </div>
  );
}
