"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Trash2, GripVertical, AlertCircle, Info, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type CalloutType = "info" | "warning" | "success" | "error" | "note";

interface CalloutNodeAttrs {
  type: CalloutType;
  emoji: string;
}

const calloutConfig: Record<CalloutType, { icon: React.ReactNode; bg: string; border: string; text: string; defaultEmoji: string }> = {
  info: {
    icon: <Info className="h-4 w-4" />,
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-400",
    defaultEmoji: "💡",
  },
  warning: {
    icon: <AlertTriangle className="h-4 w-4" />,
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    text: "text-yellow-400",
    defaultEmoji: "⚠️",
  },
  success: {
    icon: <CheckCircle className="h-4 w-4" />,
    bg: "bg-teal-500/10",
    border: "border-teal-500/30",
    text: "text-teal-400",
    defaultEmoji: "✅",
  },
  error: {
    icon: <XCircle className="h-4 w-4" />,
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-400",
    defaultEmoji: "❌",
  },
  note: {
    icon: <AlertCircle className="h-4 w-4" />,
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    text: "text-purple-400",
    defaultEmoji: "📝",
  },
};

// Node View Component
function CalloutNodeView({ node, updateAttributes, deleteNode, selected }: any) {
  const [isHovered, setIsHovered] = useState(false);
  const attrs = node.attrs as CalloutNodeAttrs;
  const config = calloutConfig[attrs.type] || calloutConfig.info;

  const cycleType = () => {
    const types: CalloutType[] = ["info", "warning", "success", "error", "note"];
    const currentIndex = types.indexOf(attrs.type);
    const nextIndex = (currentIndex + 1) % types.length;
    const nextType = types[nextIndex];
    updateAttributes({ 
      type: nextType, 
      emoji: calloutConfig[nextType].defaultEmoji 
    });
  };

  return (
    <NodeViewWrapper className="my-4">
      <div
        className={cn(
          "relative flex items-start gap-3 p-4 border rounded-lg",
          config.bg,
          config.border,
          selected && "ring-2 ring-teal-400/50"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Emoji/Icon - aligned with first line of text */}
        <div 
          className={cn("flex-shrink-0 text-xl cursor-pointer select-none leading-[1.7]", config.text)}
          onClick={cycleType}
          title="Click to change callout type"
          contentEditable={false}
        >
          {attrs.emoji || config.defaultEmoji}
        </div>

        {/* Content - editable */}
        <div className="flex-1 min-w-0 pt-[2px]">
          <NodeViewContent className="prose prose-invert prose-sm max-w-none [&>p]:my-0 [&>p]:text-white/80 [&>p]:leading-[1.7]" />
        </div>

        {/* Controls */}
        {isHovered && (
          <div 
            className="absolute top-2 right-2 flex items-center gap-1"
            contentEditable={false}
          >
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
              onClick={() => deleteNode()}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

// TipTap Extension
export const CalloutNode = Node.create({
  name: "callout",
  group: "block",
  content: "paragraph+",
  draggable: true,

  addAttributes() {
    return {
      type: { default: "info" },
      emoji: { default: "💡" },
    };
  },

  parseHTML() {
    return [{
      tag: 'div[data-callout]',
      getAttrs: (dom) => {
        if (typeof dom === 'string') return {};
        const element = dom as HTMLElement;
        return {
          type: element.getAttribute('data-callout-type') || 'info',
          emoji: element.getAttribute('data-emoji') || '💡',
        };
      },
    }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 
      'data-callout': '',
      'data-callout-type': node.attrs.type || 'info',
      'data-emoji': node.attrs.emoji || '💡',
      class: 'callout',
    }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutNodeView);
  },

  addCommands() {
    return {
      insertCallout:
        (attrs?: { type?: CalloutType; emoji?: string }) =>
        ({ chain }: { chain: any }) => {
          return chain()
            .insertContent({
              type: this.name,
              attrs: {
                type: attrs?.type || "info",
                emoji: attrs?.emoji || calloutConfig[attrs?.type || "info"].defaultEmoji,
              },
              content: [
                {
                  type: "paragraph",
                },
              ],
            })
            .run();
        },
    } as any;
  },
});
