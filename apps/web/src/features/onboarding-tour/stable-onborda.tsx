"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Portal } from "@radix-ui/react-portal";
import { useOnborda } from "onborda";
import type { CardComponentProps, OnbordaProps, Step } from "onborda";
import {
  ADD_ACCOUNT_SHEET_FIRST_STEP,
  ADD_ACCOUNT_SHEET_LAST_STEP,
  TOUR_ID,
} from "./tour-steps";

type PointerPosition = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function getElementPosition(element: Element): PointerPosition {
  const { top, left, width, height } = element.getBoundingClientRect();
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

  return {
    x: left + scrollLeft,
    y: top + scrollTop,
    width,
    height,
  };
}

function getCardStyle(side: Step["side"]) {
  switch (side) {
    case "top":
      return {
        transform: "translate(-50%, 0)",
        left: "50%",
        bottom: "100%",
        marginBottom: "25px",
      };
    case "bottom":
      return {
        transform: "translate(-50%, 0)",
        left: "50%",
        top: "100%",
        marginTop: "25px",
      };
    case "left":
      return {
        transform: "translate(0, -50%)",
        right: "100%",
        top: "50%",
        marginRight: "25px",
      };
    case "right":
      return {
        transform: "translate(0, -50%)",
        left: "100%",
        top: "50%",
        marginLeft: "25px",
      };
    case "top-left":
      return {
        bottom: "100%",
        marginBottom: "25px",
      };
    case "top-right":
      return {
        right: 0,
        bottom: "100%",
        marginBottom: "25px",
      };
    case "bottom-left":
      return {
        top: "100%",
        marginTop: "25px",
      };
    case "bottom-right":
      return {
        right: 0,
        top: "100%",
        marginTop: "25px",
      };
    case "right-bottom":
      return {
        left: "100%",
        bottom: 0,
        marginLeft: "25px",
      };
    case "right-top":
      return {
        left: "100%",
        top: 0,
        marginLeft: "25px",
      };
    case "left-bottom":
      return {
        right: "100%",
        bottom: 0,
        marginRight: "25px",
      };
    case "left-top":
      return {
        right: "100%",
        top: 0,
        marginRight: "25px",
      };
    default:
      return {};
  }
}

function getArrowStyle(side: Step["side"]) {
  switch (side) {
    case "bottom":
      return {
        transform: "translate(-50%, 0) rotate(270deg)",
        left: "50%",
        top: "-23px",
      };
    case "top":
      return {
        transform: "translate(-50%, 0) rotate(90deg)",
        left: "50%",
        bottom: "-23px",
      };
    case "right":
      return {
        transform: "translate(0, -50%) rotate(180deg)",
        top: "50%",
        left: "-23px",
      };
    case "left":
      return {
        transform: "translate(0, -50%) rotate(0deg)",
        top: "50%",
        right: "-23px",
      };
    case "top-left":
      return {
        transform: "rotate(90deg)",
        left: "10px",
        bottom: "-23px",
      };
    case "top-right":
      return {
        transform: "rotate(90deg)",
        right: "10px",
        bottom: "-23px",
      };
    case "bottom-left":
      return {
        transform: "rotate(270deg)",
        left: "10px",
        top: "-23px",
      };
    case "bottom-right":
      return {
        transform: "rotate(270deg)",
        right: "10px",
        top: "-23px",
      };
    case "right-bottom":
      return {
        transform: "rotate(180deg)",
        left: "-23px",
        bottom: "10px",
      };
    case "right-top":
      return {
        transform: "rotate(180deg)",
        left: "-23px",
        top: "10px",
      };
    case "left-bottom":
      return {
        transform: "rotate(0deg)",
        right: "-23px",
        bottom: "10px",
      };
    case "left-top":
      return {
        transform: "rotate(0deg)",
        right: "-23px",
        top: "10px",
      };
    default:
      return {};
  }
}

function CardArrow({ side }: { side: Step["side"] }) {
  return (
    <svg
      viewBox="0 0 54 54"
      data-name="onborda-arrow"
      className="absolute h-6 w-6 origin-center"
      style={getArrowStyle(side)}
    >
      <path id="triangle" d="M27 27L0 0V54L27 27Z" fill="currentColor" />
    </svg>
  );
}

export function StableOnborda({
  children,
  interact = false,
  steps,
  shadowRgb = "0, 0, 0",
  shadowOpacity = "0.2",
  cardTransition = { ease: "anticipate", duration: 0.6 },
  cardComponent: CardComponent,
  suppressOverlay = false,
}: OnbordaProps & { suppressOverlay?: boolean }) {
  const { currentTour, currentStep, setCurrentStep, isOnbordaVisible } =
    useOnborda();
  const [pointerPosition, setPointerPosition] = useState<PointerPosition | null>(
    null
  );

  const currentTourSteps = useMemo(
    () => steps.find((tour) => tour.tour === currentTour)?.steps ?? [],
    [currentTour, steps]
  );
  const currentStepDef = currentTourSteps[currentStep] ?? null;
  const isGuidedSheetStep =
    isOnbordaVisible &&
    currentTour === TOUR_ID &&
    currentStep >= ADD_ACCOUNT_SHEET_FIRST_STEP &&
    currentStep <= ADD_ACCOUNT_SHEET_LAST_STEP;
  const isSidebarTourStep =
    isOnbordaVisible &&
    currentTour === TOUR_ID &&
    currentStep > ADD_ACCOUNT_SHEET_LAST_STEP;
  const shouldSuppressOverlay = suppressOverlay || isGuidedSheetStep;

  const clearStepStyles = useCallback(() => {
    for (const tourStep of currentTourSteps) {
      const element = document.querySelector<HTMLElement>(tourStep.selector);
      if (!element) continue;
      element.style.position = "";
      if (interact) {
        element.style.zIndex = "";
      }
    }
  }, [currentTourSteps, interact]);

  const alignElementIntoView = useCallback((element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const margin = 16;
    const isFullyVisible =
      rect.top >= margin && rect.bottom <= window.innerHeight - margin;

    if (!isFullyVisible) {
      element.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, []);

  const updatePointerPosition = useCallback(() => {
    if (!currentStepDef?.selector || shouldSuppressOverlay) {
      if (!isSidebarTourStep) {
        setPointerPosition(null);
      }
      return;
    }

    const element = document.querySelector<HTMLElement>(currentStepDef.selector);
    if (!element) {
      if (!isSidebarTourStep) {
        setPointerPosition(null);
      }
      return;
    }

    setPointerPosition(getElementPosition(element));
  }, [currentStepDef?.selector, isSidebarTourStep, shouldSuppressOverlay]);

  useLayoutEffect(() => {
    if (!isOnbordaVisible || !currentStepDef) {
      clearStepStyles();
      setPointerPosition(null);
      return;
    }

    if (shouldSuppressOverlay) {
      clearStepStyles();
      setPointerPosition(null);
      return;
    }

    clearStepStyles();

    const element = document.querySelector<HTMLElement>(currentStepDef.selector);
    if (!element) {
      if (!isSidebarTourStep) {
        setPointerPosition(null);
      }
      return;
    }

    element.style.position = "relative";
    if (interact) {
      element.style.zIndex = "990";
    }

    alignElementIntoView(element);

    const frame = window.requestAnimationFrame(() => {
      setPointerPosition(getElementPosition(element));
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [
    alignElementIntoView,
    clearStepStyles,
    currentStepDef,
    interact,
    isSidebarTourStep,
    shouldSuppressOverlay,
    isOnbordaVisible,
  ]);

  useEffect(() => {
    if (
      !isSidebarTourStep ||
      !isOnbordaVisible ||
      shouldSuppressOverlay ||
      !currentStepDef?.selector
    ) {
      return;
    }

    const existing = document.querySelector<HTMLElement>(currentStepDef.selector);
    if (existing) {
      return;
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector<HTMLElement>(currentStepDef.selector);
      if (!element) {
        return;
      }

      observer.disconnect();
      alignElementIntoView(element);
      setPointerPosition(getElementPosition(element));
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    return () => observer.disconnect();
  }, [
    alignElementIntoView,
    currentStepDef?.selector,
    isOnbordaVisible,
    isSidebarTourStep,
    shouldSuppressOverlay,
  ]);

  useEffect(() => {
    if (
      !isOnbordaVisible ||
      shouldSuppressOverlay ||
      !currentStepDef?.selector
    ) {
      return;
    }

    updatePointerPosition();

    window.addEventListener("resize", updatePointerPosition);
    window.addEventListener("scroll", updatePointerPosition, true);

    return () => {
      window.removeEventListener("resize", updatePointerPosition);
      window.removeEventListener("scroll", updatePointerPosition, true);
    };
  }, [
    currentStepDef?.selector,
    shouldSuppressOverlay,
    isOnbordaVisible,
    updatePointerPosition,
  ]);

  useEffect(() => {
    return () => {
      clearStepStyles();
    };
  }, [clearStepStyles]);

  const nextStep = () => {
    if (currentStep < currentTourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const cardProps: CardComponentProps | null =
    currentStepDef && CardComponent
      ? {
          step: currentStepDef,
          currentStep,
          totalSteps: currentTourSteps.length,
          nextStep,
          prevStep,
          arrow: <CardArrow side={currentStepDef.side} />,
        }
      : null;

  const pointerPadding = currentStepDef?.pointerPadding ?? 30;
  const pointerPadOffset = pointerPadding / 2;
  const pointerRadius = currentStepDef?.pointerRadius ?? 28;

  return (
    <div data-name="onborda-wrapper" className="relative w-full" data-onborda="dev">
      <div data-name="onborda-site" className="block w-full">
        {children}
      </div>

      {isOnbordaVisible && CardComponent && cardProps ? (
        shouldSuppressOverlay ? (
          isGuidedSheetStep ? <CardComponent {...cardProps} /> : null
        ) : pointerPosition ? (
          <Portal>
            {!interact ? <div className="fixed inset-0 z-[900]" /> : null}
            <motion.div
              data-name="onborda-overlay"
              className="absolute inset-0"
              initial={isSidebarTourStep ? false : "hidden"}
              animate="visible"
              variants={{
                visible: { opacity: 1 },
                hidden: { opacity: 0 },
              }}
              transition={{ duration: isSidebarTourStep ? 0 : 0.5 }}
            >
              <motion.div
                data-name="onborda-pointer"
                className="relative z-[900]"
                style={{
                  boxShadow: `0 0 200vw 200vh rgba(${shadowRgb}, ${shadowOpacity})`,
                  borderRadius: `${pointerRadius}px ${pointerRadius}px ${pointerRadius}px ${pointerRadius}px`,
                }}
                initial={{
                  x: pointerPosition.x - pointerPadOffset,
                  y: pointerPosition.y - pointerPadOffset,
                  width: pointerPosition.width + pointerPadding,
                  height: pointerPosition.height + pointerPadding,
                }}
                animate={{
                  x: pointerPosition.x - pointerPadOffset,
                  y: pointerPosition.y - pointerPadOffset,
                  width: pointerPosition.width + pointerPadding,
                  height: pointerPosition.height + pointerPadding,
                }}
                transition={cardTransition}
              >
                <div
                  data-name="onborda-card"
                  className="absolute z-[950] flex min-w-min max-w-[100%] flex-col transition-all pointer-events-auto"
                  style={getCardStyle(currentStepDef.side)}
                >
                  <CardComponent {...cardProps} />
                </div>
              </motion.div>
            </motion.div>
          </Portal>
        ) : null
      ) : null}
    </div>
  );
}
