import type {
  AnalysisBlock,
  RenderedWidget,
  VizSpec,
} from "@/types/assistant-stream";

export function extractPresentationFromWidgets(widgets?: RenderedWidget[] | null): {
  visualization?: VizSpec;
  analysisBlocks?: AnalysisBlock[];
} {
  const visualizationBlocks: VizSpec[] = [];
  const analysisBlocks: AnalysisBlock[] = [];

  for (const widget of widgets || []) {
    if (!widget) continue;

    if (widget.type === "visualization") {
      visualizationBlocks.push(widget.viz);
      continue;
    }

    if (widget.type === "analysis") {
      analysisBlocks.push(widget.block);
      continue;
    }

    if (widget.type === "legacy-data") {
      if (widget.data.visualization) {
        visualizationBlocks.push(widget.data.visualization);
      }
      if (Array.isArray(widget.data.analysisBlocks)) {
        analysisBlocks.push(...widget.data.analysisBlocks);
      }
    }
  }

  return {
    visualization: visualizationBlocks[visualizationBlocks.length - 1],
    analysisBlocks,
  };
}

export function buildMessageWidgets(payload: {
  visualization?: VizSpec | null;
  analysisBlocks?: AnalysisBlock[];
}): RenderedWidget[] {
  const widgets: RenderedWidget[] = [];

  for (const block of payload.analysisBlocks || []) {
    widgets.push({ type: "analysis", block });
  }

  if (payload.visualization) {
    widgets.push({ type: "visualization", viz: payload.visualization });
  }

  return widgets;
}
