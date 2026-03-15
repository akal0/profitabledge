"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Trash2, GripVertical, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PsychologyTracker, PsychologySummary } from "../psychology-tracker";
import type { PsychologySnapshot } from "../types";

interface PsychologyNodeAttrs {
  mood: number;
  confidence: number;
  energy: number;
  focus: number;
  fear: number;
  greed: number;
  emotionalState: PsychologySnapshot["emotionalState"];
  tradingEnvironment: PsychologySnapshot["tradingEnvironment"];
  sleepQuality: number;
  distractions: boolean;
  marketCondition: PsychologySnapshot["marketCondition"];
  notes: string;
}

function decodeStoredNotes(value: string | null): string {
  if (!value) {
    return "";
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

const defaultPsychology: PsychologyNodeAttrs = {
  mood: 5,
  confidence: 5,
  energy: 5,
  focus: 5,
  fear: 5,
  greed: 5,
  emotionalState: "neutral",
  tradingEnvironment: "home",
  sleepQuality: 5,
  distractions: false,
  marketCondition: "unsure",
  notes: "",
};

function PsychologyNodeView({ node, updateAttributes, deleteNode, selected }: any) {
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const attrs = node.attrs as PsychologyNodeAttrs;

  const psychology: PsychologySnapshot = {
    mood: attrs.mood,
    confidence: attrs.confidence,
    energy: attrs.energy,
    focus: attrs.focus,
    fear: attrs.fear,
    greed: attrs.greed,
    emotionalState: attrs.emotionalState,
    tradingEnvironment: attrs.tradingEnvironment,
    sleepQuality: attrs.sleepQuality,
    distractions: attrs.distractions,
    marketCondition: attrs.marketCondition,
    notes: attrs.notes,
  };

  const handleChange = (updated: PsychologySnapshot) => {
    updateAttributes({
      mood: updated.mood,
      confidence: updated.confidence,
      energy: updated.energy,
      focus: updated.focus,
      fear: updated.fear,
      greed: updated.greed,
      emotionalState: updated.emotionalState,
      tradingEnvironment: updated.tradingEnvironment,
      sleepQuality: updated.sleepQuality,
      distractions: updated.distractions,
      marketCondition: updated.marketCondition,
      notes: updated.notes || "",
    });
  };

  return (
    <NodeViewWrapper className="my-4">
      <div
        className={cn(
          "relative overflow-hidden rounded-md border border-white/5 bg-sidebar/5 p-2 shadow-[0_0_0_1px_rgba(255,255,255,0.01)]",
          selected && "ring-2 ring-teal-400/30"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="overflow-hidden rounded-sm border border-white/5 bg-sidebar-accent/80">
          <div
            className="flex cursor-pointer items-start justify-between gap-3 border-b border-white/5 px-4 py-3"
            onClick={() => setIsExpanded(!isExpanded)}
            contentEditable={false}
          >
            <div className="flex min-w-0 items-start gap-3">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-white/5 bg-sidebar-accent">
                <Brain className="h-3.5 w-3.5 text-teal-400" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-white">Psychology snapshot</div>
                <p className="mt-1 text-xs leading-relaxed text-white/40">
                  Track the mental state behind this journal entry.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isHovered && (
                <>
                  <div
                    className="cursor-grab active:cursor-grabbing text-white/30 hover:text-white/50 p-1"
                    data-drag-handle
                  >
                    <GripVertical className="h-4 w-4" />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-red-400 hover:text-red-400 hover:bg-red-400/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNode();
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
              <svg
                className={cn("h-4 w-4 text-muted-foreground transition-transform", isExpanded && "rotate-180")}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
          </div>

          {isExpanded ? (
            <div className="p-4" contentEditable={false}>
              <PsychologyTracker value={psychology} onChange={handleChange} />
            </div>
          ) : (
            <div className="px-4 py-3" contentEditable={false}>
              <PsychologySummary psychology={psychology} compact />
            </div>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
}

export const PsychologyNode = Node.create({
  name: "psychologyWidget",
  group: "block",
  draggable: true,
  atom: true,

  addAttributes() {
    return {
      mood: { default: defaultPsychology.mood },
      confidence: { default: defaultPsychology.confidence },
      energy: { default: defaultPsychology.energy },
      focus: { default: defaultPsychology.focus },
      fear: { default: defaultPsychology.fear },
      greed: { default: defaultPsychology.greed },
      emotionalState: { default: defaultPsychology.emotionalState },
      tradingEnvironment: { default: defaultPsychology.tradingEnvironment },
      sleepQuality: { default: defaultPsychology.sleepQuality },
      distractions: { default: defaultPsychology.distractions },
      marketCondition: { default: defaultPsychology.marketCondition },
      notes: { default: defaultPsychology.notes },
    };
  },

  parseHTML() {
    return [{
      tag: 'div[data-psychology-widget]',
      getAttrs: (dom) => {
        if (typeof dom === 'string') return {};
        const element = dom as HTMLElement;
        return {
          mood: parseInt(element.getAttribute('data-mood') || '5'),
          confidence: parseInt(element.getAttribute('data-confidence') || '5'),
          energy: parseInt(element.getAttribute('data-energy') || '5'),
          focus: parseInt(element.getAttribute('data-focus') || '5'),
          fear: parseInt(element.getAttribute('data-fear') || '5'),
          greed: parseInt(element.getAttribute('data-greed') || '5'),
          emotionalState: element.getAttribute('data-emotional-state') as PsychologySnapshot["emotionalState"] || 'neutral',
          tradingEnvironment: element.getAttribute('data-trading-environment') as PsychologySnapshot["tradingEnvironment"] || 'home',
          sleepQuality: parseInt(element.getAttribute('data-sleep-quality') || '5'),
          distractions: element.getAttribute('data-distractions') === 'true',
          marketCondition: element.getAttribute('data-market-condition') as PsychologySnapshot["marketCondition"] || 'unsure',
          notes: decodeStoredNotes(element.getAttribute('data-notes')),
        };
      },
    }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = node.attrs as PsychologyNodeAttrs;
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-psychology-widget': '',
      'data-mood': attrs.mood,
      'data-confidence': attrs.confidence,
      'data-energy': attrs.energy,
      'data-focus': attrs.focus,
      'data-fear': attrs.fear,
      'data-greed': attrs.greed,
      'data-emotional-state': attrs.emotionalState,
      'data-trading-environment': attrs.tradingEnvironment || '',
      'data-sleep-quality': attrs.sleepQuality || 5,
      'data-distractions': attrs.distractions ? 'true' : 'false',
      'data-market-condition': attrs.marketCondition || '',
      'data-notes': encodeURIComponent(attrs.notes || ''),
    })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PsychologyNodeView);
  },

  addCommands() {
    return {
      insertPsychologyWidget:
        () =>
        ({ chain }: { chain: any }) => {
          return chain()
            .insertContent({
              type: this.name,
              attrs: defaultPsychology,
            })
            .run();
        },
    } as any;
  },
});
