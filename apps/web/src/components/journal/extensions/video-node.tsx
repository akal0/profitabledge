"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import React, { useCallback, useRef, useState } from "react";
import { Film, Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUploadThing } from "@/utils/uploadthing";

interface VideoNodeAttrs {
  src: string;
  thumbnail: string | null;
  caption: string | null;
  duration: number | null;
  autoplay: boolean;
  muted: boolean;
}

function generateVideoPreview(file: File): Promise<{
  thumbnail: string | null;
  duration: number | null;
}> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      video.onloadedmetadata = null;
      video.onseeked = null;
      video.onerror = null;
      URL.revokeObjectURL(objectUrl);
    };

    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : null;
      const seekTime = duration && duration > 0.2 ? Math.min(1, duration / 3) : null;

      if (!seekTime) {
        cleanup();
        resolve({ thumbnail: null, duration });
        return;
      }

      video.currentTime = seekTime;
    };

    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const duration = Number.isFinite(video.duration) ? video.duration : null;
      cleanup();
      resolve({ thumbnail: canvas.toDataURL("image/jpeg", 0.78), duration });
    };

    video.onerror = () => {
      cleanup();
      resolve({ thumbnail: null, duration: null });
    };

    video.src = objectUrl;
  });
}

function VideoNodeView({ node, updateAttributes, deleteNode, selected }: any) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { startUpload: startVideoUpload } = useUploadThing(
    (router) => router.videoUploader
  );
  const attrs = node.attrs as VideoNodeAttrs;
  const { src, thumbnail, caption, autoplay, muted } = attrs;
  const [isHovered, setIsHovered] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handlePickVideo = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleVideoChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !file.type.startsWith("video/")) return;
    if (file.size > 64 * 1024 * 1024) {
      toast.error("Video must be under 64MB");
      return;
    }

    setIsUploading(true);
    try {
      const [preview, uploadResult] = await Promise.all([
        generateVideoPreview(file),
        startVideoUpload([file]),
      ]);
      const videoUrl = uploadResult?.[0]?.ufsUrl ?? uploadResult?.[0]?.url;
      if (!videoUrl) {
        throw new Error("Failed to upload video");
      }

      updateAttributes({
        src: videoUrl,
        thumbnail: preview.thumbnail,
        duration: preview.duration,
        caption: caption || file.name,
        autoplay: false,
        muted: true,
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload video"
      );
    } finally {
      setIsUploading(false);
    }
  }, [caption, startVideoUpload, updateAttributes]);

  return (
    <NodeViewWrapper className="my-4">
      <div
        className={cn(
          "group relative overflow-hidden rounded-lg border bg-sidebar",
          selected ? "ring-2 ring-teal-400/50 ring-offset-2 ring-offset-background" : "border-white/10"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        contentEditable={false}
      >
        {src ? (
          <div className="relative">
            <video
              src={src}
              poster={thumbnail || undefined}
              className="block w-full rounded-t-lg bg-black"
              controls
              playsInline
              autoPlay={autoplay}
              muted={muted}
            />
            <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs text-white/80 backdrop-blur-sm">
              <Film className="h-3.5 w-3.5 text-teal-300" />
              <span>Video</span>
            </div>
            {isHovered ? (
              <div className="absolute right-3 top-3 flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8 bg-black/60 text-white hover:bg-black/75"
                  onClick={handlePickVideo}
                >
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Replace
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8 bg-black/60 text-white hover:bg-black/75"
                  onClick={deleteNode}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-5 text-left hover:bg-white/5"
            onClick={handlePickVideo}
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-white/5">
              {isUploading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                <Upload className="h-4 w-4 text-white/60" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-white">
                Upload a video
              </div>
              <div className="text-xs text-white/40">
                Choose a local video file to embed in this journal entry
              </div>
            </div>
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleVideoChange}
        />

        {src ? (
          <div className="border-t border-white/5 px-4 py-3">
            {caption || isHovered ? (
              <input
                type="text"
                value={caption || ""}
                onChange={(e) => updateAttributes({ caption: e.target.value })}
                placeholder="Add a caption..."
                className="w-full border-none bg-transparent text-sm text-white/40 outline-none placeholder:text-white/20"
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </NodeViewWrapper>
  );
}

export const VideoNode = Node.create({
  name: "journalVideo",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      thumbnail: { default: null },
      caption: { default: null },
      duration: { default: null },
      autoplay: { default: false },
      muted: { default: true },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'figure[data-journal-video]',
        getAttrs: (dom) => {
          if (typeof dom === "string") return {};
          const element = dom as HTMLElement;
          const video = element.querySelector("video");
          return {
            src: element.getAttribute("data-src") || video?.getAttribute("src") || "",
            thumbnail:
              element.getAttribute("data-thumbnail") ||
              video?.getAttribute("poster") ||
              null,
            caption: element.getAttribute("data-caption") || null,
            duration: element.getAttribute("data-duration")
              ? Number.parseFloat(element.getAttribute("data-duration") || "")
              : null,
            autoplay:
              element.getAttribute("data-autoplay") === "true" ||
              video?.hasAttribute("autoplay") ||
              false,
            muted:
              element.getAttribute("data-muted") !== "false" &&
              (video?.hasAttribute("muted") ?? true),
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "figure",
      mergeAttributes(HTMLAttributes, {
        "data-journal-video": "",
        "data-src": node.attrs.src || "",
        "data-thumbnail": node.attrs.thumbnail || "",
        "data-caption": node.attrs.caption || "",
        "data-duration":
          node.attrs.duration !== null && node.attrs.duration !== undefined
            ? String(node.attrs.duration)
            : "",
        "data-autoplay": node.attrs.autoplay ? "true" : "false",
        "data-muted": node.attrs.muted ? "true" : "false",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoNodeView);
  },
});
