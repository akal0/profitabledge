"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { Response } from "@/components/ui/shadcn-io/ai/response";
import { TextShimmer } from "@/components/ui/text-shimmer";
import type { StreamStage } from "@/types/assistant-stream";

const MIN_STEP_DISPLAY_MS = 1050;

export function getAssistantStreamingStatusLines(
  stage: StreamStage | null,
  statusMessage?: string
) {
  const message = statusMessage?.trim();
  if (message) {
    return [message];
  }

  if (!stage) {
    return ["Thinking..."];
  }

  switch (stage) {
    case "thinking":
      return ["Thinking..."];
    case "planning":
      return ["Understanding your question..."];
    case "querying":
    case "aggregating":
      return ["Sorting through the data..."];
    case "writing":
      return ["Writing the response..."];
    case "finalizing":
      return ["Painting the visualization panel..."];
    default: {
      return ["Thinking..."];
    }
  }
}

export function PremiumAssistantStreamingContent({
  lines,
  lineBuffer,
  stage,
  statusMessage,
  showResponse = true,
  finalizePresentation = false,
  onPresentationComplete,
  className,
}: {
  lines: string[];
  lineBuffer: string;
  stage: string | null;
  statusMessage: string;
  showResponse?: boolean;
  finalizePresentation?: boolean;
  onPresentationComplete?: () => void;
  className?: string;
}) {
  const stepLines = getAssistantStreamingStatusLines(
    stage as StreamStage | null,
    statusMessage
  );
  const activeStep = stepLines[0] ?? null;
  const [displayedStep, setDisplayedStep] = useState<string | null>(null);
  const [queuedSteps, setQueuedSteps] = useState<string[]>([]);
  const stepStartedAtRef = useRef(0);
  const hasNotifiedPresentationCompleteRef = useRef(false);
  const activeStepSpread = useMemo(() => {
    const length = displayedStep?.trim().length ?? 0;

    if (length <= 12) return 3.1;
    if (length <= 24) return 2.2;
    return 1.4;
  }, [displayedStep]);
  const targetContent = `${lines.join("\n")}${lineBuffer}`;
  const segments = useMemo(
    () => targetContent.match(/\S+\s*|\n+/g) ?? [],
    [targetContent]
  );
  const [visibleSegmentCount, setVisibleSegmentCount] = useState(0);

  useEffect(() => {
    if (!activeStep) {
      return;
    }

    if (!displayedStep) {
      setDisplayedStep(activeStep);
      stepStartedAtRef.current = performance.now();
      return;
    }

    if (
      activeStep === displayedStep ||
      queuedSteps.includes(activeStep)
    ) {
      return;
    }

    setQueuedSteps((current) => [...current, activeStep]);
  }, [activeStep, displayedStep, queuedSteps]);

  useEffect(() => {
    if (!displayedStep || queuedSteps.length === 0) {
      return;
    }

    const elapsed = performance.now() - stepStartedAtRef.current;
    const delay = Math.max(MIN_STEP_DISPLAY_MS - elapsed, 0);

    const timer = window.setTimeout(() => {
      setQueuedSteps((current) => {
        const [nextStep, ...rest] = current;

        if (nextStep) {
          setDisplayedStep(nextStep);
          stepStartedAtRef.current = performance.now();
        }

        return rest;
      });
    }, delay);

    return () => window.clearTimeout(timer);
  }, [displayedStep, queuedSteps]);

  useEffect(() => {
    if (!finalizePresentation) {
      hasNotifiedPresentationCompleteRef.current = false;
      return;
    }

    const responseComplete =
      !showResponse || segments.length === 0 || visibleSegmentCount >= segments.length;
    const stepsSettled =
      queuedSteps.length === 0 &&
      ((displayedStep && activeStep && displayedStep === activeStep) ||
        (!displayedStep && !activeStep));

    if (!responseComplete || !stepsSettled) {
      hasNotifiedPresentationCompleteRef.current = false;
      return;
    }

    if (hasNotifiedPresentationCompleteRef.current) {
      return;
    }

    const elapsed = displayedStep
      ? performance.now() - stepStartedAtRef.current
      : MIN_STEP_DISPLAY_MS;
    const delay = displayedStep
      ? Math.max(MIN_STEP_DISPLAY_MS - elapsed, 0)
      : 0;

    const timer = window.setTimeout(() => {
      hasNotifiedPresentationCompleteRef.current = true;
      onPresentationComplete?.();
    }, delay);

    return () => window.clearTimeout(timer);
  }, [
    activeStep,
    displayedStep,
    finalizePresentation,
    onPresentationComplete,
    queuedSteps.length,
    segments.length,
    showResponse,
    visibleSegmentCount,
  ]);

  useEffect(() => {
    if (!targetContent) {
      setVisibleSegmentCount(0);
      return;
    }

    setVisibleSegmentCount((current) =>
      current > segments.length ? 0 : current
    );
  }, [targetContent, segments.length]);

  const getSegmentDelay = (segment: string) => {
    if (!segment.trim()) return 10;
    if (/\n{2,}$/.test(segment)) return 130;
    if (/\n$/.test(segment)) return 90;
    if (/[.!?]["')\]]?\s*$/.test(segment)) return 74;
    if (/[,;:]\s*$/.test(segment)) return 42;
    if (segment.length > 14) return 28;
    return 22;
  };

  useEffect(() => {
    if (
      !showResponse ||
      segments.length === 0 ||
      visibleSegmentCount >= segments.length
    ) {
      return;
    }

    const nextSegment = segments[visibleSegmentCount] ?? "";
    const timer = window.setTimeout(() => {
      setVisibleSegmentCount((current) => Math.min(current + 1, segments.length));
    }, getSegmentDelay(nextSegment));

    return () => window.clearTimeout(timer);
  }, [segments, showResponse, visibleSegmentCount]);

  const displayedSegments = useMemo(
    () => segments.slice(0, visibleSegmentCount),
    [segments, visibleSegmentCount]
  );
  const displayedContent = useMemo(
    () => displayedSegments.join(""),
    [displayedSegments]
  );

  return (
    <div className={cn("space-y-4", className)}>
      {displayedStep ? (
        <div className="min-h-6 overflow-hidden">
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={`${stage ?? "unknown"}:${displayedStep}`}
              initial={{ opacity: 0, x: 22, filter: "blur(6px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, x: -22, filter: "blur(6px)" }}
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            >
              <TextShimmer
                as="span"
                duration={1.95}
                spread={activeStepSpread}
                className="inline-block text-sm font-medium leading-6 tracking-[-0.01em] [--base-color:rgba(255,255,255,0.32)] [--base-gradient-color:rgba(255,255,255,1)]"
              >
                {displayedStep}
              </TextShimmer>
            </motion.div>
          </AnimatePresence>
        </div>
      ) : null}

      {showResponse && displayedContent ? (
        <div className="prose prose-invert prose-sm max-w-none text-white/84">
          <Response parseIncompleteMarkdown>
            {displayedContent}
          </Response>
          {visibleSegmentCount < segments.length ? (
            <motion.span
              aria-hidden="true"
              className="ml-0.5 inline-block h-[1.05em] w-px rounded-full bg-white/60 align-[-0.12em]"
              animate={{ opacity: [0.15, 0.9, 0.15] }}
              transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
