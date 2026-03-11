"use client";

import React, { useCallback, useState } from "react";
import { Upload, Image, Video, X, Play, FileVideo, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export interface MediaFile {
  id: string;
  file: File;
  preview?: string;
  type: "image" | "video" | "screen_recording";
  progress?: number;
  uploaded?: boolean;
  error?: string;
  url?: string;
  thumbnailUrl?: string;
}

interface MediaDropzoneProps {
  onFilesSelected: (files: MediaFile[]) => void;
  onFileRemove: (id: string) => void;
  files: MediaFile[];
  accept?: "image" | "video" | "all";
  maxFiles?: number;
  maxSize?: number;
  disabled?: boolean;
  className?: string;
  showPreview?: boolean;
}

export function MediaDropzone({
  onFilesSelected,
  onFileRemove,
  files,
  accept = "all",
  maxFiles = 10,
  maxSize = 100 * 1024 * 1024,
  disabled = false,
  className,
  showPreview = true,
}: MediaDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  const getAcceptTypes = useCallback(() => {
    switch (accept) {
      case "image":
        return "image/*";
      case "video":
        return "video/*";
      default:
        return "image/*,video/*";
    }
  }, [accept]);

  const getFileType = (file: File): "image" | "video" | "screen_recording" => {
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("video/")) {
      const name = file.name.toLowerCase();
      if (name.includes("screen") || name.includes("recording")) {
        return "screen_recording";
      }
      return "video";
    }
    return "video";
  };

  const generatePreview = (file: File): Promise<string | undefined> => {
    return new Promise((resolve) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => resolve(undefined);
        reader.readAsDataURL(file);
      } else if (file.type.startsWith("video/")) {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = () => {
          video.currentTime = 1;
        };
        video.onseeked = () => {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.7));
          URL.revokeObjectURL(video.src);
        };
        video.onerror = () => {
          resolve(undefined);
          URL.revokeObjectURL(video.src);
        };
        video.src = URL.createObjectURL(file);
      } else {
        resolve(undefined);
      }
    });
  };

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const fileArray = Array.from(fileList);
      const remainingSlots = maxFiles - files.length;

      if (remainingSlots <= 0) {
        return;
      }

      const filesToProcess = fileArray.slice(0, remainingSlots);
      const validFiles: MediaFile[] = [];

      for (const file of filesToProcess) {
        if (file.size > maxSize) {
          const mediaFile: MediaFile = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            file,
            type: getFileType(file),
            error: `File too large. Max size is ${Math.round(maxSize / 1024 / 1024)}MB`,
          };
          validFiles.push(mediaFile);
          continue;
        }

        const type = getFileType(file);
        if (accept !== "all") {
          if (accept === "image" && type !== "image") continue;
          if (accept === "video" && type === "image") continue;
        }

        const preview = await generatePreview(file);
        const mediaFile: MediaFile = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file,
          preview,
          type,
          progress: 0,
        };
        validFiles.push(mediaFile);
      }

      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
    },
    [files.length, maxFiles, maxSize, accept, onFilesSelected]
  );

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragCounter((prev) => prev + 1);
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true);
      }
    },
    []
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => {
      const newCount = prev - 1;
      if (newCount === 0) {
        setIsDragging(false);
      }
      return newCount;
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      setDragCounter(0);

      if (disabled) return;

      const { files: droppedFiles } = e.dataTransfer;
      if (droppedFiles && droppedFiles.length > 0) {
        handleFiles(droppedFiles);
      }
    },
    [disabled, handleFiles]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled) return;
      const { files: selectedFiles } = e.target;
      if (selectedFiles && selectedFiles.length > 0) {
        handleFiles(selectedFiles);
      }
      e.target.value = "";
    },
    [disabled, handleFiles]
  );

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div
        role="button"
        tabIndex={0}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => {
          if (!disabled) {
            document.getElementById("media-input")?.click();
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!disabled) {
              document.getElementById("media-input")?.click();
            }
          }
        }}
        className={cn(
          "relative flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-all duration-200",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border/50 hover:border-border hover:bg-muted/30",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <input
          id="media-input"
          type="file"
          accept={getAcceptTypes()}
          multiple={maxFiles > 1}
          onChange={handleInputChange}
          disabled={disabled || files.length >= maxFiles}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-3 p-4">
          <div className="flex gap-2">
            <div className="rounded-lg bg-muted p-3">
              <Image className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="rounded-lg bg-muted p-3">
              <Video className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">
              {isDragging ? "Drop files here" : "Drag & drop images or videos"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              or click to browse (max {Math.round(maxSize / 1024 / 1024)}MB per file)
            </p>
          </div>
        </div>
      </div>

      {showPreview && files.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {files.map((mediaFile) => (
            <div
              key={mediaFile.id}
              className="group relative aspect-video overflow-hidden rounded-lg border bg-muted"
            >
              {mediaFile.type === "image" && mediaFile.preview ? (
                <img
                  src={mediaFile.preview}
                  alt={mediaFile.file.name}
                  className="h-full w-full object-cover"
                />
              ) : mediaFile.preview ? (
                <div className="relative h-full w-full">
                  <img
                    src={mediaFile.preview}
                    alt={mediaFile.file.name}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Play className="h-8 w-8 text-white" />
                  </div>
                </div>
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  {mediaFile.type === "image" ? (
                    <Image className="h-8 w-8 text-muted-foreground" />
                  ) : (
                    <FileVideo className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

              <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 transition-opacity group-hover:opacity-100">
                <p className="truncate text-xs text-white">{mediaFile.file.name}</p>
                <p className="text-xs text-white/70">{formatFileSize(mediaFile.file.size)}</p>
              </div>

              {mediaFile.error && (
                <div className="absolute inset-0 flex items-center justify-center bg-destructive/80 p-2">
                  <p className="text-center text-xs text-white">{mediaFile.error}</p>
                </div>
              )}

              {mediaFile.progress !== undefined && mediaFile.progress < 100 && !mediaFile.error && (
                <div className="absolute bottom-0 left-0 right-0 p-2">
                  <Progress value={mediaFile.progress} className="h-1" />
                </div>
              )}

              {mediaFile.uploaded && (
                <div className="absolute right-1 top-1 rounded-full bg-green-500 p-0.5">
                  <svg
                    className="h-3 w-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              )}

              <Button
                size="icon"
                variant="destructive"
                className="absolute right-1 top-1 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onFileRemove(mediaFile.id);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
