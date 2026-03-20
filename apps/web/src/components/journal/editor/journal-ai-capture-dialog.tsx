"use client";

import { useEffect, useRef, useState } from "react";
import { Command, Loader2, Paperclip, Play, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import type { JournalAICaptureResult } from "@/components/journal/ai-capture-types";
import {
  journalActionButtonClassName,
  journalActionButtonMutedClassName,
  journalActionIconButtonClassName,
} from "@/components/journal/action-button-styles";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { showAIErrorToast } from "@/lib/ai-error-toast";
import { cn } from "@/lib/utils";
import { useUploadThing } from "@/utils/uploadthing";
import { trpc } from "@/utils/trpc";

export function JournalAICaptureDialog({
  open,
  onOpenChange,
  onApply,
  accountId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (capture: JournalAICaptureResult) => void;
  accountId?: string;
}) {
  const [input, setInput] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const wasOpenRef = useRef(open);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const parseMutation = trpc.journal.parseNaturalCapture.useMutation();
  const { startUpload: startVideoUpload, isUploading: isVideoUploading } =
    useUploadThing((router) => router.videoUploader);

  useEffect(() => {
    if (!open && wasOpenRef.current) {
      setInput("");
      setVideoFile(null);
      setVideoPreviewUrl(null);
      parseMutation.reset();
    }
    wasOpenRef.current = open;
  }, [open, parseMutation]);

  useEffect(() => {
    return () => {
      if (videoPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(videoPreviewUrl);
      }
    };
  }, [videoPreviewUrl]);

  const handleVideoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("video/")) {
      toast.error("Select a video file");
      return;
    }

    if (videoPreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(videoPreviewUrl);
    }

    setVideoFile(file);
    setVideoPreviewUrl(URL.createObjectURL(file));
  };

  const handleClearVideo = () => {
    if (videoPreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(videoPreviewUrl);
    }

    setVideoFile(null);
    setVideoPreviewUrl(null);
    if (videoInputRef.current) {
      videoInputRef.current.value = "";
    }
  };

  const handleInsert = async () => {
    const trimmed = input.trim();
    if (!trimmed && !videoFile) return;

    try {
      let videoUrl: string | undefined;
      let videoName: string | undefined;
      let videoMimeType: string | undefined;

      if (videoFile) {
        const uploadResult = await startVideoUpload([videoFile]);
        videoUrl = uploadResult?.[0]?.ufsUrl ?? uploadResult?.[0]?.url;
        if (!videoUrl) {
          throw new Error("Failed to upload video");
        }
        videoName = videoFile.name;
        videoMimeType = videoFile.type;
      }

      const result = await parseMutation.mutateAsync({
        text: trimmed,
        accountId,
        videoUrl,
        videoName,
        videoMimeType,
      });
      onApply(result as JournalAICaptureResult);
    } catch (error) {
      if (!showAIErrorToast(error)) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to parse journal capture"
        );
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex flex-col gap-0 overflow-hidden rounded-md border border-white/5 bg-sidebar/5 p-2 shadow-2xl backdrop-blur-lg sm:max-w-xl"
      >
        <div className="flex flex-col gap-0 overflow-hidden rounded-sm border border-white/5 bg-sidebar-accent/80">
          {/* Header */}
          <div className="flex items-start gap-3 px-5 py-4">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-white/5 bg-sidebar-accent">
              <Sparkles className="h-3.5 w-3.5 text-teal-400" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-white">AI Capture</div>
              <p className="mt-1 text-xs leading-relaxed text-white/40">
                Write it like a normal journal note. AI will pull out whatever
                structure it can, including relevant journal blocks, and insert
                it directly into the entry.
              </p>
            </div>
            <DialogClose asChild>
              <Button
                type="button"
                className={cn(
                  journalActionIconButtonClassName,
                  "ml-auto size-8"
                )}
              >
                <X className="h-3.5 w-3.5" />
                <span className="sr-only">Close</span>
              </Button>
            </DialogClose>
          </div>

          <Separator />

          {/* Input area */}
          <div className="flex flex-1 flex-col gap-4 px-5 py-5">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  void handleInsert();
                }
              }}
              autoFocus
              rows={6}
              placeholder="Today was rough. I chased EURUSD after missing the clean entry, got stopped, then kept trading trying to make it back."
              className="min-h-[180px] resize-none border-0 bg-transparent px-4 py-3 text-xl font-medium leading-relaxed text-white placeholder:text-white/20 focus-visible:ring-0"
            />
            <div className="flex flex-col gap-3 rounded-sm border border-white/5 bg-sidebar/60 px-4 py-3 text-xs leading-relaxed text-white/38">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-white/60">
                  <Paperclip className="h-3.5 w-3.5" />
                  <span>Optional video</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-7 px-2 text-[11px] text-white/60 hover:text-white"
                  onClick={() => videoInputRef.current?.click()}
                  disabled={isVideoUploading}
                >
                  Attach video
                </Button>
              </div>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleVideoChange}
              />
              {videoFile ? (
                <div className="flex items-center gap-3 rounded-md border border-white/8 bg-black/20 px-3 py-2">
                  <div className="flex size-9 items-center justify-center rounded-md bg-white/5">
                    {videoPreviewUrl ? (
                      <Play className="h-4 w-4 text-teal-300" />
                    ) : (
                      <Paperclip className="h-4 w-4 text-teal-300" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-white/80">
                      {videoFile.name}
                    </p>
                    <p className="text-[11px] text-white/35">
                      {Math.round(videoFile.size / 1024 / 1024)} MB
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-white/40 hover:text-white"
                    onClick={handleClearVideo}
                    disabled={isVideoUploading}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : null}
            </div>
            <div className="rounded-sm border border-white/5 bg-sidebar/60 px-4 py-3 text-xs leading-relaxed text-white/38">
              No special format needed. Example:{" "}
              <span className="text-white/58">
                Had a rough NY session today. I chased NQ after missing the
                clean entry and felt shaky after the second loss. AI can turn
                that into a structured review with charts, psychology, and
                matched trade blocks when they fit.
              </span>
            </div>
          </div>

          <Separator />

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3">
            <div className="hidden items-center gap-1.5 text-[11px] text-white/30 sm:flex">
              <Command className="h-3 w-3" />
              <span>Ctrl/⌘ + Enter to insert</span>
            </div>
            <div className="flex items-center gap-2 sm:ml-auto">
              <Button
                type="button"
                className={journalActionButtonMutedClassName}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className={cn(
                  journalActionButtonClassName,
                  "border-teal-500/30 bg-teal-500/12 text-teal-100 hover:bg-teal-500/20"
                )}
                disabled={(!input.trim() && !videoFile) || parseMutation.isPending || isVideoUploading}
                onClick={() => void handleInsert()}
              >
                {parseMutation.isPending || isVideoUploading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Inserting…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    Insert with AI
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
