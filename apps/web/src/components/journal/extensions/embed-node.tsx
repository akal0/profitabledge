"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { ExternalLink, Youtube, Twitter, Link, X, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ============================================================================
// URL Parser Utilities
// ============================================================================

interface EmbedInfo {
  type: "youtube" | "twitter" | "generic";
  embedUrl?: string;
  thumbnailUrl?: string;
  title?: string;
}

function parseEmbedUrl(url: string): EmbedInfo {
  try {
    const urlObj = new URL(url);
    
    // YouTube
    if (urlObj.hostname.includes("youtube.com") || urlObj.hostname.includes("youtu.be")) {
      let videoId = "";
      
      if (urlObj.hostname.includes("youtu.be")) {
        videoId = urlObj.pathname.slice(1);
      } else {
        videoId = urlObj.searchParams.get("v") || "";
      }
      
      if (videoId) {
        return {
          type: "youtube",
          embedUrl: `https://www.youtube.com/embed/${videoId}`,
          thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        };
      }
    }
    
    // Twitter/X
    if (urlObj.hostname.includes("twitter.com") || urlObj.hostname.includes("x.com")) {
      // Extract tweet ID from URL like twitter.com/user/status/123456
      const match = urlObj.pathname.match(/\/status\/(\d+)/);
      if (match) {
        return {
          type: "twitter",
          embedUrl: url,
        };
      }
    }
    
    // Generic link
    return {
      type: "generic",
      embedUrl: url,
    };
  } catch {
    return {
      type: "generic",
      embedUrl: url,
    };
  }
}

// ============================================================================
// Embed Node View Component
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function EmbedNodeView({ node, updateAttributes, deleteNode, selected }: any) {
  const { url, embedType } = node.attrs;
  const [isEditing, setIsEditing] = useState(!url || url === "placeholder");
  const [inputUrl, setInputUrl] = useState(url === "placeholder" ? "" : url);
  const [showVideo, setShowVideo] = useState(false);

  const handleSubmit = () => {
    if (inputUrl.trim()) {
      const embedInfo = parseEmbedUrl(inputUrl.trim());
      updateAttributes({
        url: inputUrl.trim(),
        embedType: embedInfo.type,
      });
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      if (!url || url === "placeholder") {
        deleteNode();
      }
    }
  };

  const embedInfo = parseEmbedUrl(url);

  // Editing state - URL input
  if (isEditing) {
    return (
      <NodeViewWrapper>
        <div
          className={cn(
            "my-4 p-4 rounded-lg border bg-sidebar-accent",
            selected ? "border-teal-500" : "border-white/10"
          )}
        >
          <div className="flex items-center gap-2 mb-3">
            <Link className="h-4 w-4 text-white/60" />
            <span className="text-sm font-medium text-white">Embed URL</span>
          </div>
          <div className="flex gap-2">
            <Input
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste YouTube, Twitter, or any URL..."
              autoFocus
              className="flex-1 bg-sidebar border-white/10 text-white placeholder:text-white/30"
            />
            <Button
              onClick={handleSubmit}
              disabled={!inputUrl.trim()}
              className="bg-teal-500 hover:bg-teal-600"
            >
              Embed
            </Button>
          </div>
          <p className="text-xs text-white/40 mt-2">
            Supports YouTube videos, Twitter/X posts, and generic links
          </p>
        </div>
      </NodeViewWrapper>
    );
  }

  // YouTube embed
  if (embedType === "youtube" && embedInfo.embedUrl) {
    return (
      <NodeViewWrapper>
        <div
          className={cn(
            "my-4 rounded-lg overflow-hidden border group relative",
            selected ? "border-teal-500" : "border-white/10"
          )}
        >
          {/* Delete button */}
          <button
            onClick={deleteNode}
            className="absolute top-2 right-2 z-10 p-1.5 rounded bg-black/50 text-white/60 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="h-4 w-4" />
          </button>

          {showVideo ? (
            <div className="aspect-video">
              <iframe
                src={embedInfo.embedUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div
              className="aspect-video relative cursor-pointer"
              onClick={() => setShowVideo(true)}
            >
              <img
                src={embedInfo.thumbnailUrl}
                alt="Video thumbnail"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center">
                  <Play className="h-8 w-8 text-white ml-1" fill="white" />
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex items-center gap-2 text-white">
                  <Youtube className="h-5 w-5 text-red-500" />
                  <span className="text-sm">Click to play video</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </NodeViewWrapper>
    );
  }

  // Twitter embed
  if (embedType === "twitter") {
    return (
      <NodeViewWrapper>
        <div
          className={cn(
            "my-4 rounded-lg overflow-hidden border group relative",
            selected ? "border-teal-500" : "border-white/10"
          )}
        >
          {/* Delete button */}
          <button
            onClick={deleteNode}
            className="absolute top-2 right-2 z-10 p-1.5 rounded bg-black/50 text-white/60 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="h-4 w-4" />
          </button>

          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 bg-sidebar-accent hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-black">
              <Twitter className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white">Twitter/X Post</div>
              <div className="text-xs text-white/40 truncate">{url}</div>
            </div>
            <ExternalLink className="h-4 w-4 text-white/40" />
          </a>
        </div>
      </NodeViewWrapper>
    );
  }

  // Generic link embed
  return (
    <NodeViewWrapper>
      <div
        className={cn(
          "my-4 rounded-lg overflow-hidden border group relative",
          selected ? "border-teal-500" : "border-white/10"
        )}
      >
        {/* Delete button */}
        <button
          onClick={deleteNode}
          className="absolute top-2 right-2 z-10 p-1.5 rounded bg-black/50 text-white/60 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="h-4 w-4" />
        </button>

        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-4 bg-sidebar-accent hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center justify-center w-10 h-10 rounded bg-white/5">
            <ExternalLink className="h-5 w-5 text-white/60" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate">
              {new URL(url).hostname}
            </div>
            <div className="text-xs text-white/40 truncate">{url}</div>
          </div>
          <ExternalLink className="h-4 w-4 text-white/40 flex-shrink-0" />
        </a>
      </div>
    </NodeViewWrapper>
  );
}

// ============================================================================
// TipTap Extension
// ============================================================================

export const EmbedNode = Node.create({
  name: "embedNode",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      url: {
        default: "placeholder",
      },
      embedType: {
        default: "generic",
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-embed-node]',
        getAttrs: (dom) => {
          if (typeof dom === "string") return {};
          const element = dom as HTMLElement;
          return {
            url: element.getAttribute("data-url") || "placeholder",
            embedType: element.getAttribute("data-embed-type") || "generic",
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-embed-node": "",
        "data-url": HTMLAttributes.url,
        "data-embed-type": HTMLAttributes.embedType,
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EmbedNodeView);
  },
});
