/**
 * Premium AI Assistant - Streaming Hook
 * 
 * Handles line-by-line streaming with analysis blocks.
 * Provides smooth rendering and structured data for the right panel.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import type {
  StreamEvent,
  AssistantStreamState,
  AnalysisBlock,
  StreamStage,
  VizSpec,
} from "@/types/assistant-stream";
import { showAIErrorToast } from "@/lib/ai-error-toast";
import { startTabAttentionActivity } from "@/stores/tab-attention";

const INITIAL_STATE: AssistantStreamState = {
  stage: null,
  statusMessage: "",
  lines: [],
  lineBuffer: "",
  analysisBlocks: [],
  visualization: null,
  isStreaming: false,
  isDone: false,
  justCompleted: false,
  error: null,
};

export function useAssistantStream() {
  const [state, setState] = useState<AssistantStreamState>(INITIAL_STATE);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Commit complete lines from the buffer
   */
  const commitLines = useCallback((buffer: string): { lines: string[]; remainder: string } => {
    const allLines: string[] = [];
    let remaining = buffer;

    while (remaining.includes("\n")) {
      const idx = remaining.indexOf("\n");
      const line = remaining.substring(0, idx);
      allLines.push(line);
      remaining = remaining.substring(idx + 1);
    }

    return { lines: allLines, remainder: remaining };
  }, []);

  const applyEvent = useCallback(
    (event: StreamEvent) => {
      setState((prev) => {
        switch (event.event) {
          case "status":
            return {
              ...prev,
              stage: event.stage,
              statusMessage: event.message,
            };

          case "delta": {
            const newBuffer = prev.lineBuffer + event.text;
            const { lines: newLines, remainder } = commitLines(newBuffer);

            return {
              ...prev,
              lines: [...prev.lines, ...newLines],
              lineBuffer: remainder,
            };
          }

          case "analysis":
            return {
              ...prev,
              analysisBlocks: [...prev.analysisBlocks, event.block],
            };

          case "visualization":
            return {
              ...prev,
              visualization: event.viz,
            };

          case "error":
            return {
              ...prev,
              error: (event as any).message || "Unknown error",
            };

          case "done": {
            const {
              lines: finalLines,
              remainder,
            } = commitLines(prev.lineBuffer);
            const trailingLine = remainder.length > 0 ? [remainder] : [];

            return {
              ...prev,
              lines: [...prev.lines, ...finalLines, ...trailingLine],
              lineBuffer: "",
              isStreaming: false,
              isDone: true,
              justCompleted: true,
            };
          }

          default:
            return prev;
        }
      });
    },
    [commitLines]
  );

  const processNdjsonLines = useCallback(
    (input: string, isFinal = false): string => {
      const lines = input.split("\n");
      const remainder = isFinal ? "" : lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          applyEvent(JSON.parse(line) as StreamEvent);
        } catch (error) {
          if (process.env.NODE_ENV !== "production") {
            console.error("Failed to parse stream event:", line, error);
          }
        }
      }

      if (isFinal) {
        const finalLine = remainder || lines[lines.length - 1];
        if (finalLine && finalLine.trim()) {
          try {
            applyEvent(JSON.parse(finalLine) as StreamEvent);
          } catch (error) {
            if (process.env.NODE_ENV !== "production") {
              console.error("Failed to parse final stream event:", finalLine, error);
            }
          }
        }
        return "";
      }

      return remainder;
    },
    [applyEvent]
  );

  /**
   * Start streaming from the endpoint
   */
  const startStream = useCallback(
    async (endpoint: string, body: any) => {
      // Abort any existing stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Reset state
      setState(INITIAL_STATE);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      const releaseTabAttention = startTabAttentionActivity("assistant");

      setState((prev) => ({ ...prev, isStreaming: true }));

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: abortController.signal,
          credentials: "include", // Include cookies for auth
        });

        if (!response.ok) {
          let message = `HTTP ${response.status}: ${response.statusText}`;

          try {
            const errorPayload = await response.json();
            if (errorPayload?.error && typeof errorPayload.error === "string") {
              message = errorPayload.error;
            }
          } catch {
            // Fall back to the status text when the response body is not JSON.
          }

          throw new Error(message);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          buffer = processNdjsonLines(buffer);
        }

        buffer += decoder.decode();
        if (buffer.trim()) {
          processNdjsonLines(buffer, true);
        }
      } catch (error: any) {
        if (error.name === "AbortError") {
          return;
        }

        if (process.env.NODE_ENV !== "production") {
          console.error("Stream error:", error);
        }
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          isDone: true,
          justCompleted: true,
          error: error.message || "Stream failed",
        }));
      } finally {
        releaseTabAttention();
      }
    },
    [processNdjsonLines]
  );

  /**
   * Reset the stream state
   */
  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState(INITIAL_STATE);
  }, []);

  /**
   * Clear the "just completed" flag after shimmer animation
   */
  useEffect(() => {
    if (state.justCompleted) {
      const timer = setTimeout(() => {
        setState((prev) => ({ ...prev, justCompleted: false }));
      }, 1000); // Match shimmer duration

      return () => clearTimeout(timer);
    }
  }, [state.justCompleted]);

  useEffect(() => {
    if (!state.error) {
      return;
    }

    if (!showAIErrorToast(state.error)) {
      toast.error(state.error);
    }
  }, [state.error]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return {
    state,
    startStream,
    reset,
  };
}
