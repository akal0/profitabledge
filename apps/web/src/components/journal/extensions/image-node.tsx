"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import React, { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Trash2, GripVertical, Maximize2, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageNodeAttrs {
  src: string;
  alt: string;
  caption: string | null;
  width: number | null;
  align: "left" | "center" | "right";
}

// Node View Component
function ImageNodeView({ node, updateAttributes, deleteNode, selected }: any) {
  const [isHovered, setIsHovered] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const attrs = node.attrs as ImageNodeAttrs;
  const { src, alt, caption, width, align } = attrs;

  const handleResize = (e: React.MouseEvent) => {
    if (!imageRef.current) return;
    
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = imageRef.current.offsetWidth;

    const onMouseMove = (e: MouseEvent) => {
      const newWidth = startWidth + (e.clientX - startX);
      updateAttributes({ width: Math.max(100, Math.min(newWidth, 800)) });
    };

    const onMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  return (
    <NodeViewWrapper className="my-4">
      <div
        className={cn(
          "relative group flex flex-col",
          align === "center" && "items-center",
          align === "right" && "items-end",
          align === "left" && "items-start",
          selected && "ring-2 ring-teal-400/50 ring-offset-2 ring-offset-background rounded-lg"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        contentEditable={false}
      >
        <div className="relative inline-block">
          {/* Image */}
          <img
            ref={imageRef}
            src={src}
            alt={alt || ""}
            style={{ width: width || "auto", maxWidth: "100%" }}
            className="block rounded-lg"
            draggable={false}
          />

          {/* Controls overlay */}
          {isHovered && (
            <>
              {/* Top controls */}
              <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm p-1 rounded-lg">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-white hover:text-white hover:bg-white/20"
                  onClick={() => updateAttributes({ align: "left" })}
                >
                  <AlignLeft className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-white hover:text-white hover:bg-white/20"
                  onClick={() => updateAttributes({ align: "center" })}
                >
                  <AlignCenter className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-white hover:text-white hover:bg-white/20"
                  onClick={() => updateAttributes({ align: "right" })}
                >
                  <AlignRight className="h-3 w-3" />
                </Button>
                <div className="w-px h-4 bg-white/20" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-white hover:text-white hover:bg-white/20"
                  onClick={() => updateAttributes({ width: null })}
                >
                  <Maximize2 className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-red-400 hover:text-red-400 hover:bg-red-400/20"
                  onClick={() => deleteNode()}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>

              {/* Drag handle */}
              <div
                className="absolute top-2 left-2 cursor-grab active:cursor-grabbing bg-black/60 backdrop-blur-sm p-1 rounded-lg text-white"
                data-drag-handle
              >
                <GripVertical className="h-4 w-4" />
              </div>

              {/* Resize handle */}
              <div
                className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-teal-400/50 rounded-r-lg"
                onMouseDown={handleResize}
              />
            </>
          )}
        </div>

        {/* Caption input - now properly in flex column */}
        {(caption || isHovered) && (
          <div className="w-full mt-2">
            <input
              type="text"
              value={caption || ""}
              onChange={(e) => updateAttributes({ caption: e.target.value })}
              placeholder="Add a caption..."
              className={cn(
                "text-sm text-white/40 bg-transparent border-none outline-none w-full placeholder:text-white/20",
                align === "center" && "text-center",
                align === "right" && "text-right"
              )}
            />
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

// TipTap Extension
export const ImageNode = Node.create({
  name: "journalImage",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: "" },
      caption: { default: null },
      width: { default: null },
      align: { default: "center" },
    };
  },

  parseHTML() {
    return [{
      tag: 'figure[data-journal-image]',
      getAttrs: (dom) => {
        if (typeof dom === 'string') return {};
        const element = dom as HTMLElement;
        const img = element.querySelector('img');
        return {
          src: element.getAttribute('data-src') || img?.getAttribute('src') || '',
          alt: element.getAttribute('data-alt') || img?.getAttribute('alt') || '',
          caption: element.getAttribute('data-caption') || null,
          width: element.getAttribute('data-width') ? parseInt(element.getAttribute('data-width')!) : null,
          align: element.getAttribute('data-align') || 'center',
        };
      },
    }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['figure', mergeAttributes(HTMLAttributes, { 
      'data-journal-image': '',
      'data-src': node.attrs.src || '',
      'data-alt': node.attrs.alt || '',
      'data-caption': node.attrs.caption || '',
      'data-width': node.attrs.width ? String(node.attrs.width) : '',
      'data-align': node.attrs.align || 'center',
    })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },

  addCommands() {
    return {
      insertImage:
        (attrs: { src: string; alt?: string }) =>
        ({ chain }: { chain: any }) => {
          return chain()
            .insertContent({
              type: this.name,
              attrs,
            })
            .run();
        },
    } as any;
  },
});
